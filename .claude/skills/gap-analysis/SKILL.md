---
name: gap-analysis
description: 'Audit the MYPS User Manual against an Acceptance Test Plan (ATP) and produce a gap analysis report. Use when: checking documentation coverage, auditing the user manual against test cases, finding missing validation/workflow documentation, or refreshing MYPS_Gap_Analysis_Report.md. Asks for the ATP file path and whether to audit the whole manual or a specific module.'
argument-hint: 'Optional: path to the Acceptance Test Plan file, and/or a module name to scope the audit'
---

# Gap Analysis: User Manual vs Acceptance Test Plan

## Purpose
Compare the MYPS User Manual against an Acceptance Test Plan (ATP) to find missing documentation, validation mismatches, workflow gaps, and outdated screenshots, then produce a structured gap analysis report.

## When to Use
- Auditing `FE/UserManual.md` (or a module's `UserManual.md`) against a new/updated ATP
- Refreshing [`documents/MYPS_Gap_Analysis_Report.md`](./../../../documents/MYPS_Gap_Analysis_Report.md) after either document changes
- Checking whether recent code changes (validation messages, workflows, fields) are reflected in the manual

---

## Procedure

### Step 1 — Gather Inputs

Ask the user (use `AskUserQuestion` if not already provided):
1. **ATP file path** — location of the Acceptance Test Plan document (docx, pdf, or md). Read it with the `Read` tool (docx/pdf are supported directly).
2. **Scope** — Global (entire `FE/UserManual.md`) or a specific module (`FE/src/pages/<Module>/UserManual.md`).

---

### Step 2 — Read Source Documents

- Read the ATP file in full (or page-by-page if it's a large PDF).
- Read the corresponding `UserManual.md` (global or module-specific).
- Note each document's "Last Updated"/version date — used later for the Screenshot Review section.

---

### Step 3 — Compare and Identify Gaps

For each ATP section/test case area, check whether the User Manual covers it. Look specifically for:

- **Missing Documentation** — features, work location variants, revision types, or modules present in the ATP but absent or thin in the manual
- **Validation Mismatches** — error/validation messages, required-field rules, or eligibility conditions described in the ATP but missing or worded differently in the manual
- **Workflow Issues** — state transitions, approval routing, re-submission flows, or step sequences in the ATP not reflected in the manual
- **Screenshot Review** — flag as POSSIBLY OUTDATED if the manual's date predates the ATP's date; otherwise NOT FLAGGED

For each finding, assign a severity: **HIGH** (blocks understanding of a core workflow/validation), **MEDIUM** (incomplete but core flow understandable), **LOW** (minor/cosmetic).

---

### Step 4 — Write the Report

Output to `documents/MYPS_Gap_Analysis_Report.md` (global scope) or `documents/MYPS_Gap_Analysis_Report_<Module>.md` (module scope). If the file already exists, read it first and replace it with the refreshed audit (this report reflects current state, not history).

Use this structure (matches the existing report format):

```markdown
# MYPS User Manual vs Acceptance Test Plan
## Comprehensive Gap Analysis Audit Report

# Executive Summary
Coverage: ~XX%
High Risk Areas:
- ...

# Missing Documentation
## <Area>
<description>
Status: ...
Severity: HIGH|MEDIUM|LOW

# Validation Mismatches
## <Area>
Missing:
- ...

# Workflow Issues
## <Area>
Missing:
- ...
Severity: ...

# Screenshot Review
Status: POSSIBLY OUTDATED | NOT FLAGGED
Reason: ...

# Recommended Manual Updates
Priority 1
1. ...
Priority 2
...
Priority 3
...

# Audit Verdict
<one paragraph summary>
```

---

### Step 5 — Confirm

Report to the user:
- The output file path
- Overall coverage estimate and the HIGH severity items found
- Whether the manual's screenshots are likely outdated relative to the ATP
