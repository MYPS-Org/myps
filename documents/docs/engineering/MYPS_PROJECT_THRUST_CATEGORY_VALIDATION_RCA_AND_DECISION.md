# Project Thrust ↔ Category Validation — RCA, Gap Analysis, and Open Decision

**Date:** 2026-09-10
**Scope:** `Helpers/ProjectHelper.cs` (`ValidateProjectDetailsLookups`), new `dbo.vProjectThrustByCategory`
view, `tOptionProjectCategoryToPAPMap`, `tProjectRevisions.Category`/`.Thrust`
**Status:** View and validation logic built and verified against live data. **2026-09-11: operator
decided Section 9's Option A.** Implemented in `Helpers/ProjectHelper.cs` (`PreviousThrust` +
`ThrustIsChanging` gate on `ValidateProjectDetailsLookups`) and wired in `ProjectController.cs`'s
`UpdateProjectDetails`; `AddProject` deliberately unchanged (no prior state, always fully validated,
per this section's own design); `RevisionController.cs`'s `ResubmitRevision` needed no change — its
own pre-existing per-field diff pattern already gated the same check on Thrust actually changing.
Build-verified (Helpers/WebAPI/MYPS.ApiIntegrationTests, 0 errors), 3 new characterization tests
added (30/30 suite passing), and hand-traced against real currently-mismatched rows (Category
29/Thrust 1139, e.g. revision Id 94440) confirming the grandfather gate is reached exactly as
designed. Live count re-confirmed unchanged at 556 mismatched revisions as of this pass.

**Branch history note (2026-09-11):** this change exists as identical content across three commits,
different hashes, from the branch-out/reconciliation work that day: `86025dd7` (original, on
`michael-security-fixes-and-project-audits`, not pushed), `80a5533c` (an intermediate branch-out,
`category-thrust-validation`, chained off `subcategory-dropdown-docs` — superseded, do not use), and
`24979c89` (**current, correct version**, on `category-thrust-validation-clean`, branched directly off
`origin/dev-trunk` after `security-fixes`/`58992919` merged into dev-trunk via PR #193 — this is the
one intended for a future PR). The intermediate branch was needed only because, at the time, dev-trunk
hadn't yet absorbed `58992919`'s changes to the same files this fix edits; once PR #193 merged that
dependency, chaining was no longer necessary.

**2026-09-11, later same session — Option C explicitly declined (operator decision).** The operator
chose to leave the 556 mismatched revisions' underlying Category/Thrust data as-is: *"just leave as
is the old migrated data."* This is a final decision, not a deferral — Option C (correcting the 312
clear-cut miscategorized rows + resolving the 244 orphaned-PAPKey-1157 rows) is closed as declined,
not pending. The 556 rows stay permanently grandfathered under Option A: any of them can be edited
and saved normally (per the fix above) as long as Thrust itself isn't the field being changed; if a
user ever does try to change one of these projects' Thrust to something new, full validation applies
and a genuinely invalid selection is still rejected. No further action is planned against this data.

---

## 1. Summary

A new view and new server-side validation were built so that a project's selected **Thrust**
(sub-category) must belong to its selected **Category**'s approved list, per
`tOptionProjectCategoryToPAPMap` — closing a gap where this relationship was never enforced at all.
Building it surfaced a separate, pre-existing issue: **556 of 118,445 live project revisions (0.47%)
already have a Category/Thrust combination that doesn't match the approved mapping.** Cross-checking
against the authoritative source file (`category_to_pap_many2many_map.xlsx`) confirms this is real
historical data drift in the *projects*, not a gap in the mapping table. Shipping the validation
as-designed would block the next save of any of these 556 projects — even an edit that never touches
Thrust — until someone resolves the mismatch. This document lays out the root cause, full evidence,
every option considered, and a recommendation; it does not decide FOR the operator.

---

## 2. Background — why this was built

Request: create a view wrapping this Category→Thrust join (operator-supplied), to be used instead of
querying `tOptionProjectThrustList` directly, plus new save-time validation — a project's Thrust must
be valid for its Category, **unless** that Category's map row is `PAPKey = -1` (a wildcard meaning
"any thrust allowed"). Backend and database only; no frontend changes authorized or made.

