import fs from 'fs/promises';
import path from 'path';
import type { AIProcessedItem } from '../steps/4-process-with-openai';

export interface RankedAIProcessedItem extends AIProcessedItem {
    rankingScore: number; // final blended score 0-100
    recencyScore: number;
    relevanceScore: number;
}

/**
 * Persistent record with all the details needed to audit a scoring run.
 */
export interface ScoringAuditRecord {
    label: string;
    scoredAt: number;
    customInstructions: string;
    scoredItems: RankedAIProcessedItem[];
    selectedItems: RankedAIProcessedItem[];
    topKPerSource: number;
}

interface ScoringAuditCache {
    records: ScoringAuditRecord[];
    lastUpdated: number;
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

const DEFAULT_TOP_K_PER_SOURCE = 3;

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
    topKPerSource: number = DEFAULT_TOP_K_PER_SOURCE
): RankedAIProcessedItem[] {
    const scoredItems = scoreItemsForInstructions(items, customInstructions);
    return selectTopRankedItems(scoredItems, topKPerSource);
}

/**
 * Scores every item against the provided instructions and returns
 * the enriched list with ranking metadata.
 */
export function scoreItemsForInstructions(
    items: AIProcessedItem[],
    customInstructions: string
): RankedAIProcessedItem[] {
    const profile = buildInstructionProfile(customInstructions);
    return items.map(item => scoreItemAgainstInstruction(item, profile));
}

/**
 * Applies the diversity heuristic to a list that already contains ranking data.
 * This is split from scoring so callers can cache/audit the scores before the selection.
 */
export function selectTopRankedItems(
    scoredItems: RankedAIProcessedItem[],
    topKPerSource: number = DEFAULT_TOP_K_PER_SOURCE
): RankedAIProcessedItem[] {
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

/**
 * Type guard used by report generation to check if an item already contains ranking data.
 */
export function hasRankingScore(item: AIProcessedItem): item is RankedAIProcessedItem {
    return typeof (item as RankedAIProcessedItem).rankingScore === 'number';
}

/**
 * Persist the full scoring result so we can audit how the newsletter was built.
 */
export async function cacheScoringResult(record: ScoringAuditRecord): Promise<void> {
    const cachePath = getScoringCachePath();
    const cache = await loadScoringCache();

    cache.records.unshift({
        ...record,
        scoredAt: record.scoredAt || Date.now()
    });
    cache.records = cache.records.slice(0, 200); // keep cache bounded
    cache.lastUpdated = Date.now();

    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(
        cachePath,
        JSON.stringify(cache, (key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }, 2),
        'utf-8'
    );
}

/**
 * Load the scoring cache. Returns an empty cache if no prior scoring runs exist.
 */
export async function loadScoringCache(): Promise<ScoringAuditCache> {
    const cachePath = getScoringCachePath();

    try {
        const cacheData = await fs.readFile(cachePath, 'utf-8');
        const rawCache = JSON.parse(cacheData) as ScoringAuditCache;

        return {
            records: (rawCache.records || []).map(record => ({
                ...record,
                scoredItems: record.scoredItems.map(item => ({
                    ...item,
                    published: new Date(item.published)
                })),
                selectedItems: record.selectedItems.map(item => ({
                    ...item,
                    published: new Date(item.published)
                }))
            })),
            lastUpdated: rawCache.lastUpdated || 0
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Failed to load scoring cache:', error);
        }

        return {
            records: [],
            lastUpdated: 0
        };
    }
}

function getScoringCachePath(): string {
    return process.env.SCORING_CACHE_PATH || path.join(process.cwd(), '.cache', 'scoring-history.json');
}

/**
 * Build a keyword profile from the category instructions.
 */
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

/**
 * Calculate ranking, recency, and relevance scores for a single item.
 */
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
    const sentimentBoost = item.sentiment === 'Positive' ? 0.05 : 0;

    const blended = (relevanceScore * 0.65) + (recencyScore * 0.25) + summaryBoost + sentimentBoost;
    const rankingScore = Math.max(0, Math.min(100, blended * 100));

    return {
        ...item,
        rankingScore,
        recencyScore,
        relevanceScore
    };
}

/**
 * Normalize text so scoring and keyword matching remain consistent.
 */
function normalizeContentForScoring(value: string): string {
    return value
        .toLowerCase()
        .replace(/[’‘]/g, '\'')
        .replace(/[–—]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Count the occurrences of a keyword or phrase inside the normalized text.
 */
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
