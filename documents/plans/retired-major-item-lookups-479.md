# Plan: Retired Work Type / Infra Type must not block saving a project (#479)

Status: Implemented
Created: 2026-10-28
Source: Gitea #479 (part of tracking issue #478), from the 2026-10-28 code-table sweep

## Context
Setting a Type of Work (`tOptionScopeOfWork`) or Infrastructure Type (`tOptionInfraType`) Inactive breaks every project that already uses it:

- **The save fails.** `ProjectController.UpdateProjectDetails` (around L1298-1350) checks IsActive on **every** row of `dto.MajorItemOfWorks`, and `ProjectForm.tsx` (around L852-870) sends all rows on every save, unchanged and `IsDeleted` rows included. So any save returns 400 "…invalid or inactive", even a title change. Deleting the offending row fails the same way.
- **The row shows blank.** `ShowProjectComponentDropdowns` (around L190-199) returns active rows only, and the Major Items table looks up Type of Work, Unit and min/max in that list (`MajorItemOfWorksForm.tsx` around L199-275, `WorkLocationTable.tsx:206`).
- **Modification lets inactive values through.** Its dropdowns (`RevisionController` around L491-492, L799-800) list every value, and its saves don't check IsActive at all.

The agreed rule, which #480-#482 will reuse:
- A retired value is hidden for new picks and rejected for new or changed rows.
- An unchanged existing row still shows and saves.
- Deleting such a row works.

Deactivating these rows is allowed today: CodeTableController only blocks delete and code change when a row is in use, so the bug is reachable.

## Acceptance Criteria
As a PS user editing a project, I want Major Items whose Type of Work or Infra Type was later retired to keep showing and saving, so that a code-table change never locks me out of my project.

- [ ] **S04-TC032:** a project has a Major Item with Infra Type X, and X is set Inactive. The project opens with the row still showing X's name, Type of Work, Unit and min/max. Editing the Title and saving succeeds.
- [ ] Deleting that Major Item (with X Inactive) and saving succeeds.
- [ ] The Project "Add Major Item of Works" dialog does not offer X. A new Major Item with X sent straight to the API returns 400 "Invalid Infrastructure Type".
- [ ] **S04-TC033:** the same three checks pass for a Type of Work set Inactive (row keeps its description, Unit and min/max; the project saves; it is not offered for new rows and is rejected for them).
- [ ] Modification: the Add Major Item dialog does not offer X or the inactive Type of Work. RequestRevision and ResubmitRevision reject a new row, or a row whose Work Type or Infra Type was changed to an inactive value. Unchanged rows still submit.
- [ ] A Major Item edit that does not touch Work Type or Infra Type (for example Year of Work) on a row with a retired value saves.
- [ ] Error titles and messages are unchanged.

## Approach
**1. One shared rule, as a pure helper** (new file `Helpers/RetiredLookupRule.cs`, in the same namespace as `ProjectHelper.cs`):
```csharp
// Values that must still be active: from rows that are not deleted and are either new
// (Id <= 0, or an Id not in storedById) or whose value differs from the stored one.
public static HashSet<TKey> ValuesRequiringActiveCheck<TRow, TKey>(
    IEnumerable<TRow> rows, Func<TRow, int> id, Func<TRow, bool> isDeleted,
    Func<TRow, TKey> value, IReadOnlyDictionary<int, TKey> storedById) where TKey : notnull
```
- It's generic on purpose: #480 (Funding Profile rows), #481 and #482 will call it with their own selectors.
- This is the same idea as Component Type (checks new IDs only, `UpdateProjectDetails` around L1115) and Thrust (`PreviousThrust`), stated once.

**2. A DB check shared by the three save endpoints.** Add an extension in `Helpers/ProjectHelper.cs`:
- Signature: `ValidateMajorItemLookupsAsync(this MYPSDbContext db, IReadOnlyCollection<int> workTypeIds, IReadOnlyCollection<string> infraCodes, CancellationToken ct)`, returning `ProjectHelperResponse<string>`.
- It moves the two existing IsActive queries and their messages out of `UpdateProjectDetails`, unchanged. If both sets are empty it makes no query.

**3. `ProjectController.UpdateProjectDetails`:**
- Load the stored rows for the request's `Id > 0` items: `tProjectMajorWorkItem.AsNoTracking()` selecting `Id`, `WorkTypeFK`, `InfraTypeFK`.
- Build the two sets with the helper and call `ValidateMajorItemLookupsAsync`.
- Leave the required-field checks (`<= 0` / blank), the duplicate checks and the later update path (which already checks a changed value exists, around L2990-3075) as they are.

**4. Modification:**
- In `RequestRevision`, stored = `MajorWorkItem` (the `fProjectMajorWorkItem` GAAR rows the action already loads, around L1460).
- In `ResubmitRevision`, stored = `ExistingMajorWorkItem` (around L3560).
- Run the same check before each action's persistence loop.
- Leave `ApproveRevision` alone: approving applies what was already validated at submit, and blocking it would strand revisions submitted before a deactivation.