```sql
SELECT thrust.Id, map.CategoryId, thrust.PAPKey, thrust.ProgramName, thrust.SubProgramName,
       thrust.ActivityName, thrust.SequenceNumber, thrust.ValidFromDate, thrust.ValidToDate,
       thrust.InfrastructureType, thrust.ThrustDescription, thrust.IsActive
FROM tOptionProjectThrustList thrust
JOIN tOptionProjectCategoryToPAPMap map ON map.PAPKey = thrust.PAPKey
```

---

## 3. What already existed — checked before building anything new

- **Thrust validation was already written and was dead code.** `Helpers/ProjectHelper.cs` had a
  commented-out `ValidateThrust` check referencing `p.Thrust` — but the params class it belonged to
  (`ValidateProjectDetailsLookupsParams`) had **no `Thrust` property at all**. This code would not
  have compiled if ever uncommented as-is.
- **The exact wildcard logic already existed and worked, in a different pipeline.**
  `Hangfire/Importing/ImportingHelper.cs:248-269` implements this same Category↔Thrust rule for bulk
  imports, with the "unrestricted" case already correctly covering: no mapping rows for the category,
  an explicit `-1` among them, or every mapped PAPKey being a dangling reference. **This never ran
  for normal Add/Update project saves** — import-only. The new validation mirrors this proven
  pattern rather than inventing a new one.
- **`AddProject` had zero Thrust validation at all** (relied solely on the dead commented-out check)
  — any Thrust value, even a nonexistent one, was accepted on project creation.
- **`UpdateProjectDetails` has its own separate inline check** (`ProjectController.cs:1459-1479`) —
  existence-only (is the PAPKey a real thrust), never checked the Category relationship, plus
  transaction-log audit tracking. Left in place for its audit role; becomes a harmless redundant
  recheck now that the shared helper validates first.
- **`ShowProjectDropdowns` and 2 sibling endpoints in `RevisionController.cs`** return all active
  thrusts unfiltered by Category — consistent with this codebase's established pattern (generic
  listing endpoints stay permissive; enforcement lives at save-time, same as Category/DEO/IO/OU).
  **Not changed** — see §4.

---

## 4. Design constraint found: the view cannot safely replace the table everywhere

Quantified live, `myps_db_dev`:

| Fact | Value |
|---|---|
| Total active thrusts | 164 |
| Active thrusts with **any** `tOptionProjectCategoryToPAPMap` row | 93 (57%) |
| Active thrusts with **zero** mapping rows | **71 (43%)** |

An `INNER JOIN` view used unfiltered would make 71 real, valid, active thrusts **invisible** — a
thrust with no matching map row never appears in the join result, for any category. Separately, the
`-1` wildcard can never literally join-match (no real thrust has `PAPKey = -1`), so a category whose
only map row is `-1` would show **zero** thrusts through the raw view — the opposite of "any thrust
allowed."

