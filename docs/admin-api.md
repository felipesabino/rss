# Creating Users
- Use the admin CLI to upsert users:
  ```
  npx ts-node scripts/admin-user-cli.ts user create --id demo --slug demo --email demo@example.com
  ```
- Flags:
  - `--id` (required): canonical user id.
  - `--slug` (optional): public slug (defaults to id).
  - `--email` (optional).
  - `--inactive` to mark the user inactive.
- List users:
  ```
  npx ts-node scripts/admin-user-cli.ts user list
  ```

# Managing Sources
- Add or update a source for a user (upserts on user/type/url/query):
  ```
  npx ts-node scripts/admin-user-cli.ts source add \
    --user-id demo \
    --type rss \
    --name "Hacker News" \
    --url https://news.ycombinator.com/rss \
    --categories tech,startups \
    --language en
  ```
- Google search sources use `--type google` with `--query` instead of `--url`.
- List sources for a user:
  ```
  npx ts-node scripts/admin-user-cli.ts source list --user-id demo
  ```
- Delete a source:
  ```
  npx ts-node scripts/admin-user-cli.ts source delete --id <source-config-id>
  ```

# Example Calls/Commands
- Seed a demo user then add a feed:
  ```
  npx ts-node scripts/admin-user-cli.ts user create --id demo --slug demo --email demo@example.com
  npx ts-node scripts/admin-user-cli.ts source add --user-id demo --type rss --name "Example" --url https://example.com/rss
  ```
- Inspect recent pipeline runs:
  ```
  npx ts-node scripts/admin-user-cli.ts runs list --user-id demo
  ```
- After updating sources, run the pipeline for the user:
  ```
  node static-generator/generator.js --all --user-id demo
  ```
