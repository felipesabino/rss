import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { saveItem } from '../static-generator/services/saved-items';

dotenv.config({ path: '.env' });

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main() {
  const userId = getArgValue('--user-id') ?? 'default';
  const feedItemId = getArgValue('--feed-item-id');
  const summary = getArgValue('--summary');
  const notes = getArgValue('--notes');

  if (!feedItemId) {
    console.error('Missing required flag: --feed-item-id <uuid>');
    process.exit(1);
  }

  await saveItem({
    userId,
    feedItemId,
    savedSummary: summary,
    notes
  });

  console.log(`Saved feed item ${feedItemId} for user ${userId}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Failed to save item:', err);
    process.exit(1);
  });
}
