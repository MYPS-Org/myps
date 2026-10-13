# Report generation and Import/Export jobs get stuck "Generating…"/"pending" — root cause and fix

**Date:** 2026-10-13 · **Branch:** `fix/report-job-stuck-processing` (off `main`)
**Status:** fixed; builds clean (`dotnet build` on `Main.csproj`: 0 errors; `tsc -b --noEmit`: 0 new errors,
25 pre-existing errors unrelated to this work remain in `src/pages/Rbac/**`). Not yet verified end-to-end
against a live prod deployment (see **Theory 2, unresolved** below).

## Symptom

On `/reports`, choosing a report and clicking **Generate Report** sometimes never resolves — the button
stays on "Generating…" forever, even though `tReportJobResult.Status` is `Completed` in the database and
the rendered file exists on disk. The same class of "stuck pending" behavior was confirmed to also be
possible for background Import/Export jobs (`tImportJobResult`), surfaced as a toast that never arrives.

## How a report/import job is supposed to resolve

1. `POST /api/reports/{name}` (or the import/export enqueue endpoint) inserts a `Queued` job row, enqueues
   a Hangfire job, and returns a `JobId`.
2. The Hangfire worker (`ReportJobService.GenerateReport` / `ImportProjectJobService.ProcessImport` /
   `.ProcessExport`) renders the report or processes the file, writes the job row to a terminal status
   (`Completed`/`Failed`/`Cancelled`/`CompletedWithErrors`), and **broadcasts** that status over SignalR to
   a per-job group (`report-{jobId}` / `import-{jobId}`).
3. The browser joins that SignalR group and reacts to the broadcast. If it's missed, there is a one-shot
   REST catch-up check (`GET /api/reports/status/{jobId}` / `GET /Importing/GetImportStatus`) as a fallback.

Every bug found below breaks one link in this chain — either the backend never reaches a terminal status,
or the frontend never finds out that it did.

## Root causes found (all confirmed against this repo's current code)

### 1. Backend: `ReportJobService.GenerateReport` could leave a job stuck at `Processing` forever

`Hangfire/Services/ReportJobService.cs`. Three distinct gaps, all in the same file:

