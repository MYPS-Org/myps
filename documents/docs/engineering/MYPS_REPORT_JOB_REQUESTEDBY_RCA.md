# tReportJobResult.RequestedBy always blank — root cause and fix

**Date:** 2026-09-16 · **Branch:** `fix/report-job-result-requestedby-null` (off `dev-trunk`)
**Status:** fixed and verified against `myps_db_dev` (192.168.50.200)

## Symptom

Every row in `tReportJobResult` had `RequestedBy` as an empty string, regardless of which user
generated the report. Confirmed on live data before any change:

```sql
SELECT TOP 5 Id, CASE WHEN RequestedBy IS NULL THEN 'NULL' WHEN RequestedBy = '' THEN 'EMPTY'
  ELSE RequestedBy END AS RequestedByState, LEN(RequestedBy) AS Len
FROM tReportJobResult ORDER BY Id DESC;
-- every recent row: EMPTY, Len = 0
```

Not SQL `NULL` — an actual empty string, `string.Empty`, which is the field's C# default.

## Root cause

`ReportsController` (`WebAPI/Controllers/CrystalReport/ReportsController.cs`) inherits
`ControllerBase` directly, not the app's `CoreController`. That was intentional: a prior fix
(commit `f0463315`, 2026-09-11, "Fix critical unauthenticated file exposure, 3 IDORs...") added
`[Authorize]` to this controller because it had no auth gate at all, but it did not — and could
not, without more work — move it onto `CoreController`.

`CoreController.OnActionExecuting` is the *only* code that resolves the logged-in user from claims
and populates the per-request `_Session` field:

```csharp
// CoreController.cs
string userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
var user = _db.vUsers.FirstOrDefault(x => x.UserId == userId && x.IsActive == true);
...
_Session = user;
```

`ReportsController` declares its own `_Session` field (`= new DBHelper.Models.Views.Users()`) but
nothing ever assigns it, because `CoreController`'s filter never runs for a controller that doesn't
inherit it. `Users.UserId` defaults to `string.Empty`, so `_Session.UserId` was always `""`.

`QueueReportGenerationJobAsync` used exactly that value:

```csharp
string User = _Session.UserId;          // always ""
var payload = new ReportJobPayload { ..., RequestedBy = User };
```

which flows into the initial `tReportJobResult` insert. The bug reproduces on every request,
independent of report type, output format (PDF vs. Excel), or success/failure of the underlying
report generation — the insert happens before any of that.

The `Download` action in the same file already avoids the bug, by reading the user id straight from
claims instead of `_Session`:

```csharp
var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
if (job == null || job.RequestedBy != userId) return NotFound(...);
```

That action was correct proof the ownership check *works* once given a real user id — the queueing
action just never supplied one.

## Why not just make `ReportsController` inherit `CoreController`?

Considered and rejected for this fix. `CoreController` carries `[PermissionFilter]`
(`AuthorizeSessionAttribute.cs`), which — beyond resolving `_Session` — also enforces a
per-controller/per-action permission check against `vUserActionPermission`:

```csharp
var hasPermission = await _db.vUserActionPermission.AnyAsync(x =>
    x.UserId == userId && x.IsActive &&
    x.PermissionController == controllerName && x.PermissionAction == actionName);
```

Queried live: no row in `vUserActionPermission` targets `ReportsController` for any action. The
only Report-related rows target `ReportingController`, a controller name that no longer exists in
the codebase — a permission set orphaned by an earlier rename. Inheriting `CoreController` today
would 403 every action on this controller for every user until someone seeds
`vUserActionPermission` with rows for `ReportsController` × each action × each role that should
have access. That is a data-migration and access-policy decision, not a code fix, so it is left as
separate follow-up work.

## The fix

`WebAPI/Controllers/CrystalReport/ReportsController.cs`, `QueueReportGenerationJobAsync`:

```diff
-            string User = _Session.UserId;
+            // _Session is never populated here -- this controller inherits ControllerBase, not
+            // CoreController, so CoreController's OnActionExecuting (which sets _Session from
+            // vUsers) never runs. Read the user id straight from claims instead, same as Download below.
+            var requestedByClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
+            if (string.IsNullOrEmpty(requestedByClaim))
+            {
+                return Unauthorized(new
+                {
+                    Title = "Session invalid",
+                    Message = "Your session does not contain a valid user id. Please sign in again."
+                });
+            }
+            string requestedBy = requestedByClaim;

             var payload = new ReportJobPayload
             {
                 ReportName = reportName,
                 QueryString = JsonSerializer.Serialize(legacyParams),
-                RequestedBy = User
+                RequestedBy = requestedBy
             };
```

