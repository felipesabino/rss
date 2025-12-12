import fs from 'fs/promises';
import path from 'path';
import { loadExtractedContentCache, ExtractedItem } from './2-extract-content';
import { NON_TEXT_DOMAINS, NON_TEXT_EXTENSIONS } from '../../config/constants';
import { URL } from 'url';
import { sources } from '../../config/sources';

// Define the structure for processed content items
export interface ProcessedContentItem extends ExtractedItem {
  mediaType: string;
  mediaUrl?: string;
  shouldSkipAI: boolean;
  commentInsights?: CommentInsights;
}

// Define the structure for the processed content cache
interface ProcessedContentCache {
  items: ProcessedContentItem[];
  feedMetadata: any;
  lastUpdated: number;
}

// Path to the processed content cache file
const PROCESSED_CONTENT_CACHE_PATH = path.join(process.cwd(), '.cache', 'step3-processed-content.json');

/**
 * Process all extracted content items (determine media types, etc.)
 * using the extracted content data from Step 2
 */
export async function processContent(): Promise<void> {
  console.log('Step 3: Processing content (media type detection, etc.)...');

  // Load the extracted content data from Step 2
  const extractedCache = await loadExtractedContentCache();

  if (extractedCache.lastUpdated === 0) {
    console.error('No extracted content data found. Please run Step 2 first.');
    return;
  }

  console.log(`Loaded extracted content from cache (last updated: ${new Date(extractedCache.lastUpdated).toLocaleString()})`);

  // Initialize the processed content cache
  const processedCache: ProcessedContentCache = {
    items: [],
    feedMetadata: extractedCache.feedMetadata,
    lastUpdated: Date.now()
  };

  // Create cache directory if it doesn't exist
  await fs.mkdir(path.dirname(PROCESSED_CONTENT_CACHE_PATH), { recursive: true });

  // Get all feed IDs from both the config and the cache
  const feedIds = new Set<number>();

  // Add feed IDs from the extracted items
  for (const item of extractedCache.items) {
    feedIds.add(item.feedId);
  }

  // Add feed IDs from the config
  for (const source of sources) {
    feedIds.add(source.id);
  }

  console.log(`Processing content for ${extractedCache.items.length} items from ${feedIds.size} feeds...`);

  // Process each item
  for (const item of extractedCache.items) {
    console.log(`Processing content for item: ${item.title} (Feed ID: ${item.feedId})`);

    try {
      // Determine media type and whether to skip AI processing
      let mediaType = item.mediaType || 'unknown';
      let mediaUrl = item.mediaUrl || item.url;
      let shouldSkipAI = false;

      // If mediaType is already set from content extraction, use it
      if (item.mediaType) {
        console.log(`Media type already detected: ${item.mediaType}`);
        shouldSkipAI = item.mediaType !== 'error';
      } else {
        // Determine media type based on URL and content
        const mediaInfo = determineMediaType(item.url, item.content || '');
        mediaType = mediaInfo.mediaType;
        shouldSkipAI = mediaInfo.shouldSkipAI;

        console.log(`Determined media type: ${mediaType}, Should skip AI: ${shouldSkipAI}`);
      }

      // Create the processed content item
      const processedItem: ProcessedContentItem = {
        ...item,
        mediaType,
        mediaUrl,
        shouldSkipAI
      };

      // Add to the processed items array
      processedCache.items.push(processedItem);
      console.log(`Added processed content item: ${processedItem.title}`);
    } catch (err: any) {
      console.error(`Failed to process content for item ${item.title}: ${err.message}`);

      // Add the item with default values
      processedCache.items.push({
        ...item,
        mediaType: 'error',
        mediaUrl: item.url,
        shouldSkipAI: true
      });
    }
  }

  // Save the processed content to cache
  await fs.writeFile(
    PROCESSED_CONTENT_CACHE_PATH,
    JSON.stringify(processedCache, (key, value) => {
      // Convert Date objects to ISO strings for JSON serialization
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2),
    'utf-8'
  );

  console.log(`Step 3 complete: All content processed and saved to ${PROCESSED_CONTENT_CACHE_PATH}`);
  console.log(`Total processed items: ${processedCache.items.length}`);
}

/**
 * Determine the media type and whether to skip AI processing based on URL and content
 */
function determineMediaType(url: string, content: string): { mediaType: string; shouldSkipAI: boolean } {
  try {
    // Parse the URL
    const parsedUrl = new URL(url);

    // Check domain
    const domain = parsedUrl.hostname.replace('www.', '');

    // Media hosting domains
    if (NON_TEXT_DOMAINS.some(nonTextDomain => domain.includes(nonTextDomain))) {
      // Determine media type based on domain
      let mediaType = 'media';

      if (domain.includes('youtube') || domain.includes('vimeo') || domain.includes('dailymotion') || domain.includes('twitch')) {
        mediaType = 'video';
      } else if (domain.includes('spotify') || domain.includes('soundcloud')) {
        mediaType = 'audio';
      } else if (domain.includes('flickr') || domain.includes('imgur') || domain.includes('instagram') || domain.includes('pinterest')) {
        mediaType = 'image';
      } else if (domain.includes('drive.google') || domain.includes('docs.google') || domain.includes('dropbox')) {
        mediaType = 'document';
      }

      return {
        mediaType,
        shouldSkipAI: true
      };
    }

    // Check file extension
    const extension = path.extname(parsedUrl.pathname).toLowerCase();
    if (extension && NON_TEXT_EXTENSIONS.includes(extension)) {
      // Determine media type based on extension
      let mediaType = 'media';

      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(extension)) {
        mediaType = 'image';
      } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(extension)) {
        mediaType = 'video';
      } else if (['.mp3', '.wav', '.ogg'].includes(extension)) {
        mediaType = 'audio';
      } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(extension)) {
        mediaType = 'document';
      } else if (['.zip', '.rar', '.tar', '.gz', '.7z'].includes(extension)) {
        mediaType = 'archive';
      }

      return {
        mediaType,
        shouldSkipAI: true
      };
    }

    // Check for query parameters that might indicate media content
    if (parsedUrl.searchParams.has('v') && domain === 'youtube.com') {
      return {
        mediaType: 'video',
        shouldSkipAI: true
      };
    }

    // Check content length and characteristics
    if (content.length < 200) {
      return {
        mediaType: 'short-text',
        shouldSkipAI: false // Still try AI processing for short text
      };
    }

    // Default to text content
    return {
      mediaType: 'text',
      shouldSkipAI: false
    };
  } catch (error) {
    console.error(`Error determining media type for URL ${url}:`, error);
    return {
      mediaType: 'unknown',
      shouldSkipAI: false
    };
  }
}

/**
 * Load the processed content from cache
 */
export async function loadProcessedContentCache(): Promise<ProcessedContentCache> {
  try {
    const cacheData = await fs.readFile(PROCESSED_CONTENT_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(cacheData) as ProcessedContentCache;

    // Convert ISO date strings back to Date objects
    parsed.items = parsed.items.map(item => ({
      ...item,
      published: new Date(item.published)
    }));

    return parsed;
  } catch (error) {
    console.error('Failed to load processed content cache:', error);
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
    await processContent();
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete content processing:', err);
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
