import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getReportById } from "@/lib/data/reports";

type ReportPageProps = {
  params: { reportId: string };
};

const formatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ReportDetailPage({ params }: ReportPageProps) {
  const session = await requireUser();
  const report = await getReportById(session.user.id, params.reportId);

  if (!report) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Report
        </p>
        <h1 className="text-3xl font-semibold">{report.header ?? "Report details"}</h1>
        <p className="text-muted-foreground">
          Generated {formatter.format(new Date(report.generatedAt))} — category:{" "}
          {report.category}
        </p>
      </div>

      {report.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items were attached to this report.</p>
      ) : (
        <div className="space-y-4">
          {report.items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-lg">{item.headline}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {item.sourceName ?? item.feedItem?.siteName ?? "Unknown source"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  {item.score !== null && item.score !== undefined ? (
                    <span className="rounded-full bg-secondary px-3 py-1">
                      Score: {item.score}
                    </span>
                  ) : null}
                  {item.sentiment ? (
                    <span className="rounded-full bg-secondary px-3 py-1">
                      Sentiment: {item.sentiment}
                    </span>
                  ) : null}
                  {item.sectionTag ? (
                    <span className="rounded-full bg-secondary px-3 py-1">
                      Section: {item.sectionTag}
                    </span>
                  ) : null}
                </div>
                {item.feedItem?.url ? (
                  <a
                    href={item.feedItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Open source
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
