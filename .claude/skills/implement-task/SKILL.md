---
name: implement-task
description: 'Execute an approved plan from documents/plans/ — senior-engineer implements the senior tasks directly, junior-engineer implements the junior tasks (parallelized across non-overlapping files), then tech-writer handles documentation tasks. Updates the plan file Status and appends a Completion Log when done. Use when: a plan file exists in documents/plans/ and is ready to be built, resuming a partially-implemented plan, or after create-plan has produced an approved plan. Asks which plan file if not given.'
argument-hint: 'Path to a plan file in documents/plans/ (e.g. documents/plans/dark-mode.md), or just the plan slug/title'
---

# Implement Task

## Purpose
Execute a plan that `create-plan` already produced and the user already approved — without re-planning or re-asking for approval. This is step 2 of the `create-plan` → `implement-task` → `code-review` workflow.

## When to Use
- A plan file exists at `documents/plans/<slug>.md` with `Status: Ready for implementation` and the user wants it built.
- A previous implement-task run was interrupted and needs to resume/finish.
- The user wants to re-run a plan that was already marked `Implemented` (confirm first — see Step 1).

This skill does **not** enter Plan Mode — planning and approval already happened in `create-plan`. It goes straight to execution.

---

## Procedure

### Step 1 — Load the Plan

Resolve `$ARGUMENTS` to a plan file:
- If it's a path under `documents/plans/`, `Read` it directly.
- If it's a slug/title (not a path), `Glob` `documents/plans/*.md` and match by filename or `# Plan:` title. If more than one match, ask the user via `AskUserQuestion`.
- If `$ARGUMENTS` is empty, `Glob` `documents/plans/*.md`, list the candidates (prefer ones with `Status: Ready for implementation`), and ask the user which one via `AskUserQuestion`.

Read the plan in full. Check the `Status:` line:
- If it already reads `Implemented`, ask the user (one question) whether to re-run it, treat it as a fresh plan, or cancel — don't silently redo completed work.

Parse out:
- `## Goal` and `## Approach` (context to pass to every agent)
- The three task lists under `### Senior`, `### Junior`, `### Documentation`
- `## Files / Components Touched`

If any of those sections are missing or empty, treat that step as a no-op (skip it) rather than guessing content.

### Step 2 — senior-engineer: Senior Tasks

If the Senior task list is non-empty, invoke the `senior-engineer` subagent:
- Give it the plan's Goal, Approach, and the specific Senior task items.
- Instruct it explicitly: "Implement this now — the plan is already approved. Do not re-plan or ask for approval."
- Ask it to report back: what it changed, any deviations from the plan, and any additional scoped work it surfaces that belongs in the Junior list.

If the Senior list is empty, skip this step.

### Step 3 — junior-engineer: Junior Tasks

Combine the plan's Junior task list with anything senior-engineer surfaced in Step 2. For each task, invoke `junior-engineer` with the task text, the relevant file paths, and a reminder to match existing code style.

- Group tasks by file overlap: dispatch tasks touching disjoint files in parallel (one message, multiple `Agent` calls).
- Run tasks that touch the same file sequentially, so edits don't clobber each other.
- Collect each agent's completion summary.

If the combined Junior list is empty, skip this step.

### Step 4 — tech-writer: Documentation Tasks

If the Documentation task list is non-empty, invoke `tech-writer`:
- Give it the plan's Goal/Approach plus a consolidated summary of what was *actually* built in Steps 2-3 (not the original plan text — implementation may have deviated).
- It updates the user manual section, writes a changelog entry, and adds doc comments per its own rules.

If the Documentation list is empty, skip this step.

### Step 5 — Update the Plan File

`Edit` the plan file:
- Change `Status: Ready for implementation` to `Status: Implemented`.
- Append a `## Completion Log` section:

```markdown
## Completion Log
Date: <YYYY-MM-DD>
- Senior: <what senior-engineer did, or "none">
- Junior: <what junior-engineer did, per task, or "none">
- Documentation: <what tech-writer did, or "none">
Deviations / flags: <anything that didn't match the original plan, or "none">
Files changed: <list, from agent summaries or git status/diff>
```

### Step 6 — Summary

Report to the user:
- Plan file path and its updated status.
- Task counts completed (senior / junior / doc).
- Files actually changed.
- Any deviations or flags raised by an agent.
- Suggest running `code-review` next.

---

## Guardrail
If, mid-implementation, a task turns out far bigger than its scoped description (e.g. a "junior" task actually requires architectural decisions), stop and flag it to the user rather than silently expanding scope or having junior-engineer improvise architecture.
