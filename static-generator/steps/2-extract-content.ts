import { contentExtractor } from '../services/content';
import { parseDate } from '../services/date-parser';
import { FilePipelineStore, PipelineStore, ExtractedItem, ExtractedContentCache } from '../services/pipeline-store';

/**
 * Extract content from all feed items using the raw feed data from Step 1
 */
export async function extractAllContent(store: PipelineStore = new FilePipelineStore()): Promise<void> {
  console.log('Step 2: Extracting content from raw feed data...');

  // Load the raw feed data from Step 1
  const rawFeedCache = await store.loadRawFeedCache();

  if (rawFeedCache.lastUpdated === 0) {
    console.error('No raw feed data found. Please run Step 1 first.');
    return;
  }

  console.log(`Loaded raw feed data from cache (last updated: ${new Date(rawFeedCache.lastUpdated).toLocaleString()})`);

  // Initialize the extracted content cache
  const extractedCache: ExtractedContentCache = {
    items: [],
    feedMetadata: rawFeedCache.feedMetadata,
    lastUpdated: Date.now()
  };

  // Process each feed
  let itemIdCounter = 1;

  // Process each feed ID from the cache
  for (const feedId of Object.keys(rawFeedCache.items)) {
    // Skip if the feed doesn't exist in the raw feed cache
    if (!(feedId in rawFeedCache.items)) {
      console.log(`Feed ID ${feedId} not found in raw feed cache. Run Step 1 to fetch this feed.`);
      continue;
    }

    // Use type assertion to handle string index
    const items = rawFeedCache.items as Record<string, FeedItem[]>;
    const feedItems = items[feedId];
    console.log(`Extracting content for ${feedItems.length} items from feed ID ${feedId}...`);

    for (const item of feedItems) {
      console.log(`Extracting content for item: ${item.title}`);

      try {
        // Determine the URL to process
        let url = '';
        let isYouTubeUrl = false;

        if (item.link.includes('reddit.com')) {
          // Find non reddit.com urls on the HTML encoded content
          const urlRegex = /href=(?:"|")(?!https?:\/\/(?:www\.)?reddit\.com)([^"&]+)(?:"|")/;
          try {
            let match = urlRegex.exec(item.content!);
            url = match ? match[1] : item.link!;

            // Check if the URL is a YouTube URL
            isYouTubeUrl = url.includes('youtube.com') || url.includes('youtu.be');

          } catch (err: any) {
            url = item.link!;
          }
          console.log(`Reddit URL replacement. Old: ${item.content?.substring(0, 30)}...; New: ${url}`);
        } else {
          url = item.link!;  // For other feeds, use the item link
          // Check if the URL is a YouTube URL
          isYouTubeUrl = url.includes('youtube.com') || url.includes('youtu.be');
        }

        // Extract content from URL
        let content = '';
        let mediaType: string | undefined;
        let mediaUrl: string | undefined;

        console.log(`Extracting content for: ${url}`);

        // If it's a YouTube URL, set the media type directly
        if (isYouTubeUrl) {
          console.log(`YouTube URL detected: ${url}`);
          content = '';
          mediaType = 'video';
          mediaUrl = url;
        } else {
          try {
            const contentResult = await contentExtractor(url);
            content = contentResult.content;

            // If content extraction was skipped, get the media type and URL
            if (contentResult.skipReason) {
              console.log(`Content extraction skipped: ${contentResult.skipReason}`);

              // Get the media type and URL
              mediaType = contentResult.mediaType || 'unknown';
              mediaUrl = contentResult.mediaUrl || url;
              console.log(`Media type detected: ${mediaType}, Media URL: ${mediaUrl}`);
            }
          } catch (err: any) {
            console.error(`Failed to extract content: ${err.message}`);

            // Set media type to error
            mediaType = 'error';
            mediaUrl = url;
          }
        }

        // Create the extracted item
        const extractedItem: ExtractedItem = {
          id: itemIdCounter++,
          feedId: parseInt(feedId, 10),
          title: item.title!,
          url: item.link!,
          content,
          published: item.pubDate ? parseDate(item.pubDate) : new Date(),
          commentsUrl: item.comments,
          mediaType,
          mediaUrl
        };

        // Add to the extracted items array
        extractedCache.items.push(extractedItem);
        console.log(`Added extracted item: ${extractedItem.title}`);
      } catch (err: any) {
        console.error(`Failed to extract content for item ${item.title}: ${err.message}`);
        continue;
      }
    }
  }

  // Save the extracted content to cache
  await store.saveExtractedContentCache(extractedCache);

  console.log('Step 2 complete: All content extracted and cached');
  console.log(`Total extracted items: ${extractedCache.items.length}`);
}

/**
 * Load the extracted content from cache
 */
export async function loadExtractedContentCache(): Promise<ExtractedContentCache> {
  const store = new FilePipelineStore();
  return store.loadExtractedContentCache();
}

// Main function to run this step independently
async function main() {
  try {
    await extractAllContent();
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete content extraction:', err);
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
