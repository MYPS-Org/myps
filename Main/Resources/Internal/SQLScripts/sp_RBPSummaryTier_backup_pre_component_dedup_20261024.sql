/*
    sp_RBPSummaryTier -- current definition, backing the "rbp-summary-report-with-tier" Crystal
    Report.

    This is the first non-"_backup_" checkpoint for this proc: every prior commit for this report
    type (see CrystalReportService/Services/CrystalReportRenderer.cs history, issue #423) only ever
    added dated backups of intermediate states, never a current, deployable script.
    Captured live via: SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_RBPSummaryTier')) against
    myps_db_dev3 on 2026-10-23, and executed directly to confirm it returns real,
    program/year/region-filtered rows whose per-tier totals reconcile with sp_RBPSummary's
    category totals for the same program/year -- the proc itself was already correct.
    rbp-summary-report-with-tier previously queried MYPS_vw_rptRBPSummaryTier with an unfiltered
    "SELECT * FROM view" (no program/year/region WHERE clause at all); it's now switched to call
    this proc directly instead, same as rbp-summary-report already did.

    Supersedes: sp_RBPSummaryTier_backup_pre_totals_20260908.sql,
    sp_RBPSummaryTier_backup_pre_cssp_lp_category_fix_20260908.sql (both left in place as history).

    Deployment note: there is no migration runner that applies scripts in this folder
    automatically -- this must be run by hand against each target database (myps_db_dev3 locally,
    then myps_db_dev / UAT) before the fix takes effect there.
*/

CREATE OR ALTER PROCEDURE [dbo].[sp_RBPSummaryTier]
    @programid      VARCHAR(MAX) = NULL,
    @yearstart      INT,
    @region         NVARCHAR(200) = NULL,
    @planningEngr   NVARCHAR(200) = NULL,
    @reviewedBy     NVARCHAR(200) = NULL,
    @approvedBy     NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    -- Shared base -- avoids repeating the same 7-table join 4 times
    WITH RBPBase AS (
        SELECT
            pr.ProgramId                                       AS ProgramId,
            pr.ProjectId                                       AS Project_Id,
            cc.ComponentId                                     AS Activity_Component_Id,
            ISNULL(deo.Name,  pr.DEO)                          AS DEO,
            ISNULL(ld.Name,   pr.LegislativeDistrict)          AS Legislative_District,
            ISNULL(ar.Name,   pr.Region)                       AS RO,
            cc.Total                                           AS Component_Cost,
            pr.Category                                        AS CategoryId,
            ISNULL(tier.Name, CAST(pr.Tier AS NVARCHAR(50)))   AS tier
        FROM dbo.tProjectRevisions pr
        INNER JOIN dbo.tProjectComponentCost cc
            ON  cc.ProjectRevisionFK = pr.Id
            AND cc.IsDeleted         = 0
        INNER JOIN dbo.tProgramStages ps
            ON  ps.ProgramFK  = pr.ProgramFK
            AND ps.StageName  = 'RBP'
            AND (@programid IS NULL OR ps.ProgramId IN (SELECT TRIM(value)
                                                          FROM STRING_SPLIT(@programid, ',')))
        INNER JOIN dbo.tPrograms prog
            ON  prog.ProgramPK  = pr.ProgramFK
            AND prog.StartYear  = @yearstart
        LEFT JOIN dbo.vAdminDEO deo
            ON  deo.ParticipantId = pr.DEO
        LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld
            ON  ld.Code = pr.LegislativeDistrict
        LEFT JOIN dbo.tOptionAdminAreaRegion ar
            ON  ar.ParticipantId = pr.Region
        LEFT JOIN dbo.tOptionProjectTier tier
            ON  tier.NameId = pr.Tier
        WHERE pr.IsDeleted = 0
            AND (@region IS NULL OR pr.Region = @region)
    ),

    -- Per-project cost per category+tier (de-duplicate components)
    ProjectCostPerCategory AS (
        SELECT DISTINCT
            ProgramId,
            Project_Id,
            DEO,
            Legislative_District,
            RO,
            CategoryId,
            tier,
            SUM(Component_Cost) OVER (
                PARTITION BY Project_Id, DEO, Legislative_District, RO, CategoryId, tier
            ) AS Component_Cost
        FROM RBPBase
    ),

    -- 16 -- OO1: Ensure Safe and Reliable National Road System
    OO1 AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProj001,
            SUM(Component_Cost)        AS Amount001
        FROM ProjectCostPerCategory
        WHERE CategoryId = 16
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    -- 17 -- OO2: Protect Lives and Properties Against Major Floods
    OO2 AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProj002,
            SUM(Component_Cost)        AS Amount002
        FROM ProjectCostPerCategory
        WHERE CategoryId = 17
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    -- 18 -- Convergence and Special Support Program
    CSSP AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProjCSSP,
            SUM(Component_Cost)        AS AmountCSSP
        FROM ProjectCostPerCategory
        WHERE CategoryId = 18
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    -- 19 -- Local Program
    LP AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProjLP,
            SUM(Component_Cost)        AS AmountLP
        FROM ProjectCostPerCategory
        WHERE CategoryId = 19
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    -- All distinct DEO + LD + RO + tier combinations for this program
    BaseDistinct AS (
        SELECT DISTINCT ProgramId, DEO, Legislative_District, RO, tier
        FROM RBPBase
    )

    -- Final output
    SELECT
        r.DEO,
        r.Legislative_District,
        r.RO,
        ISNULL(a.noProj001,  0) AS noProj001,
        ISNULL(a.Amount001,  0) AS Amount001,
        ISNULL(b.noProj002,  0) AS noProj002,
        ISNULL(b.Amount002,  0) AS Amount002,
        ISNULL(c.noProjCSSP, 0) AS noProjCSSP,
        ISNULL(c.AmountCSSP, 0) AS AmountCSSP,
        ISNULL(d.noProjLP,   0) AS noProjLP,
        ISNULL(d.AmountLP,   0) AS AmountLP,
        r.tier,
        CAST(@yearstart AS NVARCHAR(50)) AS YearStart,
        r.RO            AS Region,
        @planningEngr   AS PlanningEngr,
        @reviewedBy     AS ReviewedBy,
        @approvedBy     AS ApprovedBy,
        @programid      AS ProgramIdOut
    FROM BaseDistinct r
    LEFT JOIN OO1  a ON a.ProgramId = r.ProgramId AND a.DEO = r.DEO AND a.Legislative_District = r.Legislative_District AND a.RO = r.RO AND a.tier = r.tier
    LEFT JOIN OO2  b ON b.ProgramId = r.ProgramId AND b.DEO = r.DEO AND b.Legislative_District = r.Legislative_District AND b.RO = r.RO AND b.tier = r.tier
    LEFT JOIN CSSP c ON c.ProgramId = r.ProgramId AND c.DEO = r.DEO AND c.Legislative_District = r.Legislative_District AND c.RO = r.RO AND c.tier = r.tier
    LEFT JOIN LP   d ON d.ProgramId = r.ProgramId AND d.DEO = r.DEO AND d.Legislative_District = r.Legislative_District AND d.RO = r.RO AND d.tier = r.tier
    ORDER BY r.RO, r.DEO, r.Legislative_District, r.tier;

END;
