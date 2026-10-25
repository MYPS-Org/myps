# Plan: Bulk add / remove projects in Project Group Details

Status: Planned
Created: 2026-10-25
Branch: `feature/project-group-bulk-membership` (off `main` @ 7c2bf06e)
Source: user request, 2026-10-25: "make it easier for a user to add or remove projects from a project
group … simplest possible solution, with ease of use."

## Goal
On the Project Group Details page, a user can:
- **add many projects at once** by pasting a list of Project IDs, and
- **remove many projects at once** by ticking them in the group's project table.

Use as few new parts as possible. No new endpoints, permissions or DB migrations.

## Decisions already made (by the user, 2026-10-25). Do not reopen these.
| # | Decision |
|---|----------|
| D1 | **Add = paste a list of Project IDs** into a textarea. This is the same input style as Program Details → Batch Actions → Batch Tag/Delete. There is no project browser/checklist for adding. |
| D2 | **Remove = checkboxes** on the group's Projects table, plus select-all and a **Remove selected (N)** button with one confirm. |
| D3 | **Partial success on add.** Valid IDs are added. Each skipped ID is reported with a reason: *Not found*, *Already in this group*, *In another group (name)*. Projects in another group are **never moved**. |

Implementer's calls (made while planning; change them only with a reason, and record it in the Completion Log):
- C1: The remove confirm is a plain Cancel/Remove dialog, **without typing `DELETE`**. Unlinking can be undone and the project itself is not deleted.
- C2: At most **500 IDs per paste**. SQL Server allows at most 2100 parameters, and the lookup sends each ID twice (`ProjectId IN … OR ProjectPK IN …`).
- C3: The existing per-row trash icon stays. It opens the same remove confirm with one ID.
- C4: `DeleteProjectDialog.tsx` is renamed `RemoveProjectsDialog.tsx`. Its old text ("Delete Program", "permanently remove it from the system") was wrong.

---

## Background: how it works today (read this first if you are new)

**Domain.** A *project group* is a named set of projects, used for cross-program tracking. Membership is a single
nullable FK: `tProjects.ProjectGroupFK` (int?) points to `tProjectGroups.Id`. So **a project is in at most one
group**. Adding a project means setting the FK. Removing it means setting the FK to null. Every change writes a
`tTransactionLog` row (`AffectedTable="tProjects"`, `AffectedColumn="ProjectGroupFK"`, old/new value).

**Routes (FE).** `FE/src/components/Routes.tsx:49-50`
- `/project-groups` → `pages/ProjectGroups/Views/ProjectGroup.tsx` (list)
- `/project-groups/:groupId` → `pages/ProjectGroups/Views/ProjectGroupDetails.tsx` (the page being changed). `groupId` is the numeric `tProjectGroups.Id` as a string.

**API.** `WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs`, route `api/[controller]/[action]` (line 15). The FE calls `/projectgroup/<action>` through `httpClient` (base `/api`). The actions involved are:
| Action | Line | Today |
|---|---|---|
| `SearchProject` | ~261 | Looks up one exact `ProjectId`/`ProjectPK` in `vProjectLatest`. Used by today's add dialog. |
| `AddProject` | 301 | DTO `ProjectGroupAddProjectDTO { string GroupId; string[] ProjectId }` (`DTOProjectGroup.cs:42`). **All-or-nothing**: any missing ID → 400 `"Projects X not found."`; any already-grouped project (in *any* group, this one included) → 400 "Project Already Grouped", listing **PKs**. Otherwise it sets the FK, writes logs, and commits. |
| `DeleteProject` | 398 | DTO `ProjectGroupDeleteProjectDTO { string ProjectId }` (`DTOProjectGroup.cs:49`). One ID, **no GroupId**. Nulls the FK of any grouped project. **Bug:** it never checks that the project belongs to the group being viewed. |
| `ProjectGroupDetails` | 456 | Returns `{ GroupDetails, Projects (vProjectLatest rows whose tProjects.ProjectGroupFK == group), UserGroups }`. |
| `UpdateProjectGroupDetails` | 501 | Saves name/description/user group. It ignores `dto.Projects`, so it is not a membership path. |
Helper: `TryParseGroupId(string?, out int)` at line 635. Use `_db.tProjectGroups` with `!x.IsDeleted`, `_db.tProjects`, and `_db.vProjectLatest` (look up by `ProjectId` **or** `ProjectPK`).

