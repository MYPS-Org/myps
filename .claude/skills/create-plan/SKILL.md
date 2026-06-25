---
name: create-plan
description: 'Turn a feature idea, ticket, or reference doc into a structured implementation plan via Plan Mode and the senior-engineer agent, then persist it to documents/plans/ for implement-task to pick up later. Use when: starting new work that needs a plan before any code is written, turning a feature idea or gap-analysis finding into an actionable plan, or refreshing an existing plan file. Asks for the task description or source file if not given.'
argument-hint: 'Description of the feature/task to plan, OR a path to a reference doc (e.g. a gap analysis finding, ATP section, ticket)'
---

# Create Plan

## Purpose
Produce a reviewed, approved, file-backed implementation plan — without writing or changing any application code. This is step 1 of the `create-plan` → `implement-task` → `code-review` workflow. The output is consumed later by `implement-task`.

## When to Use
- The user brings a new feature idea, bug, or task that needs a plan before code is touched.
- The user points at a reference document (gap analysis report, ATP section, ticket text) that should become an actionable plan.
- An existing plan in `documents/plans/` needs to be refreshed after requirements changed.

---

## Procedure

### Step 1 — Gather Input

Look at `$ARGUMENTS`:
- If it looks like a file path, `Read` that file in full and treat its contents as the task source. If the doc already has an "Acceptance Criteria" / "AC" section, capture it verbatim as the source of truth — don't re-derive it from scratch later.
- If it's free text, treat it as the task description directly.
- If `$ARGUMENTS` is empty, ask the user (one question): what they want planned, and whether it's backed by a doc/ticket to read first.

If the request is vague (no clear scope, unclear which module/files are affected, or too thin to derive meaningful Acceptance Criteria from), ask ONE clarifying question before proceeding — including asking the engineer to state their own AC if the prompt genuinely doesn't give enough to infer testable criteria. Don't ask more than one round — make reasonable assumptions and state them in the plan instead.

### Step 2 — Enter Plan Mode

Call `EnterPlanMode` before any exploration finishes shaping into a final plan. This ensures nothing gets written until the user explicitly approves.

### Step 3 — Delegate Analysis to senior-engineer

Invoke the `senior-engineer` subagent. Brief it clearly that this is a **planning-only** call:
- Give it the task description / source doc contents and relevant file paths you already know.
- Explicitly instruct: "Produce a plan only. Do NOT write, edit, or implement anything. Do NOT call Write/Edit/Bash for code changes."
- If the source ticket already had an AC section, pass it along and instruct senior-engineer to refine/complete it rather than replace it. Otherwise, instruct it to draft Acceptance Criteria from the task description: one user-story framing line (`As a <role>, I want <goal>, so that <benefit>`) plus a checklist of concrete, testable pass/fail criteria.
- Ask it to return:
  - A short narrative of the approach and key architectural decisions.
  - The Acceptance Criteria (user story line + checklist), per the above.
  - A JSON breakdown: `{ "junior_tasks": [...], "doc_tasks": [...], "senior_tasks": [...] }` — `senior_tasks` are parts complex enough that senior-engineer should implement them directly during `implement-task`, rather than handing them to junior-engineer.
  - The list of files/components likely touched.
  - Risks, open questions, or assumptions made.

### Step 4 — Present for Approval

Call `ExitPlanMode` with the synthesized plan (narrative + Acceptance Criteria + task breakdown + files touched + risks) for the user to approve or redirect. If the user requests changes — including to the AC itself — revise and re-submit before continuing.

### Step 5 — Persist the Plan File

Once approved, ensure `documents/plans/` exists, then write the plan to `documents/plans/<kebab-case-slug>.md` (derive the slug from the task title; if a plan with that slug already exists, read it first and overwrite — plans reflect current intent, not history).

Use this structure:

```markdown
# Plan: <Title>

Status: Ready for implementation
Created: <YYYY-MM-DD>
Source: <free text description, or path to the reference doc>

## Goal
<1-2 sentences on what this achieves and why>

## Acceptance Criteria
As a <role>, I want <goal>, so that <benefit>.

- [ ] <concrete, testable pass/fail criterion>
- [ ] <concrete, testable pass/fail criterion>

## Approach
<narrative from senior-engineer: architecture/design decisions>

## Tasks

### Senior (complex/architectural — senior-engineer implements directly)
- ...

### Junior (precise, scoped — delegate to junior-engineer)
- ...

### Documentation (tech-writer)
- ...

## Files / Components Touched
- ...

## Risks / Open Questions / Assumptions
- ...
```

### Step 6 — Confirm

Report to the user:
- The plan file path.
- A one-line summary of the approach.
- The Acceptance Criteria checklist count.
- Task counts (senior / junior / doc).
- Any open risks or assumptions flagged.

Tell the user they can now run `implement-task` against this plan file when ready, and that `code-review` (or QA) should check the work against the Acceptance Criteria checklist.
