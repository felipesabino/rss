import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';
const migrationsDir = path.resolve(__dirname, '..', 'migrations');

export async function runMigrations(providedPool?: Pool) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = providedPool ?? new Pool({ connectionString });
  const client = await pool.connect();

  try {
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.warn('No migration files found.');
      return;
    }

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim();
      if (!sql) continue;

      console.log(`Applying migration ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
    if (!providedPool) {
      await pool.end();
    }
  }
}

async function main() {
  console.log('Running migrations...');
  await runMigrations();
  console.log('Migrations applied.');
}

if (import.meta.url === `file://${__filename}`) {
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
