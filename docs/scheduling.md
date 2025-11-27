# Scheduling Multi-User Pipeline Runs

## Running Pipeline for All Users
- Default store is DB-backed; ensure `DATABASE_URL` is configured and migrations applied (`npm run db:migrate`).
- Fetch active users from the `users` table and run all steps per user:
  ```bash
  npm run build -- --all-users
  ```
- To run specific steps for all users (e.g., steps 1-5 only):
  ```bash
  tsx static-generator/generator.ts --all-users --step1 --step2 --step3 --step4 --step5
  ```
- If you need a single user run, pass `--user-id <id>` (default: `default`).

## Example Cron/CI Schedule
- **Hourly refresh** (all users, full pipeline):
  ```bash
  PIPELINE_STORE=db npm run build -- --all-users
  ```
- **Skip HTML generation to save time** (steps 1–5):
  ```bash
  PIPELINE_STORE=db tsx static-generator/generator.ts --all-users --step1 --step2 --step3 --step4 --step5
  ```
- In CI, ensure the Postgres service is healthy before running and load env (`.env`).
