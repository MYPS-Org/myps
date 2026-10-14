# SQLObjects

Database functions, views and stored procedures that the API calls through Dapper
(`ISqlExecutor`), kept as the source of truth and applied by the API itself:

```text
Functions/            CREATE OR ALTER FUNCTION ...
Views/                CREATE OR ALTER VIEW ...
Stored Procedures/    CREATE OR ALTER PROCEDURE ...
Tables/               generated DDL for reference (GenerateTables.ps1) — never applied
order.txt             optional: files to apply first, one relative path per line
```

## Applying them

```bash
# from Main/bin/<Configuration>/net8.0 (or a publish folder)
ASPNETCORE_ENVIRONMENT=Development ./Main.exe --apply-sql-objects        # dry run: target + file list, changes nothing
ASPNETCORE_ENVIRONMENT=Development ./Main.exe --apply-sql-objects --yes  # apply
```

- **Check the target first.** The command uses the `ConnectionStrings:MYPSDb` of the environment
  it runs in, and prints `server '…', database '…'` before doing anything. A bare `Main.exe`
  is Production and reads the base `appsettings.json`.
- It exits before any web host, Hangfire or SignalR starts, with exit code 0 on success, 1 on failure.
- Every file runs in **one transaction**: if any batch fails, no object changes, and the error names
  the file, the batch and its line. Re-running is safe: every file is `CREATE OR ALTER`.
- Two runs at once cannot interleave: the second fails on the `MYPS_SqlObjectDeploy` app lock.
- The login needs `CREATE`/`ALTER` permission on `dbo`.

Run it after deploying a build that changes anything in this folder.

## Writing a file here

- One object per file, named after it, using `CREATE OR ALTER` (never `DROP`/`CREATE`).
- Separate batches with `GO` on its own line (`GO n` repeats). `CREATE FUNCTION/VIEW/PROCEDURE`
  must start its own batch, so keep `SET QUOTED_IDENTIFIER ON;` in a batch of its own before it.
  `GO` inside `/* */` comments or string literals is ignored, as in sqlcmd.
- Order is Functions, Views, Stored Procedures, then file name. A procedure may reference an object
  applied after it; a function or view may not. If one does, list the dependency in `order.txt`.
- Never put data changes or one-off migrations here; those stay in `../SQLScripts` and are run by hand.
