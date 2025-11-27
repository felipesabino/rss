import dotenv from 'dotenv';
import { fetchAllSources } from './steps/1-fetch-sources';
import { extractAllContent } from './steps/2-extract-content';
import { processContent } from './steps/3-process-content';
import { processWithOpenAI } from './steps/4-process-with-openai';
import { generateReports } from './steps/5-generate-reports';
import { generateStaticSite } from './steps/6-generate-html';
import { DbPipelineStore, FilePipelineStore, PipelineStore } from './services/pipeline-store';
import { getActiveUsers } from './services/users';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const getArgValue = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return undefined;
  };

  const cliUserId = getArgValue('--user-id');
  const useFileStore = args.includes('--use-file-store') || process.env.PIPELINE_STORE === 'file';
  const runAllUsers = args.includes('--all-users');
  const userId = cliUserId || process.env.DEFAULT_USER_ID || 'default';

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
  --use-file-store   Force FilePipelineStore (bypass DB)
  --user-id <id>     Run pipeline for a specific user (default: default)
  --all-users        Run pipeline for all active users (DB only)
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

  if (runAllUsers && useFileStore) {
    console.error('Cannot use --all-users with file store. Use PIPELINE_STORE=db or remove --use-file-store.');
    process.exit(1);
  }

  const users = runAllUsers ? await getActiveUsers() : [userId];
  if (users.length === 0) {
    console.error('No active users found.');
    process.exit(1);
  }

  let allSucceeded = true;
  for (const uid of users) {
    console.log(`\n=== Running pipeline for user: ${uid} ===`);
    const success = await runPipelineForUser(uid, useFileStore, {
      shouldRunStep1,
      shouldRunStep2,
      shouldRunStep3,
      shouldRunStep4,
      shouldRunStep5,
      shouldRunStep6
    });
    if (!success) {
      allSucceeded = false;
    }
  }

  process.exit(allSucceeded ? 0 : 1);
}

async function runPipelineForUser(
  userId: string,
  useFileStore: boolean,
  steps: {
    shouldRunStep1: boolean;
    shouldRunStep2: boolean;
    shouldRunStep3: boolean;
    shouldRunStep4: boolean;
    shouldRunStep5: boolean;
    shouldRunStep6: boolean;
  }
): Promise<boolean> {
  let store: PipelineStore | undefined;
  try {
    store = useFileStore ? new FilePipelineStore() : new DbPipelineStore({ userId });
    console.log(useFileStore ? 'Using FilePipelineStore (file cache).' : `Using DbPipelineStore (userId=${userId}).`);

    if (steps.shouldRunStep1) {
      console.log('Running Step 1: Fetch sources');
      await fetchAllSources(store, userId);
      await store.markStepCompleted?.(1);
    }

    if (steps.shouldRunStep2) {
      console.log('Running Step 2: Extract content');
      await extractAllContent(store);
      await store.markStepCompleted?.(2);
    }

    if (steps.shouldRunStep3) {
      console.log('Running Step 3: Process content');
      await processContent(store);
      await store.markStepCompleted?.(3);
    }

    if (steps.shouldRunStep4) {
      console.log('Running Step 4: Process content with OpenAI');
      await processWithOpenAI(store);
      await store.markStepCompleted?.(4);
    }

    if (steps.shouldRunStep5) {
      console.log('Running Step 5: Generate category reports');
      await generateReports(store);
      await store.markStepCompleted?.(5);
    }

    if (steps.shouldRunStep6) {
      console.log('Running Step 6: Generate static HTML');
      await generateStaticSite();
      await store.markStepCompleted?.(6);
    }

    console.log(`Process completed successfully for user ${userId}`);
    await store.finalizeRun?.('succeeded');
    return true;
  } catch (err) {
    console.error(`Failed to complete process for user ${userId}:`, err);
    await store?.finalizeRun?.('failed');
    return false;
  }
}

// Execute the main function
main();
