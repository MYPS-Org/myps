---
name: create-plan
description: 'Turn a feature idea, ticket, or reference doc into a structured implementation plan via Plan Mode, then persist it to documents/plans/ for implement-task to pick up later. Use when: starting new work that needs a plan before any code is written, turning a feature idea or gap-analysis finding into an actionable plan, or refreshing an existing plan file. Asks for the task description or source file if not given.'
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

If the request is vague (no clear scope, unclear which module/files are affected, or too thin to derive meaningful Acceptance Criteria from), ask ONE clarifying question before proceeding — including asking for the user's own AC if the prompt genuinely doesn't give enough to infer testable criteria. Don't ask more than one round — make reasonable assumptions and state them in the plan instead.

### Step 2 — Enter Plan Mode

Call `EnterPlanMode` before any exploration finishes shaping into a final plan. This ensures nothing gets written until the user explicitly approves.

### Step 3 — Analyze and Draft the Plan

Do this analysis directly yourself — no subagent delegation. Explore the codebase (`Glob`/`Grep`/`Read`) to find the files/components the task touches, then draft:
- A short narrative of the approach and key architectural decisions.
- Acceptance Criteria: if the source ticket already had an AC section, refine/complete it rather than replace it. Otherwise draft one user-story framing line (`As a <role>, I want <goal>, so that <benefit>`) plus a checklist of concrete, testable pass/fail criteria.
- A flat task breakdown (see Step 5 template) — group into Implementation and Documentation, not by seniority.
- The list of files/components likely touched.
- Risks, open questions, or assumptions made.

Do NOT write, edit, or run Bash commands that change files during this step — exploration and reads only.

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
<narrative: architecture/design decisions>

## Tasks

### Implementation
- ...

### Documentation
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
- Task counts (implementation / documentation).
- Any open risks or assumptions flagged.

Tell the user they can now run `implement-task` against this plan file when ready, and that `code-review` (or QA) should check the work against the Acceptance Criteria checklist.
