# Plan: Delete rules: first-stage hard delete, later-stage soft delete with a restore list, and stage delete

Status: Implemented
Created: 2026-10-29
Source: user request (S01-TC004-P002 follow-up), approved 2026-10-29

## Context
ATA test S01-TC004-P002 asked for a per-project Delete button. That shipped and reuses the Batch Delete rule. The user now wants three conditions guaranteed:

1. A project at its **first stage** can be **permanently** deleted.
2. At **any later stage** a project is **only soft-deleted**, and soft-deleted projects must be **listed somewhere they can be restored from**.
3. A **program, or a program's stage**, can be deleted once **every project under it has been deleted**.

### What the code already does (verified)
- **Conditions 1 and 2 already hold for every delete path.**
  - The rule lives in `Main/Resources/Internal/SQLObjects/Functions/GetProjectDeletionTier.sql`, with C# in `Helpers/ProjectHelper.cs:820`.
  - Hard when the project has one stage entry. Soft once it has moved on (only the current stage's revision gets `IsDeleted = 1`). Blocked if published, or if the program is Approved. Lump Sum itemized projects are always Hard.
  - `MYPS.DatabaseTests/ProjectDeletionTierTests.cs` covers it.
  - The per-row Delete button and Batch Delete both use it.
- **Restore exists, but there's no list.**
  - Batch Actions → Batch Restore (`ProgramController.BatchAddExistingProject`, about line 2683) needs typed Project IDs.
  - It restores a project's latest deleted revision in the program, writes an audit row, and recomputes the program cost.
  - Every soft delete already writes a `tTransactionLog` row (`ProjectHelper.AddSoftDeleteAuditRows`): ReferenceId = ProjectFK, AffectedTable = `tProjectRevisions`, NewValue `'true'`, OldValue JSON with `RevisionId` and `StageName`, plus CreatedBy and CreatedDate. That gives the list its "deleted by / on".
- **Condition 3 holds for programs at their first stage only.**
  - `GetProgramDeletionEligibility.sql` and `ProgramHelper.ExecuteProgramDeletionAsync` refuse while any live project remains, and refuse Approved programs.
  - They also refuse any program that has moved past its first stage. So there is no way to delete a later stage, even when all its projects are deleted.
- **Advancing a stage only inserts rows** (`ProgramController.UpdateProgramStage`, about line 817): a new `tProgramRevisions` row, a `tProgramStages` row, and a copy of each live project's revision, child rows, supporting docs and `tProjectStages` row. It changes no existing row.
  - So removing those rows returns the program to its previous stage cleanly.
  - The projects' previous-stage revisions were never touched, so they are live there again.
  - `tProgramStages` and `tProgramRevisions` have no `IsDeleted` column.

## Decisions (approve or redirect)
- **D1. Where soft-deleted projects are listed.** Program Details gets a **"Deleted projects (N)"** button beside Batch Actions. It opens a panel listing the projects deleted **at the program's current stage**, with:
  - Project ID, Description, Cost, Deleted by and Deleted on.
  - A **Restore** button per row, and **Restore selected**. Both call the existing restore endpoint.
  - Rows that can't be restored (published, program Approved) show why, with Restore disabled.

  Only the current stage is listed because a restored project reappears at the stage it was deleted from. Restoring one deleted at an earlier stage wouldn't show up in today's table. Batch Restore stays as it is.
- **D2. Delete Stage is offered where Delete Program already is: the Program list's Delete button.**
  - First-stage program: behaviour is unchanged ("Delete program").
  - Program past its first stage: the button becomes **"Delete <Stage> stage"**, and the dialog says "The program goes back to <previous stage>; the projects there are not affected."
- **D3. Delete Stage is permanent.** It removes the stage's program revision, its stage row, and the project rows created at that stage (all already deleted). Nothing else is lost: each project keeps its earlier-stage records and is live at the previous stage again. A restorable stage delete would need a schema change plus changes to `vProgramLatest` and every current-stage query, so that is out of scope.
- **D4. Delete Stage is refused when any of these is true:**
  - The program is **Approved** (same rule as programs and projects).
  - It is **published to PCMA** (`tPrograms.IsPublished`).
  - **Any project is still live** at that stage, with the count and a "delete them first" message.
  - **Revision-module records** exist on the stage's projects (`tRevisionDetails` / `tRevisionProjects`): "cancel the revision requests first".
  - The stage has **leftover live rows** the script can't reach.

  Only the latest (current) stage can be deleted.

## Acceptance Criteria
As a program owner, I want deleted projects to be restorable from a list, and an emptied program or stage to be deletable, so that I can undo mistakes without typing IDs or leaving dead stages behind.

- [ ] Deleting a project at its first stage removes it permanently (preview says "permanently deleted"; no rows remain).
- [ ] Deleting a project at a later stage only soft-deletes it: its earlier-stage revisions stay, and it disappears from the current stage's table.
- [ ] A published project, or any project in an Approved program, can't be deleted (except Lump Sum itemized children, as today).
- [ ] Program Details shows "Deleted projects (N)" for the current stage, with Project ID, Description, Cost, Deleted by and Deleted on.
- [ ] Restore from the panel (one or several) brings the projects back into the current stage's table. It writes the restore audit row and updates the program cost, and the panel count goes down.
- [ ] A row that can't be restored shows why, with Restore disabled.
- [ ] A first-stage program with no live projects can be deleted from the Program list (unchanged). With live projects, the Delete button is disabled and says why.
- [ ] A program past its first stage whose current stage has no live project shows "Delete <Stage> stage". Confirming removes that stage: the Program list and Program Details then show the previous stage, its projects are live and unchanged, and the program cost is recomputed.
- [ ] Delete Stage is refused, with the reason shown and nothing written, when the program is Approved, published to PCMA, has a live project at that stage, has revision-module records on that stage, or has leftover live rows.
- [ ] Every stage delete writes one `tTransactionLog` audit row describing the removed stage.
- [ ] Delete and restore actions are visible only to users who can use Batch Actions today.

## Approach
- **One rule script.** `GetProgramDeletionEligibility.sql` stays the single source of truth for the Program list's Delete button. It gains an output column `DeleteKind` (`Program` or `Stage`), `PreviousStageName`, and the D4 checks for progressed programs:
  - New `BlockedBy` codes: `Published`, `RevisionRecords`, `StageLeftovers`.
  - Approved programs still skip the counting, for performance.
  - Live-project checks for progressed programs use `EXISTS`, then `COUNT`, at the current stage only.
- **New script `Stored Procedures/ExecuteProgramStageDeletion.sql`**, run like `ExecuteProgramDeletion.sql` through `ISqlExecutor` in the caller's transaction:
  - Writes the audit row first.
  - Then deletes, children first: work locations → cost per year → work items → component costs → notes, funding, supporting docs → `tProjectStages` → `tProjectRevisions`, for every project revision whose stage row is at the current stage or whose `ProgramId` is the stage's `ProgramId`.
  - Then the `tProgramStages` row, then its `tProgramRevisions` row, if no other stage row points at it.
  - The child-table list mirrors `ExecuteProjectDeletion.sql`.
- **New `ProgramHelper.ExecuteProgramStageDeletionAsync`**, mirroring `ExecuteProgramDeletionAsync`:
  - Takes `AcquireProgramDeletionLockAsync`, re-runs the eligibility on locked rows, and refuses unless `DeleteKind = Stage` and Eligible.
  - Runs the script, checks that no live row remains at that stage, calls `RecomputeProgramCostAsync`, and commits. Any refusal throws `DeletionRefusedException`.
- **New endpoints in `ProgramController`:**
  - `POST /Program/DeleteProgramStage` (`[RequiresDeletionObjects]`), with the same error handling as `DeleteProgram`: 400 on refusal, 409 on deadlock.
  - `POST /Program/ShowDeletedProjects`, read-only. Returns the current stage's soft-deleted projects: the latest deleted revision per project, joined to the newest delete audit row for who and when, and `CanRestore` plus `Reason` from the existing tier resolver (`DetermineProjectDeletionTiersAsync` + `RestoreRefusal`).
  - `ShowProgram`'s eligibility payload gains `DeleteKind` and `PreviousStageName`.
- **Front end:**
  - `DeletedProjectsPanel.tsx` (headless-ui Dialog with a table), opened from a new button in `ProgramDetail.tsx` next to `BatchActionsDropdown`. It reuses `batchRestoreProjects` and refreshes the table and count.
  - `Program.tsx` / `DeleteProgramDialog.tsx`: label and dialog text by `DeleteKind`, calling `deleteProgramStage` for `Stage`.
  - New `Service.ts` calls and `Model.d.ts` types.

## Tasks

### Implementation
1. Extend `GetProgramDeletionEligibility.sql` (DeleteKind, PreviousStageName, D4 checks, header policy) and map the new columns in `ProgramHelper.ProgramDeletionEligibilityResult`.
2. Add `ExecuteProgramStageDeletion.sql` and `ProgramHelper.ExecuteProgramStageDeletionAsync` (lock → re-check → script → postcondition → cost recompute).
3. Add `ProgramController.DeleteProgramStage` and `ShowDeletedProjects`, with DTOs, and expose `DeleteKind` / `PreviousStageName` in `ShowProgram`.
4. Front end: `DeletedProjectsPanel.tsx`, the button in `ProgramDetail.tsx`, Delete Stage in `Program.tsx` and `DeleteProgramDialog.tsx`, plus `Service.ts` and `Model.d.ts`.
5. Tests:
   - `MYPS.DatabaseTests`: eligibility cases for Program and Stage kinds and each D4 block. A stage-deletion script test that removes only the current stage's rows, leaves the previous stage live, and writes the audit row. A deleted-projects query test.
   - `MYPS.ApiIntegrationTests` contract tests for the two endpoints (`[RequiresDeletionObjects]`, refusal returns 400).
6. A narrated Playwright run against local `myps_db_dev` only, through a Vite started with `VITE_API_BASE_URL=http://localhost:5015` (the :8080 server proxies to a remote host). It uses throwaway data the test creates itself (an `E2E-` named program):
   - Import one project and hard-delete it.
   - Import another, advance the stage, and soft-delete it at the new stage.
   - Restore it from the panel, then soft-delete it again.
   - Delete Stage: the program goes back, and the project is live there.
   - Hard-delete the project, then Delete Program, to clean up.

### Documentation
7. Release note in `docs/changelogs` (newest "(not yet released)" file).
8. `FE/UserManual.md` and `FE/src/pages/Program/UserManual.md`: deleted-projects panel, Delete Stage, and the delete rules table.
9. `FE/src/pages/Program/program.md`: new endpoints, panel, DeleteKind.
10. QA workbook: mark S01-TC004-P002 green only after the run above passes.

## Files / Components Touched
- `Main/Resources/Internal/SQLObjects/Functions/GetProgramDeletionEligibility.sql`, `.../Stored Procedures/ExecuteProgramStageDeletion.sql` (new)
- `Helpers/ProgramHelper.cs`
- `WebAPI/Controllers/Programs/ProgramController.cs`, `DTOProgram.cs`
- `FE/src/pages/Program/Views/ProgramDetail.tsx`, `Views/Program.tsx`, `dialogs/DeleteProgramDialog.tsx`, `components/programDetail/DeletedProjectsPanel.tsx` (new), `Service.ts`, `Model.d.ts`
- `MYPS.DatabaseTests` (new tests), `MYPS.ApiIntegrationTests` (contract tests), e2e narrated spec (in the scratch worktree; nothing that uses the repo's `playwright.config.ts`, whose teardown deletes Lump Sum projects)
- Docs above, and `docs/changelogs`

## Risks / Open Questions / Assumptions
- **Destructive operations (high-risk path).** Delete Stage permanently removes rows. Mitigations: per-program lock, rule re-checked on locked rows, postcondition check, one transaction, audit row first, and DB tests on disposable databases.
- **Approving this plan also approves, for testing only:**
  - Hard-deleting the throwaway program and projects the e2e test creates in local `myps_db_dev`. You had approved only soft-delete so far.
  - Running `MYPS.DatabaseTests`. They create and drop their own `MYPS_Test_<guid>` databases. Your rule asks for names ending in `_test`; these are disposable by construction, but the naming doesn't match.

  A COPY_ONLY backup of `myps_db_dev` is taken first.
- **Program list performance.** The stage checks run only for programs that aren't Approved and use `EXISTS`. I'll measure the list page against local data.
- **Assumption:** "program/stage" means the program as it is at its current stage. Only the latest stage can be deleted; a middle stage can't.
- **Not in scope:** a cross-program "recycle bin" page, a restorable stage delete, and listing projects deleted at earlier stages.

## Verification
- `dotnet test MYPS.DatabaseTests --filter` on the new and existing deletion test classes (`ProjectDeletionTierTests`, the new eligibility and stage tests).
- `dotnet test MYPS.ApiIntegrationTests` on the deletion contract tests.
- `tsc` limited to the changed files (the 21 known Rbac errors excepted), and `eslint` on the changed files.
- A narrated, headed Playwright run of the throwaway scenario above, on :8081 → :5015 → local `myps_db_dev`, with before and after SQL snapshots showing only the throwaway rows changed.
- Then `/code-review`, and check against this Acceptance Criteria list.

## Completion Log
Date: 2026-10-29
- Implementation:
  - Project rule (`GetProjectDeletionTier.sql`): Hard only when the project's single stage entry is BP (Id 1) or RBP (Id 8); any other single stage entry is now Soft. Lump Sum itemized children stay Hard (user decision).
  - Program rule (`GetProgramDeletionEligibility.sql`): new `NotBP` refusal. Delete Program only while the program's one stage is BP or RBP.
  - Deleted projects panel: `ProgramController.ShowDeletedProjects` (read-only; who/when from the soft-delete audit row, `CanRestore` from the tier), `DeletedProjectsPanel.tsx`, and a "Deleted projects (N)" button in `ProgramDetail.tsx`. Restore reuses Batch Restore.
  - BP/P Project ID reuse (user request mid-implementation): `ExecuteProjectDeletion.sql` releases a fully removed project's BP/P ids into `dbo.tProjectIdReleased` (not MY, not LSChild). `ProjectHelper.GenerateProjectID` claims the lowest released id of the bucket before the counter (READPAST; a released id now carried even by a soft-deleted revision is skipped).
  - Batch Delete / preview messages name only what happened (`DescribeDeleted`). Confirm dialog wording follows the BP/RBP rule.
  - `Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql`: the released-id table, an index on `tProjectRevisions.ProjectId`, and the `ShowDeletedProjects` grant. Applied to local myps_db_dev.
  - Tests: MYPS.DatabaseTests deletion and ID suites, 73 passed (BP/RBP rule, NotBP program refusal, id release and reuse, MY and itemized ids not reused, no-table fallback). A narrated Playwright run on local myps_db_dev (:8082 -> API :5017) passed 6/6: BP delete permanent and id freed; next project reuses the id; GAA delete soft with toast check and panel restore; Delete Program refused past BP; cleanup.
- Documentation: `docs/changelogs` v2.0.9 section; `FE/UserManual.md` 3.20 (delete rules table, Deleted projects, program delete rule); `FE/src/pages/Program/UserManual.md`; `program.md`; `documents/docs/RELEASE_DELETE_POLICY.md` (migration step, behaviour).
Deviations / flags:
  - **Delete Stage was built, then removed** at the user's direction ("no permanent deleting at a later stage; only at BP", with RBP counting as BP). D2/D3/D4 and the stage acceptance criteria no longer apply; a program past BP/RBP cannot be deleted.
  - Added beyond the plan, per the user: BP/P Project ID reuse; clearer delete toasts.
  - Follow-up requested, not built yet: "Restore into the current stage" for a project deleted at an earlier stage after the program moved on (Alvin 2026-10-29: projects in the same year may have different stage paths, all reach GAA; a project deleted before an advance stays deleted unless restored).
  - Left on local myps_db_dev from the removed Delete Stage: a registered and granted `ProgramController.DeleteProgramStage` action row. It is harmless; User Management -> Sync API Permissions removes stale actions.
Files changed: Main/Resources/Internal/SQLObjects/Functions/GetProjectDeletionTier.sql, .../GetProgramDeletionEligibility.sql, .../Stored Procedures/ExecuteProjectDeletion.sql, Main/Resources/Internal/SQLScripts/Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql (new), Helpers/ProjectHelper.cs, Helpers/ProgramHelper.cs, WebAPI/Controllers/Programs/ProgramController.cs, WebAPI/Controllers/Programs/DTOProgram.cs, FE/src/pages/Program/components/programDetail/DeletedProjectsPanel.tsx (new), FE/src/pages/Program/Views/ProgramDetail.tsx, FE/src/pages/Program/Service.ts, FE/src/pages/Program/Model.d.ts, FE/src/pages/Program/dialogs/ConfirmDialogBatch.tsx, FE/src/pages/Program/dialogs/BatchTagDialog.tsx, MYPS.DatabaseTests/ProjectDeletionTierTests.cs, MYPS.DatabaseTests/ProjectIdGenerationTests.cs, e2e/tests/program-detail-batch-actions.spec.ts, docs and manuals above.
