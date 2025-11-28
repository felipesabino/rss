# Migration Architecture

## Route Inventory
- Original Next.js app archived under `next-app/` (previously `apps/dashboard`).
- `/` → `app/page.tsx`; static server component; no data fetching; uses shadcn/ui `Button` and Tailwind utility classes.
- `/dashboard` → `(dashboard)/dashboard/page.tsx` with `(dashboard)/dashboard/layout.tsx`; server component layout enforces auth via `requireUser`; uses `next/link` for navigation; page itself is static content using cards/buttons.
- Global assets: `app/favicon.ico`, `app/globals.css`.

## Data Fetching Overview
- App Router only; no `getStaticProps`/`getServerSideProps`/`getStaticPaths`.
- Auth gating happens server-side in `(dashboard)/dashboard/layout.tsx` via `requireUser()` (NextAuth + Prisma) which redirects unauthenticated users to `/api/auth/signin`.
- API routes handle all data access (Prisma-based) for feeds, reports, saved items; page components currently display static UI.

## API Routes Inventory
- `/api/auth/[...nextauth]` (GET/POST): NextAuth credential flow backed by Prisma adapter; core session management — high complexity.
- `/api/feeds` (GET/POST): Lists or creates source configs for the authenticated user; validation via Zod — medium complexity.
- `/api/feeds/[id]` (GET/PATCH/DELETE): CRUD for a single feed with Zod validation and Prisma — medium complexity.
- `/api/ai/generate-description` (POST): Deterministic text suggestion based on prompt/type; no external calls — low complexity.
- `/api/debug/db` (GET): Development-only health check returning user count from Prisma — low complexity.

## Layouts and SEO
- Root layout: `app/layout.tsx` sets global `<html lang="en">`, applies Google Geist font variables, imports `globals.css`, and defines site-wide metadata (`title: RSS Dashboard`, `description`).
- Dashboard layout: `(dashboard)/dashboard/layout.tsx` wraps dashboard routes with a header/nav, uses Tailwind + shadcn/ui buttons, and requires an authenticated session before rendering children.
- Global styles: `app/globals.css` defines Tailwind base/components/utilities plus design tokens (CSS variables) and light/dark theming.

## Migration Strategy Overview
- Recreate the root shell as an Astro layout (`src/layouts/MainLayout.astro`) mirroring `app/layout.tsx` fonts, metadata, and global styles.
- Mirror routes in `astro-app/src/pages` with `.astro` files; render React islands for existing page components.
- Move auth/data helpers to `astro-app/src/lib` and call them from Astro frontmatter; keep React page components purely presentational. Load env from `../.env` in `astro.config.mjs` to keep Prisma’s `DATABASE_URL` available.
- Replace `next/link`/`next/server` usage in React components with Astro/standard equivalents; NextAuth endpoints will be migrated/rewired per API plan.

## API Migration Plan
- Move simple stateless endpoints into Astro endpoints early:
  - `/api/ai/generate-description` → Astro endpoint, deterministic response (no external calls).
  - `/api/debug/db` → Astro endpoint guarded to non-production environments.
- Re-implement feed CRUD in Astro using shared Prisma helpers and Astro session checks:
  - `/api/feeds` (list/create) → move to Astro.
  - `/api/feeds/[id]` (get/update/delete) → move to Astro.
- Auth:
  - `/api/auth/[...nextauth]` → keep in a dedicated auth service or recreate with Astro middleware/endpoints plus Prisma adapter; decision deferred but keep existing Next implementation until parity is ready.
