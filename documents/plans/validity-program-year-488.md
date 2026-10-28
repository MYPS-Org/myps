# Plan: Category / Sub-Category validity follows the Program year, not today (#488)

Status: Implemented
Created: 2026-10-28
Source: Gitea #488 (part of #478), with the user's decisions of 2026-10-28 (AskUserQuestion):
- Reference year = **Program StartYear**.
- Thrust window **inclusive** at both ends.
- **Keep the OR rule.**
- Deliver as a **new issue and PR**.

Stacked on PR #487 (#482), which is stacked on #486, #485 and #483.

## Context
A Category or Sub-Category (Thrust) is judged "valid" against **today's year** in the project forms and saves, but against the **Program's StartYear** in the importer. A project belongs to its program's year: a 2025-program project revised in 2027 should still be able to use a Category valid until 2025. Today:
- **Forms:** they filter with the server's `IsCurrentlyValid` (today's Manila year). Project `ProjectDetailsForm.tsx` around L415/443, Modification around L387/419, `LumpSumDetailsSection.tsx` around L257/294.
- **Category save check:** `ProjectHelper.ValidateCategoryAsync` uses `Functions.CurrentDate().Year`.
- **Thrust save check:** `ProjectHelper.ValidateThrustForCategoryAsync` uses `CurrentYear` with `IsActive || ValidToDate == 0 || ValidToDate >= year`, ignoring Valid From.
- **Importer** (`Hangfire/Importing/ImportingHelper.cs` around L231/244): uses `programStartYear`, but its Thrust window is strict (`ValidFrom < year < ValidTo`) and has no Active fallback.

#487 already makes a project's own value show and save (filterKeepingSelected, unchanged values kept). This issue only changes which **year** "valid" is measured against, and makes it consistent everywhere.

## Acceptance Criteria
As a PS user, I want Category and Sub-Category validity judged against my project's program year, so that revising or editing a past-year project offers and accepts the codes that were valid for that year.

- [ ] **S04-TC040:** for a 2025-program project, a Category valid until 2025 is **offered** in the Project form and in Modification, and it **saves**, even in a later year. A Category valid until 2024 and Inactive is not offered, and is refused when chosen.
- [ ] **S04-TC041:** a Sub-Category valid 2023–2025 is offered and saves for a 2025-program project, and is not offered (and is refused if Inactive) for a 2026-program project. The importer accepts it for a 2025 program and refuses it for 2026 when it is Inactive.
- [ ] **Category rule:** selectable when Active, or when Valid Until is 0 or ≥ the program year.
- [ ] **Thrust rule:** selectable when Active, or when Valid From ≤ program year ≤ Valid To (a 0 means no limit on that side).
- [ ] **The form dropdowns** show the rows valid for the program year (validity only, as documented in §5.7.6). The project's own value always stays, and Sub-Category is still cleared only when the Category itself changes.
- [ ] **The same rule** in AddProject, UpdateProjectDetails, CreateLumpSum / UpdateLumpSum, RequestRevision / ResubmitRevision and the importer.
- [ ] **Fallback:** where the program year can't be found (0), today's year is used.

## Approach
**1. One definition of "valid for a year":**
- C#, in `ProjectHelper`:
  - `CategoryIsSelectable(isActive, validUntil, year)` already exists.
  - Add `ThrustIsSelectable(bool isActive, int validFrom, int validTo, int year)` (Active or inclusive window).
  - Add `ReferenceYear(int programStartYear)`, which falls back to `Functions.CurrentDate().Year` when the value is ≤ 0.
- TypeScript, in `utils/GlobalFunctions.ts`:
  - `isCategoryValidForYear(c, year)` (ValidUntil 0 or ≥ year).
  - `isThrustValidForYear(t, year)` (inclusive window, 0 = open).
  - These are validity-only, matching what the dropdowns offer today.

**2. Pass the year through the save checks:**
- `ValidateCategoryAsync(category, previousCategory, referenceYear, ct, alsoKept)`.
- `ValidateThrustForCategoryAsync(category, thrust, prevCat, prevThrust, referenceYear, ct)`: load the Thrust by PAPKey, then `ThrustIsSelectable`.
- `ValidateProjectDetailsLookupsParams` gets `int ProgramYear`.

