import { analyzeItem } from '../services/openai';
import {
  AIProcessedContentCache,
  AIProcessedItem,
  FilePipelineStore,
  PipelineStore
} from '../services/pipeline-store';

/**
 * Process all content items with OpenAI (summarize, analyze sentiment)
 * using the processed content data from Step 3
 */
export async function processWithOpenAI(store: PipelineStore = new FilePipelineStore()): Promise<void> {
  console.log('Step 4: Processing content with OpenAI...');

  // Load the processed content data from Step 3
  const processedCache = await store.loadProcessedContentCache();

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

  console.log(`Processing content with OpenAI for ${processedCache.items.length} items...`);

  // Process each item
  for (const item of processedCache.items) {
    console.log(`Processing item with OpenAI: ${item.title} (Feed ID: ${item.feedId})`);

    try {
      let summary: string | undefined;
      let hasSummary = false;
      let isPositive: boolean | undefined;

      // Skip OpenAI processing for non-text content or if flagged to skip
      if (item.shouldSkipAI) {
        console.log(`Skipping OpenAI processing for item. Media type: ${item.mediaType}`);
        console.log(`Defaulting to not positive for non-text content.`);

        // Default to not positive for non-text content
        isPositive = false;
      } else {
        const content = item.content || '';

        // Only analyze if content is substantial or we want to analyze title
        // We'll analyze if content > 200 chars OR if we just want to rely on title for short content
        // But the original code had a check for summary (content > 500)

        const shouldAnalyze = content.length > 200 || item.title.length > 20;

        if (shouldAnalyze) {
          try {
            console.log(`Starting analysis for item: "${item.title.substring(0, 50)}..."`);
            const analysis = await analyzeItem(content || item.title, item.title);

            summary = analysis.summary;
            isPositive = analysis.isPositive;
            hasSummary = true; // analyzeItem always returns a summary string (even if error message)

            console.log(`Analysis completed for "${item.title}": Sentiment: ${isPositive ? 'Positive ✅' : 'Negative/Neutral ❌'}`);
          } catch (err: any) {
            console.error(`Failed to analyze item: ${err.message}`);
            // Default values on error
            isPositive = false;
          }
        } else {
          // Very short content, maybe just skip or default
          isPositive = false;
        }
      }

      // Create the AI processed item
      const aiProcessedItem: AIProcessedItem = {
        ...item,
        summary,
        hasSummary,
        isPositive
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
        isPositive: false
      });
    }
  }

  // Save the AI processed content to cache
  await store.saveAIProcessedContentCache(aiProcessedCache);

  console.log('Step 4 complete: All content processed with OpenAI and cached');
  console.log(`Total AI processed items: ${aiProcessedCache.items.length}`);
}

/**
 * Load the AI processed content from cache
 */
export async function loadAIProcessedContentCache(): Promise<AIProcessedContentCache> {
  const store = new FilePipelineStore();
  return store.loadAIProcessedContentCache();
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
