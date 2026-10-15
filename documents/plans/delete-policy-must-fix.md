# Plan: Must-fix items for PR #255 (feat/program-project-hard-delete-policy)

Status: Implemented
Created: 2026-10-16
Source: code review + risk analysis + criteria check (1, 2.1, 2.2, 3) of the rebuilt branch (84ff5cc6). User decisions 2026-10-16: keep --apply-sql-objects but make it honest; route DeleteLumpSum's Approved refusal through the tier; criterion 3 'free up the ID' = no row holds it (met).


## Context
The code review and risk analysis of the rebuilt branch (local tip `84ff5cc6`, not pushed) left three must-fix items before merge:
1. **Program delete race.** Child tiers are checked before the transaction and never re-checked inside it, so a child approved, published or advanced in between is still hard-deleted. A leftover child also gives a 500 instead of a refusal.
2. **HTTP test fixture targets the shared DB.** It hardcodes `C:\Users\Msi\…`, reads the committed config (192.168.50.200 `myps_db_dev` as `sa`), writes users and grants there, and hardcodes `tApiActions` IDs.
3. **Docs and the 503 message describe the old compiled-objects design.** The runbook, the SQLObjects README and the 503 text send operators to `--apply-sql-objects`, which now deploys 0 files.

The criteria check (1, 2.1, 2.2, 3) added small 2.1 items: a misleading header in the tier script, a duplicate Approved check in DeleteLumpSum, and duplicated script-path constants.

User decisions (2026-10-16):
- **Deployer:** keep `--apply-sql-objects` and make it honest; no DDL demands when there is nothing to deploy.
- **DeleteLumpSum:** route its Approved refusal through the tier script, keeping the module's "Program Approved" wording.
- **Criterion 3 "free up the reserved ID":** means *no row holds it*, which is met today. No allocator change.

Constraints:
- Localhost `myps_db_migrated_uat` only. Check the effective `MYPSDb` before every DB step, and stop if it isn't localhost.
- Never stash; keep `FE/.env.development`, `Main/appsettings.Development.json` and `.claude/settings.json` out of commits.
- No push without asking.

---

## Item 1: Program delete re-checks inside its transaction
**File:** `Helpers/ProgramHelper.cs` (`ExecuteProgramDeletionAsync`, ~L223-330).

- **PASS 1 and 2 stay as they are**, outside the transaction. They are the fast pre-check that names every blocking child in one message, and they take no locks.
- **Inside `sql.ExecuteTransactionAsync((connection, transaction) => …)`**, in this order:
  1. **Lock.** One inline statement on `connection`/`transaction`. It decides nothing; it only stops the facts from changing until commit:
     - `UPDLOCK, HOLDLOCK` on `tProgramRevisions`, `tProgramStages`, `tProjects` and `tProjectStages` rows for `@ProgramFK`.
     - This blocks a concurrent approve or status change (`tProgramRevisions`), a stage advance (`tProgramStages`/`tProjectStages` inserts), a publish (`tProjects.IsPublished`) and a new child (`tProjects` insert).
     - A deadlock is possible; it rolls back the delete, so nothing is deleted wrongly.
  2. **Re-check the program.** Run `Functions/GetProgramDeletionEligibility.sql` again with the existing tx overload `ExecuteScriptFileInTransactionAsync<T>(file, params, transaction)`. Blocked or not found → `DeletionRefusedException` with its Reason.
  3. **Re-list the children** inside the transaction (`SELECT ProjectPK FROM dbo.tProjects WHERE ProgramFK = @ProgramFK`, same tx).
  4. **Delete each child** through the existing re-checking overload, `ProjectHelper.ExecuteProjectDeletionAsync(this ISqlExecutor, projectFK, programFK, userId, date, tx: transaction, ct)` (`Helpers/ProjectHelper.cs:883`). It runs `GetProjectDeletionTier.sql` in the transaction and throws `DeletionRefusedException` unless the tier is Hard. This replaces the direct `ExecuteProjectDeletion.sql` call, and the overload stops being dead code.
  5. **PASS 3.5:** a surviving child throws `ProjectHelper.DeletionRefusedException`, not `InvalidOperationException`, so the user gets 400 "Delete Not Allowed".
  6. **PASS 4** stays unchanged.
