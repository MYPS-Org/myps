# Plan: Fix RBP Summary Report / RBP Summary Report with Tier showing no data (#423)

Status: Implemented
Created: 2026-10-23
Source: Issue #423 ([UAT][S08] S08-TC002-P002, TC002-P003) — RBP Summary Report has no value, but the RBP (Regional Budget Proposal) has

## Context

Issue #423 (test cases S08-TC002-P002 / TC002-P003): the "RBP Summary Report" and "RBP Summary Report with Tier" PDF exports return no values, while the plain "Regional Budget Proposal" (RBP) report correctly shows data for the same program (BP 2027 QA101626(1), Region III).

This is not a fresh bug — `CrystalReportService/Services/CrystalReportRenderer.cs` carries three prior commits of in-progress debugging on exactly this path (`c7b3eb7d` → `4c3eae20` → `f259a0b7`, all dated around 2026-09-07/08), full of "temporary instrumentation," operator-decision comments, and an explicit admission in the latest commit message that `rbp-summary-report` was "not yet confirmed end-to-end working." Current (HEAD) state:

- **`rbp-summary-report`** — in HEAD, currently `StoredProcedure`-backed via `sp_RBPSummaryTier` (a 2026-09-08 "operator decision" to consolidate both summary reports onto one shared proc), `SkipLocationCorrection = true`, pointed at `CrystalReportService/Reports/RBP Summary Report.rpt`. **This plan reverts that consolidation**: `rbp-summary-report` goes back to its own proc, `sp_RBPSummary` (left in place, unused-but-not-deleted, by the same 2026-09-08 commit) — matching the user's intended design and the naming of the newer Designer-rebound files (see below). Per the in-code comment trail, the `.rpt` for this report needs its own Designer rebind to whichever proc it ends up pointing at — a C# change alone isn't sufficient.
- **`rbp-summary-report-with-tier`** — still `View`-backed via `MYPS_vw_rptRBPSummaryTier`, and `LoadData`'s View branch (`CrystalReportRenderer.cs:769-777`) issues a bare `SELECT * FROM {view}` with **no WHERE/parameter filtering at all**. `yearstart`/`region`/`programid` only ever reach Crystal's report-level (letterhead) parameters, never the SQL. This plan switches it to `StoredProcedure`/`sp_RBPSummaryTier`.
- There is no single "current" `CREATE PROCEDURE` script checked into `Main/Resources/Internal/SQLScripts/` for **either** proc — only dated backups for each: `sp_RBPSummary_backup_pre_cssp_lp_region_fix_20260908.sql` / `sp_RBPSummary_backup_pre_tier_alignment_20260908.sql`, and `sp_RBPSummaryTier_backup_pre_cssp_lp_category_fix_20260908.sql` / `sp_RBPSummaryTier_backup_pre_totals_20260908.sql`. The procs' true current definitions only live on whatever SQL Server they were last hand-edited against. These SQL scripts are **not** auto-deployed by any migration runner in `Main` — they're applied by hand per environment.
- `CrystalReportService/CRYSTAL_REPORT_GENERATION.md` and `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs:40-47` both still describe the old, now-inaccurate "unparameterized view, none of these fields filter the query" state.
- The user has a **separate, non-git Crystal Designer workspace** at `C:\Users\Msi\Documents\_Recards\_projects\CrystalReportService\Reports\`, containing two `.rpt` files dated **2026-09-10** — `RBPSummaryReport.rpt` and `RBPSummaryReportTier.rpt` — newer than the last commit touching this area (`f259a0b7`, 2026-09-08). The user has confirmed these are a later Designer rebind of exactly this report pair and should be pulled into the repo as the real fix (vs. the repo's own `RBPSummaryReport.rpt`, which is a stale, empty 64KB diagnostic placeholder explicitly called out as "unrelated" in a code comment). Their names match the split-proc design: `RBPSummaryReport.rpt` → `sp_RBPSummary`, `RBPSummaryReportTier.rpt` → `sp_RBPSummaryTier`.
- Per user decision (confirmed after reviewing the HEAD vs. sandbox discrepancy above), the two report types keep **separate** stored procedures — `rbp-summary-report` → `sp_RBPSummary`, `rbp-summary-report-with-tier` → `sp_RBPSummaryTier` — rather than the HEAD consolidation onto one shared proc.
- DB connection strings (`Main/appsettings.Development.json`, `CrystalReportService/Web.config`) have already been switched to `Server=localhost;Database=myps_db_dev3` for local testing of this fix (done outside this plan, prior to planning).
- Work happens on branch `fix/S08-TC002-P002-P003-rbp-summary` (already created off `main`).

## Goal

Both RBP Summary reports (`rbp-summary-report` and `rbp-summary-report-with-tier`) return real, program-filtered data and export successfully as PDF, verified locally against `localhost/myps_db_dev3` using the BP 2027 QA101626(1) / Region III test case from #423, and the renderer code + docs are left in a state that doesn't require re-deriving this history again.

## Acceptance Criteria

As a BP (Budget Proposal) reviewer, I want the RBP Summary Report and RBP Summary Report with Tier to show the same program's data as the Regional Budget Proposal report, so that I can trust summary totals during UAT sign-off.

- [ ] Against `localhost/myps_db_dev3`, generating `rbp-summary-report` for BP 2027 QA101626(1) / Region III returns a PDF with populated DEO/Legislative District/RO rollup rows (not blank), matching S08-TC002-P002.
- [ ] Against the same local DB and program, generating `rbp-summary-report-with-tier` returns a PDF with populated, program-filtered rows (not all-programs/unfiltered, not blank), matching S08-TC002-P003.
- [ ] `rbp-summary-report-with-tier` is filtered server-side by `programid`/`yearstart`/`region` (no longer an unfiltered `SELECT * FROM view`).
- [ ] A single, current `CREATE OR ALTER PROCEDURE dbo.sp_RBPSummary` script and a single, current `CREATE OR ALTER PROCEDURE dbo.sp_RBPSummaryTier` script both exist in `Main/Resources/Internal/SQLScripts/`, each reflecting what's actually deployed and tested (not just a dated backup of an intermediate state).
- [ ] `CRYSTAL_REPORT_GENERATION.md` and the stale comment in `ReportRequestMapper.cs` no longer claim the summary reports are unparameterized/non-filtering.
- [ ] The temporary diagnostic instrumentation (`DumpConnectionMetadata`, "Temporary (2026-09-07)" logging) and the ~1500 lines of commented-out dead `LoadData`/renderer code in `CrystalReportRenderer.cs` are removed now that the real cause is understood, per the comments' own "remove once found" markers.
- [ ] The other 6 working report types (`rbp`, `extract-pcmiow`, the 4 AIP variants) are unaffected — spot-check at least `rbp` still exports correctly after the cleanup.

## Approach

1. **Bring in the newer Designer rebind.** Copy `RBPSummaryReport.rpt` and `RBPSummaryReportTier.rpt` from the local sandbox (`C:\Users\Msi\Documents\_Recards\_projects\CrystalReportService\Reports\`) into `CrystalReportService/Reports/`, replacing the stale empty `RBPSummaryReport.rpt` placeholder currently there. Keep the old `RBP Summary Report.rpt` / `RBP Summary Report(old).rpt` / `RBP Summary Report_1.rpt` / `RBP_Summary_Report_with_Tier.rpt` files in place untouched (no need to delete old .rpt artifacts as part of this fix) unless they turn out to be genuinely orphaned after the switch.

2. **Repoint both `ReportDefinition`s onto the new files and their own proc**, in `CrystalReportRenderer.cs`'s `Reports` dictionary (~lines 112-185):
   - `rbp-summary-report`: `RptFileName = "RBPSummaryReport.rpt"`, `DbObjectName` reverted from `sp_RBPSummaryTier` back to **`sp_RBPSummary`** (undoing the 2026-09-08 consolidation), `SourceType = StoredProcedure`, `SkipLocationCorrection = true` (re-verify this is still needed once the new `.rpt`'s Designer binding is in place — it was specifically a workaround for the old `.rpt`'s stale Location).
   - `rbp-summary-report-with-tier`: switch from `View`/`MYPS_vw_rptRBPSummaryTier` to `StoredProcedure` / **`sp_RBPSummaryTier`** / `SkipLocationCorrection = true`, `RptFileName = "RBPSummaryReportTier.rpt"`, with the same `yearstart`/`programid`/`region` parameter list `rbp-summary-report` already has. This removes the last caller of the View code path for these two reports (the `else // View` branch in `LoadData` and the View branch in `RenderToPdf` stay in the renderer for other reports/future use, just unexercised by these two).

