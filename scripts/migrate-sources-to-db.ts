import { createDb } from './db-client';
import { sourceConfigs } from '../drizzle/schema';

const args = process.argv.slice(2);
const getArgValue = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
};

const userId = getArgValue('--user-id') || 'default';

async function main() {
  const { db, pool } = createDb();
  const sourcesModule = await import('../config/sources.js').catch(async () => await import('../config/sources.ts'));
  const sources = sourcesModule.sources as Array<{
    id: number;
    type: string;
    name: string;
    url?: string;
    query?: string;
    categories?: string[];
    language?: string;
  }>;

  try {
    for (const source of sources) {
      const normalizedType = source.type === 'google-search' ? 'google' : source.type;
      await db
        .insert(sourceConfigs)
        .values({
          userId,
          type: normalizedType,
          name: source.name,
          url: source.url ?? null,
          query: source.query ?? null,
          categories: source.categories ?? [],
          language: source.language ?? null,
          isActive: true
        })
        .onConflictDoUpdate({
          target: [
            sourceConfigs.userId,
            sourceConfigs.type,
            sourceConfigs.url,
            sourceConfigs.query
          ],
          set: {
            name: source.name,
            categories: source.categories ?? [],
            language: source.language ?? null,
            isActive: true,
            updatedAt: new Date()
          }
        });
    }
    console.log(`Migrated ${sources.length} sources for user ${userId}.`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed to migrate sources:', err);
  process.exit(1);
});
