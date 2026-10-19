# Plan: Project visibility by DEO / Region — v2 (viewing only, per stage, self-contained)

Status: Implemented
Created: 2026-10-18 (replaces v1 of the same date)
Source: user request (chat, 2026-10-18). v1 is saved on branch `wip/project-visibility-reuse-v1` (commit `b64e391c`), not for merge.

## Context

v1 reused the shared mechanisms: it flipped `tGroups.ApplyFilter` and rewrote `fUserVisibleProjects` on a new
`vProjectLatest.DEO` column. That spread the change into Programs, Revisions, Lump Sum, Reports and the Dashboard,
and every fix opened another gap.

v2 restricts **only viewing**: the project lists and the project-details page. It does this through one small,
self-contained gate in `ProjectHelper`, keyed on the four named groups. It does not change `ApplyFilter`, any
existing SQL view or function, or any save, revision, program, Lump Sum, Dashboard or Report behaviour. Those come in
a later change.

### Decisions (user, 2026-10-18)

- **See everything:** AUC and DPD Admin only. A DPC/RPC user who is also in Admin is still restricted.
- **The user's office is `tUsers.PlantillaOffice`**, not `RegCode`, and it is read in one marked place.
  - DPC: PlantillaOffice must be a DEO ParticipantId (`vAdminDEO`).
  - RPC: PlantillaOffice must be a Region ParticipantId (`tOptionAdminAreaRegion`).
- **Group and office don't match** (wrong kind, blank, or unresolvable): the user sees **no projects**, and the API
  says why. Fail closed.
- **Per-stage visibility.** Each stage is judged by **its own** DEO:
  - the DEO of that stage revision's latest **fully approved modification** snapshot (Modifications module), if any;
  - otherwise the stage revision's `tProjectRevisions.DEO`.
- **Projects list:** a project is listed when **any** of its stages is in scope. Its stage panel shows only the
  in-scope stages, and an out-of-scope stage opens the "Project Not Available" panel.
- **Refusals:**
  - A project URL is answered with **400 "Project Not Found"**, the same as a missing project.
  - The details page shows a "not found, or you don't have access" panel instead of a blank page.
  - A user with no office scope gets 403 from the lists.
- **Lump Sum parents are never viewable by DPC/RPC users.** A parent is `tProjects.ProjectType = 'LS'` with no
  `ParentProjectId`, the same test `ShowProjects` already uses for `IsLumpSum`.
  - Parents are excluded from both project lists, and their project URLs answer 400.
  - **Itemized children** (ProjectType 'LS' with a parent) are ordinary projects and follow the DEO rule.
  - The **Lump Sum module itself** (`LumpsumController`) is not changed here; it is left for the later change.
- **Frontend only: hide the Lump Sum and Code Tables modules** for restricted DPC/RPC users (same precedence as the
  gate: DPC or RPC, and neither AUC nor DPD Admin). The API is not changed for these modules; that comes later.
- **Localhost test accounts** (data only, `myps_db_migrated_uat`):

  | User | Group(s) | PlantillaOffice |
  |---|---|---|
  | asisjnt | DPC | OI55 Cavite 1st DEO |
  | yabutgj | RPC | OI238 Region IV-A, the parent of OI55 |
  | ferrermaa | AUC | unchanged |
  | caldokp | DPC | OI19 Abra DEO |
  | afundardb | RPC | OI234 CAR, the parent of OI19 |
  | jopiojvc | AUC | unchanged |
  | salaniokaes | **Admin + a new "Super Admin" group** granted all 133 actions and all 19 routes (ApplyFilter 0) | unchanged |

  The new group is used because the Admin group lacks 8 actions. Granting those to Admin would reach all 570 Admin
  users.
- **Viewing only;** no save restriction.
- **Undo v1 on localhost first.**

## Goal

A DPC user lists and opens only the stages whose DEO is theirs, an RPC user only the stages whose DEO is under their
region, and AUC/DPD Admin see all. Everyone else, and every other function, behaves exactly as today.

## Acceptance Criteria

As a DPC/RPC user, I want project lists and project details limited to my office's project stages, so I can't browse
other offices' data. As AUC/DPD Admin, I still see everything.

- [ ] **DPC.** For a DPC user (not in AUC/DPD Admin) whose `tUsers.PlantillaOffice` is a DEO:
  - `ShowProjects` lists exactly the projects with at least one stage whose stage DEO = PlantillaOffice.
  - `ShowProjectsInProgram` (one row per project at the requested stage) lists only rows whose stage DEO =
    PlantillaOffice.
