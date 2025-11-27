import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export function createDb() {
  const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  return { db, pool };
}
