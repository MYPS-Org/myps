/* =============================================================================
   LS Wallet (Lumpsum) — Phase 1 read-model views
   -----------------------------------------------------------------------------
   This repo is database-first: there is no EF migration pipeline, so schema
   objects are hand-authored here and applied to SQL Server directly.

   Apply AFTER LSWallet.Revisions.Schema.sql, which creates dbo.tLSWallets
   (header), dbo.tLSWalletRevisions, dbo.tLSWalletFundingProfile,
   dbo.tLSWalletComponentCost(PerYear) — this file reads all of those.

   Pre-existing objects this script DEPENDS ON (created elsewhere, do not
   re-create here):
       dbo.tProjects.ParentWalletId        -- FK_tProjects_ParentWallet
       dbo.tProjects.WalletDrawFrozen      -- draw frozen at publish time
       dbo.tProjectFundingProfile.IsWalletDraw

   Objects created by this script:
       dbo.vLSWalletProjectSet   -- one row per ACTIVE itemized project
       dbo.vLSWalletBalance      -- WalletId / Total / Used / Available (live)
       dbo.vLSWalletLatest       -- wallet list grid source (keyed on Id)

   vLSWalletBalance was previously an undocumented live DB object with no
   source file in the repo. It's checked in here for the first time as part
   of documents/plans/lswallet-backend-schema-normalization.md, since its
   Total calculation now sums dbo.tLSWalletFundingProfile instead of reading
   a scalar dbo.tLSWallets.Amount column (which no longer exists).

   Run order matters: vLSWalletLatest reads vLSWalletProjectSet and
   vLSWalletBalance.
   Idempotent — safe to re-run.
   ============================================================================= */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ── Drop in reverse dependency order ─────────────────────────────────────── */
IF OBJECT_ID('dbo.vLSWalletLatest', 'V')     IS NOT NULL DROP VIEW dbo.vLSWalletLatest;
GO
IF OBJECT_ID('dbo.vLSWalletBalance', 'V')    IS NOT NULL DROP VIEW dbo.vLSWalletBalance;
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
   2. dbo.vLSWalletBalance
   -----------------------------------------------------------------------------
   Live Total/Used/Available (decision: no stored counter). Total is now
   SUM(tLSWalletFundingProfile.Amount) over the wallet's active (latest
   non-deleted) revision, instead of the old scalar tLSWallets.Amount column.
   Used = SUM over ACTIVE itemized projects (active = has a non-deleted
   revision, since tProjects has no IsDeleted column). Published ->
   WalletDrawFrozen (frozen at publish); unpublished -> the live
   wallet-flagged funding amount of the latest non-deleted revision.
   Output shape (WalletId, Total, Used, Available) is unchanged from the
   previous (undocumented) live definition — DBHelper/Models/Views/Lumpsum/
   LSWalletBalance.cs and LumpsumController.cs need no changes.
   ============================================================================= */
CREATE VIEW dbo.vLSWalletBalance AS
WITH LatestWalletRevision AS (
    SELECT   wr.Id, wr.WalletFK,
             ROW_NUMBER() OVER (PARTITION BY wr.WalletFK ORDER BY wr.Id DESC) AS rn
    FROM     dbo.tLSWalletRevisions wr
    WHERE    wr.IsDeleted = 0
)
SELECT
    w.Id                  AS WalletId,
    ISNULL(fund.Total, 0) AS Total,
    ISNULL(SUM(CASE WHEN p.IsPublished = 1 THEN p.WalletDrawFrozen ELSE draw.Amount END), 0) AS Used,
    ISNULL(fund.Total, 0) - ISNULL(SUM(CASE WHEN p.IsPublished = 1 THEN p.WalletDrawFrozen ELSE draw.Amount END), 0) AS Available
FROM dbo.tLSWallets w

/* The wallet's own funding total — SUM of the active revision's funding lines. */
OUTER APPLY (
    SELECT SUM(fp.Amount) AS Total
    FROM   LatestWalletRevision lr
    JOIN   dbo.tLSWalletFundingProfile fp
      ON   fp.WalletRevisionFK = lr.Id AND fp.IsDeleted = 0
    WHERE  lr.WalletFK = w.Id AND lr.rn = 1
) fund

LEFT JOIN dbo.tProjects p
       ON p.ParentWalletId = w.Id
      AND p.ProjectType = N'LS'
      AND EXISTS (SELECT 1 FROM dbo.tProjectRevisions pr
                  WHERE pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0)   -- active = has a live revision
