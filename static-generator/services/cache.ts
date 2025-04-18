import fs from 'fs/promises';
import path from 'path';

// Define the cache structure
export interface CacheItem {
  url: string;
  content: string;
  summary?: string;
  timestamp: number;
}

export interface Cache {
  items: Record<string, CacheItem>;
  lastUpdated: number;
}

// Path to the cache file
const CACHE_FILE_PATH = path.join(process.cwd(), '.cache', 'rss-cache.json');

// Default cache structure
const DEFAULT_CACHE: Cache = {
  items: {},
  lastUpdated: Date.now()
};

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

/**
 * Load the cache from the file system
 */
export async function loadCache(): Promise<Cache> {
  try {
    // Create cache directory if it doesn't exist
    await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    
    // Try to read the cache file
    const cacheData = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(cacheData) as Cache;
  } catch (error) {
    // If the file doesn't exist or is invalid, return a default cache
    console.log('No existing cache found or cache is invalid. Creating a new one.');
    return DEFAULT_CACHE;
  }
}

/**
 * Save the cache to the file system
 */
export async function saveCache(cache: Cache): Promise<void> {
  try {
    // Create cache directory if it doesn't exist
    await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    
    // Update the lastUpdated timestamp
    cache.lastUpdated = Date.now();
    
    // Write the cache to the file
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('Cache saved successfully');
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
}

/**
 * Get an item from the cache
 */
export function getCachedItem(cache: Cache, url: string): CacheItem | null {
  const item = cache.items[url];
  
  // Return null if the item doesn't exist or is expired
  if (!item || Date.now() - item.timestamp > CACHE_EXPIRATION) {
    return null;
  }
  
  return item;
}

/**
 * Add or update an item in the cache
 */
export function setCachedItem(cache: Cache, url: string, content: string, summary?: string): void {
  cache.items[url] = {
    url,
    content,
    summary,
    timestamp: Date.now()
  };
}

/**
 * Clean expired items from the cache
 */
export function cleanCache(cache: Cache): Cache {
  const now = Date.now();
  const cleanedCache: Cache = {
    items: {},
    lastUpdated: now
  };
  
  // Keep only non-expired items
  Object.values(cache.items).forEach(item => {
    if (now - item.timestamp <= CACHE_EXPIRATION) {
      cleanedCache.items[item.url] = item;
    }
  });
  
  console.log(`Cleaned cache: removed ${Object.keys(cache.items).length - Object.keys(cleanedCache.items).length} expired items`);
  return cleanedCache;
}
