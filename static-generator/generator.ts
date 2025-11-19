import dotenv from 'dotenv';
import { fetchAllSources } from './steps/1-fetch-sources';
import { extractAllContent } from './steps/2-extract-content';
import { processContent } from './steps/3-process-content';
import { processWithOpenAI } from './steps/4-process-with-openai';
import { generateReports } from './steps/5-generate-reports';
import { generateStaticSite } from './steps/6-generate-html';

// Load environment variables
dotenv.config();

async function main() {
  try {
    const args = process.argv.slice(2);
    const shouldRunStep1 = args.includes('--step1') || args.includes('--all');
    const shouldRunStep2 = args.includes('--step2') || args.includes('--all');
    const shouldRunStep3 = args.includes('--step3') || args.includes('--all');
    const shouldRunStep4 = args.includes('--step4') || args.includes('--all');
    const shouldRunStep5 = args.includes('--step5') || args.includes('--all');
    const shouldRunStep6 = args.includes('--step6') || args.includes('--all');

    if (!shouldRunStep1 && !shouldRunStep2 && !shouldRunStep3 && !shouldRunStep4 && !shouldRunStep5 && !shouldRunStep6) {
      console.log(`
Usage: 
  tsx static-generator/generator.ts [options]

Options:
  --step1             Run Step 1: Fetch sources (RSS feeds and Google Search) and save raw data
  --step2             Run Step 2: Extract content from URLs
  --step3             Run Step 3: Process content (media type detection, etc.)
  --step4             Run Step 4: Process content with OpenAI (summarize, analyze)
  --step5             Run Step 5: Generate category reports (newsletter style)
  --step6             Run Step 6: Generate static HTML site
  --all               Run all steps in sequence
`);
      process.exit(0);
    }

    // Run the specified steps
    if (shouldRunStep1) {
      console.log('Running Step 1: Fetch sources');
      await fetchAllSources();
    }

    if (shouldRunStep2) {
      console.log('Running Step 2: Extract content');
      await extractAllContent();
    }

    if (shouldRunStep3) {
      console.log('Running Step 3: Process content');
      await processContent();
    }

    if (shouldRunStep4) {
      console.log('Running Step 4: Process content with OpenAI');
      await processWithOpenAI();
    }

    if (shouldRunStep5) {
      console.log('Running Step 5: Generate category reports');
      await generateReports();
    }

    if (shouldRunStep6) {
      console.log('Running Step 6: Generate static HTML');
      await generateStaticSite();
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