3. **Pin down both procs' real definitions empirically**, against `localhost/myps_db_dev3`:
   - Confirm each proc (`sp_RBPSummary`, `sp_RBPSummaryTier`) exists there at all (either may not — nothing commits a "current" version of either).
   - If missing or stale, apply each one's most recent backup as the starting point — `sp_RBPSummary_backup_pre_cssp_lp_region_fix_20260908.sql` and `sp_RBPSummaryTier_backup_pre_cssp_lp_category_fix_20260908.sql` — both of which already have `@programid`/`@yearstart`/`@region` filtering wired into their joins.
   - Run each directly with the test case's real values (program `QA101626(1)`, region III, year 2027) and compare row counts against the known-working `sp_RBP` for the same inputs. Bisect the CTEs/joins (`tProgramStages.ProgramId` match, `tPrograms.StartYear = @yearstart`, `LegislativeDistrict` join key) to find whichever one is silently zeroing out rows in each proc — this is the same class of bug as the already-documented YearOfWork/ComponentCostPerYear.Year mismatch from issue #424, so check for type/format mismatches first rather than assuming a logic error. The two procs share near-identical structure, so a bug found in one is a strong lead for the other.
   - Land each corrected, final version as a plain `CREATE OR ALTER PROCEDURE dbo.sp_RBPSummary` / `dbo.sp_RBPSummaryTier` script in `Main/Resources/Internal/SQLScripts/` (not another `_backup_` file), and apply both by hand to `myps_db_dev3`. Note in a risk below that this also needs manual application to dev/UAT later — out of scope for this plan to deploy there.

