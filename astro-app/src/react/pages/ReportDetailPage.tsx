import type { DigestWithPayload } from "../../lib/data/reports";

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
  report: DigestWithPayload;
};

function StatPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-secondary px-3 py-1">{children}</span>;
}

export function ReportDetailPage({ userSlug, report }: ReportDetailPageProps) {
  const payload = report.payload || {};
  const digestReport = payload.report;
  return (
    <DashboardShell userSlug={userSlug}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Report
          </p>
          <h1 className="text-3xl font-semibold">{digestReport?.header ?? "Report details"}</h1>
          <p className="text-muted-foreground">
            Generated {formatter.format(new Date(report.generatedAt))} — category:{" "}
            {payload.category ?? "Digest"}
          </p>
        </div>

        {!digestReport || (!digestReport.mainStories?.length && !digestReport.whatElseIsGoingOn?.length) ? (
          <p className="text-sm text-muted-foreground">No items were attached to this report.</p>
        ) : (
          <div className="space-y-4">
            {(digestReport.mainStories || []).map((item, idx) => (
              <Card key={`${item.headline}-${idx}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.headline}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.sourceName ?? item.sourceUrl ?? "Unknown source"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {item.whatHappened ? <p className="text-muted-foreground">{item.whatHappened}</p> : null}
                  <div className="flex flex-wrap gap-3 text-muted-foreground">
                    {item.sentiment ? <StatPill>Sentiment: {item.sentiment}</StatPill> : null}
                    {item.sectionTag ? <StatPill>Section: {item.sectionTag}</StatPill> : null}
                  </div>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
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

            {(digestReport.whatElseIsGoingOn || []).map((item, idx) => (
              <Card key={`what-else-${idx}`}>
                <CardHeader>
                  <CardTitle className="text-lg">What else is going on</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.sourceName ?? item.sourceUrl ?? "Source"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{item.text}</p>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
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
