import { eq } from 'drizzle-orm';
import { createDb } from './db';
import { users } from '../../drizzle/schema';

export async function getActiveUsers(): Promise<string[]> {
  const { db, pool } = createDb();
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActive, true));
    return rows.map(r => r.id);
  } finally {
    await pool.end();
  }
}

export async function getUserById(userId: string): Promise<{ id: string; slug: string } | null> {
  const { db, pool } = createDb();
  try {
    const rows = await db.select({ id: users.id, slug: users.slug }).from(users).where(eq(users.id, userId));
    return rows[0] ? { id: rows[0].id, slug: rows[0].slug } : null;
  } finally {
    await pool.end();
  }
}
