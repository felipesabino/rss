import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { feeds, getAllCategories } from '../../config/feeds';
import { loadAIProcessedContentCache, AIProcessedItem } from './4-process-with-openai';

// Path to the output directory
const OUTPUT_DIR = path.join(process.cwd(), 'dist');

/**
 * Generate static HTML site using the AI processed content from Step 4
 */
export async function generateStaticSite(): Promise<void> {
  console.log('Step 5: Generating static HTML site...');

  // Load the AI processed content from Step 4
  const aiProcessedCache = await loadAIProcessedContentCache();
  
  if (aiProcessedCache.lastUpdated === 0) {
    console.error('No AI processed content found. Please run Step 4 first.');
    return;
  }

  console.log(`Loaded AI processed content from cache (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`);
  console.log(`Total items: ${aiProcessedCache.items.length}`);

  // Create output directory if it doesn't exist
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Get all feed IDs from both the config and the cache
  const feedIds = new Set<number>();
  
  // Add feed IDs from the AI processed items
  for (const item of aiProcessedCache.items) {
    feedIds.add(item.feedId);
  }
  
  // Add feed IDs from the config
  for (const feed of feeds) {
    feedIds.add(feed.id);
  }
  
  console.log(`Generating HTML for ${aiProcessedCache.items.length} items from ${feedIds.size} feeds...`);
  
  // Group items by feed
  const itemsByFeed: Record<number, AIProcessedItem[]> = {};
  for (const feed of feeds) {
    itemsByFeed[feed.id] = aiProcessedCache.items
      .filter(item => item.feedId === feed.id)
      .sort((i, j) => {
        if (!i.published && !j.published) return 0;
        if (!i.published) return 1;
        if (!j.published) return -1;
        return j.published.getTime() - i.published.getTime();
      });
  }

  // Load and render the template
  const templatePath = path.join(process.cwd(), 'static-generator/templates/index.ejs');
  const template = await fs.readFile(templatePath, 'utf-8');

  // Get all categories
  const categories = getAllCategories();

  const html = ejs.render(template, {
    feeds,
    itemsByFeed,
    feedMetadata: aiProcessedCache.feedMetadata,
    categories,
    formatDate: (date: Date) => {
      return date.toLocaleDateString(['fr-FR'], { hour: '2-digit', minute: '2-digit' });
    }
  });

  // Write the output HTML file
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html);

  // Copy CSS file
  const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'styles.css'), cssContent);

  console.log(`Step 5 complete: Static site generated successfully in ${OUTPUT_DIR}`);
}

// Main function to run this step independently
async function main() {
  try {
    await generateStaticSite();
    process.exit(0);
  } catch (err) {
    console.error('Failed to generate static site:', err);
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