**5. Dropdown data:**
- `ShowProjectComponentDropdowns` returns all `ScopeOfWorks` and `InfraTypes` (drop `.Where(x => x.IsActive)`, keep the ordering). Add a short comment that matches the Category/Thrust note in `ShowProjectDropdowns`: display lookups need the full list, and availability is enforced at save.
- No other screen reads these two lists from that endpoint. Lump Sum only uses ComponentTypes and Agreements from it.

**6. Frontend pickers only:**
- In both `AddMajorItemDialog.tsx` files (Project and Modification), wrap `infraTypeOptions` and `availableWorkTypes` with `filterKeepingSelected(list, x => x.IsActive !== false, key, formData value)` from `utils/GlobalFunctions.ts:186`.
- Add mode then sees only active values, and edit mode keeps the row's current value.
- Display lookups (`MajorItemOfWorksForm`, `WorkLocationTable`) are not touched; they start working once the full list arrives.

## Tasks
### Implementation
- [ ] Add `Helpers/RetiredLookupRule.cs` with `ValuesRequiringActiveCheck` plus unit tests in `MYPS.UnitTests`. Cases: new row, unchanged row, changed row, deleted row, Id not in stored, empty input.
- [ ] Add `ValidateMajorItemLookupsAsync` to `Helpers/ProjectHelper.cs`, moving the existing queries and messages.
- [ ] `UpdateProjectDetails`: load the stored rows, scope the check with the helper, and call the shared validator.
- [ ] `RevisionController.RequestRevision` and `ResubmitRevision`: add the same scoped check before persisting.
- [ ] `ShowProjectComponentDropdowns`: return the unfiltered ScopeOfWorks and InfraTypes, with a comment.
- [ ] Project and Modification `AddMajorItemDialog.tsx`: use `filterKeepingSelected` on the Infra Type and Type of Work options.
- [ ] e2e `e2e/tests/code-table-retired-major-item.spec.ts`:
  - Use the `crossStageFixture` BP program and project, and add a Major Item through the API.
  - Deactivate the infra type through `/api/CodeTable/UpdateCodeTable`, and **restore it in `finally`**.
  - Cover TC032: the UI row shows the name, a Title save returns 200, delete-and-save returns 200, the Add dialog doesn't offer the value, and a new row with it sent through the API returns 400.
  - Repeat the same steps for the Work Type (TC033).
  - Check that the spec fails on `main` before the fix.

### Documentation
- [ ] `FE/UserManual.md`, Code Tables, Major Item (Scope of Work, Infrastructure Types): add one line. Setting a value Inactive hides it for new Major Items; projects that already use it keep it and can still be saved. Add the version row at merge, the same as the open PRs do.

## Files / Components Touched
- `Helpers/RetiredLookupRule.cs` (new), `Helpers/ProjectHelper.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs` (`ShowProjectComponentDropdowns`, `UpdateProjectDetails`)
- `WebAPI/Controllers/Revision/RevisionController.cs` (`RequestRevision`, `ResubmitRevision`)
- `FE/src/pages/Project/dialogs/AddMajorItemDialog.tsx`, `FE/src/pages/Modification/dialogs/AddMajorItemDialog.tsx`
- `MYPS.UnitTests/RetiredLookupRuleTests.cs` (new), `e2e/tests/code-table-retired-major-item.spec.ts` (new)
- `FE/UserManual.md`

## Verification
- `dotnet build`, plus `dotnet test MYPS.UnitTests` with the new tests passing.
- `tsc` with no new errors in the diff.
- The e2e spec runs against the API and Vite on the **local** DB (see the memory note on local API against local DB; never the shared DB, because the spec toggles code-table rows). It passes after the fix and fails before it.
- Modification: one manual pass on the local DB, since there is no fixture for that flow. Submit a revision on a project whose Major Item has a retired Infra Type, unchanged, and expect success. Then add a new row with that type and expect 400.

## Risks / Open Questions / Assumptions
- **Assumption:** ApproveRevision isn't checked (see Approach step 4).
- **Behaviour change:** Modification currently accepts inactive values. After this, a revision that *adds* a retired value is rejected. That is intended by #478.
- **Not covered:** `documents/refactor/ProjectController.AsyncRefactor.cs` (an unadopted draft) still has the old every-row check. Port the fix if that refactor is ever adopted. That file isn't changed here.
- **Not covered:** Lump Sum and Import are out of scope, because they don't save Major Items through these paths. Import already requires active values, which is correct for new rows.
- **Possible slowdown:** one extra lightweight query per save to load the stored rows.