4. **Verify end-to-end** by calling the WebAPI endpoints that front `rbp-summary-report` and `rbp-summary-report-with-tier` (via `ReportRequestMapper`/`ReportCatalog` in `WebAPI/Controllers/CrystalReport/`) locally against `localhost/myps_db_dev3`, using the exact #423 test values, and confirm both PDFs contain real rows.

5. **Clean up** the diagnostic/dead code in `CrystalReportRenderer.cs` once the fix is verified working, and correct the stale documentation.

## Tasks

### Implementation
- Copy `RBPSummaryReport.rpt` and `RBPSummaryReportTier.rpt` from the local sandbox into `CrystalReportService/Reports/`.
- Update the `rbp-summary-report` and `rbp-summary-report-with-tier` entries in `CrystalReportRenderer.cs`'s `Reports` dictionary per the Approach above (`rbp-summary-report` → `StoredProcedure`/`sp_RBPSummary`; `rbp-summary-report-with-tier` → `StoredProcedure`/`sp_RBPSummaryTier`; both `SkipLocationCorrection = true`, new `.rpt` filenames, same parameter list).
- Investigate `sp_RBPSummary`'s and `sp_RBPSummaryTier`'s state on `localhost/myps_db_dev3`, fix whichever join/filter is dropping rows for BP 2027 QA101626(1)/Region III in each, and commit the results as new, non-backup `CREATE OR ALTER PROCEDURE dbo.sp_RBPSummary` / `dbo.sp_RBPSummaryTier` scripts in `Main/Resources/Internal/SQLScripts/`. Apply both to `myps_db_dev3` by hand.
- Remove the temporary diagnostic instrumentation (`DumpConnectionMetadata` and its call site, the "Temporary (2026-09-07)" logging block) and the large blocks of commented-out dead code (old `LoadData` copies etc.) from `CrystalReportRenderer.cs`, once the fix is confirmed working end-to-end.
- Manually verify both report types render correctly end-to-end against `localhost/myps_db_dev3` for the #423 test case, and spot-check `rbp` still works after the cleanup.

