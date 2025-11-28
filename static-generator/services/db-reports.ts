import { desc, eq } from 'drizzle-orm';
import { digests } from '../../drizzle/schema';
import { createDb } from './db';
import { CategoryReport } from './pipeline-store';
import { Report } from './openai';

export type UserReportRecord = CategoryReport & { id: string; pipelineRunId?: string };

export async function getReportsWithItemsForUser(userId: string): Promise<UserReportRecord[]> {
  const { db, pool } = createDb();
  try {
    const digestRows = await db
      .select({
        id: digests.id,
        payload: digests.payload,
        generatedAt: digests.generatedAt,
        pipelineRunId: digests.pipelineRunId
      })
      .from(digests)
      .where(eq(digests.userId, userId))
      .orderBy(desc(digests.generatedAt));

    if (digestRows.length === 0) {
      return [];
    }

    return digestRows.map(row => {
      const payload = (row.payload ?? {}) as any;
      const reportPayload = (payload.report ?? {}) as Report;
      const report: Report = {
        header: reportPayload.header ?? '',
        mainStories: reportPayload.mainStories ?? [],
        whatElseIsGoingOn: reportPayload.whatElseIsGoingOn ?? [],
        byTheNumbers: reportPayload.byTheNumbers,
        signOff: reportPayload.signOff ?? ''
      };

      return {
        id: row.id,
        category: payload.category ?? 'Uncategorized',
        report,
        generatedAt: row.generatedAt?.getTime() ?? Date.now(),
        usedItemIds: payload.usedItemIds ?? [],
        pipelineRunId: row.pipelineRunId ?? undefined
      };
    });
  } finally {
    await pool.end();
  }
}
