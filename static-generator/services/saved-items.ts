import { and, eq } from 'drizzle-orm';
import { createDb } from './db';
import { feedItems, savedItems } from '../../drizzle/schema';

export type SavedItemRecord = {
  id: string;
  userId: string;
  feedItemId: string;
  savedSummary: string | null;
  notes: string | null;
  savedAt: Date;
  updatedAt: Date;
  title?: string | null;
  url?: string | null;
  publishedAt?: Date | null;
};

export async function saveItem(params: {
  userId: string;
  feedItemId: string;
  savedSummary?: string;
  notes?: string;
}): Promise<void> {
  const { db, pool } = createDb();
  try {
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (params.savedSummary !== undefined) {
      updateSet.savedSummary = params.savedSummary;
    }

    if (params.notes !== undefined) {
      updateSet.notes = params.notes;
    }

    await db
      .insert(savedItems)
      .values({
        userId: params.userId,
        feedItemId: params.feedItemId,
        savedSummary: params.savedSummary ?? null,
        notes: params.notes ?? null
      })
      .onConflictDoUpdate({
        target: [savedItems.userId, savedItems.feedItemId],
        set: updateSet
      });
  } finally {
    await pool.end();
  }
}

export async function listSavedItems(userId: string): Promise<SavedItemRecord[]> {
  const { db, pool } = createDb();
  try {
    const rows = await db
      .select({
        id: savedItems.id,
        feedItemId: savedItems.feedItemId,
        userId: savedItems.userId,
        savedSummary: savedItems.savedSummary,
        notes: savedItems.notes,
        savedAt: savedItems.createdAt,
        updatedAt: savedItems.updatedAt,
        title: feedItems.title,
        url: feedItems.url,
        publishedAt: feedItems.publishedAt
      })
      .from(savedItems)
      .leftJoin(feedItems, eq(savedItems.feedItemId, feedItems.id))
      .where(eq(savedItems.userId, userId));

    return rows;
  } finally {
    await pool.end();
  }
}

export async function isSaved(userId: string, feedItemId: string): Promise<boolean> {
  const { db, pool } = createDb();
  try {
    const rows = await db
      .select({ id: savedItems.id })
      .from(savedItems)
      .where(and(eq(savedItems.userId, userId), eq(savedItems.feedItemId, feedItemId)))
      .limit(1);
    return rows.length > 0;
  } finally {
    await pool.end();
  }
}