- [ ] **RPC.** The same, for an RPC user whose PlantillaOffice is a Region, with "stage DEO's
      `vAdminDEO.RegionParticipantId` = PlantillaOffice".
- [ ] **Per stage.** For a restricted user:
  - `ShowProjectStages` returns only the in-scope stages.
  - `ShowProjectDetails` for an out-of-scope stage returns **400 "Project Not Found"**, and for an in-scope stage of
    the same project returns 200.
  - `ShowProjectStageTargets` and `ShowProjectTargetComponents` return only in-scope stages' rows.
  - All four return 400 when no stage is in scope.
- [ ] **Lump Sum.** For a DPC/RPC user, neither list ever returns a Lump Sum parent, even one whose DEO is in scope
      (2 exist locally). Every project-detail endpoint answers 400 for a parent. Itemized children are listed and
      opened by the DEO rule like any other project.
- [ ] **Modifications.** A fully approved modification that changes a stage's DEO moves that stage to the new DEO's
      users. This is proven by a SQL probe in a rolled-back transaction, because localhost has 0 modifications.
- [ ] **See-all groups.** AUC or DPD Admin users get every project and stage from all six endpoints, including a
      DPD Admin whose `ApplyFilter` is 1.
- [ ] **No office scope.** A DPC/RPC user whose PlantillaOffice doesn't fit their group gets **403** from both list
      endpoints, with a message the interceptor toasts. Every project URL answers 400.
- [ ] **Details page.** `/projects/project-details/<id>:<stage>` for a refused stage shows the "Project Not Available"
      panel with a link back to `/projects`.
- [ ] **Hidden modules.** Signed in as asisjnt or yabutgj, the sidebar shows no Lump Sum and no Code Tables entry, and
      `/lumpsum`, `/lumpsum/add`, `/lumpsum/:id` and `/code-tables` aren't routable. ferrermaa (AUC) and salaniokaes
      still see both.
- [ ] **Accounts.** After the roles script:
  - asisjnt sees only OI55's stages, and yabutgj sees OI55's stages plus the other Region IV-A DEOs' stages.
  - caldokp sees only OI19's stages, and afundardb sees CAR.
  - ferrermaa and jopiojvc see everything.
  - salaniokaes holds every action and route, and nothing else changed for the 570 Admin users.
- [ ] **Shared gate.** All six endpoints go through the new `ProjectHelper` gate. PlantillaOffice is read in exactly
      one place, marked `// OFFICE SOURCE`. The stage-DEO rule is written once.
- [ ] **Nothing else changes.**
  - Users outside the four groups get identical results from all six endpoints.
  - `tGroups.ApplyFilter` and every existing SQL view and function are untouched; `fRevisionApprovalStatus` is only
    called.
  - A DPC user's `ShowProgram` total is unchanged.

## Approach

**Two deliberate touches outside the project read endpoints, named so they can be vetoed:**
- **`ValidateProjectIdParams.SkipVisibilityCheck`**: a new opt-in flag. It defaults to `false`, so every update and
  revision caller behaves as today. Only `ShowProjectDetails` sets it, so a DPD Admin with ApplyFilter = 1 can view
  everything (AC: see-all).
- **`ProgramController.ShowProjectsInProgram`**: the projects tab inside Program details. It is a project list, so it
  gets the same filter. Nothing else in `ProgramController` changes.

### 0. Undo v1 on localhost (`myps_db_migrated_uat` only; re-check `MYPSDb` first)

1. Restore the flags: DPC 0, RPC 0, DPD Admin 1, AUC 0.
2. Restore `vProjectLatest` and `fUserVisibleProjects` from `git show b64e391c:Main/Resources/Internal/SQLScripts/
   <name>_backup_pre_deo_visibility_20261018.sql` (`CREATE` → `CREATE OR ALTER`).
3. `DROP FUNCTION dbo.fUserCanSeeDEO`.
4. Verify: `vProjectLatest` has no `DEO` column, and the flags are restored.

### 1. The gate in `Helpers/ProjectHelper.cs`: one type, two private and two public functions, no SQL objects

