# AGENTS

This file defines the AI agents responsible for building and maintaining the
Next.js-based user dashboard, which allows users to authenticate, manage their
feeds/searches, view reports, and interact with AI-assisted helpers.

The repository is structured as a small monorepo:

- `apps/generator/` – RSS/search ingestion and report generation pipeline (CLI / cron).
- `apps/dashboard/` – Next.js user dashboard (web UI).
- `packages/db/` – Shared Prisma schema and DB client.
- `packages/core-domain/` – Optional shared domain types and helpers used by both apps.
- `packages/config/` – Optional shared constants, prompts, categories.

Generator and dashboard **must not** import each other directly. They can only
share code via `packages/`.

The dashboard stack:

- Framework: Next.js (App Router, TypeScript)
- UI: shadcn/ui + Tailwind CSS
- Auth: Auth.js (NextAuth)
- Data: Prisma + Postgres (via `packages/db`)
- API: Next.js Route Handlers (`apps/dashboard/app/api/.../route.ts`)

All agents MUST keep the system multi-tenant-aware: every operation is scoped to
the authenticated user, and no user’s data can leak to another.

---

## Agent 1 – ARCHITECT

**Goal:** Define structure, dependencies, and contracts so other agents can
implement features safely and consistently, respecting the separation between
generator, dashboard, and shared packages.

### Responsibilities

- Maintain the high-level architecture and folder layout:
  - `apps/dashboard/` for UI and HTTP APIs.
  - `apps/generator/` for batch pipeline.
  - `packages/db/` for Prisma schema + client.
- Define shared types and interfaces in `packages/core-domain/` (if needed) for:
  - `User`, `SourceConfig`, `Report`, `SavedItem`, etc.
- Document how both apps use `packages/db` but remain deployable separately.
- Ensure dashboard is purely HTTP/UI and never calls generator internals directly.

### Outputs

- `docs/dashboard-architecture.md`:
  - Overview of dashboard routes and pages.
  - Data flow diagrams: browser → `apps/dashboard` → `packages/db` → DB.
  - Auth/session model (which routes are protected).
  - Clear boundaries between apps and packages.

---

## Agent 2 – AUTH & SESSION AGENT

**Goal:** Implement secure authentication, session handling, and user scoping in
`apps/dashboard`.

### Responsibilities

- Configure Auth.js (NextAuth) with Prisma adapter from `packages/db`.
- Create `apps/dashboard/app/api/auth/[...nextauth]/route.ts`.
- Provide helpers in `apps/dashboard/lib/auth.ts`:
  - `getServerSession()`, `requireUser()`.
- Enforce auth on all `/dashboard` routes and dashboard-related APIs.

### Outputs

- Auth config file(s) in `apps/dashboard`.
- Auth utilities scoped to the dashboard app only.

---

## Agent 3 – DATA & PRISMA AGENT

**Goal:** Provide a robust data access layer for the dashboard, on top of Prisma,
using the shared `packages/db` client.

### Responsibilities

- Implement a singleton Prisma client in `packages/db/src/client.ts`.
- Use that client in:
  - `apps/dashboard/lib/data/*.ts` (dashboard data layer).
- Implement data functions for:
  - Current user profile.
  - `SourceConfig` CRUD.
  - Listing/fetching `Report` and items.
  - Listing/creating `SavedItem`.
- Always scope queries by `userId`.

### Outputs

- `packages/db/src/client.ts`
- `apps/dashboard/lib/data/users.ts`
- `apps/dashboard/lib/data/sources.ts`
- `apps/dashboard/lib/data/reports.ts`
- `apps/dashboard/lib/data/saved-items.ts`

---

## Agent 4 – UI & PAGES AGENT

**Goal:** Implement the dashboard UI using shadcn/ui and Tailwind, wired to the
data layer and auth, under `apps/dashboard/app`.

### Responsibilities

- Implement dashboard layout and navigation under:
  - `apps/dashboard/app/(dashboard)/dashboard/...`
- Pages:
  - `/dashboard` (overview)
  - `/dashboard/feeds`
  - `/dashboard/reports`
  - `/dashboard/reports/[reportId]`
  - `/dashboard/saved`
- Use server components for data loading, client components for forms.
- Use shadcn/ui for all major UI elements.

### Outputs

- Layout and pages under `apps/dashboard/app/(dashboard)/dashboard/`.
- Reusable components in `apps/dashboard/components/`.

---

## Agent 5 – API & AI ACTIONS AGENT

**Goal:** Implement dashboard API route handlers and AI helper endpoints under
`apps/dashboard/app/api`.

### Responsibilities

- Implement REST-like API endpoints for dashboard operations:
  - `apps/dashboard/app/api/feeds/route.ts` and `[id]/route.ts`
  - `apps/dashboard/app/api/saved-items/route.ts`
  - `apps/dashboard/app/api/ai/*`
- Ensure all APIs:
  - Use Auth helpers to get the current user.
  - Delegate DB work to data layer functions.
- Implement AI helper endpoints (e.g., generate feed/report descriptions).

### Outputs

- API route handlers in `apps/dashboard/app/api/**`.
- `docs/dashboard-api.md` documenting request/response shapes.

---

## Collaboration & Handoffs

- ARCHITECT defines folder layout and shared package boundaries.
- `packages/db` is created first; both apps depend on it.
- AUTH & SESSION + DATA & PRISMA must be in pl
