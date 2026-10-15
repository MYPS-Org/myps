# Plan: Fix the release blockers on feat/program-project-hard-delete-policy (PR #255)

Status: Implemented
Created: 2026-10-15
Source: Release-blocker review of PR #255. User decisions: Approved program refuses every delete (Lump Sum itemized children exempt); Batch Delete server preview; audit row per project and per program; delete endpoints 503 until SQL objects are deployed; program-year gate DEFERRED.


## Context

The criteria review and e2e runs on PR #255 left eight release blockers. Product, items 1–4 and 8:
- no audit row for deletes;
- no Approved-program gate (83 programs and 90,668 projects on UAT can be deleted, 68 of them Approved);
- Batch Delete hard-deletes behind a dialog that doesn't say so;
- refusal reasons collapse into a generic `SqlServerFailure`;
- `GenerateTables.ps1` ships a plaintext `sa` password.

Deploy, items 5–7: the code and the SQL objects must ship together, the target needs compatibility level ≥ 130, and the deploying login needs DDL rights. No CI runs SQL today; objects ship only by hand (`Main.exe --apply-sql-objects --yes`).

User decisions (2026-10-15):
- **Approved program → every delete is refused**, soft or hard, Delete Program included. The **exception is Lump Sum itemized children**: they stay deletable (always hard) so import mistakes remain correctable. That keeps the 2026-09-09 rule and `ls-program-approved.spec`.
- **Program year gate: deferred** (2026-10-15, because of its side effects). Not in this plan; see *Deferred* at the end.
- **Batch Delete:** a server-side **preview** feeds the confirm dialog.
- **Audit:** one `tTransactionLog` row per deleted project, plus one per deleted program.
- **Missing or outdated DB objects:** the delete endpoints answer **503** with the fix command; the rest of the app runs.

The plan has two sections and two tasks. **Task 1** fixes the product blockers in code. **Task 2** makes the deploy blockers impossible to miss and documents the release steps.

---

## Task 1 — Address the product blockers

### 1.1 The Approved gate lives in the single rule
Both functions are in `Main/Resources/Internal/SQLObjects/Functions/`.

**Shared program context.** Add one `CROSS APPLY` per function:
- the program's **current stage row**: `tProgramStages` joined to `tOptionProgramStage` and ordered by `StageHierarchy DESC, ps.Id DESC`, the same ordering `vProgramLatest` uses;
- from that row, `tProgramRevisions.Status` via `RevisionId`.

Compare `Status` as the int code (`EnumProgramStatus.Approved = 1`), not the name. Before coding, confirm the current-revision choice against the live `vProgramLatest` with `OBJECT_DEFINITION` or `SQLScripts/whats-live.ps1`; the repo only holds the pre-split-brain backup.

**`fProjectDeletionTier`** — new tier order, first match wins:
1. Published → **Blocked** "published".
2. Kind = LSChild → **Hard** (exempt from the Approved gate).
3. Program Approved → **Blocked** "program is approved".
4. StageCount = 1 → **Hard**.
5. Otherwise → **Soft**.

**`fProgramDeletionEligibility`** gains an Approved **Blocked** reason and returns a `Reason` column.

**The stored procedures.**
- `pExecuteProgramDeletion` uses the eligibility `Reason` in its error. Today it hardcodes "progressed beyond its initial stage".
- The rest is enforced automatically: `pExecuteProgramDeletion` Pass 2 and `pExecuteProjectDeletion` already refuse anything not Hard, and Batch Delete already refuses Blocked.

**C# side.**
- `DeleteProgram` uses `Reason` from the function and drops its own message.
- The Lump Sum `AssertProgramNotApprovedAsync` gate (GAA-R only) stays as the module's own wording; the function is now stricter (any stage).

### 1.2 Refusal reasons reach the user
Follow the existing precedent: `PROJECTID_RANGE_EXHAUSTED:` → `ProjectIdRangeExhaustedException` (`Helpers/ProjectHelper.cs:235`).

