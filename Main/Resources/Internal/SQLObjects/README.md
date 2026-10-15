# SQLObjects

SQL that the API runs through Dapper (`ISqlExecutor`). It holds two kinds of file, kept as the source of truth:

```text
Functions/            runtime scripts the API reads at request time, and/or CREATE OR ALTER FUNCTION ...
Views/                CREATE OR ALTER VIEW ...
Stored Procedures/    runtime scripts the API reads at request time, and/or CREATE OR ALTER PROCEDURE ...
Tables/               generated DDL for reference (GenerateTables.ps1) — never applied
order.txt             optional: object files to apply first, one relative path per line
```

## Runtime scripts (the deletion feature)

`Functions/GetProjectDeletionTier.sql`, `Functions/GetProgramDeletionEligibility.sql`, `Stored Procedures/ExecuteProjectDeletion.sql` and `Stored Procedures/ExecuteProgramDeletion.sql` are **plain parameterized scripts**, not database objects.

- **How they run:** the API reads each file and executes it with `ISqlExecutor.ExecuteScriptFile*InTransactionAsync`, usually inside the caller's transaction. Nothing is created in the database, so there is no deploy step: they ship **in the build**, and a publish must include them.
- **When they are missing:** the API checks at startup that all four are on disk and that the database is reachable at compatibility level 130 or higher (`DeletionObjectsStatus`). Until then, the delete endpoints answer **503 "Delete Unavailable"**, and the reason goes to the API log. They recover on their own within 30 s once fixed.
- **Rights:** they run under the app's own login, which therefore needs DELETE on the tables they delete from and INSERT on `tTransactionLog`. See `documents/docs/RELEASE_DELETE_POLICY.md`, step 2.
- **`GetProjectDeletionTier.sql` is the single deletion rule.** Every hard delete goes through `ProjectHelper.ExecuteProjectDeletionAsync`, which re-runs it inside the delete's transaction. Never run `ExecuteProjectDeletion.sql` any other way: it checks nothing itself.

## Deployable objects (`--apply-sql-objects`)

A file whose batches contain a `CREATE` statement is a deployable object. There are **none today**. The command is kept for when one is added:

```bash
# from Main/bin/<Configuration>/net8.0 (or a publish folder)
ASPNETCORE_ENVIRONMENT=Development ./Main.exe --apply-sql-objects        # dry run: target + file list, changes nothing
ASPNETCORE_ENVIRONMENT=Development ./Main.exe --apply-sql-objects --yes  # apply
```

- **Check the target first.** The command uses the `ConnectionStrings:MYPSDb` of the environment it runs in, and prints `server '…', database '…'` before doing anything. A bare `Main.exe` is Production and reads the base `appsettings.json`.
- **Skipped files are listed:** it names every runtime script it skips. With nothing to deploy it prints "Nothing to deploy", checks only the compatibility level, and exits 0.
- **Preflight:** with objects to deploy, the preflight also checks SQL Server 2017+ and CREATE/ALTER rights. Any `[FAIL]` exits 1 and nothing is applied.
- **It runs separately from the app:** it exits before any web host, Hangfire or SignalR starts, with exit code 0 on success, 1 on failure.
- **One transaction:** every file runs in one transaction. If any batch fails, no object changes, and the error names the file, the batch and its line. Every file is `CREATE OR ALTER`, so re-running is safe.
- **One run at a time:** two runs at once cannot interleave; the second fails on the `MYPS_SqlObjectDeploy` app lock.

## Writing a file here

- **Deployable object:** one object per file, named after it, using `CREATE OR ALTER` (never `DROP`/`CREATE`).
  - Separate batches with `GO` on its own line (`GO n` repeats). `CREATE FUNCTION/VIEW/PROCEDURE` must start its own batch, so keep `SET QUOTED_IDENTIFIER ON;` in a batch of its own before it. `GO` inside `/* */` comments or string literals is ignored, as in sqlcmd.
  - Order is Functions, Views, Stored Procedures, then file name. A procedure may reference an object applied after it; a function or view may not. If one does, list the dependency in `order.txt`.
- **Runtime script:** a single batch with `@Parameters`, no `GO`, no `CREATE` of a function, view or procedure. Add it to `DeletionObjectsStatus.RequiredScriptFiles` if the API cannot work without it.
- **Never put data changes or one-off migrations here;** those stay in `../SQLScripts` and are run by hand.
