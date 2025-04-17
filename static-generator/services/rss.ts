import { contentExtractor } from './content';
import { summarizeText } from './openai';
import { feeds } from '../../config/feeds';
import { loadCache, saveCache, getCachedItem, setCachedItem, cleanCache, Cache } from './cache';
import { parseFeed } from './feed-parser';
import { parseDate } from './date-parser';

// Define item type
export interface Item {
  id: number;
  feedId: number;
  title: string;
  url: string;
  content?: string;
  summary?: string;
  published: Date;
  hasSummary: boolean;
  commentsUrl?: string;  // New field for Hacker News comments URL
}

// Storage for items
let items: Item[] = [];
let itemIdCounter = 1;

// Cache instance
let cache: Cache;

// Date parsing is now handled by the date-parser module

export async function fetchFeed(feedConfig: typeof feeds[0]): Promise<void> {
  console.log(`Fetching feed: ${feedConfig.name}`);

  const pageSize = process.env.MAX_ITEMS_PER_FEED ? +process.env.MAX_ITEMS_PER_FEED : 10;
  
  // Ensure cache is loaded
  if (!cache) {
    cache = await loadCache();
    console.log('Cache loaded');
  }
  
  try {
    // Use the robust parseFeed function from feed-parser.ts
    const feedItems = await parseFeed(feedConfig.url, feedConfig.name);

    console.log(`Feed size: ${feedItems.length}`);

    // Skip if item is more than 24h old and sort by published date
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

    console.log(`Page size: ${filteredItems.length}`);

    for (const item of filteredItems) {
      // Skip if we already have this item in the current fetch (based on URL)
      if (items.some(i => i.url === item.link)) continue;

      console.log(`Processing item: ${item.title}`);

      try {
        // Extract content from URL
        let url = '';
        if (feedConfig.url.includes('reddit.com')) {
          // Find non reddit.com urls on the HTML encoded content
          const urlRegex = /href=(?:"|")(?!https?:\/\/(?:www\.)?reddit\.com)([^"&]+)(?:"|")/;
          try {
            let match = urlRegex.exec(item.content!);
            url = match ? match[1] : item.link!;
          } catch (err: any) { 
            url = item.link!;
          }

          console.log(`Reddit URL replacement. Old: ${item.content?.substring(0, 30)}...; New: ${url}`);
        } else {
          url = item.link!;  // For other feeds, use the item link
        }
        
        // Check if the content is in the cache
        let content = '';
        let summary: string | undefined;
        let hasSummary = false;
        
        const cachedItem = getCachedItem(cache, url);
        
        if (cachedItem) {
          console.log(`Using cached content for: ${url}`);
          content = cachedItem.content;
          summary = cachedItem.summary;
          hasSummary = !!summary;
        } else {
          console.log(`Fetching content for: ${url}`);
          try {
            content = await contentExtractor(url);
            
            // Only summarize if content is substantial
            const shouldSummarize = content.length > 500;
            
            if (shouldSummarize) {
              try {
                summary = await summarizeText(content);
                hasSummary = true;
                
                // Cache the content and summary
                setCachedItem(cache, url, content, summary);
              } catch (err: any) {
                console.error(`Failed to summarize item: ${err.message}`);
                
                // Cache just the content
                setCachedItem(cache, url, content);
              }
            } else {
              // Cache just the content
              setCachedItem(cache, url, content);
            }
          } catch (err: any) {
            console.error(`Failed to extract content: ${err.message}`);
            continue;
          }
        }
        
        const newItem: Item = {
          id: itemIdCounter++,
          feedId: feedConfig.id,
          title: item.title!,
          url: item.link!,
          content,
          summary,
          published: item.pubDate ? parseDate(item.pubDate) : new Date(),
          hasSummary,
          commentsUrl: item.comments  // Extract comments URL from feed item
        };

        items.push(newItem);
        console.log(`Added item: ${newItem.title}`);
      } catch (err: any) {
        console.error(`Failed to process item ${item.title}: ${err.message}`);
        continue;
      }
    }

    console.log(`Completed fetching feed: ${feedConfig.name}`);
  } catch (err: any) {
    console.error(`Failed to update feed ${feedConfig.name}: ${err.message}`);
  }
}

export async function updateAllFeeds(): Promise<void> {
  console.log('Updating all feeds...');
  
  // Load the cache
  cache = await loadCache();
  
  // Clean expired items from the cache
  cache = cleanCache(cache);
  
  // Clear the items array to start fresh
  items = [];
  
  // Fetch all feeds
  for (const feed of feeds) {
    await fetchFeed(feed);
  }
  
  // Save the updated cache
  await saveCache(cache);
  
  console.log(`Total items after update: ${items.length}`);
  
  console.log('Update complete!');
}

export function getItemsByFeed(): Record<number, Item[]> {
  const itemsByFeed: Record<number, Item[]> = {};
  for (const feed of feeds) {
    itemsByFeed[feed.id] = items
      .filter(item => item.feedId === feed.id)
      .sort((i, j) => {
        // Sort in descending order (newest first)
        if (!i.published && !j.published) return 0;
        if (!i.published) return 1; // Items with no date go to the end
        if (!j.published) return -1;
        
        // Use getTime for consistent comparison
        return j.published.getTime() - i.published.getTime();
      });
  }
  return itemsByFeed;
}

export function getAllItems(): Item[] {
  return items;
}
