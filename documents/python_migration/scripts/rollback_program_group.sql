/* =============================================================================
   Undo one migrated annual program group, by ProgramPK
   2026-09-14
   -----------------------------------------------------------------------------
   WHY THIS EXISTS

   The migration commits PER TABLE PER STAGE — every to_sql call opens its own
   transaction. A failure part-way through a group therefore leaves that group
   half loaded: some stages complete, the failing one partial, the rest absent.
   Nothing in the pipeline can undo that, and steps_for_2023_2025_groups refuses
   to re-run a group whose ProgramPK already exists. This is how the group is
   removed so the run can be repeated.

   It is also the only safe answer to "the load went wrong", short of restoring
   the whole database.

   SCOPE

   Everything the migration wrote for ONE ProgramPK, and nothing else. Rows are
   reached through the program key at every level, never by a date or a user
   stamp, so a group loaded twice is fully removed and a project that belongs to
   a different group is never touched.

   HARD DELETES, ON PURPOSE. These are migrated rows: there is no history to
   preserve and a soft delete would leave the ProgramPK in place, which is what
   the loader's own pre-flight checks.

   NOT FOR APPLICATION DATA. It refuses any ProgramPK that does not start 'MP_',
   the prefix the migration gives every program it creates. Programs made in the
   app are keyed '<user>_<MMDDYYYY>_<HHMMSS>' and cannot be removed with this.

   HOW TO RUN
       sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C \
         -v ProgramPK="MP_P_CO-PS-291_08222022_145740" \
         -i app/data_migration/migration_sql/rollback_program_group.sql

   Set @DryRun = 1 below to see the counts without deleting.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

DECLARE @DryRun    bit           = 0;          -- <<< 1 = report only
DECLARE @ProgramPK nvarchar(200) = N'$(ProgramPK)';

PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('ProgramPK: ', @ProgramPK);
PRINT CONCAT('Mode     : ', CASE WHEN @DryRun = 1 THEN 'DRY RUN' ELSE 'DELETE' END);
PRINT '';

/*  An empty key would make every predicate below match nothing, which is harmless
    but silent. Say so instead. (There is no point testing for an UNsubstituted
    $(ProgramPK): sqlcmd expands the token inside this comparison too, so the test
    would always pass. sqlcmd errors on an undefined scripting variable by itself.) */
IF @ProgramPK IS NULL OR LTRIM(RTRIM(@ProgramPK)) = N''
BEGIN
    RAISERROR('REFUSED: pass the group''s key, e.g. -v ProgramPK="MP_P_CO-PS-291_08222022_145740".', 16, 1);
    SET NOEXEC ON;
END
GO

