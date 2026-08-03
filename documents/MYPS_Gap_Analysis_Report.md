# MYPS User Manual vs Acceptance Test Plan
## Comprehensive Gap Analysis Audit Report

# Executive Summary

Coverage: ~96%

ATP reference: "060426 Deliverable #46 Acceptance Test Plan for Web-based MYPS - V4_updated 15May2026" (Version 4.0, dated 15 May 2026)
User Manual reference: `FE/UserManual.md` (Version 3.7, dated 8 June 2026)

This is a refresh of the prior audit. The User Manual has been substantially expanded since the last report — Work Locations, Revision Types/Behaviors, RO/PS Admin Approval Actions, and a Consolidated Validation Messages appendix have all been added. Most prior HIGH severity items are now resolved or downgraded.

High Risk Areas Remaining:
- Login validation messages incomplete (empty username/password)
- Revision-type-specific field editability not itemized for 9 of 12 revision types

---

# Missing Documentation

## Login — Empty Field Validation
The User Manual's "Common Outcomes & What to Do" table for Login (Section 3.1) does not document the inline validation messages that appear when Sign In is clicked with empty fields.

Confirmed in code (`FE/src/pages/login/Page.tsx`): `"Username is required"` and `"Password is required"` are shown inline under each field when submitted blank.

Status: Missing from manual.

Severity: MEDIUM

## Revision Type Field Editability (9 of 12 types)
Section 5.4.5 documents general field-editability rules (by PCMA status) and Section 5.4.6 documents special UI behaviors for **Termination**, **Non-Implementable**, **Excess Component Warning**, and **Copy Major Item**. The remaining 9 revision types — Additional Funding, Adjustment, Change in Authority to Implement, Change in Funding, Change of Creditor, Expired Funding, For Savings (Partial Unutilized Balance), Mode of Implementation, Multi-Year Costing Changes — are covered only by the generic statement that "the API delivers exact per-field permissions."

A user selecting one of these revision types has no manual guidance on which sections/fields they should expect to be editable.

Status: Partially documented (generic rule only, no per-type guidance).

Severity: MEDIUM

## Work Location Infrastructure ID Prefixes
Section 5.3.5 documents the InfraId logic generically (auto-generated using "the Infrastructure Type prefix, e.g., `LR-00001`") but does not list the prefix used for each of the 16 work location/infrastructure types (e.g., `CS` for Consultancy, `FCS` for Flood Control Structures, as seen in the ATP).

Status: Generic mechanism documented; per-type prefix reference table missing.

Severity: LOW

## Project Group Details — Map Section
ATP (S05-TC002) lists a map showing the project's general geographic location as part of the Project Group Details screen. Manual Section 5.5.3 does not mention this map.

Status: Missing.

Severity: LOW

---

# Validation Mismatches

## Login
Missing:
- `"Username is required"` (shown when Sign In is clicked with blank username)
- `"Password is required"` (shown when Sign In is clicked with blank password)

These should be added as rows in the Section 3.1 "Common Outcomes & What to Do" table and Appendix B.

---

# Workflow Issues

## Revision Approval Routing
Resolved — Section 5.4.7 now includes a "Review routing" table (DPC/DEO → RO; RPC/RO → CO/PS Admin; AUC/PS Admin/CO → auto-approved), and Sections 5.4.9–5.4.10 document RO and PS Admin approve/disapprove/return-for-correction actions in plain language. No further action needed.

## Re-submission Flow
Resolved — Section 5.4.8 ("Resubmitting After a Return for Correction") covers this.

---

# Screenshot Review

Status: NOT FLAGGED

Reason:
The User Manual (8 June 2026) now postdates the ATP (15 May 2026). Manual content reflects the more recent build. No outdated-screenshot risk relative to the ATP at this time; placeholder screenshot markers (`[Insert Screenshot: ...]`) remain throughout and should be replaced with actual captures from the current build when convenient — this is a production-readiness item, not a gap relative to the ATP.

---

# Recommended Manual Updates

Priority 1
1. Add "Username is required" / "Password is required" rows to Section 3.1 Common Outcomes and Appendix B.

Priority 2
2. Add a short per-revision-type guidance note (even a 1–2 sentence summary of typical editable sections) for the 9 revision types not covered by Section 5.4.6.

Priority 3
3. Add a small Infrastructure ID prefix reference table to Section 5.3.5 covering all 16 work location types.
4. Add a one-line mention of the Project Group map view to Section 5.5.3.
5. Replace remaining `[Insert Screenshot: ...]` placeholders with current-build captures.

---

# Audit Verdict

The User Manual (v3.7) has closed nearly all gaps identified in the previous audit, including Work Locations, Revision Types/Behaviors, and Approval Workflows. Remaining gaps are narrow and MEDIUM/LOW severity: two missing client-side validation messages on Login, and per-type field-editability guidance for 9 revision types. The manual is now ahead of the ATP in terms of "Last Updated" date, so screenshot staleness is not currently a concern.