- **SQL:** every refusal `RAISERROR` in the three procedures starts with the token `DELETE_REFUSED: ` and carries a plain-language reason. Drop the `pExecuteXxx:` prefixes from the user-facing text.
- **`Helpers/ProjectHelper.cs` + `ProgramHelper.cs`:**
  - Add `DeletionRefusedException(string reason)`.
  - All four wrappers (EF `ExecuteProjectDeletionAsync`, Dapper `ExecuteProjectDeletionAsync`, `ExecuteProgramDeletionAsync`) `catch (SqlException ex) when (ex.Message.Contains("DELETE_REFUSED:"))` and rethrow it typed.
- **Controllers:** `DeleteProgram`, `BatchDelete`, `DeleteLumpSum` and `DeleteItemizedProject` add `catch (DeletionRefusedException ex)` before the generic catch. It rolls back if a transaction is open and returns 400 `{ Title = "Delete Not Allowed", Message = ex.Reason }`.
- **`ExceptionHandler` is not changed.**
- This fixes e2e case (c).

### 1.3 Audit trail — one row per project, one per program
Written **in the same transaction as the delete**.
- **Hard deletes, in SQL:**
  - `pExecuteProjectDeletion` inserts one `tTransactionLog` row before removing the project:
    - `ReferenceId` = ProjectPK
    - `TransactionType` = `'Delete'`
    - `AffectedTable` = the cascade's table list
    - `AffectedColumn` = `'Row'`
    - `OldValue` = a JSON snapshot: the revision ProjectIds per stage, Kind, StageCount, Reason
    - `NewValue` = `'Permanently deleted'`
    - `CreatedBy` = `@UserId`, `CreatedDate` = `@CurrentDate`, `Hostname` = `HOST_NAME()`
  - `pExecuteProgramDeletion` adds one row for the program (`ReferenceId` = ProgramPK; `OldValue` = name, StartYear, stage, child count).
  - This puts the unused `@UserId` and `@CurrentDate` parameters to work. Confirm the live `tTransactionLog` columns and nullability first; the EF model `DBHelper/Models/Table/TransactionLog.cs` is the reference, the schema dump is stale.
- **Soft deletes, in C#:**
  - `BatchDelete` adds one row per soft-deleted project inside its existing transaction: `ReferenceId` = ProjectPK, `AffectedTable` = `tProjectRevisions`, `AffectedColumn` = `IsDeleted`, false→true, with the revision Id and stage in `OldValue`.
  - `DeleteLumpSum`'s soft branch does the same.
  - `BatchAddExistingProject` (restore) logs true→false. It logs nothing today.
- Fixes e2e case (g), which will be tightened to assert one row per project.

### 1.4 Batch Delete preview + honest dialogs
**Backend (`WebAPI/Controllers/Programs/ProgramController.cs`):**
- Extract `BatchDelete`'s resolution (tiers, current-stage liveness, refusals, duplicates, missing) into one private `ResolveBatchDeleteAsync`.
- New read-only `[HttpPost] PreviewBatchDelete` returns the plan: `HardProjectIds`, `SoftProjectIds`, `RefusedProjects` (with Reason) and `MissingProjectIds`. It writes nothing.
- `BatchDelete` executes the same plan.
- **New action needs a grant**, or `[PermissionFilter]` 403s it. Add a by-name registration and grant script in `Main/Resources/Internal/SQLScripts/` (pattern: Lump Sum migration Part 7). It grants `PreviewBatchDelete` to every group that holds `BatchDelete`. It is a release step (Task 2).

**Frontend (`FE/src/pages/Program/`):**
- `Service.ts` gets `previewBatchDelete`; `Model.d.ts` gets the preview type and the new `BatchActionResponse` fields.
- `dialogs/BatchTagDialog.tsx` (delete action): on submit, call the preview, then open the confirm dialog with it. Make `onSubmit` awaitable so the dialog doesn't close before the API answers.
- `dialogs/ConfirmDialogBatch.tsx` gets an optional `preview` prop. Render groups with counts in place of the client-side chips:
  - "Permanently deleted (first stage entry)";
  - "Deleted at this stage (restorable)";
  - "Refused" (with reasons);
  - "Not found".
- Message and banner by case:
  - **Any hard:** "permanently delete N projects — cannot be undone"; the DELETE word is required.
  - **Only soft:** "remove N projects from this stage; they can be restored"; DELETE is still required.
  - **Nothing actionable:** show the reasons and disable confirm.
