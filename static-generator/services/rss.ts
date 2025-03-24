import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';
import { contentExtractor } from './content';
import { summarizeText } from './openai';
import { feeds } from '../../config/feeds';

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

// Create a parser instance
const parser = new Parser();

// Storage for items
let items: Item[] = [];
let itemIdCounter = 1;

export async function fetchFeed(feedConfig: typeof feeds[0]): Promise<void> {
  console.log(`Fetching feed: ${feedConfig.name}`);

  const pageSize = process.env.MAX_ITEMS_PER_FEED ? +process.env.MAX_ITEMS_PER_FEED : 10;
  
  try {
    const parsedFeed = await parser.parseURL(feedConfig.url);
    const feedItems = parsedFeed.items.slice(0, pageSize);

    for (const item of feedItems) {
      // Skip if we already have this item in the current fetch (based on URL)
      if (items.some(i => i.url === item.link)) continue;

      // Skip if item is more than 24h old
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      if (new Date().getTime() - pubDate.getTime() > 24 * 60 * 60 * 1000) continue;

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
        
        let content = '';
        try {
          content = await contentExtractor(url);
        } catch (err: any) {
          console.error(`Failed to extract content: ${err.message}`);
          continue;
        }
        
        // Only summarize if content is substantial
        const shouldSummarize = content.length > 500;
        
        const newItem: Item = {
          id: itemIdCounter++,
          feedId: feedConfig.id,
          title: item.title!,
          url: item.link!,
          content,
          published: item.pubDate ? new Date(item.pubDate) : new Date(),
          hasSummary: false,
          commentsUrl: item.comments  // Extract comments URL from feed item
        };

        if (shouldSummarize) {
          try {
            const summary = await summarizeText(content);
            newItem.summary = summary;
            newItem.hasSummary = true;
          } catch (err: any) {
            console.error(`Failed to summarize item: ${err.message}`);
          }
        }

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
  
  // Clear the items array to start fresh
  items = [];
  
  // Fetch all feeds
  for (const feed of feeds) {
    await fetchFeed(feed);
  }
  
  console.log(`Total items after update: ${items.length}`);
  
  console.log('Update complete!');
}

export function getItemsByFeed(): Record<number, Item[]> {
  const itemsByFeed: Record<number, Item[]> = {};
  for (const feed of feeds) {
    itemsByFeed[feed.id] = items.filter(item => item.feedId === feed.id).sort((i,j) => i.published < j.published ? 1 : 0);
  }
  return itemsByFeed;
}

export function getAllItems(): Item[] {
  return items;
}