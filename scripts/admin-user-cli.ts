import dotenv from 'dotenv';
import { and, desc, eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import {
  pipelineRuns,
  sourceConfigs,
  users
} from '../drizzle/schema';
import { createDb } from '../static-generator/services/db';

dotenv.config({ path: '.env' });

type Command =
  | { kind: 'user_create'; id: string; slug?: string; email?: string; isActive: boolean }
  | { kind: 'user_list' }
  | { kind: 'source_add'; userId: string; type: string; name: string; url?: string; query?: string; categories: string[]; language?: string; isActive: boolean }
  | { kind: 'source_list'; userId: string }
  | { kind: 'source_delete'; id: string }
  | { kind: 'runs_list'; userId?: string };

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseCommand(): Command {
  const [,, domain, action] = process.argv;
  if (domain === 'user' && action === 'create') {
    const id = getFlag('--id') ?? getFlag('--user-id');
    if (!id) throw new Error('Missing required --id for user create');
    const slug = getFlag('--slug') ?? id;
    const email = getFlag('--email');
    const isActive = !hasFlag('--inactive');
    return { kind: 'user_create', id, slug, email, isActive };
  }

  if (domain === 'user' && action === 'list') {
    return { kind: 'user_list' };
  }

  if (domain === 'source' && action === 'add') {
    const userId = getFlag('--user-id');
    const type = getFlag('--type');
    const name = getFlag('--name');
    const url = getFlag('--url');
    const query = getFlag('--query');
    const categories = (getFlag('--categories') || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    const language = getFlag('--language');
    const isActive = !hasFlag('--inactive');

    if (!userId || !type || !name || (!url && !query)) {
      throw new Error('Missing required flags. Example: source add --user-id <id> --type rss --name "My Feed" --url https://...');
    }

    return { kind: 'source_add', userId, type, name, url, query, categories, language, isActive };
  }

  if (domain === 'source' && action === 'list') {
    const userId = getFlag('--user-id');
    if (!userId) throw new Error('Missing required --user-id for source list');
    return { kind: 'source_list', userId };
  }

  if (domain === 'source' && action === 'delete') {
    const id = getFlag('--id');
    if (!id) throw new Error('Missing required --id for source delete');
    return { kind: 'source_delete', id };
  }

  if (domain === 'runs' && action === 'list') {
    const userId = getFlag('--user-id');
    return { kind: 'runs_list', userId };
  }

  throw new Error(`Unknown command. Examples:
  user create --id demo --slug demo --email demo@example.com [--inactive]
  user list
  source add --user-id demo --type rss --name \"My Feed\" --url https://example.com/rss --categories tech,startups
  source list --user-id demo
  source delete --id <source-config-id>
  runs list [--user-id demo]`);
}

async function handleCommand(cmd: Command): Promise<void> {
  const { db, pool } = createDb();
  try {
    switch (cmd.kind) {
      case 'user_create': {
        await db
          .insert(users)
          .values({
            id: cmd.id,
            slug: cmd.slug ?? cmd.id,
            email: cmd.email ?? null,
            isActive: cmd.isActive
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              slug: cmd.slug ?? cmd.id,
              email: cmd.email ?? null,
              isActive: cmd.isActive,
              updatedAt: new Date()
            }
          });
        console.log(`User ${cmd.id} upserted (active=${cmd.isActive})`);
        break;
      }
      case 'user_list': {
        const rows = await db
          .select({ id: users.id, slug: users.slug, email: users.email, isActive: users.isActive, createdAt: users.createdAt })
          .from(users)
          .orderBy(users.createdAt);
        console.table(rows);
        break;
      }
      case 'source_add': {
        await db
          .insert(sourceConfigs)
          .values({
            userId: cmd.userId,
            type: cmd.type,
            name: cmd.name,
            url: cmd.url ?? null,
            query: cmd.query ?? null,
            categories: cmd.categories,
            language: cmd.language ?? null,
            isActive: cmd.isActive
          })
          .onConflictDoUpdate({
            target: [sourceConfigs.userId, sourceConfigs.type, sourceConfigs.url, sourceConfigs.query],
            set: {
              name: cmd.name,
              categories: cmd.categories,
              language: cmd.language ?? null,
              isActive: cmd.isActive,
              updatedAt: new Date()
            }
          });
        console.log(`Source upserted for user ${cmd.userId}: ${cmd.name}`);
        break;
      }
      case 'source_list': {
        const rows = await db
          .select({
            id: sourceConfigs.id,
            userId: sourceConfigs.userId,
            type: sourceConfigs.type,
            name: sourceConfigs.name,
            url: sourceConfigs.url,
            query: sourceConfigs.query,
            categories: sourceConfigs.categories,
            language: sourceConfigs.language,
            isActive: sourceConfigs.isActive,
            updatedAt: sourceConfigs.updatedAt
          })
          .from(sourceConfigs)
          .where(eq(sourceConfigs.userId, cmd.userId));
        console.table(rows);
        break;
      }
      case 'source_delete': {
        const deleted = await db.delete(sourceConfigs).where(eq(sourceConfigs.id, cmd.id)).returning({ id: sourceConfigs.id });
        if (deleted.length === 0) {
          console.warn(`No source found with id ${cmd.id}`);
        } else {
          console.log(`Deleted source ${cmd.id}`);
        }
        break;
      }
      case 'runs_list': {
        let query = db
          .select({
            id: pipelineRuns.id,
            userId: pipelineRuns.userId,
            status: pipelineRuns.status,
            startedAt: pipelineRuns.startedAt,
            completedAt: pipelineRuns.completedAt,
            stepCompleted: pipelineRuns.stepCompleted
          })
          .from(pipelineRuns);

        if (cmd.userId) {
          query = query.where(eq(pipelineRuns.userId, cmd.userId));
        }

        const rows = await query.orderBy(desc(pipelineRuns.startedAt)).limit(20);
        console.table(rows);
        break;
      }
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const cmd = parseCommand();
  await handleCommand(cmd);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
