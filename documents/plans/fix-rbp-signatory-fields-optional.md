# Plan: Make Planning Engineer / Approver / Reviewer optional on RBP + RBP Summary reports (#422)

Status: Implemented
Created: 2026-10-23
Source: Issue #422 ([UAT][S08] [S08-TC002-P001]) — Planning Engineer, Approver and Reviewer fields should not be mandatory (scope expanded to also cover rbp-summary-report / rbp-summary-report-with-tier per follow-up request)

## Context

Issue #422 (test case S08-TC002-P001): originally scoped to the plain "RBP (Regional Budget Proposal)" PDF report (report key `rbp`). The user has since asked to extend the same relaxation to `rbp-summary-report` and `rbp-summary-report-with-tier` too, so all three PDF reports treat these fields consistently. This is **not** the RBP Summary data-filtering issue from #423 (separate, already-fixed branch) — #422 is purely about field requiredness, orthogonal to #423's data/SQL fix, and this branch was created from `main` so it doesn't include #423's changes (confirmed not needed — see below).

Investigation (via targeted codebase searches this session) traced the enforcement through every layer, for both report groups:

**`rbp` (already optional at FE/WebAPI, blocked only by Crystal):**
- **FE** (`FE/src/pages/Reports/Reports.tsx`): already optional — no red asterisk, placeholder "Optional," blank values become `undefined` (lines 334-336), and the blocking validation at line 373 is scoped to `case 'rbp-summary':` only.
- **WebAPI** (`ReportRequestMapper.cs`, `MapRbp`, lines 87-118): already optional — only `YearStart`/`ProgramIds`/`RegionCode` validated; signatories use `AddOptional(...)`. Comment at 44-47 confirms intentional.
- **CrystalReportService**: `rbp`'s SQL `Parameters` list doesn't include these 3 at all. The sole blocker is `ApplyReportLevelParameters` (lines 820-871), which throws if **any** report-level parameter the loaded `.rpt` defines isn't supplied — no opt-out exists. `RBP.rpt` defines `@PlanningEngineer`, `@ReviewdBy` (sic, existing typo), `@ApprovedBy`, `@ReviewedBy` as report-level parameters (PascalCase).

**`rbp-summary-report` / `rbp-summary-report-with-tier` (required by explicit design at every layer):**
- **WebAPI** (`ReportRequestMapper.cs`, `MapRbpSummary`, lines 48-85): explicitly rejects the request if blank — `if (string.IsNullOrWhiteSpace(request.PlanningEngr)) return Fail(..., "planningEngr is required.")` (lines 68-69), same pattern for `ReviewedBy` (71-72) and `ApprovedBy` (74-75). `YearStart`/`RegionCode`/`ProgramId` (lines 59-66) stay required — unaffected by this change.
- **FE** (`Reports.tsx`): `case 'rbp-summary':` blocks submission client-side (lines 373-379: `if (!planningEngineer.trim() || !approvedBy.trim() || !reviewedBy.trim())`, shows an error toast, returns early) and shows a red asterisk + non-"Optional" placeholder for all 3 fields (lines 561/567, 574/580, 587/593).
- **CrystalReportService**: confirmed these 2 reports' `Parameters` lists (SQL) don't include the 3 signatories either — same as `rbp`, they're report-level-only. Per `CRYSTAL_REPORT_GENERATION.md` lines 104-105, these `.rpt` files use **camelCase** names — `@planningEngr`, `@reviewedBy`, `@approvedBy` (not `rbp`'s PascalCase `@PlanningEngineer`/`@ReviewdBy`/`@ApprovedBy`/`@ReviewedBy`) — a documented naming difference between the two `.rpt` families.
- **Existing test**: `MYPS.UnitTests/ReportRequestMapperTests.cs:129-140`, `Map_RbpSummary_MissingPlanningEngr_Fails`, explicitly asserts the current required behavior and will need to be replaced (there's no equivalent "missing fails" test for `rbp`, since it's already optional there).

Since the renderer's SQL `Parameters` lists for all 3 reports were never involved in requiredness (confirmed by direct read — they only carry `yearstart`/`programid`/`region`), this plan needs no dependency on #423's branch/changes at all.

## Goal

