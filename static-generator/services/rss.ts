import { contentExtractor } from './content';
import { summarizeText, analyzeSentiment } from './openai';
import { feeds } from '../../config/feeds';
import { loadCache, saveCache, getCachedItem, setCachedItem, cleanCache, Cache } from './cache';
import { parseFeed, parseFeedWithMetadata, FeedMetadata } from './feed-parser';
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
  commentsUrl?: string;  // Field for Hacker News comments URL
  isPositive?: boolean;  // Field for sentiment analysis result
  mediaType?: string;    // Field for media type (image, video, audio, document, etc.)
}

// Storage for items and metadata
let items: Item[] = [];
let itemIdCounter = 1;
let feedMetadata: Record<number, FeedMetadata> = {};

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
    // Use the parseFeedWithMetadata function to get both items and metadata
    const { items: feedItems, metadata } = await parseFeedWithMetadata(feedConfig.url, feedConfig.name);
    
    // Store the metadata for this feed
    feedMetadata[feedConfig.id] = metadata;
    
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
        let isPositive: boolean | undefined;
        
        const cachedItem = getCachedItem(cache, url);
        
        if (cachedItem) {
          console.log(`Using cached content for: ${url}`);
          content = cachedItem.content;
          summary = cachedItem.summary;
          isPositive = cachedItem.isPositive;
          hasSummary = !!summary;
        } else {
          console.log(`Fetching content for: ${url}`);
          try {
            const contentResult = await contentExtractor(url);
            content = contentResult.content;
            
            // If content extraction was skipped, assume it's not positive and skip sentiment analysis
            if (contentResult.skipReason) {
              console.log(`Content extraction skipped: ${contentResult.skipReason}`);
              console.log(`Skipping sentiment analysis for non-text content. Defaulting to not positive.`);
              
              // Skip summarization for non-text content
              hasSummary = false;
              
              // Default to not positive for non-text content
              isPositive = false;
              
              // Get the media type
              const mediaType = contentResult.mediaType || 'unknown';
              console.log(`Media type detected: ${mediaType}`);
              
              // Cache the result with skip reason, default sentiment, and media type
              setCachedItem(cache, url, `[SKIPPED: ${contentResult.skipReason}]`, undefined, isPositive, mediaType);
            } else {
              // Only summarize if content is substantial
              const shouldSummarize = content.length > 500;
              
              if (shouldSummarize) {
                try {
                  summary = await summarizeText(content);
                  hasSummary = true;
                  
                  // Analyze sentiment
                  try {
                    // Use content for sentiment analysis, or fallback to title if content is minimal
                    const textForSentiment = content.length > 200 ? content : item.title!;
                    console.log(`Starting sentiment analysis for item: "${item.title!.substring(0, 50)}..."`);
                    isPositive = await analyzeSentiment(textForSentiment);
                    console.log(`Sentiment analysis completed for "${item.title!}": ${isPositive ? 'Positive ✅' : 'Negative/Neutral ❌'}`);
                    
                    // Cache the content, summary, and sentiment
                    setCachedItem(cache, url, content, summary, isPositive);
                  } catch (err: any) {
                    console.error(`Failed to analyze sentiment: ${err.message}`);
                    
                    // Cache without sentiment
                    setCachedItem(cache, url, content, summary);
                  }
                } catch (err: any) {
                  console.error(`Failed to summarize item: ${err.message}`);
                  
                  // Try to analyze sentiment even if summarization fails
                  try {
                    const textForSentiment = content.length > 200 ? content : item.title!;
                    isPositive = await analyzeSentiment(textForSentiment);
                    
                    // Cache the content and sentiment
                    setCachedItem(cache, url, content, undefined, isPositive);
                  } catch (sentErr: any) {
                    // Cache just the content if everything else fails
                    setCachedItem(cache, url, content);
                  }
                }
              } else {
                // For short content, still try to analyze sentiment
                try {
                  // For short content, prefer the title for sentiment analysis
                  const textForSentiment = item.title!;
                  isPositive = await analyzeSentiment(textForSentiment);
                  
                  // Cache the content and sentiment
                  setCachedItem(cache, url, content, undefined, isPositive);
                } catch (err: any) {
                  // Cache just the content
                  setCachedItem(cache, url, content);
                }
              }
            }
          } catch (err: any) {
            console.error(`Failed to extract content: ${err.message}`);
            
            // For content extraction failures, default to not positive
            console.log(`Content extraction failed. Skipping sentiment analysis and defaulting to not positive.`);
            isPositive = false;
            
            // Cache the error result with default sentiment and unknown media type
            setCachedItem(cache, url, `[ERROR: Content extraction failed]`, undefined, isPositive, 'error');
            
            continue;
          }
        }
        
        // Get the media type from cache if available
        let mediaType = undefined;
        if (cache.items[url] && cache.items[url].mediaType) {
          mediaType = cache.items[url].mediaType;
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
          commentsUrl: item.comments,  // Extract comments URL from feed item
          isPositive: isPositive,      // Add sentiment analysis result
          mediaType: mediaType         // Add media type
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

export function getFeedMetadata(): Record<number, FeedMetadata> {
  return feedMetadata;
}
