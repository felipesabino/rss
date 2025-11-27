# Per-user Static Output Structure

## Per-user Directory Layout
- Each user has a dedicated directory keyed by `userSlug`:
  - `dist/<userSlug>/index.html` – latest report and summary sections.
  - `dist/<userSlug>/styles.css` (or shared `dist/styles.css` if globally reused).
  - `dist/<userSlug>/assets/*` for user-specific images or static assets (optional).
  - Historical reports live under `dist/<userSlug>/reports/`.

## Naming Conventions for "userSlug"
- Lowercase kebab-case preferred; derive from `users.slug` in DB.
- Only allow `[a-z0-9-]`; replace spaces/underscores with `-`, trim leading/trailing `-`.
- Use the same slug in URLs, directory names, and any links from a global index.

## Historical Report URL Strategy
- Save each report as `dist/<userSlug>/reports/<reportId>.html`, where `<reportId>` is the DB `reports.id` (UUID) to guarantee uniqueness.
- Optionally add a timestamp-friendly alias alongside the UUID (e.g., `YYYY-MM-DD-HHMM.html`) for human readability.
- Link from `dist/<userSlug>/index.html` to historical pages via a "Previous reports" section, sorted by `generatedAt` desc.

## Optional Global Index Page
- `dist/index.html` can list public users (`users.isActive` && not hidden), linking to `/<userSlug>/`.
- Include a short description per user (display name or email) and last run timestamp if available.
- When generating the global index, read user slugs from the DB and ensure the link targets the per-user index pages.
