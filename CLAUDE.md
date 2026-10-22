## Project tracking (Obsidian vault)

This project is tracked in an Obsidian vault. Its notes live in **`/Users/felipesabino/projects/vault/vault/Projects/rss-feed/`**, which is the vault folder for "RSS Feed". The vault root is `/Users/felipesabino/projects/vault/vault`; wikilink paths are relative to it.

### Scope (hard rules)
- Read and write **only** inside `/Users/felipesabino/projects/vault/vault/Projects/rss-feed/`. Never create, edit, move or delete anything elsewhere in the vault. That includes other projects, `Daily/`, `Home.md`, `Inbox.md`, `Admin/`, `_system/` and `.obsidian/`.
- Never delete or rename vault files. If something is obsolete, say so, or mark it with a `> [!warning] Obsolete` callout.
- Don't change the `status` or `priority` properties unless asked.
- Code-level tasks stay in this repo. The vault tracks macro status, feature progress, decisions, manual tasks and ideas.

### Files
| File | Purpose | How to update |
|---|---|---|
| `STATUS.md` | Hub: properties + Now / Next / Blocked / Tasks / Decisions / Notes | Edit in place, keep it short and current |
| `LOG.md` | Work log, newest first | Add bullets under today's `## YYYY-MM-DD` heading (create it at the top if missing) |
| `IDEAS.md` | Brainstorm for this project | Append bullets |
| `notes/` | Long-form notes: research, design, specs, findings | One topic per kebab-case file |

### Session routine
1. **Start:** read `STATUS.md` and the latest 2–3 entries of `LOG.md` before planning.
2. **End, or after a meaningful milestone:**
   - `LOG.md`: add one-line, past-tense outcome bullets under today's heading. Put detail in nested bullets.
   - `STATUS.md` properties: set `updated` to today and rewrite `next_action` as one concrete next step. Update `features`: one entry per feature or epic (`name`, `state: todo|wip|done`, `done`, `total`, `spec`). Count `done`/`total` from the checkboxes in the repo's issue/spec Markdown.
   - `STATUS.md` body: refresh Now / Next / Blocked. Add decisions as `- YYYY-MM-DD — decision — why`.
   - Things only Felipe can do (pay, sign, register, cancel, buy, reply, decide) go under `## Tasks` as Tasks-plugin lines, with a due date when there is a deadline.
   - Ideas not being acted on now go in `IDEAS.md`.

### Obsidian conventions
- **Properties:** keep existing frontmatter keys and types. Dates are unquoted `YYYY-MM-DD`; lists are YAML lists. Add no new keys to `STATUS.md` except inside `features`.
- **Wikilinks, not Markdown links,** for vault content, always with a vault-relative path and an alias: `[[Projects/rss-feed/notes/caching-strategy|caching strategy]]`. Heading links: `[[Projects/rss-feed/STATUS#Decisions|decisions]]`. Embeds: `![[Projects/rss-feed/notes/architecture#Overview]]`. Bare `[[STATUS]]` is ambiguous because every project has one.
- **New notes** go in `notes/` with this frontmatter: `type: note`, `project: "[[Projects/rss-feed/STATUS|RSS Feed]]"`, `created: YYYY-MM-DD`, `tags: []`, `aliases: []`. End each note with a `## See also` list of related wikilinks. Link every new note from `STATUS.md` or a `LOG.md` entry so nothing is orphaned. Search `notes/` first and extend an existing note instead of duplicating it.
- **Repo references:** use inline code paths (`docs/issues/checkout.md`) or GitHub URLs. Never copy repo task lists into the vault; link and summarise them.
- **Tags:** sparingly and lowercase: `#decision`, `#blocked`, `#research`, `#idea`. Don't tag with the project name; the folder already identifies it.
- **Callouts** for things that must stand out: `> [!warning] Blocked`, `> [!question] Open question`, `> [!tip]`, `> [!summary]`. Use `%% … %%` for non-rendered comments. Mermaid diagrams are welcome.
- Never edit the fenced `dataview` or `tasks` query blocks.

### Task syntax (Obsidian Tasks + Reminder plugins)
- Order: description, tags, optional ⏰ reminder, 📅 due, then other fields. Example: `- [ ] Renew domain for RSS Feed #admin ⏰ 2026-11-01 09:00 📅 2026-11-03 ⏫`
- 📅 due · ⏳ scheduled · 🛫 start · 🔁 recurrence (`every month on the 5th`) · priority 🔺 ⏫ 🔼 🔽 · ✅ done date.
- ⏰ triggers a macOS notification and must sit directly before 📅. Without it, the reminder fires at 09:00 on the due date.
- To complete a task, change it to `- [x]` and append `✅ YYYY-MM-DD`. **Never complete 🔁 recurring tasks.**
- Never write a `- [ ]` line as an example or placeholder, even in comments: the Reminder plugin would fire on it.
