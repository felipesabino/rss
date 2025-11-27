import { parseFeedWithMetadata, FeedItem } from '../services/feed-parser';
import { searchGoogleForQuery } from '../services/google-search';
import { parseDate } from '../services/date-parser';
import { FilePipelineStore, PipelineStore, RawFeedCache } from '../services/pipeline-store';
import { getSourcesForUser } from '../services/source-config';

/**
 * Fetch all sources (RSS feeds and Google Search) and save the raw data to a cache file
 */
export async function fetchAllSources(
  store: PipelineStore = new FilePipelineStore(),
  userId: string = 'default'
): Promise<void> {
  console.log('Step 1: Fetching all sources...');

  const sources = await getSourcesForUser(userId);
  if (sources.length === 0) {
    console.error(`No sources configured for user "${userId}". Seed SourceConfig first.`);
    return;
  }

  // Initialize cache structure
  const cache: RawFeedCache = {
    items: {},
    feedMetadata: {},
    lastUpdated: Date.now()
  };

  // Process each source
  let feedIdCounter = 1;
  for (const source of sources) {
    console.log(`Fetching source: ${source.name} (${source.type})`);

    try {
      let feedItems: FeedItem[] = [];
      let metadata: any;

      if (source.type === 'google') {
        if (!source.query) {
          console.error(`Source ${source.name} is missing query`);
          continue;
        }

        const searchItems = await searchGoogleForQuery(source.query, source.num, source.dateRestrict);

        // Map Google Search items to FeedItem structure
        feedItems = searchItems.map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate || new Date().toISOString(),
          content: item.snippet
        }));

        metadata = {
          title: source.name,
          description: `Google Search results for: ${source.query}`,
          siteUrl: `https://www.google.com/search?q=${encodeURIComponent(source.query)}`,
          language: source.language || 'en', // Default
          lastBuildDate: new Date().toISOString(),
          sourceConfigId: source.id,
          categories: source.categories
        };
      } else {
        // RSS Feed
        if (!source.url) {
          console.error(`Source ${source.name} is missing URL`);
          continue;
        }

        // Use the parseFeedWithMetadata function to get both items and metadata
        const result = await parseFeedWithMetadata(source.url, source.name);
        feedItems = result.items;
        metadata = {
          ...result.metadata,
          sourceConfigId: source.id,
          categories: source.categories
        };
      }

      // Store the metadata for this feed
      const feedId = feedIdCounter++;
      cache.feedMetadata[feedId] = metadata;

      console.log(`Source size: ${feedItems.length}`);

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
      cache.items[feedId] = filteredItems.map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        comments: item.comments
      }));
    } catch (err: any) {
      console.error(`Failed to fetch source ${source.name}: ${err.message}`);
      // Initialize with empty array if fetch fails
      cache.items[source.id] = [];
    }
  }

  // Save the raw feed data to cache
  await store.saveRawFeedCache(cache);

  console.log('Step 1 complete: All sources fetched and cached');
}

/**
 * Load the raw feed data from cache
 */
export async function loadRawFeedCache(): Promise<RawFeedCache> {
  const store = new FilePipelineStore();
  return store.loadRawFeedCache();
}

// Main function to run this step independently
async function main() {
  try {
    await fetchAllSources();
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete source fetching:', err);
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
