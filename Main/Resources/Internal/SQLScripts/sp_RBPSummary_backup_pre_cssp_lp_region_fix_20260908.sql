CREATE   PROCEDURE [dbo].[sp_RBPSummary]
    @programid      VARCHAR(MAX) = NULL,
    --@yearstart      NVARCHAR(50) = NULL,
    @yearstart      INT,
    @region         NVARCHAR(200) = NULL,
    @planningEngr   NVARCHAR(200) = NULL,
    @reviewedBy     NVARCHAR(200) = NULL,
    @approvedBy     NVARCHAR(200) = NULL
    --@StageName NVARCHAR(50) = 'RBP'   -- defaulted so existing callers don't break
AS
BEGIN
    SET NOCOUNT ON;
    -- -- Shared base — avoids repeating the same 7-table join 4 times -------
    WITH RBPBase AS (
        SELECT
            pr.ProgramId                                       AS ProgramId,
            pr.ProjectId                                       AS Project_Id,
            cc.ComponentId                                     AS Activity_Component_Id,
            ISNULL(deo.Name,  pr.DEO)                          AS DEO,
            ISNULL(ld.Name,   pr.LegislativeDistrict)          AS Legislative_District,
            ISNULL(ar.Name,   pr.Region)                       AS RO,
            cc.Total                                           AS Component_Cost,
            pr.Category                                        AS CategoryId
        FROM dbo.tProjectRevisions pr
        INNER JOIN dbo.tProjectComponentCost cc
            ON  cc.ProjectRevisionFK = pr.Id
            AND cc.IsDeleted         = 0
        INNER JOIN dbo.tProgramStages ps
            ON  ps.ProgramFK  = pr.ProgramFK
            AND ps.StageName  = 'RBP' --@StageName
            --AND (@programid IS NULL OR ps.ProgramId = @programid)   -- scope to this program only
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
			AND (@region IS NULL OR pr.Region = @region)
        WHERE pr.IsDeleted = 0
    ),

    -- -- Per-project cost per category (de-duplicate components) ------------
    ProjectCostPerCategory AS (
        SELECT DISTINCT
            ProgramId,
            Project_Id,
            DEO,
            Legislative_District,
            RO,
            CategoryId,
            SUM(Component_Cost) OVER (
                PARTITION BY Project_Id, DEO, Legislative_District, RO, CategoryId
            ) AS Component_Cost
        FROM RBPBase
    ),

    -- -- 16 — OO1: Ensure Safe and Reliable National Road System -----------
    OO1 AS (
        SELECT
            ProgramId,
            DEO,
            Legislative_District,
            RO,
            COUNT(DISTINCT Project_Id) AS noProj001,
            SUM(Component_Cost)        AS Amount001
        FROM ProjectCostPerCategory
        WHERE CategoryId = 16
        GROUP BY ProgramId, DEO, Legislative_District, RO
    ),

    -- -- 17 — OO2: Protect Lives and Properties Against Major Floods --------
    OO2 AS (
        SELECT
            ProgramId,
            DEO,
            Legislative_District,
            RO,
            COUNT(DISTINCT Project_Id) AS noProj002,
            SUM(Component_Cost)        AS Amount002
        FROM ProjectCostPerCategory
        WHERE CategoryId = 17
        GROUP BY ProgramId, DEO, Legislative_District, RO
    ),

    -- -- 18 — Convergence and Special Support Program -----------------------
    CSSP AS (
        SELECT
            ProgramId,
            DEO,
            Legislative_District,
            RO,
            COUNT(DISTINCT Project_Id) AS noProjCSSP,
            SUM(Component_Cost)        AS AmountCSSP
        FROM ProjectCostPerCategory
        WHERE CategoryId = 18
        GROUP BY ProgramId, DEO, Legislative_District, RO
    ),

    -- -- 19 — Local Program -------------------------------------------------
    LP AS (
        SELECT
            ProgramId,
            DEO,
            Legislative_District,
            RO,
            COUNT(DISTINCT Project_Id) AS noProjLP,
            SUM(Component_Cost)        AS AmountLP
        FROM ProjectCostPerCategory
        WHERE CategoryId = 19
        GROUP BY ProgramId, DEO, Legislative_District, RO
    ),

    -- -- All distinct DEO + LD + RO combinations for this program ----------
    BaseDistinct AS (
        SELECT DISTINCT ProgramId, DEO, Legislative_District, RO
        FROM RBPBase
    )

    -- -- Final output -------------------------------------------------------
    SELECT TOP 100
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
        ISNULL(ISNULL(a.noProj001, 0) + ISNULL(b.noProj002, 0) + ISNULL(c.noProjCSSP, 0) + ISNULL(d.noProjLP, 0), 0)     AS TotalNo,
        ISNULL(ISNULL(a.Amount001, 0) + ISNULL(b.Amount002, 0) + ISNULL(c.AmountCSSP, 0) + ISNULL(d.AmountLP, 0), 0)     AS TotalAmount,
        CAST(@yearstart AS NVARCHAR(50)) AS YearStart,
        r.RO            AS Region,
        @planningEngr   AS PlanningEngr,
        @reviewedBy     AS ReviewedBy,
        @approvedBy     AS ApprovedBy,
        @programid      AS ProgramIdOut
    FROM BaseDistinct r
    LEFT JOIN OO1  a ON a.ProgramId = r.ProgramId AND a.DEO = r.DEO AND a.Legislative_District = r.Legislative_District
    LEFT JOIN OO2  b ON b.ProgramId = r.ProgramId AND b.DEO = r.DEO AND b.Legislative_District = r.Legislative_District
    LEFT JOIN CSSP c ON c.ProgramId = r.ProgramId AND c.DEO = r.DEO AND c.Legislative_District = r.Legislative_District
    LEFT JOIN LP   d ON d.ProgramId = r.ProgramId AND d.DEO = r.DEO AND d.Legislative_District = r.Legislative_District
    ORDER BY r.RO, r.DEO, r.Legislative_District;

END;
