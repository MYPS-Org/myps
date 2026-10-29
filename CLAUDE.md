# Claude Code Guide — project_myps

## Dev workflow

This repo uses a 4-step pipeline for non-trivial work. Run them in order:

1. **`/create-plan <idea or path to ticket/doc>`** — produces an approved plan at `documents/plans/<slug>.md` (Goal, Acceptance Criteria, Approach, Tasks split into Senior/Junior/Documentation, Files Touched, Risks). No code is written in this step.
2. **`/implement-task <path to plan>`** — executes that plan: `senior-engineer` agent does the architectural tasks, `junior-engineer` does the scoped tasks, `tech-writer` handles docs. Marks the plan `Status: Implemented` with a Completion Log.
3. **`/code-review`** (built-in skill) — review the resulting diff for correctness/cleanup. Check it against the plan's Acceptance Criteria checklist manually; there is no separate project-specific code-review skill — the built-in one covers this, so don't recreate it.
4. **`/create-pr-issue [issue #]`** — opens the GitHub PR (`MYPS-Org/myps`). The UAT issue's test cases become the PR's Acceptance Criteria checklist. It asks Draft vs Ready and whether to write/run an e2e spec, and shows the title/body for approval before pushing.

Skip step 1-2 for trivial changes (typo fixes, single-line tweaks) — go straight to editing, `/code-review` and `/create-pr-issue`.

## Changelogs

Every change to app behaviour gets a release note in `docs/changelogs/` (newest `v*.md` marked `(not yet released)`, or the next version file). The top bar's **Changelogs** button shows these files to every user, so write them in their plain, user-facing style. Follow `.claude/skills/update-changelogs/SKILL.md`. A Stop hook (`.claude/hooks/changelog-reminder.mjs`) will not let a session finish with app code changed and no release note, and the deploy workflow warns about pushes without one.

## Local secrets

The repo is public, so no password is committed. Tracked config holds `***REMOVED***` placeholders; the real values live in gitignored files on each machine:

- **Main API** — `Main/appsettings.{Environment}.Local.json` (`appsettings.Local.json` for Production), loaded last by `Program.cs`. Start from `Main/appsettings.Local.example.json`. The machine that publishes needs the file for the target environment; publish copies it.
- **CrystalReportService** — `CrystalReportService/connectionStrings.config`, loaded by `Web.config` via `configSource`. Start from `connectionStrings.example.config`. The service won't start without it.
- **e2e** — `e2e/.env`, from `e2e/.env.example`.

Never put a real password in a tracked file, doc, plan or `.claude/settings.json`.

## Online test site (MonsterASP)

`https://myps.tryasp.net`, deployed by `.github/workflows/deploy-monsterasp.yml` on every push to main. Its `appsettings.Local.json` comes from the `APPSETTINGS_LOCAL_JSON` secret in the `myps_environment` GitHub environment: database `db76600`, `PIS:Disabled: true` (it must never contact DPWH's PIS) and `LocalLogin` with PBKDF2 hashes (`Helpers/LocalPassword.cs`) for its test accounts. PDF reports don't work there (no Crystal report service). If it answers "500.30 app failed to start", the page shows the startup error (the workflow sets `ASPNETCORE_DETAILEDERRORS`), and the console output is in `wwwroot\logs\stdout_*.log` (MonsterASP File Manager).

See `FE/CLAUDE.md` for frontend-specific conventions (HTTP/error handling, date inputs, validation patterns).

See `e2e/CLAUDE.md` for Playwright test conventions and route/coverage context.