- **Script paths:** `ProgramHelper` uses `ProjectHelper.GetProjectDeletionTierScript` / `ExecuteProjectDeletionScript`, which are internal in the same assembly, instead of its own copies.
- **`WebAPI/Controllers/Programs/ProgramController.cs` `DeleteProgram` (~L501-532):**
  - Remove the duplicate pre-call to `DetermineProgramDeletionEligibilityAsync`; PASS 1 does it and throws the same refusal. Not-found is already handled by `ValidateProgramId`.
  - Fix the stale comment about `pExecuteProgramDeletion`.

## Item 2: HTTP test fixture is opt-in and local-only
**Files:** `MYPS.ApiIntegrationTests/DeletionEndpointsHttpFixture.cs`, `DeletionEndpointsHttpTests.cs`.

- **Connection string:**
  - Drop `ReadDevConnectionString()` and the `C:\Users\Msi` path.
  - Read the connection string from a new env var `MYPS_HTTP_TEST_MYPSDB`, which must name a database with the real schema, e.g. localhost `myps_db_migrated_uat`.
- **Unset → disabled:**
  - When the env var is unset, the fixture sets `Enabled = false` and touches nothing.
  - Each test starts with `if (!fixture.Enabled) return;`, following the precedent at `MYPS.DatabaseTests/SqlObjectDeployerTests.cs:167`. No new NuGet package.
- **Safety guard:** refuse, with a clear exception, any Data Source other than `localhost`, `.`, `(local)`, `127.0.0.1` or `(localdb)\…`. Same spirit as `MYPS.DatabaseTests/LocalDbSafety.cs`.
- **Action IDs:**
  - Look them up by `ControllerName`/`ActionName` in `tApiActions`, never by Id, as the PreviewBatchDelete permission script does.
  - Cover all 6 guarded actions: BatchDelete, DeleteProgram, PreviewBatchDelete, BatchAddExistingProject, DeleteLumpSum, DeleteItemizedProject.
  - Fail fast if any is missing.
- **Isolation:** save and restore the previous `ConnectionStrings__MYPSDb` value in `DisposeAsync`, and put the HTTP tests in a non-parallel `[Collection]`, so the env var doesn't leak into other test classes.
- **Header comment:** rewrite it. Remove "the REAL myps_db_dev".

## Item 3: Operator-facing text matches the script-file design
- **`WebAPI/Controllers/RequiresDeletionObjectsAttribute.cs`:**
  - New message: "The delete feature is unavailable on this server: its SQL script files are missing from the build, or the database is unreachable or below compatibility level 130. Redeploy the build and check the API log."
  - Drop `Detail = status.Problem` from the response body. `DeletionObjectsStatus` already logs the problem (`LogError`, L109).
  - Rewrite the doc comment, which still names `dbo.f*`/`dbo.p*`.
- **`Helpers/SqlObjectDeployer.cs` (keep it, make it honest):**
  - The dry run lists skipped files with the reason ("no CREATE batch — runtime script, not deployed").
  - With 0 deployable files it prints "Nothing to deploy." and **skips the DDL-rights and STRING_AGG preflight lines**. The compatibility level is still checked and printed. It exits 0.
  - Update the PreflightAsync comments that cite `pExecuteProgramDeletion`.
