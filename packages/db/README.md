# Database Overview (packages/db)

This package holds the Prisma schema and generated client for the project. It mirrors the Drizzle schema and migrations at the repo root. Tables and their roles:

- `users`: Tenant identity (slug/email/status). Owners of all other data.
- `source_configs`: Per-user feeds/searches (RSS or Google) with categories and language metadata. Drives ingestion scope.
- `pipeline_runs`: Execution records for the pipeline steps per user; links intermediates back to a run.
- `feed_items`: Raw fetched items (title/url/published/site metadata) keyed to a source config and run.
- `extracted_contents`: Full text extracted from feed items (step 2 output).
- `processed_contents`: Media classification and processing flags for each feed item (step 3 output).
- `ai_analyses`: AI summaries/sentiment for processed items (step 4 output).
- `digests`: New consolidated digest records (replaces reports/report_items). Stores full digest JSON payload, config, custom prompt/theme, status, timestamps, and optional errors.
- `digest_html`: Rendered HTML artifacts for a digest (e.g., web/email variants). Unique per (digestId, format).
- `reports` / `report_items`: Legacy newsletter storage (now superseded by `digests`). Kept for backward compatibility/migration until removed.
- `saved_items`: User-saved feed items and notes; excluded from retention cleanup.
- `scoring_audits`: Stored ranking inputs/outputs for transparency during digest generation.
- `retention_audit_logs`: Optional audit trail of retention cleanup actions.

How it is used:
- The pipeline (static-generator, DbPipelineStore) writes intermediates into `feed_items` → `extracted_contents` → `processed_contents` → `ai_analyses`, then writes digests to `digests` and rendered HTML to `digest_html`. `pipeline_runs` tracks run progress/status.
- The Astro frontend reads digests via Prisma (`Digest`/`DigestHtml`) to list and view digest content.
- Retention scripts operate on time-varying tables (feed items through digests) while preserving `saved_items`.

Regeneration: after schema changes, run Prisma generate (e.g., `npm run db:generate` from repo root or `pnpm prisma generate` inside this package).***
