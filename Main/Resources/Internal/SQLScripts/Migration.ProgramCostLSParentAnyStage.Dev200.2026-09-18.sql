/* #############################################################################
   Migration - PROGRAM COST: FAST RECOMPUTE, LUMP SUM PARENTS AT ANY STAGE
   Target:  localhost / myps_db_dev_200      Written: 2026-09-18
   -----------------------------------------------------------------------------
   WHAT THIS DOES. It replaces the two objects that report a program's cost -
   dbo.fProgramStages (the program LIST, per stage) and dbo.pRecomputeProgramCost
   (writes tProgramRevisions.Cost, which Program Details shows) - and adds the
   three indexes they read through.

     - Speed. The 2026-09-15 procedure took 3.2 seconds on the largest program,
       inside every Lump Sum write's transaction. See
       documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md.
     - Rule. A Lump Sum parent now counts ONLY the Total of its 'LS' component on
       its latest live revision, at ANY stage. Its per-year rows and every
       itemized child are never counted. Ordinary projects are unchanged: the
       per-year, program-year rule at the program's current stage.

   WHAT THIS DOES NOT DO. No data change unless @RunBackfill is set in section 5.
   No other object. The shared server (192.168.50.200) is never a target: the
   guard below refuses every database but myps_db_dev_200.

   HOW TO RUN IT. From the repository root:

     sqlcmd -S localhost -d myps_db_dev_200 -E -C -b -f 65001
            -i Main/Resources/Internal/SQLScripts/Migration.ProgramCostLSParentAnyStage.Dev200.2026-09-18.sql

   -f 65001 reads this file as UTF-8. -b stops at the first error.

   ROLLBACK. Run, from this folder, in either order:
     pRecomputeProgramCost_backup_pre_lsparent-anystage-perf_20260918.sql
     fProgramStages_backup_pre_lsparent-anystage-perf_20260918.sql
   The indexes are additive and can stay. To remove them anyway:
     DROP INDEX IF EXISTS IX_tProjectStages_ProgramFK_StageId        ON dbo.tProjectStages;
     DROP INDEX IF EXISTS IX_tProjectComponentCost_Revision_Live     ON dbo.tProjectComponentCost;
     DROP INDEX IF EXISTS IX_tProjectComponentCostPerYear_Cost_Live  ON dbo.tProjectComponentCostPerYear;

   PROVENANCE. Sections 2 and 3 are byte-for-byte section 6b and section 11 of
   Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql.
   Do not edit them here; edit the source and re-cut.
   ############################################################################# */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0. GUARD - refuse to run anywhere but localhost myps_db_dev_200
   -----------------------------------------------------------------------------
   Severity 20 ends the connection, so the rest of the file cannot run even
   without -b or SQLCMD mode.
   ============================================================================= */
IF DB_NAME() <> N'myps_db_dev_200'
BEGIN
    DECLARE @db NVARCHAR(128) = DB_NAME();
    RAISERROR('REFUSED: this script is for localhost myps_db_dev_200 only. Connected to %s.', 20, 1, @db) WITH LOG;
END
GO

/* =============================================================================
   1. PREFLIGHT - what is there before anything changes
   ============================================================================= */
PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));

SELECT OBJECT_NAME(o.object_id)                      AS [object],
       o.modify_date,
       CHECKSUM(OBJECT_DEFINITION(o.object_id))      AS definition_checksum
FROM   sys.objects o
WHERE  o.object_id IN (OBJECT_ID('dbo.pRecomputeProgramCost'), OBJECT_ID('dbo.fProgramStages'));

SELECT t.name AS [table], i.name AS [index], i.has_filter, i.filter_definition,
       STRING_AGG(CASE WHEN ic.is_included_column = 0 THEN c.name END, ',')
           WITHIN GROUP (ORDER BY ic.key_ordinal)    AS keys,
       STRING_AGG(CASE WHEN ic.is_included_column = 1 THEN c.name END, ',') AS includes
FROM   sys.indexes i
JOIN   sys.tables t         ON t.object_id = i.object_id
JOIN   sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN   sys.columns c        ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE  t.name IN ('tProjectStages', 'tProjectComponentCost', 'tProjectComponentCostPerYear')
GROUP  BY t.name, i.name, i.has_filter, i.filter_definition
ORDER  BY t.name, i.name;
GO

/* =============================================================================
   2. INDEXES (source: section 6b)
   ============================================================================= */