- **`ProjectViewScope`** (private): `Kind` = `Legacy | All | Deos`, plus `Deos` (DEO ParticipantIds, possibly empty).
- **`ResolveProjectViewScopeAsync(db, session, ct)`** (private). The only place the rule is decided:
  - Groups come from `session.UserGroupNames`, matched against one constant set: `DPC`, `RPC`, see-all
    `{AUC, DPD Admin}`.
  - See-all group → `All`.
  - DPC/RPC → read `tUsers.PlantillaOffice` (**`// OFFICE SOURCE`**, the only read), trimmed. Then:
    - DPC and the value is a `vAdminDEO.ParticipantId` → that DEO.
    - RPC and the value is a `tOptionAdminAreaRegion.ParticipantId` → every `vAdminDEO.ParticipantId` with that
      `RegionParticipantId`.
    - A DPC + RPC user gets the union.
    - Anything else, e.g. `"OI140 (Not Exists)"` or a blank, adds nothing, so the result is `Deos` empty and the user
      sees nothing.
  - Otherwise → `Legacy`.
- **`StageDeoSql(string stageRevisionIdExpr)`** (private). The one SQL definition of a stage's DEO:
  `COALESCE((SELECT TOP 1 s.DEO FROM dbo.tRevisionDetails rd JOIN dbo.tRevisionProjectSnapshot s ON s.RevisionDetailFK
  = rd.Id AND s.IsDeleted = 0 CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) a WHERE rd.ProjectRevisionFK = <rev> AND
  a.IsFullyApproved = 1 ORDER BY rd.Id DESC), (SELECT pr.DEO FROM dbo.tProjectRevisions pr WHERE pr.Id = <rev> AND
  pr.IsDeleted = 0))`.
  - It uses the same approval test `fProjectEffectiveRevision` uses, scoped to the stage's revision.
  - Every lookup is indexed: `IX_tRevisionDetails_ProjectRevisionFK`, `IX_tRevisionProjectSnapshot_DetailFK`, and the
    primary key.
- **`AddProjectListVisibilityAsync(filters, db, session, string? stageRevisionColumn, ct)` → `bool`** (public). The
  list function.
  - `Legacy`: today's clause, moved verbatim from both controllers. It is identical in both:
    `EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)`,
    only when `ApplyFilter` is set.
  - `All`: nothing.
  - `Deos` (non-empty), with `@scopeDeos` holding them as JSON:
    - With `stageRevisionColumn` (`ShowProjectsInProgram` passes `"v.RevisionId"`, one row per stage):
      `<StageDeoSql(column)> IN (SELECT [value] FROM OPENJSON(@scopeDeos))`.
    - Without it (`ShowProjects`, one row per project): `EXISTS (SELECT 1 FROM dbo.tProjectStages ps WHERE
      ps.ProjectFK = v.ProjectPK AND <StageDeoSql("ps.RevisionId")> IN (SELECT [value] FROM OPENJSON(@scopeDeos)))`,
      which is an index seek on `IX_tProjectStages_ProjectFK`.
  - `Deos` (non-empty), in both forms, also adds `NOT EXISTS (SELECT 1 FROM dbo.tProjects lp WHERE lp.ProjectPK =
    v.ProjectPK AND lp.ProjectType = 'LS' AND lp.ParentProjectId IS NULL)`, which hides Lump Sum parents.
  - `Deos` (empty): returns `false`. The caller answers 403 `{Title: "No Project Access", Message: "Your plantilla
    office is not set up for project access for your user group. Please contact your administrator."}`.
- **`GetViewableStagesAsync(db, session, projectPK, ct)` → `IReadOnlyList<(int RevisionId, string StageName)>?`**
  (public). The URL check. `null` means no restriction.
  - `Legacy`: today's check. If `ApplyFilter` is set and `fUserVisibleProjects` lacks the project → empty;
    otherwise `null`.
  - `All`: `null`.
  - `Deos`: if the project is a Lump Sum parent → empty. Otherwise `SELECT ps.RevisionId, ps.StageName FROM
    tProjectStages ps WHERE ps.ProjectFK = @pk AND <StageDeoSql("ps.RevisionId")> IN (…)`. Empty means none.

### 2. Call sites (read endpoints only)

- **`ProjectController.ShowProjects`**: replace the inline ApplyFilter block with
  `if (!await filters.AddProjectListVisibilityAsync(_db, _Session, null, ct)) return 403 …`.
