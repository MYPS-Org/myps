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
4. [Known Caveats](#known-caveats)
5. [Stored Procedures / Views Used](#stored-procedures--views-used)
6. [Dependencies](#dependencies)

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
| `rbp-summary-report`               | `RBP Summary Report.rpt`                 | `MYPS_vw_rptRBPSummary`      | View | none — the view itself is unparameterized, **but see Report-Level Parameters below: this is not a zero-input report** | pdf |
| `rbp-summary-report-with-tier`     | `RBP_Summary_Report_with_Tier.rpt`       | `MYPS_vw_rptRBPSummaryTier`  | View | none — same caveat as above                                          | pdf    |
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

| Report                             | Report-Level Parameters (verified live, 2026-09-05)                           |
|-------------------------------------|---------------------------------------------------------------------------------|
| `rbp`                               | `@PlanningEngineer`, `@ReviewdBy` *(sic — matches the existing typo in `ReportRequestMapper.MapRbp`, not a new one)*, `@ApprovedBy`, `@ReviewedBy`, plus `@yearstart`/`@programid`/`@region` (also report-level, in addition to being SQL params) |
| `rbp-summary-report`                | `@yearstart`, `@region`, `@planningEngr`, `@reviewedBy`, `@approvedBy`, `@programid` — **none of these feed the SQL query** (the view takes no parameters at all); they exist purely for the printed report's own letterhead/signature block |
| `rbp-summary-report-with-tier`      | identical set to `rbp-summary-report` (same 6 names, same purpose)              |
| `aip-official`                      | `@ReportType`, `@ReportTypeTitle`, `@region` — notably does **not** list `@yearstart`/`@programid` as report-level params, unlike the other 3 AIP variants |
| `aip-executive`, `aip-official-without-ld`, `aip-executive-2` | `@ReportType`, `@ReportTypeTitle`, `@region`, `@yearstart`, `@programid` |

**Two gotchas worth knowing before integrating a new caller:**
1. **An empty-string value counts as "not supplied."** `ApplyReportLevelParameters` treats
   `IsNullOrEmpty` as missing — so for reports where a field does double duty (e.g. `@region` is
   both an optional SQL filter *and* a required report-level display value), passing `region=""`
   satisfies the SQL layer but still fails Crystal's export with "Missing parameter values."
2. **Parameter names are not consistent across templates for the same concept.** `rbp.rpt` uses
   `PlanningEngineer`/`ApprovedBy`/`ReviewedBy` (PascalCase, full words); the two summary-view
   reports use `planningEngr`/`approvedBy`/`reviewedBy` (camelCase, `planningEngr` abbreviated).
   These are genuinely different parameter names, not just different casing of the same one —
   sending `PlanningEngineer` to `rbp-summary-report` will not satisfy its `@planningEngr`
   requirement. Check the table above per-report; don't assume one report's field names transfer
   to another.

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

## Known Caveats

- **`rbp-summary-report` and `rbp-summary-report-with-tier` are reachable via direct API call only
  — not yet wired into the Reports page UI.** Fixed 2026-09-05: `ReportCatalog.cs` now recognizes
  both keys under a new `ReportFamily.RbpSummary`, and `ReportRequestMapper.MapRbpSummary` maps a
  `GenerateRbpSummaryRequestDTO` (`YearStart`, `ProgramId`, `RegionCode`, `PlanningEngr`,
  `ReviewedBy`, `ApprovedBy` — all 6 required, matching what both `.rpt` templates actually need)
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

- **`sp_RBPSummary` (the stored procedure) is a different, unrelated object.** Its live signature
  has diverged from both its own legacy original and this rendering path (which uses the *view*
  `MYPS_vw_rptRBPSummary`, never this proc) — it shows active, separate, in-progress work
  (commented-out `@StageName` parameter, a validation block referencing `dbo.tPrograms`). Do not
  conflate the two, and do not "fix" `sp_RBPSummary` as part of touching this Crystal pipeline.

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

---

*Last updated: 2026-09-05. See Git history for change log.*
