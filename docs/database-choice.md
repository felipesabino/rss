# Database Choice and Setup

## Chosen Database Engine and Rationale
- **PostgreSQL**: mature relational engine with strong support for multi-tenant workloads, rich indexing, JSONB for flexible payloads (e.g., scoring audits), and robust tooling for backups and migrations.
- Fits the need to query per-user and per-pipeline-run, enforce foreign keys across all pipeline entities, and scale reads for reporting/cleanup with well-known indexing patterns.

## Chosen ORM/Query Layer and Rationale
- **Drizzle ORM** (drizzle-kit already present in devDependencies): type-safe schema definitions in TypeScript, lightweight runtime, and straightforward migrations.
- Works well with incremental adoption: we can start with generated SQL migrations for the new schema and later evolve relationships/indexes without vendor lock-in.

## Migration Strategy
- Define schema in `drizzle`/`schema.ts` (or similar) and generate SQL migrations with `npx drizzle-kit generate:pg` targeting a Postgres `DATABASE_URL`.
- Apply migrations with `npx drizzle-kit migrate` (to be scripted as `npm run db:migrate` in a later task).
- Store migrations under `drizzle/migrations` (or `migrations/`) in the repo for CI/CD to run non-interactively before pipeline execution.

## Local Development Setup (Docker)
- A lightweight Postgres container is provided via `docker-compose.yml`.
- Start the database: `docker-compose up -d db`
- Stop it: `docker-compose down`
- Default credentials: user `rss`, password `rss`, database `rss`, port `5432` exposed to the host.
- Drizzle commands should point `DATABASE_URL` at this container; ensure the env file is loaded (`cp .env.example .env && edit DATABASE_URL`).

## Environment Variables
- `DATABASE_URL=postgres://rss:rss@localhost:5432/rss`
- Optional overrides can be added later (e.g., `DB_SSL`, `DB_SCHEMA`), but the above URI is sufficient for local development and CI.
