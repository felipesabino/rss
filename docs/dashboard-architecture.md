# Dashboard Architecture

The dashboard is a Next.js App Router app under `apps/dashboard`. It is isolated from the generator: no imports cross between the two apps. All shared data access goes through `packages/db`, which exposes the Prisma client and schema.

## Routes and pages

- Public root: `apps/dashboard/app/page.tsx` – simple landing.
- Auth: `apps/dashboard/app/api/auth/[...nextauth]/route.ts` – Auth.js (Prisma adapter).
- Dashboard feature area: `apps/dashboard/app/(dashboard)/dashboard`
  - `layout.tsx` – session gate, nav for Overview, Feeds, Reports, Saved.
  - `page.tsx` – overview.
  - `feeds/page.tsx` – manage sources (RSS/Google).
  - `reports/page.tsx` – list reports.
  - `reports/[reportId]/page.tsx` – report details.
  - `saved/page.tsx` – saved items list.
- APIs:
  - `/api/feeds` and `/api/feeds/[id]` – CRUD for sources.
  - `/api/ai/generate-description` – AI helper (scoped to dashboard).

## Data flow

Browser → Next.js route/page → data layer (`apps/dashboard/lib/data/*.ts`) → Prisma client (`packages/db`) → Postgres.

All data functions accept `userId` and filter by it. API handlers call `getServerSession` to obtain the current user, then delegate to the data layer. Server components under `(dashboard)` call `requireUser()` before fetching data.

## Auth/session model

- Auth.js with Prisma adapter; sessions stored in DB tables defined in `packages/db/prisma/schema.prisma`.
- Credentials provider (email + slug) for now; can add OAuth providers later via Auth.js config.
- Helpers:
  - `getServerSession()` – fetches session.
  - `requireUser()` – redirects to sign-in if no session.
- `next-auth.d.ts` augments session to include `user.id` and `user.slug`.

## Boundaries

- `apps/dashboard` only imports database code from `@rss/db`.
- No imports from `apps/generator` are allowed.
- Shared schema + client live in `packages/db`; both apps can depend on the package but remain deployable independently.

## Local notes

- Prisma schema mirrors the existing Postgres tables and adds Auth.js tables. Run `npx prisma generate` inside `packages/db` after schema changes.
- The existing generator continues to use Drizzle; the dashboard uses Prisma via `@rss/db`.
