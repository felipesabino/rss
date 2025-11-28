import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/feeds", label: "Feeds" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/saved", label: "Saved" },
];

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-sm font-semibold text-primary flex items-center justify-center">
              R
            </div>
            <div>
              <p className="text-sm font-semibold">RSS Dashboard</p>
              <p className="text-xs text-muted-foreground">Signed in as {session.user?.slug}</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn(
                  "text-sm font-medium text-muted-foreground hover:text-primary"
                )}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