- **The generic `catch (Exception ex)` never persisted `Failed`.** Unlike the `ArgumentException` catch
  right above it, the last-resort handler only sent a SignalR notification and rethrew — it never wrote
  `Status = "Failed"` to `tReportJobResult`. If the SignalR broadcast was missed (see cause #3 below), the
  REST catch-up fallback kept returning `Processing` forever, because the DB row was never updated.
- **`catch (OperationCanceledException)` never touched the database at all** — only the SignalR notify
  fired. A cancelled job stayed `Processing` in `tReportJobResult` permanently. Its sibling file,
  `Hangfire/Services/ImportProjectJobService.cs`, already persists `Cancelled` correctly for its own jobs;
  `ReportJobService.cs` did not.
- **Every "mark Failed" write was unprotected against its own failure.** If `SaveChangesAsync()` itself
  threw (a transient DB issue — exactly the kind of failure likely to be in flight when something else
  already went wrong), the new exception escaped the catch block uncaught, skipped notification entirely,
  and left the job at `Processing`. `ImportProjectJobService.cs` already guards this exact scenario with a
  nested try/catch around its own terminal-status saves; `ReportJobService.cs` did not.
- **The Crystal-service HTTP failure path discarded the real error.** `Message` was hardcoded to the
  literal string `"Failed"` instead of the actual `errorDetail` body returned by CrystalReportService —
  anyone relying on the REST status-poll fallback (as opposed to the SignalR push, which did carry the
  real message) saw no useful reason for the failure.

**Fix:** consolidated all four terminal-status writes (`Failed` ×3, `Cancelled`) behind one
`TrySaveTerminalStatusAsync(jobRecord, status, message)` helper with its own try/catch that logs rather
than throws on a save failure, and passes through the real error message (truncated to the column's
`MaxLength(500)` via a `TruncateMessage` helper, since `Message` would otherwise throw on an
overlong Crystal error body). Mirrors the pattern already proven in `ImportProjectJobService.cs`.

```diff
-                        jobRecord.Status = "Failed";
-                        jobRecord.Message = "Failed";
-                        jobRecord.CompletedAt = Functions.CurrentDate();
-                        _db.tReportJobResult.Update(jobRecord);
-                        await _db.SaveChangesAsync();
-
+                        await TrySaveTerminalStatusAsync(jobRecord, "Failed", errorDetail);
                         await NotifyClient(payload.JobId, "Failed", errorDetail, null);
                         return;
@@
             catch (OperationCanceledException)
             {
                 _logger.LogWarning("Report job {JobId} was cancelled", payload.JobId);
+
+                await TrySaveTerminalStatusAsync(jobRecord, "Cancelled", "Report generation was cancelled.");
                 await NotifyClient(payload.JobId, "Cancelled", "Report generation was cancelled.", null);
             }
@@
             catch (Exception ex)
             {
+                await TrySaveTerminalStatusAsync(jobRecord, "Failed", ex.Message);
+
                 _ = _exceptionHandler.Handle(ex, payload, payload.RequestedBy);
                 await NotifyClient(payload.JobId, "Failed", ex.Message, null);
                 throw;
             }
```

### 2. Frontend: SignalR's `withAutomaticReconnect()` gives up for good — and nothing ever polled again

`FE/src/pages/Reports/Reports.tsx` and `FE/src/components/ImportJobNotifier.tsx`. `@microsoft/signalr`'s
`withAutomaticReconnect()` uses a fixed retry schedule (0s, 2s, 10s, 30s by default) and then stops
permanently — no more reconnect attempts for that page session, and no further hub events ever fire again.

A long-running report (Crystal Report rendering through the separate `CrystalReportService`, the slowest
path in the system) or a large import/export can easily outlast a reverse-proxy or App-Pool websocket idle
timeout. Once that connection drops and reconnection is exhausted:

- `Reports.tsx` only ever ran its REST catch-up check (`checkStatus`) **once**, immediately after the
  initial hub join (to close the startup race where a fast job finishes before the join completes) and
  once more on `onreconnected`. There was no periodic polling and no handling of a connection that closes
  for good.
- `ImportJobNotifier.tsx` was **worse**: it didn't even do the one-shot post-join check. The only recheck
  path was `onreconnected`, so even the startup race (a fast export finishing before `JoinJobGroup`
  completes) was completely unhandled, on top of the same "no backstop once reconnection is exhausted" gap.

Either way: the backend finishes correctly and writes the terminal status, but the browser has no code path
left that will ever ask again.

**Fix:**
- `Reports.tsx`: added an 8-second polling interval (`setInterval(checkStatus, 8000)`) as a backstop,
  started *before* `connection.start()` even runs (so it protects the UI even if the hub connection fails
  to establish at all), cleared once the job reaches a terminal status or the component unmounts.
- `ImportJobNotifier.tsx`: added the missing post-join catch-up check (closing the startup race), plus a
  10-second polling interval over all pending jobs as the same kind of backstop. Also added a presence
  re-check before notifying/resolving a job, to avoid a duplicate toast if the live SignalR event and a
  poll resolve the same job concurrently.

In both cases SignalR remains the primary, low-latency path — polling only fills the gap when it silently
fails.

### 3. Frontend: SignalR hub URLs were built from a build-time env var that still ships as a placeholder

Investigated from a separate hand-off document, `MYPS_REPORT_DOWNLOAD_PROD_RCA.md` (prod-only symptom
report, theory-only at the time). Confirmed against this repo's actual tracked files:

- `FE/.env.production` is tracked in git and still contains the literal placeholder
  `VITE_API_BASE_URL=https://your-production-api.com`.
- `Reports.tsx`, and `main.tsx` for the shared notification hub and the import hub, all built their
  SignalR connection URL as `` `${import.meta.env.VITE_API_BASE_URL}/hubs/...` `` / `/notificationHub`.
  Vite inlines that value **at build time**. A build cut from a checkout with the placeholder still in
  `.env.production` bakes `https://your-production-api.com/hubs/report` etc. straight into the shipped
  bundle — confirmed by actually running `vite build` (no mode flag, so it reads `.env.production`) from
  this checkout and grepping the output for the literal string.
- REST calls were unaffected, because `httpClient.ts` already uses a relative `baseURL: '/api'` — which is
  exactly why reports/imports "half-worked": the job queues fine (REST), but the hub connection used to
  learn about completion silently fails.
- Confirmed same-origin deployment: `FE/vite.config.ts`'s `build.outDir` is `'../Main/wwwroot/'` — the SPA
  is built directly into the ASP.NET Core app's own `wwwroot` and served by the same process, so a
  same-origin relative path is always correct in a real deployment, in the same way the REST `/api` path
  already is.

**Fix:** switched all three hub connections (`notificationHub`, `/hubs/import`, `/hubs/report`) to
same-origin relative paths, removing the dependency on `VITE_API_BASE_URL` for hubs entirely — a future
bad/placeholder env value can no longer break them. Added matching dev-server proxy entries (with
`ws: true` for the websocket upgrade) to `vite.config.ts` so `npm run dev` keeps working, mirroring the
`/api` proxy already there.

```diff
-signalRService.startConnection(`${import.meta.env.VITE_API_BASE_URL}/notificationHub`)
+signalRService.startConnection('/notificationHub')
...
-signalRService.startConnection(`${import.meta.env.VITE_API_BASE_URL}/hubs/import`, 'import')
+signalRService.startConnection('/hubs/import', 'import')
```

```diff
 const connection = new HubConnectionBuilder()
-  .withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/report`, { withCredentials: true })
+  .withUrl('/hubs/report', { withCredentials: true })
   .withAutomaticReconnect()
   .build();
