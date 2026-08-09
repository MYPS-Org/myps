/* =============================================================================
   LS Wallet (Lumpsum) — Phase 1 read-model views
   -----------------------------------------------------------------------------
   This repo is database-first: there is no EF migration pipeline, so schema
   objects are hand-authored here and applied to SQL Server directly.

   Pre-existing objects this script DEPENDS ON (created in an earlier schema
   session, do not re-create here):
       dbo.tLSWallets                      -- wallet header
       dbo.vLSWalletBalance                -- WalletId / Total / Used / Available
       dbo.tProjects.ParentWalletId        -- FK_tProjects_ParentWallet
       dbo.tProjects.WalletDrawFrozen      -- draw frozen at publish time
       dbo.tProjectFundingProfile.IsWalletDraw

   Objects created by this script:
       dbo.vLSWalletProjectSet   -- one row per ACTIVE itemized project
       dbo.vLSWalletLatest       -- wallet list grid source (keyed on Id)

   Run order matters: vLSWalletLatest reads vLSWalletProjectSet.
   Idempotent — safe to re-run.
   ============================================================================= */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ── Drop in reverse dependency order ─────────────────────────────────────── */
IF OBJECT_ID('dbo.vLSWalletLatest', 'V')     IS NOT NULL DROP VIEW dbo.vLSWalletLatest;
GO
IF OBJECT_ID('dbo.vLSWalletProjectSet', 'V') IS NOT NULL DROP VIEW dbo.vLSWalletProjectSet;
GO


/* =============================================================================
   1. dbo.vLSWalletProjectSet
   -----------------------------------------------------------------------------
   The "project set" of a wallet — replaces the proposed physical tProjectSet
   table. tProjects.ParentWalletId + FK_tProjects_ParentWallet already ARE the
   wallet<->project link, so a separate membership table would be a second,
   drift-prone source of truth.

   ACTIVE is defined exactly as dbo.vLSWalletBalance defines it: the project has
   at least one non-deleted revision (tProjects itself has no IsDeleted column).

   Only ProjectType = 'LS' rows are returned. 'NP' (Non Project) rows are
   excluded here and are likewise excluded from publishing (flow doc §7).

   CurrentDrawAmount uses the IDENTICAL OUTER APPLY as vLSWalletBalance so that
   SUM(EffectiveDraw) over a wallet always equals vLSWalletBalance.Used. If you
   change one, change the other.
   ============================================================================= */
CREATE VIEW dbo.vLSWalletProjectSet AS
WITH LatestRevision AS (
    SELECT  pr.*,
            ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
    FROM    dbo.tProjectRevisions pr
    WHERE   pr.IsDeleted = 0
)
SELECT
    p.Id                        AS Id,              -- cursor key for FilterDataCursor
    p.ProjectPK                 AS ProjectPK,
    p.ParentWalletId            AS ParentWalletId,
    p.ProgramFK                 AS ProgramFK,
    p.ProgramId                 AS ProgramId,
    p.ProjectType               AS ProjectType,
    lr.Id                       AS RevisionId,
    lr.ProjectId                AS ProjectId,
    lr.AlternateId              AS AlternateId,
    lr.Description              AS Description,
    lr.Region                   AS Region,
    lr.Province                 AS Province,
    lr.City                     AS City,
    lr.LegislativeDistrict      AS LegislativeDistrict,
    lr.DEO                      AS DEO,
    lr.OperatingUnit            AS OperatingUnit,
    lr.ImplementingOffice       AS ImplementingOffice,
    lr.Category                 AS Category,
    cat.CategoryName            AS CategoryName,
    lr.Thrust                   AS Thrust,
    lr.Tier                     AS Tier,
    lr.[Rank]                   AS [Rank],
    stg.StageName               AS StageName,

    /* ── Remaining ItemizedProject detail (identity cols from tProjects, the
          rest from the latest revision) ──────────────────────────────────── */
    p.MYId                      AS MYId,
    p.ExternalId                AS ExternalId,
    uacs.UACS                   AS UACS,
    lr.MYCAApprovalDate         AS MYCAApprovalDate,
    lr.RegionWide               AS RegionWide,
    lr.Origin                   AS Origin,
    lr.Agency                   AS Agency,
    lr.ImplementationMode       AS ImplementationMode,
    lr.EmergencyMode            AS EmergencyMode,
    lr.Feasibility              AS Feasibility,
    lr.FeasibilityDate          AS FeasibilityDate,
    lr.DetailedDesign           AS DetailedDesign,
    lr.DetailedDesignDate       AS DetailedDesignDate,
    lr.RowAvailable             AS RowAvailable,
    p.IsPublished               AS IsPublished,
    p.IsRevised                 AS IsRevised,
    p.WalletDrawFrozen          AS WalletDrawFrozen,
    ISNULL(draw.Amount, 0)      AS CurrentDrawAmount,
    /* What this project actually consumes from the wallet right now. */
    CASE WHEN p.IsPublished = 1
         THEN ISNULL(p.WalletDrawFrozen, 0)
         ELSE ISNULL(draw.Amount, 0)
    END                         AS EffectiveDraw,
    p.CreatedBy                 AS CreatedBy,
    p.CreatedDate               AS CreatedDate,
    lr.UpdatedBy                AS UpdatedBy,
    lr.UpdatedDate              AS UpdatedDate