- **`ProgramController.ShowProjectsInProgram`**: the same, with `"v.RevisionId"`.
- **`ProjectController.ShowProjectDetails`**:
  - Calls `ValidateProjectId` with `SkipVisibilityCheck = true`.
  - Then calls `GetViewableStagesAsync`.
  - Refuses with ValidateProjectId's own "Project Not Found" wording unless the result is `null` or contains
    `ValidateProjectId.Data.ProjectStage.RevisionId`.
- **`ProjectController.ShowProjectStages`**: calls `GetViewableStagesAsync`. Empty → 400; a list → filter
  `Stages` to those RevisionIds.
- **`ProjectController.RejectIfProjectNotVisible`**: becomes `GetViewableStagesAsync`, and empty → the existing 400.
  Its two users then narrow by stage name:
  - `ShowProjectStageTargets` adds `v.StageName IN (SELECT [value] FROM OPENJSON(@viewableStages))`.
  - `ShowProjectTargetComponents` filters `Targets` by `StageName` before grouping, so it lists only components and
    stage counts from visible stages.

### 3. Frontend

- **Project details page:** restore the `EditProject.tsx` "Project Not Available" panel from `b64e391c` (file-only
  checkout, unchanged code).
- **Lists: no change expected.** `httpClient.ts` toasts any error that carries a `Message` and rethrows it, with no
  403 redirect, and `fetchProject` rethrows. Still to verify: the Projects table and the `ProgramDetail.tsx` projects
  tab tolerate the 403. If one doesn't, add a small catch there.
- **Stage panel:** no change. It renders whatever `ShowProjectStages` returns, which is now only the in-scope stages.
- **Hide Lump Sum and Code Tables (frontend only).**
  - In `FE/src/contexts/AuthContext.tsx`, when the session is set, drop `LumpSumList`, `AddWallet`, `LumpSumDetails`
    and `CodeTables` from `ViewAccess` for a restricted user: `user.UserGroupNames` includes DPC or RPC, and includes
    neither AUC nor DPD Admin.
  - Both `usePermittedRoutes` (the routes) and `AppSidebar` (the menu) read `ViewAccess`, so this one filter hides the
    menu entries **and** makes the URLs unroutable.
  - One small constant set and one helper, with a comment noting it mirrors the backend set and that the API is still
    open for these modules until the later change.

### 4. Localhost accounts (data script, not code)

- Add `Main/Resources/Internal/SQLScripts/ProjectVisibility.UserRoles.Dev.sql`, which is idempotent and runs only
  against a local SQL Server. It:
  - creates the **"Super Admin"** group (ApplyFilter 0) if it's missing, and sets its `tGroupRoles` to **every**
    `tApiActions.Id` and `tAppViews.Id`. Re-running picks up any new ones.
  - sets `tUserGroups.GroupIds` by group **name**: asisjnt/caldokp `[DPC]`, yabutgj/afundardb `[RPC]`,
    ferrermaa/jopiojvc `[AUC]`, salaniokaes `[Admin, Super Admin]`.
  - sets `tUsers.PlantillaOffice`: asisjnt OI55, yabutgj OI238, caldokp OI19, afundardb OI234. `RegCode` is left as is.
  - ends with a before/after SELECT, plus each DPC/RPC user's resolved scope, as a proof.

## Tasks

### Implementation
1. Undo v1 on localhost (step 0), and record the before/after state.
2. Add `ProjectViewScope`, `ResolveProjectViewScopeAsync`, `StageDeoSql`, `AddProjectListVisibilityAsync` and
   `GetViewableStagesAsync` to `Helpers/ProjectHelper.cs`, plus `SkipVisibilityCheck` on `ValidateProjectIdParams`.
3. Convert the six call sites in step 2.
4. Restore `FE/src/pages/Project/Views/EditProject.tsx` from `b64e391c`, and add the Lump Sum / Code Tables
   `ViewAccess` filter to `FE/src/contexts/AuthContext.tsx`.
4a. Write and run `SQLScripts/ProjectVisibility.UserRoles.Dev.sql` on localhost (step 4 of Approach).
5. Fixture `SQLScripts/ProjectVisibility.Fixture.Dev.sql`, adapted from v1. Drop v1's `fUserCanSeeDEO`,
   `vProjectLatest.DEO` and ApplyFilter guards.
   - Accounts, with **PlantillaOffice** set:
     - `e2edpc`: DPC, OI43
     - `e2erpc`: RPC, OI237
     - `e2eauc`: AUC, OI43
     - `e2edpcnoscope`: DPC with Region OI237
   - One real group each.
   - Asserts the grants and refuses to run on a non-local server.
