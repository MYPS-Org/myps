# Crystal Report Generation Documentation

> ⚠️ **KEEP THIS FILE UP TO DATE**
> Every time a report key is added, removed, or re-pointed to a different `.rpt`/stored
> procedure/view in `CrystalReportRenderer.cs`, or a controller endpoint is added, modified, or
> removed, update this document **before merging the PR**. Treat it as a living specification —
> same discipline as `ReportGeneration/REPORT_GENERATION.md` below.

> **This is the active, currently-used report pipeline.** `FE/src/pages/Reports` calls only
> `/api/reports/*` (this system). `ReportGeneration/REPORT_GENERATION.md` documents an older,
> QuestPDF-based report pipeline (`WebAPI/Controllers/Reports/ReportingController.cs`, route
> `api/Reporting`) that is currently **orphaned** — zero frontend callers as of 2026-09-05 — but
> not deleted. If you're chasing "why are there two report systems," that's why; don't assume the
> QuestPDF one is dead code to clean up without confirming with the operator first.

---

## Table of Contents

1. [Overview](#overview)
2. [Report Catalog](#report-catalog)
3. [Controller Endpoints](#controller-endpoints)
4. [Diagnostics & Logging](#diagnostics--logging)
5. [Known Caveats](#known-caveats)
6. [Stored Procedures / Views Used](#stored-procedures--views-used)
7. [Dependencies](#dependencies)

---

## Overview

```
FE/src/pages/Reports (Service.ts)
  │  POST /api/reports/{reportName}
  ▼
WebAPI/Controllers/CrystalReport/ReportsController.cs   (route: api/reports)
  │  validates via ReportCatalog.IsSupported / ReportRequestMapper.TryMap
  │  enqueues a Hangfire background job, returns JobId immediately
  ▼
Hangfire/Services/ReportJobService.cs  (GenerateReport)
  │  HttpClient "ReportService"  (Main/Program.cs AddHttpClient registration)
  │  GET {ReportService:BaseUrl}/api/reports/{reportName}?{queryString}
  ▼
CrystalReportService  (SEPARATE project — .NET Framework 4.8, System.Web.Http, IIS-hosted)
  Controllers/ReportsController.cs   (route: api/reports/{reportName})
  │
  ▼
Services/CrystalReportRenderer.cs
  │  `Reports` dictionary maps report key → .rpt file + backing SP/view + SQL parameters
  │  Runs the SP/view via ADO.NET, hands Crystal a DataTable via SetDataSource
  │  Loads the matching .rpt from its own ~/Reports folder
  ▼
SAP Crystal Reports engine (CrystalDecisions.CrystalReports.Engine)
  │  ExportToStream(PortableDocFormat) or Excel, per report's OutputFormat
  ▼
PDF/xlsx bytes returned to ReportJobService, saved to Resources/Reports/{reportName}_{jobId}.{ext}
  │
  ▼
FE polls GET /api/reports/status/{jobId}, then GET /api/reports/download?fileName=...
```

Raw-data-extract reports (currently `extract-pcmiow`) skip the `CrystalReportService` HTTP
round-trip entirely — `Hangfire/Services/ExcelReportGenerator.cs` (`IExcelReportGenerator`)
generates the `.xlsx` directly from the same backing procedure, since Crystal's page-based PDF
rendering truncates wide/tall row dumps.

**Confirmed live end-to-end (2026-09-05):** `POST https://myps.eptisa-dev.com/api/reports/rbp`
with a complete payload (SQL params + the 4 report-level signatory params below) → job reaches
`Status: Completed` → downloaded a genuine `%PDF-1.7` document (~128.8KB, real font/object
structure, Crystal Reports producer metadata) via the `download` endpoint. This is real,
production-adjacent proof the full chain works, not just "the SQL compiles."

---

## Report Catalog

One row per entry in `CrystalReportService/Services/CrystalReportRenderer.cs`'s `Reports`
dictionary (case-insensitive keys):

| Report Key                        | `.rpt` File                            | Backing Object              | Type | SQL Parameters                                                     | Output |
|------------------------------------|-----------------------------------------|------------------------------|------|----------------------------------------------------------------------|--------|
| `rbp`                              | `RBP.rpt`                                | `sp_RBP`                     | Proc | `yearstart` (req), `programid` (opt), `region` (opt)                 | pdf    |
| `extract-pcmiow`                   | `ExtractPCMIOW.rpt`                      | `usp_extract_PC_MIOW_list`   | Proc | `programid`, `categoryid`, `rocode`, `deocode`, `io_code` (all req)   | xlsx (via `ExcelReportGenerator`, bypasses Crystal) |
| `rbp-summary-report`               | `RBP Summary Report.rpt`                 | `sp_RBPSummary`              | Proc | `programid` (opt) — see Known Caveats: the View path was retired 2026-09-07 | pdf |
| `rbp-summary-report-with-tier`     | `RBP_Summary_Report_with_Tier.rpt`       | `MYPS_vw_rptRBPSummaryTier`  | View | none — the view itself is unparameterized, **but see Report-Level Parameters below: this is not a zero-input report** | pdf    |
| `aip-official`                     | `AIP_Official.rpt`                       | `a1_usp_AIP2`                | Proc | `yearstart` (req), `programid` (req), `region` (opt)                  | pdf    |
| `aip-executive`                     | `AIP_Executive.rpt`                      | `a1_usp_AIP2`                | Proc | same as above                                                          | pdf    |
| `aip-official-without-ld`          | `AIP_Official_without_LD.rpt`            | `a1_usp_AIP2`                | Proc | same as above                                                          | pdf    |
| `aip-executive-2`                  | `AIP_Executive2.rpt`                     | `a1_usp_AIP2`                | Proc | same as above                                                          | pdf    |

All 4 AIP report keys share the **same** backing procedure (`a1_usp_AIP2`) — only the `.rpt`
template (layout) and its own report-level parameters differ between them.

**Report-level parameters** (Crystal's own display parameters, separate from the SQL parameters
above, matched in `CrystalReportRenderer.ApplyReportLevelParameters` by trimming a leading `@`,
discovered dynamically from whatever the `.rpt` defines at runtime — not hardcoded in C#). Every
PDF-output report needs these; `extract-pcmiow` (Excel, bypasses Crystal) does not. All rows below
were confirmed by directly calling `CrystalReportService` and reading its error response — not
inferred from code:

| Report                             | Report-Level Parameters (verified live, 2026-09-05; optional-field behavior updated 2026-10-23 per #422) |
|-------------------------------------|---------------------------------------------------------------------------------|
| `rbp`                               | `@PlanningEngineer`, `@ReviewdBy` *(sic — matches the existing typo in `ReportRequestMapper.MapRbp`, not a new one)*, `@ApprovedBy`, `@ReviewedBy` — all 4 **optional** (default to a blank signature block if omitted, per `ReportDefinition.OptionalReportLevelParameters`), plus `@yearstart`/`@programid`/`@region` (also report-level, **required**, in addition to being SQL params) |
| `rbp-summary-report`                | `@yearstart`, `@region`, `@programid` **required**; `@planningEngr`, `@reviewedBy`, `@approvedBy` **optional** (same blank-default behavior as `rbp`, as of #422) — none of these 6 feed the SQL query (the view takes no parameters at all); they exist purely for the printed report's own letterhead/signature block |
| `rbp-summary-report-with-tier`      | identical set to `rbp-summary-report` (same 6 names, same required/optional split) |
| `aip-official`                      | `@ReportType`, `@ReportTypeTitle`, `@region` — all required; notably does **not** list `@yearstart`/`@programid` as report-level params, unlike the other 3 AIP variants |
| `aip-executive`, `aip-official-without-ld`, `aip-executive-2` | `@ReportType`, `@ReportTypeTitle`, `@region`, `@yearstart`, `@programid` — all required |

**Three gotchas worth knowing before integrating a new caller:**
1. **An empty-string value counts as "not supplied."** `ApplyReportLevelParameters` treats
   `IsNullOrEmpty` as missing — so for reports where a field does double duty (e.g. `@region` is
   both an optional SQL filter *and* a required report-level display value), passing `region=""`
   satisfies the SQL layer but still fails Crystal's export with "Missing parameter values,"
   unless that field is also in the report's `OptionalReportLevelParameters` set (see #3 below).
2. **Parameter names are not consistent across templates for the same concept.** `rbp.rpt` uses
   `PlanningEngineer`/`ApprovedBy`/`ReviewedBy` (PascalCase, full words); the two summary-view
   reports use `planningEngr`/`approvedBy`/`reviewedBy` (camelCase, `planningEngr` abbreviated).
   These are genuinely different parameter names, not just different casing of the same one —
   sending `PlanningEngineer` to `rbp-summary-report` will not satisfy its `@planningEngr`
   requirement. Check the table above per-report; don't assume one report's field names transfer
   to another.
3. **Per-report optional report-level parameters (#422).** `ReportDefinition.OptionalReportLevelParameters`
   (`CrystalReportRenderer.cs`) lets specific `StringField` report-level parameters default to an
   empty string instead of failing when omitted — used for the Planning Engineer/Approver/Reviewer
   fields on all 3 PDF-output `rbp`-family reports today. Scoped per-report and `StringField`-only
   by design: a report not listed here keeps the original unconditional-required behavior, and a
   number/date/currency report-level parameter has no sensible empty default so always stays
   required even if a report were misconfigured to list one.

---

## Controller Endpoints

**File:** `WebAPI/Controllers/CrystalReport/ReportsController.cs`
**Route prefix:** `api/reports`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GetOptionsAsync` | GET `/options` | Dropdown data: `ReportTypes` (from `ReportCatalog.SupportedReports`), `ProgramYears`, `ProgramStages` (from `tOptionProgramStage`), `RegionalOffices`. No auth required; confirmed live 2026-09-05. |
| `FilterProgramsAsync` | GET `/filter-programs` | Programs filtered by year + stage, for the request form. |
| `QueueReportGenerationJobAsync` | POST `/{reportName}` | Validates via `ReportCatalog.IsSupported` + `ReportRequestMapper.TryMap`, enqueues the Hangfire job, saves a `tReportJobResult` row, returns `JobId` + `HangfireJobId` immediately. |
| `GetJobStatusAsync` | GET `/status/{jobId}` | Polls `tReportJobResult.Status` (`Queued` → `Processing` → `Completed` / `Failed` / `Cancelled`). **On failure, only the literal string `"Failed"` is persisted here** — the real error reaches a live SignalR notification (`ReportHub`, group `report-{jobId}`) only, not this endpoint. To diagnose a failed job, call `CrystalReportService` directly (`http://<host>:8090/api/reports/{reportName}?...`) — its error responses are descriptive (e.g. lists exactly which report-level parameters are missing). |
| `Download` | GET `/download?fileName=` | Reads and deletes the temp file from `Resources/Reports/`. |

**Request → SQL parameter mapping:** `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`
(`TryMap`, dispatches by `ReportCatalog.ReportFamily`: `Rbp` / `Aip` / `ExtractPcmiow` /
`RbpSummary`). Mapped
parameters are serialized by `Hangfire/Models/ReportParameterBag.cs` (`ToQueryString`, and `Parse`
on the way back out of storage — handles both JSON-object and querystring-encoded storage
transparently) into the outbound query string called on `CrystalReportService`. Both layers have
existing unit test coverage: `MYPS.UnitTests/ReportRequestMapperTests.cs`,
`MYPS.UnitTests/ReportParameterBagTests.cs`.

---

## Diagnostics & Logging

**Added 2026-09-07.** `CrystalReportService` had zero logging before this — `ReportsController.cs`'s
catch block carried a `// Log ex here` comment nothing implemented. A file-based attempt the same
day produced nothing on the live server: the IIS app pool identity cannot create a directory under
the site root (`App_Data\Logs`), and the write was swallowed silently with no fallback. Replaced
with a proper diagnostic logger writing to the **Windows Event Log**.

**Files:** `CrystalReportService/Diagnostics/ReportDiagnosticLogger.cs` (the logger itself, plus the
`IReportDiagnosticLogger` interface and its report-building/classification/redaction logic),
`ReportDiagnosticContext.cs` (the input shape), `ReportExceptionLogger.cs` (a
`System.Web.Http.ExceptionHandling.IExceptionLogger`, registered in `WebApiConfig.Register`, that
catches whatever `CrystalReportRenderer`'s own 8 instrumented call sites don't — an unknown report
name, or a genuinely unexpected failure outside the renderer entirely).

**Where to look:** Windows Event Viewer → Windows Logs → **Application**, source
**`CrystalReportService`**. Each entry is a structured report (error id, failure location, report
context, SQL diagnostics when applicable, recommended fix, redacted parameters, full exception
chain, stack trace) under a stable Event ID per failure category (1001–1009 for Crystal/SQL/timeout
categories, 1900 for anything unclassified — see the `EventId*` constants in
`ReportDiagnosticLogger.cs` for the full list). `ReportsController`'s error responses include the
same `ErrorId` (a GUID) that identifies the matching Event Log entry, so a user-reported failure
maps to one exact event.

**One-time setup required on every host, elevated (this cannot be automated by the deploy — an IIS
app pool identity cannot create an event source itself, that writes under HKLM):**

```powershell
New-EventLog -LogName Application -Source "CrystalReportService"
```

Until that's run, the logger degrades to a file — `App_Data\Logs\CrystalReportErrors_yyyyMMdd.log`
if the app pool can write there, else `%TEMP%\CrystalReportServiceLogs\` — and the file itself
states why it degraded and names the exact command above. `Application_Start`
(`Global.asax.cs`) also probes this at startup and writes the same warning to the fallback file if
the source isn't registered yet, so a missing registration is discoverable before the first real
failure rather than only at it.

**Redaction:** parameter keys matching `password`/`token`/`secret`/`apikey`/`connectionstring`/etc.
(substring, case-insensitive) are replaced with `[REDACTED]`; free text (SQL exception messages,
Crystal's own errors) is separately scrubbed for `Password=`/`User Id=`/`Pwd=`/`Uid=` fragments,
since `Web.config`'s `MypsDb` connection string holds a plaintext `sa` password and the Application
log has a far wider audience than a file under the site root ever did.

**Size limit:** `EventLog.WriteEntry` throws past ~32KB. Reports are truncated to 30,000 characters
as a final step, with an explicit `[REPORT TRUNCATED - ORIGINAL LENGTH: n CHARACTERS]` marker —
never silently cut.

---

## Known Caveats

- **`rbp-summary-report` and `rbp-summary-report-with-tier` are reachable via direct API call only
  — not yet wired into the Reports page UI.** Fixed 2026-09-05: `ReportCatalog.cs` now recognizes
  both keys under a new `ReportFamily.RbpSummary`, and `ReportRequestMapper.MapRbpSummary` maps a
  `GenerateRbpSummaryRequestDTO` (`YearStart`, `ProgramId`, `RegionCode` required;
  `PlanningEngr`/`ReviewedBy`/`ApprovedBy` optional as of #422 — see the Report-Level Parameters
  table below)
  to the exact `yearstart`/`region`/`programid`/`planningEngr`/`reviewedBy`/`approvedBy` keys
  Crystal expects. Confirmed live via `POST /api/reports/{reportName}` against the real WebAPI
  (see the report catalog table below) — but the frontend (`FE/src/pages/Reports/Reports.tsx`)
  still only ever builds the `rbp`-shaped request body regardless of which report type is
  selected, so these 2 reports (like the 4 AIP variants and `extract-pcmiow`) aren't usable from
  the actual Reports page yet — that's a separate, larger, already-attempted-once (PR #114,
  reverted as #121) piece of frontend work, not part of this fix.

- **Confirmed DB target: `myps_db_dev` on `192.168.50.200`.** This entire document, the fix script
  it references, and the end-to-end test all ran against `myps_db_dev` specifically — not `myps_db`
  (forbidden/retired, see below), not `myps_db_migrated`, not `myps_db_old`. All of these exist as
  separate, real sibling databases on the same server. Confirm this is still the current target
  (check `CODEX_SYNC_STARTUP.md` or the connection string actually in use) before trusting any
  schema/data fact in this document against a different environment.

- **`[myps_db]` cross-database bug (fixed 2026-09-05).** All 6 objects in the Report Catalog above
  used to hardcode a three-part name to `[myps_db]` — a separate, forbidden/retired database that
  happens to exist on the same SQL Server instance — instead of `myps_db_dev`, the database they're
  actually deployed on. This didn't error; it silently read stale/wrong data. Fixed and captured in
  `Main/Resources/Internal/SQLScripts/Reports.CrystalReportSQLFixes.sql` — read that file's header
  comment for the full defect list and rationale before touching any of these 6 objects again.

- **`'RBP'` is a real, distinct program stage — do not "fix" it to `'BP'`.** `dbo.tOptionProgramStage`
  defines `RBP` (`NameId=8`, "Regional Budget Proposal", `StageHierarchy=0.5`) separately from `BP`
  (`NameId=1`, "Budget Proposal", `StageHierarchy=1.0`) — RBP sits earlier in the pipeline. If a
  view/proc filtering on `StageName='RBP'` looks unpopulated in some environment, that reflects
  sparse dev data at that early stage, not a translation error. Confirmed directly by the operator
  2026-09-05 after an initial (wrong) hypothesis that it should map to `'BP'`.

- **`a1_usp_AIP2`'s PCMA join is permanently NULL today.** Its `LEFT JOIN dbo.pcma_project_modify`
  (feeding the `date_modify`/`myoa` output columns) can never match — that table has 0 rows,
  confirmed 2026-09-05. Not a bug in the proc; it reflects PCMA data genuinely not flowing into
  that table yet. Don't "fix" this without confirming PCMA data has actually started populating it.

- **`rbp-summary-report` switched from the `MYPS_vw_rptRBPSummary` view to `sp_RBPSummary`
  (2026-09-07), operator decision.** The View path kept failing at `ExportToStream`:
  `RBP Summary Report.rpt`'s own saved `Table.Location` is the bare name `sp_RBPSummaryTier` — a
  stale reference from before this report was pointed at the view (see the removed commented-out
  history in `CrystalReportRenderer.cs`'s `Reports` dictionary) — and rewriting `Location` at
  runtime to the correct object hit a separate Crystal SDK connection-validation failure inside
  `Table.set_Location` (`COMException: "Failed to open the connection."`, root cause not fully
  chased down — switching data source made it moot). Reverting to `StoredProcedure` sidesteps
  `ApplyDatabaseLogon`/`Location` entirely, since that path is only invoked for View-backed
  reports — matching the 6 other proc-backed reports that already work without it.
  **`sp_RBPSummaryTier` does not exist on `myps_db_dev` at all** (confirmed 2026-09-07) — so this
  same move isn't available for `rbp-summary-report-with-tier`, which stays View-backed
  (`MYPS_vw_rptRBPSummaryTier`) for now.
  - `sp_RBPSummary`'s live signature was already known to have diverged from its own legacy
    original (confirmed by the operator's own archived legacy copy, table names like `project`/
    `activity`/`ro_deo`/`projecttier` vs. the live version's `tProjectRevisions`/
    `tProjectComponentCost`/`tProgramStages`) — it takes only `@programid`, not the legacy
    `@yearstart`/`@programid`/`@region`. `yearstart`/`region` stay report-level Crystal parameters
    only (letterhead), same as before — they were never real SQL inputs to this report either way.
    The proc still carries earlier in-progress markers (commented-out `@StageName` parameter, a
    validation block referencing `dbo.tPrograms`) — used as-is per operator instruction, not
    completed as part of this fix.
  - **Known correctness issue in the live proc, not fixed (out of scope, flagged only):**
    `Legislative_District` comes back as a raw numeric code (e.g. `503`) instead of a resolved
    name for at least some rows — the proc's `LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict
    ld ON ld.Id = pr.LegislativeDistrict` joins on `ld.Id`, while every other confirmed-correct
    resolution in this codebase (`pGenerateAIP01`, `a1_usp_AIP2`) joins on `ld.Code` instead —
    the mismatch silently falls through to the `ISNULL(ld.Name, pr.LegislativeDistrict)` fallback.

- **Event Log source not registered = silent fallback to a file, not a crash.** If diagnostics
  seem to be "missing" for a report failure on a host, check the fallback log first
  (`App_Data\Logs\` or `%TEMP%\CrystalReportServiceLogs\`, see Diagnostics & Logging above) before
  assuming logging is broken — it almost certainly means `New-EventLog -LogName Application -Source
  "CrystalReportService"` was never run on that host, and the fallback file will say so explicitly.

- **`ReportService:BaseUrl` config gap.** Only set in `Main/appsettings.Development.json` today.
  `Main/appsettings.Staging.json` and the base `Main/appsettings.json` (the Production fallback —
  no separate `appsettings.Production.json` exists) don't have it configured. Confirmed 2026-09-05
  that `192.168.50.200` (Development) doesn't need this — `appsettings.Development.json` is
  already correct there. Staging/Production values are still unconfirmed; don't guess a URL for
  either without checking where the WebAPI process for that tier actually runs relative to wherever
  `CrystalReportService` is hosted for that tier.

---

## Stored Procedures / Views Used

| Object | Type | Purpose | Notes |
|--------|------|---------|-------|
| `sp_RBP` | Proc | Detail-level rows backing the RBP Summary/Tier PDF reports | `[myps_db]` bug fixed 2026-09-05 |
| `a1_usp_AIP2` | Proc | Backs all 4 AIP report variants | `[myps_db]` bug fixed 2026-09-05 |
| `usp_extract_PC_MIOW_list` | Proc | Extract PCMIOW raw data export | `[myps_db]` bug fixed 2026-09-05; renders via Excel, not Crystal |
| `MYPS_vw_rptRBPSummary` | View | RBP Summary rollup (OO1/OO2/CSSP/LP by DEO/Legislative District/RO) | `[myps_db]` bug + hardcoded placeholder totals + inconsistent stage filter, all fixed 2026-09-05 |
| `MYPS_vw_rptRBPSummaryTier` | View | Same rollup, split by Tier | `[myps_db]` bug fixed 2026-09-05; `BaseDistinct` CTE was leaking phantom all-zero rows for out-of-scope categories, fixed 2026-09-05 |

Full fix history and rationale: `Main/Resources/Internal/SQLScripts/Reports.CrystalReportSQLFixes.sql`.

---

## Dependencies

| Dependency | Notes |
|------------|-------|
| SAP Crystal Reports engine (`CrystalDecisions.CrystalReports.Engine`) | Required on whatever host runs `CrystalReportService` — a real runtime/licensing dependency, not just code. |
| .NET Framework 4.8 | `CrystalReportService` is a **separate build and deploy target** from the rest of this solution (.NET 8) — it does not ship inside the main `WebAPI` process. |
| IIS hosting (confirmed 2026-09-05) | Host `192.168.50.200`, app pool `CrystalReportService`, bound to port `8090`. Reachable directly at `http://192.168.50.200:8090/api/reports/{reportName}` for diagnosing a failed job (see Known Caveats above). |
| `MypsDb` connection string | `CrystalReportService`'s own `Web.config` `ConfigurationManager.ConnectionStrings["MypsDb"]` — separate from this repo's `appsettings.*.json` pattern; must point at `myps_db_dev` on `192.168.50.200` (the confirmed target as of 2026-09-05) — confirm it still does before assuming any schema/data fact in this document holds. |
| Windows Event Log source (added 2026-09-07) | `New-EventLog -LogName Application -Source "CrystalReportService"` — one-time, elevated, per host. Not automated by the deploy (an IIS app pool identity cannot create an event source itself). See Diagnostics & Logging above. |

---

*Last updated: 2026-09-07. See Git history for change log.*
