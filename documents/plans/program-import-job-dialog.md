# Plan: Adapt Program Import Dialog to New Job-Based Backend

Status: Implemented
Created: 2026-08-20
Source: Conversation — user pointed at `ProgramDetail.tsx` and `ImportProjectsDialog.tsx`, asked to adapt the FE to the backend's new async-job import pipeline (commit `eb3327af`), while keeping the old dialog untouched for later use.

## Goal

Give the Program module a working "Import Projects" flow that matches what the backend actually does today (upload → queue a Hangfire job → poll status → download reports), without disturbing the old client-side-parse dialog, which stays in the codebase unused for possible later reuse.

## Context

Commit `eb3327af` ("Importing Projects - Validation and Writing to DB") replaced the old synchronous, client-parsed import with a server-side async job pipeline in `WebAPI/Controllers/Importing/ImportingController.cs` (`ImportProject` → Hangfire job → `GetImportStatus` poll → `DownloadImportFile`). No frontend code calls this new contract yet — the live "Import Projects" menu item still POSTs the old, now-dead JSON-payload shape.

The user wants the old dialog (`ImportProjectsDialog.tsx`) left completely alone for possible later use, and a **new** dialog built that drives the actual current backend flow. `ProgramDetail.tsx` (the file the user pointed at) doesn't own import logic directly — `ActionsDropdown.tsx` does — so the real work is there plus a small backend addition.

## What already exists server-side (verified by reading the code, not assumed)

- `POST /api/Importing/ImportProject` — body `{ ProgramId, StageName, FileURL }`. Acquires a DB-backed system-wide lock (`tImportingStatus`), creates an `ImportJobResult` row, enqueues a Hangfire job, returns `{ JobId, HangfireJobId, Message, Title }`. Returns 400 `{Title:"Import In Progress", Message:"Import is currently in use by {holder}..."}` if locked.
- `GET /api/Importing/GetImportStatus?jobId=` — returns `{ JobId, HangfireJobId, Status, Message, ValidCount, WarningCount, ErrorCount, QueuedAt, StartedAt, CompletedAt, TextFileUrl, ExcelFileUrl }`. `Status`: `Queued` → `Processing` → terminal (`Completed` | `CompletedWithErrors` | `Failed` | `Cancelled`).
- `GET /api/Importing/DownloadImportFile?fileName=` — streams and **deletes** the file after one download. `TextFileUrl` always populated once done; `ExcelFileUrl` only when there were validation errors.
- `ImportProjectJobService.ProcessImport` reads the workbook from `FileUrl`: downloads it if the string starts with `"http"`, otherwise treats it as a **local file path on the server** via `FileInfo`.

## The gap: no upload endpoint exists

Nothing in the backend turns an uploaded browser file into a `FileURL`. Fix: add one new action, following this codebase's existing (currently only used in commented-out code, but live/working) JSON-base64 upload pattern — `DBHelper/Models/Extra/FileUpload.cs` (`{Name, Extension, ContentType, DataUrl}`) + `Helpers/Functions.cs` extensions `IsFileCorrupted()` / `UploadFile(path)`.

**`POST /api/Importing/UploadImportFile`** (new action in `ImportingController.cs`):
- `[AllowAnonymous] [HttpPost]` (matches the other 3 actions in this controller — not a new inconsistency).
- Body: `FileUpload`. Reject non-`.xlsx`/`.xlsm` extensions outright (narrower than the generic `IsExcelCorrupted()` allowlist, which also permits `.xls` — but `ImportingHelper`/`ProcessImport` reads the workbook via EPPlus `ExcelPackage`, which is OOXML-only, so a real `.xls` would fail later inside the untraceable Hangfire job instead of cleanly here).
- Call `file.IsFileCorrupted()`; on failure return `400 { Title: "File Corrupted", Message: "Uploaded file is corrupted." }` (matches the wording used at the one other call site in `RevisionController.cs`).
- On success: `var path = Path.Combine(_env.ContentRootPath, "Resources", "Imports", $"{Guid.NewGuid():N}.xlsx"); file.UploadFile(path);` → return `200 { FileURL = path }`. Treat a `false` return from `UploadFile` as the same 400, not a 500.
- This keeps `ImportProject`'s existing `FileURL`-string contract, `ImportProgramDetailsWithFileURL`, and `ProcessImport` **completely untouched** — no wasted HTTP round-trip since the job service already special-cases non-`"http"` values as local paths on the same machine.