**Conclusion**: the view is correct and safe for its actual purpose (*"what are this Category's
explicitly-approved thrusts"* — validation, or a future category-filtered dropdown) but is **not** a
safe drop-in replacement for the general "list every active thrust" case `ShowProjectDropdowns`
serves today. Using it there would silently hide 71 valid options. Not done.

---

## 5. The view (built, live)

```sql
CREATE VIEW dbo.vProjectThrustByCategory AS
SELECT
    thrust.Id, map.CategoryId, thrust.PAPKey, thrust.ProgramName, thrust.SubProgramName,
    thrust.ActivityName, thrust.SequenceNumber, thrust.ValidFromDate, thrust.ValidToDate,
    thrust.InfrastructureType, thrust.ThrustDescription, thrust.IsActive
FROM dbo.tOptionProjectThrustList thrust
JOIN dbo.tOptionProjectCategoryToPAPMap map ON map.PAPKey = thrust.PAPKey;
```

Exactly the operator's given query, unmodified. Live result: 134 rows, 19 distinct categories
(22 mapped categories minus the 3 wildcard-only ones, which correctly never join-match), 93 distinct
thrusts — matches the analysis in §4 exactly. `thrust.PAPKey` (`int`) joins against `map.PAPKey`
(`bigint`) via SQL Server's implicit widening — confirmed no cast needed, no error.

---

## 6. The validation (built, `Helpers/ProjectHelper.cs`)

1. `ValidateProjectDetailsLookupsParams` gained `public int? Thrust { get; set; }`.
2. New check, only runs when `p.Thrust.HasValue && p.Thrust.Value != 0` (see §7 for why `0` is
   excluded):
   - Confirm the thrust exists and is active (closes the `AddProject` gap).
   - Query `vProjectThrustByCategory WHERE CategoryId = p.Category AND PAPKey = p.Thrust` — exact
     match passes.
   - If no exact match: check whether `p.Category` has any *real* (non `-1`) row in
     `tOptionProjectCategoryToPAPMap`. Zero such rows (none at all, or only `-1`) means
     unrestricted — the already-confirmed active thrust stands as valid.
   - Otherwise: the category has explicit restrictions and this thrust isn't among them → reject
     with `"Invalid Sub-Category"`.
3. `ProjectController.cs`'s `AddProject` and `UpdateProjectDetails` both wire `Thrust` into the
   shared `pLookup` call — confirmed each from its own actual DTO shape, not assumed identical:
   `AddProject`'s DTO is flat (`dto.Thrust`); `UpdateProjectDetails`'s is nested
   (`dto.ProjectDetails.Thrust`).

**Verified against live data** (4 real cases, via a disposable simulation, cleaned up after):

| Case | Category | Thrust (PAPKey) | Result |
|---|---|---|---|
| Exact mapped pair | 5 | 1024 | ✅ `PASS-ExactMatch` |
| Restricted category, unmapped thrust | 7 | 1001 | ✅ `FAIL-NotMappedToCategory` (correctly rejected) |
| Explicit `-1` wildcard category | 20 | 1024 (arbitrary) | ✅ `PASS-Unrestricted` |
| Category with zero mapping rows | 1 | 1001 (arbitrary) | ✅ `PASS-Unrestricted` |

---

## 7. Regression found and fixed during verification: `Thrust = 0`

Before treating the fix as complete, ran a full regression check of every real, currently-saved
project against the new logic. Found `Thrust = 0` (not `NULL`) on 62 live projects — confirmed
`PAPKey = 0` doesn't exist as a real thrust anywhere, so `0` is this schema's pre-existing "none
selected" convention, not a real value to validate. The check was corrected to treat `0` the same as
`NULL` (skip validation) before this was caught as a false-positive regression risk.

---

## 8. The open issue: 556 pre-existing mismatches

After the `Thrust = 0` fix, the regression check found **556 of 118,445 project revisions with a
non-zero Thrust (0.47%)** whose Category+Thrust combination doesn't satisfy the new rule.

### 8.1 Root cause — confirmed against the authoritative source, not assumed

The operator supplied `category_to_pap_many2many_map.xlsx` (Downloads folder, 137 data rows) as the
source of truth. Cross-checked every one of the 9 distinct mismatched pairs against it directly:

| Category has | Thrust (PAPKey) | Projects | What the source file says |
|---|---|---|---|
| 29 (CSSP) | 1139 | 243 | **Mapped to Category 21** (National Disaster and Risk Reduction Management Council) |
| 12 (Trust Fund Projects) | 1158 | 44 | **Mapped to Category 29** (CSSP) |
| 16 | 1170 | 6 | **Mapped to Category 29** (CSSP) |
| 16 | 1054 | 6 | **Mapped to Category 29** (CSSP) |
| 8 | 1163 | 6 | **Mapped to Category 12** (Trust Fund Projects) |
| 17 | 1115 | 5 | **Mapped to Category 5 or 16** |
| 16 | 1068 | 1 | **Mapped to Category 5 or 17** |
| 28 | 1159 | 1 | **Mapped to Category 12** (Trust Fund Projects) |
| 29 (CSSP) | 1157 | 244 | **Not in the source file at all**, under any category |

**8 of 9 pairs (312 of 556 projects, 56%) are thrusts that ARE mapped in the source — just to a
different Category than the project actually has.** The remaining 244 (44%) are the single `1157`
case below. Category 29's own row list in the source file
matches the live `tOptionProjectCategoryToPAPMap` exactly — the mapping table is not missing
anything for Category 29. This is genuine historical miscategorization in the *projects*, not a gap
in the reference data.

**`1157`** ("Basic Infrastructure Program (BIP) - Public Water Supply System (Level II or III)") is
the one real ambiguity: it's a live, active thrust in `tOptionProjectThrustList`, but has **zero**
category assignment anywhere in the authoritative source. Worth noting: Category 29 already has
`1171` ("Basic Infrastructure Program (BIP) - Public Water Supply System") mapped — near-identical
wording, raising the possibility `1157` is a superseded/duplicate thrust code, but this is
**unconfirmed**, not something to assume.

### 8.2 Why this matters practically

Category and Thrust are two separate classification fields — Category is the broad program lane
(e.g., CSSP), Thrust is the specific activity type within it. They're meant to be hierarchically
consistent. A project with `Category=29 (CSSP), Thrust=1139` is filed under CSSP while its own
activity classification says it's actually an NDRRMC (disaster-council) activity — different program
lanes, plausibly different funding/reporting lines. **Not verified**: whether Category feeds into any
downstream budget/reporting aggregation beyond this table — real, unresolved risk either way, not
just a cosmetic mismatch.

### 8.3 Why it happened

No server-side check ever connected these two fields (§3) until this fix. 556 of 118,445 (0.47%)
drifted out of sync over time; the other 99.53% are already consistent — consistent with scattered
historical edge cases (imports, early data entry, manual overrides) rather than a systemic failure.

---

## 9. Options considered

| # | Option | Mechanics | Data touched | Risk | Final status |
|---|---|---|---|---|---|
| A | **Grandfather + ship** (recommended) | Validation only fires when Thrust is *changing* to a new value; compares against the project's currently-stored Thrust. Applies to `UpdateProjectDetails` only — `AddProject` has no prior state, so new projects are always fully validated. | None | Lowest — closes the gap for all future saves, doesn't touch or block any existing project | **DECIDED 2026-09-11 — implemented, commit `86025dd7`** |
| B | Ship as-is, no exemption | Full validation on every save, no grandfather clause | None | Any of the 556 projects fails its *next* save for *any* reason, including unrelated field edits, with no advance warning | Not chosen |
| C | Correct the 312 clear cases now | `UPDATE tProjectRevisions SET Category = <source-of-truth value>` for the 8 unambiguous pairs | 312 live rows | Real, live data mutation. Downstream Category-dependent logic (reports, budget rollups, region/user-group filters) **not yet audited** — needed before this is safe. `1157` (244 rows) has no correct target and isn't covered by this option at all. | **DECLINED 2026-09-11** — operator: *"just leave as is the old migrated data"*. Final, not deferred. |
| D | Hold off entirely | Don't ship validation; keep only the view | None | Gap stays open indefinitely; new miscategorizations can keep happening | Not chosen |

---

## 10. Recommendation — SUPERSEDED BY THE 2026-09-11 DECISIONS ABOVE

*(Original recommendation, kept for history below.)* **Option A (grandfather + ship).** It closes the
actual gap this task set out to close — no new miscategorization can happen from this point forward —
without mutating a single existing project or risking a surprise save failure for anyone today. The
556-row cleanup is real work but is a distinct, separately-scoped decision that deserves its own
investigation into Category's downstream dependencies before any live UPDATE runs against it.

**Both halves are now decided, not just recommended: Option A shipped, Option C declined.** The 556
rows' underlying Category/Thrust values are permanent, intentional as-is — they will never be
corrected by this document's own logic. Any future work on this data would need a fresh decision from
the operator, not a resumption of this one.

---

## 11. Non-scope / explicitly not done

- No frontend file touched or proposed.
- `ShowProjectDropdowns`/`RevisionController`'s unfiltered Thrust dropdowns — unchanged (§4).
- `CodeTableController.cs`'s Thrust admin CRUD screen — unrelated, no defect found.
- No DB constraint added — matches this project's established convention (natural keys enforced at
  the app layer, not schema, per prior precedent for `tRevisionRules` and others).