## Completion Log
Date: 2026-10-28
- **Implementation:** all 7 tasks done.
  - `RetiredLookupRule.ValuesRequiringActiveCheck` (pure, generic), with 7 unit tests.
  - `ValidateMajorItemLookupsAsync` in `ProjectHelper`, using the same titles and messages as before.
  - `UpdateProjectDetails` loads the stored Work Type / Infra Type per row and checks only new or changed, non-deleted rows.
  - RequestRevision (stored = the `fProjectMajorWorkItem` GAAR rows, de-duplicated by Id) and ResubmitRevision (stored = `ExistingMajorWorkItem`) run the same check before persisting. RequestRevision rolls back its transaction on refusal, as its neighbours do.
  - `ShowProjectComponentDropdowns` returns every ScopeOfWork and InfraType row.
  - Both Add Major Item dialogs use `filterKeepingSelected` on `IsActive`. Edit mode keeps the row's *original* value (`initialData`), so it stays selectable after the user changes the field.
  - New e2e spec `code-table-retired-major-item.spec.ts`, 2/2 passing on the local DB.
- **Documentation:**
  - `FE/UserManual.md` §5.7.4 has a new "What Inactive does for an Infrastructure Type or Type of Work" block, and the general Toggle Active/Inactive note points to it. No version bump; the row is added at merge.
  - `e2e/CLAUDE.md` coverage map has a new row.
- **Verification:**
  - `dotnet build` is clean. MYPS.UnitTests pass 50/50. MYPS.ApiIntegrationTests pass 88/88, local-DB tests included (`MYPS_HTTP_TEST_MYPSDB`).
  - `tsc -p tsconfig.app.json` shows 21 errors before and 21 after, all in other files.
  - The e2e spec passes on this branch and fails 2/2 on the `origin/main` API:
    - TC032: the save is refused.
    - TC033: the Type of Work shows blank.
  - Both runs restored AF and Type of Work 80 to Active and left no programs behind.

Deviations / flags:
- The e2e spec's spare component is a second Civil Works (CW2), not Consultancy. The Add Major Item dialog never offers CoS.
- The "edit Title" step is a save with no changes. The form posts every Major Item either way, so this exercises the same path.
- **Modification was not exercised at runtime.** The plan's manual pass was skipped: RequestRevision needs a GAA-R project, revision rules and an uploaded supporting document, and there is no fixture for that. It is covered only by the build, the unit-tested helper, and the code reading above.
- Pre-fix check: only the API was swapped back. Vite served this branch's frontend, so the failures show the backend half of the bug plus the display half (dropdown data).

Files changed:
- `Helpers/RetiredLookupRule.cs` (new), `Helpers/ProjectHelper.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`
- `FE/src/pages/Project/dialogs/AddMajorItemDialog.tsx`, `FE/src/pages/Modification/dialogs/AddMajorItemDialog.tsx`
- `MYPS.UnitTests/RetiredLookupRuleTests.cs` (new), `e2e/tests/code-table-retired-major-item.spec.ts` (new), `e2e/CLAUDE.md`
- `FE/UserManual.md`, `documents/plans/retired-major-item-lookups-479.md`

### Code review (2026-10-28, /code-review medium): 9 findings, 7 fixed
- **Fixed:** "changed" is now judged per row on (Work Type, Infra Type) together. A row whose Infra Type changed has its kept Work Type checked too.
  - The helper became `RowsRequiringActiveCheck`.
  - `ValidateMajorItemLookupsAsync(posted, stored)` takes `MajorItemLookupRow` records, so each endpoint is one call.
- **Fixed:** infra codes are compared case-insensitively and trimmed, as SQL Server compares them, in both the change check and the active check.
- **Fixed:** the stored baseline in UpdateProjectDetails is this revision's live rows only (`!IsDeleted`, ComponentCostFK in this ProjectRevision).
- **Fixed:** ResubmitRevision rolls back its transaction on refusal, as RequestRevision does.
- **Fixed (FE):**
  - One `selectableWorkTypes` list (active rows plus the row's own kept value) now feeds the Type of Work options, the ROW-component Infra Type check and the no-infraTypeEnums fallback, so a retired ROW Acquisition no longer offers an infra type with no work types.
  - A retired value is kept only for a **saved** row: a new `isSavedRow` prop, Id > 0, passed by both MajorItemOfWorksForm parents. The Type of Work is kept only while the Infra Type is unchanged.
- **Not changed:** RequestRevision checks rows that the revision field rules or CanAdd might later ignore. This only affects hand-made requests, because the UI disables locked fields.
- **Re-verified after the fixes:** build clean; unit 50/50 (7 helper tests rewritten for row-level change); integration 88/88; tsc 21 errors before and after, none in the diff; e2e 2/2 on the local DB with AF and Type of Work 80 restored. Also changed: `FE/src/pages/{Project,Modification/projectmodification}/components/MajorItemOfWorksForm.tsx`.
