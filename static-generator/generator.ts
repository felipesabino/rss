import fs from 'fs/promises';
import path from 'path';
import { feeds, getAllCategories } from '../config/feeds';
import ejs from 'ejs';
import { updateAllFeeds, getItemsByFeed } from './services/rss';

import dotenv from 'dotenv';
dotenv.config();

async function generateStaticSite(): Promise<void> {
  console.log('Generating static site...');

  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), 'dist');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Get items by feed
  const itemsByFeed = getItemsByFeed();
  
  // Load and render the template
  const templatePath = path.join(process.cwd(), 'static-generator/templates/index.ejs');
  const template = await fs.readFile(templatePath, 'utf-8');
  
  // Get all categories
  const categories = getAllCategories();
  
  const html = ejs.render(template, {
    feeds,
    itemsByFeed,
    categories,
    formatDate: (date: Date) => {
      return date.toLocaleDateString(['fr-FR'], {hour: '2-digit', minute:'2-digit'});
    }
  });
  
  // Write the output HTML file
  await fs.writeFile(path.join(outputDir, 'index.html'), html);
  
  // Copy CSS file
  const cssContent = await fs.readFile(path.join(process.cwd(), 'static-generator/templates/styles.css'), 'utf-8');
  await fs.writeFile(path.join(outputDir, 'styles.css'), cssContent);
  
  console.log('Static site generated successfully');
}

async function main() {
  try {    
    // Update feeds
    await updateAllFeeds();
    
    // Generate static site
    await generateStaticSite();
    
    console.log('Process completed successfully');
    // Explicitly exit the process to prevent hanging
    process.exit(0);
  } catch (err) {
    console.error('Failed to generate static site:', err);
    process.exit(1);
  }
}

// Execute the main function
main();