- The 556 pre-existing mismatches are **not** corrected by this document or by Option A — and per the
  2026-09-11 decision, never will be under this investigation. Option C is closed, declined.

---

## 12. Next concrete action — CLOSED

**§9's decision is resolved as of 2026-09-11: Option A implemented and committed (`86025dd7`), Option
C explicitly declined by the operator.** No next action remains against this document's own scope.
Everything below is a separate, already-completed thread that grew out of this investigation, not a
resolution of §9 — kept for history, not a live TODO.

*(Original next-action list, kept for history:)*
- If A: implement the grandfather comparison in `ValidateProjectDetailsLookups`, re-verify against
  live data (confirm all 556 pass when Thrust is unchanged, confirm a genuinely new invalid Thrust
  still correctly fails), add a characterization test, build-verify, commit. — **Done.**
- If B: ship as currently built, no further code change. — Not chosen.
- If C: separate investigation into Category's downstream consumers before any UPDATE runs, then a
  dedicated data-correction pass with its own before/after verification — not bundled into this fix.
  — **Declined; will not happen.**
- If D: no further action this pass; the view remains live but unconsumed by application code. — Not
  chosen.

---

## 13. Addendum (2026-09-10, later same session) — the display bug, the FE fix, the redesign, and the final audit

A follow-up operator request — *"show the selected thrust even though it does not exist, like in
category"* — surfaced a second, related defect chain. Documenting it here since it shares the same
root subject (Thrust/Category validity) even though it's a distinct bug from §7-9's mismatch issue.

