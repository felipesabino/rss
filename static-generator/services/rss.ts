import { contentExtractor } from './content';
import { summarizeText, analyzeSentiment } from './openai';
import { sources } from '../../config/sources';
import { loadCache, saveCache, cleanCache, Cache, saveRenderCache, loadRenderCache, CacheItem } from './cache';
import { parseFeedWithMetadata, FeedMetadata } from './feed-parser';
import { parseDate } from './date-parser';
import { searchGoogleForQuery } from './google-search';

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
  mediaUrl?: string;     // Field for media URL (for embedded content)
}

// Storage for items and metadata
let items: Item[] = [];
let itemIdCounter = 1;
let feedMetadata: Record<number, FeedMetadata> = {};

// Cache instance
let cache: Cache;

// In-memory cache for items during processing
let itemsCache: Record<string, CacheItem> = {};

/**
 * Get an item from the in-memory cache
 */
function getCachedItem(cache: Cache, url: string): CacheItem | null {
  const item = itemsCache[url];

  // Return null if the item doesn't exist or is expired
  if (!item || Date.now() - item.timestamp > 24 * 60 * 60 * 1000) {
    return null;
  }

  return item;
}

/**
 * Add or update an item in the in-memory cache
 */
function setCachedItem(cache: Cache, url: string, content: string, summary?: string, isPositive?: boolean, mediaType?: string, mediaUrl?: string): void {
  itemsCache[url] = {
    url,
    content,
    summary,
    isPositive,
    mediaType,
    mediaUrl: mediaUrl || url,
    timestamp: Date.now()
  };
}

// Date parsing is now handled by the date-parser module