FROM dbo.tProjects p

/* Enforces ACTIVE (has a live revision) and pins detail to the current revision. */
JOIN LatestRevision lr
  ON lr.ProjectFK = p.ProjectPK
 AND lr.rn = 1

/* TOP 1 rather than a plain LEFT JOIN: a revision can carry more than one stage
   row, which would fan out the grid and corrupt keyset pagination. */
OUTER APPLY (
    SELECT TOP 1 ps.StageName
    FROM   dbo.tProjectStages ps
    WHERE  ps.RevisionId = lr.Id
    ORDER  BY ps.Id DESC
) stg

/* Verbatim copy of the vLSWalletBalance draw resolution — takes the wallet-draw
   funding line from the most recent non-deleted revision that actually has one. */
OUTER APPLY (
    SELECT TOP 1 fp.Amount
    FROM   dbo.tProjectRevisions pr
    JOIN   dbo.tProjectFundingProfile fp
      ON   fp.ProjectRevisionFK = pr.Id
     AND   fp.IsDeleted   = 0
     AND   fp.IsWalletDraw = 1
    WHERE  pr.ProjectFK = p.ProjectPK
      AND  pr.IsDeleted = 0
    ORDER  BY pr.Id DESC
) draw

/* A project's UACS lives per component-cost / fiscal-year row, while the UI
   surfaces a single value. Take the first non-null on the current revision. */
OUTER APPLY (
    SELECT TOP 1 cy.UACS
    FROM   dbo.tProjectComponentCost cc
    JOIN   dbo.tProjectComponentCostPerYear cy
      ON   cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0
    WHERE  cc.ProjectRevisionFK = lr.Id
      AND  cc.IsDeleted = 0
      AND  cy.UACS IS NOT NULL
    ORDER  BY cy.Year, cy.Id
) uacs

LEFT JOIN dbo.tOptionProjectCategory cat
       ON cat.CategoryId = lr.Category

WHERE p.ProjectType    = N'LS'
  AND p.ParentWalletId IS NOT NULL;
GO


/* =============================================================================
   2. dbo.vLSWalletLatest
   -----------------------------------------------------------------------------
   Source for the wallet list grid. Exposes Id so Helpers/CursorPagination.cs
   (FilterDataCursor) can keyset-paginate on it, mirroring dbo.vProgramLatest.

   Program display fields are denormalized here rather than stored on
   tLSWallets, so they never go stale when the program is renamed or advanced.
   ============================================================================= */