**Permissions.** The class-level `[PermissionFilter]` is inherited from `CoreController` (`WebAPI/Controllers/CoreController.cs:25`). It checks `vUserActionPermission` by **controller + action name** (`WebAPI/Controllers/AuthorizeSessionAttribute.cs:102-119`) and returns 403 otherwise. **Keeping the action names `AddProject` and `DeleteProject` means no new permission rows are needed.** Do not add new actions.

**FE today.**
- `ProjectGroupDetails.tsx`: "Add Project" button (line 286) → `dialogs/AddProjectDialog.tsx`. That dialog searches **one exact ID at a time** via `fetchProjectById` → `SearchProject`, builds a "selected" list, then calls `addProjectToGroup`. The trash icon per row (line 342) → `dialogs/DeleteProjectDialog.tsx` (type `DELETE`) → `deleteProject(projectId)`.
- `handleDeleteProject` (lines 161-185) only edits local state. The real call is made inside the dialog.
- **Gotcha:** `fetchProjectGroupDetails` (line 64) sets `isLoading=true`, and `if (isLoading) return <skeleton/>` (line 187) **unmounts the whole page, including any open dialog**. It also overwrites `formData.GroupDetails`, which throws away unsaved Name/Description edits. A refresh after add/remove must therefore **not** go through it (see F3).
- `Service.ts`: `addProjectToGroup` (line 76), `deleteProject` (line 88), `fetchProjectById` (line 64).
- `httpClient.post<T>` returns `{ Data: <response body>, Status }` (`FE/src/services/httpClient.ts:202`). It **does not toast on success**. On a 400, or on any error whose body has `Message`, it toasts that message and rethrows `{ Message, Title, Status, Data }`. Otherwise it rethrows the raw error. So per `FE/CLAUDE.md`, a `catch` toasts only when `error.Message` is absent.

**Patterns to copy (do not import from Program; copy what you need).**
- Paste textarea, placeholder and tip: `FE/src/pages/Program/dialogs/BatchTagDialog.tsx:159-182`. The split regex is at `:132` (`/[,;\s\n]+/`).
- Result chips ("Title (n)", first 10, then "+N more"): `PreviewGroup` in `FE/src/pages/Program/dialogs/ConfirmDialogBatch.tsx:316-335`. **It is not exported.** Copy it into ProjectGroups (F2).
- Checkbox / select-all / "N selected" bar: `FE/src/pages/Program/dialogs/AddExistingProjectDialog.tsx:26, 81-99, 165-175, 193-201, 235-242`.
- Partial-result response shape: `ProgramController.PreviewBatchDelete`, `WebAPI/Controllers/Programs/ProgramController.cs:2521-2531` (fields directly on the body next to `Message`/`Title`).
- Transaction convention (from `documents/plans/batch-add-existing-project-restore-fixes.md`, RS2/RS3): open the transaction **after** validation and lookups, and roll back with `CancellationToken.None`.

---

## Acceptance Criteria
As a DPC/RPC/PS Admin user on a project group's details page, I want to add or remove many projects at once,
so that I don't have to process them one at a time.

Add (paste)
- [ ] A1 **Add Projects** opens a dialog with one textarea. It accepts IDs separated by commas, semicolons, spaces, tabs or new lines, and shows a live "N project ID(s)" count with duplicates removed (case-insensitive).
- [ ] A2 Empty input → inline error "Please enter at least one Project ID." No request is sent.
- [ ] A3 More than 500 IDs → inline error "You can add at most 500 projects at a time." No request is sent.
- [ ] A4 Clicking **Add** sends one request. Valid ungrouped projects are added, and the rest are skipped, not rejected.
- [ ] A5 The dialog then shows the result: "N project(s) added", plus chip groups for **Not found**, **Already in this group** and **In another group** (each chip shows `ProjectId — Group Name`). Empty groups are hidden.
- [ ] A6 IDs in the result are the Project IDs (e.g. `P00…`), not internal PKs. A request that matched by PK reports that project's `ProjectId`.
- [ ] A7 **Add more** clears the textarea and goes back to input without closing the dialog. **Close** closes it.
- [ ] A8 After closing, if anything was added, the Projects table shows the new rows without a full-page skeleton. Unsaved Name/Description edits are kept.
- [ ] A9 A project in another group stays in that group. Its `ProjectGroupFK` is unchanged.

