import dotenv from 'dotenv';
import { and, inArray, isNull, isNotNull, lt, or } from 'drizzle-orm';
import {
  aiAnalyses,
  extractedContents,
  feedItems,
  processedContents,
  reportItems,
  reports,
  savedItems
} from '../drizzle/schema';
import { createDb } from '../static-generator/services/db';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env' });

type CleanupStats = {
  feedItems: number;
  extractedContents: number;
  processedContents: number;
  aiAnalyses: number;
  reportItems: number;
  reports: number;
};

function getCutoffDate(retentionMonths: number): Date {
  const months = Number.isFinite(retentionMonths) && retentionMonths > 0 ? retentionMonths : 6;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

const buildAgeCondition = (expiresAt: any, createdAt: any, cutoffDate: Date) =>
  or(and(isNotNull(expiresAt), lt(expiresAt, cutoffDate)), and(isNull(expiresAt), lt(createdAt, cutoffDate)));

export async function cleanupRetention(): Promise<void> {
  const retentionMonths = Number(process.env.RETENTION_MONTHS ?? '6');
  const cutoffDate = getCutoffDate(retentionMonths);

  const { db, pool } = createDb();
  const stats: CleanupStats = {
    feedItems: 0,
    extractedContents: 0,
    processedContents: 0,
    aiAnalyses: 0,
    reportItems: 0,
    reports: 0
  };

  try {
    const savedRows = await db.select({ feedItemId: savedItems.feedItemId }).from(savedItems);
    const savedFeedItemIds = new Set(savedRows.map(row => row.feedItemId));
    const savedFeedArray = Array.from(savedFeedItemIds);

    const feedAgeCondition = buildAgeCondition(feedItems.expiresAt, feedItems.createdAt, cutoffDate);
    const feedCandidates = await db.select({ id: feedItems.id }).from(feedItems).where(feedAgeCondition);
    const feedIdsToDelete = feedCandidates.map(row => row.id).filter(id => id && !savedFeedItemIds.has(id));

    const reportItemAgeCondition = buildAgeCondition(reportItems.expiresAt, reportItems.createdAt, cutoffDate);
    const reportItemCandidates = await db
      .select({
        id: reportItems.id,
        feedItemId: reportItems.feedItemId,
        reportId: reportItems.reportId
      })
      .from(reportItems)
      .where(reportItemAgeCondition);

    const reportItemIdsToDelete = new Set<string>();
    for (const item of reportItemCandidates) {
      if (!item.feedItemId || !savedFeedItemIds.has(item.feedItemId)) {
        reportItemIdsToDelete.add(item.id);
      }
    }

    if (feedIdsToDelete.length) {
      const reportItemsForOldFeeds = await db
        .select({ id: reportItems.id })
        .from(reportItems)
        .where(inArray(reportItems.feedItemId, feedIdsToDelete));
      reportItemsForOldFeeds.forEach(row => reportItemIdsToDelete.add(row.id));
    }

    const protectedReportIds = new Set<string>();
    if (savedFeedArray.length) {
      const savedReportRefs = await db
        .select({ reportId: reportItems.reportId })
        .from(reportItems)
        .where(inArray(reportItems.feedItemId, savedFeedArray));
      savedReportRefs.forEach(row => row.reportId && protectedReportIds.add(row.reportId));
    }

    const reportAgeCondition = buildAgeCondition(reports.expiresAt, reports.generatedAt, cutoffDate);
    const reportCandidates = await db.select({ id: reports.id }).from(reports).where(reportAgeCondition);
    const reportIdsToDelete = reportCandidates.map(row => row.id).filter(id => id && !protectedReportIds.has(id));

    await db.transaction(async tx => {
      if (reportItemIdsToDelete.size) {
        const deleted = await tx
          .delete(reportItems)
          .where(inArray(reportItems.id, Array.from(reportItemIdsToDelete)))
          .returning({ id: reportItems.id });
        stats.reportItems += deleted.length;
      }

      if (feedIdsToDelete.length) {
        const deletedAnalyses = await tx
          .delete(aiAnalyses)
          .where(inArray(aiAnalyses.feedItemId, feedIdsToDelete))
          .returning({ id: aiAnalyses.id });
        stats.aiAnalyses += deletedAnalyses.length;

        const deletedProcessed = await tx
          .delete(processedContents)
          .where(inArray(processedContents.feedItemId, feedIdsToDelete))
          .returning({ id: processedContents.id });
        stats.processedContents += deletedProcessed.length;

        const deletedExtracted = await tx
          .delete(extractedContents)
          .where(inArray(extractedContents.feedItemId, feedIdsToDelete))
          .returning({ id: extractedContents.id });
        stats.extractedContents += deletedExtracted.length;

        const deletedReportItems = await tx
          .delete(reportItems)
          .where(inArray(reportItems.feedItemId, feedIdsToDelete))
          .returning({ id: reportItems.id });
        stats.reportItems += deletedReportItems.length;
      }

      if (reportIdsToDelete.length) {
        const deletedReportItems = await tx
          .delete(reportItems)
          .where(inArray(reportItems.reportId, reportIdsToDelete))
          .returning({ id: reportItems.id });
        stats.reportItems += deletedReportItems.length;

        const deletedReports = await tx
          .delete(reports)
          .where(inArray(reports.id, reportIdsToDelete))
          .returning({ id: reports.id });
        stats.reports += deletedReports.length;
      }

      if (feedIdsToDelete.length) {
        const deletedFeeds = await tx
          .delete(feedItems)
          .where(inArray(feedItems.id, feedIdsToDelete))
          .returning({ id: feedItems.id });
        stats.feedItems += deletedFeeds.length;
      }
    });

    console.log(
      `Retention cleanup complete for cutoff ${cutoffDate.toISOString()} (months=${retentionMonths || 6}):`,
      stats
    );
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    await cleanupRetention();
    process.exit(0);
  } catch (err) {
    console.error('Retention cleanup failed:', err);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
