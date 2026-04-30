# Update MD

Audit and update this repo's `CLAUDE.md` so it accurately reflects the current state of the codebase.

This command is **scoped to this repo only**: the `customer-ui` Next.js 15 dashboard for the Blink platform. The target file is `./CLAUDE.md` at the repo root.

## Instructions

You MUST follow these steps in order:

### 1. Read the current CLAUDE.md

Read `./CLAUDE.md` end-to-end. Note the sections it currently documents (e.g. tech stack, key routes, conventions, dev commands) and the exact tone/format used. You will preserve that style.

### 2. Survey the current state of the repo

Gather the ground truth to compare against. Run these in parallel:

- `git log --oneline -20` — recent commits to spot what's shipped recently
- `ls src/app` and `ls src/app/api` — top-level routes and API surface
- `cat package.json` — dependencies, scripts, Node/Next versions
- `grep -rn "process.env\." src --include='*.ts' --include='*.tsx' | sort -u` — env var usage
- For any "Key Routes" or "Conventions" tables in CLAUDE.md, spot-check the referenced files actually exist and behave as described (read the relevant files)

If CLAUDE.md mentions a specific helper, constant, or convention (e.g. `QUICKNODE_APP_ORIGINATOR_IDS`, `auction_expiry_ms` plan mapping), grep for it and confirm the documented values match the code.

### 3. Identify drift

Build a list of concrete drift items. For each, write down: **what CLAUDE.md says** vs. **what the code actually does**. Drift to look for:

- **Routes**: API routes or pages added/removed/renamed since CLAUDE.md was last updated
- **Env vars**: new `process.env.*` references not documented, or documented vars no longer used
- **Dependencies / tech stack**: framework or library version bumps, new major dependencies
- **Dev commands**: scripts in `package.json` that don't match the documented commands, or a port change
- **Conventions / constants**: documented values (e.g. plan IDs, originator addresses, magic numbers) that have drifted from `src/lib/constants.ts` or similar
- **Auth / data flow**: meaningful changes to how auth, originator resolution, or Databricks queries work

Skip ephemeral things: in-flight feature work, recent bug fixes, individual PR details. CLAUDE.md is a stable map of the repo, not a changelog.

### 4. Propose the changes

Show the user a concise diff plan:
- Bullet list of each drift item: `<section>: <current text>` → `<proposed text>`, plus a one-line "why"
- For new sections, justify why they belong (something material is undocumented and would help a future reader / agent)

If the audit finds **no drift**, say so explicitly and stop — do not edit the file just to edit it.

Wait for the user to confirm before proceeding. The user may amend, drop items, or accept as-is.

### 5. Apply the edits

Use `Edit` (preferred) or `Write` to update `./CLAUDE.md`. Constraints:

- **Preserve the existing tone, headings, and formatting style.** Match the table format used elsewhere in the file. Don't introduce emoji, don't pad with prose.
- **Be terse.** CLAUDE.md is consumed by future agents under context pressure — every line must earn its place.
- **Keep stable structure stable.** Don't reshuffle sections that aren't drifting.
- **Don't add a changelog or "last updated" stamp.** Git history is authoritative for that.

### 6. Report

Print a short summary of what changed (one line per edit) and remind the user the file is now staged-ready but not yet committed. Do not commit on the user's behalf — they'll roll the update into whatever PR makes sense.