Remove (checkboxes)
- [ ] R1 The Projects table has a leading checkbox column and a header select-all checkbox. Select-all is checked when every row is selected and indeterminate when only some are.
- [ ] R2 A red **Remove selected (N)** button sits next to **Add Projects**. It is disabled when N = 0.
- [ ] R3 It opens a confirm: title "Remove projects from group", text "Remove N project(s) from *Group Name*? The projects are not deleted and can be added back.", the IDs as chips, and Cancel / **Remove**. Typing `DELETE` is not required.
- [ ] R4 **Remove** sends one request. On success it shows a success toast with the API `Message`, the rows disappear (no full-page skeleton), and the selection clears.
- [ ] R5 The per-row trash icon opens the same confirm with only that project.
- [ ] R6 The server removes only projects whose `ProjectGroupFK` equals **this** group. It reports any others in `NotInGroupProjectIds`, and the FE shows an info toast listing them.

Server / data
- [ ] S1 One `tTransactionLog` row per project added or removed. The shape is unchanged from today.
- [ ] S2 Each request is all in one transaction. A failure leaves no partial FK changes.
- [ ] S3 No new controller actions, permission rows or DB migrations.
- [ ] S4 An invalid or deleted group → 400 with the existing messages ("Invalid Project Group ID." / "Project Group not found.").

Docs / tests
- [ ] T1 A new Playwright spec covers paste-add with a mix of good and bad IDs, and checkbox remove. Update the coverage map in `e2e/CLAUDE.md`.
- [ ] T2 Update the User Manual §5.5.3, bump its version, and add a changelog entry.

---

## Approach

### Backend: `WebAPI/Controllers/ProjectGroups/`

**B1. `AddProject` (ProjectGroupController.cs:301): partial success.** The DTO is unchanged.
```
validate GroupId (TryParseGroupId) → group exists & !IsDeleted        (unchanged; 400s as today)
requested = dto.ProjectId trimmed, non-empty, distinct OrdinalIgnoreCase (unchanged)
if requested empty → 400 "No Projects selected."                       (unchanged)
if requested.Length > 500 → 400 "You can add at most 500 projects at a time."
matches = vProjectLatest where requested contains ProjectId or ProjectPK   (AsNoTracking)
// resolve each requested id → one project (match ProjectId or ProjectPK, case-insensitive)
notFound   = requested ids with no match                                → report the id as typed
byPk       = matches grouped by ProjectPK → first row (gives PK → ProjectId)
rows       = tProjects where ProjectPK in byPk.Keys                      (tracked)
inThis     = rows where ProjectGroupFK == group.Id                       → report ProjectId
inOther    = rows where ProjectGroupFK != null && != group.Id            → report { ProjectId, GroupName }
             (GroupName: one query on tProjectGroups for the distinct FKs; fall back to "another group")
toAdd      = rows where ProjectGroupFK == null
if toAdd.Count > 0:
    begin transaction (after all the reads above)
    foreach: set FK = group.Id; add TransactionLog (same fields as today, OldValue = "")
    SaveChanges; Commit
    on exception: RollbackAsync(CancellationToken.None)
return Ok(new {
    Message = toAdd.Count > 0 ? $"{toAdd.Count} project(s) added to group." : "No projects were added.",
    Title   = toAdd.Count > 0 ? "Add Complete" : "Nothing Added",
    AddedProjectIds          = ProjectIds of toAdd,
    AlreadyInGroupProjectIds = ...,
    InOtherGroupProjects     = new[] { new { ProjectId, GroupName } },
    NotFoundProjectIds       = ...
})
```
Return **200 even when nothing was added**, so the FE shows the breakdown and not an error toast. Delete the old "not found" and "Project Already Grouped" 400 branches (lines 334-359).

