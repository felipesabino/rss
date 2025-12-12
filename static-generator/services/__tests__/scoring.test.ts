import fs from 'fs/promises';
import path from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIProcessedItem } from '../../steps/4-process-with-openai';
import {
    cacheScoringResult,
    hasRankingScore,
    loadScoringCache,
    scoreItemsForInstructions,
    selectTopRankedItems
} from '../scoring';
import type { RankedAIProcessedItem } from '../scoring';

let idCounter = 1;

function createItem(overrides: Partial<AIProcessedItem> = {}): AIProcessedItem {
    return {
        id: overrides.id ?? idCounter++,
        feedId: overrides.feedId ?? 1,
        title: overrides.title ?? 'Generic news headline',
        url: overrides.url ?? 'https://example.com/story',
        content: overrides.content ?? 'generic content about technology and robotics',
        published: overrides.published ?? new Date('2024-01-05T00:00:00.000Z'),
        mediaType: overrides.mediaType ?? 'text',
        mediaUrl: overrides.mediaUrl,
        shouldSkipAI: overrides.shouldSkipAI ?? false,
        commentsUrl: overrides.commentsUrl,
        summary: overrides.summary,
        hasSummary: overrides.hasSummary ?? true,
        sentiment: overrides.sentiment ?? 'Mixed'
    };
}

describe('scoring service', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'));
        idCounter = 1;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('scores items with custom instructions and enforces source diversity', () => {
        const items: AIProcessedItem[] = [
            createItem({
                feedId: 1,
                title: 'General market update',
                content: 'Broad market commentary without robotics'
            }),
            createItem({
                feedId: 1,
                title: 'Robotics company breaks record',
                content: 'Breakthrough robotics and automation hardware'
            }),
            createItem({
                feedId: 2,
                title: 'Semiconductor rally continues',
                content: 'Semiconductor advances pushing robotics and AI forward'
            })
        ];

        const scoredItems = scoreItemsForInstructions(items, 'Highlight robotics and semiconductor breakthroughs');
        const selected = selectTopRankedItems(scoredItems, 1);

        expect(selected).toHaveLength(2);
        const sourceOnePick = selected.find(item => item.feedId === 1);
        expect(sourceOnePick?.title).toContain('Robotics');
        expect(hasRankingScore(selected[0])).toBe(true);
        expect(hasRankingScore(items[0])).toBe(false);
    });

    it('orders ties by recency when ranking scores match', () => {
        const older: RankedAIProcessedItem = {
            ...createItem({ id: 100, feedId: 3, published: new Date('2024-01-01T00:00:00.000Z') }),
            rankingScore: 80,
            recencyScore: 0.2,
            relevanceScore: 0.8
        };
        const newer: RankedAIProcessedItem = {
            ...createItem({ id: 101, feedId: 3, published: new Date('2024-01-08T00:00:00.000Z') }),
            rankingScore: 80,
            recencyScore: 0.5,
            relevanceScore: 0.8
        };

        const ordered = selectTopRankedItems([older, newer], 2);
        expect(ordered[0].id).toBe(101);
        expect(ordered[1].id).toBe(100);
    });
});

describe('scoring audit cache', () => {
    const TEST_CACHE_PATH = path.join(process.cwd(), '.cache', 'scoring-history.test.json');

    beforeEach(async () => {
        process.env.SCORING_CACHE_PATH = TEST_CACHE_PATH;
        idCounter = 1;
        await fs.rm(TEST_CACHE_PATH, { force: true });
    });

    afterAll(async () => {
        await fs.rm(TEST_CACHE_PATH, { force: true });
        delete process.env.SCORING_CACHE_PATH;
    });

    it('persists scoring results for audit', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-02-01T00:00:00.000Z'));

        try {
            const items = [
                createItem({ feedId: 5, content: 'Robotics and AI boom continues' }),
                createItem({ feedId: 6, content: 'Space robotics partners with AI firms' })
            ];

            const scored = scoreItemsForInstructions(items, 'Cover robotics and AI collaboration');
            const selected = selectTopRankedItems(scored, 1);

            await cacheScoringResult({
                label: 'Technology',
                customInstructions: 'Cover robotics and AI collaboration',
                scoredItems: scored,
                selectedItems: selected,
                topKPerSource: 1,
                scoredAt: Date.now()
            });

            const cache = await loadScoringCache();
            expect(cache.records[0].label).toBe('Technology');
            expect(cache.records[0].selectedItems.map(item => item.id)).toEqual(selected.map(item => item.id));
            expect(cache.records[0].scoredItems[0].published).toBeInstanceOf(Date);
        } finally {
            vi.useRealTimers();
        }
    });
});