6. `e2e/tests/project-visibility.spec.ts`, adapted from v1.
   - **Trap:** v1's SQL reads `vProjectLatest.DEO`, which is gone after step 0. All expected sets must be computed
     with the same stage-DEO expression as `StageDeoSql`.
   - Pick a probe project whose stages carry **two different DEOs**, so per-stage behaviour is really exercised; 1,173
     such projects exist locally (e.g. OI122 → OI3576).
   - Cases:
     - list membership and totals per account;
     - stage panel filtered;
     - in-scope stage 200, out-of-scope stage 400 (a 403 fails loudly);
     - stage targets limited to visible stages;
     - 403 "No Project Access" for `e2edpcnoscope`;
     - Lump Sum: e2erpc never sees a Lump Sum parent in either list, even one in its region, and gets 400 on its
       details; an itemized child with an in-scope DEO is listed and opens;
     - `ShowProgram` totals unchanged;
     - one UI deep-link case.
   - **Modification probe** (SQL only): in `BEGIN TRAN … ROLLBACK`, insert a fully approved modification for one probe
     stage revision (`tRevisionDetails`, a `tRevisionProjectSnapshot` with another DEO, RO + CO `tRevisionApprovals`).
     Assert the stage-DEO expression returns the snapshot DEO, and the base DEO after rollback.

### Documentation
1. `documents/docs/engineering/PROJECT_VISIBILITY_RULE.md`, rewritten for v2:
   - the per-stage rule;
   - the functions and their call sites;
   - the PlantillaOffice source;
   - what isn't covered yet (saves, revisions, Programs, Lump Sum, Dashboard);
   - why v1 was dropped;
   - the data findings below.
2. `e2e/CLAUDE.md`: coverage row and fixture note.
3. This plan, saved as `documents/plans/project-visibility-by-deo-region.md`, replacing v1's.

## Files / Components Touched
- `Helpers/ProjectHelper.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`: `ShowProjects`, `ShowProjectDetails`, `ShowProjectStages`,
  `RejectIfProjectNotVisible`, `ShowProjectStageTargets`, `ShowProjectTargetComponents`
- `WebAPI/Controllers/Programs/ProgramController.cs`: `ShowProjectsInProgram` only
- `FE/src/pages/Project/Views/EditProject.tsx`, `FE/src/contexts/AuthContext.tsx`
- `Main/Resources/Internal/SQLScripts/ProjectVisibility.UserRoles.Dev.sql` (new; localhost data only)
- `Main/Resources/Internal/SQLScripts/ProjectVisibility.Fixture.Dev.sql` (new)
- `e2e/tests/project-visibility.spec.ts` (new), `e2e/CLAUDE.md`
- `documents/docs/engineering/PROJECT_VISIBILITY_RULE.md`, `documents/plans/project-visibility-by-deo-region.md`
- Localhost DB: the v1 rollback only. **No SQL objects are added or changed, and there is no deploy step.**

## Risks / Open Questions / Assumptions
- **Other DPC/RPC users with bad offices see nothing.** The roles script fixes asisjnt, yabutgj, caldokp and afundardb.
  The remaining local DPC user, olegalml (PlantillaOffice is a Region), will see no projects. The original state of
  the local DPC/RPC users: Their PlantillaOffice values are:
  - DPC: a Region (OI239), `"OI140 (Not Exists)"`, and a blank;
  - RPC: two blanks.

  Across all users, PlantillaOffice holds 299 DEOs, 32 Regions, 192 blanks, and 64 other offices or unresolvable
  values. An admin must set correct offices; the 403 message says why. A data clean-up is needed before release.
- **The list row shows the latest stage.** A project listed because an *earlier* stage is in scope still shows its
  latest stage's description and category in the row, and its stage panel shows only the in-scope stages. That is
  accepted with "any stage in scope".
- **DEOs differ between stages in 1,173 projects** (0.7%): mostly GAA 2026 OO-1 (693) and GAA 2025 OO-1 (268), and
  mostly at NEP → HGAB (683) and NEP → NEP-E (210). These are exactly the projects per-stage filtering exists for.
  The spec uses one of them as its probe.
