# AGENTS.md — Codex for AI Agents Working on This Project

Welcome, agent.  
This document defines **how you should work on this repository**, **how to interpret tasks**, and **how to keep behavior consistent** as you implement the current plan and future features.

The goal is that **any agent** (now or later) can pick up this project and continue work safely and predictably.

---

## 1. Project Purpose & High-Level Architecture

### 1.1 What This Project Does

This project is a **static generator** that:

1. Ingests:
   - RSS feeds
   - Google Custom Search results
2. Runs a **multi-step content pipeline**:
   - **Step1**: Fetch sources, normalize items → `raw feeds`
   - **Step2**: Extract article content → `extracted content`
   - **Step3**: Classify/mark items (e.g. `shouldSkipAI`) → `processed content`
   - **Step4**: Call OpenAI to summarize & score content → `AI results`
   - **Step5**: Generate category-based reports → `reports + scoring audit`
   - **Step6**: Render static HTML → `dist/index.html` (current) or `dist/<userSlug>/...` (future)
3. Uses:
   - `config/sources.ts` for current single-tenant sources (to be migrated to DB)
   - `config/category-prompts.ts` for category-specific prompts
   - `config/constants.ts` for parsing/skip logic
4. Currently:
   - Single-tenant
   - Uses `.cache/*.json` for intermediate data
   - Produces a single `dist/index.html`

### 1.2 Target State

The **target architecture** is:

- **Multi-tenant (per user)**:
  - Each user has their own sources (RSS + search queries).
  - Each user gets their own reports and static HTML front page.
- **Database-backed**:
  - All pipeline data stored in a relational DB (e.g. Postgres).
  - JSON `.cache/` becomes an implementation detail or debug option.
- **Retention-aware**:
  - Data older than N months is automatically deleted.
  - Users can **save items** that are exempt from deletion.
- **Static HTML per user**:
  - `dist/<userSlug>/index.html` → latest report.
  - `dist/<userSlug>/reports/...` → historical reports.
- **Auditable**:
  - Each pipeline run is tracked (PipelineRun).
  - Scoring and summarization decisions are traceable.

---

## 2. Task System & Execution Loop

All work is defined as **structured tasks** (JSON format).  
Each task has: `id`, `title`, `description`, `context`, `dependencies`, `artifacts`, `commands`, `verification`, `status`.

### 2.1 Core Rule

> **Never stop until all tasks are either `complete` or explicitly marked as `blocked`/`needs-human`.**

If you are an orchestrating agent, your main loop is:

1. **Load the tasks JSON** (the execution plan).
2. **Find the next task** with:
   - `status === "pending"` AND  
   - All `dependencies` are `complete`.
3. **Execute the task**:
   - Read `description` and `context` carefully.
   - Modify code/docs/config as needed.
   - Run listed `commands` when possible.
4. **Run verification**:
   - Use the `verification` checklist as acceptance criteria.
5. **Update status**:
   - `complete` if all verification checks pass.
   - `blocked` if an external dependency (e.g. credentials, infra) is missing.
   - `needs-human` if the requirements are ambiguous or conflicting.
6. **Repeat** until:
   - No tasks remain with `status === "pending"` AND  
   - You’ve tried to resolve or mark blocked ones properly.

---

## 3. Task Interpretation Guidelines

When working on a task:

### 3.1 Respect Context

- Always read the task’s `context` **before** editing anything.
- If the task references other docs (e.g. `docs/data-model.md`, `docs/baseline.md`), **read those** too.
- Never assume behavior; derive it from:
  - Existing code
  - Baseline docs
  - Data model docs

### 3.2 Artifacts

For each entry in `artifacts`:

- If `required: true`, the file **must exist** when the task is complete.
- If `must_use_interface` or `must_support_flags` is specified:
  - Ensure the code adheres to that requirement.
- If `must_not_import` is specified:
  - Ensure that import is truly removed/replaced.

### 3.3 Commands

- If a command is **not** marked `optional`, run it if your environment allows it.
- Use command results for verification:
  - e.g. `npm run build`, `npm run db:migrate`, tests, etc.

### 3.4 Verification

- Treat each line under `verification` as a **checklist**.
- A task is only `complete` when all applicable checks are true.
- If a check cannot be completed due to missing environment (e.g. no DB), mark the task as:
  - `blocked` and clearly describe what’s missing.

---

## 4. Execution Order (High-Level)

Assume that some tasks are already done.  
A simplified logical order:

1. **Task 2–5**: Data model & DB scaffolding
2. **Task 6–8**: PipelineStore abstraction and DB as default storage
3. **Task 9–11**: Multi-tenancy (userId, sources in DB, all-users run)
4. **Task 12–14**: Static HTML per user + history
5. **Task 15–17**: Retention metadata, cleanup, indexes
6. **Task 18–19**: Saved items & UI
7. **Task 20**: Minimal admin interface

