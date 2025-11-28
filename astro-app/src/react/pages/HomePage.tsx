import ReactHello from "../../components/ReactHello";
import { Button } from "../components/ui/button";

const highlights = [
  "App Router + TypeScript",
  "Tailwind CSS + shadcn/ui",
  "Scoped to authenticated users",
];

export function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-6 py-16">
      <div className="w-full max-w-4xl space-y-10 rounded-2xl border bg-white/80 p-10 shadow-xl backdrop-blur">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            RSS Dashboard
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Kickstarting the multi-tenant dashboard
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            This Next.js app is dedicated to the user-facing dashboard. UI, APIs, and
            data access will live here—completely separate from the generator pipeline and
            powered by shared packages for auth and data.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-xl border bg-card px-4 py-5 text-sm font-medium text-card-foreground shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
            apps/dashboard
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
            packages/db (shared client)
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
            No generator imports
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="lg">Open dashboard</Button>
          <Button variant="outline" size="lg">
            View API checklist
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">React integration check</h2>
          <ReactHello message="Rendered via React in Astro" />
        </div>
      </div>
    </main>
  );
}