### Documentation
- Update `CrystalReportService/CRYSTAL_REPORT_GENERATION.md` to reflect the final state: both summary reports are `sp_RBPSummaryTier`-backed with real filtering, correct `.rpt` filenames, and drop the now-false "views take no parameters" claims.
- Fix the stale comment block in `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs:40-47` ("none of these 6 fields filter the SQL query") to describe the corrected, filtering behavior.

## Files / Components Touched
- `CrystalReportService/Services/CrystalReportRenderer.cs`
- `CrystalReportService/Reports/RBPSummaryReport.rpt`, `CrystalReportService/Reports/RBPSummaryReportTier.rpt` (new, copied in)
- `Main/Resources/Internal/SQLScripts/` (new `sp_RBPSummary` and `sp_RBPSummaryTier` scripts)
- `CrystalReportService/CRYSTAL_REPORT_GENERATION.md`
- `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`

## Risks / Open Questions / Assumptions
- **SQL changes aren't auto-deployed.** There's no migration runner picking up `Main/Resources/Internal/SQLScripts/` — applying the corrected `sp_RBPSummaryTier` to `myps_db_dev3` (and later to dev/UAT) is a manual step outside `implement-task`'s normal file-edit flow; flag this clearly in the Completion Log so it isn't missed before the next UAT round.
- **Root cause of the row-dropping join is not yet confirmed** — the plan's investigation step (empirical bisection against `localhost/myps_db_dev3`) may surface a different/additional culprit than the `StartYear`/`ProgramId` format-mismatch hypothesis; the implementation task should follow the evidence rather than assuming that hypothesis is correct going in.
- **`.rpt` files are binary** — their Designer-side bindings can't be verified by reading the file; the only verification is actually running `RenderToPdf` against them locally and confirming export succeeds with real rows.
- Old now-unused `.rpt` files (`RBP Summary Report.rpt`, `RBP Summary Report(old).rpt`, etc.) and the orphaned `sp_RBPSummary` proc are left in place per the prior operator's own "orphaned-but-harmless beats a one-way deletion" judgment — not deleted as part of this fix.
- Requires SAP Crystal Reports runtime + a real SQL Server connection to `myps_db_dev3` to verify locally, consistent with how `CrystalReportRenderer` already works for the other 6 reports.

