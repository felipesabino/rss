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

type ReportsPageProps = {
  userSlug?: string;
  reports: DigestWithPayload[];
};

export function ReportsPage({ userSlug, reports }: ReportsPageProps) {
  return (
    <DashboardShell userSlug={userSlug}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Reports
          </p>
          <h1 className="text-3xl font-semibold">Report history</h1>
          <p className="max-w-2xl text-muted-foreground">
            Browse reports generated for your account. Details and scored items stay scoped to
            you.
          </p>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reports yet. Run the generator to create your first report.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {reports.map((report) => {
              const payload = report.payload || {};
              const header = payload.report?.header ?? "Untitled digest";
              const category = payload.category ?? "Digest";
              return (
                <a key={report.id} href={`/dashboard/reports/${report.id}`} className="group">
                  <Card className="transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span className="uppercase tracking-wide">{category}</span>
                        <span>{formatter.format(new Date(report.generatedAt))}</span>
                      </div>
                      <CardTitle className="text-lg">
                        {header}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Open to view items and scores</p>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