**B2. `DeleteProject` (ProjectGroupController.cs:398): bulk and scoped to the group.** Keep the action name.
Change the DTO (`DTOProjectGroup.cs:49`):
```csharp
public class ProjectGroupDeleteProjectDTO
{
    [Required]
    public string GroupId { get; set; } = string.Empty;
    [Required]
    public string[] ProjectIds { get; set; } = Array.Empty<string>();
}
```
Logic:
```
validate GroupId + group exists (same as AddProject; same 400 messages)
requested = ProjectIds trimmed/distinct; empty → 400 "No Projects selected."
matches = vProjectLatest by ProjectId or ProjectPK → PK → ProjectId map
rows = tProjects where ProjectPK in matched PKs AND ProjectGroupFK == group.Id   (tracked)
notInGroup = requested ids not resolved to a row in `rows`     (not found OR in another group / none)
if rows.Count > 0: transaction; foreach FK = null + TransactionLog (OldValue = group.Id, NewValue = ""); save; commit
return Ok(new {
    Message = rows.Count > 0 ? $"{rows.Count} project(s) removed from group." : "No projects were removed.",
    Title   = rows.Count > 0 ? "Remove Complete" : "Nothing Removed",
    RemovedProjectIds    = ProjectIds of rows,
    NotInGroupProjectIds = notInGroup
})
```
The only caller of the old single-ID shape is the FE dialog that this plan replaces (grep `deleteproject` to confirm).

**B3. `SearchProject`:** leave it as it is. The FE stops using it. Note it as removable in the Completion Log.

### Frontend: `FE/src/pages/ProjectGroups/`

**F1. `Model.d.ts`: add**
```ts
export interface AddProjectsToGroupResult {
  Message: string;
  Title: string;
  AddedProjectIds: string[];
  AlreadyInGroupProjectIds: string[];
  InOtherGroupProjects: { ProjectId: string; GroupName: string }[];
  NotFoundProjectIds: string[];
}

export interface RemoveProjectsFromGroupResult {
  Message: string;
  Title: string;
  RemovedProjectIds: string[];
  NotInGroupProjectIds: string[];
}
```
**`Service.ts`:**
- `addProjectToGroup`: same payload `{ ProjectId: string[], GroupId: string }`, typed `httpClient.post<AddProjectsToGroupResult>`, preloader "Adding projects to group...".
- Replace `deleteProject` with `removeProjectsFromGroup(data: { GroupId: string; ProjectIds: string[] })` → `httpClient.post<RemoveProjectsFromGroupResult>('/projectgroup/deleteproject', data, { preloaderMessage: 'Removing projects from group...' })`.
- Delete `fetchProjectById` (no callers left).
- Keep each function's existing try/catch/console.error/rethrow style.

**F2. `components/IdChipGroup.tsx` (new, small).** Copy `PreviewGroup` from `ConfirmDialogBatch.tsx:316-335` as
`IdChipGroup({ title, ids, chipClass })`. It accepts `ids: string[]` and renders nothing when empty. "In another group" passes
`` `${p.ProjectId} — ${p.GroupName}` `` strings. Do not change the Program module.

**F3. `Views/ProjectGroupDetails.tsx`**
- Add `refreshProjects = async () => { const r = await fetchProjectGroupByName(groupId); setProjectGroupDetails(prev => ({ ...prev, Projects: r.Data.Projects })); setFormData(prev => ({ ...prev, Projects: r.Data.Projects })); setSelectedIds(new Set()); }`.
  It does **not** set `isLoading` and does not touch `GroupDetails` (see the gotcha in Background). Errors: log, and toast "Failed to refresh projects. Please try again." only when `!error.Message`.
- Selection: `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())` keyed by `ProjectId`. `toggleRow` / `toggleAll` as in `AddExistingProjectDialog.tsx:81-99`. Header checkbox: `checked = all selected && rows > 0`, and `indeterminate` set through a ref (`useRef<HTMLInputElement>` + `useEffect`) when `0 < selected < rows`.
- Table: a leading `<TableHeader>` with the select-all checkbox, and a leading `<TableCell>` per row with `<input type="checkbox">` (same classes as AddExistingProjectDialog).
- Header bar (line 284-289): rename the button to **Add Projects**. Add `<Button color="red" disabled={selectedIds.size === 0} onClick={() => openRemove(Array.from(selectedIds))}>Remove selected ({selectedIds.size})</Button>`.
- Per-row trash (line 342): `onClick={() => openRemove([project.ProjectId])}`.
- Remove state: `const [removeIds, setRemoveIds] = useState<string[] | null>(null)`. The dialog is open when it is non-null.
- Delete `handleDeleteProject` (161-185), `handleAddProjects` (151-159), `selectedProject` and `isDeleteProjectOpen`. They are replaced by the above.
- Mount:
  - `<AddProjectDialog isOpen groupId={GroupDetails.GroupId} groupName={GroupDetails.Name} onClose={(changed) => { close; if (changed) refreshProjects(); }} />`
  - `<RemoveProjectsDialog projectIds={removeIds} groupId groupName onClose={(changed) => { setRemoveIds(null); if (changed) refreshProjects(); }} />`

