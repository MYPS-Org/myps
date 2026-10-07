/* #############################################################################
   ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql
   -----------------------------------------------------------------------------
   WHAT THIS DOES. CREATE OR ALTER of dbo.pRecomputeProjectPublishable only,
   adding one guard to its WHERE clause: AND p.IsPublished = 0. Nothing else
   about the procedure's logic, parameters, or result set changes.

   WHY. Per the operator (2026-10-05): once a project is published to PCMA
   (tProjects.IsPublished = 1), it is never published again through this path
   -- publishing again only happens through a separate revision function/
   module, out of scope here. IsPublishable is meant to freeze at whatever
   value it held at the moment of publishing and never drift afterward.

   Confirmed this procedure violates that today. It is called automatically
   from WebAPI/Controllers/Programs/ProgramController.cs (UpdateProgramDetails,
   ~line 814) every time a program is saved as Approved at GAA-R, and its
   WHERE clause filters only by ProgramFK -- it recomputes IsPublishable for
   EVERY project in the program, including already-published ones, with no
   exclusion. Live evidence on myps_db_dev, 2026-10-05:

       SELECT IsPublished, IsPublishable, COUNT(*) FROM tProjects
       GROUP BY IsPublished, IsPublishable;
       -- IsPublished=1, IsPublishable=0  ->  16 rows

   Those 16 rows are a published project whose underlying data changed after
   publishing (e.g. a cost-per-year row removed) such that it no longer
   passes the 7 GAA-R rules; a later unrelated Approve-at-GAA-R save then
   silently flipped IsPublishable to 0 on a project that should never be
   touched by this flag again. Per the operator, these 16 rows are NOT to be
   data-corrected -- IsPublished=1 with IsPublishable=0 is an accepted,
   understood terminal state, not corruption. Only the procedure's going-
   forward behavior is being fixed here, so the state can no longer drift
   further (e.g. back to IsPublishable=1, which would be equally undesirable
   even though it looks "fixed") after this script runs.

   SCOPE. This script fixes ONLY pRecomputeProjectPublishable. The two sibling
   defects in the SAME WHERE-clause-missing-IsPublished family --
   BatchRestrictPublish and BatchAllowPublish in ProgramController.cs -- are
   C# changes, not SQL, and ship in the same commit/PR as this script but as
   separate .cs edits. See that PR's description for the full three-part fix.

   HOW IT IS APPLIED. The script does NOT carry its own copy of the procedure
   body. It reads the LIVE definition from sys.sql_modules and (a) saves it
   verbatim as pRecomputeProjectPublishable_backup_pre_published_guard_20261005
   (a true snapshot, so the rollback restores what was really live, even if a
   database holds a newer or hot-fixed body), then (b) ALTERs the live
   procedure with exactly one textual change: the final
   "WHERE p.ProgramFK = @ProgramFK" gains "AND p.IsPublished = 0". If that
   WHERE text is not found exactly once, the script THROWs and changes nothing.
   Re-running is a no-op once the guard is present.

   ROLLBACK. Take the backup's definition from sys.sql_modules, replace the
   backup name with pRecomputeProjectPublishable, change CREATE to ALTER, and
   run it. (The backup name follows the repo convention, e.g.
   pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql.)
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   1. BACKUP the live definition, then apply the one-clause guard to it
   ============================================================================= */
DECLARE @name   NVARCHAR(128) = N'pRecomputeProjectPublishable';
DECLARE @backup NVARCHAR(128) = N'pRecomputeProjectPublishable_backup_pre_published_guard_20261005';
DECLARE @def    NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID(N'dbo.pRecomputeProjectPublishable'));
DECLARE @old    NVARCHAR(200) = N'WHERE p.ProgramFK = @ProgramFK;';
DECLARE @new    NVARCHAR(200) = N'WHERE p.ProgramFK = @ProgramFK AND p.IsPublished = 0;';

IF @def IS NULL
    THROW 50001, 'dbo.pRecomputeProjectPublishable does not exist.', 1;

IF @def LIKE N'%p.IsPublished = 0%'
BEGIN
    PRINT 'Guard already present in the live definition - nothing to do.';
END
ELSE
BEGIN
    IF (LEN(@def) - LEN(REPLACE(@def, @old, N''))) / LEN(@old) <> 1
        THROW 50002, 'Expected WHERE clause not found exactly once in the live definition; refusing to patch. Review the live body manually.', 1;

    -- locate the leading "CREATE" (the last one before the procedure name)
    DECLARE @namePos   INT = CHARINDEX(@name, @def);
    DECLARE @head      NVARCHAR(MAX) = LEFT(@def, @namePos - 1);
    DECLARE @createPos INT = LEN(@head) - CHARINDEX(REVERSE(N'CREATE'), REVERSE(@head)) - 4;

    IF @createPos < 1
        THROW 50003, 'Could not locate the CREATE keyword in the live definition.', 1;

    -- 1a. backup = live definition verbatim, under the backup name
    IF OBJECT_ID(N'dbo.' + @backup, 'P') IS NOT NULL
        EXEC (N'DROP PROCEDURE dbo.' + @backup);

    DECLARE @backupSql NVARCHAR(MAX) = STUFF(@def, @namePos, LEN(@name), @backup);
    EXEC sys.sp_executesql @backupSql;

    -- 1b. live procedure = live definition + the one-clause guard
    DECLARE @alterSql NVARCHAR(MAX) = STUFF(REPLACE(@def, @old, @new), @createPos, 6, N'ALTER');
    EXEC sys.sp_executesql @alterSql;

    PRINT 'Backup created and guard applied.';
END
GO

/* =============================================================================
   2. SMOKE CHECK - the guard is in place and the procedure still binds and
      runs (rolled back, touches no real data)
   ============================================================================= */
PRINT '--- guard text present in the live definition? (want 1 row) ---';
SELECT OBJECT_NAME(object_id) AS [procedure]
FROM sys.sql_modules
WHERE object_id = OBJECT_ID('dbo.pRecomputeProjectPublishable')
  AND definition LIKE '%AND p.IsPublished = 0%';
GO

PRINT '--- procedure binds and runs (rolled back) ---';
DECLARE @pk NVARCHAR(200) =
    (SELECT TOP 1 ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0);

IF @pk IS NOT NULL
BEGIN
    BEGIN TRAN;
        EXEC dbo.pRecomputeProjectPublishable @ProgramFK = @pk;
    ROLLBACK TRAN;
END
ELSE
    PRINT 'No program available to exercise the procedure against.';
GO

PRINT '--- already-published rows this fixes going forward (informational; not corrected) ---';
SELECT IsPublished, IsPublishable, COUNT(*) AS Cnt
FROM dbo.tProjects
GROUP BY IsPublished, IsPublishable
ORDER BY IsPublished DESC, IsPublishable DESC;
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO
