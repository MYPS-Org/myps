 # Plan: Consolidate FE Reports into one page wired to the real ReportsController

Status: Implemented
Created: 2026-08-20
Source: User request — "integrate FE/src/pages/Reports for front end, aligned with how the backend works"

## Goal
Replace the three static-mockup report pages under `FE/src/pages/Reports/` with a single, real `/reports` page wired end-to-end to the backend's Hangfire-queued, SignalR-tracked reporting pipeline (`WebAPI/Controllers/CrystalReport/ReportsController.cs`).

## Acceptance Criteria
As a report reviewer, I want a single Reports page that generates real files from the backend's job queue and downloads them when ready, so that I no longer see a mock UI that doesn't produce anything.

- [ ] Visiting `/reports` shows one unified Reports page; `/reports/programs`, `/reports/projects`, `/reports/multiyear` and their component files no longer exist
- [ ] On mount, the page loads real report types, years, program stages, and regional offices from `GET /api/reports/options` — no hardcoded mock template/filter data remains
- [ ] Selecting a Year + Program Stage fetches matching programs from `GET /api/reports/filter-programs` and lets the user pick one or more Program IDs
- [ ] Clicking Generate calls `POST /api/reports/{reportName}` with the selected filters and receives a `JobId` back — no more `console.log`/`alert` placeholder
- [ ] After queueing, the page joins the `report-{JobId}` SignalR group and shows live status (Queued → Processing → Completed/Failed) driven by `ReportStatusChanged` events
- [ ] On `Completed`, the file is downloaded via `GET /api/reports/download?fileName=` (blob → browser save), using the same blob-download pattern already used in `ActionsDropdown.tsx`
- [ ] On `Failed`/`Cancelled`, an error toast is shown via `useToast` (no duplicate toasts — httpClient's interceptor already covers API-level error toasts per `FE/CLAUDE.md`)
- [ ] Sidebar shows one "Reports" item (uncommented) linking to `/reports`, gated by RBAC `ViewAccess` for a single `Reports` RouteName
- [ ] `appRouteList.ts` and `Routes.tsx` each have exactly one Reports entry (`RouteName: 'Reports'`, `path: '/reports'`)
- [ ] `Reports/Service.ts` no longer contains the orphaned `fetchProjectGeoJSON`
- [ ] FE TypeScript/Vite build passes after the removals/renames

## Approach

**Context.** `FE/src/pages/Reports/` currently has three pages (`ProgramReports.tsx`, `ProjectReports.tsx`, `MultiYearReports.tsx`) that are pure static mockups — hardcoded template cards, fake dropdown options, and a `handleGenerateReport` that just does `console.log` + `alert()`. `Model.d.ts` in that folder is empty, and `Service.ts` isn't a reports service at all — it's an orphaned duplicate of `fetchProjectGeoJSON` (the real, actually-used copy lives in `FE/src/pages/Project/Service.ts` and is what `ProjectForm.tsx` imports; nothing imports the Reports copy).

The backend already has a real, working reporting pipeline as of commit `72cd79b` (`WebAPI/Controllers/CrystalReport/ReportsController.cs` + `Hangfire/Services/ReportJobService.cs` + `Hangfire/Hubs/ReportHub.cs`), but it exposes only **one flat catalog of 8 report types** (`ReportCatalog.SupportedReports`), all scoped by a single `YearStart` + `ProgramIds[]` + `Region` — there is no backend concept of separate "project" or "multi-year" reports. The user confirmed the three-page split should collapse into **one unified `/reports` page**.

There's also a second, already-wired but unrelated report dialog (`FE/src/pages/Program/dialogs/AIPReportDialog.tsx`) that talks to a different, older `/Reporting/*` controller. It's left untouched — out of scope for this change.

The Reports sidebar entry is currently fully commented out in `AppSidebar.tsx`, so this is a clean consolidation with no live nav to migrate carefully.

**Page consolidation.** Delete `ProjectReports.tsx` and `MultiYearReports.tsx`. Replace `ProgramReports.tsx` with a new `Reports.tsx` (component `Reports`) — the old name no longer fits since it covers the whole catalog, not just programs. Update the three call sites that reference the old three-way split:
- `FE/src/components/Routes.tsx` — one import + one route entry (`RouteName: 'Reports', path: '/reports', element: <Reports />`) replacing the three `#region Reports Routes` lines.
- `FE/src/utils/appRouteList.ts` — one `{ RouteName: 'Reports', path: '/reports' }` replacing the three existing rows.
- `FE/src/layouts/AppSidebar.tsx` — the Reports `SidebarDropdown` block (~lines 143-156) is currently commented out entirely. Uncomment and simplify it to a single `SidebarItem` pointing at `/reports`, gated the same way other single-page nav items are (`ViewAccess.includes(protectedRoutes.find(x => x.path == '/reports')?.RouteName || '')`).
- `e2e/CLAUDE.md` — update the route table (currently lists all three as "No" e2e coverage) to reflect the single route. Doc-only; there are no actual Playwright specs for these pages to update.

**Types (`Model.d.ts`, currently empty).** Add interfaces mirroring the backend DTOs exactly (`WebAPI/Controllers/CrystalReport/DTOReports.cs`, `Hangfire/Models/ReportJobPayload.cs`): `ReportTypeOption`, `ProgramStageOption`, `RegionalOfficeOption`, `ReportOptions`, `FilterProgramsQuery`, `FilterProgramItem`, `GenerateReportRequest`, `GenerateReportResponse` (`{ JobId, HangfireJobId, Message, Title }`), and `ReportStatusEvent` (`{ JobId, Status: 'Queued'|'Processing'|'Completed'|'Failed'|'Cancelled', Message, DownloadUrl?: string|null }` — matches the anonymous object `ReportJobService.NotifyClient` sends over SignalR).

**Service layer (`Service.ts`, currently the orphaned GIS duplicate).** Replace entirely, following the existing `httpClient` + try/catch/`console.error`/throw pattern from `Program/Service.ts`:
- `fetchReportOptions()` → `httpClient.get<ReportOptions>('/reports/options')`
- `fetchFilterPrograms(query: FilterProgramsQuery)` → `httpClient.get<FilterProgramItem[]>('/reports/filter-programs', { YearStart: String(query.YearStart), ProgramStage: query.ProgramStage })`
- `queueReportGeneration(reportName: string, request: GenerateReportRequest)` → `httpClient.post<GenerateReportResponse>(\`/reports/${reportName}\`, request)`
- `fetchReportFile(fileName: string)` → `httpClient.get<Blob>('/reports/download', { fileName }, { responseType: 'blob' })`, returns `{ blob, filename: fileName }` — mirrors `exportProjects`/`downloadAIPReport` in `Program/Service.ts`

**Page (`Reports.tsx`).** Single form + status panel, no icon-grid template cards (backend catalog has no icons/descriptions, just `Id`/`Label`/`OutputFormat`):
1. On mount: `fetchReportOptions()` populates Report Type (select), Year (select), Program Stage (select, keyed by `Name` to match `FilterProgramsDTO.ProgramStage`), Region (select, value = `Code`, sent as `RegionCode`). Also render optional text inputs for `PlanningEngineer`, `ApprovedBy`, `ReviewedBy` (present on `GenerateReportRequestDTO`, used as report signatory fields).
2. Once Year + Program Stage are both selected, `fetchFilterPrograms` populates a Program multi-select. No existing multi-select combobox/listbox exists in `tailwindui/` (`combobox.tsx` is hardcoded `multiple={false}`), so this is a plain checkbox list in a bordered scrollable div — consistent with the rest of the filter panel's native `<select>`/`<input>` styling already in the mock pages, no new dependency.
3. Generate button enabled once Report Type is selected (the only thing genuinely required — `GenerateReportRequestDTO` has no `[Required]` attributes on the rest, so FE won't invent stricter validation than the backend has, per `FE/CLAUDE.md`). Calls `queueReportGeneration`, disables itself while a job is in flight (single active job at a time — backend exposes no job-list/history endpoint, so no multi-job tracking UI).
4. On receiving `JobId`: `useSignalR().invoke('JoinJobGroup', jobId)`, then `on('ReportStatusChanged', handler)` filtering by `event.JobId === jobId`. Render live status text (Queued/Processing/Completed/Failed/Cancelled). On unmount or terminal status, `invoke('LeaveJobGroup', jobId)` + `off('ReportStatusChanged')`.
5. On `Completed`: call `fetchReportFile(event.DownloadUrl's fileName)`, then the standard blob-download-via-anchor snippet (`URL.createObjectURL` → `<a download>` → click → `revokeObjectURL`), copied from `ActionsDropdown.tsx`'s `handleConfirmExportProjects`/`handleGenerateAIPReport`. Re-enable Generate.
6. On `Failed`/`Cancelled`: `showToast({ type: 'error', message: event.Message })` (frontend-triggered, not from httpClient interceptor, so this one manual toast is correct per `FE/CLAUDE.md`). Re-enable Generate.

## Tasks

### Implementation
- Add report-related interfaces to `FE/src/pages/Reports/Model.d.ts`
- Rewrite `FE/src/pages/Reports/Service.ts`: drop orphaned `fetchProjectGeoJSON`, add `fetchReportOptions`, `fetchFilterPrograms`, `queueReportGeneration`, `fetchReportFile`
- Create `FE/src/pages/Reports/Reports.tsx`: filter form (Report Type/Year/Stage/Region/Program multi-select/signatory fields) + Generate + SignalR-driven status panel + auto-download-on-Completed
- Delete `FE/src/pages/Reports/ProgramReports.tsx`, `ProjectReports.tsx`, `MultiYearReports.tsx`
- Update `FE/src/components/Routes.tsx`: one `Reports` import/route entry replacing the three
- Update `FE/src/utils/appRouteList.ts`: one `Reports` row replacing the three
- Update `FE/src/layouts/AppSidebar.tsx`: uncomment + collapse the Reports block into a single gated `SidebarItem` → `/reports`

### Documentation
- Update `e2e/CLAUDE.md`'s route/coverage tables to reflect the single `/reports` route

## Files / Components Touched
- `FE/src/pages/Reports/Model.d.ts` (new content)
- `FE/src/pages/Reports/Service.ts` (rewritten)
- `FE/src/pages/Reports/Reports.tsx` (new)
- `FE/src/pages/Reports/ProgramReports.tsx`, `ProjectReports.tsx`, `MultiYearReports.tsx` (deleted)
- `FE/src/components/Routes.tsx`
- `FE/src/utils/appRouteList.ts`
- `FE/src/layouts/AppSidebar.tsx`
- `e2e/CLAUDE.md`

## Risks / Open Questions / Assumptions
- Assumption: the surviving page/component is renamed `Reports.tsx`/`Reports` (was `ProgramReports.tsx`) since it now covers the full catalog, not just program reports.
- Assumption: only one report job is tracked at a time (Generate disabled while in flight) — backend has no job-list/history endpoint to build a richer queue UI against.
- Risk: no Playwright e2e coverage exists today for any of the three old report pages (per `e2e/CLAUDE.md`'s coverage table), so this change ships with no automated regression test — verification is manual.
- Out of scope: `AIPReportDialog.tsx` and the legacy `/Reporting/*` controller it calls are untouched; that remains a separate, still-functioning reporting path.
- Backend RBAC: no seed data references the `ProgramReports`/`ProjectReports`/`MultiYearReports` RouteNames outside the FE (confirmed via repo-wide search), so consolidating to one `Reports` RouteName is FE-only and safe.

## Verification
- `cd FE && npm run build` — confirms no TypeScript errors after the deletions/rename.
- Run FE dev server + WebAPI + Hangfire locally, navigate to `/reports`, and walk the full flow: load options → pick Year/Stage → pick programs → Generate → watch live status via SignalR → confirm file downloads on Completed → confirm error toast on a forced Failed case.

## Completion Log
Date: 2026-08-20
- Implementation: Added report DTO-mirroring types to `Reports/Model.d.ts`; rewrote `Reports/Service.ts` (dropped the orphaned `fetchProjectGeoJSON` duplicate, added `fetchReportOptions`/`fetchFilterPrograms`/`queueReportGeneration`/`fetchReportFile`); built the new unified `Reports.tsx` page (filter form, cascading program checklist, SignalR job-status tracking via `useSignalR`, auto-download-on-Completed via blob+anchor); deleted `ProgramReports.tsx`/`ProjectReports.tsx`/`MultiYearReports.tsx`; collapsed the three route entries into one `Reports` route/RouteName in `Routes.tsx` and `appRouteList.ts`; uncommented and simplified the sidebar Reports block into a single gated `SidebarItem` in `AppSidebar.tsx`.
- Documentation: Updated `e2e/CLAUDE.md`'s route table and coverage map to replace the three old report rows with the single `Reports` route.
Deviations / flags: None from the approved plan. `npm run build` in `FE/` shows 3 pre-existing TS errors (`ProgramLatest.StageDisplayName` missing) in `Modification/projectmodification/components/ProgramDetailsForm.tsx`, `ProjectForm.tsx`, and `Project/components/ProgramDetailsForm.tsx` — confirmed via `git stash` that these predate this change and are unrelated to the Reports work; not fixed here as out of scope.
Files changed:
- `FE/src/pages/Reports/Model.d.ts` (rewritten)
- `FE/src/pages/Reports/Service.ts` (rewritten)
- `FE/src/pages/Reports/Reports.tsx` (new)
- `FE/src/pages/Reports/ProgramReports.tsx`, `ProjectReports.tsx`, `MultiYearReports.tsx` (deleted)
- `FE/src/components/Routes.tsx`
- `FE/src/utils/appRouteList.ts`
- `FE/src/layouts/AppSidebar.tsx`
- `e2e/CLAUDE.md`
