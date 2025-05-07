import { feeds } from '../../config/feeds';
import { parseFeedWithMetadata, FeedMetadata, FeedItem } from '../services/feed-parser';
import fs from 'fs/promises';
import path from 'path';
import { parseDate } from '../services/date-parser';

// Define the structure for the raw feed data cache
interface RawFeedCache {
  items: Record<number, FeedItem[]>;
  feedMetadata: Record<number, FeedMetadata>;
  lastUpdated: number;
}

// Path to the raw feed cache file
const RAW_FEED_CACHE_PATH = path.join(process.cwd(), '.cache', 'step1-raw-feeds.json');

/**
 * Fetch all RSS feeds and save the raw data to a cache file
 */
export async function fetchAllFeeds(): Promise<void> {
  console.log('Step 1: Fetching all RSS feeds...');

  // Initialize cache structure
  const cache: RawFeedCache = {
    items: {},
    feedMetadata: {},
    lastUpdated: Date.now()
  };

  // Create cache directory if it doesn't exist
  await fs.mkdir(path.dirname(RAW_FEED_CACHE_PATH), { recursive: true });

  // Process each feed
  for (const feed of feeds) {
    console.log(`Fetching feed: ${feed.name}`);
    
    try {
      // Use the parseFeedWithMetadata function to get both items and metadata
      const { items: feedItems, metadata } = await parseFeedWithMetadata(feed.url, feed.name);
      
      // Store the metadata for this feed
      cache.feedMetadata[feed.id] = metadata;
      
      console.log(`Feed size: ${feedItems.length}`);

      // Filter items by date (last 24 hours) and sort by published date
      const pageSize = process.env.MAX_ITEMS_PER_FEED ? +process.env.MAX_ITEMS_PER_FEED : 10;
      const filteredItems = feedItems
        .filter((item: any) => {
          if (!item.pubDate) return true; // Keep items with no date
          
          const itemDate = parseDate(item.pubDate);
          const now = new Date();
          const timeDiff = now.getTime() - itemDate.getTime();
          return timeDiff <= 24 * 60 * 60 * 1000;
        })
        .sort((i: any, j: any) => {
          if (!i.pubDate && !j.pubDate) return 0;
          if (!i.pubDate) return 1; // Items with no date go to the end
          if (!j.pubDate) return -1;
          
          const dateI = parseDate(i.pubDate);
          const dateJ = parseDate(j.pubDate);
          return dateI > dateJ ? -1 : 1; // Descending order (newest first)
        })
        .slice(0, pageSize);

      console.log(`Filtered to ${filteredItems.length} items`);
      
      // Store the filtered items for this feed
      cache.items[feed.id] = filteredItems.map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        comments: item.comments
      }));
    } catch (err: any) {
      console.error(`Failed to fetch feed ${feed.name}: ${err.message}`);
      // Initialize with empty array if fetch fails
      cache.items[feed.id] = [];
    }
  }

  // Save the raw feed data to cache
  await fs.writeFile(RAW_FEED_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  
  console.log(`Step 1 complete: All feeds fetched and saved to ${RAW_FEED_CACHE_PATH}`);
}

/**
 * Load the raw feed data from cache
 */
export async function loadRawFeedCache(): Promise<RawFeedCache> {
  try {
    const cacheData = await fs.readFile(RAW_FEED_CACHE_PATH, 'utf-8');
    return JSON.parse(cacheData) as RawFeedCache;
  } catch (error) {
    console.error('Failed to load raw feed cache:', error);
    return {
      items: {},
      feedMetadata: {},
      lastUpdated: 0
    };
  }
}

// Main function to run this step independently
async function main() {
  try {
    await fetchAllFeeds();
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete feed fetching:', err);
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