## Completion Log
Date: 2026-10-23
- Implementation:
  - Copied the Sep-10 Designer-rebound `.rpt` files from the local sandbox into `CrystalReportService/Reports/` (`RBPSummaryReport.rpt` replacing the stale 64KB empty placeholder, `RBPSummaryReportTier.rpt` new) and added the missing `<Content Include>` entry for the latter to `CrystalReportService.csproj` (it had never been added to the project, so it wasn't being copied to the build output).
  - Repointed both `ReportDefinition`s in `CrystalReportRenderer.cs`: `rbp-summary-report` → `StoredProcedure`/`sp_RBPSummary` (reverted off the HEAD consolidation onto `sp_RBPSummaryTier`), `rbp-summary-report-with-tier` → `StoredProcedure`/`sp_RBPSummaryTier` (switched off the unfiltered View path). Both `SkipLocationCorrection = true`, same `yearstart`/`programid`/`region` SQL parameter list.
  - Investigated both procs directly against `localhost/myps_db_dev3` (`sqlcmd`): **both already existed and already executed correctly**, returning real, program/year/region-filtered rows for a local RBP-stage test program (`sp_RBPSummary`: 2 rows, 60+47 projects; `sp_RBPSummaryTier`: 4 rows whose tier-split totals reconcile exactly with `sp_RBPSummary`'s category totals). The row-dropping bug was never a SQL join/logic bug — it was entirely the Crystal `.rpt` Designer-binding/`Table.Location` export failure described in the prior commits. Captured each proc's live `OBJECT_DEFINITION` and committed them as the first non-`_backup_` scripts for either proc: `Main/Resources/Internal/SQLScripts/sp_RBPSummary.sql`, `sp_RBPSummaryTier.sql`. Re-applied both by hand to `myps_db_dev3` to validate the scripts are syntactically exact (no-op, confirmed identical output before/after).
  - Verified end-to-end: built `CrystalReportService` (full Visual Studio MSBuild, `C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\amd64\MSBuild.exe` — the SSMS-bundled MSBuild lacks the WebApplication targets), hosted it locally via IIS Express on port 8090 against `localhost/myps_db_dev3`, and called both `GET /api/reports/rbp-summary-report` and `GET /api/reports/rbp-summary-report-with-tier` directly. Both returned HTTP 200 with real PDFs (92KB / 94KB); `pdftotext` confirmed the actual rollup rows and totals inside match the raw SQL output exactly. Spot-checked `rbp` (one of the other 6 report types) still exports correctly — unaffected by this change.
  - Removed the diagnostic/dead code once the fix was confirmed: the `DumpConnectionMetadata` method and its call site, the "Temporary (2026-09-07)" instrumentation comments, and ~2630 lines of commented-out dead code (5 full historical snapshots of the file, everything after the real `namespace` close) — file went from 3380 lines to 904. Rebuilt and re-ran both end-to-end checks after the cleanup to confirm no behavior change (identical PDF content lengths).
- Documentation:
  - Updated `CrystalReportService/CRYSTAL_REPORT_GENERATION.md`: Report Catalog table (new `.rpt` filenames, both now Proc-backed with real SQL params), Report-Level Parameters table (yearstart/programid/region now dual-purpose, not display-only), replaced the stale 2026-09-07 "Known Caveats" entry (which claimed `sp_RBPSummaryTier` didn't exist and flagged an unfixed `Legislative_District` join bug — both now stale, the join already uses `ld.Code` in the live proc) with an accurate 2026-10-23 account, and updated the Stored Procedures/Views table to list `sp_RBPSummary`/`sp_RBPSummaryTier` as the actual backing objects (the two views are now unused by any Crystal report, left in place).
  - Fixed the stale comment block in `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs:40-47` that claimed all 6 `rbp-summary-report`/`rbp-summary-report-with-tier` fields were display-only.
Deviations / flags:
  - **Scope turned out smaller than planned for the SQL investigation task**: the plan anticipated needing to "fix whichever join/filter is dropping rows," but both procs were already correct and already deployed on `myps_db_dev3` — the actual remaining work was entirely the `.rpt` Designer rebind + C# repointing (which the user had already done the Designer half of, in the local sandbox) and checking in a current script. No SQL logic changes were made.
  - **Reproduction used a different test program than #423's exact UAT data**: `myps_db_dev3` (a local/seed dev database) doesn't contain the specific "BP 2027 QA101626(1), Region III" program from the bug report — it has synthetic/e2e-seeded program data instead. Verification used a locally-available RBP-stage program (`P_CO-PS-634_02052024_084224`, FY2025) as a stand-in to prove the end-to-end mechanism works; this is not a literal reproduction of the exact UAT test case, since that data doesn't exist locally.
  - **Manual DB deployment still required**: per the plan's own flagged risk, the corrected `sp_RBPSummary`/`sp_RBPSummaryTier` scripts (and the existing procs they match) still need to be confirmed/applied by hand against the actual UAT/dev server database before S08-TC002-P002/TC002-P003 can be re-tested there — this plan only covers local verification.
Files changed:
  - `CrystalReportService/CRYSTAL_REPORT_GENERATION.md`
  - `CrystalReportService/CrystalReportService.csproj`
  - `CrystalReportService/Reports/RBPSummaryReport.rpt` (replaced)
  - `CrystalReportService/Reports/RBPSummaryReportTier.rpt` (new)
  - `CrystalReportService/Services/CrystalReportRenderer.cs`
  - `Main/Resources/Internal/SQLScripts/sp_RBPSummary.sql` (new)
  - `Main/Resources/Internal/SQLScripts/sp_RBPSummaryTier.sql` (new)
  - `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`
  - (prior to this plan, outside its scope) `CrystalReportService/Web.config`, `Main/appsettings.Development.json` — DB connection strings switched to `localhost`/`myps_db_dev3`

## Post-Implementation Fix (2026-10-23, found during /code-review)
User noticed the `rbp-summary-report`/`rbp-summary-report-with-tier` `Parameters` lists in `CrystalReportRenderer.cs` were incomplete compared to the local sandbox reference (3 SQL params instead of the sandbox's 6). Verified live: both `sp_RBPSummary`/`sp_RBPSummaryTier` accept `@planningEngr`/`@reviewedBy`/`@approvedBy` and pass each straight through as a `PlanningEngr`/`ReviewedBy`/`ApprovedBy` output column that the `.rpt`'s signature block binds to directly (not Crystal's own report-level parameter of the same name). Since those 3 weren't wired into either `ReportDefinition.Parameters` list, they never reached the SQL call, so the proc silently used its own `NULL` default — confirmed via a real rendered PDF: the signature block showed the correct role labels ("Planning Engineer", "Regional Director", etc.) but blank names, even when the caller supplied real ones.
- Fixed: added `planningEngr`/`reviewedBy`/`approvedBy` (`NVarChar`, `IsRequired = false`, matching the procs' own optional defaults) to both `ReportDefinition.Parameters` lists.
- Re-verified end-to-end via IIS Express against `myps_db_dev3`: both PDFs now show the actual supplied names ("Juan Dela Cruz" / "Maria Santos" / "Pedro Reyes") in the signature block instead of blank.
- Side finding during this verification (not fixed, out of scope): `@region` expects the internal region *code* (e.g. `OI249`), not the display name (e.g. "Bangsamoro Autonomous Region In Muslim Mindanao") — passing the display name silently returns zero rows, since `pr.Region` stores the raw code while the report's own `RO` output column is the resolved display name. This matches how the FE's region dropdown presumably already sends codes, not names, so is unlikely to be a live bug, but worth knowing if a future manual test passes a region "name" and gets an empty report.
Files changed (in addition to the above): `CrystalReportService/Services/CrystalReportRenderer.cs` (parameter lists only).

## UI-Level Confirmation (2026-10-23)
User re-tested both reports through the actual Reports page (`localhost:8080`, `FE/.env.development` pointed at local `Main` on `localhost:5015`) using the sample data above (RBP FY 2025 BARMM Region X, Year 2025, Region Bangsamoro Autonomous Region In Muslim Mindanao). Both `rbp-summary-report` and `rbp-summary-report-with-tier` generated and downloaded successfully — confirms the fix works through the real end-to-end flow (FE → WebAPI → Hangfire job → CrystalReportService → SQL), not just direct API calls.

Separately found (not a regression, pre-existing): this machine has a second, persistent CrystalReportService deployment under full IIS at `C:\inetpub\wwwroot\CrystalReportServicePublish`, bound to port 8090 via `http.sys`. Since `Main`'s `ReportService:BaseUrl` is also `http://localhost:8090/`, any time the ad-hoc IIS Express instance (used for this plan's own verification) isn't running, requests silently fall through to this stale deployment instead — which has never received any code updates and fails even on the untouched `rbp` report with the same `report.ExportToStream`/"path specified" error, unrelated to #423. Not fixed as part of this plan (out of scope); flagged here so a future session doesn't mistake it for a regression.
