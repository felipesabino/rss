import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from './db-migrate';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';

async function resetDatabase() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('Dropping and recreating public schema...');
    await client.query('BEGIN');
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await runMigrations(pool);
  await pool.end();
  console.log('Database reset and migrations reapplied.');
}

async function main() {
  await resetDatabase();
}

if (import.meta.url === `file://${__filename}`) {
  main().catch(err => {
    console.error('DB reset failed:', err);
    process.exit(1);
  });
}
