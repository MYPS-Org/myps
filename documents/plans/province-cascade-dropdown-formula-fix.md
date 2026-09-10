# Plan: Formula-Driven Province Cascades in the Import Workbook Builder

Status: Implemented
Created: 2026-09-10
Source: In-conversation request, refined after exploration on branch `feature/optimize-workbook-dropdown` (based off `dev-trunk`)

## Goal

Make the 6 Province/DEO-dependent PROJECT DETAILS dropdowns (City Municipality, Legislative District, Region, District Engineering Office, Implementing Office, Operation Unit) resolve correctly on every row via a native Excel formula, instead of being wired per-row at generation time — so blank template rows, hand-added rows, and macros-disabled files all get correct filtering instead of silently falling back to free text. Also correct Implementing Office/Operating Unit's candidate lists to be scoped to the row's specific DEO (matching the real validator), instead of unioned across every DEO in the province.

## Context

The user asked to "optimize the dropdown in workbook (download template and generated error excel)." Exploration showed the premise behind the original framing didn't hold: the static file at `Main/Resources/Internal/Templates/ImportProjectTemplate.xlsm` is dead code — no controller serves it, and `Main/Resources/Internal/index.ts`'s reference to it has no consumer in the frontend. The real "Download Template" button (`ImportingController.cs:429-447`, `DownloadTemplate`) already calls the exact same `ImportErrorWorkbookBuilder.Build(...)` used to generate the post-import error report, just with all four error-row lists empty. Template and error-report already share one builder.

That dig surfaced a real, narrower gap instead. In `ImportErrorWorkbookBuilder.cs`, PROJECT DETAILS' 11 flat dropdowns (Tier, Category, Province, etc.) are wired with `AddColumnListValidation` — one rule covering the whole column (`row 2 : ExcelPackage.MaxRows`), so every row, including ones a user adds later, gets the dropdown automatically. The 6 Province-dependent fields work differently: `AddListValidation` is called **per error row, at generation time**, keyed off that row's *own already-known* Province value (lines ~526-536). A blank template has zero error rows, so none of those 6 columns get a dropdown at all — the only thing that ever attaches one is the `Worksheet_Change` VBA macro's `ApplyCascadeCell`, which fires retroactively when a user edits Province in a row, and only if macros are enabled.

This silently degrades to free-text entry for 6 of the 17 lookup-backed PROJECT DETAILS fields whenever: (a) the user is filling out the blank downloadable template, (b) the user adds a new row below the pre-filled rows in a downloaded error report, or (c) VBA macros are disabled — a real possibility on DPWH-managed machines, per the original cascading-dropdown plan's own risk notes (`documents/plans/import-error-report-cascading-dropdowns.md`). This contradicts that original plan's intended acceptance criterion ("Province-filtered dropdowns still resolve correctly... only the auto-clear-on-change behavior requires macros enabled") — the shipped implementation diverged from that design (no `INDIRECT`/`SUBSTITUTE` formula exists in the current code, despite the completion log describing one).

**Second, related bug found while designing the fix.** The real validator (`ImportingHelper.cs:417,425`) resolves Implementing Office and Operating Unit like this:

```csharp
var ImplementingOffice = cache.ImplementingOffices.FirstOrDefault(x => (NamesMatch(x.Name, Region.Name) || NamesMatch(x.Name, Deo.Name)) && x.RegionParticipantId == Province.RegionParticipantId);

var OperatingUnit = NamesMatch(details.OperatingUnit, "Central Office") ?
    cache.OperatingUnits.FirstOrDefault(x => NamesMatch(x.Name, "Central Office")) :
    cache.OperatingUnits.FirstOrDefault(x => (NamesMatch(x.Name, Region.Name) || NamesMatch(x.Name, Deo.Name)) && x.RegionParticipantId == Province.RegionParticipantId);
```

The match is scoped to that row's own specific `Region`/`Deo` pair. But `ImportErrorWorkbookBuilder.cs`'s current per-province grouping (~337-347) unions ImplOffice/OpUnit candidates across **every** DEO in the province (`deoNames.Any(d => NamesMatch(o.Name, d))`), not just the one DEO actually selected in that row. That lets a user pick an office that's valid for a *different* DEO in the same province — a value the dropdown offers but the validator will still reject. This plan corrects the grouping to be DEO-scoped, matching the validator exactly, at the same time as switching these two columns to formula-driven cascades.

## Acceptance Criteria

As a program administrator downloading a blank import template or fixing a failed import, I want the Province-dependent dropdowns (City Municipality, Legislative District, Region, District Engineering Office, Implementing Office, Operation Unit) to work on every row — including blank template rows and rows I add myself — without needing macros enabled, so that I'm never silently left with free-text entry on fields that will fail re-validation if mistyped.

- [ ] A freshly downloaded blank template (`DownloadTemplate`, 0 error rows) has working, correctly Province-filtered dropdowns on all 6 fields for every row up to Excel's max row, with VBA macros **disabled**.
- [ ] A row added by hand below the pre-filled rows in a downloaded error-report workbook gets the same correctly Province-filtered dropdown behavior, with macros disabled.
- [ ] Existing pre-filled error rows keep showing the same correct per-row filtered list they do today (no regression from the generator's perspective).
- [ ] A dependent cell in a row whose Province is still blank/unset shows no dropdown items (or the full unfiltered case, whichever reads better) — never an Excel "the list source evaluates to an error" prompt.
- [ ] With macros **enabled**, changing a row's Province still clears any of the 6 dependent cells whose current value is no longer valid for the new Province (existing UX preserved).
- [ ] Implementing Office and Operating Unit dropdown candidates are scoped to the row's own selected District Engineering Office (matching that DEO's name or its Region's name, per `ImportingHelper.cs:417,425`), not unioned across every DEO in the province — a value offered in the dropdown must always pass re-validation. Operating Unit continues to always offer "Central Office" regardless of DEO.
- [ ] Opening the generated file (blank template or error report) in Excel still produces no "we found a problem with some content" repair prompt.
- [ ] The Category→Thrust cascade (Sub-Category field) and the cascades on FUNDING PROFILE, COMPONENT DETAILS, and MAJOR ITEMS OF WORK are left exactly as they are today — explicitly out of scope for this change.
- [ ] Workbook generation time/row count for a large error import (e.g. 500+ rows) does not regress — expected to improve, since per-row validation objects for 6 columns are replaced by one column-wide rule each.

## Approach

**Lookup addition.** In `BuildLookupSheet`, add one small two-column table + defined name, `ProvinceKeyMap` (Province.Name → `SanitizeKey(Province.Name)`), built inside the existing per-province loop (~line 317-348) that already computes `key` for the grouped lists — reuse that same value rather than recomputing it. Also add one empty defined name (e.g. `EmptyList`, a single blank cell) to use as a safe fallback.

**Column-wide cascade formula.** Add a new helper alongside `AddColumnListValidation`/`AddListValidation` (~line 561-593), e.g. `AddColumnCascadeValidation(ws, col, provinceCellAddress, prefix)`, that applies one Data Validation List rule over `row 2 : ExcelPackage.MaxRows` for a cascading column, with a formula shaped like:

```
=IFERROR(INDIRECT(prefix & VLOOKUP($<ProvinceCol>2, ProvinceKeyMap, 2, 0)), EmptyList)
```

using a column-absolute/row-relative reference to that row's own Province cell (`$J2` style) so Excel's standard per-row-relative behavior for range-applied Data Validation resolves it correctly on every row, matching how Excel already applies range-wide conditional-formatting-style formulas.

**Wire it in.** In `BuildProjectDetailsSheet`, delete the per-row block (~526-536) that calls `AddListValidation` six times per error row for City/District/Region/Deo/ImplOffice/OpUnit. Replace with six calls to the new column-wide helper — City/District/Region/Deo keyed off the row's Province cell via `ProvinceKeyMap`, ImplOffice/OpUnit keyed off the row's DEO cell via `DeoKeyMap` — placed next to the existing flat `AddColumnListValidation` calls (~546-556). The per-row `SanitizeKey(...)` computation for these 6 fields goes away entirely — cells are just written with their plain value as today; the dropdown is now purely formula-resolved.

**Simplify the macro.** In the PROJECT DETAILS `Worksheet_Change` (~1414-1422), the Province branch currently calls `ApplyCascadeCell` six times, which clears the cell **and** re-authors `.Validation` per cell. Since the column-wide formula never needs re-pointing, replace those six calls with a lighter helper (new `ModuleShared` sub, alongside `MakeValidName`/`ApplyCascadeCell`) that only clears the cell if its current value is no longer found in the resolved named range — no validation rewrite. Because ImplOffice/OpUnit now key off DEO instead of Province, the Province branch's clear-check for those two columns must be dropped (Province no longer determines their range) and a **new DEO branch** added that clear-checks ImplOffice/OpUnit against the DEO-keyed range when the user edits the DEO cell directly. Leave the Category branch (`ApplyCascadeCell` for Thrust) untouched, since Category→Thrust cascade is out of scope.

**Re-scope Implementing Office / Operating Unit to DEO, not Province.** In `BuildLookupSheet`'s per-province loop (~317-348), stop unioning ImplOffice/OpUnit candidates across `deoNames.Any(...)`. Instead, add a second grouping pass over `cache.DEOs` (keyed by `SanitizeKey(deo.Name)`, union-on-collision like the existing province grouping): for each DEO, resolve its own province and that province's Region, then filter `cache.ImplementingOffices`/`cache.OperatingUnits` by `RegionParticipantId == province.RegionParticipantId && (NamesMatch(x.Name, region.Name) || NamesMatch(x.Name, deo.Name))` — exactly mirroring `ImportingHelper.cs:417,425`. Write these as `ImplOff_{deoKey}`/`OpUnit_{deoKey}` (Operating Unit still gets `Central Office` concatenated unconditionally, as today). Add a `DeoKeyMap` defined name (DEO.Name → sanitized key), analogous to `ProvinceKeyMap`, so the cascade formula for these two columns can resolve the key from the row's own DEO cell instead of its Province cell. City, Legislative District, and Region dropdowns are unaffected — they stay keyed by Province, since the validator matches those directly against Province/ProvinceCode.

**Explicitly out of scope:** Category→Thrust (PROJECT DETAILS), and the analogous per-row/VBA cascades on FUNDING PROFILE (Source→Agreement), COMPONENT DETAILS (InfraType→WorkType, ProjectId→ComponentId autofill), and MAJOR ITEMS OF WORK. These share the identical architectural gap but were deliberately excluded from this plan's scope.

## Tasks

### Implementation
- Add `ProvinceKeyMap` (Province.Name → sanitized key, 2-column defined name) and an `EmptyList` fallback defined name to `BuildLookupSheet` in `Hangfire/Importing/ImportErrorWorkbookBuilder.cs`, reusing the per-province loop's existing `key` computation.
- Add `DeoKeyMap` (DEO.Name → sanitized key, 2-column defined name), built from a new DEO-keyed grouping pass.
- Rework the ImplOffice/OpUnit candidate lists: replace the province-wide `deoNames.Any(...)` union with a per-DEO grouping (keyed by `SanitizeKey(deo.Name)`, union-on-collision) that filters by `RegionParticipantId == province.RegionParticipantId && (NamesMatch(x.Name, region.Name) || NamesMatch(x.Name, deo.Name))`, mirroring `ImportingHelper.cs:417,425` exactly. Keep the unconditional `Central Office` concat for Operating Unit. City/District/Region groupings stay Province-keyed, unchanged.
- Add `AddColumnCascadeValidation` helper (or similarly named) near `AddColumnListValidation`/`AddListValidation`, building the `IFERROR(INDIRECT(...VLOOKUP...)), EmptyList)` formula with correct relative/absolute cell referencing — parameterized so it can key off either the Province cell (City/District/Region/Deo) or the DEO cell (ImplOffice/OpUnit).
- In `BuildProjectDetailsSheet`: remove the per-row City/District/Region/Deo/ImplOffice/OpUnit `AddListValidation` calls; add 4 Province-keyed and 2 DEO-keyed column-wide cascade calls next to the existing flat dropdown wiring.
- In `AuthorCascadeMacros`'s `ModuleShared` VBA module: add a clear-only helper (e.g. `ClearIfInvalidCell`) for stale-value clearing without re-authoring validation.
- In PROJECT DETAILS' `Worksheet_Change` VBA: swap the Province branch's `ApplyCascadeCell` calls for City/District/Region/Deo to the new clear-only helper; drop ImplOffice/OpUnit from the Province branch; add a new DEO-edit branch that clear-checks ImplOffice/OpUnit against the DEO-keyed range; leave the Category branch (Thrust cascade) unchanged.
- Manually verify in real Excel (not just code review): download the blank template with macros disabled, pick a Province on a blank row, confirm all 6 dependent dropdowns are already correctly filtered; re-enable macros and confirm stale-value auto-clear on Province change still works; confirm no repair-mode prompt on open; spot-check a large (500+ row) error import for generation time and correct per-row dropdown behavior.

### Documentation
- Update the existing dropdown/macro note in `FE/src/pages/Program/program.md` (added by the prior cascading-dropdown plan) to reflect that the 6 Province-filtered fields now resolve correctly without macros — only the auto-clear-of-stale-values behavior still requires macros enabled.

## Files / Components Touched
- `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` — `BuildLookupSheet`, `BuildProjectDetailsSheet`, `AuthorCascadeMacros`/`ModuleShared`, PROJECT DETAILS `Worksheet_Change`.
- `FE/src/pages/Program/program.md` — documentation update.

## Risks / Open Questions / Assumptions
- Relies on Excel's standard behavior of resolving relative references in a Data Validation formula per-cell when the rule is applied across a multi-row range (same mechanism conditional formatting uses). Well-established, but should be confirmed in real Excel during manual verification, not assumed from code alone.
- The `IFERROR`/`VLOOKUP` fallback for a blank or not-yet-matched Province/DEO needs a manual check that opening the dependent dropdown never triggers Excel's "list source evaluates to an error" prompt.
- DEO names are assumed unique enough that sanitizing to a shared key is rare; if two DEOs across different regions ever collide, their candidate lists are unioned (same rare-collision handling already used for province-name keys) rather than one silently overwriting the other.
- Since Implementing Office/Operating Unit now cascade off the DEO cell instead of the Province cell, the `Worksheet_Change` macro needs a DEO-edit branch (in addition to its existing Province and Category branches) to clear stale ImplOffice/OpUnit values when DEO changes — not just when Province changes.
- The same per-row/VBA-authored gap exists for Category→Thrust and for the FUNDING PROFILE/COMPONENT DETAILS/MAJOR ITEMS OF WORK cascades. Not fixed here per explicit scope decision — worth a follow-up plan if the macros-disabled gap matters for those fields too.
- The dead static `Main/Resources/Internal/Templates/ImportProjectTemplate.xlsm` file and its unused reference in `Main/Resources/Internal/index.ts` were discovered during exploration but are unrelated to this fix and are deliberately left untouched.
- `FE/src/pages/Program/program.md`'s "Known Notes / TODOs" table (line ~422) still says "`ActionsDropdown` → Download Template | TODO — handler only logs", which is stale — `handleDownloadTemplate`/`downloadImportTemplate()` are already wired and working. Noticed while updating the doc for this plan but left as-is since it's an unrelated pre-existing inaccuracy, out of this plan's scope.

## Completion Log
Date: 2026-09-10
- Implementation: In `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` — added `WritePairTable` and built `ProvinceKeyMap`/`DeoKeyMap` (Name → `SanitizeKey(Name)`, one 2-column defined Name each) plus an `EmptyList` fallback in `BuildLookupSheet`. Replaced the per-province `ImplOffices`/`OpUnits` union (which matched against *any* DEO in the province) with a new per-DEO grouping (`deoGrouped`, keyed by `SanitizeKey(deo.Name)`) that filters `RegionParticipantId == deoProvince.RegionParticipantId && (NamesMatch(Region.Name) || NamesMatch(Deo.Name))`, mirroring `ImportingHelper.cs:417,425` exactly; `ImplOff_<deoKey>`/`OpUnit_<deoKey>` replace the old `ImplOff_<provinceKey>`/`OpUnit_<provinceKey>` names (Operating Unit still gets `Central Office` concatenated unconditionally). Added `AddColumnCascadeValidation` + a `ColumnLetter` helper in `BuildProjectDetailsSheet`, and rewired City/District/Region/DEO (keyed off the row's Province cell via `ProvinceKeyMap`) and Implementing Office/Operating Unit (keyed off the row's DEO cell via `DeoKeyMap`) to whole-column `IFERROR(INDIRECT(prefix&VLOOKUP(parentCell,keyMap,2,0)),EmptyList)` formulas, deleting the old per-error-row `AddListValidation` calls for those six columns entirely. In `AuthorCascadeMacros`'s `ModuleShared` VBA module, added `ClearIfInvalidCell` (clears a cell's value if no longer found in the named range, without touching `.Validation`). Rewrote PROJECT DETAILS' `Worksheet_Change`: the Province branch now calls `ClearIfInvalidCell` for City/District/Region/DEO, then re-derives the (possibly just-cleared) DEO's key and clear-checks Implementing Office/Operating Unit against it too (so a Province change transitively invalidates a now-stale office/unit even though they key off DEO, not Province); a new DEO-edit branch clear-checks Implementing Office/Operating Unit directly when DEO is edited by hand. The Category→Thrust branch (`ApplyCascadeCell`) is untouched, as planned. Verified `dotnet build Hangfire/Hangfire.csproj` compiles with 0 errors (pre-existing warnings only, none in this file).
- Documentation: Updated the dropdown/macro note under `ImportProjectsJobDialog` in `FE/src/pages/Program/program.md` to describe the corrected City/District/Region/DEO-by-Province vs. Implementing Office/Operating Unit-by-DEO split, and to state the INDIRECT/VLOOKUP formulas now resolve on every row (including the downloadable blank template and hand-added rows) without macros.
Deviations / flags:
- `ProvinceKeyMap`/`DeoKeyMap` are built as standalone `GroupBy`-deduplicated tables directly from `cache.Provinces`/`cache.DEOs` (via the new `WritePairTable` helper) rather than threaded through the existing per-province loop's `key` variable as the plan's Approach section literally described — functionally identical (same `SanitizeKey` output), just simpler to keep as one self-contained block.
- **Not done — requires real Excel, unavailable in this environment**: the plan's manual verification task (blank template with macros disabled, stale-value auto-clear with macros enabled, no repair-mode prompt on open, large-import spot check). The code compiles and the formula/VBA logic was reasoned through carefully, but this has not been opened in Excel. Recommend doing this before merging.
Files changed: `Hangfire/Importing/ImportErrorWorkbookBuilder.cs`, `FE/src/pages/Program/program.md`.

