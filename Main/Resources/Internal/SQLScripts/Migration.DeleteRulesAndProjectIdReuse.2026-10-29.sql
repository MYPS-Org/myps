/* =============================================================================
   Migration — delete rules: the Deleted projects list, and reuse of permanently
   deleted BP/P Project IDs
   Date: 2026-10-29 · Plan: documents/plans/delete-rules-projects-programs-stages.md
   -----------------------------------------------------------------------------
   1. dbo.tProjectIdReleased: BP/P Project IDs freed by a permanent delete (only at a
      project's first stage, BP or RBP), so the next project in the same counter bucket
      (Category, prefix, island, start year) gets the lowest one back before
      dbo.pReserveProjectIdBlock advances the counter (ProjectHelper.GenerateProjectID).
      Filled by the runtime script Stored Procedures/ExecuteProjectDeletion.sql, only once
      NOTHING still carries the ID: a soft-deleted project keeps its rows, so its ID stays
      reserved. MY IDs are their own pool, and Lump Sum itemized IDs are never reissued.
      Without this table the script and the generator behave exactly as before.
      Also indexes tProjectRevisions.ProjectId, which the release and the generator look up.

   2. Registers ProgramController.ShowDeletedProjects (the Deleted projects panel) and
      RestoreToCurrentStage (restore a project deleted at an earlier stage into the current
      stage, restore-deleted-project-into-current-stage.md) and grants both to every group
      holding BatchAddExistingProject (Batch Restore): [PermissionFilter] 403s an action no
      group holds. Matched by name, never by Id (tApiActions.Id differs per database).

   Idempotent: re-running creates nothing twice and grants nothing twice. Run by hand
   per environment, like the other Migration.* scripts.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* 1. The released-ID pool. */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tProjectIdReleased' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.tProjectIdReleased (
        Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tProjectIdReleased PRIMARY KEY,
        CategoryId    INT            NOT NULL,
        Suffix        NVARCHAR(2)    NOT NULL,
        IslandCode    NVARCHAR(2)    NOT NULL,
        YearStart     INT            NOT NULL,
        Sequence      INT            NOT NULL,
        ProjectId     NVARCHAR(50)   NOT NULL,
        ReleasedBy    NVARCHAR(100)  NULL,
        ReleasedDate  DATETIME2      NOT NULL CONSTRAINT DF_tProjectIdReleased_ReleasedDate DEFAULT (SYSDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_tProjectIdReleased_Bucket_Sequence' AND object_id = OBJECT_ID('dbo.tProjectIdReleased'))
    CREATE UNIQUE INDEX UX_tProjectIdReleased_Bucket_Sequence
        ON dbo.tProjectIdReleased (CategoryId, Suffix, IslandCode, YearStart, Sequence);
GO

/* tProjectRevisions.ProjectId is looked up by every release (is the id still carried?) and by
   GenerateProjectID's own duplicate check; it had no index (a scan of the whole table each time). */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tProjectRevisions_ProjectId' AND object_id = OBJECT_ID('dbo.tProjectRevisions'))
    CREATE INDEX IX_tProjectRevisions_ProjectId ON dbo.tProjectRevisions (ProjectId);
GO

/* 2. Register and grant the new actions. */
BEGIN TRANSACTION;

DECLARE @Controller nvarchar(50) = N'ProgramController';

IF NOT EXISTS (SELECT 1 FROM dbo.tApiActions WHERE ControllerName = @Controller
               AND ActionName COLLATE Latin1_General_BIN2 = N'ShowDeletedProjects')
    INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
    VALUES (N'ShowDeletedProjects', N'List the projects deleted at a program''s current stage, to restore them', @Controller);

IF NOT EXISTS (SELECT 1 FROM dbo.tApiActions WHERE ControllerName = @Controller
               AND ActionName COLLATE Latin1_General_BIN2 = N'RestoreToCurrentStage')
    INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
    VALUES (N'RestoreToCurrentStage', N'Restore a project deleted at an earlier stage into the program''s current stage', @Controller);

DECLARE @Grants TABLE (NewName nvarchar(100), FromName nvarchar(100));
INSERT @Grants VALUES (N'ShowDeletedProjects', N'BatchAddExistingProject'), (N'RestoreToCurrentStage', N'BatchAddExistingProject');

DECLARE @NewName nvarchar(100), @FromName nvarchar(100), @NewId int, @FromId int;
DECLARE g CURSOR LOCAL FAST_FORWARD FOR SELECT NewName, FromName FROM @Grants;
OPEN g;
FETCH NEXT FROM g INTO @NewName, @FromName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @NewId  = (SELECT Id FROM dbo.tApiActions WHERE ControllerName = @Controller AND ActionName COLLATE Latin1_General_BIN2 = @NewName);
    SET @FromId = (SELECT Id FROM dbo.tApiActions WHERE ControllerName = @Controller AND ActionName COLLATE Latin1_General_BIN2 = @FromName);

    /* THROW, not RAISERROR: under XACT_ABORT it rolls back everything above, so a database
       missing the sibling action is left untouched instead of half-granted. */
    IF @FromId IS NULL
        THROW 50001, N'ProgramController.BatchAddExistingProject is not registered on this database; nothing to mirror. Nothing was changed.', 1;

    /* ActionIds is a JSON int array; merge, keep everything else untouched. */
    UPDATE gr
       SET gr.ActionIds = (
            SELECT '[' + STUFF((
                SELECT ',' + CONVERT(varchar(12), m.Id)
                FROM (
                    SELECT a.ActionId AS Id FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                    UNION
                    SELECT @NewId
                ) m
                ORDER BY m.Id
                FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']')
    FROM dbo.tGroupRoles gr
    WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @FromId)
      AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a WHERE a.ActionId = @NewId);

    FETCH NEXT FROM g INTO @NewName, @FromName;
END
CLOSE g;
DEALLOCATE g;

COMMIT TRANSACTION;
GO

/* 3. Verify (want 0 rows): a group holding the sibling but not the new action. */
SELECT g.Id AS GroupId, g.GroupName, x.NewName AS Missing
FROM dbo.tGroupRoles gr
JOIN dbo.tGroups g ON g.Id = gr.GroupId
CROSS APPLY (VALUES (N'ShowDeletedProjects', N'BatchAddExistingProject'), (N'RestoreToCurrentStage', N'BatchAddExistingProject')) x (NewName, FromName)
WHERE EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
              JOIN dbo.tApiActions t ON t.Id = a.ActionId
              WHERE t.ControllerName = N'ProgramController' AND t.ActionName = x.FromName)
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                  JOIN dbo.tApiActions t ON t.Id = a.ActionId
                  WHERE t.ControllerName = N'ProgramController' AND t.ActionName = x.NewName);
GO
