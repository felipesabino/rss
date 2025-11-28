import type { ReportItem, ReportWithItems } from "../../lib/data/reports";

import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const formatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ReportDetailPageProps = {
  userSlug?: string;
  report: ReportWithItems;
};

function StatPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-secondary px-3 py-1">{children}</span>;
}

export function ReportDetailPage({ userSlug, report }: ReportDetailPageProps) {
  return (
    <DashboardShell userSlug={userSlug}>
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
            {report.items.map((item: ReportItem & { feedItem: { url?: string | null } | null }) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.headline}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.sourceName ?? item.feedItem?.url ?? "Unknown source"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
                  <div className="flex flex-wrap gap-3 text-muted-foreground">
                    {item.score !== null && item.score !== undefined ? (
                      <StatPill>Score: {item.score}</StatPill>
                    ) : null}
                    {item.sentiment ? <StatPill>Sentiment: {item.sentiment}</StatPill> : null}
                    {item.sectionTag ? <StatPill>Section: {item.sectionTag}</StatPill> : null}
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
    </DashboardShell>
  );
}
