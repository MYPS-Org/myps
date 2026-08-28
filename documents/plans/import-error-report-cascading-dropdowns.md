# Plan: Cascading-Dropdown Error Report for Project Import

Status: Implemented
Created: 2026-08-27
Source: In-conversation request (branch `import-error-report-cascading-dropdowns`, based off `merging-branch-import-to-revision-xlsm`)

## Goal

Replace `GenerateExcelReport` with a generator that builds a fresh `.xlsm` containing only error rows, and equips PROJECT DETAILS' lookup-backed columns with dropdowns — cascading by Province where the validator itself scopes by Province — plus a `Worksheet_Change` macro that clears stale dependent values when Province changes.

## Context

The import job's error report (`GenerateExcelReport` in `Hangfire/Services/ImportProjectJobService.cs`) started as a fresh, from-scratch workbook containing only failed rows. Mid-session we switched it to reuse the uploaded workbook in place (hiding non-error rows instead of writing a new file) specifically to preserve the *user's own* macros from the source `.xlsm`. That reuse approach turned out to have real problems: `DeleteRow` corrupted the file (Excel's "found a problem with content" repair prompt); once switched to `Hidden` it stopped corrupting, but the output file's size/row count then scaled with the *original* upload (100k+ rows hidden, not deleted), and any whole-sheet operation (column autofit) had to be specially guarded to avoid re-scanning all of them.

The user now wants a different, more ambitious design: stop trying to preserve the original file's macros at all, and instead generate a small, purpose-built `.xlsm` containing only the error rows, with Excel dropdowns (sourced from the same `ImportLookupCache` lookups the validator already uses) on the lookup-backed PROJECT DETAILS columns, cascading so that picking a Province filters City/District/Region/DEO/etc. to just the valid options — plus a macro that clears a dependent field if it's no longer valid after its parent changes. This directly helps the person fixing errors pick correct values instead of re-typing free text and re-failing validation.

This supersedes the reuse/hide design entirely — we're no longer trying to preserve the source file's own macros, we're authoring a new one. That also incidentally fixes the earlier performance/corruption risk, since the new workbook only ever contains the (typically small) set of error rows, not the full original dataset.

## Acceptance Criteria

As a program administrator fixing a failed project import, I want the downloaded error workbook to offer valid-value dropdowns (filtered by the row's Province where relevant) instead of blank text cells, so that I can correct rows without re-guessing spellings that will just fail validation again.

- [ ] The error report is a brand-new `.xlsm` (not derived from the uploaded file) containing only error rows, across all four sheets (PROJECT DETAILS, FUNDING PROFILE, COMPONENT DETAILS, MAJOR ITEMS OF WORK).
- [ ] On PROJECT DETAILS, these 11 non-cascading fields have a Data Validation dropdown sourced from their matching `ImportLookupCache` list: Tier, Category, Sub-Category (Thrust), Region Wide, Origin, Originating Agency, Implementation Mode, Emergency Mode, ROW Available, Feasibility Study, Detailed Design. A value outside the list is rejected by Excel.
- [ ] Province itself has a flat dropdown of all provinces.
- [ ] These 6 fields have a dropdown filtered to only the values valid for that row's currently-selected Province, mirroring `ValidateProjectDetails`'s own scoping: City Municipality, Legislative District, Region, District Engineering Office, Implementing Office, Operation Unit.
- [ ] Changing a row's Province clears any of those 6 dependent cells whose value is no longer in the refreshed list (via an authored `Worksheet_Change` macro).
- [ ] With macros left disabled, the Province-filtered dropdowns still resolve correctly (native Data Validation + `INDIRECT`, not VBA) — only the auto-clear-on-change behavior requires macros enabled.
- [ ] Opening the generated file in Excel produces no "we found a problem with some content" repair prompt.
- [ ] FUNDING PROFILE, COMPONENT DETAILS, and MAJOR ITEMS OF WORK keep the existing plain layout (headers + error-row values + trailing "Error(s) and Warning(s)" column) — no dropdowns added to those sheets in this iteration.
- [ ] Report generation time/memory scales with the number of *error* rows, not the original upload's total row count.
- [ ] The now-superseded reuse/hide code (row-hiding loop, per-sheet fixed message-column constants, column-width-cap loop, `RowIndex` tracking on the four DTOs) is removed rather than left dead.

## Approach

**Package construction.** `GenerateExcelReport` goes back to building `new ExcelPackage()` (no longer takes the parsed `package` — it instead needs `ImportLookupCache cache`, already loaded once per job in `RunImportAsync`). Call `pkg.Workbook.CreateVBAProject()` up front so both the Data Validation setup and the VBA module have a project to attach to. Output extension is unconditionally `.xlsm` now (we always author a macro), simplifying the `excelExtension` check in `RunImportAsync` back to a constant.

**Lookup sheet.** A new hidden worksheet (e.g. `_Lookups`) holds the option lists EPPlus needs as Data Validation sources, each wrapped in a defined Name:
- Flat lists (one column each, one Name each): Tiers (`.Name`, matched with the existing Roman-numeral/`"Tier"`-prefix normalization already in `ImportingHelper` — reuse that normalization when building the list so displayed values match exactly what the validator accepts), Categories (`.CategoryName`), Thrusts (`.ThrustDescription`), Provinces (`.Name`), RegionWides, Origins, Agencies, ImplementationModes, EmergencyModes, RowAvailables, FeasibilityStudies, DetailedDesigns (all `.Name`).
- Grouped-by-Province lists, one Name per province (sanitized: spaces/invalid characters stripped, since Excel Names must be valid identifiers): Cities (`.ProvinceCode`), Districts (`.ProvinceCode`), a single-value "Region for this Province" list (derived via `Province.RegionParticipantId` → matching `Region.Name`, same as the validator), DEOs (`.ProvinceCode`), and ImplementingOffice/OperatingUnit candidates for the Region derived from that Province (matched by Region.Name/DEO.Name the same way `ValidateProjectDetails` does, plus OperatingUnit's `"Central Office"` literal). Reuse whatever grouping/derivation logic already exists in `ImportingHelper.cs` rather than reimplementing the matching rules — a mismatch here would let a user pick a dropdown value that still fails re-validation.

**Row/validation wiring.** For each error row written to PROJECT DETAILS: flat-field cells get `ws.DataValidations.AddListValidation(cellAddress).Formula1.ExcelFormula = "<DefinedName>"`; the 6 Province-dependent cells get an `INDIRECT` formula keyed off that row's own sanitized Province cell (the standard Excel dependent-dropdown pattern) so the visible list is always scoped to whatever Province is currently in that row.

**Macro.** `pkg.Workbook.Worksheets["PROJECT DETAILS"].CodeModule.Code` gets a `Worksheet_Change(ByVal Target As Range)` procedure: if the changed cell is in the Province column on a data row, loop the 6 dependent columns on that row and `ClearContents` any whose current value isn't in the (now-refreshed) validation list. Wrap in `Application.EnableEvents = False/True` to avoid re-entrancy. This macro is a pure UX nicety layered on top of validation that already works without it — degradation is graceful if the workbook's macros are disabled (a real possibility for DPWH-managed machines).

**Other 3 sheets.** Kept close to the very first (pre-session) implementation: fixed header row per sheet (reuse the literal header labels from the original hardcoded version), write only error rows, trailing message column — no dropdowns, no lookup sheet involvement.

**Cleanup.** Remove the reuse/hide-specific code that this supersedes: the `RowIndex` property on the four DTOs in `Hangfire/Importing/DTOImporting.cs` (and its assignment in the four `Read*` methods) since nothing needs original-row tracking once we're writing a fresh sheet sequentially again; the `FilterSheetToErrors` local function, hidden-row loop, and column-width-cap loop in `ImportProjectJobService.cs`; the `package.Workbook.VbaProject != null` extension check in `RunImportAsync`.

**File organization.** Given how much new logic this adds (lookup-sheet construction, per-province name generation, data validation wiring, VBA authoring), pull it out of the already-large `ImportProjectJobService.cs` into a new helper, e.g. `Hangfire/Importing/ImportErrorWorkbookBuilder.cs`, exposing something like `BuildErrorWorkbook(cache, errorProjectDetails, errorFundingProfile, errorComponentDetails, errorMajorItemsOfWork)` returning the `ExcelPackage` (or bytes). `ImportProjectJobService.GenerateExcelReport` becomes a thin call into it.

## Tasks

### Implementation
- Build the hidden `_Lookups` sheet + defined Names: flat lists, plus per-province grouped lists for City/District/Region/DEO/ImplementingOffice/OperatingUnit, reusing `ImportingHelper.cs`'s existing matching/derivation rules (Tier normalization, Province→Region derivation, Region/DEO-name matching for ImplementingOffice/OperatingUnit).
- Write the Excel-name sanitizer (strip invalid characters, dedupe, respect the ~255-char/no-leading-digit rules) used for the ~90+ per-province/region names.
- Rewrite the PROJECT DETAILS sheet builder: headers/styling, error-row-only population, Data Validation wiring for all 17 lookup-backed fields (11 flat + Province + 6 cascading).
- Author the VBA project + PROJECT DETAILS `Worksheet_Change` macro (clear stale dependents on Province change).
- Rewrite FUNDING PROFILE / COMPONENT DETAILS / MAJOR ITEMS OF WORK sheet builders to the original plain header+error-rows+message-column shape (no reuse-based hiding).
- Update `RunImportAsync`'s call site (`Hangfire/Services/ImportProjectJobService.cs`): pass `cache` instead of `package`, hardcode `.xlsm` extension.
- Remove now-dead reuse/hide code: `RowIndex` (DTOImporting.cs + the four `Read*` methods), `FilterSheetToErrors`/hide-loop/column-width-cap code in `ImportProjectJobService.cs`.
- New file `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` housing the above sheet/lookup/macro construction, keeping `ImportProjectJobService.cs` a thin caller.

### Documentation
- Update `FE/src/pages/Program/program.md` (or wherever the import/error-report shape is documented) to describe the new dropdown/macro-equipped PROJECT DETAILS sheet and the "macros disabled → dropdowns still filter, auto-clear doesn't fire" caveat for end users.

## Files / Components Touched
- `Hangfire/Services/ImportProjectJobService.cs` — `GenerateExcelReport` becomes a thin wrapper; call-site update in `RunImportAsync`.
- `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` (new) — lookup sheet, dropdown wiring, VBA authoring, all 4 sheet builders.
- `Hangfire/Importing/DTOImporting.cs` — remove `RowIndex` from the four Excel DTOs.
- `Hangfire/Importing/ImportingHelper.cs` — read-only reference for the exact matching/derivation rules to mirror (Tier normalization, Province→Region, Region/DEO name-matching); no behavior change expected here, but flag during implementation if any shared helper needs extracting to avoid duplicating logic.
- `FE/src/pages/Program/program.md` — documentation update.

## Risks / Open Questions / Assumptions
- **Original upload's own macros are no longer preserved in the error report.** This reverses the goal from earlier in the session (reuse the uploaded workbook specifically to keep its macros). Flagging explicitly since it's a real behavior change, not an oversight — the new workbook is purpose-built and only carries the macro we author for dropdown UX.
- **Re-upload behavior changes**: since the new report contains *only* error rows (not the full original dataset, hidden or otherwise), re-uploading it after fixes will only resubmit the corrected rows — previously-valid rows from the original upload are no longer riding along. Confirm this is the intended re-upload model (it matches the very first pre-session design).
- **EPPlus VBA authoring** writes module source only (no precompiled p-code); Excel recompiles on first open. This is standard/working practice but should be verified end-to-end in real Excel, not just "it doesn't corrupt."
- **Dropdown/validator fidelity**: the dropdown option lists must exactly mirror what `ValidateProjectDetails` accepts (especially Tier's Roman-numeral normalization and the Region/DEO name-matching for ImplementingOffice/OperatingUnit) — any drift lets a user pick a value from the dropdown that still fails on re-import.
- **Excel Name volume**: roughly 87 provinces × ~4 dependent lists (City/District/DEO/Region-or-office-set) ≈ 350+ defined Names, plus flats. Should be fine for Excel's limits, but worth a sanity check at implementation time.
- **Macro-security posture**: DPWH-managed machines may have VBA disabled by policy — by design, dropdown filtering still works via `INDIRECT` without macros; only the auto-clear-on-change nicety needs them enabled. Worth confirming this degradation is acceptable rather than a blocker.

## Completion Log
Date: 2026-08-27
- Implementation: Added `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` — builds a fresh `.xlsm` via `ExcelPackage` + `CreateVBAProject()`, a hidden (`VeryHidden`) `_Lookups` sheet with 12 flat defined Names plus 6 per-province defined Names (City/District/Region/DEO/ImplementingOffice/OperatingUnit, ~87 provinces × 6 ≈ 520 names) built by mirroring `ValidateProjectDetails`'s own scoping (ProvinceCode FKs, Province→Region derivation via `RegionParticipantId`, Region/DEO name-matching for ImplementingOffice/OperatingUnit, plus the "Central Office" literal), an Excel-Name sanitizer (8 chained character substitutions applied identically in C# and in the generated `INDIRECT`/`SUBSTITUTE` formula chain), the PROJECT DETAILS sheet builder with all 17 lookup-backed dropdowns (11 flat + Province + 6 Province-filtered via `INDIRECT`), the three plain sheets (FUNDING PROFILE/COMPONENT DETAILS/MAJOR ITEMS OF WORK) rebuilt to their original header+error-row+message-column shape, and an authored `Worksheet_Change` VBA macro (via `ws.CodeModule.Code`) that clears a dependent cell when it's no longer in its (INDIRECT-refreshed) validation list after Province changes. Updated `ImportProjectJobService.RunImportAsync` to call `ImportErrorWorkbookBuilder.Build(cache, ...)` instead of the old in-place reuse/hide `GenerateExcelReport`, and hardcoded the output extension to `.xlsm`. Removed the now-dead `RowIndex` property from the four Excel DTOs (`DTOImporting.cs`) and its assignment in the four `Read*` methods, and removed the old `GenerateExcelReport`/`FilterSheetToErrors` hide-row/column-width-cap code from `ImportProjectJobService.cs`.
- Documentation: Added a note under `ImportProjectsJobDialog` in `FE/src/pages/Program/program.md` describing the new dropdown/macro-equipped error workbook and the macros-disabled degradation behavior.
Deviations / flags: None from the approved architecture. One extra fact surfaced during implementation (documented here for future reference, not a plan change): `ValidateProjectDetails` actually resolves Province *from* the typed Legislative District (District→ProvinceCode), using the typed Province only as an ambiguity-scoring tiebreaker when a district name matches multiple provinces — it does not look up Province against its own list directly. This doesn't change the dropdown design (filtering City/District/Region/DEO/ImplementingOffice/OperatingUnit by a dropdown-selected Province remains correct, since District→ProvinceCode is a stable FK either direction), but explains why Province appears to be "derived" rather than "matched" in that method.
Files changed: `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` (new), `Hangfire/Services/ImportProjectJobService.cs`, `FE/src/pages/Program/program.md`. (`Hangfire/Importing/DTOImporting.cs` was edited but nets to no diff against HEAD — the `RowIndex` field was added and then removed again within this same branch's uncommitted history.)