- **`documents/docs/RELEASE_DELETE_POLICY.md`** — rewrite the steps:
  1. Run `Migration.PreviewBatchDeletePermission.2026-10-15.sql`. Its last query must return 0 rows.
  2. Check the app login's rights with a `HAS_PERMS_BY_NAME` query: DELETE on every table the two delete scripts delete from (taken from `ExecuteProjectDeletion.sql`/`ExecuteProgramDeletion.sql`), plus INSERT on `tTransactionLog`. Ad hoc scripts no longer get ownership chaining. The query is in the doc.
  3. Compatibility level ≥ 130.
  4. Publish.
  5. Smoke: the log line `Deletion feature is ready (scripts on disk, database reachable).`; the Delete button disabled on an Approved program; the Batch Delete preview. Rewrite the consistency query inline (the current-stage `OUTER APPLY` from the tier script against `vProgramLatest`); it no longer calls `dbo.fProgramDeletionEligibility`.
  - **Rollback:** redeploy the previous build; nothing DB-side to undo. The permission row is harmless.
  - **Remove** the `--apply-sql-objects` steps and the "4 objects" table.
- **`Main/Resources/Internal/SQLObjects/README.md`:**
  - Explain that `Functions/` and `Stored Procedures/` hold **runtime scripts read by the API**, which are not deployed.
  - Keep the `--apply-sql-objects` section only for real `CREATE OR ALTER` objects, and state that there are none today.
- **Stale references:** sweep `dbo.fProjectDeletionTier`/`fProgramDeletionEligibility`/`pExecute*` from comments **in the files this plan touches**, plus `Main/ServiceRegistration.cs` and the `Main/Program.cs` startup comment.

## Item 4: Criterion 2.1 cleanups
- **`GetProjectDeletionTier.sql` header:** it claims `ExecuteProjectDeletion.sql` re-asks before removing. Correct it to say that every hard delete goes through `ProjectHelper.ExecuteProjectDeletionAsync` (EF or ISqlExecutor form), which re-runs this script inside the caller's transaction, and that `ExecuteProjectDeletion.sql` itself does not check.
- **`WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs` `DeleteLumpSum` (~L474-530):**
  - Remove the `AssertProgramNotApprovedAsync` call. `CreateLumpSum` keeps it, and its doc comment is updated to "one caller".
  - Move the tier lookup up, right after `AssertLumpSumVisibleAsync` and before the live-children check, so an Approved program is still reported first.
  - When `Tier == Blocked && ProgramApproved && !IsPublished`, call `ReadProgramApprovalAsync` **for wording only**:
    - non-null → return the module's `ProgramApprovedTitle` + `ProgramApprovedMessage("Deleting a Lump Sum Project", approval)`, which keeps `ls-contract.spec.ts:758-760` passing;
    - null → the existing "Cannot delete a Lump Sum Project in an Approved program…" text.
  - The published wording is unchanged.
  - **Side effect:** a published parent with live children is now refused as "published" before "still itemized". Both are refusals.

## Checked against the criteria
| Criterion | Effect of this plan |
|---|---|
| 1. Hard delete only on the first stage entry, soft after | Unchanged rule. Program delete now applies it to the **current** state, inside the transaction, instead of a pre-transaction snapshot. |
| 2.1 One point of validation | Strengthened. Every hard delete, program delete included, now re-runs `GetProjectDeletionTier.sql` inside its transaction through the one helper. The lock SQL decides nothing. DeleteLumpSum's duplicate Approved check is removed. One copy of each script path. The misleading header is fixed. Remaining refusals outside the script (LS parent with live children, Batch Delete's not-live-at-stage and Lump Sum-row refusals) scope the request, not hard vs soft; noted as accepted. |
| 2.2 Doesn't depend on the BP/P prefix | Unchanged. In-transaction calls pass the `ProjectPK` from `tProjects`; `ResolveTierRow` takes the PK's own row, so ambiguity can't arise there. Batch Delete's and Restore's ambiguity refusal is untouched. |
| 3. Lump Sum itemized children always Hard | Unchanged. `LSChild → Hard` is still checked before the Approved and stage-count rules, and the in-transaction re-check keeps it Hard. "Free up" = no row holds the ID; the hard cascade already guarantees it. |