Always respect each task’s `dependencies` field; do not reorder arbitrarily.

---

## 5. Coding & Design Conventions

### 5.1 Language & Stack

- **Language**: TypeScript (Node.js)
- **Style**:
  - Prefer modern ES modules where applicable.
  - Use async/await for async flows.
- **Linting/Formatting**:
  - Follow any existing ESLint/Prettier setup.
  - If adding new tooling, document it.

### 5.2 Pipeline Design

- Steps **must remain composable** and individually runnable via CLI flags.
- Steps must not make hidden assumptions about global state.
- When injecting new dependencies (e.g., `PipelineStore`, `userId`, `runId`), prefer:
  - Explicit parameters
  - Or a small, typed context object

### 5.3 Database & ORM

- Use the **chosen ORM** from `docs/database-choice.md` consistently.
- Always:
  - Create migrations for schema changes.
  - Document any schema change impact on behavior.
- For new entities:
  - Update `docs/data-model.md`.
  - Add appropriate indexes if queries will rely on them.

### 5.4 Backwards Compatibility

Unless a task explicitly allows breaking changes:

- Do **not** remove existing behavior until:
  - The replacement is fully implemented, **and**
  - Tests and verification steps pass.
- Maintain compatibility during transitions:
  - e.g., FilePipelineStore should still work as a fallback.
  - Default user (`id="default"`) must preserve old behavior where needed.

---

## 6. Multi-Tenancy & Data Integrity

### 6.1 User Isolation

- **Never mix data between users**.
- All user-scoped tables must:
  - Have a `userId` column, or
  - Be reachable via a chain that includes `userId` (e.g., via `PipelineRun`).
- When fetching:
  - Always filter by `userId` (and other relevant constraints).

### 6.2 Saved Items & Retention

- Items marked as saved must **not** be deleted by retention.
- If you implement new retention rules, always verify:
  - Saved items, and their ancestors (FeedItem, ReportItem, etc.), remain intact.

---

## 7. Static HTML Output

### 7.1 Output Structure

Follow `docs/output-structure.md` for:

- How to map `userSlug` → directory.
- How to name historical report pages.
- Where to place global index (if used).

### 7.2 Template Behavior

- Preserve the general **brutalist design** and UX choices unless a task says otherwise.
- When adding new sections (e.g., “Saved Items”, “Previous Reports”):
  - Keep the template logic simple.
  - Avoid breaking existing front-end UI features (filters, toggles).

---

## 8. Logging, Errors & Observability

- Prefer **clear, structured logs**:
  - e.g. `console.log("[Step3][user=default][run=abc123] ...")`
- When failing:
  - Fail fast with a helpful message.
  - Do not silently swallow errors, especially in DB or pipeline steps.
- When adding background scripts (cleanup, seeding):
  - Log start/end, number of records affected, and any anomalies.

---

## 9. Adding New Features in the Future

When implementing **new features**, follow this approach:

1. **Create a new task** in the existing task JSON format:
   - `id`, `title`, `description`, `context`, `dependencies`, `artifacts`, `commands`, `verification`, `status`.
2. Ensure:
   - `context` explains how the new feature fits the larger system.
   - `verification` is concrete and testable.
3. Update documentation:
   - `docs/data-model.md` (if DB schema changes).
   - `docs/output-structure.md` (if output layout changes).
   - `docs/admin-api.md` or others (if admin surface changes).
4. Prefer **small, incremental tasks** over giant ones.

---

## 10. When You Encounter Ambiguity

If you, as an agent, find:

- Conflicting requirements  
- Missing context that makes decisions unsafe  
- External dependencies you cannot simulate (e.g., API keys)  

Then:

1. **Do not guess blindly** if it would cause irreversible changes or data loss.
2. Mark task `status` as `"needs-human"` or `"blocked"` with a short explanation:
   - What is ambiguous
   - What decision options exist
   - What information is needed
3. Still complete any **safe** subtasks that are unambiguous.

---

## 11. Summary of Agent Responsibilities

As an AI agent working on this project, you must:

1. **Follow the task plan** strictly, respecting dependencies and verification criteria.
2. **Maintain system behavior** at all times unless explicitly allowed to break it.
3. **Keep changes auditable** via docs and schema updates.
4. **Ensure multi-tenancy and data isolation** are never compromised.
5. **Continue executing tasks** until:
   - All are `complete`, or
   - Blocked/needs-human tasks have clear reasons documented.

If you adhere to this codex, any future agent will be able to continue your work seamlessly.

---
