import type { ReactNode } from "react";

import { Button } from "./ui/button";

type DashboardShellProps = {
  userSlug?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/feeds", label: "Feeds" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/saved", label: "Saved" },
];

export function DashboardShell({ userSlug, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
              R
            </div>
            <div>
              <p className="text-sm font-semibold">RSS Dashboard</p>
              <p className="text-xs text-muted-foreground">
                Signed in as {userSlug ?? "user"}
              </p>
            </div>
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                <a href={item.href}>{item.label}</a>
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
