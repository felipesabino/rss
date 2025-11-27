import { desc, eq, inArray } from 'drizzle-orm';
import { reports, reportItems } from '../../drizzle/schema';
import { createDb } from './db';
import { CategoryReport } from './pipeline-store';
import { Report } from './openai';

export type UserReportRecord = CategoryReport & { id: string; pipelineRunId?: string };

export async function getReportsWithItemsForUser(userId: string): Promise<UserReportRecord[]> {
  const { db, pool } = createDb();
  try {
    const reportRows = await db
      .select({
        id: reports.id,
        category: reports.category,
        header: reports.header,
        generatedAt: reports.generatedAt,
        pipelineRunId: reports.pipelineRunId
      })
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.generatedAt));

    if (reportRows.length === 0) {
      return [];
    }

    const items = await db
      .select({
        reportId: reportItems.reportId,
        sectionTag: reportItems.sectionTag,
        headline: reportItems.headline,
        sourceName: reportItems.sourceName,
        sourceUrl: reportItems.sourceUrl,
        summary: reportItems.summary,
        sentiment: reportItems.sentiment,
        shortTermImpact: reportItems.shortTermImpact,
        longTermImpact: reportItems.longTermImpact
      })
      .from(reportItems)
      .where(inArray(reportItems.reportId, reportRows.map(r => r.id)));

    return reportRows.map(row => {
      const rowsForReport = items.filter(item => item.reportId === row.id);
      const mainStories = rowsForReport
        .filter(item => item.sectionTag !== 'WHAT_ELSE' && item.sectionTag !== 'BY_THE_NUMBERS')
        .map(item => ({
          sectionTag: item.sectionTag ?? '',
          headline: item.headline,
          sourceName: item.sourceName ?? '',
          sourceUrl: item.sourceUrl ?? '',
          whatHappened: item.summary ?? '',
          whyItMatters: '',
          shortTermImpact: item.shortTermImpact ?? '',
          longTermImpact: item.longTermImpact ?? '',
          sentiment: (item.sentiment as any) ?? 'Mixed',
          sentimentRationale: ''
        }));

      const whatElseIsGoingOn = rowsForReport
        .filter(item => item.sectionTag === 'WHAT_ELSE')
        .map(item => ({
          text: item.summary ?? item.headline,
          sourceName: item.sourceName ?? '',
          sourceUrl: item.sourceUrl ?? ''
        }));

      const byTheNumbersRow = rowsForReport.find(item => item.sectionTag === 'BY_THE_NUMBERS');

      const report: Report = {
        header: row.header ?? '',
        mainStories,
        whatElseIsGoingOn,
        byTheNumbers: byTheNumbersRow
          ? {
              number: byTheNumbersRow.headline,
              commentary: byTheNumbersRow.summary ?? ''
            }
          : undefined,
        signOff: ''
      };

      return {
        id: row.id,
        category: row.category,
        report,
        generatedAt: row.generatedAt?.getTime() ?? Date.now(),
        usedItemIds: [],
        pipelineRunId: row.pipelineRunId ?? undefined
      };
    });
  } finally {
    await pool.end();
  }
}
