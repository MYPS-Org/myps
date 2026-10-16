/* =============================================================================
   Migration — register ProgramController.PreviewBatchDelete and grant it
   Date: 2026-10-15 · Plan: documents/plans/delete-policy-release-blockers.md (1.4)
   -----------------------------------------------------------------------------
   PreviewBatchDelete is the read-only step the Batch Delete dialog now calls before
   the DELETE confirmation (which projects would be permanently deleted, which soft,
   which refused). [PermissionFilter] 403s any action not registered in
   dbo.tApiActions and granted through dbo.tGroupRoles.ActionIds, for everyone, so
   without this script the dialog cannot open its preview.

   GRANTED TO EXACTLY THE GROUPS THAT HOLD BatchDelete: a preview shows nothing the
   delete itself does not, so anyone who may delete may preview, and no one else.

   MATCHED BY NAME, NEVER BY Id (tApiActions.Id differs per database). Idempotent:
   re-running registers nothing twice and grants nothing twice. Touches no other
   action or group. Run by hand per environment, like the other Migration.* scripts
   (this is a data change, so it does not belong in SQLObjects/).
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(50) = N'ProgramController';

/* 1. Register the action. */
IF NOT EXISTS (SELECT 1 FROM dbo.tApiActions
               WHERE ControllerName = @Controller
                 AND ActionName COLLATE Latin1_General_BIN2 = N'PreviewBatchDelete')
BEGIN
    INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
    VALUES (N'PreviewBatchDelete', N'Read-only preview of a Batch Delete: hard / soft / refused / not found', @Controller);
END

DECLARE @PreviewId int = (SELECT Id FROM dbo.tApiActions
                          WHERE ControllerName = @Controller
                            AND ActionName COLLATE Latin1_General_BIN2 = N'PreviewBatchDelete');
DECLARE @DeleteId int = (SELECT Id FROM dbo.tApiActions
                         WHERE ControllerName = @Controller
                           AND ActionName COLLATE Latin1_General_BIN2 = N'BatchDelete');

IF @DeleteId IS NULL
BEGIN
    RAISERROR('ProgramController.BatchDelete is not registered on this database; nothing to mirror.', 16, 1);
END

/* 2. Grant it to every group holding BatchDelete that does not already have it.
      ActionIds is a JSON int array; merge, keep everything else untouched. */
UPDATE gr
   SET gr.ActionIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), m.Id)
            FROM (
                SELECT a.ActionId AS Id FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                UNION
                SELECT @PreviewId
            ) m
            ORDER BY m.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']')
FROM dbo.tGroupRoles gr
WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @DeleteId)
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @PreviewId);

COMMIT TRANSACTION;
GO

/* 3. Verify: every group that holds BatchDelete also holds PreviewBatchDelete (want 0 rows). */
SELECT g.Id AS GroupId, g.GroupName, N'has BatchDelete but not PreviewBatchDelete' AS Problem
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
              JOIN dbo.tApiActions t ON t.Id = a.ActionId
              WHERE t.ControllerName = N'ProgramController' AND t.ActionName = N'BatchDelete')
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                  JOIN dbo.tApiActions t ON t.Id = a.ActionId
                  WHERE t.ControllerName = N'ProgramController' AND t.ActionName = N'PreviewBatchDelete');
GO
