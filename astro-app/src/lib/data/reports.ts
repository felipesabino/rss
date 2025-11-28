import {
  prisma,
  type Prisma,
  type Report,
  type ReportItem,
  type FeedItem,
} from "@rss/db";

export type ReportWithItems = Report & {
  items: (ReportItem & { feedItem: FeedItem | null })[];
};

export async function listReports(userId: string): Promise<Report[]> {
  return prisma.report.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });
}

export async function getReportById(
  userId: string,
  reportId: string
): Promise<ReportWithItems | null> {
  return prisma.report.findFirst({
    where: { id: reportId, userId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: { feedItem: true },
      },
    },
  });
}

export async function createReport(
  userId: string,
  data: Prisma.ReportUncheckedCreateInput
): Promise<Report> {
  if (data.userId && data.userId !== userId) {
    throw new Error("Cannot create report for a different user");
  }

  return prisma.report.create({
    data: { ...data, userId },
  });
}