```

Verified by running both `vite build --mode development` and a real `vite build` (production mode, reads
`.env.production`) from this checkout and grepping the output: the placeholder no longer appears in any
hub-related chunk. (One unrelated usage of `VITE_API_BASE_URL` remains, for document download links in
`RevisionForm.tsx`/`NotesForm.tsx` — out of scope for this RCA, noted separately below.)

### 4. Backend: `ReportService:BaseUrl` has no value for a Production environment, and failed lazily

`Main/Program.cs` reads `ReportService:BaseUrl` into `new Uri(...)` only when `CreateClient("ReportService")`
is first called — i.e., the first time a PDF report job runs, not at app startup. There is no
`appsettings.Production.json` in the repo, and the base `appsettings.json` has no `ReportService` section
at all (`appsettings.Development.json` and `appsettings.Staging.json` both have it). In a Production
environment missing this config, every PDF report (RBP/AIP/RBP Summary) would fail with a generic,
hard-to-diagnose `ArgumentNullException` on first use — caught by `ReportJobService`'s
`catch (ArgumentException)`, surfaced to the user only as "report generation failed."

**Fix:** validated eagerly during service registration in `Program.cs`, before `AddHttpClient` runs —
throws a clear `InvalidOperationException` naming the missing environment if `ReportService:BaseUrl` is
unset, so a misconfigured deployment fails loudly at startup instead of silently on the first PDF job.

```diff
+var reportServiceBaseUrl = builder.Configuration["ReportService:BaseUrl"];
+if (string.IsNullOrWhiteSpace(reportServiceBaseUrl))
+{
+    throw new InvalidOperationException(
+        $"Configuration 'ReportService:BaseUrl' is missing in the '{builder.Environment.EnvironmentName}' environment. " +
+        "It is required for PDF report generation (RBP/AIP/RBP Summary reports call the CrystalReportService at this URL) " +
+        "-- set it in the matching appsettings.{Environment}.json or via an environment variable before starting the app.");
+}
+
 builder.Services.AddHttpClient("ReportService", client =>
 {
-    client.BaseAddress = new Uri(builder.Configuration["ReportService:BaseUrl"]!);
+    client.BaseAddress = new Uri(reportServiceBaseUrl);
     client.Timeout = TimeSpan.FromMinutes(10);
 });
```

**⚠️ Deployment note:** this changes failure mode from "app starts, PDF reports fail" to "app refuses to
start at all" in any environment missing this key. Confirmed `Development`/`Staging` already have it set
(`http://localhost:8090/` and `http://10.0.10.225:8090/` respectively) so neither breaks. **Production must
have `ReportService:BaseUrl` configured before this change is deployed there**, or the whole app will fail
to start, not just PDF reports.

### 5. Security: `GET /api/reports/status/{jobId}` had no ownership check (IDOR)

`WebAPI/Controllers/CrystalReport/ReportsController.cs`. The `Download` action already carries a
documented 2026-09-11 IDOR fix (`job.RequestedBy != userId → 404`), but the sibling `status/{jobId}`
endpoint was missed — any authenticated user who knew or guessed a `jobId` could poll another user's job
status and see the real `Message`/`FileName`.

