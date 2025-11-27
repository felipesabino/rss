# Retention Policy
- Data older than `RETENTION_MONTHS` (default 6) is eligible for deletion. The cutoff is computed as `now - RETENTION_MONTHS`.
- Tables covered: `feed_items`, `extracted_contents`, `processed_contents`, `ai_analyses`, `reports`, and `report_items`.
- Items explicitly saved by users (`saved_items.feed_item_id`) and any associated content (analyses, processed/extracted rows, report items referencing those feed items) are preserved.
- Optional `expires_at` columns allow marking rows for earlier deletion; otherwise `created_at` / `generated_at` drive the cutoff. All rows keep `created_at`/`updated_at` metadata for auditing.

# How Cleanup Script Works
- Script: `scripts/cleanup-retention.ts`.
- Steps:
  1. Read `RETENTION_MONTHS` from `.env` (fallback 6) and compute the cutoff date.
  2. Fetch saved feed item IDs to build the protection set.
  3. Identify stale feed items (by `expires_at` or `created_at`) excluding saved IDs.
  4. Collect stale report items by age and any report items linked to feed items being removed, excluding those tied to saved feed items.
  5. Collect reports older than the cutoff, excluding any report that still references a saved feed item.
  6. Run a transaction that deletes in dependency order: `ai_analyses` → `processed_contents` → `extracted_contents` → `report_items` → `reports` → `feed_items`. Deletion counts are logged on completion.
- The script is idempotent: re-running it after a cleanup will remove nothing once the tables are already pruned.

# How to Schedule Cleanup
- Recommended cadence: daily or weekly via cron/CI.
- Example cron entry (runs daily at 03:00 UTC):
  ```
  0 3 * * * cd /path/to/repo && NODE_ENV=production RETENTION_MONTHS=6 npx ts-node scripts/cleanup-retention.ts >> /var/log/rss-retention.log 2>&1
  ```
- Ensure the process has `DATABASE_URL` and `RETENTION_MONTHS` set, and network access to the database.
