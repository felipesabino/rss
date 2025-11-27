import { and, eq } from 'drizzle-orm';
import { createDb } from './db';
import { sourceConfigs } from '../../drizzle/schema';

export type SourceConfigRecord = {
  id: string;
  userId: string;
  type: string;
  name: string;
  url?: string | null;
  query?: string | null;
  categories: string[];
  language?: string | null;
  isActive: boolean;
};

export async function getSourcesForUser(userId: string): Promise<SourceConfigRecord[]> {
  const { db, pool } = createDb();
  try {
    const rows = await db
      .select()
      .from(sourceConfigs)
      .where(and(eq(sourceConfigs.userId, userId), eq(sourceConfigs.isActive, true)));
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      name: row.name,
      url: row.url,
      query: row.query,
      categories: row.categories ?? [],
      language: row.language,
      isActive: row.isActive
    }));
  } finally {
    await pool.end();
  }
}
