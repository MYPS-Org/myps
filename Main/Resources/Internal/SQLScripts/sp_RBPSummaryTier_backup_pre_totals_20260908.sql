/*
    Backup of dbo.sp_RBPSummaryTier as it existed on myps_db_dev immediately after creation
    (12 columns, no TotalNo/TotalAmount), BEFORE the same-day follow-up change that added
    TotalNo/TotalAmount so rbp-summary-report could also use this proc (sharing it with
    rbp-summary-report-with-tier) instead of the separately-built sp_RBPSummary.

    Captured live via: SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_RBPSummaryTier'));

    Rollback: re-run this exact CREATE OR ALTER to restore the 12-column, no-totals shape.
*/

CREATE OR ALTER PROCEDURE dbo.sp_RBPSummaryTier
    @programid NVARCHAR(100) = null
AS
BEGIN
    SET NOCOUNT ON;

    WITH RBPBase AS (
        SELECT
            pr.ProgramId                                     AS ProgramId,
            pr.ProjectId                                     AS Project_Id,
            cc.Id                                             AS Activity_Component_Id,
            ISNULL(deo.Name,  pr.DEO)                        AS DEO,
            ISNULL(ld.Name,   pr.LegislativeDistrict)        AS Legislative_District,
            ISNULL(ar.Name,   pr.Region)                     AS RO,
            cc.Total                                          AS Component_Cost,
            cat.CategoryName                                  AS Project_Category,
            ISNULL(tier.Name, CAST(pr.Tier AS NVARCHAR(50)))  AS tier,
            pr.Category                                       AS CategoryId
        FROM dbo.tProjectRevisions pr
        INNER JOIN dbo.tProjectComponentCost cc
            ON  cc.ProjectRevisionFK = pr.Id
            AND cc.IsDeleted         = 0
        INNER JOIN dbo.tProgramStages ps
            ON ps.ProgramFK = pr.ProgramFK AND ps.StageName = 'RBP'
        INNER JOIN dbo.tOptionProjectCategory cat
            ON  cat.CategoryId = pr.Category
        LEFT JOIN dbo.tOptionProjectTier tier
            ON  tier.NameId = pr.Tier
        LEFT JOIN dbo.vAdminDEO deo
            ON  deo.ParticipantId = pr.DEO
        LEFT JOIN dbo.tOptionAdminAreaCongressionalDistrict ld
            ON  ld.Id = pr.LegislativeDistrict
        LEFT JOIN dbo.[tOptionAdminAreaRegion] ar
            ON  ar.ParticipantId = pr.Region
        WHERE pr.IsDeleted = 0
    ),

    ProjectCostByCategoryTier AS (
        SELECT DISTINCT
            ProgramId,
            Project_Id,
            DEO,
            Legislative_District,
            RO,
            tier,
            Project_Category,
            CategoryId,
            SUM(Component_Cost) OVER (
                PARTITION BY Project_Id, DEO, Legislative_District, RO, tier, Project_Category, CategoryId
            ) AS Component_Cost
        FROM RBPBase
    ),

    BaseDistinct AS (
        SELECT DISTINCT
            ProgramId,
            DEO,
            Legislative_District,
            RO,
            tier
        FROM RBPBase
        WHERE CategoryId IN (16,17,18,19,29,30)
    ),

    OO1 AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProj001,
            SUM(Component_Cost)        AS Amount001
        FROM ProjectCostByCategoryTier
        WHERE CategoryId = 16
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    OO2 AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProj002,
            SUM(Component_Cost)        AS Amount002
        FROM ProjectCostByCategoryTier
        WHERE CategoryId = 17
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    CSSP AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProjCSSP,
            SUM(Component_Cost)        AS AmountCSSP
        FROM ProjectCostByCategoryTier
        WHERE CategoryId = 18
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    ),

    LP AS (
        SELECT
            ProgramId, DEO, Legislative_District, RO, tier,
            COUNT(DISTINCT Project_Id) AS noProjLP,
            SUM(Component_Cost)        AS AmountLP
        FROM ProjectCostByCategoryTier
        WHERE CategoryId = 19
        GROUP BY ProgramId, DEO, Legislative_District, RO, tier
    )

    SELECT DISTINCT
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
        r.tier
    FROM BaseDistinct r
    LEFT JOIN OO1  a ON a.ProgramId = r.ProgramId AND a.tier = r.tier AND a.DEO = r.DEO AND a.Legislative_District = r.Legislative_District
    LEFT JOIN OO2  b ON b.ProgramId = r.ProgramId AND b.tier = r.tier AND b.DEO = r.DEO AND b.Legislative_District = r.Legislative_District
    LEFT JOIN CSSP c ON c.ProgramId = r.ProgramId AND c.tier = r.tier AND c.DEO = r.DEO AND c.Legislative_District = r.Legislative_District
    LEFT JOIN LP   d ON d.ProgramId = r.ProgramId AND d.tier = r.tier AND d.DEO = r.DEO AND d.Legislative_District = r.Legislative_District
    ORDER BY r.tier, r.RO, r.DEO, r.Legislative_District;

END;