Callers:
- AddProject: `ProgramParent.StartYear`.
- UpdateProjectDetails: `CurrentProgramVersion.StartYear`.
- CreateLumpSum: `Program.StartYear` (the `tPrograms` row it loads).
- UpdateLumpSum: `LumpSumProject.StartYear`, through `ValidateRequiredFieldsAsync`, `ValidateSubCategoryAsync` and `ValidateTierAndCategoryAsync`.
- RequestRevision: `ProgramParent.StartYear`.
- ResubmitRevision: `ValidateProgram.Data.Program.StartYear`.

**3. Importer:** use `ProjectHelper.CategoryIsSelectable` / `ThrustIsSelectable` with `programStartYear`. The Category result stays the same; the Thrust check becomes inclusive and gains the Active fallback, matching the app.

**4. Forms:** replace `x => x.IsCurrentlyValid` with `x => isCategoryValidForYear(x, programYear)` / `isThrustValidForYear(...)`, keeping `filterKeepingSelected`.
- Project: `programDetails?.StartYear`.
- Modification: `initialData?.ProgramDetails?.StartYear`, from the Functions `ProgramDetails`, which has StartYear.
- Lump Sum: `lumpSum.StartYear`.
- Each falls back to the current year. Code Tables' own Validity filter keeps `IsCurrentlyValid` (it's about today).