## Tests
- **`MYPS.DatabaseTests/ProjectDeletionTierTests.cs`** (throwaway DBs, `MYPS_TEST_SQL_SERVER=localhost`):
  - **Re-check:** a child that is Hard at PASS 2 but changes before the transaction is refused, with nothing deleted. Make it deterministic by extracting the in-transaction part into an `internal` method `DeleteProgramInTransactionAsync(sql, programFK, …, connection, transaction)` (`InternalsVisibleTo` the test project, if not already set). Call it after flipping the child (publish it, add a 2nd stage row, approve the program); expect `DeletionRefusedException` and zero rows removed.
  - **Survivor:** a child kept by the multi-year guard throws `DeletionRefusedException`, and the transaction rolls back.
  - **Lump Sum:** an itemized child in an Approved program is still deleted (criterion 3 regression).
- **`MYPS.DatabaseTests/SqlObjectDeployerTests.cs`:** a folder with only runtime scripts → "Nothing to deploy", no DDL-rights lines, exit 0.
- **`MYPS.ApiIntegrationTests/RequiresDeletionObjectsTests.cs`:** expect the new message and **no** `Detail` in the body.
- **HTTP fixture tests:**
  - with `MYPS_HTTP_TEST_MYPSDB` unset → all return early;
  - set to localhost `myps_db_migrated_uat` under a snapshot → they pass, and the snapshot revert leaves nothing behind;
  - a non-local Data Source → refused.

## Verification
1. `dotnet build`, `MYPS.UnitTests`, `MYPS.DatabaseTests` (localhost), `MYPS.ApiIntegrationTests` (localhost connection overrides plus `MYPS_HTTP_TEST_MYPSDB` set to localhost uat). Then `dotnet build-server shutdown`.
2. `Main.exe --apply-sql-objects` dry run on localhost: "Nothing to deploy", only the compatibility line, exit 0.
3. Localhost `myps_db_migrated_uat` under snapshot `_snap_t5`:
   - baseline counts;
   - permission script;
   - API on :5025 and Vite on :8081;
   - run the delete specs: `program-hard-delete-policy`, `program-detail-batch-actions`, `batch-delete-restore-cross-stage`, `ls-program-approved`, and the Approved case in `ls-contract`. Then the full suite for regressions; the known non-branch failures (Lump Sum HGAB stage data, dashboard, report-job) are expected.
   - Then revert the snapshot, diff the counts, drop the snapshot, and restore `e2e/test-results/.last-run.json`.
4. `/code-review` of the diff, and re-check the four criteria.
5. Copy this plan to `documents/plans/delete-policy-must-fix.md` with a Completion Log. Commit in logical commits (item 1, item 2, items 3+4). **No push**: the branch is still waiting on the force-push decision and coordination with mf1027.

## Out of scope (noted, not done)
- Performance: per-project file read and connection, and caching the script text.
- `new SqlExecutor()` vs DI in the EF helpers.
- The sync `Rollback()` in `ExecuteTransactionAsync`.
- The readiness-guard timing (503 during the probe; ready cached forever).
- DeleteLumpSum soft-delete flagging every revision, vs Batch Delete flagging the current stage only (OD-3).
- The deferred program-year gate.