/* -- 6b. Indexes the program cost rollups read through (2026-09-18) ----------
   dbo.pRecomputeProgramCost and dbo.fProgramStages (section 11) reach a
   program's projects by (ProgramFK, StageId). There was no such index, so every
   evaluation scanned all of tProjectStages (258,561 rows on myps_db_dev_200).
   They then read each component's Total and each per-year row's Year and Amount
   through a key lookup per row. The two filtered indexes below carry exactly the
   columns the rollups read, so those lookups disappear.

   NEW indexes, not wider versions of IX_tProjectComponentCost_Live and
   IX_tProjectComponentCostPerYear_Live: other readers seek on those, and an
   additive index cannot change their plans. Check sys.dm_db_index_usage_stats
   before ever dropping one of the older two.

   Both tables already carry a filtered index, so the QUOTED_IDENTIFIER rule in
   this file's header is not new here. tProjectComponentCostPerYear holds about
   5.6 million rows; its index takes on the order of a minute to build.
   ---------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectStages_ProgramFK_StageId'
                 AND object_id = OBJECT_ID('dbo.tProjectStages'))
    CREATE NONCLUSTERED INDEX IX_tProjectStages_ProgramFK_StageId
        ON dbo.tProjectStages (ProgramFK, StageId)
        INCLUDE (ProjectFK, RevisionId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectComponentCost_Revision_Live'
                 AND object_id = OBJECT_ID('dbo.tProjectComponentCost'))
    CREATE NONCLUSTERED INDEX IX_tProjectComponentCost_Revision_Live
        ON dbo.tProjectComponentCost (ProjectRevisionFK)
        INCLUDE (Total, ComponentId)
        WHERE IsDeleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectComponentCostPerYear_Cost_Live'
                 AND object_id = OBJECT_ID('dbo.tProjectComponentCostPerYear'))
    CREATE NONCLUSTERED INDEX IX_tProjectComponentCostPerYear_Cost_Live
        ON dbo.tProjectComponentCostPerYear (ComponentCostFK)
        INCLUDE ([Year], Amount)
        WHERE IsDeleted = 0;
GO

/* =============================================================================
   3. THE TWO OBJECTS (source: section 11)
   ============================================================================= */

/* #############################################################################
   PART 5 of 8 - the program cost rollups
   Rewritten 2026-09-18 (was: LumpSum.Baseline.sql lines 674-882, verbatim).
   ############################################################################# */