## Tasks
### Implementation
- [ ] `ProjectHelper`: add `ThrustIsSelectable` and `ReferenceYear`, add the year parameter to `ValidateCategoryAsync` and `ValidateThrustForCategoryAsync`, and add `ProgramYear` to the params. Unit tests: `ThrustIsSelectable` edges (inclusive ends, 0 = open, Active wins), `ReferenceYear` fallback.
- [ ] Pass the program year at every caller: ProjectController (Add/Update), LumpsumController.Writes (Create/Update, three helpers), RevisionController (Request/Resubmit).
- [ ] `ImportingHelper`: use the shared rules.
- [ ] FE: add the `GlobalFunctions` helpers, and use them in the Project and Modification `ProjectDetailsForm` and in `LumpSumDetailsSection`.
- [ ] e2e `e2e/tests/category-validity-program-year.spec.ts`: a BP project whose program StartYear is in the past or future relative to a Category's / Thrust's validity. Use existing data where possible (Category 2 valid until 2017, Thrust windows from GetAllCodeTables), or set Valid Until / To with the Code Tables call (now allowed while in use, #487) and restore it.
  - TC040: offered, saves, and refused across the program year.
  - TC041: the same for the Thrust window.
  - Check the spec fails on the pre-#488 API.

### Documentation
- [ ] `FE/UserManual.md` §5.7.6: "valid" is measured against the **project's program year**, not today, with the inclusive Thrust window.
- [ ] `e2e/CLAUDE.md` coverage row.

## Files / Components Touched
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`
- `Hangfire/Importing/ImportingHelper.cs`
- `FE/src/utils/GlobalFunctions.ts`, the Project and Modification `ProjectDetailsForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumDetailsSection.tsx`
- `e2e/tests/category-validity-program-year.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`

## Verification
- Build; MYPS.UnitTests; MYPS.ApiIntegrationTests with `MYPS_HTTP_TEST_MYPSDB`.
- tsc against the 21 baseline.
- e2e on local myps_db_dev: the new spec plus the four `code-table-retired-*` specs. It fails on the pre-#488 API.

## Risks / Open Questions / Assumptions
- **Assumption:** Lump Sum *create* may not know the program year in the form before a program is chosen; it falls back to the current year, and the server uses the chosen program's StartYear.
- **Behaviour change:**
  - A Sub-Category whose Valid From is **after** the program year is now refused unless Active. Before, Valid From was ignored.
  - The importer now accepts a Sub-Category that ends **in** the program year, or is Active.
- **Assumption:** RBP and other multi-year programs use their StartYear, the same as the importer.
- **Stacked:** merge order is #483, then #485, then #486, then #487, then this one.

## Completion Log
Date: 2026-10-28
- **Implementation:**
  - `ProjectHelper`:
    - New `ThrustIsSelectable` (Active, or an inclusive window, 0 = open) and `ReferenceYear` (program StartYear, else today).
    - `ValidateCategoryAsync` and `ValidateThrustForCategoryAsync` take the program year; the Thrust check now loads by PAPKey and applies `ThrustIsSelectable`.
    - `ValidateProjectDetailsLookupsParams.ProgramYear`.
  - **Callers:**
    - AddProject: `ProgramParent.StartYear`.
    - UpdateProjectDetails: `CurrentProgramVersion.StartYear`.
    - CreateLumpSum: `Program.StartYear` (required fields, Region path and no-Region path).
    - UpdateLumpSum: `LumpSumProject.StartYear`.
    - RequestRevision: `ProgramParent.StartYear`.
    - ResubmitRevision: `ValidateProgram.Data.Program.StartYear`.
  - **Importer:** uses `CategoryIsSelectable` / `ThrustIsSelectable` with `programStartYear` (Thrust: inclusive, with the Active fallback).
  - **FE:** `validityYear`, `isCategoryValidForYear` and `isThrustValidForYear` in `GlobalFunctions`, used by the Project and Modification `ProjectDetailsForm` (Modification now destructures `initialData`, which the parent already passed) and by `LumpSumDetailsSection`.
  - **e2e fixture:** `createProgramAtBP` gains an optional `yearStart`; the default is unchanged.
  - **New e2e spec:** `category-validity-program-year.spec.ts` (2 tests).
- **Documentation:** `FE/UserManual.md` §5.7.6 has a new first bullet, "Valid means valid for the project's program year, not for today". `e2e/CLAUDE.md` has a coverage row.
- **Verification:**
  - Build clean; unit 71/71 (8 new); integration 88/88; tsc 21 before and after.
  - e2e 2/2, and 14/14 with all five specs, on local myps_db_dev.
  - Both tests fail on the pre-#488 API, which accepted a Category for program year +7 and a Sub-Category before its window.
  - Category 9 and Thrust 1049 restored; no programs left.

Deviations / flags:
- **AddProgram refuses a Year Start before the current year**, so the e2e can't make a past-year program. It uses future program years and moves the validity years through Code Tables instead. Past-year programs exist only in migrated or legacy data, which is exactly where this fix matters, for example a 2025 program revised in 2027.
- **Found while testing, not changed (pre-existing):**
  - ProgramPK is a per-second timestamp, so two AddProgram calls in the same second collide on `UQ_tPrograms_ProgramPK` ("DatabaseSaveFailure").
  - Local hand-made BP011/BP012 ProjectIds are ahead of the ID counter ("Project ID Collision Detected").
- **Not run at runtime:** Modification, Lump Sum and the importer (no fixtures). They're covered by build, unit tests and code reading.

Files changed:
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`
- `Hangfire/Importing/ImportingHelper.cs`
- `FE/src/utils/GlobalFunctions.ts`, the Project and Modification `ProjectDetailsForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumDetailsSection.tsx`
- `e2e/tests/category-validity-program-year.spec.ts` (new), `e2e/tests/helpers/crossStageFixture.ts`, `e2e/CLAUDE.md`, `FE/UserManual.md`, `documents/plans/validity-program-year-488.md`

### Code review (2026-10-28, /code-review medium): 10 findings, 5 fixed
- **Fixed:** the Modification form takes the program year from its parent's `programDetails` (new `programYear` prop), falling back to `initialData.ProgramDetails`, so a revision whose program the form already holds isn't judged for today.
- **Fixed:** RequestRevision now also checks the Sub-Category, for the program year, against the stored Category/Sub-Category snapshot (an untouched pair is skipped). It never checked it before.
- **Fixed:** the importer goes through `ReferenceYear(programStartYear)` like everything else.
- **Fixed:** the `filterKeepingSelected` comment is back above `filterKeepingSelected`.
- **Fixed:** Lump Sum computes the year once.
- **Not changed:**
  - The FE dropdowns stay validity-only (not "Active or valid"), as documented in §5.7.6.
  - ResubmitRevision's Sub-Category check already runs only on a change.
  - The Valid From check is a deliberate new rule (inclusive window), and Category can't change on Update ("Category Locked").
  - Lump Sum keeps a selected value when the program changes (standard filterKeepingSelected).
  - `StartYear ?? 0` falls back to today by design.
- **Re-verified:** build clean; unit 71/71; integration 88/88; tsc no new errors; e2e 14/14 (all five specs) on local myps_db_dev, with data restored.