**F4. `dialogs/AddProjectDialog.tsx`: rewrite.** Props: `{ isOpen: boolean; groupId: string; groupName: string; onClose: (changed: boolean) => void }`.
- State: `text`, `error`, `result: AddProjectsToGroupResult | null`, `changed` (true once any add returned `AddedProjectIds.length > 0`), `isSubmitting`. Reset everything when `isOpen` becomes true.
- `parseProjectIds(text)`: split on `/[,;\s]+/`, trim, drop empties, case-insensitive dedupe that keeps the first spelling. Live count text: "N project ID(s)".
- Input view: title "Add Projects to Group"; a "Project Group: *groupName*" info box; a textarea (rows 6) with BatchTagDialog's placeholder and tip; an inline error. Footer: Cancel | **Add** (disabled while submitting or when the count is 0).
- Submit: A2/A3 checks with an inline `setError` and early return. Then `await addProjectToGroup({ GroupId: groupId, ProjectId: ids })` → `setResult(r.Data)`, and set `changed` if anything was added. In `catch`: interceptor-toasted errors carry `Message`. Otherwise `setError('Could not add projects. Please try again.')`.
- Result view: a heading with `result.Message`. Then `IdChipGroup`s: "Added" (green `bg-green-100 text-green-800`), "Already in this group" (`bg-blue-100 text-blue-800`), "In another group (not moved)" (`bg-amber-100 text-amber-800`), "Not found" (`bg-gray-200 text-gray-700`). Footer: **Add more** (clears text and result, back to input) | **Close** → `onClose(changed)`.
- The dialog's X button and the backdrop also call `onClose(changed)`.

**F5. `dialogs/RemoveProjectsDialog.tsx` (renamed from `DeleteProjectDialog.tsx`; update `dialogs/index.ts`).**
Props: `{ projectIds: string[] | null; groupId: string; groupName: string; onClose: (changed: boolean) => void }`. It is open when `projectIds` is non-null.
- Show the R3 copy, and the IDs through `IdChipGroup` (`bg-red-100 text-red-800`). Footer: Cancel → `onClose(false)` | **Remove** (red, shows "Removing..." while in flight).
- Remove: `const r = await removeProjectsFromGroup({ GroupId: groupId, ProjectIds: projectIds })`. Then `showToast({ type: r.Data.RemovedProjectIds.length ? 'success' : 'info', message: r.Data.Message })`. If `NotInGroupProjectIds.length`, show an info toast "Not in this group: …" (first 10, then "+N more"). Then `onClose(r.Data.RemovedProjectIds.length > 0)`. In `catch`: toast "Failed to remove projects. Please try again." only when `!error.Message`, and keep the dialog open.

### Docs
**D-1.** `FE/UserManual.md` §5.5.3 "Project Group Details" (~line 2157): replace "click **Add Project** and select the project" with:
- the paste-list steps;
- what each result group means (projects in another group must be removed there first);
- the checkbox / select-all / Remove selected steps;
- a note that removing does not delete the project.

Add rows to the field table for the textarea, Add, Add more, the checkboxes and Remove selected. Bump the manual version, then run `/update-manual-changelog`. Check `FE/src/pages/ProjectGroups/UserManual.md` and `ProjectGroups.md` for the same section and update them if it is there.

**D-2.** `e2e/CLAUDE.md`: in the coverage map, mark ProjectGroupDetails covered by the new spec.

---

