---
name: update-user-manual
description: 'Update the MYPS User Manual to address findings from a gap analysis report. Use when: a gap analysis report exists (e.g. documents/MYPS_Gap_Analysis_Report.md) and the manual needs to be updated to close the documented gaps. Translates ATP-style QA detail into end-user-facing manual content rather than copying it verbatim.'
argument-hint: 'Optional: path to the gap analysis report and/or a module name to scope the update'
---

# Update User Manual from Gap Analysis

## Purpose
Close the gaps identified by a [gap-analysis](../gap-analysis/SKILL.md) report by updating `UserManual.md`, written for end users — not by copying the Acceptance Test Plan (ATP) into the manual.

## Core Principle: Manual vs ATP

The ATP and the User Manual serve different audiences and must stay distinct:

| | Acceptance Test Plan (ATP) | User Manual |
|---|---|---|
| Audience | QA / testers | End users |
| Coverage | Every route, every input combination, success **and** failure/edge cases, eligibility rules | Primarily the success ("happy") path |
| Errors | Exhaustive matrix of every validation message and trigger | Only errors a real user is likely to encounter, written as "what it means / how to fix it" (see existing pattern at [`FE/UserManual.md`](../../../FE/UserManual.md), section "Validation Errors and How to Fix Them") |
| Workflows | State-machine / routing diagrams for QA | Plain-language "what happens after you click X" — simplified, no state diagrams |

When applying a gap analysis finding, **classify it first**:

1. **User-facing** → translate into manual content (steps, field tables, "Validation Errors and How to Fix Them" rows, simplified workflow description).
2. **QA-only** (exhaustive negative-path matrices, internal eligibility/business-rule logic, full state-transition diagrams, every permutation of a dropdown-dependency matrix) → skip, and note it as intentionally excluded in the summary.
3. **Approval workflows / state transitions** → include, but simplified: a short "What happens next" narrative and/or a basic numbered flow (e.g. Submitted → Reviewed by X → Approved/Returned), not a technical diagram.

When unsure whether a finding is user-facing or QA-only, default to a brief, plain-language mention rather than omitting it — but never reproduce ATP test-case IDs, full validation matrices, or QA-only language in the manual.

---

## Procedure

### Step 1 — Gather Inputs

- Locate the gap analysis report: `documents/MYPS_Gap_Analysis_Report.md` (global) or `documents/MYPS_Gap_Analysis_Report_<Module>.md` (module). If the user hasn't specified, ask which report/scope to apply via `AskUserQuestion`.
- If the report's findings reference specific ATP content not summarized in enough detail to write from, ask the user for the ATP file path so the relevant section can be read for context (read only the referenced sections, not the whole ATP).
- Read the current `UserManual.md` for the scope (global `FE/UserManual.md` or `FE/src/pages/<Module>/UserManual.md`).

---

### Step 2 — Triage Each Finding

Go through the report section by section (Missing Documentation, Validation Mismatches, Workflow Issues, Screenshot Review, Recommended Manual Updates). For each item, decide: include (user-facing), include-simplified (workflow), or skip (QA-only) — per the Core Principle table above.

Build a short triage list before writing, so the final summary can report what was included/skipped and why.

---

### Step 3 — Update the Manual

For each "include" item, edit `UserManual.md` following its existing conventions:

- **New work location / revision type docs** → add a new subsection under the relevant module section, following the structure of sibling sections (Purpose, Step-by-Step, Field Reference table).
- **Validation messages** → add rows to the relevant "Validation Errors and How to Fix Them" table (see [FE/UserManual.md:656](../../../FE/UserManual.md#L656) for the pattern: `Error Message | How to Fix`). Phrase the "How to Fix" column from the user's perspective.
- **Approval / revision workflows** → add a short "What Happens After You Submit" narrative with a simple numbered flow, near the relevant submission step.
- **Field reference / dropdown dependency notes** → add or update rows in the existing field tables; describe dependent-dropdown behavior in one sentence ("Selecting X filters the options available in Y") rather than enumerating every combination.

Use `Edit` for targeted changes — merge into existing sections rather than appending a new top-level section, unless the gap is a genuinely new module/area with no existing section.

---

### Step 4 — Update Metadata

- Bump the manual's version number and "Last Updated" date (today's date) in its header.
- If `documents/UserManual_Changelog.md` exists and the project tracks changes there, add an entry summarizing what changed and which gap-report items it addresses (follow the existing changelog format).

---

### Step 5 — Confirm

Report to the user:
- Which gap-report items were addressed, with file/section references
- Which items were intentionally skipped as QA-only, and why
- Any items still needing the user's input (e.g. business rules that need SME confirmation before being written as user-facing guidance)