### 13.1 The display bug (backend half)

`ShowProjectDropdowns` (`ProjectController.cs:70-71`) still filtered Thrust by `IsActive` — the exact
same shape as the Category bug fixed 2026-09-09 (§4 references this). A project whose Thrust later went
inactive/expired couldn't resolve its own selected value in the frontend's `SearchableDropdown`
(`options.find(value)`, no fallback). **Fixed**: filter removed, mirroring Category exactly.
Companion fix: `ValidateProjectDetailsLookups`'s Thrust existence check (`ProjectHelper.cs:325`) made
date/active-window aware (`IsActive || (ValidToDate == 0 || ValidToDate >= CurrentYear)`), matching
Category's own pattern — otherwise the now-permissive dropdown could let a project fail to re-save its
own already-valid, since-expired Thrust.

### 13.2 The real display bug (frontend half) — the backend fix alone wasn't sufficient

Traced further and found a second, fully independent cause: three FE forms
(`Project/components/ProjectDetailsForm.tsx`, the Modification variant,
`LSWallet/components/WalletDetailsSection.tsx`) pre-filtered `projectEnums.Categories`/`.Thrusts`
**client-side** by date, before ever handing the array to `SearchableDropdown` — entirely independent
of what the backend returned. **Fixed**: new `filterKeepingSelected` helper
(`FE/src/utils/GlobalFunctions.ts`) applied at all 6 Category/Thrust call-sites — keeps the currently-
selected value visible regardless of the filter, without changing what's offered for a *new* selection.

### 13.3 Revision-flow audit + a separate validation gap found

`code-behavior-audit` confirmed the display fix already covers the Revision edit screen
(`ViewRevision.tsx` renders the same Modification `ProjectDetailsForm.tsx`, traced via import chain)
and that `fProjectDetails`/`fRevisionProjectDetails` (live-DB-only TVFs) already resolved
`ThrustName`/`CategoryName` via `LEFT JOIN` — confirmed live via `OBJECT_DEFINITION`, never had this
bug. Separately found: `RevisionController.cs`'s `ResubmitRevision` (~line 2530) let a user change a
project's Category/Thrust and persisted it directly with **zero** existence/mapping validation, unlike
`AddProject`/`UpdateProjectDetails`. **Fixed**: inline check mirroring `ValidateProjectDetailsLookups`'
own logic exactly, gated behind the same diff checks the method already had.

