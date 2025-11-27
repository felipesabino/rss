import { generateCategoryReport, ReportItem, Report, REPORT_ITEM_LIMIT } from '../services/openai';
import {
    cacheScoringResult,
    hasRankingScore,
    scoreItemsForInstructions,
    selectTopRankedItems
} from '../services/scoring';
import { categoryPrompts } from '../../config/category-prompts';
import {
    CategoryReport,
    FilePipelineStore,
    PipelineStore,
    ReportsCache
} from '../services/pipeline-store';
const TOP_K_PER_SOURCE = 3;

/**
 * Generate newsletter-style reports for each category
 * using the AI processed content from Step 4
 */
export async function generateReports(store: PipelineStore = new FilePipelineStore()): Promise<void> {
    console.log('Step 5: Generating category reports...');

    // Load the AI processed content data from Step 4
    const aiProcessedCache = await store.loadAIProcessedContentCache();

    if (aiProcessedCache.lastUpdated === 0) {
        console.error('No AI processed content data found. Please run Step 4 first.');
        return;
    }

    console.log(`Loaded AI processed content from cache (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`);

    // Initialize the reports cache
    let reportsCache: ReportsCache = await store.loadReportsCache();
    reportsCache.lastUpdated = Date.now();

    // Group items by category
    const itemsByCategory = new Map<string, AIProcessedItem[]>();

    for (const item of aiProcessedCache.items) {
        const metadata = aiProcessedCache.feedMetadata?.[item.feedId];
        const itemCategories = metadata?.categories || [];

        if (itemCategories.length) {
            for (const category of itemCategories) {
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
            const scoredItems = scoreItemsForInstructions(items, customInstructions);
            items = selectTopRankedItems(scoredItems, TOP_K_PER_SOURCE);

            const scoredItemsForAudit = [...scoredItems].sort((a, b) => {
                if (b.rankingScore !== a.rankingScore) {
                    return b.rankingScore - a.rankingScore;
                }
                return new Date(b.published).getTime() - new Date(a.published).getTime();
            });

            await cacheScoringResult(
                {
                    label: category,
                    customInstructions,
                    scoredItems: scoredItemsForAudit,
                    selectedItems: items,
                    topKPerSource: TOP_K_PER_SOURCE,
                    scoredAt: Date.now()
                },
                store
            );
        } else {
            // Default behavior: Sort items by date (newest first)
            items.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        }

        console.log(`Generating report for category "${category}" with ${items.length} items...`);

        // Convert to ReportItem format
        const reportItems: ReportItem[] = items.map((item, index) => {
            const metadata = aiProcessedCache.feedMetadata?.[item.feedId];
            let score = 100 - index;

            if (hasRankingScore(item)) {
                score = Math.max(0, Math.round(item.rankingScore * 100) / 100);
            }

            return {
                title: item.title,
                summary: item.summary,
                url: item.url,
                published: new Date(item.published),
                sourceName: metadata?.title || 'Unknown Source',
                score: score > 0 ? score : 0,
                sourceItemId: item.id
            };
        });

        // Check if we have a recent report for this category
        const existingReport = reportsCache.reports.find(r => r.category === category);
        const ONE_HOUR = 60 * 60 * 1000;

        // If we have a report generated less than 1 hour ago, reuse it
        // Unless we force regeneration (could add a flag for that)
        if (existingReport && (Date.now() - existingReport.generatedAt < ONE_HOUR)) {
            console.log(`Using cached report for "${category}" (generated ${new Date(existingReport.generatedAt).toLocaleTimeString()})`);
            newReports.push({
                ...existingReport,
                usedItemIds: existingReport.usedItemIds || []
            });
            continue;
        }

        // Generate new report
        const itemsForReport = reportItems.slice(0, REPORT_ITEM_LIMIT);
        const usedItemIds = itemsForReport
            .map(item => item.sourceItemId)
            .filter((id): id is number => typeof id === 'number');

        const reportData = await generateCategoryReport(category, itemsForReport, customInstructions);

        if (reportData) {
            newReports.push({
                category,
                report: reportData,
                generatedAt: Date.now(),
                usedItemIds
            });
            console.log(`Generated new report for "${category}"`);
        } else {
            console.warn(`Failed to generate report for "${category}"`);
            // Keep old report if available
            if (existingReport) {
                newReports.push({
                    ...existingReport,
                    usedItemIds: existingReport.usedItemIds || []
                });
            }
        }
    }

    // Update cache
    reportsCache = {
        reports: newReports,
        lastUpdated: Date.now()
    };

    // Save the reports to cache
    await store.saveReportsCache(reportsCache);

    console.log('Step 5 complete: Reports generated and cached');
}

/**
 * Load the reports from cache
 */
export async function loadReportsCache(): Promise<ReportsCache> {
    const store = new FilePipelineStore();
    return store.loadReportsCache();
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
