# Releasing the program/project delete policy (PR #255)

**Audience:** whoever deploys `feat/program-project-hard-delete-policy` to an environment (dev, UAT, staging, production).

**Why it needs a runbook:** this release needs one permission row and a few database rights that the Web Deploy publish does not set up. If either is missing, Batch Delete's preview answers 403 or a delete fails. If the build's deletion scripts are missing or the database is too old, the delete endpoints answer **503 "Delete Unavailable"**. The rest of the app is unaffected.

## What ships

| Piece | Where | How it gets there |
|---|---|---|
| Deletion rule and cascade: `GetProjectDeletionTier.sql`, `GetProgramDeletionEligibility.sql`, `ExecuteProjectDeletion.sql`, `ExecuteProgramDeletion.sql` | `Main/Resources/Internal/SQLObjects/Functions/` and `Stored Procedures/` | **In the build.** The API reads and runs these files at request time; nothing is created in the database. |
| `ProgramController.PreviewBatchDelete` permission | `Main/Resources/Internal/SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql` | Run by hand (sqlcmd/SSMS) |
| API + FE | the build | Existing Web Deploy profiles |

There are **no database objects to deploy** for this release. `Main.exe --apply-sql-objects` reports "Nothing to deploy", which is correct. It is not part of these steps.

## Order: database first, then the build

1. **Grant the preview permission.**
2. **Check the app login's rights and the compatibility level.**
3. **Publish the build.**
4. **Smoke check.**

Steps 1–2 change nothing the running build uses, so they are safe before the publish.

## Steps

### 1. Grant the preview permission

Run `Migration.PreviewBatchDeletePermission.2026-10-15.sql` against the target database.

- It registers `ProgramController.PreviewBatchDelete` and grants it to exactly the groups that already hold `BatchDelete`, matching by name.
- Its last query must return **0 rows**.
- It is safe to re-run.

Without it, the Batch Delete dialog stops at "Could not check these projects": its preview step is refused with 403.

### 2. Check the app login's rights and the compatibility level

The deletion scripts now run as ordinary queries under the **app's own login**. There is no stored procedure whose ownership chain covers them. Run this **as the app's login** (for example `EXECUTE AS LOGIN = '<app login>'` first, then `REVERT`). Every row must say `1`:

```sql
SELECT t.name AS TableName,
       HAS_PERMS_BY_NAME('dbo.' + t.name, 'OBJECT', t.perm) AS Granted,
       t.perm
FROM (VALUES
    ('tPrograms','DELETE'), ('tProgramRevisions','DELETE'), ('tProgramStages','DELETE'),
    ('tProjects','DELETE'), ('tProjectRevisions','DELETE'), ('tProjectStages','DELETE'),
    ('tProjectComponentCost','DELETE'), ('tProjectComponentCostPerYear','DELETE'),
    ('tProjectMajorWorkItem','DELETE'), ('tProjectMajorWorkLocations','DELETE'),
    ('tProjectFundingProfile','DELETE'), ('tProjectNotes','DELETE'), ('tProjectSupportingDocs','DELETE'),
    ('tRevisionProjects','DELETE'), ('tRevisionDetails','DELETE'), ('tRevisionApprovals','DELETE'),
    ('tRevisionDocuments','DELETE'), ('tRevisionForCorrectionDetails','DELETE'),
    ('tRevisionPCMAComponent','DELETE'), ('tRevisionProjectSnapshot','DELETE'),
    ('tRevisionProjectComponentCost','DELETE'), ('tRevisionProjectComponentCostPerYear','DELETE'),
    ('tRevisionProjectFundingProfile','DELETE'), ('tRevisionProjectMajorWorkItem','DELETE'),
    ('tRevisionProjectMajorWorkLocations','DELETE'),
    ('tTransactionLog','INSERT')
) AS t(name, perm)
ORDER BY Granted, t.name;

SELECT compatibility_level FROM sys.databases WHERE database_id = DB_ID();   -- must be >= 130

-- Delete Program locks one program's rows while it decides and deletes. Each of these six tables
-- needs an index that starts with the program column, or the lock covers the whole table.
SELECT t.name AS TableName,
       CASE WHEN EXISTS (
           SELECT 1 FROM sys.index_columns ic
           JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           WHERE ic.object_id = t.object_id AND ic.key_ordinal = 1 AND c.name IN ('ProgramFK', 'ProgramPK')
       ) THEN 1 ELSE 0 END AS HasProgramIndex                                  -- must be 1
FROM sys.tables t
WHERE t.name IN ('tPrograms', 'tProgramRevisions', 'tProgramStages', 'tProjects', 'tProjectRevisions', 'tProjectStages');
```