## Real-time status: poll, don't add SignalR

`ImportHub` (mapped at `/hubs/import`) exists server-side and pushes `ImportStatusChanged`, but `FE/src/services/signalrService.ts` is a single hardcoded connection to `/notificationHub` with no multi-hub support, and nothing on FE talks to `/hubs/import` today. Building that out for one dialog's progress bar is disproportionate. Instead: poll `GetImportStatus` every 2.5s once a `JobId` is returned; stop on terminal status or dialog close/unmount (`useEffect` cleanup).

**Preloader problem this creates, and its fix:** every `httpClient` request triggers the app's global preloader overlay (`FE/src/services/httpClient.ts`, no way to suppress today). Polling every 2.5s would make that overlay flash on/off repeatedly, fighting the dialog's own inline status UI. Fix: add an optional `silent?: boolean` to `RequestConfig` in `httpClient.ts` and skip the two `updatePreloader(...)` calls in the request/response interceptors when set — small, backward-compatible, and the new `getImportJobStatus` polling call is the only caller that will pass it.

## New frontend dialog

`FE/src/pages/Program/dialogs/ImportProjectsJobDialog.tsx` (new file). Reuses `ImportProjectsDialog.tsx`'s header/dropzone visual chrome (`DialogPanel`, `ArrowUpTrayIcon`/`DocumentArrowUpIcon`, `Button` from `../../../components/tailwindui/button`) but replaces the client-side multi-sheet parse + 7-tab preview with a `phase` state machine: `idle → uploading → queuing → polling → done`.

