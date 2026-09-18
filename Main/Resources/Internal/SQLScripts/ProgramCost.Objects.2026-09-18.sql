/* #############################################################################
   ProgramCost.Objects.2026-09-18.sql - standalone update of the program cost objects
   -----------------------------------------------------------------------------
   WHAT THIS DOES. Brings the three indexes and the two objects altered on branch
   fix/program-cost-recompute-perf onto the connected database, and nothing else:

     1. IX_tProjectStages_ProgramFK_StageId
        IX_tProjectComponentCost_Revision_Live
        IX_tProjectComponentCostPerYear_Cost_Live     (created only if absent)
     2. dbo.fProgramStages                            (CREATE OR ALTER)
     3. dbo.pRecomputeProgramCost                     (CREATE OR ALTER)

   The two objects are one rule by two paths (the program list and Program
   Details) and must always be deployed together. The rule:
     - an ordinary project counts at the program's current stage, from its
       per-year rows: one distinct Year counts whatever the year; several count
       only the program year (tPrograms.StartYear);
     - a Lump Sum parent counts ONLY the Total of its live 'LS' component on its
       latest live revision, at ANY stage - never its per-year rows;
     - an itemized child never counts.
   See documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md.

   HOW IT DIFFERS FROM Migration.ProgramCostLSParentAnyStage.Dev200.2026-09-18.sql.
   That script is locked to localhost myps_db_dev_200 and adds a preflight, a
   verification report and an optional backfill. This one carries only the
   objects and runs on any database except the retired production name myps_db.
   Pick the target deliberately.

   BEFORE RUNNING IT ON A DATABASE THAT STILL HAS THE FUNDING-BASED BODY (for
   example the shared server as of 2026-09-18): this changes what "program cost"
   means there. Ordinary projects move from funding profiles to per-year costs,
   and an approved Formal Revision no longer changes program cost (RISK-108).
   Capture the current definitions first so there is something to roll back to:
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.fProgramStages'));
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pRecomputeProgramCost'));

   WHAT IT DOES NOT DO. No data change: tProgramRevisions.Cost keeps its stored
   values until a write recomputes each program. No other object.

   HOW TO RUN IT.
     sqlcmd -S <server> -d <database> -E -C -b -I -f 65001 -i ProgramCost.Objects.2026-09-18.sql
   -I (QUOTED_IDENTIFIER ON) is required: the filtered indexes cannot be created
   without it. -b stops at the first error. Idempotent; safe to re-run.

   ROLLBACK on localhost myps_db_dev_200: run, from this folder,
     pRecomputeProgramCost_backup_pre_lsparent-anystage-perf_20260918.sql
     fProgramStages_backup_pre_lsparent-anystage-perf_20260918.sql
   Anywhere else: re-run the definitions captured above.

   PROVENANCE. Sections 1-3 are byte-for-byte section 6b and section 11 of
   Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql.
   Edit the source and re-cut; do not edit them here.
   ############################################################################# */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0. GUARD - never the retired production database name (SKL-005 / ADR-118)
   ============================================================================= */
IF DB_NAME() = N'myps_db'
BEGIN
    RAISERROR('REFUSED: this script will not run against myps_db, the retired production database name. Point it at a dev database.', 20, 1) WITH LOG;
END
GO

PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));
GO

/* =============================================================================
   1. INDEXES (source: section 6b)
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
   2-3. THE TWO OBJECTS (source: section 11)
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
            each, no Lump Sum parent, no itemized child - on the per-year rule. The
            per-year figures are grouped ONCE for every revision at the stage (agg,
            restricted by EXISTS to this program and stage) and then joined to the
            filtered project set, so a parent's or a child's figures never reach the
            sum. Grouping first, rather than joining the project set into the
            per-year rows, is what keeps ProgramHelper's one-stage read - run on
            every project validation - at or under the 2026-09-15 body's time on
            the largest programs (measured 2026-09-18). Correlated per stage row on
            purpose: a correlated subquery is evaluated only for the rows that
            survive the caller's WHERE.

            pgy re-reads the program year INSIDE this scope on purpose. Writing
            pg.StartYear here is refused: SQL Server will not aggregate an
            expression mixing an outer column with the query's own (Msg 8124).
            @ProgramPK is a parameter, not an outer column, so the seek is allowed,
            and it is one row on the key. */
        ISNULL((
            SELECT SUM(CASE WHEN ISNULL(agg.[Years], 0) <= 1 THEN ISNULL(agg.AmountAllYears, 0)
                            ELSE ISNULL(agg.AmountAtProgramYear, 0) END)
            FROM (
                SELECT ps3.ProjectFK, ps3.RevisionId,
                       ROW_NUMBER() OVER (PARTITION BY ps3.ProjectFK ORDER BY ps3.RevisionId DESC) AS rn
                FROM dbo.tProjectStages ps3
                WHERE ps3.ProgramFK = @ProgramPK
                  AND ps3.StageId   = pgs.StageId
            ) sr
            JOIN dbo.tProjects prj
              ON prj.ProjectPK = sr.ProjectFK
            LEFT JOIN (
                SELECT cc.ProjectRevisionFK,
                       COUNT(DISTINCT y.[Year])                                     AS [Years],
                       SUM(y.Amount)                                                AS AmountAllYears,
                       SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END)    AS AmountAtProgramYear
                FROM dbo.tProjectComponentCost cc
                JOIN dbo.tProjectComponentCostPerYear y
                  ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
                CROSS JOIN (SELECT TOP 1 pgx.StartYear
                            FROM dbo.tPrograms pgx
                            WHERE pgx.ProgramPK = @ProgramPK) pgy
                WHERE cc.IsDeleted = 0
                  AND EXISTS (SELECT 1 FROM dbo.tProjectStages ps5
                              WHERE ps5.RevisionId = cc.ProjectRevisionFK
                                AND ps5.ProgramFK  = @ProgramPK
                                AND ps5.StageId    = pgs.StageId)
                GROUP BY cc.ProjectRevisionFK
            ) agg ON agg.ProjectRevisionFK = sr.RevisionId
            WHERE sr.rn = 1
              AND prj.ParentProjectId IS NULL
              AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
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
   4. SMOKE CHECK - both objects bind and run (the recompute is rolled back)
   ============================================================================= */
PRINT '--- the three indexes (want 3) ---';
SELECT name, OBJECT_NAME(object_id) AS [table]
FROM   sys.indexes
WHERE  name IN ('IX_tProjectStages_ProgramFK_StageId',
                'IX_tProjectComponentCost_Revision_Live',
                'IX_tProjectComponentCostPerYear_Cost_Live');
GO

PRINT '--- both objects bind (recompute rolled back) ---';
DECLARE @pk NVARCHAR(200) =
    (SELECT TOP 1 p.ProgramFK FROM dbo.tProjects p
     WHERE p.ProjectType = N'LS' AND p.ParentProjectId IS NULL);
IF @pk IS NULL
    SELECT TOP 1 @pk = ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0;

IF @pk IS NOT NULL
BEGIN
    SELECT StageId, StageName, ProjectCount, Cost
    FROM   dbo.fProgramStages(@pk) ORDER BY StageId;

    BEGIN TRAN;
        EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
    ROLLBACK TRAN;
END
ELSE
    PRINT 'No program available to exercise the objects against.';
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO
