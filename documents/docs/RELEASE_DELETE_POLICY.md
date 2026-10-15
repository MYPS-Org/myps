# Releasing the program/project delete policy (PR #255)

**Audience:** whoever deploys `feat/program-project-hard-delete-policy` to an environment (dev, UAT, staging, production).
**Why it needs a runbook:** this release depends on four SQL objects and one permission row, and nothing in the Web Deploy publish applies them. Without them, the delete endpoints answer **503 "Delete Unavailable"**. The rest of the app is unaffected.

## What ships

| Piece | Where | How it gets to the database |
|---|---|---|
| `dbo.fProjectDeletionTier`, `dbo.fProgramDeletionEligibility` (functions) | `Main/Resources/Internal/SQLObjects/Functions/` | `Main.exe --apply-sql-objects --yes` |
| `dbo.pExecuteProjectDeletion`, `dbo.pExecuteProgramDeletion` (procedures) | `Main/Resources/Internal/SQLObjects/Stored Procedures/` | same command |
| `ProgramController.PreviewBatchDelete` permission | `Main/Resources/Internal/SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql` | run by hand (sqlcmd/SSMS) |
| API + FE | the build | existing Web Deploy profiles |

## Order: database first, then the build

1. **Apply the SQL objects.**
2. **Run the permission script.**
3. **Publish the build.**

This order is safe because the code currently in production (`main`) never calls the four objects (checked 2026-10-15: no references on `main`). Applying them first changes nothing for the running app. Publishing first would make the delete endpoints answer 503 until steps 1–2 are done.

## Steps

Run these on the target environment's server, from the **new build's output folder** (the folder that contains `Main.exe` and `Resources\Internal\SQLObjects\`).

### 1. Dry run: check the target and the preflight

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Production'    # or 'Staging' — the SAME environment the app runs as
.\Main.exe --apply-sql-objects
```

Read the first line it prints:

```
SQLObjects DRY RUN -> server '<server>', database '<database>'
```

**Stop if that is not the database you mean to change.** The command uses that environment's `appsettings.<Environment>.json` connection string. A bare `Main.exe` with no environment set is **Production**, and environment variables **cannot** override the JSON file in this app.

Then read the preflight checklist. Every line must be `[ok]`:

| Check | Why |
|---|---|
| compatibility level ≥ 130 | Batch Delete's tier lookup uses `OPENJSON` |
| SQL Server major version ≥ 14 (2017) | `pExecuteProgramDeletion` uses `STRING_AGG` |
| CREATE FUNCTION / CREATE PROCEDURE / CREATE VIEW | the objects are created with `CREATE OR ALTER` |
| ALTER on schema `dbo` | same |

A dry run with any `[FAIL]` exits 1, and so would the real run. Nothing is changed either way.

### 2. If the preflight fails

- **Permissions (the app's login cannot create objects):** run the command once as a login that can. Point that environment's `appsettings.<Environment>.json` `ConnectionStrings:MYPSDb` at the DDL-capable login **for this one run**, then restore it. The app's own login stays as it is.
- **Compatibility level below 130:** raise it (`ALTER DATABASE … SET COMPATIBILITY_LEVEL = 130` or higher), with the DBA's agreement. That is a database-wide setting.

### 3. Apply

```powershell
.\Main.exe --apply-sql-objects --yes
```

All four files go in **one transaction**, under an app lock, so two people cannot run it at once. If any batch fails, nothing changes; the error names the file and line. It ends with `Committed 4 file(s).` Re-running is safe: every file is `CREATE OR ALTER`.

### 4. Grant the preview permission

Run `Migration.PreviewBatchDeletePermission.2026-10-15.sql` against the same database. It registers `ProgramController.PreviewBatchDelete` and grants it to exactly the groups that hold `BatchDelete`. Its last query must return **0 rows**.

Without it, the Batch Delete dialog stops at "Could not check these projects": its preview step is refused with 403.

### 5. Publish the build

Use the existing Web Deploy profile for the environment (`Main/Properties/PublishProfiles/`).

### 6. Smoke check

1. The API log contains **`Deletion database objects are ready.`** If it says `NOT ready`, the message names what is missing; go back to step 3.
2. Program list: the Delete button is **disabled** on an Approved program.
3. Program Details → Batch Actions → Batch Delete with one project ID shows the preview groups before asking for DELETE. Cancel there.
4. Optional consistency check: 0 rows means the delete gate agrees with the Status badge users see.

   ```sql
   SELECT v.ProgramPK
   FROM dbo.vProgramLatest v
   CROSS APPLY dbo.fProgramDeletionEligibility(v.ProgramPK) e
   WHERE (CASE WHEN v.Status = 'Approved' THEN 1 ELSE 0 END) <> (CASE WHEN e.CurrentStatus = 1 THEN 1 ELSE 0 END);
   ```

## If something goes wrong

- **Delete endpoints answer 503 after publishing:** steps 1–4 were skipped or ran against another database. Run them; the endpoints recover by themselves within 30 seconds, with no restart.
- **Roll back the build:** redeploy the previous build. The new objects do no harm: the previous code does not call them.
- **Roll back the objects:** re-apply the previous release's `SQLObjects` folder the same way (`Main.exe --apply-sql-objects --yes` from that release's build output). On a database that never had them, they can simply stay; nothing else uses them.

## Related

- `Main/Resources/Internal/SQLObjects/README.md`: what lives in SQLObjects and how to write a file there.
- `documents/plans/delete-policy-release-blockers.md`: why each piece exists.