## Code Review Follow-up
Date: 2026-09-10
`/code-review` found 4 issues; 3 fixed, 1 left as a documented risk (requires real Excel, not fixable in code):
- **Fixed** — `SanitizeKey` used `char.IsLetterOrDigit` (Unicode-aware) while its own doc comment and the VBA twin `MakeValidName` both specify ASCII-only `[A-Za-z0-9_]`; changed to an explicit ASCII range check so a non-ASCII Province/DEO name (e.g. containing 'ñ') sanitizes identically on both sides. This was a pre-existing divergence, newly exposed to DEO names by this change.
- **Fixed** — `ColumnLetter` duplicated an existing private helper in `ImportProjectJobService.cs`; made `ImportErrorWorkbookBuilder.ColumnLetter` `internal` and had `ImportProjectJobService` call it instead of keeping its own copy.
- **Fixed** — the `ClearIfInvalidCell` pair for Implementing Office/Operating Unit was duplicated between the Province and DEO branches of `Worksheet_Change`; factored into a shared `ModuleShared.ClearImplOfficeAndOpUnit` VBA sub.
- **Not fixed (no code change possible)** — the whole-column cascade relies on Excel resolving a row-relative reference (`$J2`) per-row when one Data Validation rule spans `row2:MaxRows`, which is the same unverified-in-real-Excel risk already flagged above. Confirmed compiling (`dotnet build`, 0 errors) after all fixes.