Flow: pick one `.xlsx`/`.xlsm` file → client-side extension check (manual `showToast` + abort if wrong type, no API call) → `FileReader.readAsDataURL` → build `FileUpload` payload → `uploadImportFile()` → `startImportProjectJob({ProgramId, StageName, FileURL})` → on 400 "Import In Progress", reset to `idle` (httpClient's interceptor already toasts it, no duplicate manual toast, per `FE/CLAUDE.md`) → on success, poll `getImportJobStatus(jobId)` (silent) until terminal → render `ValidCount`/`WarningCount`/`ErrorCount` + plain `<a href={TextFileUrl}>` (always) and `<a href={ExcelFileUrl}>` (only if non-null) — plain navigation links, not fetch/blob, since `DownloadImportFile` is a one-shot GET. Call `onImported()` once on first terminal-success so the caller can refresh the project table.

New `Service.ts` additions (same `httpClient.post`/`.get` + try/catch/rethrow pattern already used throughout the file): `uploadImportFile(file: FileUpload)`, `startImportProjectJob(data: {ProgramId, StageName, FileURL})`, `getImportJobStatus(jobId: string)` (passes `{silent: true}`).

New type `ImportJobStatus` added to `FE/src/pages/Program/Model.d.ts`.

## Wiring change

`ActionsDropdown.tsx`: swap `ImportProjectsDialog` → `ImportProjectsJobDialog` in the "Import Projects" menu item. Delete `handleImportProjectsSubmit` and its now-dead imports (`transformImportedProjects`, `importProjects`, the console-log block) since nothing calls them once the old dialog is unmounted from here. Wire the new dialog's completion callback to the existing `onRefresh` prop (already threaded from `ProgramDetail.tsx` — **no changes needed there**, confirmed by reading it).

`ImportProjectsDialog.tsx`, `parseImportFile.ts`, `transformImportedProjects.ts` — byte-for-byte untouched, per explicit instruction.

## Blocking risk found during research

`ImportJobResult` (`DBHelper/Models/Table/ImportJobResult.cs`) has an EF model and a `DbSet<ImportJobResult> tImportJobResult` on `MYPSDbContext`, but grepping the whole repo, **no `CREATE TABLE dbo.tImportJobResult` exists anywhere** — not in `Main/LOCAL-MYPS(table-schema).sql` (the checked-in full-schema snapshot, which does contain `tImportingStatus`, just not this table) and not in any script under `Main/Resources/Internal/SQLScripts/`. As committed, `ImportProject`/`GetImportStatus` will throw `Invalid object name 'dbo.tImportJobResult'` against a DB built from what's in this repo.

This repo has a precedent for feature-scoped incremental schema scripts (`Main/Resources/Internal/SQLScripts/LSWallet.Schema.sql` etc.), so this plan adds `Main/Resources/Internal/SQLScripts/Importing.Schema.sql` with the missing `CREATE TABLE`, matching the model's columns. This just adds a script to source control — it does not run itself against any live database; that's a separate action someone takes when ready to test.

## Acceptance Criteria

As a program manager, I want to import a projects Excel file through a UI that matches how the backend actually processes it now, so that imports run as an async validated job with clear pass/fail counts and downloadable reports instead of the old dead client-side flow.

- [ ] `POST /api/Importing/UploadImportFile` returns `200 {FileURL}` for a valid `.xlsx`/`.xlsm`; `400 {Title:"File Corrupted",...}` for wrong extension or a corrupt/truncated file.
- [ ] The returned `FileURL` round-trips through `ImportProject` → `ProcessImport`'s local-path branch with zero changes to `ImportProgramDetailsWithFileURL` or `ProcessImport`.
- [ ] `ImportProjectsJobDialog.tsx` is new; `ImportProjectsDialog.tsx` is unmodified and no longer imported/rendered from `ActionsDropdown.tsx`.
- [ ] "Import Projects" opens the new dialog; a valid file walks through uploading → queuing → polling → done with no page reload.
- [ ] Polling shows a distinguishable in-progress state for Queued/Processing, stops immediately on terminal status, and also stops if the dialog is closed mid-poll.
- [ ] Polling requests do not trigger the global preloader overlay (via the new `silent` httpClient option).
- [ ] Terminal state shows ValidCount/WarningCount/ErrorCount plus a working `TextFileUrl` download link (always) and `ExcelFileUrl` link (only when present).
- [ ] "Import In Progress" (400) resets the dialog to idle/retryable with no duplicate manual toast.
- [ ] Wrong-extension pick or `FileReader` failure shows a manual toast and calls no API.
- [ ] Terminal Completed/CompletedWithErrors calls the existing `onRefresh` so the project table updates without a manual page refresh.
- [ ] `ActionsDropdown.tsx` has no remaining reference to `ImportProjectsDialog`, `transformImportedProjects`, or `importProjects`.
- [ ] `Main/Resources/Internal/SQLScripts/Importing.Schema.sql` exists with the `tImportJobResult` DDL, callable independently of app deploy.

## Approach

See the sections above (server-side inventory, the upload-endpoint gap and its fix, poll-vs-SignalR decision and the `silent` preloader fix, new dialog design, wiring change, and the schema-gap risk) — those *are* the approach, written narratively as they were investigated so the reasoning stays attached to each decision.

## Tasks

### Implementation
- Add `UploadImportFile` action to `WebAPI/Controllers/Importing/ImportingController.cs`.
- Add `Main/Resources/Internal/SQLScripts/Importing.Schema.sql` with `CREATE TABLE dbo.tImportJobResult` (columns per `ImportJobResult.cs`: `Id` PK identity, `JobId nvarchar(50)`, `HangfireJobId nvarchar(50)`, `Status nvarchar(50)`, `Message nvarchar(500)`, `ValidCount int`, `WarningCount int`, `ErrorCount int`, `TextFileName nvarchar(200)`, `ExcelFileName nvarchar(200)`, `QueuedAt datetime`, `StartedAt datetime null`, `CompletedAt datetime null`, `RequestedBy nvarchar(50)`).
- Add optional `silent?: boolean` to `RequestConfig` in `FE/src/services/httpClient.ts`; skip both `updatePreloader` calls in the interceptors when set.
- Add `ImportJobStatus` type to `FE/src/pages/Program/Model.d.ts`.
- Add `uploadImportFile`, `startImportProjectJob`, `getImportJobStatus` to `FE/src/pages/Program/Service.ts`.
- Create `FE/src/pages/Program/dialogs/ImportProjectsJobDialog.tsx` (upload → queue → poll → done, per Approach above).
- Update `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx`: swap dialog, delete dead old-flow code, wire `onRefresh`.

### Documentation
- Add a short section to `FE/src/pages/Program/program.md` describing the new async job-based import flow, and note the old dialog is retained but no longer wired up.
- Add a note at the top of `FE/src/pages/Program/IMPORT_PROJECTS_GUIDE.md` that it documents the legacy/currently-unused flow, pointing to the new one.

## Files / Components Touched

- `WebAPI/Controllers/Importing/ImportingController.cs` (add action)
- `Main/Resources/Internal/SQLScripts/Importing.Schema.sql` (new)
- `FE/src/services/httpClient.ts` (add `silent` option)
- `FE/src/pages/Program/Model.d.ts` (add type)
- `FE/src/pages/Program/Service.ts` (add 3 functions)
- `FE/src/pages/Program/dialogs/ImportProjectsJobDialog.tsx` (new)
- `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx` (rewire)
- `FE/src/pages/Program/program.md`, `FE/src/pages/Program/IMPORT_PROJECTS_GUIDE.md` (docs)

**Explicitly not touched:** `ImportProjectsDialog.tsx`, `parseImportFile.ts`, `transformImportedProjects.ts`, `Hangfire/Importing/DTOImporting.cs`, `Hangfire/Services/ImportProjectJobService.cs`, `Hangfire/Importing/ImportingHelper.cs`, `Main/Program.cs`, `signalrService.ts`, `ProgramDetail.tsx`.

## Risks / Open Questions / Assumptions

- **Schema gap (see above)** — script is added to the repo, but someone must actually run it against the target DB before this can be tested end-to-end. Flagging in case the table already exists in the live dev DB outside of source control (plausible given this branch's messy history), in which case the script is still worth committing for consistency but isn't itself the blocker.
- `.xls` is deliberately rejected at upload even though the generic corruption-checker allows it, because the OOXML-only reader downstream can't parse it.
- The import lock (`tImportingStatus`) is system-wide, not per-user/per-program — pre-existing behavior, not something this plan changes.
- `DownloadImportFile` deletes the file after first GET — plain `<a href>` single-click avoids double-download issues; not something to fix here.

## Verification

- Backend: `dotnet build` the solution; manually POST a small valid `.xlsx` (base64) to `UploadImportFile` via Swagger/Postman, confirm `FileURL` is a real file on disk, then POST that to `ImportProject` and poll `GetImportStatus` until terminal, confirm DB rows appear in the target program/stage and the report file(s) download once.
- Frontend: `npm run dev` in `FE/`, open a Program's detail page, use Actions → Import Projects with a valid template file end-to-end (upload → queue → poll → done → download links), then a deliberately-locked scenario (trigger two imports back to back) to confirm the "Import In Progress" reset path, and a wrong-extension file to confirm the client-side toast path.

## Completion Log
Date: 2026-08-20
- Implementation: all 7 tasks done — `UploadImportFile` action added to `ImportingController.cs`; `Importing.Schema.sql` added with the `tImportJobResult` DDL (idempotent, `IF NOT EXISTS` guarded, plus a unique index on `JobId`); `silent` option added to `httpClient.ts`'s `RequestConfig` and threaded through both interceptors (request success/error, response success/error) so polling doesn't toggle the global preloader; `ImportJobStatus` + `ImportFileUpload` types added to `Model.d.ts`; `uploadImportFile`/`startImportProjectJob`/`getImportJobStatus` added to `Service.ts`; `ImportProjectsJobDialog.tsx` created (idle → uploading → queuing → polling → done state machine, 2.5s poll, cleans up on unmount/close, "Import Another" to reset); `ActionsDropdown.tsx` rewired to open it and its dead old-flow code (`handleImportProjectsSubmit`, `transformImportedProjects`/`importProjects` imports, console-log block) removed.
- Documentation: both tasks done — `program.md` updated (new dialog documented as live, old one marked unused-but-kept, folder tree and `ActionsDropdown` section updated); `IMPORT_PROJECTS_GUIDE.md` given a legacy banner pointing at the new flow and this plan file.

Deviations / flags:
- **Found and fixed a real bug that would have silently broken the primary use case**: `Helpers/Functions.cs`'s `AllowedExcelExtensions`/`AllowedExcelContentTypes` allowlists (used by `IsFileCorrupted()`/`IsExcelCorrupted()`) only recognized `xls`/`xlsx` — `.xlsm` was never in the list, so a `.xlsm` upload (the actual template format — see `ImportProjectTemplate.xlsm` in `ActionsDropdown.tsx`) would always have been rejected as "corrupted." Added `"xlsm"` to `AllowedExcelExtensions` and `"application/vnd.ms-excel.sheet.macroEnabled.12"` to `AllowedExcelContentTypes`. Verified the rest of `IsExcelCorrupted()`'s magic-byte/EPPlus-parse logic already treats `.xlsm` correctly once past the allowlist (it shares the ZIP/OOXML `PK` signature with `.xlsx` and isn't excluded by the extension-vs-magic-bytes match at Layer 6). This was outside the plan's originally listed files (`Helpers/Functions.cs` wasn't in "Files Touched") but was a 2-line, low-risk, necessary correction to a shared helper — not a scope expansion, so implemented directly rather than pausing for approval.
- Everything else matched the plan as written; no other deviations.

Files changed:
- `WebAPI/Controllers/Importing/ImportingController.cs`
- `Helpers/Functions.cs` (deviation, see above)
- `Main/Resources/Internal/SQLScripts/Importing.Schema.sql` (new)
- `FE/src/services/httpClient.ts`
- `FE/src/pages/Program/Model.d.ts`
- `FE/src/pages/Program/Service.ts`
- `FE/src/pages/Program/dialogs/ImportProjectsJobDialog.tsx` (new)
- `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx`
- `FE/src/pages/Program/program.md`
- `FE/src/pages/Program/IMPORT_PROJECTS_GUIDE.md`

Verification performed: `dotnet build WebAPI/WebAPI.csproj` — 0 errors. `tsc --noEmit -p tsconfig.app.json` — 0 errors in any file touched by this change (all pre-existing errors are in unrelated modules: `Modification/*`, `LSWallet/mockData/*`, `Main/Resources/Internal/index.ts`'s `vite/client` types). Not run: end-to-end import (needs `Importing.Schema.sql` applied to a live DB, and a running backend + FE dev server, per the Verification section above).

## Correction Log
Date: 2026-08-20 (same day, follow-up)

While this plan's implementation was in flight, the backend author (eptisadev) pushed a follow-up commit — `4a31ccc1` "Importing Projects - update - to handle the blob file" — that changed `ImportProject` itself from a JSON `{ProgramId, StageName, FileURL}` body to `[Consumes("multipart/form-data")] [FromForm] ImportProgramDetailsWithFile {ProgramId, StageName, IFormFile File}`. The upload and the job-queue now happen in that one call; the controller saves the posted file to `Resources/Upload/` itself before enqueueing the Hangfire job. That commit landed on a teammate's fork branch and was merged into this branch (merge commit `94cdbbcd`) alongside this plan's own commit (`5732ef88`), so both designs briefly coexisted in the tree. The user asked to re-check for a newer backend commit; this is the result.

This obsoleted the plan's original "no upload endpoint exists, add one" premise and its two-step upload-then-queue design. Corrections made on top of the already-`Implemented` state above:
- Removed the `UploadImportFile` action from `ImportingController.cs` (and the now-unused `using DBHelper.Models.Extra;`) — dead code once `ImportProject` accepts the file directly.
- `Service.ts`: removed `uploadImportFile`; `startImportProjectJob` now builds a `FormData` (`ProgramId`, `StageName`, `File`) and posts it directly to `/Importing/ImportProject` in one call, with `headers: { 'Content-Type': 'multipart/form-data' }` explicitly forced — necessary because `httpClient`'s axios instance defaults to `application/json`, and axios's `transformRequest` will `JSON.stringify` a `FormData` body instead of sending it as multipart if the resolved Content-Type still reads `application/json` at request time (confirmed by reading the installed axios 1.12.2 source, `node_modules/axios/lib/defaults/index.js`); axios/the browser overwrite that header with the real multipart boundary right before sending once it's out of the way.
- `ImportProjectsJobDialog.tsx`: dropped the `FileReader`/base64 step entirely — the raw `File` object is now handed straight to `startImportProjectJob`. Phase state machine simplified from `idle → uploading → queuing → polling → done` to `idle → submitting → polling → done`.
- `Model.d.ts`: removed the now-unused `ImportFileUpload` (base64 payload) type. `ImportJobStatus` is untouched — `GetImportStatus`'s response shape didn't change.
- `httpClient.ts`'s `silent` option, `Importing.Schema.sql`, and the `Helpers/Functions.cs` `.xlsm` allowlist fix are all still valid and unchanged — none of them were specific to the two-step design.
- Docs (`program.md`, `IMPORT_PROJECTS_GUIDE.md`) updated to describe the single multipart call instead of the two-step upload+queue flow, and `IMPORT_PROJECTS_GUIDE.md`'s legacy banner now cites `4a31ccc1` as well as `eb3327af`.

Re-verified: `dotnet build WebAPI/WebAPI.csproj` — 0 errors. `tsc --noEmit -p tsconfig.app.json` — 0 errors in any touched file. End-to-end import still not run (same DB-schema prerequisite as before).

## Redesign Log — fire-and-forget + SignalR toast
Date: 2026-08-21

User feedback: since the import now genuinely runs in the background (Hangfire), the dialog shouldn't need to block/poll to show progress, and some of that in-dialog UI should go; separately, `ImportHub`'s SignalR push (live server-side since `eb3327af`, never consumed by any FE code) should drive a toast notification instead. Clarified via two questions before building: (1) dialog auto-closes right after the job is queued rather than staying open, (2) the toast gains a real action link so "View Report" isn't lost once the dialog is gone.

**Backend**
- `Main/Program.cs`: `AddSignalR(...)` now chains `.AddJsonProtocol(options => options.PayloadSerializerOptions.PropertyNamingPolicy = null)`. Caught this before it could silently break the feature — SignalR's `JsonHubProtocol` camelCases payloads by default, separately from the `AddControllers().AddJsonOptions(...)` override a few lines above that already keeps REST responses PascalCase. Without it, `ImportStatusChanged` would have arrived with lowercase keys (`jobId`, `status`, ...) and every field the FE reads (`event.JobId`, `event.Status`, ...) would have been `undefined` — a bug invisible at compile time, only caught by actually reasoning through ASP.NET Core's SignalR-vs-MVC JSON default divergence (no working precedent for it existed anywhere else in this codebase to check against; `Notifications.tsx`'s camelCase `Notification` interface turned out to be unused scaffold code with no real backend event to compare against, not evidence either way).

**Frontend — new pieces**
- `FE/src/services/signalrService.ts`: generalized from a single hardcoded connection to a `Map<string, HubConnection>` keyed by hub name, defaulting to `'default'` so every existing call site (`Notifications.tsx`, `Chat.tsx`, `useSignalR()`) needed zero changes. Added `invokeOn(hub, method, ...args)` and `onReconnected(callback, hub?)`.
- `FE/src/hooks/useSignalR.ts`: takes an optional `hub` name now, threaded into `on`/`off`/`invoke`; omitted, it's the original shared `/notificationHub` connection.
- `FE/src/main.tsx`: starts a second connection to `/hubs/import` (named `'import'`) alongside the existing `/notificationHub` one, both eagerly at app boot — eager rather than lazy-on-first-import because a small file's job can finish before a just-in-time handshake would complete, and there's no other event that would reliably trigger an earlier connect.
- `FE/src/atoms/importJobs.atom.ts` (new top-level atoms folder — none existed before): `pendingImportJobsAtom`, a `string[]` Jotai atom (no `<Provider>` anywhere in the app, so this is implicitly a single shared global store) bridging the dialog, which unmounts right after queuing, to the notifier, which doesn't.
- `FE/src/components/ImportJobNotifier.tsx` (new): invisible, mounted once in `App.tsx` next to `HttpClientSetup`. Joins the SignalR group for every job added to `pendingImportJobsAtom`, ignores intermediate `Queued`/`Processing` pushes, and on a terminal `ImportStatusChanged` shows a toast (counts + "View Report" link when a report exists) and leaves the group. On SignalR reconnect (group membership doesn't survive a drop) it rejoins every still-pending job and does one `getImportJobStatus()` REST check per job as a fallback in case the terminal event fired while disconnected — the only remaining caller of that REST wrapper.
- `FE/src/components/toaster/ToasterContext.tsx` + `toaster.tsx`: `Toast` gained an optional `action: { label, href }`; a toast carrying one skips the 5s auto-dismiss (so the user doesn't lose the report link) and the `Toaster` renders it as an underlined link before the close button.

**Frontend — simplified**
- `ImportProjectsJobDialog.tsx`: rewritten. Removed entirely — the `idle → uploading → queuing → polling → done` phase machine, all polling, and the whole terminal-result panel (status banner, valid/warning/error tiles, download links). What's left: dropzone → one `submitting` spinner state while `startImportProjectJob` is in flight → on success, push the returned `JobId` into `pendingImportJobsAtom`, fire a brief "Import queued" toast, and close. On failure (e.g. "Import In Progress"), stays open at idle so the user can retry — `httpClient`'s interceptor already toasted the reason.
- `ImportProjectsJobDialogProps` dropped `onImported` — a queued-but-not-yet-run job has nothing to refresh yet, and by the time it does finish the dialog (and possibly the whole page) may no longer be mounted. `ActionsDropdown.tsx`'s `onRefresh` prop and its `handleImportProjectsDone` wiring were removed with it (`onRefresh` itself stays on `BatchActionsDropdown`, which still uses it) — this tripped `tsconfig.app.json`'s `noUnusedLocals`/`noUnusedParameters` (both `true` there, unlike the looser root `tsconfig.json`), which is what actually caught the leftover unused prop.
- **Known limitation, accepted rather than solved**: nothing currently re-triggers a project-table refresh when the toast lands if the user is still sitting on the relevant Program page — they'd need to revisit/refresh it manually to see the newly imported projects. Wiring the notifier to any currently-mounted table would need route/page awareness this component intentionally doesn't have; not requested, flagging it rather than quietly building it.

Re-verified: `dotnet build Main/Main.csproj` and `dotnet build WebAPI/WebAPI.csproj` — 0 errors. `tsc --noEmit -p tsconfig.app.json` — same 3 pre-existing, unrelated errors as before (`StageDisplayName` gap in two Modification/Project form components, one unused import in `ModifcationList.tsx`); nothing in any file this redesign touched. End-to-end still not run (same DB-schema prerequisite, plus now also requires a live backend to observe an actual `ImportStatusChanged` push).