## Tasks
### Senior
- B1, B2 (controller + DTO). Check `[PermissionFilter]` still passes for the same action names.
- F3 refresh/selection wiring (the unmount/edit-loss gotcha).
### Junior
- F1 types/service, F2 chip component, F4 add dialog, F5 remove dialog + index.ts.
- E2E spec (Verification step 4).
### Documentation
- D-1, D-2.

## Files Touched
- `WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs` (AddProject, DeleteProject)
- `WebAPI/Controllers/ProjectGroups/DTOProjectGroup.cs` (ProjectGroupDeleteProjectDTO)
- `FE/src/pages/ProjectGroups/Model.d.ts`, `Service.ts`
- `FE/src/pages/ProjectGroups/components/IdChipGroup.tsx` (new)
- `FE/src/pages/ProjectGroups/dialogs/AddProjectDialog.tsx` (rewrite)
- `FE/src/pages/ProjectGroups/dialogs/DeleteProjectDialog.tsx` → `RemoveProjectsDialog.tsx`, `dialogs/index.ts`
- `FE/src/pages/ProjectGroups/Views/ProjectGroupDetails.tsx`
- `FE/UserManual.md`, `documents/UserManual_Changelog.md` (+ ProjectGroups docs if relevant)
- `e2e/tests/project-group-bulk-membership.spec.ts` (new), `e2e/CLAUDE.md`

## Risks / Notes
- **API contract change (both actions).** AddProject: some 400s become 200 with a breakdown. DeleteProject: the DTO goes from `ProjectId` to `GroupId` + `ProjectIds[]`. The only callers are this module's dialogs. Before merging, grep FE, e2e and any external scripts for `projectgroup/addproject` and `projectgroup/deleteproject`.
- **The group-scope check in DeleteProject fixes a bug** (today any grouped project can be unlinked from any group's page). Mention it in the PR.
- No DB migration and no permission rows. Test only against **localhost `myps_db_migrated_uat`**: check the effective `MYPSDb` connection string before any DB step. Never point at a shared server.
- `vProjectLatest` may return more than one row per PK in edge cases, so always group by `ProjectPK` before mapping.
- Out of scope: browsing/filtering projects to add, moving projects between groups, and removing `SearchProject` from the API.

## Verification
1. Build: `dotnet build` the WebAPI solution. In `FE/`: `npm run build` (tsc + vite) and `npx eslint src/pages/ProjectGroups`.
2. Run locally: API on :5015 with `ASPNETCORE_ENVIRONMENT=Development`; FE `npm run dev` on :8080. If another session is using those ports, use a separate worktree and other ports.
3. Manual checks on a throwaway group (create it via **Add Project Group**):
   - Paste 5 IDs (one valid ungrouped, one valid already in this group, one in another group, one typo, plus a duplicate of the first) using mixed commas and new lines. Expect the count to be 4, and Added 1 / Already 1 / Other 1 (with name) / Not found 1. The other group's count is unchanged.
   - Empty → inline error and no network call (DevTools). 501 IDs → inline error.
   - Edit the Name (don't save), add projects, close. The table refreshes and the Name edit is still there.
   - Select 2 rows → Remove selected (2) → Remove. Toast, rows gone, and the projects still open from `/projects/project-details/<id>`.
   - Select-all → indeterminate after unticking one → remove all.
   - Per-row trash → confirm → removed.
   - API: POST `/api/projectgroup/deleteproject` with this group's ID and a project from **another** group. That ID comes back in `NotInGroupProjectIds`, and its FK is unchanged.
   - SQL (localhost): `SELECT TOP 20 * FROM tTransactionLog WHERE AffectedColumn='ProjectGroupFK' ORDER BY CreatedDate DESC` shows one row per add/remove.
4. E2E: new `e2e/tests/project-group-bulk-membership.spec.ts` following `e2e/CLAUDE.md`. Use `login(page)` from `helpers/auth`. Pick projects by asking the DB/API (don't hard-code IDs). Wait for the dialog/result state, not loading text. Model it on `e2e/tests/program-detail-batch-actions.spec.ts`. Flow: create group → paste-add 2 valid + 1 bogus → assert Added 2 / Not found 1 → close → table has 2 rows → select-all → Remove → table empty → delete group (cleanup in teardown).
5. Then the repo workflow: `/code-review`, check it against these Acceptance Criteria, then `/create-pr-issue`. Mark this plan `Status: Implemented` and add a Completion Log.