## Real-Excel Verification — Bug Found and Fixed
Date: 2026-09-10
User downloaded a live template (`DownloadTemplate`) and reported City/Legislative District/Region/DEO/Implementing Office/Operating Unit dropdowns showing **no items at all, no error** — confirming the row-relative-reference mechanism itself does work (ruling out finding #1 above), but surfacing a different, real bug.

Diagnosis (via direct `.xlsm` XML inspection — unzipped the file, cross-checked every `ProvinceKeyMap`/`DeoKeyMap` entry against its `City_`/`Dist_`/`Reg_`/`Deo_`/`ImplOff_`/`OpUnit_` defined name: 100% consistent, zero missing/mismatched) plus one user-run test: pasting `=IFERROR(INDIRECT("City_"&VLOOKUP($J2,ProvinceKeyMap,2,0)),"FAIL")` into a normal cell correctly "spilled" the full, correct city list for the row's Province — proving the VLOOKUP/INDIRECT logic and underlying data were both correct.

Root cause: `IFERROR(INDIRECT(...), EmptyList)` was the Data Validation List source formula. Excel only allows a specific whitelist of functions (`IF`, `CHOOSE`, `INDEX`, `INDIRECT`, `OFFSET`) to return a genuine *Reference* usable as a Data Validation list source. `IFERROR` is not on that whitelist — wrapping `INDIRECT` in it silently degrades the result to a plain array of values instead of a walkable range reference, so Data Validation shows an empty dropdown with no error, even though the exact same expression evaluates correctly as a normal formula.

Fix: changed `AddColumnCascadeValidation` (`ImportErrorWorkbookBuilder.cs`) from `IFERROR(INDIRECT(...), EmptyList)` to `IF(ISERROR(VLOOKUP(...)), EmptyList, INDIRECT("<prefix>"&VLOOKUP(...)))` — `IF` is on the reference-preserving whitelist, so it keeps `INDIRECT`'s reference-ness intact through the wrapper. This is the standard, documented workaround for this Excel limitation. Rebuilt clean (0 errors). Still needs the user to re-download a template and confirm the dropdowns now populate.
