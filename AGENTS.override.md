# AGENTS

This document defines the AI agents and responsibilities for migrating the
existing Next.js codebase to Astro.

The goal is to:

- Replace Next.js as the main web framework with Astro.
- Preserve as much of the existing React UI and styling as makes sense.
- Move routing, data loading, and build concerns into Astro.
- Keep any non-UI backend (APIs, services, generator) separate and reusable.
- End with a clean Astro project structure that can be deployed independently.

---

## Overall Architecture

The target structure (can be adapted if you already have a monorepo):

```txt
.
├── astro-app/            # New Astro project (replaces Next.js for the frontend)
│   ├── src/
│   │   ├── pages/        # Astro pages + endpoints
│   │   ├── layouts/      # Astro layouts
│   │   ├── react/        # React components migrated from Next
│   │   └── lib/          # Frontend-only utilities (fetchers, helpers)
│   └── public/           # Static assets
├── next-app/             # Old Next.js app (to be retired after migration)
└── backend/              # Optional: API/backend services (if separate)