## Completion Log
Date: 2026-10-16
- **Implementation:**
  - **Item 1, program delete:**
    - `ProgramHelper.DeleteProgramInTransactionAsync` locks the program's rows (UPDLOCK, HOLDLOCK; every table is indexed on ProgramFK, so the range locks cover one program).
    - It re-runs program eligibility, re-lists the children, and deletes each child through the re-checking `ProjectHelper.ExecuteProjectDeletionAsync(ISqlExecutor, …, tx)`.
    - A surviving child (PASS 3.5) is now a `DeletionRefusedException`.
    - The duplicate script-path constants are gone.
    - `DeleteProgram` no longer runs eligibility a second time.
  - **Item 2, HTTP test fixture:**
    - Opt-in through `MYPS_HTTP_TEST_MYPSDB`; local servers only (a remote one is refused before connecting).
    - Action IDs looked up by name, all 6 guarded actions granted.
    - `ConnectionStrings__MYPSDb` restored on dispose.
    - With the variable unset, every test returns early.
  - **Item 3, operator-facing text:**
    - New 503 text, with no `Detail` in the body (the reason goes to the log).
    - The deployer lists the runtime scripts it skips; with nothing to deploy it says so, checks only the compatibility level, and exits 0.
    - Only CREATE [OR ALTER] FUNCTION/VIEW/PROCEDURE/TRIGGER counts as deployable, so `CREATE TABLE #tmp` stays a runtime script.
  - **Item 4, criterion 2.1:**
    - The tier script header is corrected.
    - `DeleteLumpSum` takes its Approved refusal from the tier, read before the live-children guard, and borrows the module's "Program Approved" wording on revision stages.
    - `AssertProgramNotApprovedAsync` now has one caller (CreateLumpSum).
- **Documentation:**
  - `RELEASE_DELETE_POLICY.md` rewritten: the permission script, a rights check for the app login (`HAS_PERMS_BY_NAME` per table), compatibility level, publish and confirm the scripts are in it, smoke check with an inline consistency query, rollback = redeploy.
  - SQLObjects `README.md` rewritten: runtime scripts vs deployable objects.
  - Stale comments fixed in `ServiceRegistration.cs`, `Program.cs` and `TestAuthHandler.cs`.
- **Tests:**
  - `MYPS.DatabaseTests`: 98/98 (localhost). 8 new: re-decide after a publish, after a stage advance and after an approval; survivor refusal with rollback; itemized child in an Approved program still Hard; nothing-to-deploy; two runtime-script `IsDeployableObject` cases.
  - `MYPS.UnitTests`: 37/37.
  - `MYPS.ApiIntegrationTests`: 66/66 with the HTTP tests disabled, and 66/66 with `MYPS_HTTP_TEST_MYPSDB` pointing at localhost `myps_db_migrated_uat` under a snapshot (the tGroups identity advanced by 20, so they really ran, and nothing was left behind). A remote Data Source is refused.
  - **E2E** (localhost, snapshot `_snap_t5`):
    - all 21 delete specs pass;
    - the `ls-contract` Approved GAA-R case passes on its own;
    - full suite: 49 passed, 13 failed. The failures are the known non-branch ones (8 Lump Sum HGAB stage data, 2 report-job, 1 dashboard bars), plus the dashboard KPI and project-list tests, which pass when re-run alone.
  - Snapshot reverted, all 108 table row counts match the baseline, snapshot dropped.

**Deviations / flags:**
- `SqlObjectDeployer.IsDeployableObject` was tightened (review finding 5), which the plan didn't list. The README's description of runtime scripts depends on it.
- The in-transaction method is `public`, not `internal`, matching the other public ISqlExecutor deletion overloads; no `InternalsVisibleTo` was added.
- Side effect: `DeleteLumpSum` on a published parent that still has children now answers "published" before "still itemized". Both are refusals.

**Files changed:**
- Helpers: `ProgramHelper.cs`, `SqlObjectDeployer.cs`
- WebAPI: `Programs/ProgramController.cs`, `Lumpsum/LumpsumController{,.Itemization,.Import}.cs`, `RequiresDeletionObjectsAttribute.cs`
- Main: `Program.cs`, `ServiceRegistration.cs`, `Resources/Internal/SQLObjects/{Functions/GetProjectDeletionTier.sql, README.md}`
- `MYPS.ApiIntegrationTests/{DeletionEndpointsHttpFixture, DeletionEndpointsHttpTests, RequiresDeletionObjectsTests, TestAuthHandler}.cs`
- `MYPS.DatabaseTests/{ProjectDeletionTierTests, SqlObjectDeployerTests}.cs`
- `documents/docs/RELEASE_DELETE_POLICY.md`, this plan.
