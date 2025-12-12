import { analyzeItem } from '../services/openai';
import fs from 'fs/promises';
import path from 'path';
import { loadProcessedContentCache, ProcessedContentItem } from './3-process-content';
import { CommentInsights } from './2-extract-content';
import { sources } from '../../config/sources';

// Define the structure for AI processed items
export interface AIProcessedItem extends ProcessedContentItem {
  summary?: string;
  eli5?: string;
  hasSummary: boolean;
  sentiment?: 'Positive' | 'Negative' | 'Mixed';
  tags?: string[];
  commentInsights?: CommentInsights;
}

// Define the structure for the AI processed content cache
interface AIProcessedContentCache {
  items: AIProcessedItem[];
  feedMetadata: any;
  lastUpdated: number;
}

// Path to the AI processed content cache file
const AI_PROCESSED_CONTENT_CACHE_PATH = path.join(process.cwd(), '.cache', 'step4-ai-processed-content.json');

/**
 * Process all content items with OpenAI (summarize, analyze sentiment)
 * using the processed content data from Step 3
 */
export async function processWithOpenAI(): Promise<void> {
  console.log('Step 4: Processing content with OpenAI...');

  // Load the processed content data from Step 3
  const processedCache = await loadProcessedContentCache();

  if (processedCache.lastUpdated === 0) {
    console.error('No processed content data found. Please run Step 3 first.');
    return;
  }

  console.log(`Loaded processed content from cache (last updated: ${new Date(processedCache.lastUpdated).toLocaleString()})`);

  // Initialize the AI processed content cache
  const aiProcessedCache: AIProcessedContentCache = {
    items: [],
    feedMetadata: processedCache.feedMetadata,
    lastUpdated: Date.now()
  };

  // Create cache directory if it doesn't exist
  await fs.mkdir(path.dirname(AI_PROCESSED_CONTENT_CACHE_PATH), { recursive: true });

  // Get all feed IDs from both the config and the cache
  const feedIds = new Set<number>();

  // Add feed IDs from the processed items
  for (const item of processedCache.items) {
    feedIds.add(item.feedId);
  }

  // Add feed IDs from the config
  for (const source of sources) {
    feedIds.add(source.id);
  }

  console.log(`Processing content with OpenAI for ${processedCache.items.length} items from ${feedIds.size} feeds...`);

  // Process each item
  for (const item of processedCache.items) {
    console.log(`Processing item with OpenAI: ${item.title} (Feed ID: ${item.feedId})`);

    try {
      let summary: string | undefined;
      let hasSummary = false;
      let eli5: string | undefined;
      let sentiment: 'Positive' | 'Negative' | 'Mixed' | undefined;
      let tags: string[] | undefined;

      // Skip OpenAI processing for non-text content or if flagged to skip
      if (item.shouldSkipAI) {
        console.log(`Skipping OpenAI processing for item. Media type: ${item.mediaType}`);
        console.log(`Defaulting to neutral/mixed sentiment for non-text content.`);
        sentiment = 'Mixed';
      } else {
        const content = item.content || '';

        const shouldAnalyze = content.length > 200 || item.title.length > 20;

        if (shouldAnalyze) {
          try {
            console.log(`Starting analysis for item: "${item.title.substring(0, 50)}..."`);
            const analysis = await analyzeItem(content || item.title, item.title);

            summary = analysis.summary;
            eli5 = analysis.eli5;
            sentiment = analysis.sentiment;
            tags = analysis.tags || [];
            hasSummary = true; // analyzeItem always returns a summary string (even if error message)

            console.log(`Analysis completed for "${item.title}": Sentiment: ${sentiment}`);
          } catch (err: any) {
            console.error(`Failed to analyze item: ${err.message}`);
            sentiment = 'Mixed';
          }
        } else {
          sentiment = 'Mixed';
        }
      }

      // Create the AI processed item
      if (!eli5 && summary) {
        eli5 = summary;
      }
      const aiProcessedItem: AIProcessedItem = {
        ...item,
        summary,
        eli5,
        hasSummary,
        sentiment,
        tags
      };

      // Add to the AI processed items array
      aiProcessedCache.items.push(aiProcessedItem);
      console.log(`Added AI processed item: ${aiProcessedItem.title}`);
    } catch (err: any) {
      console.error(`Failed to process item with OpenAI ${item.title}: ${err.message}`);

      // Add the item without OpenAI processing
      aiProcessedCache.items.push({
        ...item,
        hasSummary: false,
        eli5: undefined,
        sentiment: 'Mixed'
      });
    }
  }

  // Save the AI processed content to cache
  await fs.writeFile(
    AI_PROCESSED_CONTENT_CACHE_PATH,
    JSON.stringify(aiProcessedCache, (key, value) => {
      // Convert Date objects to ISO strings for JSON serialization
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2),
    'utf-8'
  );

  console.log(`Step 4 complete: All content processed with OpenAI and saved to ${AI_PROCESSED_CONTENT_CACHE_PATH}`);
  console.log(`Total AI processed items: ${aiProcessedCache.items.length}`);
}

/**
 * Load the AI processed content from cache
 */
export async function loadAIProcessedContentCache(): Promise<AIProcessedContentCache> {
  try {
    const cacheData = await fs.readFile(AI_PROCESSED_CONTENT_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(cacheData) as AIProcessedContentCache;

    // Convert ISO date strings back to Date objects
    parsed.items = parsed.items.map(item => ({
      ...item,
      published: new Date(item.published)
    }));

    return parsed;
  } catch (error) {
    console.error('Failed to load AI processed content cache:', error);
    return {
      items: [],
      feedMetadata: {},
      lastUpdated: 0
    };
  }
}

// Main function to run this step independently
async function main() {
  try {
    await processWithOpenAI();
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete OpenAI processing:', err);
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
