# Plan: Dapper-driven deploy of SQLObjects (explicit command)

Status: Implemented
Created: 2026-10-15
Source: Code review of feat/program-project-hard-delete-policy — blocker #1 (the four deletion SQL objects are called by Dapper but never deployed); user decision: explicit command, SQLObjects only.


## Context

Branch `feat/program-project-hard-delete-policy` adds four SQL objects under
`Main/Resources/Internal/SQLObjects/` (`fProgramDeletionEligibility`, `fProjectDeletionTier`,
`pExecuteProjectDeletion`, `pExecuteProgramDeletion`). The API **calls** them through Dapper
(`ISqlExecutor` in `Helpers/ProgramHelper.cs` / `ProjectHelper.cs`), but **nothing creates them**:
they were absent from `myps_db_migrated_uat`, so `DeleteProgram` fails on any database where nobody
ran the files by hand (code-review blocker #1). The existing `ISqlExecutor.ExecuteScriptFile*` methods
cannot do it either: they read `SQLScripts/` not `SQLObjects/`, send a file as ONE batch (the files
use `GO`, so `CREATE FUNCTION` fails), and have no callers.

Decision (user, 2026-10-15): an **explicit command**, never on normal app start, scoped to
**`SQLObjects/` only** (idempotent `CREATE OR ALTER` files under `Functions/`, `Views/`,
`Stored Procedures/`). `Tables/` DDL and `SQLScripts/Migration.*.sql` stay manual.

Outcome: `Main.exe --apply-sql-objects` (dry-run by default, `--yes` to execute) applies every
`SQLObjects` file to the configured `MYPSDb` through Dapper, batch-split on `GO`, all-or-nothing.

## Acceptance criteria

- [ ] `Main.exe --apply-sql-objects` prints target server + database and the ordered file/batch list, executes nothing, exits 0.
- [ ] `Main.exe --apply-sql-objects --yes` applies all files in one transaction; any failing batch rolls back every object and exits non-zero naming the file + batch number + SQL error.
- [ ] Re-running is a no-op in effect (`CREATE OR ALTER`), exits 0.
- [ ] The command never starts Kestrel, Hangfire, or SignalR; a normal start (no flag) is unchanged.
- [ ] Concurrent runs are serialized (`sp_getapplock`); the loser fails fast with a clear message.
- [ ] `GO` splitting handles: case-insensitive `GO`, surrounding whitespace, `GO <n>` (repeat), `GO` inside `/* */` comments, `--` comments and string literals is NOT a separator.
- [ ] `ExecuteTransactionAsync` rollback no longer masks the original exception.
- [ ] After applying on localhost, `program-hard-delete-policy.spec.ts` cases (a)(b)(d)(e) pass without any manual `sqlcmd`.

## Approach

1. **`Helpers/SqlBatchSplitter.cs`** (new, static): `IReadOnlyList<SqlBatch> Split(string script)` — a small
   line-scanner that tracks `/* */` and `'...'` state and treats a line matching `^\s*GO(\s+\d+)?\s*$`
   (ignore-case) outside those states as a separator. Generalises the ad-hoc GO search already in
   `MYPS.DatabaseTests/RecomputeProgramCostTests.cs:659-668`. `SqlBatch` = `{ int Index, int StartLine, string Text, int Repeat }`.
2. **`Helpers/SqlExecutor.cs`**:
   - Add `Task ExecuteBatchesAsync(string script, IDbConnection conn, IDbTransaction tx, string sourceName, int timeout, CancellationToken ct)` — runs each `SqlBatch` via Dapper `conn.ExecuteAsync(new CommandDefinition(...tx...))`, wrapping errors in an exception that names `sourceName`, batch index and start line.
   - Make `ExecuteScriptFileInTransactionAsync` / `ExecuteScriptFileNonQueryInTransactionAsync` use the splitter (fixes the `GO` failure; prior review F4).
   - Guard rollback in `ExecuteTransactionAsync`: `try { transaction.Rollback(); } catch { /* keep original */ } throw;` and pass `timeout` through (prior F5). Fix the stale `ExecuteScriptFileAsync` usage note.
3. **`Helpers/SqlObjectDeployer.cs`** (new): `ApplyAsync(string rootDir, bool execute, TextWriter log, CancellationToken)`.
   - Discover `*.sql` under `Functions/`, `Views/`, `Stored Procedures/` (fixed folder order, then ordinal filename order; `Tables/` and the template are excluded). Optional `SQLObjects/order.txt` overrides order when a dependency needs it (e.g. a view used by a function).
   - Dry run: log server/database (from `SqlConnectionStringBuilder` over `Appsetting.DbConnections.MYPSDb`), files and batch counts.
   - Execute: inside `ISqlExecutor.ExecuteTransactionAsync`, first `EXEC sp_getapplock @Resource='MYPS_SqlObjectDeploy', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0` (fail if < 0), then `ExecuteBatchesAsync` per file. SQL Server DDL is transactional, so one failure rolls back all objects.
   - Use a longer timeout (e.g. 600s) than the 120s default.
4. **`Helpers/Appsetting.cs`**: add `Resources.SQLObjects` (default `"SQLObjects"`), combined with `Resources.Internal` in `PrepareAppsettings`, alongside `SQLScripts`. Add the key to `appsettings*.json` `Resources` sections.
5. **`Main/Program.cs`**: immediately after `Appsetting.PrepareAppsettings(builder.Configuration);`, if `args` contains `--apply-sql-objects`: run `new SqlObjectDeployer(new SqlExecutor()).ApplyAsync(Appsetting.Resources.SQLObjects, execute: args.Contains("--yes"), Console.Out, ...)`, set `Environment.ExitCode`, and `return` before `PrepareDatabaseConnection` / `builder.Build()`. No DI, no Hangfire, no web host.
6. **Publish safety**: `SQLObjects` files must reach `bin`/publish (already true via `Content Include="Resources\**\*"`), but exclude `SQLObjects\GenerateTables.ps1` and the `.template.sql` from Content (committed `sa` password; not deploy inputs).

## Tasks

**Senior engineer**
- S1. `SqlBatchSplitter` (comment/string-aware state machine) + `SqlExecutor.ExecuteBatchesAsync`, rollback guard, script-file methods switched to the splitter.
- S2. `SqlObjectDeployer` (discovery/order, applock, single transaction, error attribution) and the `Program.cs` early-exit command path.
- S3. DB test in `MYPS.DatabaseTests` (`SqlObjectDeployerTests.cs`) using `LocalDbSafety` throwaway `MYPS_Test_<guid>` DBs: fixture folder with a table, a function, a proc split by `GO`; assert objects exist; second run succeeds; a deliberately broken last file leaves **none** of the earlier objects created; concurrent run hits the applock.

**Junior engineer**
- J1. `Appsetting.Resources.SQLObjects` + `appsettings.json` / `.Development` / `.Staging` keys.
- J2. Unit tests for `SqlBatchSplitter` in `MYPS.UnitTests` (GO variants, `GO 2`, GO in block comment, GO in string, no trailing GO, empty batches skipped).
- J3. `Main.csproj` Content exclusions for `GenerateTables.ps1` / `*.template.sql`; drop the empty `Folder` entries if folders are non-empty.

**Documentation (tech-writer)**
- D1. `Main/Resources/Internal/SQLObjects/README.md`: what lives here, `CREATE OR ALTER` + `GO` rules, ordering/`order.txt`, the command (`--apply-sql-objects`, `--yes`), "check `MYPSDb` before running".
- D2. Note in `docs/superpowers/plans/PUBLISHING_TO_IIS.md` (or the deploy doc in use): run `Main.exe --apply-sql-objects --yes` with the target environment's `ASPNETCORE_ENVIRONMENT` after copying a build that changes `SQLObjects/`.

## Files touched

New: `Helpers/SqlBatchSplitter.cs`, `Helpers/SqlObjectDeployer.cs`, `MYPS.DatabaseTests/SqlObjectDeployerTests.cs`, `MYPS.UnitTests/SqlBatchSplitterTests.cs`, `Main/Resources/Internal/SQLObjects/README.md`.
Modified: `Helpers/SqlExecutor.cs`, `Helpers/Appsetting.cs`, `Main/Program.cs`, `Main/Main.csproj`, `Main/appsettings*.json`.
Reused: `ISqlExecutor.ExecuteTransactionAsync` (`Helpers/SqlExecutor.cs`), `Appsetting.PrepareAppsettings`, `LocalDbSafety` (`MYPS.DatabaseTests/LocalDbSafety.cs`).

## Risks

- **Wrong database.** The command uses whatever `MYPSDb` the environment resolves — bare `Main.exe` = Production = `10.0.10.226`. Mitigation: dry-run default, explicit `--yes`, and the dry-run prints server/database first. Operators run with `ASPNETCORE_ENVIRONMENT=Development` locally.
- **Permissions.** The app login needs `CREATE/ALTER` on `dbo` where the command runs; normal app runtime does not change.
- **Dependency order.** Functions (unlike procs) need referenced objects to exist; folder+alpha order may not suffice → `order.txt`.
- **Splitter edge cases.** Nested block comments / `GO` in identifiers; covered by J2 tests, behaviour documented.
- **Does not fix the policy findings** (scope/Approved gate, audit row, `tRevisionDetails`, error translation) — those remain separate.

## Verification

1. `dotnet build Main/Main.csproj --no-restore -p:SkipFrontendBuild=true` — 0 errors.
2. `dotnet test MYPS.UnitTests` and `MYPS.DatabaseTests` with `MYPS_TEST_SQL_SERVER=localhost` (+ `MYPS_TEST_SQL_USER/PASSWORD`) — throwaway DBs only.
3. Localhost `myps_db_migrated_uat` only: take a DB snapshot; from `Main/bin/Debug/net8.0` with `ASPNETCORE_ENVIRONMENT=Development` run `Main.exe --apply-sql-objects` (confirm it prints `localhost / myps_db_migrated_uat`, writes nothing — `sys.objects` still 0 rows), then `--yes`; confirm 4 rows in `sys.objects`; re-run `--yes` (exit 0).
4. Start the API on `:5025` (Hangfire disabled) and run `e2e/tests/program-hard-delete-policy.spec.ts` with `E2E_API_URL=http://localhost:5025` and the `E2E_SQL_*` vars — (a)(b)(d)(e) pass with no manual `sqlcmd`.
5. Revert the snapshot, verify row counts match baseline and the 4 objects are gone, drop the snapshot.

## Completion Log
Date: 2026-10-15
- Implementation: `SqlBatchSplitter` (GO-aware, nested `/* */` and `'...'` tracking, `GO n`); `ISqlExecutor.ExecuteBatchesAsync` + `SqlScriptBatchException`; `SqlObjectDeployer` (Functions → Views → Stored Procedures, optional `order.txt`, dry run by default, `--yes` applies in one transaction under `sp_getapplock`); `Main --apply-sql-objects [--yes]` early exit in `Program.cs`; `Appsetting.Resources.SQLObjects`. Tests: 9 splitter unit tests (`MYPS.UnitTests` 37/37), 7 deployer DB tests incl. applying the real `SQLObjects` folder (`MYPS.DatabaseTests` 50/50, localhost throwaway DBs).
- Documentation: `Main/Resources/Internal/SQLObjects/README.md` (command, safety, authoring rules).
- Verification (localhost `myps_db_migrated_uat`, under a snapshot): dry run printed `localhost`/`myps_db_migrated_uat` and created nothing; `--yes` applied 4 files / 8 batches, re-run exit 0, modules `ANSI_NULLS`/`QUOTED_IDENTIFIER` ON. Full e2e: 22 passed / 23 failed / 11 skipped / 47 not run; `program-hard-delete-policy` (a)(b)(d)(e) pass with no manual sqlcmd; failures are the known review findings (c)(f)(g), old-policy spec (a), 15 × 403 `CreateLumpSum` environment, 2 × other-branch report spec, 2 × dashboard (one flaky, passed 2/2 on rerun). Snapshot reverted; row counts match baseline on all 108 tables; snapshot dropped.
Deviations / flags:
- Per user scope limit, NO code-review finding fixes: `ExecuteTransactionAsync` rollback guard, `ExecuteScriptFile*` GO-awareness, stale usage note and the `GenerateTables.ps1` publish exclusion (plan step 2 bullets 2-3, step 6, J3) were NOT done.
- No `appsettings*.json` edits (J1): `SQLObjects` defaults to `"SQLObjects"` in `ResourcesFolder`, avoiding the developer's locally modified `appsettings.Development.json`.
- D2 skipped: `docs/superpowers/plans/PUBLISHING_TO_IIS.md` covers CrystalReportService, not Main; the deploy step lives in the SQLObjects README instead.
- Deployer reuses `ExecuteTransactionAsync`, whose ignored `timeout` and unguarded rollback remain (prior review F5); per-batch timeout is 600 s via `ExecuteBatchesAsync`.
- Follow-up from the re-run code review: `SqlBatchSplitter` does not track `[bracketed]`/`"quoted"` identifiers; an apostrophe or `--` inside one could hide a following GO. No current file is affected.
Files changed: Helpers/SqlBatchSplitter.cs (new), Helpers/SqlObjectDeployer.cs (new), Helpers/SqlExecutor.cs, Helpers/Appsetting.cs, Main/Program.cs, MYPS.UnitTests/SqlBatchSplitterTests.cs (new), MYPS.DatabaseTests/SqlObjectDeployerTests.cs (new), Main/Resources/Internal/SQLObjects/README.md (new).
