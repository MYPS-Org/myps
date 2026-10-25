/* =============================================================================
   Migration — grant ProgramController.BatchAddExistingProject (Batch Restore)
   to every group that holds BatchDelete
   Date: 2026-10-24 · Plan: documents/plans/batch-add-existing-project-restore-fixes.md (RS8)
   -----------------------------------------------------------------------------
   Program Details shows Batch Restore again, next to Batch Delete. [PermissionFilter]
   403s any action not granted through dbo.tGroupRoles.ActionIds, so a group that may
   delete but was never granted the restore would see the menu entry and be refused.

   GRANTED TO EXACTLY THE GROUPS THAT HOLD BatchDelete: restore undoes a delete, so
   anyone who may delete may restore. Groups holding the restore without the delete
   are left as they are (this script only adds).

   MATCHED BY NAME, NEVER BY Id (tApiActions.Id differs per database). Idempotent:
   re-running registers nothing twice and grants nothing twice. On myps_db_dev
   (2026-10-24) every BatchDelete group already held it, so there it changes nothing.
   Run by hand per environment, like the other Migration.* scripts.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(50) = N'ProgramController';

/* 1. Register the action (normally already there; SyncAPIPermissions registers it). */
IF NOT EXISTS (SELECT 1 FROM dbo.tApiActions
               WHERE ControllerName = @Controller
                 AND ActionName COLLATE Latin1_General_BIN2 = N'BatchAddExistingProject')
BEGIN
    INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
    VALUES (N'BatchAddExistingProject', N'Batch Restore: un-delete projects deleted in this program', @Controller);
END

DECLARE @RestoreId int = (SELECT Id FROM dbo.tApiActions
                          WHERE ControllerName = @Controller
                            AND ActionName COLLATE Latin1_General_BIN2 = N'BatchAddExistingProject');
DECLARE @DeleteId int = (SELECT Id FROM dbo.tApiActions
                         WHERE ControllerName = @Controller
                           AND ActionName COLLATE Latin1_General_BIN2 = N'BatchDelete');

/* THROW, not RAISERROR: under XACT_ABORT it aborts the batch and rolls the INSERT above back, so
   a database without BatchDelete is left untouched instead of committing a half-done grant. */
IF @DeleteId IS NULL
    THROW 50001, N'ProgramController.BatchDelete is not registered on this database; nothing to mirror. Nothing was changed.', 1;

/* 2. Grant it to every group holding BatchDelete that does not already have it.
      ActionIds is a JSON int array; merge, keep everything else untouched. */
UPDATE gr
   SET gr.ActionIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), m.Id)
            FROM (
                SELECT a.ActionId AS Id FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                UNION
                SELECT @RestoreId
            ) m
            ORDER BY m.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']')
FROM dbo.tGroupRoles gr
WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @DeleteId)
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @RestoreId);

COMMIT TRANSACTION;
GO

/* 3. Verify: every group that holds BatchDelete also holds BatchAddExistingProject (want 0 rows). */
SELECT g.Id AS GroupId, g.GroupName, N'has BatchDelete but not BatchAddExistingProject' AS Problem
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
              JOIN dbo.tApiActions t ON t.Id = a.ActionId
              WHERE t.ControllerName = N'ProgramController' AND t.ActionName = N'BatchDelete')
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                  JOIN dbo.tApiActions t ON t.Id = a.ActionId
                  WHERE t.ControllerName = N'ProgramController' AND t.ActionName = N'BatchAddExistingProject');
GO