- `components/programDetail/BatchActionsDropdown.tsx`: the success toast summarises the hard and soft counts from the response.
- `dialogs/DeleteProgramDialog.tsx`:
  - Restore the commented-out impact warning using `NumberOfProjects`: "N projects will be permanently deleted".
  - Add the FE/CLAUDE.md fallback toast in the catch.
- `Views/Program.tsx:257`: disable the Delete button with a tooltip when `Status === 'Approved'`. The server stays the authority.

### 1.5 `GenerateTables.ps1` credentials
- **`Main/Resources/Internal/SQLObjects/GenerateTables.ps1`:** remove the hardcoded server, user and password fallbacks. Require `MYPS_DB_*` env vars and exit 1 with a usage message when any are missing.
- **`Main/Main.csproj`:** `Content Remove` for `Resources\Internal\SQLObjects\GenerateTables.ps1`, `GenerateTableDDL.template.sql`, `Tables\**` and `README.md`, so none reach `bin` or publish. Keep `Functions\**` and `Stored Procedures\**`, which the deployer reads from the build output.
- Note for the PR: rotate the exposed dev `sa` password. That's an ops task, not code.

### 1.6 Tests (Task 1)
**`MYPS.DatabaseTests/ProjectDeletionTierTests.cs`** — extend:
- Add `tProgramStages`/`tProgramRevisions.Status` and `tOptionProgramStage` to the fixture schema.
- Cases:
  - Approved program → ordinary Blocked, LS child Hard;
  - program eligibility Reason;
  - refusal text starts with `DELETE_REFUSED:`;
  - one `tTransactionLog` row per hard-deleted project, plus the program row, rolled back with the delete on failure.
- Add a `tTransactionLog` table with the live columns.

**`e2e/tests/program-hard-delete-policy.spec.ts`:**
- (c) expects "published" in the message.
- (d) flips: Approved → 400 "approved".
- (g) asserts per-project rows.
- New cases: preview endpoint returns hard/soft/refused groups and writes nothing; soft delete and restore each log a row.

**`e2e/tests/program-detail-batch-actions.spec.ts`:** case 3 batch-deletes inside the Approved fixture program, which is now refused. Do the delete assertion after `restore()` (Working), or assert the dialog shows "Refused: program is approved" and no table re-query.

**UI:** a new narrated check that the confirm dialog shows the hard/soft groups before DELETE.

---

## Task 2 — Address the deploy blockers

### 2.1 Preflight in the deployer (catches items 6 + 7 before anything changes)
`Helpers/SqlObjectDeployer.ApplyAsync` — insert before the dry-run return (~line 84), so the **dry run reports it too**.

Read-only checks, printed as a checklist:
- `compatibility_level` ≥ 130 (`OPENJSON`);
- `SERVERPROPERTY('ProductMajorVersion')` ≥ 14 (`STRING_AGG`);
- `HAS_PERMS_BY_NAME(db, 'DATABASE', 'CREATE FUNCTION' / 'CREATE PROCEDURE' / 'CREATE VIEW')`;
- `HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER')`.

Any failure → exit 1 and nothing is applied, even with `--yes`.

Tests: `SqlObjectDeployerTests` gets a case with a login lacking ALTER (a low-privilege user in the throwaway DB) → preflight fails, nothing applied. Plus a compatibility-level case: `ALTER DATABASE … SET COMPATIBILITY_LEVEL = 120` on the throwaway DB.

### 2.2 Delete endpoints answer 503 until the objects are deployed (item 5 safety net)
- **New `Helpers/DeletionObjectsStatus.cs` (singleton):**
  - `CheckAsync` reads `sys.objects` for the four objects and `sys.columns` for the functions' expected columns (`Ref`, `MatchedBy`, `Kind`, `Reason`, and the new gate columns).
  - It also checks the compatibility level.
  - It caches **ready**; while not ready, it re-checks at most every 30 s, so applying the objects later recovers without a restart.
  - It logs one error at startup when not ready.
