import fs from 'fs/promises';
import path from 'path';
import { feeds, getAllCategories } from '../config/feeds';
import ejs from 'ejs';
import { updateAllFeeds, getItemsByFeed, getFeedMetadata, loadAllForRender } from './services/rss';

import dotenv from 'dotenv';
dotenv.config();

async function generateStaticSiteFromCache(): Promise<void> {
  console.log('Generating static site from cache...');

  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), 'dist');
  await fs.mkdir(outputDir, { recursive: true });

  // Load all items and feed metadata from cache
  const { items, feedMetadata } = await loadAllForRender();

  // Group items by feed
  const itemsByFeed: Record<number, typeof items> = {};
  for (const feed of feeds) {
    itemsByFeed[feed.id] = items
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
    feedMetadata,
    categories,
    formatDate: (date: Date) => {
      return date.toLocaleDateString(['fr-FR'], { hour: '2-digit', minute: '2-digit' });
    }
  });

  // Write the output HTML file
  await fs.writeFile(path.join(outputDir, 'index.html'), html);

  // Copy CSS file
  const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
  await fs.writeFile(path.join(outputDir, 'styles.css'), cssContent);

  console.log('Static site generated successfully from cache');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const shouldUpdateFeeds = args.includes('--update-feeds');
    const shouldGenerateStatic = args.includes('--generate-static');

    if (!shouldUpdateFeeds && !shouldGenerateStatic) {
      console.log('No action specified. Use --update-feeds and/or --generate-static');
      process.exit(0);
    }

    if (shouldUpdateFeeds) {
      console.log('Updating feeds...');
      await updateAllFeeds();
    }

    if (shouldGenerateStatic) {
      console.log('Generating static site...');
      await generateStaticSiteFromCache();
    }

    console.log('Process completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed to complete process:', err);
    process.exit(1);
  }
}

// Execute the main function
main();
