import fs from 'fs/promises';
import path from 'path';
import { loadAIProcessedContentCache, AIProcessedItem } from './4-process-with-openai';
import { generateCategoryReport, ReportItem, Report } from '../services/openai';
import { sources } from '../../config/sources';
import { categoryPrompts } from '../../config/category-prompts';

// Define the structure for category reports
export interface CategoryReport {
    category: string;
    report: Report;
    generatedAt: number;
}

// Define the structure for the reports cache
interface ReportsCache {
    reports: CategoryReport[];
    lastUpdated: number;
}

// Path to the reports cache file
const REPORTS_CACHE_PATH = path.join(process.cwd(), '.cache', 'step5-reports.json');

/**
 * Generate newsletter-style reports for each category
 * using the AI processed content from Step 4
 */
export async function generateReports(): Promise<void> {
    console.log('Step 5: Generating category reports...');

    // Load the AI processed content data from Step 4
    const aiProcessedCache = await loadAIProcessedContentCache();

    if (aiProcessedCache.lastUpdated === 0) {
        console.error('No AI processed content data found. Please run Step 4 first.');
        return;
    }

    console.log(`Loaded AI processed content from cache (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`);

    // Initialize the reports cache
    let reportsCache: ReportsCache = {
        reports: [],
        lastUpdated: Date.now()
    };

    // Try to load existing cache to avoid regenerating reports if not needed
    try {
        const existingCacheData = await fs.readFile(REPORTS_CACHE_PATH, 'utf-8');
        const existingCache = JSON.parse(existingCacheData) as ReportsCache;
        // We might want to keep existing reports if they are recent enough, 
        // but for now let's just start fresh or maybe implement incremental updates later.
        // The user asked for "its own cache rules".
        // Let's reuse existing reports if they exist, but we need to know if content changed.
        // For simplicity in this iteration, we'll regenerate. 
        // Optimization: We could check if the report was generated recently (e.g. last 4 hours)
        reportsCache.reports = existingCache.reports || [];
    } catch (error) {
        // Ignore error if file doesn't exist
    }

    // Create cache directory if it doesn't exist
    await fs.mkdir(path.dirname(REPORTS_CACHE_PATH), { recursive: true });

    // Group items by category
    const itemsByCategory = new Map<string, AIProcessedItem[]>();

    for (const item of aiProcessedCache.items) {
        // Find the source for this item
        const source = sources.find(s => s.id === item.feedId);

        if (source && source.categories) {
            for (const category of source.categories) {
                if (!itemsByCategory.has(category)) {
                    itemsByCategory.set(category, []);
                }
                itemsByCategory.get(category)?.push(item);
            }
        }
    }

    const categories = Array.from(itemsByCategory.keys()).sort();
    console.log(`Found ${categories.length} categories: ${categories.join(', ')}`);

    const newReports: CategoryReport[] = [];

    // Generate report for each category
    for (const category of categories) {
        let items = itemsByCategory.get(category) || [];

        // Get custom instructions for this category if available
        const customInstructions = categoryPrompts[category.toLowerCase()];

        // Strategy to score, rank and select the best items
        // Only apply this strategy if the category has a specific prompt
        if (customInstructions) {
            console.log(`Applying diversity clustering and ranking for category "${category}"...`);
            items = selectDiverseBestItems(items, customInstructions);
        } else {
            // Default behavior: Sort items by date (newest first)
            items.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        }

        console.log(`Generating report for category "${category}" with ${items.length} items...`);

        // Convert to ReportItem format
        const reportItems: ReportItem[] = items.map((item, index) => {
            const source = sources.find(s => s.id === item.feedId);
            let score = 100 - index;

            if (hasRankingScore(item)) {
                score = Math.max(0, Math.round(item.rankingScore * 100) / 100);
            }

            return {
                title: item.title,
                summary: item.summary,
                url: item.url,
                published: new Date(item.published),
                sourceName: source?.name || 'Unknown Source',
                score: score > 0 ? score : 0
            };
        });

        // Check if we have a recent report for this category
        const existingReport = reportsCache.reports.find(r => r.category === category);
        const ONE_HOUR = 60 * 60 * 1000;

        // If we have a report generated less than 1 hour ago, reuse it
        // Unless we force regeneration (could add a flag for that)
        if (existingReport && (Date.now() - existingReport.generatedAt < ONE_HOUR)) {
            console.log(`Using cached report for "${category}" (generated ${new Date(existingReport.generatedAt).toLocaleTimeString()})`);
            newReports.push(existingReport);
            continue;
        }

        // Generate new report
        const reportData = await generateCategoryReport(category, reportItems, customInstructions);

        if (reportData) {
            newReports.push({
                category,
                report: reportData,
                generatedAt: Date.now()
            });
            console.log(`Generated new report for "${category}"`);
        } else {
            console.warn(`Failed to generate report for "${category}"`);
            // Keep old report if available
            if (existingReport) {
                newReports.push(existingReport);
            }
        }
    }

    // Update cache
    reportsCache = {
        reports: newReports,
        lastUpdated: Date.now()
    };

    // Save the reports to cache
    await fs.writeFile(
        REPORTS_CACHE_PATH,
        JSON.stringify(reportsCache, null, 2),
        'utf-8'
    );

    console.log(`Step 5 complete: Reports generated and saved to ${REPORTS_CACHE_PATH}`);
}

/**
 * Load the reports from cache
 */
export async function loadReportsCache(): Promise<ReportsCache> {
    try {
        const cacheData = await fs.readFile(REPORTS_CACHE_PATH, 'utf-8');
        return JSON.parse(cacheData) as ReportsCache;
    } catch (error) {
        console.error('Failed to load reports cache:', error);
        return {
            reports: [],
            lastUpdated: 0
        };
    }
}

// Main function to run this step independently
async function main() {
    try {
        await generateReports();
        process.exit(0);
    } catch (err) {
        console.error('Failed to complete report generation:', err);
        process.exit(1);
    }
}

// Execute the main function if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

// Helper function to get file URL path
function fileURLToPath(url: string): string {
    return new URL(url).pathname;
}

/**
 * Selects the best items ensuring diversity across sources.
 * Strategy:
 * 1. Group items by source.
 * 2. Select top K items from each source (sorted by recency).
 * 3. Combine and sort the final list by recency.
 * This ensures that we don't just get the top 20 items from a single high-volume source.
 */
function selectDiverseBestItems(items: AIProcessedItem[], customInstructions: string, topKPerSource: number = 3): RankedAIProcessedItem[] {
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

interface RankedAIProcessedItem extends AIProcessedItem {
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

function hasRankingScore(item: AIProcessedItem): item is RankedAIProcessedItem {
    return typeof (item as RankedAIProcessedItem).rankingScore === 'number';
}
