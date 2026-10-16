# Plan: Fix the code-review findings on PR #255, rebased onto main (PR #260)

Status: Ready for implementation
Created: 2026-10-16


## Context
- **Main moved.** It now ends with PR #260 "Add Dapper SqlExecutor and SQLObjects deploy scaffolding" (`2f950fcb`, mf1027). That PR moved the shared foundation into main: `ISqlExecutor`/`SqlExecutor`, `SqlBatchSplitter`, `SqlObjectDeployer`, `Appsetting.Resources.SQLObjects`, `GenerateTables.ps1` + template, and the `Main.csproj` resources.
- **The branch is rebased onto it.** The user rebased `feat/program-project-hard-delete-policy` onto it at 08:14 on 2026-10-16. Locally it is 34 ahead / 14 behind `origin/feat/...`.
- **Main is the primary source.**

### Review result (static, 2026-10-16)
- **Main's foundation is respected:**
  - `SqlExecutor`, `SqlBatchSplitter`, `Appsetting` and `GenerateTables` are identical to main.
  - The branch's changes to `SqlObjectDeployer.cs` and `Main.csproj` are consistent with main's design.
  - Main's other recent work (component descriptions, `Project/Service.ts`, `httpClient.ts`) is untouched.
- **10 findings** remain in the branch's delete-policy code (below).

User decisions:
- **Main's `SqlExecutor` rollback bug** is fixed on this branch, as a small, visible diff to main's file.
- **Leftovers that can never be removed** are shown up front: the list disables Delete with an "administrator" reason. No automatic removal; the single tier rule stays as it is.

**Housekeeping first:** snapshot `myps_db_migrated_uat_snap_t9` and the PreviewBatchDelete permission row are still applied on localhost from the interrupted e2e setup. Step 0 reverts them.

## Findings → fixes

### A. Locking and transactions (findings 1, 2, 3; old risks #1–#3)
1. **Main's `Helpers/SqlExecutor.cs` `ExecuteTransactionAsync`** (finding 2, the hidden error).
   - Wrap `transaction.Rollback()` in `try { … } catch { }` (it throws "This SqlTransaction has completed" after a deadlock or timeout), then `throw;` the original exception.
   - Use async `CommitAsync`/`RollbackAsync`, matching the method's own async style.
   - Nothing else in main's file changes.