Reuses the exact pattern already proven correct by `Download` in the same file. No
`CoreController`/permission-model change, no DB schema change.

The first version of this fix fell back to `?? string.Empty` when the claim was missing, silently
writing an empty `RequestedBy` rather than a real one — a smaller version of the same "blank
audit-trail field" defect this RCA is about. Since `[Authorize]` already guarantees an authenticated
identity before the action body runs, and `AuthController.Login` always stamps
`ClaimTypes.NameIdentifier` on a successful login, the claim being absent here should be
unreachable through the normal auth flow. Rather than mask that (via `?? string.Empty`) or crash
into an unhandled exception (via `throw`, and this controller has no exception-handling middleware
or `IMYPSExceptionHandler` wired in to catch one), the final version fails the single request
cleanly with `401 Unauthorized` and a clear message, and never inserts a `tReportJobResult` row at
all for that request.

## Verification (2026-09-16, against `myps_db_dev` on 192.168.50.200)

`dotnet build` on `WebAPI.csproj`: 0 errors.

**Initial local test hit a stale server.** The first end-to-end attempt through the actual app
(id 308) still came back blank. Traced to `FE/.env.development` pointing
`VITE_API_BASE_URL` at the remote `https://myps.eptisa-dev.com` host, which runs whatever was last
deployed there — not this branch. Not a fix failure; a test-environment mismatch. Temporarily
pointed the FE dev server at a freshly-built local backend to test for real, then reverted
`.env.development` afterward (it is not part of this fix).

A second, unrelated false start: the very first local backend I launched turned out to be a
pre-existing `Main.exe` process (PID 45368, started 2026-09-15 11:04, i.e. the day before, from a
pre-fix build) already holding port 5015. Killed it and started a genuinely fresh build before
re-testing.

**End-to-end, against the fresh local build, full lifecycle (queue → poll → download):**

| Report | Family | Job Id | RequestedBy | Result |
|---|---|---|---|---|
| `extract-pc` (Excel path) | `ExtractPc` | 307 | `longboanak` | Completed |
| `extract-pc` (Excel path) | `ExtractPc` | 316 | `longboanak` | Completed; downloaded valid `.xlsx` (3.4 KB); second download attempt correctly 404s (delete-after-download still works) |
| `rbp` (Crystal/PDF path) | `Rbp` | 317 | `longboanak` | Failed — bad test data (`programid=1` doesn't exist); **`RequestedBy` still correctly populated on the failure path** |
| `rbp` (Crystal/PDF path) | `Rbp` | 318 | `longboanak` | Failed — real `ProgramId` but missing report-level parameters the `.rpt` requires (`@PlanningEngineer`, `@ReviewdBy`, `@ApprovedBy`, `@ReviewedBy`) that `ReportRequestMapper.MapRbp` treats as optional; confirmed via direct call to CrystalReportService, which returns the exact missing-parameter list |
| `rbp` (Crystal/PDF path) | `Rbp` | 319 | `longboanak` | Completed with all signatory fields supplied; downloaded valid PDF (1 page, 74.6 KB) |
| `extract-pc` (Excel path), re-tested after the `Unauthorized` guard was added | `ExtractPc` | 320 | `longboanak` | Completed — guard does not interfere with the normal authenticated path |

A request with no session cookie at all was also re-tested against the guarded build: it still gets
`401` from the standard `[Authorize]`/cookie-auth pipeline before the action body ever runs, so it
never reaches the new check — expected, and consistent with the guard being unreachable dead code
under the current auth flow rather than a path with real traffic.

Both output-format code paths (`IExcelReportGenerator` direct-to-Excel, and the
CrystalReportService HTTP round trip for PDF) confirmed. `RequestedBy` is populated on both the
success and the failure branch, since the write happens once at queue time regardless of how the
background job resolves.

Cleaned up after testing: reverted `FE/.env.development`, deleted leftover
`Main/Resources/Reports/extract-pc_*.xlsx` test artifacts, stopped the local FE/backend
processes started for verification.

## Known, unrelated finding surfaced during verification

`ReportRequestMapper.MapRbp` (and by inspection, the AIP/RbpSummary mappers) treats
`PlanningEngineer`, `ReviewedBy`, and `ApprovedBy` as optional, but the underlying `rbp.rpt` Crystal
template requires all of them as report-level parameters and fails the whole job with a 400 if any
are missing. This is exactly the same mapper-says-optional/Crystal-says-required mismatch already
called out as a known caveat for `MapRbpSummary` in `ReportRequestMapper.cs`, just not yet fixed for
`MapRbp`. Not fixed here — out of scope for this RCA — but worth a follow-up ticket since it means
any `rbp` request that omits a signatory field always fails, not just sometimes.