- **The parent region comes from the office hierarchy, not the `Region` tag.**
  - 1,211 live revisions are tagged with a region other than their DEO's parent, mostly the Cotabato City and Isabela
    City DEOs tagged BARMM; another 525 have a blank `Region`.
  - BARMM RPC users won't see those projects.
  - This follows the rule as specified. Changing it would be a GIS-import data question.
- **The modification branch has no real data locally** (0 `tRevisionDetails`). It is covered only by the rolled-back
  SQL probe.
- **Viewing only, by design.** DPC/RPC users can still save, revise, open programs, and use Lump Sum, Dashboard and
  Reports as today. Dashboard links to out-of-scope projects land on the "Project Not Available" panel. All of this is
  left for the later change.
- **The Lump Sum module is still open to DPC/RPC.** The project lists hide Lump Sum parents, but `/lumpsum` and its
  API keep today's program-level checks, so a DPC/RPC user who opens the Lump Sum module directly can still see
  parents. This is left for the later change, as the user decided.
- **Program details still opens for DPC/RPC** (ApplyFilter untouched); only its projects tab is filtered.
- **Legacy branch kept verbatim**, including the `d.ProgramFK = v.Id` oddity, for users outside the four groups.
- **Count-query cost:** the `ShowProjects` total runs the any-stage EXISTS per row (about 172k rows, ~2 stages each).
  Time it separately. Fallback, only if slow: resolve the in-scope ProjectPKs once and filter with `OPENJSON`.
- **Hiding Lump Sum and Code Tables is frontend-only.** The API still answers DPC/RPC for those modules, so a crafted
  request works. The group names are now listed in two places, the backend gate and the frontend filter, which must be
  kept in step until the later change moves this server-side.
- **Super Admin and revision approvals.** The new group holds the ApproveRevision, RejectRevision and
  ForCorrectionRevision *actions*. RevisionController still decides RO/CO approval levels by the `RPC`/`AUC` group
  names, so salaniokaes may still be unable to approve at a level. That's existing behaviour, not changed here.
- **Changing PlantillaOffice also changes vUsers.RegCode/RegName** for those four users, because the view resolves
  them through PlantillaOffice. Today's consumers read it only when ApplyFilter is set, which is 0 for DPC/RPC after
  the step-0 rollback, so this is expected to be inert. It's checked in verification.
- **Group names are matched by name**, in one constant set. Renaming a group breaks the rule silently. The doc says so.
- **Never commit** `.claude/settings.json`, `FE/.env.development` or `Main/appsettings.Development.json`.

## Verification
1. **Localhost rollback:** no `vProjectLatest.DEO`, DPC/RPC ApplyFilter 0 and DPD Admin 1, and `fUserCanSeeDEO` is gone.
2. **Build:** `dotnet build` Main and the test projects, and the FE `tsc -b` error count is unchanged.
3. **API:** Main on :5015 (Development) and `npx playwright test project-visibility` with `E2E_SQL_*` set. The
   expected sets come from SQL, not hard-coded numbers.
4. **Timing:** `ShowProjects` and `ShowProjectsInProgram` as e2edpc/e2erpc against e2eauc, page and `total` timed
   separately from the API log.
5. **List consumers:** as e2edpcnoscope, the Projects list and a Program details projects tab show one toast and an
   empty table, and don't crash.
6. **Accounts and menus:**
   - Run the roles script, then sign in through the UI as asisjnt, yabutgj, caldokp, afundardb, ferrermaa and
     salaniokaes.
   - Check the Projects list scope and Lump Sum / Code Tables visibility for each. The DPC/RPC users get no Lump Sum or
     Code Tables entry, and their `/lumpsum` and `/code-tables` URLs don't route.
   - Check that salaniokaes's permitted actions equal all 133.
   - Check that a sample Admin user's permissions are unchanged.
7. **Regression:** `project-list`, `ls-list-tolerance` and `ls-data-security` give the same results as before, and a
   user outside the four groups gets identical totals.
8. Then run `/code-review` against this checklist.

