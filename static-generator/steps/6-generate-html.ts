import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { AIProcessedItem, DbPipelineStore, PipelineStore } from '../services/pipeline-store';
import { getReportsWithItemsForUser } from '../services/db-reports';
import { listSavedItems } from '../services/saved-items';
import { getUserById } from '../services/users';
import { fileURLToPath } from 'url';



// Path to the output directory
const OUTPUT_DIR = path.join(process.cwd(), 'dist');

/**
 * Generate static HTML site using the AI processed content from Step 4
 */
export async function generateStaticSite(store?: PipelineStore, userId: string = 'default'): Promise<void> {
  console.log('Step 6: Generating static HTML site...');

  const needsCleanup = !store;
  const activeStore = store ?? new DbPipelineStore({ userId });
  const resolvedUserId = activeStore.getUserId?.() ?? userId;

  if (!(activeStore instanceof DbPipelineStore)) {
    throw new Error('Step 6 requires a DbPipelineStore so data is fetched from the database. Re-run with PIPELINE_STORE=db.');
  }

  try {
    const formatDate = (date: Date) => date.toLocaleDateString(['fr-FR'], { hour: '2-digit', minute: '2-digit' });
    const slug = await resolveSlug(resolvedUserId);
    const pipelineRunId = await activeStore.getPipelineRunId?.();

    // Load the AI processed content from Step 4 (now sourced from DB)
    const aiProcessedCache = await activeStore.loadAIProcessedContentCache();
    if (aiProcessedCache.lastUpdated === 0 || aiProcessedCache.items.length === 0) {
      throw new Error(`No AI processed content found in the database for user "${resolvedUserId}". Run Steps 1-5 first.`);
    }

    // Load the reports from Step 5 (from DB)
    const reportsCache = await activeStore.loadReportsCache();
    if (!reportsCache.reports.length) {
      throw new Error(`No reports found in the database for user "${resolvedUserId}". Run Step 5 before Step 6.`);
    }

    console.log(
      `Loaded AI processed content (last updated: ${new Date(aiProcessedCache.lastUpdated).toLocaleString()})`
    );
    console.log(`Loaded ${reportsCache.reports.length} category reports from DB`);
    console.log(`Total items: ${aiProcessedCache.items.length}`);

    // Create output directory if it doesn't exist
    const userOutputDir = path.join(OUTPUT_DIR, slug);
    await fs.mkdir(userOutputDir, { recursive: true });

    const historicalReports = await getReportsWithItemsForUser(resolvedUserId);
    const savedItems = await listSavedItems(resolvedUserId);
    console.log(`Loaded ${savedItems.length} saved item(s) for user ${resolvedUserId}`);
    const previousReports = historicalReports.map((report, idx) => ({
      id: report.id,
      category: report.category,
      generatedAt: report.generatedAt,
      path: `reports/${report.id}.html`,
      isLatest: pipelineRunId ? report.pipelineRunId === pipelineRunId : idx === 0
    }));

    if (historicalReports.length) {
      const reportsDir = path.join(userOutputDir, 'reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const reportTemplatePath = path.join(process.cwd(), 'static-generator/templates/report.ejs');
      const reportTemplate = await fs.readFile(reportTemplatePath, 'utf-8');

      for (const report of historicalReports) {
        const reportHtml = ejs.render(reportTemplate, {
          report,
          slug,
          formatDate
        });
        await fs.writeFile(path.join(reportsDir, `${report.id}.html`), reportHtml);
      }
      console.log(`Generated ${historicalReports.length} historical report page(s) for user ${resolvedUserId}`);
    }

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

    const processedReports = reportsCache.reports;
    const reportUsageMap: Record<number, string[]> = {};
    for (const report of processedReports) {
      const usedIds = report.usedItemIds || [];
      for (const itemId of usedIds) {
        if (!reportUsageMap[itemId]) {
          reportUsageMap[itemId] = [];
        }
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
      previousReports,
      savedItems,
      formatDate
    });

    await fs.writeFile(path.join(userOutputDir, 'index.html'), html);

    // Copy CSS file
    const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
    await fs.writeFile(path.join(userOutputDir, 'styles.css'), cssContent);

    console.log(`Step 6 complete: Static site generated successfully in ${userOutputDir}`);
  } finally {
    if (needsCleanup && activeStore instanceof DbPipelineStore) {
      await activeStore.close();
    }
  }
}

async function resolveSlug(userId: string): Promise<string> {
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
    const args = process.argv.slice(2);
    const getArgValue = (flag: string): string | undefined => {
      const idx = args.indexOf(flag);
      if (idx !== -1 && args[idx + 1]) return args[idx + 1];
      return undefined;
    };

    const cliUserId = getArgValue('--user-id');
    const userId = cliUserId || process.env.DEFAULT_USER_ID || 'default';

    await generateStaticSite(undefined, userId);
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
