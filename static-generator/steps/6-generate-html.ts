import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { sources, getAllCategories } from '../../config/sources';
import { loadAIProcessedContentCache, AIProcessedItem } from './4-process-with-openai';
import { loadReportsCache } from './5-generate-reports';

import { marked } from 'marked';

// Path to the output directory
const OUTPUT_DIR = path.join(process.cwd(), 'dist');

/**
 * Generate static HTML site using the AI processed content from Step 4
 */
export async function generateStaticSite(): Promise<void> {
  console.log('Step 6: Generating static HTML site...');

  // Load the AI processed content from Step 4
  const aiProcessedCache = await loadAIProcessedContentCache();

  if (aiProcessedCache.lastUpdated === 0) {
    console.error('No AI processed content found. Please run Step 4 first.');
    return;
  }

  // Load the reports from Step 5
  const reportsCache = await loadReportsCache();

  console.log(`Loaded AI processed content from cache (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`);
  console.log(`Loaded ${reportsCache.reports.length} category reports from cache`);
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
  for (const source of sources) {
    feedIds.add(source.id);
  }

  console.log(`Generating HTML for ${aiProcessedCache.items.length} items from ${feedIds.size} feeds...`);

  // Group items by feed
  const itemsByFeed: Record<number, AIProcessedItem[]> = {};
  for (const source of sources) {
    itemsByFeed[source.id] = aiProcessedCache.items
      .filter(item => item.feedId === source.id)
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

  // Process reports to include HTML content
  const processedReports = await Promise.all(reportsCache.reports.map(async report => {
    return {
      ...report,
      htmlContent: await marked.parse(report.report)
    };
  }));

  const html = ejs.render(template, {
    feeds: sources, // Pass sources as feeds to the template for backward compatibility
    itemsByFeed,
    feedMetadata: aiProcessedCache.feedMetadata,
    categories,
    reports: processedReports,
    formatDate: (date: Date) => {
      return date.toLocaleDateString(['fr-FR'], { hour: '2-digit', minute: '2-digit' });
    }
  });

  // Write the output HTML file
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html);

  // Copy CSS file
  const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'styles.css'), cssContent);

  console.log(`Step 6 complete: Static site generated successfully in ${OUTPUT_DIR}`);
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
