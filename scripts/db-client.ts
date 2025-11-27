import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as schema from '../drizzle/schema';

dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';

export function createDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  return { db, pool };
}