**Fix:** applied the same ownership check already used by `Download`.

```diff
             var job = await _db.tReportJobResult
                 .AsNoTracking()
                 .FirstOrDefaultAsync(x => x.JobId == jobId, ct);

-            if (job == null)
+            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
+            if (job == null || job.RequestedBy != userId)
                 return NotFound(new { Message = "Report job not found." });
```

## Theories investigated and ruled out / deferred

- **`tReportJobResult.RequestedBy` blank** (would 404 every download even on a `Completed` job) — already
  fixed and verified in a separate prior RCA, `MYPS_REPORT_JOB_REQUESTEDBY_RCA.md` (commits `28e63af0` /
  `30f03bd3`). Confirmed `ReportsController.cs`'s queueing action still reads the user id from claims, not
  `_Session`, consistent with that fix remaining in place.
- **Theory 2, unresolved — can prod's actual deployed build contains the `RequestedBy` fix above?** Not
  verifiable from this repo; requires checking the commit actually running in production. Flagged, not
  closed.
- **CORS allow-list** (`Main/Program.cs`): only matters if the SPA and API are ever served from different
  origins. Confirmed via `vite.config.ts`'s `build.outDir` that they are not — the SPA is built directly
  into the API's own `wwwroot`. Not a live issue under the current deployment model.
- **App-pool identity unable to write `Resources\Reports`/`Resources\Imports`** — would surface as a
  `Failed` job with an access-denied message, not a stuck job. Not investigated further; distinguishable
  from every bug above by the job reaching `Failed` with a specific message, once fix #1 above is deployed
  (previously, this exact scenario would *also* have looked like a stuck job, since the DB write and
  SignalR notify were unprotected against being skipped).

## Unrelated finding surfaced during this investigation

`Main/appsettings.Staging.json` is tracked in git with **plaintext secrets**: the `MYPSDb`/`PCMADb`
connection strings carry a real SQL login and password (`User Id=MYPSApplication;Password=***REMOVED***`), and
an `SMTP` section carries a real Gmail app password. Not rotated or removed as part of this change — that's
a credentials/ops decision requiring its own follow-up (rotate the exposed credentials, then remove them
from source going forward; removing them retroactively from git history is a separate, more invasive
decision the owning team should make deliberately).

## Files changed

| File | Change |
|---|---|
| `Hangfire/Services/ReportJobService.cs` | All terminal-status writes (`Failed` ×3, `Cancelled`) now go through `TrySaveTerminalStatusAsync`, which can't itself leave a job stuck; real Crystal-service error message now persisted instead of a hardcoded `"Failed"` string |
| `WebAPI/Controllers/CrystalReport/ReportsController.cs` | `GET status/{jobId}` now checks `RequestedBy` ownership, matching `Download` |
| `Main/Program.cs` | `ReportService:BaseUrl` validated eagerly at startup instead of lazily on first PDF job |
| `FE/src/pages/Reports/Reports.tsx` | 8s polling backstop independent of SignalR connection health; hub URL now same-origin relative path |
| `FE/src/components/ImportJobNotifier.tsx` | Added missing post-join catch-up check; added 10s polling backstop; added duplicate-toast guard |
| `FE/src/main.tsx` | `notificationHub`/`hubs/import` connections now same-origin relative paths |
| `FE/vite.config.ts` | Added dev-server proxy entries for `/notificationHub` and `/hubs` (with `ws: true`), matching the existing `/api` proxy |

## Verification performed

- `dotnet build Main/Main.csproj` (pulls in `Hangfire`/`WebAPI`): 0 errors.
- `npx tsc -b --noEmit` on the FE project: 25 errors, all pre-existing in `src/pages/Rbac/**`
  (confirmed identical count/file set against the unmodified base commit via `git stash`) — zero new
  errors from this change.
- `npx vite build --mode development` and `npx vite build` (production mode): both succeed; grepped output
  confirms the `https://your-production-api.com` placeholder no longer appears in any hub-related chunk.
- Not yet performed: a live end-to-end run against a real backend (queue a report/import, kill the
  websocket mid-job, confirm the polling backstop picks it up) — the fix logic was verified by full manual
  trace of each code path plus the build/typecheck passes above, not by live reproduction.
