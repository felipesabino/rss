import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const overviewItems = [
  {
    title: "Feeds",
    body: "Manage RSS and Google searches that power your reports.",
    href: "/dashboard/feeds",
  },
  {
    title: "Reports",
    body: "Browse generated reports and drill into details.",
    href: "/dashboard/reports",
  },
  {
    title: "Saved",
    body: "Revisit the items you’ve saved from reports.",
    href: "/dashboard/saved",
  },
];

type DashboardPageProps = {
  userSlug?: string;
};

export function DashboardPage({ userSlug }: DashboardPageProps) {
  return (
    <DashboardShell userSlug={userSlug}>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="max-w-2xl text-muted-foreground">
            Everything about your feeds, reports, and saved items lives here. Use the
            navigation to jump into a section, and we’ll keep all queries scoped to your
            account.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {overviewItems.map((item) => (
            <a key={item.title} href={item.href} className="group block">
              <Card className="transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
