---
name: implement-task
description: 'Execute an approved plan from documents/plans/ directly in the main conversation. Updates the plan file Status and appends a Completion Log when done. Use when: a plan file exists in documents/plans/ and is ready to be built, resuming a partially-implemented plan, or after create-plan has produced an approved plan. Asks which plan file if not given.'
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
- `## Goal` and `## Approach` (context to hold through the rest of the work)
- The task lists under `### Implementation` and `### Documentation`
- `## Files / Components Touched`

If any of those sections are missing or empty, treat that step as a no-op (skip it) rather than guessing content.

If the plan still uses the old `### Senior` / `### Junior` / `### Documentation` split (from before this workflow moved to inline execution), just treat Senior+Junior as one combined Implementation list.

### Step 2 — Implement

Work through the Implementation task list directly (no subagent delegation) — the plan is already approved, so implement now without re-planning or asking for approval again. Match the existing code style in each file you touch (`Read` before `Edit`). If a task turns out far bigger than its scoped description (e.g. it actually requires new architectural decisions not covered in the Approach), stop and flag it to the user rather than silently expanding scope.

Track any deviations from the plan and any additional scoped work that surfaces along the way — you'll need this for the Completion Log and for Step 3.

### Step 3 — Documentation

If the Documentation task list is non-empty, do it now: update the relevant user manual section, write a changelog entry, and add/update doc comments (JSDoc for JS/TS, XML docs for C#, PHPDoc for PHP) for anything non-obvious you touched in Step 2. Base this on what was *actually* built in Step 2, not the original plan text — implementation may have deviated. Write for the audience the doc is for (end users for the manual, developers for inline comments); don't restate what the code does when the identifier names already make it obvious.

If the Documentation list is empty, skip this step.

### Step 4 — Update the Plan File

`Edit` the plan file:
- Change `Status: Ready for implementation` to `Status: Implemented`.
- Append a `## Completion Log` section:

```markdown
## Completion Log
Date: <YYYY-MM-DD>
- Implementation: <what was done, or "none">
- Documentation: <what was done, or "none">
Deviations / flags: <anything that didn't match the original plan, or "none">
Files changed: <list, from git status/diff>
```

### Step 5 — Summary

Report to the user:
- Plan file path and its updated status.
- Task counts completed (implementation / documentation).
- Files actually changed.
- Any deviations or flags raised during implementation.
- Suggest running `code-review` next.

---

## Guardrail
If, mid-implementation, a task turns out far bigger than its scoped description, stop and flag it to the user rather than silently expanding scope or improvising architecture.
