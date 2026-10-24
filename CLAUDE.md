# Claude Code Guide — project_myps

## Dev workflow

This repo uses a 4-step pipeline for non-trivial work. Run them in order:

1. **`/create-plan <idea or path to ticket/doc>`** — produces an approved plan at `documents/plans/<slug>.md` (Goal, Acceptance Criteria, Approach, Tasks split into Senior/Junior/Documentation, Files Touched, Risks). No code is written in this step.
2. **`/implement-task <path to plan>`** — executes that plan: `senior-engineer` agent does the architectural tasks, `junior-engineer` does the scoped tasks, `tech-writer` handles docs. Marks the plan `Status: Implemented` with a Completion Log.
3. **`/code-review`** (built-in skill) — review the resulting diff for correctness/cleanup. Check it against the plan's Acceptance Criteria checklist manually; there is no separate project-specific code-review skill — the built-in one covers this, so don't recreate it.
4. **`/create-pr-issue [issue #]`** — opens the Gitea PR. The UAT issue's test cases become the PR's Acceptance Criteria checklist. It asks Draft (`WIP:`) vs Ready and whether to write/run an e2e spec, and shows the title/body for approval before pushing.

Skip step 1-2 for trivial changes (typo fixes, single-line tweaks) — go straight to editing, `/code-review` and `/create-pr-issue`.

See `FE/CLAUDE.md` for frontend-specific conventions (HTTP/error handling, date inputs, validation patterns).

See `e2e/CLAUDE.md` for Playwright test conventions and route/coverage context.