2. **One per-program application lock**, taken first by every delete path. This stops Delete Program and the project deletes from deadlocking on opposite row-lock orders (finding 2).
   - New helpers:
     - `ProgramHelper.AcquireProgramDeletionLockAsync(IDbConnection, IDbTransaction, programFK, exclusive)`, and an EF form for `MYPSDbContext`.
     - Both run `sp_getapplock @Resource = 'MYPS_ProgramDelete:' + ProgramPK, @LockOwner = 'Transaction', @LockTimeout = 30000`. Mode is Exclusive for Delete Program and Shared for the others.
   - Callers, immediately after their transaction opens:
     - `DeleteProgramInTransactionAsync` (Exclusive);
     - `ProgramController.BatchDelete` and `BatchAddExistingProject` (restore);
     - `LumpsumController.DeleteLumpSum` and `DeleteItemizedProject` (after their existing Lump Sum lock, keeping the module's lock order).
   - A timeout (result < 0) is a `DeletionRefusedException`: "Another delete in this program is in progress. Try again in a moment."
   - Deadlock 1205 still possible with non-delete writers (approve, stage advance): `DeleteProgram` and `BatchDelete` catch `SqlException` 1205 and answer 409 "This program was being changed at the same time. Try again."
3. **Delete Program locks only what it needs, in two steps** (finding 3, old risk #1). In `ProgramHelper.DeleteProgramInTransactionAsync`:
   - Step 1: lock the program rows (`tPrograms`, `tProgramRevisions.Status`, `tProgramStages`).
   - Step 2: run eligibility. Approved, progressed and live projects refuse here, without touching the project tables.
   - Step 3: only if Eligible, lock the project rows (`tProjects`, `tProjectRevisions.IsDeleted`, `tProjectStages`). By then they are only leftovers, so the lock set is small.
   - Step 4: re-check "no live project" under that lock (`TOP 1 … WITH (UPDLOCK, HOLDLOCK) … IsDeleted = 0`).
   - Then leftovers and PASS 4 as today. The current `LockProgramForDeletionSql` splits into two constants.
4. **Single-project deletes decide on locked rows** (finding 1, old risk #3; READ_COMMITTED_SNAPSHOT is ON on the UAT copy).
   - New `ProjectHelper.LockProjectForDeletionSql`: UPDLOCK/HOLDLOCK on the inputs of `GetProjectDeletionTier.sql` for one project. Those are its `tProjects` row (`IsPublished`, `ParentProjectId`, `ProjectType`), its `tProjectStages` rows under the program, and the program's `tProgramStages` / `tProgramRevisions.Status`.
   - Both forms of `ExecuteProjectDeletionAsync` (EF, ISqlExecutor) run it before re-reading the tier.
   - Soft deletes get the same in-transaction decision:
     - `BatchDelete`'s soft path re-reads each soft candidate's tier under the lock. Anything no longer `Soft` refuses the whole batch with its reason.
     - `DeleteLumpSum`'s soft branch does the same.
   - One helper serves all of these: `ProjectHelper.DecideProjectDeletionUnderLockAsync`. The tier script stays the single rule (criterion 2.1).

### B. Program eligibility matches what can actually be done (findings 4, 5)
5. **`GetProgramDeletionEligibility.sql`** (Step 2, still only for programs not Approved and not progressed):
   - **Live = what Batch Delete can act on.** `LiveProjects` = projects with an `IsDeleted = 0` revision linked by a `tProjectStages` row at the program's **current stage**, the same join as `ProgramController.ResolveBatchDeleteAsync` (`liveAtStage`). This fixes finding 5: the refusal no longer points to Batch Delete for a project it can't see.
   - **New `StuckLeftovers` count and first example `StuckExample`:** linked projects with no live revision there that the delete could never remove. Any of:
     - published;
     - no `tProjectStages` row under the program (tier would be `Soft`, "no stage history");
     - `tProjects.ProgramFK` is this program and another program has its history (PASS 3.5 would refuse).
   - **New rule after LiveProjects:** `Blocked`, `BlockedBy = 'StuckLeftovers'`, Reason "N deleted project(s) left in it cannot be removed automatically (e.g. X); an administrator must clean them up".
   - The server still decides (PASS 2 / 3.5 unchanged); this only stops the list and the server disagreeing. Header updated.
6. **`ProgramHelper.ProgramDeletionEligibilityResult`** gains `StuckLeftovers` and `StuckExample`; `RefusalMessage` handles `BlockedBy = "StuckLeftovers"`.

### C. Robustness and cost (findings 6, 7, 8)
7. **Finding 6: no `new SqlExecutor()` against the wrong database.** In `ProjectHelper` (L760, L835), use `new SqlExecutor(db.Database.GetConnectionString())`, so tier reads hit the DbContext's own database. Main's constructor already takes a connection string.
8. **Finding 7:** in `ProgramController.ShowProgram`, catch `Exception ex when ex is not OperationCanceledException` around the optional eligibility, and log it.
9. **Finding 8: one tier query per batch, not one per id.**
   - `GetProjectDeletionTier.sql` takes `@ProjectRefs` (JSON array, `OPENJSON`) and returns its existing columns for every ref.
   - `DetermineProjectDeletionTiersAsync` makes one call per batch (PreviewBatchDelete, BatchDelete, restore resolution).
   - The single-ref overloads pass a one-element array.
   - Delete Program PASS 2 makes one call for all leftovers. PASS 3 deletes each through a "decided" path that reuses the PASS 2 row, which is safe because the rows are locked. That removes the second tier read.

### D. Tests and stale text (findings 9, 10)
10. **Finding 9: disabled HTTP tests show as Skipped, not Passed.** New `MYPS.ApiIntegrationTests/LocalDatabaseFactAttribute : FactAttribute` sets `Skip` when `MYPS_HTTP_TEST_MYPSDB` is unset (xunit 2.5.3, no new package). The HTTP tests use it, and the `if (!_fixture.Enabled) return;` lines go.
11. **Finding 10: one copy of the current-status rule.**
    - The `OUTER APPLY` that resolves current status stays in each script, because scripts can't include each other and `vProgramLatest` counts every project (too slow for this).
    - A new DB test, `CurrentProgramStatus_IsResolvedIdenticallyInEveryScript`, extracts that block from `GetProjectDeletionTier.sql`, `GetProgramDeletionEligibility.sql` and `ExecuteProgramDeletion.sql`, and asserts they are identical, so they can't drift.
    - Fix the stale `ExecuteProgramDeletion.sql` header (it still describes the per-child cascade) and the `Main.csproj` comment that says "the apply-sql-objects command reads them".

## Files (main ones)
- **Main's file:** `Helpers/SqlExecutor.cs`, rollback only.
- **Helpers:** `Helpers/ProgramHelper.cs`, `Helpers/ProjectHelper.cs`.
- **WebAPI:**
  - `WebAPI/Controllers/Programs/ProgramController.cs` (BatchDelete, BatchAddExistingProject, DeleteProgram, ShowProgram);
  - `WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs`.
- **SQL:** `Main/Resources/Internal/SQLObjects/Functions/GetProgramDeletionEligibility.sql`, `GetProjectDeletionTier.sql`, `Stored Procedures/ExecuteProgramDeletion.sql`; `Main/Main.csproj` (comment).
- **Tests:**
  - `MYPS.DatabaseTests/ProjectDeletionTierTests.cs`: app lock; Approved refusal takes no project locks; stuck leftovers flagged; live definition; set-based tiers; status-block identity;
  - `MYPS.ApiIntegrationTests` (new attribute, HTTP tests);
  - `e2e/tests/program-hard-delete-policy.spec.ts`: a case for a stuck leftover → list reason.
- **Docs:** `documents/docs/RELEASE_DELETE_POLICY.md` (409 / "try again", the administrator case), new `documents/plans/delete-policy-review-fixes.md`.

## Checked against the criteria
- **1 (hard delete only on first stage, soft after):** unchanged.
- **2.1 (one point of validation):** stronger. Hard and soft deletes decide on locked rows through one helper. "Live" means the same thing to the list, Delete Program and Batch Delete. The status block is test-enforced identical.
- **2.2 (BP/P prefix):** unchanged; the JSON array keeps per-ref resolution.
- **3 (itemized children always hard-deleted):** unchanged.

## Verification
0. **Localhost only.** Revert snapshot `_snap_t9`, diff the counts against `baseline_t9_counts.txt`, drop it. Confirm the MYPSDb target in source and bin.
1. **Build and tests:**
   - `dotnet build`; `MYPS.UnitTests`;
   - `MYPS.DatabaseTests` (`MYPS_TEST_SQL_SERVER=localhost`);
   - `MYPS.ApiIntegrationTests`: with the variable unset, the HTTP tests show as **Skipped**; with it set to localhost UAT, under snapshot `_snap_t10`, they run;
   - FE typecheck (no FE change expected);
   - `dotnet build-server shutdown`.
2. **Concurrency check by hand on localhost** (as before):
   - Session A holds Delete Program's Step-1 lock. A Batch Delete in the same program waits on the app lock and doesn't deadlock.
   - A refused delete on a large Approved program takes no `tProjects` locks (read `sys.dm_tran_locks` during the call).
3. **E2E under `_snap_t10`:** delete specs (program-hard-delete-policy, program-detail-batch-actions, batch-delete-restore-cross-stage, ls-program-approved, batch-restrict, project-form), then the full suite. Known non-branch failures expected. Revert, diff the counts, drop the snapshot.
4. **`/code-review`** of the diff against `origin/main`, then commit locally in logical commits.
   - No push: the rebased branch needs a force-push (`--force-with-lease`), which is the user's call, and mf1027 must reset.

## Completion Log
Date: 2026-10-16
Status: rounds 1 and 2 implemented and committed; round 3 open (see below).

- **Round 1 (the plan as written):**
  - main's `SqlExecutor.ExecuteTransactionAsync` no longer lets a failed rollback hide the real error;
  - per-program delete app lock (Exclusive in Delete Program; Shared in Batch Delete, Batch Restore, DeleteLumpSum and DeleteItemizedProject);
  - Delete Program locks program rows → eligibility → project rows → eligibility again, so a refused Approved delete locks no project row;
  - single-project deletes decide on locked rows;
  - `GetProjectDeletionTier.sql` takes a JSON array;
  - eligibility: live = Batch Delete's current-stage join, plus the new `StuckLeftovers` reason (administrator);
  - 409 on deadlock; ShowProgram catches everything except cancellation;
  - `ExecutorFor(db)` instead of `new SqlExecutor()`;
  - `[LocalDatabaseFact]` reports the HTTP tests as Skipped;
  - drift test on the current-status block; stale headers fixed.
- **Round 2 (from the review of round 1):**
  - a project with any live revision is never a removable leftover (it counts as stuck);
  - a deleted Lump Sum itemized child with no stage row is not stuck;
  - per-project lock order is project rows, then program rows;
  - FORCESEEK on `tProjects` only: on `tProjectStages` it fails outright without a ProjectFK index;
  - one locked batch decision for Batch Delete;
  - sp_getapplock -3 → 409; 409 in both Lump Sum deletes;
  - leftovers query guards on live revisions; app-lock comment corrected.
- **Tests:**
  - DB 110/110 (localhost); unit 37/37.
  - API 66/66 with the HTTP tests on (round 1, under snapshot `_snap_t10`), and 56 + 10 skipped with them off.
  - The full e2e on round 1 was stopped at 81/131 tests: 40 passed, 5 known non-branch failures, delete specs not reached. Round 2 was not built into the API or run in e2e.
- **Round 3 open (review of rounds 1+2):**
  1. two Batch Deletes in one program can deadlock (HOLDLOCK next-key ranges plus the project-then-program order);
  2. take the program lock inside `DecideProjectDeletionsUnderLockAsync`, not in 5 controllers;
  3. the public `DeleteDecidedProjectAsync` trusts any 'Hard' tier, and the tier header is stale;
  4. the locked decision can resolve a PK to another project through a BP/P collision;
  5. the Batch Delete soft re-check doesn't confirm the stage is still current;
  6. tProjectStages lock size depends on an index the runbook doesn't check;
  7. Batch Restore has no 409 path;
  8. Lump Sum deletes read the tier twice;
  9. the app-lock helper duplicates the Lump Sum lock helper;
  10. missing tests (the stuck-leftover e2e case, the 409 paths, the plan/lock race).