CREATE VIEW dbo.vLSWalletLatest AS
SELECT
    w.Id                        AS Id,              -- cursor key
    w.ProgramFK                 AS ProgramFK,
    pg.ProgramId                AS ProgramId,
    pgr.Name                    AS ProgramName,
    pt.Name                     AS TypeName,
    pg.StartYear                AS YearStart,
    pgs.StageName               AS ProgramStageName, -- program's CURRENT stage (informational)
    w.CategoryId                AS CategoryId,
    cat.CategoryName            AS CategoryName,
    w.SubCategoryFK             AS SubCategoryFK,
    thr.ThrustDescription       AS SubCategoryName,
    w.OperatingUnit             AS OperatingUnit,
    w.Amount                    AS Amount,
    w.CurrentStage              AS CurrentStage,     -- wallet's OWN lifecycle stage
    w.FundingSource             AS FundingSource,
    w.FundingAgreement          AS FundingAgreement,
    w.FundingPercentage         AS FundingPercentage,
    w.ComponentYear             AS ComponentYear,
    w.ComponentUACS             AS ComponentUACS,
    w.ComponentStartDate        AS ComponentStartDate,
    w.ComponentEndDate          AS ComponentEndDate,
    w.ComponentType             AS ComponentType,
    w.HasStageData              AS HasStageData,

    /* ── Wallet detail (added by LSWallet.Schema.sql) ────────────────────── */
    w.MYId                      AS MYId,
    w.AlternateId               AS AlternateId,
    w.ExternalId                AS ExternalId,
    w.UACS                      AS UACS,
    w.Tier                      AS Tier,
    w.[Rank]                    AS [Rank],
    w.MYCAApprovalDate          AS MYCAApprovalDate,
    w.[Description]             AS [Description],
    w.Province                  AS Province,
    w.City                      AS City,
    w.LegislativeDistrict       AS LegislativeDistrict,
    w.DEO                       AS DEO,
    w.Region                    AS Region,
    w.ImplementingOffice        AS ImplementingOffice,
    w.RegionWide                AS RegionWide,
    w.Origin                    AS Origin,
    w.Agency                    AS Agency,
    w.ImplementationMode        AS ImplementationMode,
    w.EmergencyMode             AS EmergencyMode,
    w.Feasibility               AS Feasibility,
    w.FeasibilityDate           AS FeasibilityDate,
    w.DetailedDesign            AS DetailedDesign,
    w.DetailedDesignDate        AS DetailedDesignDate,
    w.RowAvailable              AS RowAvailable,

    /* Balance. ISNULL fallbacks cover a wallet with no matching balance row. */
    ISNULL(bal.Total,     w.Amount) AS Total,
    ISNULL(bal.Used,      0)        AS Used,
    ISNULL(bal.Available, w.Amount) AS Available,

    /* Drives the WF-7 / flow-doc §6 guard: a wallet cannot be deleted while it
       still has active itemized projects. */
    ISNULL(ps.ProjectCount, 0)  AS ProjectCount,

    w.CreatedBy                 AS CreatedBy,
    w.CreatedDate               AS CreatedDate,
    w.UpdatedBy                 AS UpdatedBy,
    w.UpdatedDate               AS UpdatedDate

FROM dbo.tLSWallets w

JOIN dbo.tPrograms pg
  ON pg.ProgramPK = w.ProgramFK

/* Newest program revision carries the display name (same shape as vProgramLatest). */
OUTER APPLY (
    SELECT TOP 1 r.Name
    FROM   dbo.tProgramRevisions r
    WHERE  r.ProgramFK = pg.ProgramPK
    ORDER  BY r.Id DESC
) pgr

OUTER APPLY (
    SELECT TOP 1 s.StageName
    FROM   dbo.tProgramStages s
    WHERE  s.ProgramFK = pg.ProgramPK
    ORDER  BY s.Id DESC
) pgs

OUTER APPLY (
    SELECT COUNT_BIG(*) AS ProjectCount
    FROM   dbo.vLSWalletProjectSet s
    WHERE  s.ParentWalletId = w.Id
) ps

LEFT JOIN dbo.tOptionProgramType pt        ON pt.NameId     = pg.Type
LEFT JOIN dbo.tOptionProjectCategory cat   ON cat.CategoryId = w.CategoryId
LEFT JOIN dbo.tOptionProjectThrustList thr ON thr.PAPKey     = w.SubCategoryFK
LEFT JOIN dbo.vLSWalletBalance bal         ON bal.WalletId   = w.Id

WHERE w.IsDeleted = 0;
GO