- **`Main/Program.cs`:** register the singleton and kick an initial check after `builder.Build()`. Use the existing eager-validation style; see the `ReportService:BaseUrl` check at :121-128.
- **New action filter `[RequiresDeletionObjects]`** (WebAPI) on `DeleteProgram`, `BatchDelete`, `PreviewBatchDelete`, `BatchAddExistingProject`, `DeleteLumpSum` and `DeleteItemizedProject`. While not ready it returns 503 `{ Title: "Delete Unavailable", Message: "Database objects for deletion are not deployed. Run Main.exe --apply-sql-objects --yes on this environment." }`.
- **Tests:** `MYPS.ApiIntegrationTests` — a not-ready status gives 503 on the six actions, and other actions are unaffected.

### 2.3 Release order and runbook (items 5–7)
Verify, then document: the new objects only **add** columns and `SELECT *` mapping ignores extras. So **applying the objects before the build** is safe for the old code. Prove it by running the old build against the new objects in a localhost check. The release order then has no 500 window.

**New `documents/docs/RELEASE_DELETE_POLICY.md`, linked from the PR and from `SQLObjects/README.md`.** It covers:
1. **Before release,** on the target server, from the new build's output with the target's environment: `$env:ASPNETCORE_ENVIRONMENT='Production'` (or `Staging`); `Main.exe --apply-sql-objects`. Check the server, database and preflight checklist it prints.
2. **If preflight fails on permissions:** run the command once with a DDL-capable login, overriding only for that run: `$env:ConnectionStrings__MYPSDb='…'`. The app's own login is unchanged.
3. `Main.exe --apply-sql-objects --yes`, then run the RBAC script for `PreviewBatchDelete` (from 1.4).
4. **Publish the build** (existing Web Deploy profiles).
5. **Smoke:** the API log shows "deletion objects ready". `POST /api/Program/PreviewBatchDelete` on a known program answers 200, not 503. The Delete Program button is disabled on an Approved program. A consistency query returns 0 programs where the delete gate's Approved disagrees with `vProgramLatest.Status`.
6. **Rollback:** objects are `CREATE OR ALTER`. Re-applying the previous release's `SQLObjects` folder (from its build output) restores them. Redeploying the previous build alone also works, because the new objects are backward compatible.

**PR #255 description:** replace "Deploy steps" with a link to the runbook. List the RBAC script and the password rotation as release tasks.

### 2.4 Tests (Task 2)
- Deployer preflight cases (2.1).
- 503 filter integration tests (2.2).
- **One localhost end-to-end rehearsal of the runbook on `myps_db_migrated_uat`** under a snapshot:
  - old build + new objects works;
  - new build without objects gives 503 on the delete endpoints only;
  - after `--apply-sql-objects --yes`, the delete endpoints recover without a restart.

---

## Files (main ones)
- **SQL:**
  - `SQLObjects/Functions/fProjectDeletionTier.sql`, `fProgramDeletionEligibility.sql`;
  - `SQLObjects/Stored Procedures/pExecuteProjectDeletion.sql`, `pExecuteProgramDeletion.sql`;
  - a new `SQLScripts/Permissions.PreviewBatchDelete.<date>.sql`.
- **C#:**
  - `Helpers/ProjectHelper.cs`, `ProgramHelper.cs`, `SqlObjectDeployer.cs`, new `DeletionObjectsStatus.cs`;
  - `WebAPI/Controllers/Programs/ProgramController.cs`, `Lumpsum/LumpsumController.Itemization.cs`, a new filter attribute;
  - `Main/Program.cs`, `Main/Main.csproj`.
- **FE:** `FE/src/pages/Program/{Service.ts, Model.d.ts, dialogs/BatchTagDialog.tsx, dialogs/ConfirmDialogBatch.tsx, dialogs/DeleteProgramDialog.tsx, components/programDetail/BatchActionsDropdown.tsx, Views/Program.tsx}`.
- **Script:** `GenerateTables.ps1`.
- **Tests:** `MYPS.DatabaseTests` (tier, deployer), `MYPS.ApiIntegrationTests` (503), e2e specs above.
- **Docs:** `documents/docs/RELEASE_DELETE_POLICY.md`, `SQLObjects/README.md`, `e2e/CLAUDE.md`.