IF LEFT(N'$(ProgramPK)', 3) <> N'MP_'
BEGIN
    RAISERROR('REFUSED: only migrated programs can be rolled back with this. A migrated ProgramPK starts ''MP_''; an application-created one does not, and removing it here would destroy real work.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @ProgramPK nvarchar(200) = N'$(ProgramPK)';
DECLARE @DryRun    bit           = 0;          -- keep in step with the block above

IF NOT EXISTS (SELECT 1 FROM dbo.tPrograms WHERE ProgramPK = @ProgramPK)
BEGIN
    PRINT 'Nothing to do — no such ProgramPK on this database.';
    SET NOEXEC ON;
END
GO

DECLARE @ProgramPK nvarchar(200) = N'$(ProgramPK)';
DECLARE @DryRun    bit           = 0;          -- keep in step with the block above
DECLARE @Rows int;

/*  The group's revisions, resolved once. Every child table hangs off one of these
    or off tProjects, so this is the whole blast radius. */
IF OBJECT_ID('tempdb..#Rev') IS NOT NULL DROP TABLE #Rev;
SELECT r.Id INTO #Rev FROM dbo.tProjectRevisions r WHERE r.ProgramFK = @ProgramPK;

IF OBJECT_ID('tempdb..#Cost') IS NOT NULL DROP TABLE #Cost;
SELECT cc.Id INTO #Cost FROM dbo.tProjectComponentCost cc JOIN #Rev v ON v.Id = cc.ProjectRevisionFK;

/*  The group's stage programids. tProjectRevisions.ProgramId is the SOURCE stage programid
    (P_CO-PS-…), which is what the work tables carry in DataImportProgramId. Collected before
    anything is deleted, because the revisions go too. */
IF OBJECT_ID('tempdb..#StageProgramId') IS NOT NULL DROP TABLE #StageProgramId;
SELECT DISTINCT r.ProgramId INTO #StageProgramId FROM dbo.tProjectRevisions r WHERE r.ProgramFK = @ProgramPK;

/*  WORK ITEMS BY COMPONENT **OR** BY STAGE PROGRAMID.

    Not every work item hangs off a component. migration.py fills ComponentCostFK with 0 when
    a source activity row has no matching cost row ("DATA SANITATION: Handle Work Items with
    no Component Cost"), and a 0 matches nothing — so a join through #Cost alone leaves those
    rows behind, along with the work locations pointing at them. The first partial 2023 OO-1
    rollback left exactly 2 such work items and their 4 locations for that reason.

    DataImportProgramId is the stage programid, unique to one stage of one group, so this
    reaches them without touching another group's rows. */
IF OBJECT_ID('tempdb..#Work') IS NOT NULL DROP TABLE #Work;
SELECT w.Id INTO #Work
FROM   dbo.tProjectMajorWorkItem w
WHERE  EXISTS (SELECT 1 FROM #Cost c WHERE c.Id = w.ComponentCostFK)
   OR  w.DataImportProgramId IN (SELECT ProgramId FROM #StageProgramId);

PRINT '--- what this will remove ---';
SELECT
    (SELECT COUNT(*) FROM dbo.tPrograms          WHERE ProgramPK = @ProgramPK)  AS Programs,
    (SELECT COUNT(*) FROM dbo.tProgramRevisions  WHERE ProgramFK = @ProgramPK)  AS ProgramRevisions,
    (SELECT COUNT(*) FROM dbo.tProgramStages     WHERE ProgramFK = @ProgramPK)  AS ProgramStages,
    (SELECT COUNT(*) FROM dbo.tProjects          WHERE ProgramFK = @ProgramPK)  AS Projects,
    (SELECT COUNT(*) FROM #Rev)                                                 AS ProjectRevisions,
    (SELECT COUNT(*) FROM dbo.tProjectStages     WHERE ProgramFK = @ProgramPK)  AS ProjectStages,
    (SELECT COUNT(*) FROM dbo.tProjectNotes n JOIN #Rev v ON v.Id = n.ProjectRevisionFK)             AS Notes,
    (SELECT COUNT(*) FROM dbo.tProjectFundingProfile f JOIN #Rev v ON v.Id = f.ProjectRevisionFK)    AS FundingLines,
    (SELECT COUNT(*) FROM #Cost)                                                AS Components,
    (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear y JOIN #Cost c ON c.Id = y.ComponentCostFK) AS PerYearRows,
    (SELECT COUNT(*) FROM #Work)                                                AS WorkItems,
    (SELECT COUNT(*) FROM dbo.tProjectMajorWorkLocations l JOIN #Work w ON w.Id = l.WorkItemFK)      AS WorkLocations;

IF @DryRun = 1
BEGIN
    PRINT '';
    PRINT '*** DRY RUN — nothing deleted. ***';
    SET NOEXEC ON;
END
GO

DECLARE @ProgramPK nvarchar(200) = N'$(ProgramPK)';
DECLARE @Rows int;

BEGIN TRANSACTION;

/*  Leaf first. These tables carry no foreign keys (see LumpSum.SampleData.Dev.sql §6),
    so order is for the reader and for re-runnability, not for the engine: a failure
    half way must not leave a child pointing at a deleted parent. */
DELETE l FROM dbo.tProjectMajorWorkLocations l JOIN #Work w ON w.Id = l.WorkItemFK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Work locations  : ', @Rows);

DELETE w FROM dbo.tProjectMajorWorkItem w JOIN #Work x ON x.Id = w.Id;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Work items      : ', @Rows);

DELETE y FROM dbo.tProjectComponentCostPerYear y JOIN #Cost c ON c.Id = y.ComponentCostFK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Per-year rows   : ', @Rows);

DELETE cc FROM dbo.tProjectComponentCost cc JOIN #Cost c ON c.Id = cc.Id;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Components      : ', @Rows);

DELETE f FROM dbo.tProjectFundingProfile f JOIN #Rev v ON v.Id = f.ProjectRevisionFK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Funding lines   : ', @Rows);

DELETE n FROM dbo.tProjectNotes n JOIN #Rev v ON v.Id = n.ProjectRevisionFK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Notes           : ', @Rows);

DELETE FROM dbo.tProjectStages WHERE ProgramFK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Project stages  : ', @Rows);

DELETE FROM dbo.tProjectRevisions WHERE ProgramFK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Project revs    : ', @Rows);

DELETE FROM dbo.tProjects WHERE ProgramFK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Projects        : ', @Rows);

DELETE FROM dbo.tProgramStages WHERE ProgramFK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Program stages  : ', @Rows);

DELETE FROM dbo.tProgramRevisions WHERE ProgramFK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Program revs    : ', @Rows);

DELETE FROM dbo.tPrograms WHERE ProgramPK = @ProgramPK;
SET @Rows = @@ROWCOUNT; PRINT CONCAT('Programs        : ', @Rows);

COMMIT TRANSACTION;
PRINT '';
PRINT 'Rolled back. The group can be loaded again.';
GO

SET NOEXEC OFF;
GO