### 13.4 Redesign — moving date-validity logic server-side (operator-directed)

Operator pushback: the year/date-validity check shouldn't be duplicated as hand-rolled JS date math in
the FE — the backend should own that business rule. Investigated moving "guarantee the selected value
is present" server-side too (would need `ShowProjectDropdowns` to accept selected-value parameters) and
**rejected it** — the endpoint is genuinely parameterless and shared by 3 forms with two incompatible
key semantics (Project uses `CategoryId`/`PAPKey`; `LSWallet` uses the option tables' own internal
`Id`). **Chosen instead**: a computed `[NotMapped] IsCurrentlyValid` property added directly to
`OptionProjectCategory.cs`/`OptionProjectThrustList.cs` (`DBHelper`) — the single source of truth for
"is this option valid for a new selection," computed server-side, date-only per operator decision
(Category: no `IsActive` gate, matching prior FE behavior exactly; Thrust: aligned to Category's `>=`
shape, dropping the old `ValidFromDate`-not-started exclusion — both were genuine, operator-confirmed
behavior changes, not just relocations). All 6 FE call-sites now read `x.IsCurrentlyValid` instead of
computing dates themselves; zero `new Date()` calls remain in any of the 3 edited FE files.
Timezone logic (Asia/Manila, matching `Helpers.Functions.CurrentDate()`) is duplicated inline in both
`DBHelper` model files rather than called, since `DBHelper` has no project reference to `Helpers`
(the reference runs the other way) — flagged as a keep-in-sync risk, not a defect.

### 13.5 Final audit verdict (code-behavior-audit + live data, 2026-09-10)

**GO — no code changes required.** Two Explore-agent sweeps (backend, frontend) plus live read-only
queries against `myps_db_dev` (saved as `Main/Resources/Internal/SQLScripts/ProjectThrustCategory.Verification.sql`)
traced the full chain end-to-end with no functional defects. Minor, non-blocking notes surfaced:
- `filterKeepingSelected` has no explicit `selectedValue === 0` guard — currently harmless (DB-confirmed
  live: `CategoryId`/`PAPKey` never legitimately `0`, min values 1 and 1001) but relies on that
  invariant rather than a DB constraint.
- Pre-existing, unrelated: `CategoryEnum.CategoryId?: string` in `Model.d.ts` is a stale type (backend
  is `int`) — masked by loose `==`, not a current bug, but a landmine if a future refactor tightens to
  `===`.
- A re-added selected-but-invalid item appears at the end of the dropdown list (not sorted
  alphabetically) — confirmed cosmetic only, zero functional impact.

### 13.6 New finding — put ON HOLD by explicit operator direction (2026-09-10)

`LSWallet`'s save path (`FE/src/pages/LSWallet/Service.ts:195-235`) is **entirely mocked** —
`createWallet`/`updateWallet` hit a local mock store (`walletMockStore.ts`), not `httpClient`.
`WebAPI/Controllers/Lumpsum/LumpsumController.cs` exposes only read endpoints (`InitFilterLumpsum`,
`ShowLumpsum`, `LumpsumDetails`, `WalletBalance`, `ShowItemizedProjects`) — no create/update action
exists at all yet. Consequently `WalletDetailsSection.tsx`'s Category/Thrust selections currently have
**no backend persistence or validation path whatsoever** — not a gap introduced by anything in this
session, a pre-existing "endpoint not yet built" state. **Explicitly deferred, not actioned, per
operator instruction 2026-09-10 ("put that on hold for now").** When Wallet save is eventually wired
up, it will need its own existence/validity check keyed by the option tables' `Id` column (not
`CategoryId`/`PAPKey`, which Project uses) — same pattern already established for Project, different
key.
