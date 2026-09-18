/*
    Backup of dbo.fProgramStages as it existed on LOCALHOST myps_db_dev_200 BEFORE the
    2026-09-18 performance fix and Lump Sum parent rule change.

    WHAT CHANGED. This is the per-year body deployed on 2026-09-15, the program LIST's copy
    of the rule dbo.pRecomputeProgramCost writes. It counted a Lump Sum parent only when the
    parent's own stage row matched the stage being listed. The replacement counts every Lump
    Sum parent of the program at any stage by its LS component Total only, never a parent's
    per-year rows and never an itemized child, and reaches a stage's projects through the new
    IX_tProjectStages_ProgramFK_StageId index. See
    documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md.

    NOTE ON PROVENANCE. Captured from localhost / myps_db_dev_200, not from the shared server
    at 192.168.50.200. In git this body exists only on the unmerged branch
    fix/program-details-cost-computation.

    Captured live via: SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.fProgramStages'));
    Checksum at capture: CHECKSUM(OBJECT_DEFINITION(...)) = 1861557154

    Rollback: run this file against localhost myps_db_dev_200. Roll back
    pRecomputeProgramCost_backup_pre_lsparent-anystage-perf_20260918.sql with it: the two
    objects are one rule by two paths and must move together.
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

        /*  THE PROGRAM'S COST AT THIS STAGE, on the same rule dbo.pRecomputeProgramCost
            writes into tProgramRevisions.Cost. The two are separate implementations of
            one rule and must be changed together: this is what the program LIST shows,
            that is what Program Details shows.

            The aggregates are grouped once over the stage rather than evaluated per
            project, and each is restricted by EXISTS to this program and stage. Written
            per project instead, five stages of a 16,500-project program took 11 seconds
            to list. */
        ISNULL((
            SELECT SUM(
                CASE
                    /*  A Lump Sum parent contributes its appropriation -- the Total of
                        its 'Lump Sum' component. Its per-year row is the remaining
                        balance after itemization, which would shrink as the program
                        itemized its own money. */
                    WHEN prj.ProjectType = N'LS' AND prj.ParentProjectId IS NULL
                        THEN ISNULL(tot.ComponentTotal, 0)
                    /*  One year of cost counts whatever year it is; several years count
                        only the program year. "One" means one distinct Year. */
                    WHEN ISNULL(agg.[Years], 0) <= 1 THEN ISNULL(agg.AmountAllYears, 0)
                    ELSE ISNULL(agg.AmountAtProgramYear, 0)
                END)
            FROM (
                /*  The latest revision of each project at this stage: tProjectStages
                    holds one row per revision, so an unfiltered sum counts a project
                    once per revision it has ever had here. */
                SELECT ps3.ProjectFK, ps3.RevisionId,
                       ROW_NUMBER() OVER (PARTITION BY ps3.ProjectFK ORDER BY ps3.RevisionId DESC) AS rn
                FROM dbo.tProjectStages ps3
                WHERE ps3.ProgramFK = @ProgramPK
                  AND ps3.StageId   = pgs.StageId
            ) sr
            JOIN dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
            LEFT JOIN (
                SELECT cc.ProjectRevisionFK, SUM(cc.Total) AS ComponentTotal
                FROM dbo.tProjectComponentCost cc
                WHERE cc.IsDeleted = 0
                  AND EXISTS (SELECT 1 FROM dbo.tProjectStages ps4
                              WHERE ps4.RevisionId = cc.ProjectRevisionFK
                                AND ps4.ProgramFK  = @ProgramPK
                                AND ps4.StageId    = pgs.StageId)
                GROUP BY cc.ProjectRevisionFK
            ) tot ON tot.ProjectRevisionFK = sr.RevisionId
            LEFT JOIN (
                /*  pgy re-reads the program year INSIDE this scope on purpose. Writing
                    pg.StartYear here is rejected: SQL Server refuses an aggregate over
                    an expression mixing an outer reference with the query's own columns
                    (Msg 8124). @ProgramPK is a parameter, not an outer column, so
                    seeking tPrograms again is allowed, and it is one row on the key. */
                SELECT cc.ProjectRevisionFK,
                       COUNT(DISTINCT y.[Year])                                        AS [Years],
                       SUM(y.Amount)                                                   AS AmountAllYears,
                       SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END)       AS AmountAtProgramYear
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
              /*  Itemized children hold money drawn out of their parent's
                  appropriation, which is counted whole above (RISK-009). */
              AND prj.ParentProjectId IS NULL
        ), 0)                   AS Cost

    FROM dbo.tProgramStages pgs

    JOIN dbo.tPrograms pg
        ON pg.ProgramPK = pgs.ProgramFK
    LEFT JOIN tOptionProgramType opt ON opt.NameId = pg.[Type]
    LEFT JOIN dbo.tOptionProgramStage ss ON ss.NameId = pgs.StageId

    JOIN dbo.tProgramRevisions pgr
        ON pgr.Id = pgs.RevisionId

    WHERE pgs.ProgramFK = @ProgramPK AND pg.IsDeleted = 0
);
GO
