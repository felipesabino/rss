import type { AIProcessedItem } from '../steps/4-process-with-openai';

export interface RankedAIProcessedItem extends AIProcessedItem {
    rankingScore: number; // final blended score 0-100
    recencyScore: number;
    relevanceScore: number;
}

interface InstructionProfile {
    keywordWeights: KeywordWeight[];
    totalWeight: number;
}

interface KeywordWeight {
    term: string;
    weight: number;
    isPhrase: boolean;
}

const STOP_WORDS = new Set([
    'and', 'the', 'that', 'with', 'from', 'over', 'this', 'into', 'will', 'have', 'has', 'about', 'each', 'their', 'they',
    'them', 'such', 'also', 'been', 'past', 'days', 'daily', 'brief', 'focus', 'major', 'story', 'stories', 'news', 'very',
    'should', 'when', 'relevant', 'where', 'what', 'why', 'that', 'those', 'between', 'could', 'would', 'other', 'more',
    'only', 'your', 'like', 'time', 'term', 'long', 'short', 'week', 'weeks', 'months', 'years', 'overall', 'provide',
    'clearly', 'describe', 'impact', 'impacts', 'analysis', 'perform', 'classification', 'classifying', 'sentiment', 'overall'
]);

/**
 * Selects the best items ensuring diversity across sources.
 * Strategy:
 * 1. Group items by source.
 * 2. Select top K items from each source (sorted by recency).
 * 3. Combine and sort the final list by recency.
 * This ensures that we don't just get the top 20 items from a single high-volume source.
 */
export function selectDiverseBestItems(
    items: AIProcessedItem[],
    customInstructions: string,
    topKPerSource: number = 3
): RankedAIProcessedItem[] {
    const profile = buildInstructionProfile(customInstructions);

    // Score every item for the category using the instruction profile
    const scoredItems = items.map(item => scoreItemAgainstInstruction(item, profile));

    // Group by source
    const itemsBySource = new Map<number, RankedAIProcessedItem[]>();
    for (const item of scoredItems) {
        if (!itemsBySource.has(item.feedId)) {
            itemsBySource.set(item.feedId, []);
        }
        itemsBySource.get(item.feedId)?.push(item);
    }

    const selectedItems: RankedAIProcessedItem[] = [];

    // Select top K from each source based on ranking score (tie-breaker: recency)
    for (const [, sourceItems] of Array.from(itemsBySource)) {
        sourceItems.sort((a, b) => {
            if (b.rankingScore !== a.rankingScore) {
                return b.rankingScore - a.rankingScore;
            }
            return new Date(b.published).getTime() - new Date(a.published).getTime();
        });

        selectedItems.push(...sourceItems.slice(0, topKPerSource));
    }

    // Sort combined list by score, keeping recency as fallback
    selectedItems.sort((a, b) => {
        if (b.rankingScore !== a.rankingScore) {
            return b.rankingScore - a.rankingScore;
        }
        return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    return selectedItems;
}

export function hasRankingScore(item: AIProcessedItem): item is RankedAIProcessedItem {
    return typeof (item as RankedAIProcessedItem).rankingScore === 'number';
}

function buildInstructionProfile(instruction: string): InstructionProfile {
    const normalized = instruction.replace(/[’‘]/g, '\'').replace(/[–—]/g, ' ');
    const tokenized = normalized
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length >= 3 && !STOP_WORDS.has(token));

    const weightsMap = new Map<string, KeywordWeight>();

    const addWeight = (term: string, weight: number, isPhrase = false) => {
        const normalizedTerm = term.toLowerCase().trim();
        if (!normalizedTerm) return;

        const existing = weightsMap.get(normalizedTerm);
        if (existing) {
            existing.weight += weight;
            existing.isPhrase = existing.isPhrase || isPhrase;
        } else {
            weightsMap.set(normalizedTerm, {
                term: normalizedTerm,
                weight,
                isPhrase
            });
        }
    };

    for (const token of tokenized) {
        addWeight(token, 1);
    }

    // Capture proper noun phrases (e.g., "Air France")
    const phraseMatches = normalized.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || [];
    for (const phrase of phraseMatches) {
        addWeight(phrase, 2, true);
    }

    const keywordWeights = Array.from(weightsMap.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 40);

    const totalWeight = keywordWeights.reduce((sum, keyword) => sum + keyword.weight, 0) || 1;

    return {
        keywordWeights,
        totalWeight
    };
}

function scoreItemAgainstInstruction(item: AIProcessedItem, profile: InstructionProfile): RankedAIProcessedItem {
    const now = Date.now();
    const publishedTime = new Date(item.published).getTime();
    const ageInHours = Math.max(1, (now - publishedTime) / (1000 * 60 * 60));
    const recencyScore = 1 / (1 + ageInHours / 24); // strong decay after ~1 day but not zero

    const normalizedContent = normalizeContentForScoring(`${item.title} ${item.summary || ''} ${item.content || ''}`);

    const matchedWeight = profile.keywordWeights.reduce((sum, keyword) => {
        const occurrences = countOccurrences(normalizedContent, keyword.term, keyword.isPhrase);
        if (!occurrences) {
            return sum;
        }

        // Limit repeated occurrences but reward emphasis
        const cappedOccurrences = Math.min(occurrences, 3);
        return sum + keyword.weight * cappedOccurrences;
    }, 0);

    const relevanceScore = Math.min(1, matchedWeight / (profile.totalWeight * 3));

    const summaryBoost = item.hasSummary ? 0.05 : 0;
    const sentimentBoost = item.isPositive ? 0.05 : 0;

    const blended = (relevanceScore * 0.65) + (recencyScore * 0.25) + summaryBoost + sentimentBoost;
    const rankingScore = Math.max(0, Math.min(100, blended * 100));

    return {
        ...item,
        rankingScore,
        recencyScore,
        relevanceScore
    };
}

function normalizeContentForScoring(value: string): string {
    return value
        .toLowerCase()
        .replace(/[’‘]/g, '\'')
        .replace(/[–—]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function countOccurrences(text: string, term: string, isPhrase: boolean): number {
    if (!term) {
        return 0;
    }

    const escaped = escapeRegExp(term);
    const pattern = isPhrase ? `\\b${escaped}\\b` : `\\b${escaped}\\b`;
    const regex = new RegExp(pattern, 'g');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
