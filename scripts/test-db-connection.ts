import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';

async function main() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query('select 1 as ok');
    console.log('DB connection succeeded:', result.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('DB connection failed:', err);
  process.exit(1);
});