/* =============================================================================
   11. Program cost: one rule, two paths
   -----------------------------------------------------------------------------
   dbo.fProgramStages computes a program's cost live for the program LIST, per
   stage. dbo.pRecomputeProgramCost writes the same figure into
   tProgramRevisions.Cost, which Program Details shows. They are two
   implementations of ONE rule and must always be changed together - the test
   harness (MYPS.DatabaseTests/RecomputeProgramCostTests.cs) asserts they agree.

   THE RULE (2026-09-15 per-year basis; Lump Sum part decided 2026-09-18):

   - An ORDINARY project counts at the program's current stage, on the latest
     revision it has at that stage, from dbo.tProjectComponentCostPerYear: when
     it holds ONE distinct Year, that year's amount whatever the year is; when it
     holds SEVERAL, only the program year (dbo.tPrograms.StartYear).

   - A LUMP SUM PARENT (ProjectType 'LS', no ParentProjectId) counts the Total of
     its live 'LS' component (tProjectComponentCost, ComponentId = 'LS') on its
     latest live revision - the appropriation. Nothing else of it counts: its
     per-year row is the REMAINING balance after itemization and would shrink as
     the program itemized its own money. Every parent of the program counts,
     WHATEVER STAGE its own stage row sits at: parents are created and left at
     GAA-R while their programs move on, and a stage filter zeroed 86 of the 123
     parents on myps_db_dev_200.

   - An ITEMIZED CHILD (ParentProjectId set) never counts: its money was drawn
     out of the parent's appropriation, which is already counted whole
     (RISK-009). Children carry ProjectType 'LS' too, so ParentProjectId is what
     tells them apart.

   WHY IT IS SHAPED THIS WAY (2026-09-18, the slow-recompute RCA,
   documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md). The
   2026-09-15 procedure took 3.2 seconds on a 17,500-project program, inside
   every Lump Sum write's transaction. Its project set was a CTE the optimizer
   expanded three times, each a scan of tProjectStages, and the EXISTS against it
   inside the per-year aggregate became one tProjects lookup per PER-YEAR ROW
   (992,166 reads). The procedure now materialises that set once, keyed, and
   never touches a parent's or a child's per-year rows. Both objects reach a
   stage through IX_tProjectStages_ProgramFK_StageId (section 6b).
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE OR ALTER FUNCTION [dbo].[fProgramStages]
(
    @ProgramPK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        pgs.Id                  AS Id,
        pg.ProgramPK            AS ProgramPK,
        pgr.ProgramId           AS ProgramId,
        pgs.RevisionId          AS RevisionId,
        pgs.StageId             AS StageId,
        pgs.StageName           AS StageName,
        ISNULL(ss.DisplayName, pgs.StageName) AS StageDisplayName,
        pg.UserGroup            AS UserGroup,
        pg.DataSecurityGroup    AS DataSecurityGroup,

        opt.[Name]              AS ProgramType,
        pg.StartYear            AS StartYear,

        (SELECT COUNT(*)
         FROM dbo.tProjectStages ps2
         WHERE ps2.ProgramFK = @ProgramPK
           AND ps2.StageId   = pgs.StageId
        )                       AS ProjectCount,

        /*  THE PROGRAM'S COST AT THIS STAGE, on the rule dbo.pRecomputeProgramCost
            writes into tProgramRevisions.Cost (section 11 header).

            Part one: the ORDINARY projects at this stage - the latest revision of
            each, no Lump Sum parent, no itemized child - on the per-year rule. One
            grouped pass driven by that filtered set, so a parent's or a child's
            per-year rows are never read. Correlated per stage row on purpose:
            ProgramHelper reads ONE stage of this function on every project
            validation, and a correlated subquery is evaluated only for the rows
            that survive the caller's WHERE.

            pgy re-reads the program year INSIDE this scope on purpose. Writing
            pg.StartYear here is refused: SQL Server will not aggregate an
            expression mixing an outer column with the query's own (Msg 8124).
            @ProgramPK is a parameter, not an outer column, so the seek is allowed,
            and it is one row on the key. */
        ISNULL((
            SELECT SUM(CASE WHEN agg.[Years] <= 1 THEN agg.AmountAllYears
                            ELSE agg.AmountAtProgramYear END)
            FROM (
                SELECT sr.RevisionId,
                       COUNT(DISTINCT y.[Year])                                     AS [Years],
                       SUM(y.Amount)                                                AS AmountAllYears,
                       SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END)    AS AmountAtProgramYear
                FROM (
                    SELECT ps3.ProjectFK, ps3.RevisionId,
                           ROW_NUMBER() OVER (PARTITION BY ps3.ProjectFK ORDER BY ps3.RevisionId DESC) AS rn
                    FROM dbo.tProjectStages ps3
                    WHERE ps3.ProgramFK = @ProgramPK
                      AND ps3.StageId   = pgs.StageId
                ) sr
                JOIN dbo.tProjects prj
                  ON prj.ProjectPK = sr.ProjectFK
                JOIN dbo.tProjectComponentCost cc
                  ON cc.ProjectRevisionFK = sr.RevisionId AND cc.IsDeleted = 0
                JOIN dbo.tProjectComponentCostPerYear y
                  ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
                CROSS JOIN (SELECT TOP 1 pgx.StartYear
                            FROM dbo.tPrograms pgx
                            WHERE pgx.ProgramPK = @ProgramPK) pgy
                WHERE sr.rn = 1
                  AND prj.ParentProjectId IS NULL
                  AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
                GROUP BY sr.RevisionId
            ) agg
        ), 0)
        /*  Part two: the program's Lump Sum parents, ALL of them at ANY stage -
            the same figure on every stage row. */
        + ls.LumpSumCost        AS Cost

    FROM dbo.tProgramStages pgs

    JOIN dbo.tPrograms pg
        ON pg.ProgramPK = pgs.ProgramFK
    LEFT JOIN tOptionProgramType opt ON opt.NameId = pg.[Type]
    LEFT JOIN dbo.tOptionProgramStage ss ON ss.NameId = pgs.StageId

    JOIN dbo.tProgramRevisions pgr
        ON pgr.Id = pgs.RevisionId

    /*  The Lump Sum part. Uncorrelated with the stage row, so it is evaluated once
        per call rather than once per stage: SUM(Total) of the live 'LS' components
        on each parent's latest LIVE revision. A parent's per-year row (the
        remaining balance) and its children are never read. The latest revision is
        a TOP 1 per parent - vLumpSumSet's shape - because a ROW_NUMBER over the
        parents' revisions was planned as a scan of all of tProjectRevisions. */
    CROSS JOIN (
        SELECT ISNULL(SUM(cc.Total), 0) AS LumpSumCost
        FROM dbo.tProjects p
        CROSS APPLY (
            SELECT TOP 1 pr.Id
            FROM   dbo.tProjectRevisions pr
            WHERE  pr.ProjectFK = p.ProjectPK
              AND  pr.IsDeleted = 0
            ORDER  BY pr.Id DESC
        ) lr
        JOIN dbo.tProjectComponentCost cc
          ON cc.ProjectRevisionFK = lr.Id
         AND cc.IsDeleted   = 0
         AND cc.ComponentId = N'LS'
        WHERE p.ProgramFK        = @ProgramPK
          AND p.ProjectType      = N'LS'
          AND p.ParentProjectId IS NULL
    ) ls

    WHERE pgs.ProgramFK = @ProgramPK AND pg.IsDeleted = 0
);
GO

CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost]
    @ProgramPK NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @StartYear INT,
            @OrdinaryCost DECIMAL(38,5), @LumpSumCost DECIMAL(38,5), @NewCost DECIMAL(18,2);

    SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
    FROM dbo.tProgramRevisions pgr
    JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
    WHERE pgr.ProgramFK = @ProgramPK
    ORDER BY pgr.Id DESC;

    IF @CurrentRevisionId IS NULL
    BEGIN
        RAISERROR('pRecomputeProgramCost: program %s has no revisions to recompute Cost for.', 16, 1, @ProgramPK);
        RETURN;
    END

    /*  THE PROGRAM YEAR. One value per program, shared by all of its stages.
        Guarded like the revision above: with a NULL here every multi-year project
        would silently contribute nothing. */
    SELECT @StartYear = pg.StartYear
    FROM dbo.tPrograms pg
    WHERE pg.ProgramPK = @ProgramPK;

    IF @StartYear IS NULL
    BEGIN
        RAISERROR('pRecomputeProgramCost: program %s has no StartYear to apply the program-year rule against.', 16, 1, @ProgramPK);
        RETURN;
    END

    /*  1. THE ORDINARY PROJECTS AT THE CURRENT STAGE, materialised ONCE.

        tProjectStages carries one row per revision, so the latest revision of each
        project at the stage is what counts. Lump Sum PARENTS are not in this set:
        they count program-wide in step 3, whatever stage their own row sits at.
        Itemized CHILDREN are not in it either (RISK-009). A NULL ProjectType is an
        ordinary project.

        A keyed table variable, not a CTE: the CTE was expanded once per reference,
        three scans of tProjectStages, and the EXISTS against it became a tProjects
        lookup per per-year row. GROUP BY keeps the key unique on dirty data (two
        projects claiming one revision).

        OPTION (RECOMPILE), here and in step 2, is the parameter-sniffing guard: the
        cost of these statements scales with the program, from a handful of projects
        to 17,500, and a table variable carries no statistics. A plan cached for the
        first program called would be reused for all of them. Recompiling two small
        statements costs milliseconds. */
    DECLARE @Ordinary TABLE (RevisionId INT NOT NULL PRIMARY KEY);

    INSERT @Ordinary (RevisionId)
    SELECT sr.RevisionId
    FROM (
        SELECT ps.ProjectFK, ps.RevisionId,
               ROW_NUMBER() OVER (PARTITION BY ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
        FROM dbo.tProjectStages ps
        WHERE ps.ProgramFK = @ProgramPK
          AND ps.StageId   = @CurrentStageId
    ) sr
    JOIN dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
    WHERE sr.rn = 1
      AND prj.ParentProjectId IS NULL
      AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
    GROUP BY sr.RevisionId
    OPTION (RECOMPILE);

    /*  2. THE PER-YEAR RULE over those projects, grouped once per revision.

        ONE distinct Year: its amount counts whatever the year is. SEVERAL: only the
        program year. "One" means one distinct Year, not one row - two components
        each holding a row for the same year are one year of cost between them. A
        project with no live per-year rows drops out of the joins and adds nothing. */
    SELECT @OrdinaryCost = ISNULL(SUM(
        CASE WHEN agg.[Years] <= 1 THEN agg.AmountAllYears
             ELSE agg.AmountAtProgramYear END), 0)
    FROM (
        SELECT o.RevisionId,
               COUNT(DISTINCT y.[Year])                                    AS [Years],
               SUM(y.Amount)                                               AS AmountAllYears,
               SUM(CASE WHEN y.[Year] = @StartYear THEN y.Amount END)      AS AmountAtProgramYear
        FROM @Ordinary o
        JOIN dbo.tProjectComponentCost cc
          ON cc.ProjectRevisionFK = o.RevisionId AND cc.IsDeleted = 0
        JOIN dbo.tProjectComponentCostPerYear y
          ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
        GROUP BY o.RevisionId
    ) agg
    OPTION (RECOMPILE);

    /*  3. THE LUMP SUM PARENTS OF THE PROGRAM - all of them, at ANY stage.

        What a parent contributes is its appropriation: SUM(Total) of the live 'LS'
        components on its latest LIVE revision. Its per-year row is the remaining
        balance after itemization and is never read, and its children are never
        read at all. IX_tProjects_ProjectType seeks the parents; the latest live
        revision is a TOP 1 per parent on IX_tProjectRevisions_ProjectFK, the shape
        vLumpSumSet uses. */
    SELECT @LumpSumCost = ISNULL(SUM(cc.Total), 0)
    FROM dbo.tProjects p
    CROSS APPLY (
        SELECT TOP 1 pr.Id
        FROM   dbo.tProjectRevisions pr
        WHERE  pr.ProjectFK = p.ProjectPK
          AND  pr.IsDeleted = 0
        ORDER  BY pr.Id DESC
    ) lr
    JOIN dbo.tProjectComponentCost cc
      ON cc.ProjectRevisionFK = lr.Id
     AND cc.IsDeleted   = 0
     AND cc.ComponentId = N'LS'
    WHERE p.ProgramFK        = @ProgramPK
      AND p.ProjectType      = N'LS'
      AND p.ParentProjectId IS NULL;

    SET @NewCost = @OrdinaryCost + @LumpSumCost;

    UPDATE dbo.tProgramRevisions
    SET Cost = @NewCost
    WHERE Id = @CurrentRevisionId;

    /*  StageId is extra: DBHelper.Models.Procedures.RecomputeProgramCost declares
        only RevisionId and NewCost, and EF's FromSql ignores unmapped result
        columns. Kept so the result-set contract does not move. */
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
GO

/* =============================================================================
   4. VERIFICATION - read-only, or rolled back
   ============================================================================= */
SET QUOTED_IDENTIFIER ON;
GO

PRINT '--- the three indexes exist (want 3) ---';
SELECT name, OBJECT_NAME(object_id) AS [table]
FROM   sys.indexes
WHERE  name IN ('IX_tProjectStages_ProgramFK_StageId',
                'IX_tProjectComponentCost_Revision_Live',
                'IX_tProjectComponentCostPerYear_Cost_Live');
GO

PRINT '--- Lump Sum parent data the rule relies on ---';
/*  Each latest-live parent revision is expected to hold exactly one live 'LS'
    component. More than one would be counted in full (SUM), so a non-zero
    MultiLS is a data problem to look at, not a rule to change. */
;WITH lr AS (
    SELECT p.ProjectPK, p.ProgramFK, pr.Id AS RevisionId,
           ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
    FROM   dbo.tProjects p
    JOIN   dbo.tProjectRevisions pr ON pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
    WHERE  p.ProjectType = N'LS' AND p.ParentProjectId IS NULL
)
SELECT COUNT(*)                                                         AS Parents,
       SUM(CASE WHEN x.LsRows = 0 THEN 1 ELSE 0 END)                    AS WithNoLS,
       SUM(CASE WHEN x.LsRows > 1 THEN 1 ELSE 0 END)                    AS MultiLS,
       SUM(CASE WHEN x.LsRows <> x.LsByName THEN 1 ELSE 0 END)          AS ComponentIdDisagreesWithName
FROM   lr
/*  LsByName resolves 'LS' through the lookup, the way FindLSComponentAsync does.
    A join, not IN (SELECT ...): SQL Server refuses a subquery inside SUM. */
CROSS  APPLY (SELECT ISNULL(SUM(CASE WHEN cc.ComponentId = N'LS' THEN 1 ELSE 0 END), 0) AS LsRows,
                     ISNULL(SUM(CASE WHEN opt.ComponentId = N'LS' THEN 1 ELSE 0 END), 0) AS LsByName
              FROM   dbo.tProjectComponentCost cc
              LEFT   JOIN dbo.tOptionProjectComponentType opt ON opt.ComponentName = cc.ComponentType
              WHERE  cc.ProjectRevisionFK = lr.RevisionId AND cc.IsDeleted = 0) x
WHERE  lr.rn = 1;
GO

PRINT '--- timing on the largest program (rolled back) ---';
DECLARE @big NVARCHAR(200) = N'MP_P_CO-PS-635_07212023_081334';
IF EXISTS (SELECT 1 FROM dbo.tPrograms WHERE ProgramPK = @big)
BEGIN
    SET STATISTICS TIME ON;
    SET STATISTICS IO ON;
    BEGIN TRAN;
        EXEC dbo.pRecomputeProgramCost @ProgramPK = @big;
    ROLLBACK TRAN;
    SELECT StageId, StageName, ProjectCount, Cost
    FROM   dbo.fProgramStages(@big)
    ORDER  BY StageId;
    SET STATISTICS IO OFF;
    SET STATISTICS TIME OFF;
END
GO

PRINT '--- per program: stored Cost vs the list figure at the current stage (list figure is what a recompute would store) ---';
;WITH cur AS (
    SELECT pgr.ProgramFK, pgr.Id AS RevisionId, pgr.Cost AS StoredCost, pgs.StageId,
           ROW_NUMBER() OVER (PARTITION BY pgr.ProgramFK ORDER BY pgr.Id DESC) AS rn
    FROM   dbo.tProgramRevisions pgr
    JOIN   dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
)
SELECT cur.ProgramFK, cur.StageId, cur.StoredCost, fs.Cost AS ListCost,
       fs.Cost - cur.StoredCost AS Difference
FROM   cur
JOIN   dbo.tPrograms pg ON pg.ProgramPK = cur.ProgramFK AND pg.IsDeleted = 0
CROSS  APPLY (SELECT TOP 1 f.Cost FROM dbo.fProgramStages(cur.ProgramFK) f
              WHERE f.StageId = cur.StageId ORDER BY f.Id DESC) fs
WHERE  cur.rn = 1
  AND  EXISTS (SELECT 1 FROM dbo.tProjects p
               WHERE p.ProgramFK = cur.ProgramFK AND p.ProjectType = N'LS' AND p.ParentProjectId IS NULL)
ORDER  BY cur.ProgramFK;
GO

/* =============================================================================
   5. OPTIONAL BACKFILL - store the new figure for every program now
   -----------------------------------------------------------------------------
   Program Details reads the STORED cost, which otherwise moves to the new rule
   only when a write recomputes that program. Off by default; set @RunBackfill
   to 1 to run it. A program that fails - the known decimal(18,5) overflow group
   is the expected one - is reported and skipped, never fatal.
   ============================================================================= */
DECLARE @RunBackfill BIT = 0;

/*  XACT_ABORT off for this batch only: one program's error must reach the CATCH
    and be recorded, not abort the loop. */
SET XACT_ABORT OFF;

IF @RunBackfill = 1
BEGIN
    DECLARE @pk NVARCHAR(200);
    DECLARE @Skipped TABLE (ProgramPK NVARCHAR(200), ErrorMessage NVARCHAR(4000));
    DECLARE @Sink TABLE (RevisionId INT, StageId INT, NewCost DECIMAL(18,2));

    DECLARE backfill_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0 ORDER BY ProgramPK;

    OPEN backfill_cursor;
    FETCH NEXT FROM backfill_cursor INTO @pk;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            INSERT @Sink EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
        END TRY
        BEGIN CATCH
            IF XACT_STATE() <> 0 ROLLBACK TRAN;
            INSERT @Skipped VALUES (@pk, ERROR_MESSAGE());
        END CATCH
        FETCH NEXT FROM backfill_cursor INTO @pk;
    END
    CLOSE backfill_cursor;
    DEALLOCATE backfill_cursor;

    DECLARE @Recomputed INT = (SELECT COUNT(*) FROM @Sink);
    PRINT CONCAT('Backfill complete: ', @Recomputed, ' programs recomputed.');
    SELECT ProgramPK, ErrorMessage AS SkippedBecause FROM @Skipped;
END
ELSE
    PRINT 'Backfill not run (@RunBackfill = 0).';

SET XACT_ABORT ON;
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO
