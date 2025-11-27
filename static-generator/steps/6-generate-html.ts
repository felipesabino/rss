import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { loadAIProcessedContentCache, AIProcessedItem } from './4-process-with-openai';
import { loadReportsCache } from './5-generate-reports';
import { DbPipelineStore, FilePipelineStore, PipelineStore } from '../services/pipeline-store';
import { getUserById } from '../services/users';



// Path to the output directory
const OUTPUT_DIR = path.join(process.cwd(), 'dist');

/**
 * Generate static HTML site using the AI processed content from Step 4
 */
export async function generateStaticSite(store?: PipelineStore, userId: string = 'default'): Promise<void> {
  console.log('Step 6: Generating static HTML site...');

  const activeStore = store ?? new DbPipelineStore({ userId });
  const slug = await resolveSlug(userId, activeStore);

  // Load the AI processed content from Step 4
  const aiProcessedCache = await activeStore.loadAIProcessedContentCache();

  if (aiProcessedCache.lastUpdated === 0) {
    console.error('No AI processed content found. Please run Step 4 first.');
    return;
  }

  // Load the reports from Step 5
  const reportsCache = await activeStore.loadReportsCache();

  console.log(`Loaded AI processed content from cache (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`);
  console.log(`Loaded ${reportsCache.reports.length} category reports from cache`);
  console.log(`Total items: ${aiProcessedCache.items.length}`);

  // Create output directory if it doesn't exist
  const userOutputDir = path.join(OUTPUT_DIR, slug);
  await fs.mkdir(userOutputDir, { recursive: true });

  const feedIds = Array.from(new Set(aiProcessedCache.items.map(item => item.feedId)));
  console.log(`Generating HTML for ${aiProcessedCache.items.length} items from ${feedIds.length} feeds...`);

  // Build feeds list from metadata (fallback to generic names)
  const feeds = feedIds.map(id => ({
    id,
    name: aiProcessedCache.feedMetadata[id]?.title || `Feed ${id}`,
    categories: aiProcessedCache.feedMetadata[id]?.categories || [],
    siteUrl: aiProcessedCache.feedMetadata[id]?.siteUrl || '',
    url: aiProcessedCache.feedMetadata[id]?.siteUrl || ''
  }));

  // Group items by feed
  const itemsByFeed: Record<number, AIProcessedItem[]> = {};
  for (const id of feedIds) {
    itemsByFeed[id] = aiProcessedCache.items
      .filter(item => item.feedId === id)
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

  // Categories from reports or metadata
  const categories = Array.from(
    new Set([
      ...reportsCache.reports.map(r => r.category),
      ...feedIds.flatMap(id => aiProcessedCache.feedMetadata[id]?.categories || [])
    ])
  ).sort();

  // Process reports (no longer need to parse markdown as we have structured data)
  // But we might want to format dates or other things if needed
  const processedReports = reportsCache.reports;

  const reportUsageMap: Record<number, string[]> = {};
  for (const report of processedReports) {
    const usedIds = report.usedItemIds || [];
    for (const itemId of usedIds) {
      if (!reportUsageMap[itemId]) {
        reportUsageMap[itemId] = [];
      }
      // Avoid duplicate category entries
      if (!reportUsageMap[itemId].includes(report.category)) {
        reportUsageMap[itemId].push(report.category);
      }
    }
  }

  const html = ejs.render(template, {
    feeds,
    itemsByFeed,
    feedMetadata: aiProcessedCache.feedMetadata,
    categories,
    reports: processedReports,
    reportUsageMap,
    formatDate: (date: Date) => {
      return date.toLocaleDateString(['fr-FR'], { hour: '2-digit', minute: '2-digit' });
    }
  });

  // Write the output HTML file
  await fs.writeFile(path.join(userOutputDir, 'index.html'), html);

  // Copy CSS file
  const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
  await fs.writeFile(path.join(userOutputDir, 'styles.css'), cssContent);

  console.log(`Step 6 complete: Static site generated successfully in ${userOutputDir}`);
}

async function resolveSlug(userId: string, store: PipelineStore): Promise<string> {
  if (store instanceof FilePipelineStore) {
    return userId;
  }
  try {
    const user = await getUserById(userId);
    return user?.slug || userId;
  } catch (err) {
    console.warn('Falling back to userId for slug due to lookup error:', err);
    return userId;
  }
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