OUTER APPLY (
    SELECT TOP 1 fp.Amount
    FROM dbo.tProjectRevisions pr
    JOIN dbo.tProjectFundingProfile fp
      ON fp.ProjectRevisionFK = pr.Id AND fp.IsDeleted = 0 AND fp.IsWalletDraw = 1
    WHERE pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
    ORDER BY pr.Id DESC
) draw
WHERE w.IsDeleted = 0
GROUP BY w.Id, fund.Total;
GO


/* =============================================================================
   3. dbo.vLSWalletLatest
   -----------------------------------------------------------------------------
   Source for the wallet list grid. Exposes Id so Helpers/CursorPagination.cs
   (FilterDataCursor) can keyset-paginate on it, mirroring dbo.vProgramLatest.

   Program display fields are denormalized here rather than stored on
   tLSWallets, so they never go stale when the program is renamed or advanced.

   Detail fields (CategoryId, General Information, Location, Organizational
   Responsibilities, Project Source, Implementation Readiness) come from the
   wallet's active (latest non-deleted) revision in tLSWalletRevisions, via
   the same LatestRevision-CTE pattern vLSWalletProjectSet already uses for
   Projects — NOT from tLSWallets directly, which now only holds header
   fields. Output column names are unchanged from the previous flat-column
   version, so LumpsumController.cs and LSWalletLatest.cs need no changes.
   ============================================================================= */
CREATE VIEW dbo.vLSWalletLatest AS
WITH LatestWalletRevision AS (
    SELECT   wr.*,
             ROW_NUMBER() OVER (PARTITION BY wr.WalletFK ORDER BY wr.Id DESC) AS rn
    FROM     dbo.tLSWalletRevisions wr
    WHERE    wr.IsDeleted = 0
)
SELECT
    w.Id                        AS Id,              -- cursor key
    w.ProgramFK                 AS ProgramFK,
    pg.ProgramId                AS ProgramId,
    pgr.Name                    AS ProgramName,
    pt.Name                     AS TypeName,
    pg.StartYear                AS YearStart,
    pgs.StageName               AS ProgramStageName, -- program's CURRENT stage (informational)
    lr.CategoryId                AS CategoryId,
    cat.CategoryName            AS CategoryName,
    lr.SubCategoryFK             AS SubCategoryFK,
    thr.ThrustDescription       AS SubCategoryName,
    lr.OperatingUnit             AS OperatingUnit,
    w.CurrentStage              AS CurrentStage,     -- wallet's OWN lifecycle stage
    w.HasStageData              AS HasStageData,

    /* ── Wallet detail (from the active revision, tLSWalletRevisions) ─────── */
    w.MYId                      AS MYId,
    lr.AlternateId               AS AlternateId,
    w.ExternalId                AS ExternalId,
    lr.UACS                      AS UACS,
    lr.Tier                      AS Tier,
    lr.[Rank]                    AS [Rank],
    lr.MYCAApprovalDate          AS MYCAApprovalDate,
    lr.[Description]             AS [Description],
    lr.Province                  AS Province,
    lr.City                      AS City,
    lr.LegislativeDistrict       AS LegislativeDistrict,
    lr.DEO                       AS DEO,
    lr.Region                    AS Region,
    lr.ImplementingOffice        AS ImplementingOffice,
    lr.RegionWide                AS RegionWide,
    lr.Origin                    AS Origin,
    lr.Agency                    AS Agency,
    lr.ImplementationMode        AS ImplementationMode,
    lr.EmergencyMode             AS EmergencyMode,
    lr.Feasibility               AS Feasibility,
    lr.FeasibilityDate           AS FeasibilityDate,
    lr.DetailedDesign            AS DetailedDesign,
    lr.DetailedDesignDate        AS DetailedDesignDate,
    lr.RowAvailable              AS RowAvailable,

    /* Balance. ISNULL fallbacks cover a wallet with no matching balance row. */
    ISNULL(bal.Total,     0) AS Total,
    ISNULL(bal.Used,      0) AS Used,
    ISNULL(bal.Available, 0) AS Available,

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

/* Wallet must have exactly one active revision, same invariant as a Project. */
JOIN LatestWalletRevision lr
  ON lr.WalletFK = w.Id
 AND lr.rn = 1

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
LEFT JOIN dbo.tOptionProjectCategory cat   ON cat.CategoryId = lr.CategoryId
LEFT JOIN dbo.tOptionProjectThrustList thr ON thr.PAPKey     = lr.SubCategoryFK
LEFT JOIN dbo.vLSWalletBalance bal         ON bal.WalletId   = w.Id

WHERE w.IsDeleted = 0;
GO