export async function fetchSource(sourceConfig: typeof sources[0]): Promise<void> {
  console.log(`Fetching source: ${sourceConfig.name}`);

  const pageSize = process.env.MAX_ITEMS_PER_FEED ? +process.env.MAX_ITEMS_PER_FEED : 10;

  // Ensure cache is loaded
  if (!cache) {
    cache = await loadCache();
    console.log('Cache loaded');
  }

  try {
    let feedItems: any[] = [];
    let metadata: FeedMetadata;

    if (sourceConfig.type === 'google-search') {
      if (!sourceConfig.query) {
        console.error(`Source ${sourceConfig.name} is missing query`);
        return;
      }

      const searchItems = await searchGoogleForQuery(sourceConfig.query, sourceConfig.num, sourceConfig.dateRestrict);

      // Map Google Search items to FeedItem structure
      feedItems = searchItems.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.snippet,
        contentSnippet: item.snippet
      }));

      metadata = {
        title: sourceConfig.name,
        description: `Google Search results for: ${sourceConfig.query}`,
        siteUrl: `https://www.google.com/search?q=${encodeURIComponent(sourceConfig.query)}`,
        language: 'en', // Default
        lastBuildDate: new Date().toISOString()
      };
    } else {
      // RSS Feed
      if (!sourceConfig.url) {
        console.error(`Source ${sourceConfig.name} is missing URL`);
        return;
      }

      // Use the parseFeedWithMetadata function to get both items and metadata
      const result = await parseFeedWithMetadata(sourceConfig.url, sourceConfig.name);
      feedItems = result.items;
      metadata = result.metadata;
    }

    // Store the metadata for this feed
    feedMetadata[sourceConfig.id] = metadata;

    console.log(`Source size: ${feedItems.length}`);

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
        if (sourceConfig.url && sourceConfig.url.includes('reddit.com')) {
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

              // Get the media type and URL
              const mediaType = contentResult.mediaType || 'unknown';
              const mediaUrl = contentResult.mediaUrl || url;
              console.log(`Media type detected: ${mediaType}, Media URL: ${mediaUrl}`);

              // Cache the result with skip reason, default sentiment, media type, and media URL
              setCachedItem(cache, url, `[SKIPPED: ${contentResult.skipReason}]`, undefined, isPositive, mediaType, mediaUrl);
            } else {
              // Only summarize if content is substantial
              const shouldSummarize = content.length > 500;

              if (shouldSummarize) {
                try {
                  summary = await summarizeText(content);
                  hasSummary = true;

                  // Analyze sentiment using the summary to save tokens
                  try {
                    console.log(`Starting sentiment analysis using summary for item: "${item.title!.substring(0, 50)}..."`);
                    isPositive = await analyzeSentiment(summary);
                    console.log(`Sentiment analysis completed for "${item.title!}": ${isPositive ? 'Positive ✅' : 'Negative/Neutral ❌'}`);

                    // Cache the content, summary, and sentiment
                    setCachedItem(cache, url, content, summary, isPositive, undefined, url);
                  } catch (err: any) {
                    console.error(`Failed to analyze sentiment: ${err.message}`);

                    // Cache without sentiment (will be treated as neutral)
                    isPositive = false;
                    setCachedItem(cache, url, content, summary, isPositive, undefined, url);
                  }
                } catch (err: any) {
                  console.error(`Failed to summarize item: ${err.message}`);

                  // If summarization fails, consider it neutral
                  isPositive = false;
                  setCachedItem(cache, url, content, undefined, isPositive, undefined, url);
                }
              } else {
                // For short content, we don't have a summary, so we consider it neutral
                isPositive = false;
                setCachedItem(cache, url, content, undefined, isPositive, undefined, url);
              }
            }
          } catch (err: any) {
            console.error(`Failed to extract content: ${err.message}`);

            // For content extraction failures, default to not positive
            console.log(`Content extraction failed. Skipping sentiment analysis and defaulting to not positive.`);
            isPositive = false;

            // Cache the error result with default sentiment, unknown media type, and original URL
            setCachedItem(cache, url, `[ERROR: Content extraction failed]`, undefined, isPositive, 'error', url);

            continue;
          }
        }

        // Get the media type and URL from cache if available
        let mediaType = undefined;
        let mediaUrl = undefined;
        if (itemsCache[url]) {
          mediaType = itemsCache[url].mediaType;
          mediaUrl = itemsCache[url].mediaUrl;
        }

        const newItem: Item = {
          id: itemIdCounter++,
          feedId: sourceConfig.id,
          title: item.title!,
          url: item.link!,
          content,
          summary,
          published: item.pubDate ? parseDate(item.pubDate) : new Date(),
          hasSummary,
          commentsUrl: item.comments,  // Extract comments URL from feed item
          isPositive: isPositive,      // Add sentiment analysis result
          mediaType: mediaType,        // Add media type
          mediaUrl: mediaUrl           // Add media URL
        };

        items.push(newItem);
        console.log(`Added item: ${newItem.title}`);
      } catch (err: any) {
        console.error(`Failed to process item ${item.title}: ${err.message}`);
        continue;
      }
    }

    console.log(`Completed fetching source: ${sourceConfig.name}`);
  } catch (err: any) {
    console.error(`Failed to update source ${sourceConfig.name}: ${err.message}`);
  }
}

export async function updateAllSources(): Promise<void> {
  console.log('Updating all sources...');

  // Load the cache
  cache = await loadCache();

  // Clean expired items from the cache
  cache = cleanCache(cache);

  // Clear the items array to start fresh
  items = [];
  feedMetadata = {};

  // Fetch all sources
  for (const source of sources) {
    await fetchSource(source);
  }

  // Save the updated cache
  await saveCache(cache);

  // Save all items and feed metadata for static generation
  await saveRenderCache(items, feedMetadata);

  console.log(`Total items after update: ${items.length}`);

  console.log('Update complete!');
}

/**
 * Load all items and feed metadata for static generation (from cache)
 */
export async function loadAllForRender(): Promise<{ items: Item[], feedMetadata: Record<number, FeedMetadata> }> {
  const { allItems, feedMetadata } = await loadRenderCache();
  return { items: allItems, feedMetadata };
}

export function getItemsBySource(): Record<number, Item[]> {
  const itemsBySource: Record<number, Item[]> = {};
  for (const source of sources) {
    itemsBySource[source.id] = items
      .filter(item => item.feedId === source.id)
      .sort((i, j) => {
        // Sort in descending order (newest first)
        if (!i.published && !j.published) return 0;
        if (!i.published) return 1; // Items with no date go to the end
        if (!j.published) return -1;

        // Use getTime for consistent comparison
        return j.published.getTime() - i.published.getTime();
      });
  }
  return itemsBySource;
}

export function getAllItems(): Item[] {
  return items;
}

export function getSourceMetadata(): Record<number, FeedMetadata> {
  return feedMetadata;
}