## Completion Log
Date: 2026-10-18
- Implementation:
  - **Undid v1 on localhost.** Restored `vProjectLatest` and `fUserVisibleProjects` from the v1 rollback copies,
    after diffing them against the original captures (identical). Dropped `fUserCanSeeDEO`. Restored the flags:
    DPC/RPC/AUC 0, DPD Admin 1.
  - **Added the "Project view gate" to `Helpers/ProjectHelper.cs`.** It has one type and four functions:
    `ResolveProjectViewScopeAsync`, `StageDeoSql`, `AddProjectListVisibilityAsync` and `GetViewableStagesAsync`.
    `ValidateProjectIdParams.SkipVisibilityCheck` is opt-in and used only by ShowProjectDetails.
  - **Converted the six read endpoints:** ShowProjects, ShowProjectsInProgram, ShowProjectDetails,
    ShowProjectStages, ShowProjectTargetComponents and ShowProjectStageTargets. `RejectIfProjectNotVisible` now also
    returns the visible stages.
  - **Frontend:** restored the `EditProject.tsx` panel from `b64e391c`, and added the `ViewAccess` filter in
    `AuthContext.tsx`, which hides Lump Sum and Code Tables for DPC/RPC.
  - **Data scripts:** `ProjectVisibility.UserRoles.Dev.sql` ran on localhost (Super Admin has 133/133 actions and
    19/19 routes, plus the 7 accounts). `ProjectVisibility.Fixture.Dev.sql` created e2edpc, e2erpc, e2eauc and
    e2edpcnoscope.
  - **Spec:** `e2e/tests/project-visibility.spec.ts`, 9 cases.
- Documentation: `documents/docs/engineering/PROJECT_VISIBILITY_RULE.md` (new); `e2e/CLAUDE.md` coverage rows and a
  *Project view gate* section.
- Verification:
  - `project-visibility.spec.ts` passed **9/9**: 7 API cases, including the rolled-back modification probe (no rows
    left behind), and 2 UI cases.
  - Main builds. The FE `tsc -b` count is unchanged at 21, none in the changed files.
  - Account totals match SQL expectations: asisjnt 1,420; yabutgj 15,186; caldokp 908; afundardb 6,743; AUC users and
    salaniokaes see all 171,894. salaniokaes has 133 actions, and Admin is unchanged at 125.
  - Regression: `ls-list-tolerance` and `ls-data-security` fail for the same stage-data reason as before this change.
    The program is at HGAB, and the Admin user takes the unchanged Legacy path. `project-list` is **flaky**: it failed
    once and passed on rerun. The page's list calls take about 8–9 s under concurrency, close to its 10 s wait. Not
    re-run against `main`.
Deviations / flags:
  - **Performance (open risk).**
    - Measured times for `ShowProjects`, 10 rows:

      | User | Time |
      |---|---|
      | Unrestricted | ~5 s |
      | DPC | ~7.5 s |
      | RPC | ~13 s |

    - SQL timings showed the cost is filtering `vProjectLatest` at all: the same filter on the base DEO alone is just
      as slow.
    - The plan's fallback (resolve the in-scope ProjectPKs once and filter with OPENJSON) was implemented and measured.
      It is much worse: nested loops over the view and 90 s timeouts. It was reverted to the inline per-row form.
    - A real fix needs an indexed DEO or a new SQL object, both outside this plan.
  - **Fixture DEO changed.** The fixture uses OI122 Davao City DEO and OI246 Region XI (not OI43/OI237), so the probe
    project really changes DEO between stages (OI122 → OI3576 at GAA).
  - **Fixture grant check widened.** The fixture also asserts the `ShowProgram` grant, which the "Program totals
    unchanged" case needs.
  - **The FE ViewAccess filter is in `AuthContext.validateSession`.** Login always goes through it.
  - `git fetch` still fails on Gitea auth, so re-check `main` before merging.
Files changed:
  - Code: `Helpers/ProjectHelper.cs`, `WebAPI/Controllers/Projects/ProjectController.cs`,
    `WebAPI/Controllers/Programs/ProgramController.cs`, `FE/src/pages/Project/Views/EditProject.tsx`,
    `FE/src/contexts/AuthContext.tsx`.
  - Data scripts and tests: `Main/Resources/Internal/SQLScripts/ProjectVisibility.UserRoles.Dev.sql` (new),
    `Main/Resources/Internal/SQLScripts/ProjectVisibility.Fixture.Dev.sql` (new),
    `e2e/tests/project-visibility.spec.ts` (new), `e2e/CLAUDE.md`.
  - Docs: `documents/docs/engineering/PROJECT_VISIBILITY_RULE.md` (new), this plan.
  - Localhost DB: the v1 rollback, the Super Admin group, the 7 accounts' groups and PlantillaOffice, and the 4 e2e
    accounts.

