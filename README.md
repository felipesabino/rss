# Brutalist Report Static Site Generator

A static site generator for RSS feeds, inspired by Brutalist Report aesthetics.

## Overview

Multi-tenant static generator that ingests RSS and Google Custom Search, runs a six-step pipeline (with OpenAI summarization), and writes per-user static HTML under `dist/<userSlug>/`. Data is database-backed by default (Postgres via Drizzle), with a file-store fallback for debugging.

## Features

- DB-backed pipeline store (Postgres + Drizzle), optional legacy `.cache` file store
- Brutalist EJS frontend with per-user pages and historical report pages
- OpenAI-compatible summarization/scoring (works with Ollama-compatible endpoints)
- Saved items preserved across retention cleanup
- Admin CLI to manage users and sources
- Docker Compose for local Postgres

## Project Structure

- `static-generator/` – pipeline steps, services, templates
- `drizzle/schema.ts` – DB schema; `migrations/` – SQL migrations
- `scripts/` – DB utilities, seeding, retention cleanup, admin and saved-item CLIs
- `docs/` – data model, output structure, retention, admin API, scheduling

## Dependencies

- Runtime: Node 18+, Postgres (local via Docker Compose)
- Key libs: drizzle-orm, pg, ejs, rss-parser, openai-compatible client, tsx, vitest

## Installation

```bash
git clone <repo>
cd <repo>
npm install

cp .env.example .env
# set DATABASE_URL, OPENAI_* as needed
```

### Local Postgres via Docker

```bash
docker-compose up -d db
npm run db:migrate
```

Default `DATABASE_URL` in `.env.example` matches the Docker service.

## Usage

Pipeline (DB default):

```bash
# Run all steps for default user
npm run build

# Explicit user
node static-generator/generator.js --all --user-id demo

# All active users (DB only)
node static-generator/generator.js --all --all-users

# Per-step
npm run step1  # --step1
npm run step2  # --step2
npm run step3  # --step3
npm run step4  # --step4
npm run step5  # --step5
npm run step6  # --step6 (requires DB store)

# File-store fallback
PIPELINE_STORE=file npm run build
# or
node static-generator/generator.js --all --use-file-store
```

Admin & utilities:

```bash
# Upsert user
npx tsx scripts/admin-user-cli.ts user create --id demo --slug demo --email demo@example.com
# List users
npx tsx scripts/admin-user-cli.ts user list
# Add a source (rss or google)
npx tsx scripts/admin-user-cli.ts source add --user-id demo --type rss --name "Example" --url https://example.com/rss --categories tech
# List sources
npx tsx scripts/admin-user-cli.ts source list --user-id demo
# Save an item
npx tsx scripts/save-item-cli.ts --user-id demo --feed-item-id <feed_item_uuid> [--summary "..."] [--notes "..."]
# Retention cleanup (honors saved items)
npx tsx scripts/cleanup-retention.ts
```

Preview the built static site:

```bash
npm run preview
```

## Environment Variables

The project uses environment variables for configuration. Create a `.env` file in the root directory of the project (copy from `.env.example`) and add your values:

```
# OpenAI API Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_API_BASE_URL=http://your-custom-openai-endpoint:port/v1
OPENAI_MODEL_NAME=gpt-3.5-turbo

# Feed Configuration
MAX_ITEMS_PER_FEED=10

# Build Configuration
NODE_ENV=production
# Database
DATABASE_URL=postgres://rss:rss@localhost:5432/rss
# Pipeline store selection (db | file). Default is db.
PIPELINE_STORE=db
# Optional default user id for pipeline runs
DEFAULT_USER_ID=default
```

### OpenAI API Configuration

- `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `OPENAI_MODEL_NAME`, `OPENAI_SENTIMENT_MODEL_NAME`, `OPENAI_REPORT_MODEL_NAME`
- Works with Ollama-compatible endpoints by pointing `OPENAI_API_BASE_URL` accordingly.

### Feed Configuration

- `MAX_ITEMS_PER_FEED` limits per-feed fetch.

### Database Requirements

- Postgres at `DATABASE_URL`; run `npm run db:migrate` before the pipeline.
- `PIPELINE_STORE=db` (default) uses Postgres. `PIPELINE_STORE=file` falls back to `.cache`.
- `DEFAULT_USER_ID` sets default user for single-user runs.
- `RETENTION_MONTHS` controls cleanup window; `scripts/cleanup-retention.ts` honors saved items.

### Using File Store for Debugging

- `PIPELINE_STORE=file npm run build` or `node static-generator/generator.js --all --use-file-store`.

## GitHub Actions

The project uses GitHub Actions for automated deployment and other CI/CD tasks. The workflows are defined in the `.github/workflows` directory.

### Deployment Workflow

The deployment workflow (`.github/workflows/deploy.yml`) automates the process of building and deploying the static site:

1. Triggers on pushes to the main branch
2. Sets up Node.js environment
3. Installs dependencies
4. Fetches content from RSS feeds
5. Builds the static site
6. Deploys the built site to the hosting platform

### Ollama Integration

The project can use Ollama as a drop-in replacement for the OpenAI API in GitHub Actions:

- Allows running AI operations locally on GitHub runners
- Provides format translation between OpenAI and Ollama APIs
- No code changes needed - works as a drop-in replacement
- Configurable to use different models
- Reduces dependency on external API services

## How It Works (Pipeline)

1. Fetch sources (RSS + Google) → Feed items in DB (`feed_items`).
2. Extract article content → `extracted_contents`.
3. Process content (media detection/skip logic) → `processed_contents`.
4. AI summarize/score → `ai_analyses`.
5. Generate category reports → `reports` + `report_items`.
6. Generate HTML per user → `dist/<userSlug>/index.html` plus history pages under `dist/<userSlug>/reports/`.

Saved items live in `saved_items` and are excluded from retention cleanup. Retention window is governed by `RETENTION_MONTHS` and optional `expires_at` fields.

## License

MIT
