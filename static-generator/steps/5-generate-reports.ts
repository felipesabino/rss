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
            items = selectDiverseBestItems(items);
        } else {
            // Default behavior: Sort items by date (newest first)
            items.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        }

        console.log(`Generating report for category "${category}" with ${items.length} items...`);

        // Convert to ReportItem format
        const reportItems: ReportItem[] = items.map((item, index) => {
            const source = sources.find(s => s.id === item.feedId);
            // Calculate a simple score based on recency and order (since they are already sorted/ranked)
            // We can use the index to represent the rank score (lower index = higher score)
            const score = 100 - index;

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
function selectDiverseBestItems(items: AIProcessedItem[], topKPerSource: number = 3): AIProcessedItem[] {
    // Group by source
    const itemsBySource = new Map<number, AIProcessedItem[]>();
    for (const item of items) {
        if (!itemsBySource.has(item.feedId)) {
            itemsBySource.set(item.feedId, []);
        }
        itemsBySource.get(item.feedId)?.push(item);
    }

    const selectedItems: AIProcessedItem[] = [];

    // Select top K from each source
    for (const [sourceId, sourceItems] of Array.from(itemsBySource)) {
        // Sort by date within source (newest first)
        sourceItems.sort((a: AIProcessedItem, b: AIProcessedItem) => new Date(b.published).getTime() - new Date(a.published).getTime());

        // Take top K
        // We prioritize items with summaries if available, but for now just recency
        selectedItems.push(...sourceItems.slice(0, topKPerSource));
    }

    // Sort the combined list by date (newest first)
    // This effectively ranks them by "Recency" but the pool is now diverse.
    selectedItems.sort((a: AIProcessedItem, b: AIProcessedItem) => new Date(b.published).getTime() - new Date(a.published).getTime());

    return selectedItems;
}
