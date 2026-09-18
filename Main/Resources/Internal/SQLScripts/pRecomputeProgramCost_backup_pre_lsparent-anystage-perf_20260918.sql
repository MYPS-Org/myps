/*
    Backup of dbo.pRecomputeProgramCost as it existed on LOCALHOST myps_db_dev_200 BEFORE the
    2026-09-18 performance fix and Lump Sum parent rule change.

    WHAT CHANGED. This is the per-year body deployed on 2026-09-15. It took about 3.2 seconds
    on the largest program (MP_P_CO-PS-635_07212023_081334) because its "counted" CTE was
    expanded three times, each a full scan of tProjectStages, and the EXISTS against it inside
    the per-year aggregate became one tProjects lookup per per-year row (992,166 reads). It
    also counted a Lump Sum parent only when the parent's own stage row matched the program's
    current stage, which left 86 of 123 parents on this database contributing nothing.

    The replacement materialises the ordinary projects once, counts every Lump Sum parent of
    the program at any stage by its LS component Total only, and never reads a parent's
    per-year rows or any itemized child. See
    documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md.

    NOTE ON PROVENANCE. Captured from localhost / myps_db_dev_200, not from the shared server
    at 192.168.50.200, which still carries its own (funding-based) definition. In git this
    body exists only on the unmerged branch fix/program-details-cost-computation. The
    mojibake in the leading comment ("PATH 2 ... dbo.pRecompute") is in the live object text
    itself and is kept verbatim.

    Captured live via: SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pRecomputeProgramCost'));
    Checksum at capture: CHECKSUM(OBJECT_DEFINITION(...)) = 647704337

    Rollback: run this file against localhost myps_db_dev_200. Roll back
    fProgramStages_backup_pre_lsparent-anystage-perf_20260918.sql with it: the two objects
    are one rule by two paths and must move together.
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF DB_NAME() <> N'myps_db_dev_200'
BEGIN
    DECLARE @db NVARCHAR(128) = DB_NAME();
    RAISERROR('REFUSED: this rollback is for localhost myps_db_dev_200 only. Connected to %s.', 20, 1, @db) WITH LOG;
END
GO

/* =============================================================================
   4. THE RULE, PATH 2 â€” dbo.pRecomputeProgramCost (writes tProgramRevisions.Cost)
   ============================================================================= */
CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost]
    @ProgramPK NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @StartYear INT, @NewCost DECIMAL(18,2);

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

    /*  THE PROGRAM YEAR. One value per program, shared by all of its stages. */
    SELECT @StartYear = pg.StartYear
    FROM dbo.tPrograms pg
    WHERE pg.ProgramPK = @ProgramPK;

    /*  The latest revision of each project AT THIS STAGE. tProjectStages carries one
        row per revision, so an unfiltered sum counts a project once per revision it
        has ever had at the stage. */
    ;WITH stage_revision AS (
        SELECT ps.ProjectFK, ps.RevisionId,
               ROW_NUMBER() OVER (PARTITION BY ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
        FROM dbo.tProjectStages ps
        WHERE ps.ProgramFK = @ProgramPK
          AND ps.StageId   = @CurrentStageId
    ),
    /*  The projects whose money counts: the latest revision of each, minus the
        itemized children.

        ITEMIZED CHILDREN are not their own money -- what they hold was drawn out of
        their Lump Sum parent, whose full appropriation is counted below. Counting both
        is the RISK-009 double count. The old guard was ProjectType <> 'LS', which
        dropped parents and children alike and added the parents back from vLumpSumSet;
        children carry ProjectType 'LS' too, so the type cannot tell them apart and
        ParentProjectId is what does. */
    counted AS (
        SELECT sr.RevisionId,
               CASE WHEN prj.ProjectType = N'LS' AND prj.ParentProjectId IS NULL
                    THEN 1 ELSE 0 END AS IsLumpSumParent
        FROM stage_revision sr
        JOIN dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
        WHERE sr.rn = 1
          AND prj.ParentProjectId IS NULL
    ),
    /*  Both aggregates are grouped ONCE over the whole stage rather than evaluated per
        project: on a 16,500-project program that is the difference between 1.4 seconds
        and 0.6. They are restricted by EXISTS on the same stage so neither touches a
        revision belonging to another program. */
    component_total AS (
        SELECT cc.ProjectRevisionFK, SUM(cc.Total) AS ComponentTotal
        FROM dbo.tProjectComponentCost cc
        WHERE cc.IsDeleted = 0
          AND EXISTS (SELECT 1 FROM counted c WHERE c.RevisionId = cc.ProjectRevisionFK)
        GROUP BY cc.ProjectRevisionFK
    ),
    per_year AS (
        SELECT cc.ProjectRevisionFK,
               COUNT(DISTINCT y.[Year])                                          AS [Years],
               SUM(y.Amount)                                                     AS AmountAllYears,
               SUM(CASE WHEN y.[Year] = @StartYear THEN y.Amount END)            AS AmountAtProgramYear
        FROM dbo.tProjectComponentCost cc
        JOIN dbo.tProjectComponentCostPerYear y
            ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
        WHERE cc.IsDeleted = 0
          AND EXISTS (SELECT 1 FROM counted c WHERE c.RevisionId = cc.ProjectRevisionFK)
        GROUP BY cc.ProjectRevisionFK
    )
    SELECT @NewCost = ISNULL(SUM(
        CASE
            /*  A LUMP SUM PARENT carries its appropriation as the Total of its single
                'Lump Sum' component. Its per-year row is the REMAINING balance after
                itemization, so the per-year rule would report a shrinking figure as the
                program itemized its own money. */
            WHEN c.IsLumpSumParent = 1 THEN ISNULL(t.ComponentTotal, 0)

            /*  ONE YEAR of cost: that year counts whatever it is. SEVERAL: only the
                program year. "One" means one distinct Year, not one row -- two
                components each holding a single row for the same year are one year of
                cost between them. A project with no per-year rows adds nothing. */
            WHEN ISNULL(y.[Years], 0) <= 1 THEN ISNULL(y.AmountAllYears, 0)
            ELSE ISNULL(y.AmountAtProgramYear, 0)
        END), 0)
    FROM counted c
    LEFT JOIN component_total t ON t.ProjectRevisionFK = c.RevisionId
    LEFT JOIN per_year       y ON y.ProjectRevisionFK = c.RevisionId;

    UPDATE dbo.tProgramRevisions
    SET Cost = @NewCost
    WHERE Id = @CurrentRevisionId;

    /*  StageId is extra: DBHelper.Models.Procedures.RecomputeProgramCost only
        declares RevisionId and NewCost. EF Core's FromSql mapping onto a
        keyless type ignores result columns with no matching property, so this
        column is harmless to keep and safe to drop -- kept here only because
        dropping it isn't part of this change. */
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
GO