## Risks
- **Approved at any stage now blocks Lump Sum parent deletes too.** Today that's GAA-R only; it's stricter, and `ls-program-approved` asserts only the GAA-R case. Re-run it.
- **The "current revision" for Status must match the live `vProgramLatest`**, or the gate disagrees with the badge users see.
  - Status is stored per revision (`tProgramRevisions.Status`). A stage advance stamps the revision it leaves Approved and starts a Working one. Which revision is "current" is derived, not stored.
  - Measured on localhost `myps_db_migrated_uat` (2026-10-15), 103 programs, 82 shown Approved:
    - the planned **stage pick** (highest `StageHierarchy`, then `tProgramStages.Id`, then its `RevisionId`) agrees with the UI on **all 103**;
    - a naive **highest revision Id** pick disagrees on **6**. All six are GAA-R programs the UI shows Approved, whose newest revision row is Working, e.g. "GAA 2025 SSP" and "GAA 2026 OO-1".
  - **Mitigation, in scope for 1.1:**
    - use the stage pick, or join `vProgramLatest` itself;
    - add a release smoke query (Task 2.3, step 5) asserting 0 programs where the gate's Approved ≠ `vProgramLatest.Status`;
    - add a DB-test case where the newest revision is Working but the current-stage revision is Approved → Blocked.

## Verification
1. `dotnet build`; `MYPS.UnitTests`; `MYPS.DatabaseTests` (throwaway DBs); `MYPS.ApiIntegrationTests` with localhost connection overrides; FE `npm run typecheck` (no new errors beyond the 21 pre-existing Rbac ones).
2. Localhost `myps_db_migrated_uat` only, under a snapshot:
   - run the runbook rehearsal (2.4);
   - run the full Playwright suite on an isolated API on `:5025` and Vite on `:8081`;
   - expect (c), (d) and (g) to pass with the new expectations and the batch-actions spec to be 3/3;
   - revert the snapshot, verify counts against the baseline, drop the snapshot.
3. `/code-review` of the diff. Update the PR #255 description.

## Deferred — program year gate (removed 2026-10-15 for its side effects; implement later)

**Requested rule:** no delete, soft or hard, once a program's year has passed. It applies to every path, Lump Sum itemized children included. Agreed definition: refused when `tPrograms.StartYear + 1 < current year`, one year of grace. `StartYear` is the only program year stored.

**Where it would go:** one more **Blocked** branch in `fProjectDeletionTier`, after "published" and before the Lump Sum child Hard rule, with Reason "program year {StartYear} has passed". The same reason goes in `fProgramDeletionEligibility`. Delete Program's button would be disabled on the same condition.

**Side effects that deferred it:**
- **Scale:** in 2026 it locks every program with StartYear ≤ 2024. On UAT that's 34 programs, growing every January.
- **No escape hatch:** itemized children of past-year programs could no longer be corrected.
- **Fixtures age out:** e2e fixtures created "this year" (the cross-stage and approval fixture programs, which persist) become undeletable two years on, so their flows break in 2028. They would need to record their year and self-skip.
- **Clock and timezone:** which clock decides the year (SQL `GETDATE()` vs app `Functions.CurrentDate()`) and timezone alignment are unsettled. The gate flips at midnight on 1 January.

**Open before implementing:** an override path (for example admin-only), whether restore is also gated, and fixture handling.

## Completion Log — Task 1
Date: 2026-10-15
- Implementation (Task 1, sections 1.1–1.6):
  - **1.1 Approved gate.** `fProgramDeletionEligibility` returns `CurrentStatus` + `Reason` and blocks Approved programs. `fProjectDeletionTier` blocks every project of an Approved program except Lump Sum itemized children. Current status = the current stage row's revision, verified identical to the live `vProgramLatest`.
  - **1.2 Refusal messages.** Refusals carry a `DELETE_REFUSED:` token with a plain reason. `ProjectHelper.DeletionRefusedException` comes from all wrappers and is caught by DeleteProgram, BatchDelete, DeleteLumpSum and DeleteItemizedProject, returning a 400 with the reason.
  - **1.3 Audit trail.** Hard deletes write one `tTransactionLog` row per project (JSON snapshot) plus one per program, from the procedures, in the same transaction. Soft delete, restore and the Lump Sum soft delete write rows via `AddSoftDeleteAuditRows`.
  - **1.4 Preview.** `PreviewBatchDelete` shares `ResolveBatchDeleteAsync` with BatchDelete. Permission script `SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql`. FE: preview before confirm; grouped confirm dialog whose wording follows the preview and whose confirm is disabled when nothing is deletable; Delete Program impact warning plus fallback toast; Delete button disabled for Approved programs.
  - **1.5 Credentials.** `GenerateTables.ps1` requires `MYPS_DB_*` env vars; `Main.csproj` excludes tooling, `Tables\` and the README from build/publish.
- Tests:
  - .NET: `MYPS.DatabaseTests` 72/72 (6 new); `MYPS.UnitTests` 37/37; `MYPS.ApiIntegrationTests` 52/52; FE typecheck adds no errors (21 pre-existing Rbac).
  - e2e on localhost `myps_db_migrated_uat` under a snapshot: 51 passed / 11 failed / 7 skipped / 36 not run, 0 permission 403s.
    - `program-hard-delete-policy` 12/12 (new k, l), `program-detail-batch-actions` 3/3, `ls-program-approved` 5/5.
    - The 11 failures are all known non-branch causes: 8 Lump Sum (HGAB stage data on this DB), 1 flaky dashboard, 2 report-job (other work).
  - Snapshot reverted; counts match the baseline on 108 tables.
- Documentation: SQL object headers; XML docs; `e2e/CLAUDE.md` coverage row.
Deviations / flags:
- The BatchActionsDropdown success toast is unchanged: the server Message already carries the hard/soft counts. `BatchTagDialog.onSubmit` is left fire-and-forget (results go to the toast).
- The UI preview check is an assertion in `program-detail-batch-actions` case 1, not a separate narrated spec.
- DB test fixtures fixed: SQL Server defers missing tables but not missing columns, and `InitializeAsync` now drops its database when setup fails (21 throwaway DBs had leaked; all dropped).
- **INCIDENT:** a stash during the user's rebase reverted `appsettings.Development.json`. `--apply-sql-objects --yes` then overwrote the four objects on SHARED 192.168.50.200/myps_db_dev at 08:42. The user chose to restore the 4a97caf1 versions (done 08:47, verified). Memory rule strengthened: check the target before every DB step.
- Code-review findings NOT fixed (reported for decision):
  - (1) the Batch Delete soft path doesn't re-check the tier inside the transaction (Approved race);
  - (2) Batch Delete hard-depends on the `PreviewBatchDelete` grant;
  - (4) the empty-program Approved race in `pExecuteProgramDeletion`;
  - (5) soft audit rows can overcount on overlapping requests;
  - (6) the permission script's `RAISERROR` doesn't stop the commit;
  - (7–8) the current-status lookup is duplicated 3×, per row;
  - (9–10) minor cleanup.
Files changed:
- `SQLObjects/Functions/{fProgramDeletionEligibility,fProjectDeletionTier}.sql`, `SQLObjects/Stored Procedures/{pExecuteProgramDeletion,pExecuteProjectDeletion}.sql`, `SQLObjects/GenerateTables.ps1`, `SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql` (new)
- `Helpers/{ProjectHelper,ProgramHelper}.cs`, `WebAPI/Controllers/Programs/ProgramController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs`, `Main/Main.csproj`
- `FE/src/pages/Program/{Model.d.ts,Service.ts,Views/Program.tsx,dialogs/BatchTagDialog.tsx,dialogs/ConfirmDialogBatch.tsx,dialogs/DeleteProgramDialog.tsx}`
- `MYPS.DatabaseTests/{ProjectDeletionTierTests,SqlObjectDeployerTests}.cs`, `e2e/tests/{program-hard-delete-policy,program-detail-batch-actions}.spec.ts`, `e2e/CLAUDE.md`

## Completion Log — Task 2
Date: 2026-10-15
- Implementation:
  - **2.1 Preflight.** `SqlObjectDeployer.PreflightAsync`, read-only, runs in the dry run too. It prints a checklist: compatibility level >= 130 (OPENJSON), SQL Server major >= 14 (STRING_AGG), CREATE FUNCTION / PROCEDURE / VIEW, and ALTER on dbo. Any failure throws, exits 1, and nothing is applied.
  - **2.2 503 safety net.** `Helpers/DeletionObjectsStatus.cs` (`IDeletionObjectsStatus`, a singleton) probes `sys.columns` for the columns this build reads, the procedures for the `DELETE_REFUSED:` marker, and the compatibility level. It caches "ready" and re-checks every 30 s while not ready. `WebAPI/Controllers/RequiresDeletionObjectsAttribute.cs` returns 503 "Delete Unavailable" (with the problem and the fix command) on DeleteProgram, PreviewBatchDelete, BatchDelete, BatchAddExistingProject, DeleteLumpSum and DeleteItemizedProject. Registered in `ServiceRegistration`; `Program.cs` checks once at startup (logs, never fatal) except under the Testing environment.
  - **2.3 Release order and runbook.** Release order checked: `main` has 0 references to the four objects, so applying them before publishing is safe by construction. The runbook is `documents/docs/RELEASE_DELETE_POLICY.md` (dry run / target check, preflight, DDL-login fallback, apply, permission script, publish, smoke incl. the gate-vs-badge consistency query, rollback). The SQLObjects README links it.
- Tests:
  - `MYPS.DatabaseTests` 81/81 (+9): `DeletionObjectsStatusTests` (7: missing / older function / older procedure / compat 120 / recovers without restart / caches within interval / ready after apply) and 2 deployer preflight cases (compat 120 refuses even the dry run; a login without DDL rights refuses and applies nothing). The temporary localhost login is dropped in `finally`.
  - `MYPS.ApiIntegrationTests` 56/56 (+4): filter 503 vs pass-through; exactly the six delete actions are guarded; the status resolves under Testing without opening a connection.
  - `MYPS.UnitTests` 37/37.
- **2.4 Rehearsal** on localhost `myps_db_migrated_uat`, under a snapshot, with the target checked before every DB step:
  - new build with no objects: startup log "NOT ready" naming all four; the delete endpoints answered 503, PreviewBatchDelete 403 (grant not yet run), ShowProgram 200;
  - dry run (6/6 preflight ok) → `--yes` → permission script (0-row check);
  - the same API process, not restarted, logged "ready" within 30 s; PreviewBatchDelete 200, BatchDelete normal 400 for an unknown id;
  - `program-hard-delete-policy` + `program-detail-batch-actions` 15/15 against it;
  - snapshot reverted; counts match the baseline on 108 tables.
- Documentation: `RELEASE_DELETE_POLICY.md` (new), SQLObjects README, `e2e/CLAUDE.md` coverage row (503 note).
Deviations / flags:
- The plan's "old build + new objects" check was done by evidence instead of running an old build: production code (`main`) never calls the objects. This branch's earlier commits are not deployed anywhere except shared dev, which was restored to its 4a97caf1 versions.
- The `PreviewBatchDelete` 403 before the grant is expected and documented (runbook step 4); code-review finding 2 from Task 1 (Batch Delete depends on that grant) is still open.
- The startup probe is skipped under `ASPNETCORE_ENVIRONMENT=Testing`: that environment falls back to the base appsettings.json connection, which must never be dialled.
- The PR #255 description still needs its deploy section pointed at the runbook (can't edit the PR from here).
Files changed:
- `Helpers/SqlObjectDeployer.cs`, `Helpers/DeletionObjectsStatus.cs` (new), `WebAPI/Controllers/RequiresDeletionObjectsAttribute.cs` (new)
- `WebAPI/Controllers/Programs/ProgramController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs` (attributes only)
- `Main/ServiceRegistration.cs`, `Main/Program.cs`
- `MYPS.DatabaseTests/{DeletionObjectsStatusTests (new),SqlObjectDeployerTests}.cs`, `MYPS.ApiIntegrationTests/RequiresDeletionObjectsTests.cs` (new)
- `documents/docs/RELEASE_DELETE_POLICY.md` (new), `Main/Resources/Internal/SQLObjects/README.md`, `e2e/CLAUDE.md`, this plan
