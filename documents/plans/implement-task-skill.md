# Plan: Create the `implement-task` skill

Status: Implemented
Created: 2026-06-25
Source: User request — "use /create-plan to create the implement-task skill"

## Goal
Add a second skill, `implement-task`, that executes a plan file produced by `create-plan` (senior-engineer for architectural tasks, junior-engineer for scoped tasks, tech-writer for docs), then records the outcome back into the plan file. This is step 2 of the `create-plan` → `implement-task` → `code-review` workflow.

## Approach
Create `.claude/skills/implement-task/SKILL.md`, matching the frontmatter/structure conventions of `create-plan` and `gap-analysis` (`name` + `description` + `argument-hint`, then `## Purpose` / `## When to Use` / `## Procedure`).

Procedure:
1. **Load the Plan** — resolve `$ARGUMENTS` to a path under `documents/plans/` (direct path or slug/title, falling back to `Glob` + `AskUserQuestion` if ambiguous/empty). Read it fully. If `Status` is already `Implemented`, confirm with the user before re-running. Parse the Senior/Junior/Documentation task lists and Files Touched.
2. **senior-engineer — Senior Tasks** — if non-empty, invoke `senior-engineer` with Goal/Approach plus those items, instructing it to implement directly now (execution, not planning). Ask for deviations and any newly-discovered junior-scoped work. Skip if empty.
3. **junior-engineer — Junior Tasks** — for the junior list (plus anything senior-engineer surfaced), invoke `junior-engineer` per task. Parallelize tasks touching disjoint files; run same-file tasks sequentially. Collect completion summaries.
4. **tech-writer — Documentation Tasks** — if non-empty, invoke `tech-writer` with Goal/Approach plus a consolidated summary of what was *actually* built (not the original plan text). Skip if empty.
5. **Update the Plan File** — flip `Status: Ready for implementation` → `Implemented`, append a `## Completion Log` (date, who did what, deviations, files changed).
6. **Summary** — report plan path, status change, task counts, files changed, open flags, suggest running `code-review` next.

Guardrail: if a task balloons beyond its scoped description mid-implementation, pause and flag the user instead of silently expanding scope.

Unlike `create-plan`, this skill does not invoke `EnterPlanMode` — the plan was already approved upstream.

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- Write the full `.claude/skills/implement-task/SKILL.md` content (procedure steps, agent-handoff wording, plan-file parsing/update logic) — this is the entire deliverable and requires matching cross-skill conventions, so it's done directly rather than split out.

### Junior (precise, scoped — delegate to junior-engineer)
- (none — single self-contained file, no boilerplate/repetitive sub-tasks to scope out)

### Documentation (tech-writer)
- (none — the skill file itself is self-documenting; no user manual or changelog entry needed for an internal dev-tooling skill)

## Files / Components Touched
- `.claude/skills/implement-task/SKILL.md` (new)

## Risks / Open Questions / Assumptions
- Assumes `documents/plans/` is the sole source of plan files (matches `create-plan`'s output location).
- Assumes plan files reliably follow the exact section headers create-plan emits (`### Senior`, `### Junior`, `### Documentation`, `Status:` line) — implement-task's parsing step depends on that format staying stable.

## Completion Log
Date: 2026-06-25
- Senior: Wrote `.claude/skills/implement-task/SKILL.md` directly (sole deliverable; no architectural split needed) — done inline in this session rather than via a dispatched senior-engineer agent, since `implement-task` didn't exist yet to drive its own bootstrap and the task was a single self-contained file matching an already-established convention (`create-plan`).
- Junior: none.
- Documentation: none (internal dev-tooling skill, no user-facing manual/changelog entry).
Deviations / flags: Implemented directly in the main conversation instead of spawning the `senior-engineer` subagent, since this specific task (creating `implement-task` itself) is the chicken-and-egg case the skill exists to solve — future runs of `implement-task` against other plans will follow the real Step 2-4 agent pipeline as written.
Files changed: `.claude/skills/implement-task/SKILL.md` (new), `documents/plans/implement-task-skill.md` (this file).
