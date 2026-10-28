# Claude Code Guide — project_myps

## Dev workflow

This repo uses a 4-step pipeline for non-trivial work. Run them in order:

1. **`/create-plan <idea or path to ticket/doc>`** — produces an approved plan at `documents/plans/<slug>.md` (Goal, Acceptance Criteria, Approach, Tasks split into Senior/Junior/Documentation, Files Touched, Risks). No code is written in this step.
2. **`/implement-task <path to plan>`** — executes that plan: `senior-engineer` agent does the architectural tasks, `junior-engineer` does the scoped tasks, `tech-writer` handles docs. Marks the plan `Status: Implemented` with a Completion Log.
3. **`/code-review`** (built-in skill) — review the resulting diff for correctness/cleanup. Check it against the plan's Acceptance Criteria checklist manually; there is no separate project-specific code-review skill — the built-in one covers this, so don't recreate it.
4. **`/create-pr-issue [issue #]`** — opens the GitHub PR (`MYPS-Org/myps`). The UAT issue's test cases become the PR's Acceptance Criteria checklist. It asks Draft vs Ready and whether to write/run an e2e spec, and shows the title/body for approval before pushing.

Skip step 1-2 for trivial changes (typo fixes, single-line tweaks) — go straight to editing, `/code-review` and `/create-pr-issue`.

## Local secrets

The repo is public, so no password is committed. Tracked config holds `***REMOVED***` placeholders; the real values live in gitignored files on each machine:

- **Main API** — `Main/appsettings.{Environment}.Local.json` (`appsettings.Local.json` for Production), loaded last by `Program.cs`. Start from `Main/appsettings.Local.example.json`. The machine that publishes needs the file for the target environment; publish copies it.
- **CrystalReportService** — `CrystalReportService/connectionStrings.config`, loaded by `Web.config` via `configSource`. Start from `connectionStrings.example.config`. The service won't start without it.
- **e2e** — `e2e/.env`, from `e2e/.env.example`.

Never put a real password in a tracked file, doc, plan or `.claude/settings.json`.

See `FE/CLAUDE.md` for frontend-specific conventions (HTTP/error handling, date inputs, validation patterns).

See `e2e/CLAUDE.md` for Playwright test conventions and route/coverage context.