- **A `0` row:** grant that right to the app's login, with the DBA's agreement. Without it, a delete fails with a permission error and nothing is deleted: every delete runs in one transaction.
- **`HasProgramIndex` = 0:** create the missing index (for `tProjectStages`, `IX_tProjectStages_ProgramFK_StageId` on `(ProgramFK, StageId)`), with the DBA's agreement. Without it, a Delete Program holds up every stage change in every program until it finishes.
- **Compatibility level below 130:** raise it (`ALTER DATABASE … SET COMPATIBILITY_LEVEL = 130` or higher), with the DBA's agreement. That is a database-wide setting. The deletion scripts use `FOR JSON` for their audit rows, and the permission script uses `OPENJSON`.

### 3. Publish the build

Use the existing Web Deploy profile for the environment (`Main/Properties/PublishProfiles/`). Then confirm the four scripts are in the published folder:

```
Resources\Internal\SQLObjects\Functions\GetProjectDeletionTier.sql
Resources\Internal\SQLObjects\Functions\GetProgramDeletionEligibility.sql
Resources\Internal\SQLObjects\Stored Procedures\ExecuteProjectDeletion.sql
Resources\Internal\SQLObjects\Stored Procedures\ExecuteProgramDeletion.sql
```

### 4. Smoke check

1. The API log contains **`Deletion feature is ready (scripts on disk, database reachable).`** If it says `Deletion feature is NOT ready: …`, the message names what is missing: a script (go back to step 3) or the database or compatibility level (step 2).
2. Program list: the Delete button is **disabled**, with the reason as its tooltip, on an Approved program and on a program that still has projects.
3. Program Details → Batch Actions → Batch Delete with one project ID shows the preview groups before asking for DELETE. Cancel there.
4. Optional consistency check: 0 rows means the delete gate's "Approved" agrees with the Status badge users see. It uses the same current-stage lookup as the deletion scripts.

   ```sql
   SELECT v.ProgramPK
   FROM dbo.vProgramLatest v
   OUTER APPLY (
       SELECT TOP (1) rv.Status
       FROM dbo.tProgramStages ps
       JOIN dbo.tOptionProgramStage o ON o.Id = ps.StageId
       LEFT JOIN dbo.tProgramRevisions rv ON rv.Id = ps.RevisionId
       WHERE ps.ProgramFK = v.ProgramPK
       ORDER BY o.StageHierarchy DESC, ps.Id DESC
   ) cur
   WHERE (CASE WHEN v.Status = 'Approved' THEN 1 ELSE 0 END) <> (CASE WHEN cur.Status = 1 THEN 1 ELSE 0 END);
   ```

## If something goes wrong

- **Delete endpoints answer 503 after publishing:** read the `Deletion feature is NOT ready` line in the API log. A missing script means a bad publish: redeploy. A database problem means step 2. The endpoints recover by themselves within 30 seconds once fixed, with no restart.
- **Batch Delete preview answers 403:** step 1 was skipped or ran against another database.
- **"Try Again" (409), or "Another delete in this program is in progress":** two changes to the same program met at the same moment. Every delete path takes one lock per program first (Delete Program exclusively, Batch Delete, Batch Restore and the Lump Sum deletes shared), so they queue rather than deadlock; a deadlock with some other change (an approval, a stage advance) is answered 409. Nothing was written; repeat the request.
- **"…deleted project(s) that cannot be removed automatically (e.g. X); an administrator must clean them up":** the program's only remaining projects are leftovers of deleted ones that the delete rule will never remove: published, no stage history under the program, created here but carried into another program, or rows with no project. The Program list shows this before anyone types DELETE. A DBA must fix those rows (unpublish, or remove the leftover history); nothing in the UI can.
- **A delete fails with a permission error:** step 2. Nothing was deleted; every delete is one transaction.
- **Roll back:** redeploy the previous build. There is nothing to undo in the database. The permission row from step 1 is harmless to the previous build, and so are the rights from step 2.

## Behaviour users will notice

- Batch Delete **permanently** deletes a project on its first stage entry. Later stages are still a restorable delete. The confirm dialog says which, before the user types DELETE.
- Nothing in an **Approved** program can be deleted, except Lump Sum itemized projects. Delete Program is disabled on an Approved program.
- Published projects are never deleted.
- **Delete Program no longer deletes projects.** A program can be deleted only once all its projects have been deleted: Batch Delete in Program Details, or the Lump Sum module for Lump Sum projects. The Delete button is disabled with the reason until then. Projects that were already deleted (soft-deleted) do not block it; what is left of them goes with the program, and only within that program.

## Related

- `Main/Resources/Internal/SQLObjects/README.md`: what lives in SQLObjects, runtime scripts vs deployable objects.
- `documents/plans/delete-policy-release-blockers.md`, `documents/plans/delete-policy-must-fix.md`: why each piece exists.