Generating `rbp`, `rbp-summary-report`, and `rbp-summary-report-with-tier` with Planning Engineer / Approver / Reviewer left blank succeeds at every layer (FE doesn't block, WebAPI doesn't reject, Crystal doesn't throw) and produces a PDF with those fields rendered empty.

## Acceptance Criteria

As a BP reviewer, I want to generate RBP and RBP Summary reports without being forced to fill in Planning Engineer, Approver, and Reviewer, so that I can produce reports before all three sign-offs are known.

- [ ] `rbp`: calling with all 3 signatories omitted succeeds end-to-end (was already true at FE/WebAPI; this plan fixes the remaining Crystal-layer block).
- [ ] `rbp-summary-report` and `rbp-summary-report-with-tier`: calling with all 3 signatories omitted succeeds end-to-end — FE no longer blocks submission or shows them as required, WebAPI's `MapRbpSummary` no longer rejects the request, and Crystal doesn't throw.
- [ ] All 3 reports: the resulting PDF renders with blank signature-block fields when omitted, not an error.
- [ ] All 3 reports: supplying real values for any/all 3 still works exactly as before (regression check) — values appear in the signature block.
- [ ] `yearstart`/`programid`/`region` (and `yearStart`/`regionCode`/`programId` at the WebAPI layer) remain required exactly as before for all 3 reports — this change is scoped only to the three signatory fields.
- [ ] The other 5 report types (`extract-pcmiow`, 4 AIP variants) are unaffected — their report-level parameter requirements stay exactly as strict as today.

## Approach

Three coordinated changes, one per layer, applied to all 3 reports:

1. **CrystalReportService** (`CrystalReportRenderer.cs`) — add a narrow, per-report opt-out to `ApplyReportLevelParameters`, same shape for all 3 reports but with different field-name casing:
   - Add `OptionalReportLevelParameters` (`HashSet<string>`, case-insensitive, default empty) to `ReportDefinition` — same pattern as the existing `SkipLocationCorrection` flag.
   - `"rbp"` → `{ "PlanningEngineer", "ReviewdBy", "ApprovedBy", "ReviewedBy" }` (PascalCase, matches `RBP.rpt`).
   - `"rbp-summary-report"` and `"rbp-summary-report-with-tier"` → `{ "planningEngr", "reviewedBy", "approvedBy" }` (camelCase, matches those `.rpt` files).
   - In `ApplyReportLevelParameters`: when a parameter is missing **and** in the optional set **and** `ValueType == FieldValueType.StringField`, call `report.SetParameterValue(pf.Name, "")` instead of collecting it into `missing`. Everything else (not in the set, or non-string type) keeps today's exact required behavior. Update the method's signature and its one call site in `RenderToPdf` to pass the set through.

2. **WebAPI** (`ReportRequestMapper.cs`, `MapRbpSummary`) — remove the three `Fail(...)` calls for `PlanningEngr`/`ReviewedBy`/`ApprovedBy` (lines 68-75), switching them to the same "add if present, omit if blank" pattern `MapRbp` already uses (`AddOptional`-style), matching lines 77-83's existing `legacyParams[...]` assignments but gated on non-blank rather than unconditional. `YearStart`/`RegionCode`/`ProgramId` checks (59-66) stay untouched.

3. **FE** (`Reports.tsx`) — for the `rbp-summary` family, remove the blocking validation block (lines 373-379) and the 3 pairs of conditional asterisk/placeholder JSX (561/567, 574/580, 587/593), so these fields render and behave identically to how `rbp`'s already do (label with no asterisk, placeholder "Optional", no submit-time block).

4. **Tests**: replace `Map_RbpSummary_MissingPlanningEngr_Fails` (now asserts the opposite of current behavior) with a test asserting the request succeeds when `planningEngr`/`reviewedBy`/`approvedBy` are omitted — mirroring the existing `Map_Rbp_MapsSignatoriesAndPrograms`-style pattern for the `rbp` family.

## Tasks

### Implementation
- Add `OptionalReportLevelParameters` to `ReportDefinition` in `CrystalReportRenderer.cs`; set it on `rbp` (PascalCase names), `rbp-summary-report`, and `rbp-summary-report-with-tier` (camelCase names).
- Update `ApplyReportLevelParameters` to honor that set (empty-string default for optional `StringField` params only) and update its call site.
- Update `MapRbpSummary` in `ReportRequestMapper.cs`: remove the 3 required-field `Fail(...)` calls for PlanningEngr/ReviewedBy/ApprovedBy, switch to optional-add.
- Update `Reports.tsx`: remove the `rbp-summary` blocking validation block and the required-asterisk/placeholder JSX for the 3 signatory fields.
- Replace `Map_RbpSummary_MissingPlanningEngr_Fails` in `ReportRequestMapperTests.cs` with a test asserting success when these fields are omitted.
- Manually verify end-to-end for all 3 reports: signatories blank (expect success, blank signature block) and signatories populated (expect success, populated signature block).

### Documentation
- Update `CRYSTAL_REPORT_GENERATION.md`: the `rbp` row/gotchas section (as in the original plan), plus lines 104-105 (report-level parameters table) and 203-205 (`GenerateRbpSummaryRequestDTO` description, currently says "all 6 required") to reflect that `planningEngr`/`reviewedBy`/`approvedBy` are now optional for both summary reports, while `yearstart`/`region`/`programid` remain required.

## Files / Components Touched
- `CrystalReportService/Services/CrystalReportRenderer.cs`
- `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`
- `FE/src/pages/Reports/Reports.tsx`
- `MYPS.UnitTests/ReportRequestMapperTests.cs`
- `CrystalReportService/CRYSTAL_REPORT_GENERATION.md`

## Risks / Open Questions / Assumptions
- **Assumes these report-level parameters are `StringField` type** in all 3 `.rpt` files (safe assumption, person-name/signature fields, but unverified by direct Designer inspection) — confirm via `pf.ValueType` during implementation before relying on the empty-string default.
- **No Designer-side `.rpt` change** — this fix is entirely C#/TS. If Crystal still rejects an empty string for some undocumented reason, the fallback is a Designer-side "optional prompt" change instead, requiring the user's Designer access (same class of constraint as #423's `.rpt` rebind work).
- **Independent of #423** — confirmed the SQL `Parameters` lists for all 3 reports never carried these fields, so this branch (created from `main`) needs no changes from the separate #423 fix branch.
- Reverses a previously *intentional*, tested, documented product decision for the 2 summary reports (hard-required signatories) — worth being clear this is a deliberate reversal per explicit user request, not an oversight being corrected.

## Completion Log
Date: 2026-10-23
- Implementation:
  - Added `OptionalReportLevelParameters` (`HashSet<string>`, case-insensitive) to `ReportDefinition` in `CrystalReportRenderer.cs`, set on `"rbp"` (`PlanningEngineer`/`ReviewdBy`/`ApprovedBy`/`ReviewedBy`, PascalCase) and on `"rbp-summary-report"`/`"rbp-summary-report-with-tier"` (`planningEngr`/`reviewedBy`/`approvedBy`, camelCase).
  - Updated `ApplyReportLevelParameters` to accept that set and default any missing, opted-in `StringField` parameter to `""` instead of adding it to `missing`; everything else (not opted in, or non-string type) keeps the original unconditional-required behavior. Updated its one call site in `RenderToPdf` to pass `definition.OptionalReportLevelParameters` through.
  - Updated `MapRbpSummary` in `ReportRequestMapper.cs`: removed the 3 `Fail(...)` calls for `PlanningEngr`/`ReviewedBy`/`ApprovedBy`, switched to the same `AddOptional(...)` pattern `MapRbp` already used. `YearStart`/`RegionCode`/`ProgramId` validation unchanged. Also corrected the method's header comment, which was stale/contradicted the new behavior.
  - Updated `Reports.tsx`: removed the `case 'rbp-summary':` blocking validation block (planning engineer/approved by/reviewed by no longer required before submit) and the 3 pairs of conditional red-asterisk/placeholder JSX, so the `rbp-summary` family's 3 signatory fields render and behave identically to `rbp`'s (label with no asterisk, "Optional" placeholder). Request-building now uses `.trim() || undefined` for these 3 fields, matching `rbp`'s existing pattern.
  - Replaced `Map_RbpSummary_MissingPlanningEngr_Fails` in `ReportRequestMapperTests.cs` with `Map_RbpSummary_MissingSignatories_Succeeds`, asserting the mapper now succeeds (and omits the 3 keys from `legacyParams`) when all 3 are blank. Ran the full `ReportRequestMapperTests` suite: 11/11 passed.
  - Manually verified `rbp` end-to-end via an isolated local IIS Express instance (port 8099, avoiding the known pre-existing stale full-IIS deployment on port 8090 described in the #423 plan): signatories omitted → 200 OK, real PDF; signatories supplied → 200 OK, real PDF with the actual supplied names ("Juan Dela Cruz"/"Maria Santos"/"Pedro Reyes") rendered in the signature block (regression check via `pdftotext`).
  - **Could not fully verify `rbp-summary-report`/`rbp-summary-report-with-tier` end-to-end on this branch**: both fail identically whether or not signatories are supplied, with the exact pre-existing `.rpt`-binding/View-connection errors that issue #423 (a separate branch, `fix/S08-TC002-P002-P003-rbp-summary`) already fixed — this branch was created from `main` and doesn't include that fix, so these 2 reports are non-functional here for reasons unrelated to #422. Per explicit user decision, accepted as partial verification: the code change for these 2 reports follows the exact same, already-proven-correct pattern used for `rbp` (same method, same opt-in mechanism, just different parameter-name casing confirmed against `CRYSTAL_REPORT_GENERATION.md`), but has not been exercised by an actual render. Should be re-verified for real once this branch and #423's branch are both present together (either merged or tested on a combined branch).
- Documentation: Updated `CRYSTAL_REPORT_GENERATION.md` — Report-Level Parameters table (now marks which parameters are required vs. optional per report), a new 3rd "gotcha" explaining `OptionalReportLevelParameters`, and the stale "all 6 required" line in the Known Caveats section.
Deviations / flags:
  - No renderer-level unit test was added (plan's task said "add one if none exists"). `CrystalReportRenderer`/`ApplyReportLevelParameters` has no existing test coverage anywhere in the repo, and it takes a COM-backed `ReportDocument` from the Crystal Reports SDK that isn't practically mockable without new test infrastructure — judged out of scope for this fix. Covered instead by the `ReportRequestMapperTests.cs` test (WebAPI layer) plus manual end-to-end verification against a real render (which does exercise the actual `ApplyReportLevelParameters` code path).
  - Partial end-to-end verification for the 2 summary reports (see above) — accepted per explicit user decision rather than merging/cherry-picking from the #423 branch.
Files changed:
  - `CrystalReportService/Services/CrystalReportRenderer.cs`
  - `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`
  - `FE/src/pages/Reports/Reports.tsx`
  - `MYPS.UnitTests/ReportRequestMapperTests.cs`
  - `CrystalReportService/CRYSTAL_REPORT_GENERATION.md`

## Local Environment Investigation (2026-10-23, abandoned)
After initial implementation, extensive manual testing against a local full-IIS deployment (`C:\inetpub\wwwroot\CrystalReportServicePublish`, same pre-existing stale site documented in the #423 plan) surfaced a `CrystalDecisions.ReportAppServer.Controllers.ReportSourceClass.Export` `COMException` ("The system cannot find the path specified") affecting **every** report type on that one machine, reproduced across a long list of controlled variables: a full reboot, default-printer configuration, 32-bit vs. 64-bit app pool setting (32-bit is categorically unavailable on this host -- `CrystalDecisions.ReportAppServer.CommLayer` only exists in `GAC_64`), partial vs. full `bin/` deployment, identical `.rpt` file content, removing the `DumpConnectionMetadata` diagnostic call, removing the `Application_Start` Event Log registration probe, and a Process Monitor capture that led to granting the app pool identity registry permissions on `HKLM\...\Report Application Server\Client SDK`. None resolved it. The user's own separately-built backup deployment continued to work throughout, confirming this is a real, host-specific Crystal Reports runtime/COM issue -- not caused by `#422`'s code, `main`, or `#423`.

**Per user decision, this investigation was abandoned** and every change made purely to chase it was reverted, leaving this branch containing only the actual `#422` fix:
- Restored `DumpConnectionMetadata` (method + call site) in `CrystalReportRenderer.cs` -- removing it was one of the ruled-out hypotheses, not part of the fix.
- Reverted `Global.asax.cs` to its original state -- `ReportDiagnosticLogger.VerifyEventSourceRegistration()` restored.
- Reverted `Main/appsettings.Development.json`, `CrystalReportService/Web.config`, `FE/.env.development` back to `main`'s shared-dev-server defaults (all three were only changed for local manual testing, never part of the fix).
- Deleted the `CrystalReportService/publish_output/` build artifact generated during testing.
- Rebuilt and reran the full test suite after reverting (11/11 passed) to confirm the branch is back to a clean, minimal, mergeable state.

The registry ACL grant and the Procmon-identified `ACCESS DENIED` on `HKLM\...\Report Application Server\Client SDK` were **not** reverted (they're host machine state, not part of this branch) -- future debugging of this specific machine's Crystal Reports installation can pick up from the Procmon trace captured during this session if revisited.
