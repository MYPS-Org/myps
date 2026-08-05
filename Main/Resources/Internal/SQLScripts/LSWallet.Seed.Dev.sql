/* =============================================================================
   LS Wallet (Lumpsum) — DEVELOPMENT SEED DATA
   -----------------------------------------------------------------------------
   *** DEV / LOCAL ONLY — DO NOT RUN AGAINST STAGING OR PRODUCTION. ***

   Apply after LSWallet.Schema.sql and LSWallet.sql.

   dbo.tLSWallets ships empty, so every wallet grid renders blank until this
   runs. The matrix below exercises each branch of vLSWalletBalance and
   vLSWalletProjectSet, including ALL FOUR project types.

     Wallet A (PRG-2026-B001, 100,000,000) -- project-type discrimination
        LS  BP01000092LZ  45,000,000  unpublished  -> COUNTED
        LS  BP01000093LZ  25,000,000  unpublished  -> COUNTED
        AIP BP01000094LZ  15,000,000               -> EXCLUDED
        NP  BP01000095LZ  18,000,000               -> EXCLUDED
        MY  BP01000096LZ  22,000,000               -> EXCLUDED
        Every one of the five is attached to the wallet AND flagged
        IsWalletDraw = 1, so if the ProjectType filter ever regressed, Used
        would jump from 70,000,000 to 125,000,000.
        Expected: Used 70,000,000  Available 30,000,000  ProjectCount 2

     Wallet B (PRG-2026-A001, 200,000,000) -- publish / freeze behaviour
        LS  BP01000090LZ  PUBLISHED, WalletDrawFrozen 72,000,000
            (this project has two funding lines: GOP 72M flagged IsWalletDraw
             and ADB 48M not flagged -- the ADB line must be ignored)
        LS  BP01000091LZ  30,000,000  unpublished
        Expected: Used 102,000,000  Available 98,000,000  ProjectCount 2

     Wallet C (PRG-2026-C001, 50,000,000) -- empty wallet
        Expected: Used 0  Available 50,000,000  ProjectCount 0

   Idempotent: re-running resets the project flags and rebuilds the wallets.
   ============================================================================= */

/* sqlcmd connects with QUOTED_IDENTIFIER OFF, which SQL Server rejects for any
   DML against a table involved in an indexed view / filtered index. Set both
   explicitly so the script behaves the same however it is invoked. */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @SeededBy nvarchar(100) = N'seed-dev';

/* ── 1. Reset anything a previous run touched ─────────────────────────────── */

/* Only the projects this script itself itemizes are reset, so a re-run can
   never clobber the ProjectType of rows that some other work attached. */
DECLARE @Seeded TABLE (ProjectPK nvarchar(200) PRIMARY KEY);
INSERT INTO @Seeded (ProjectPK) VALUES
    (N'BP01000090LZ'), (N'BP01000091LZ'), (N'BP01000092LZ'),
    (N'BP01000093LZ'), (N'BP01000094LZ'), (N'BP01000095LZ'),
    (N'BP01000096LZ');

UPDATE p
   SET p.ParentWalletId   = NULL,
       p.WalletDrawFrozen = NULL,
       p.ProjectType      = N'AIP'
FROM dbo.tProjects p
WHERE p.ProjectPK IN (SELECT ProjectPK FROM @Seeded);

/* Clear the wallet-draw flag on those same projects only. */
UPDATE fp
   SET fp.IsWalletDraw = 0
FROM dbo.tProjectFundingProfile fp
JOIN dbo.tProjectRevisions pr ON pr.Id = fp.ProjectRevisionFK
WHERE pr.ProjectFK IN (SELECT ProjectPK FROM @Seeded)
  AND fp.IsWalletDraw = 1;

/* Wallets are referenced by FK_tProjects_ParentWallet, which the reset above
   has just cleared, so a hard delete is safe here. */
DELETE FROM dbo.tLSWallets WHERE CreatedBy = @SeededBy;


/* ── 2. Wallets ───────────────────────────────────────────────────────────── */

DECLARE @WalletA int, @WalletB int, @WalletC int;

INSERT INTO dbo.tLSWallets
    (ProgramFK, CategoryId, SubCategoryFK, OperatingUnit,
     FundingSource, FundingAgreement, Amount, FundingPercentage, CurrentStage,
     ComponentYear, ComponentUACS, ComponentStartDate, ComponentEndDate,
     ComponentType, HasStageData,
     MYId, AlternateId, ExternalId, UACS, Tier, [Rank], MYCAApprovalDate, [Description],
     Province, City, LegislativeDistrict,
     DEO, Region, ImplementingOffice, RegionWide,
     Origin, Agency, ImplementationMode, EmergencyMode,
     Feasibility, FeasibilityDate, DetailedDesign, DetailedDesignDate, RowAvailable,
     CreatedBy, CreatedDate, IsDeleted)
VALUES
    (N'PRG-2026-B001', 2, 1003, N'10-001',
     N'GOP', N'GAA-2026', 100000000.00, 100, N'NEP',
     2026, N'2026-101-1-04-002', '2026-01-01', '2026-12-31',
     N'LS', 0,
     N'MY-2026-0001', N'ALT-LS-A', N'EXT-LS-A', N'2026-101-1-04-002', 1, 1.5, '2026-02-15',
     N'Flood control lumpsum wallet for FY2026 -- Region IV-A.',
     N'0421', N'042108', N'042101',
     N'OI237', N'OI237', N'OI237', 2,
     1, 1, 1, 2,
     1, '2026-01-20', 1, '2026-03-10', 1,
     @SeededBy, GETDATE(), 0);
SET @WalletA = SCOPE_IDENTITY();

INSERT INTO dbo.tLSWallets
    (ProgramFK, CategoryId, SubCategoryFK, OperatingUnit,
     FundingSource, FundingAgreement, Amount, FundingPercentage, CurrentStage,
     ComponentYear, ComponentUACS, ComponentStartDate, ComponentEndDate,
     ComponentType, HasStageData,
     MYId, AlternateId, ExternalId, UACS, Tier, [Rank], MYCAApprovalDate, [Description],
     Province, City, LegislativeDistrict,
     DEO, Region, ImplementingOffice, RegionWide,
     Origin, Agency, ImplementationMode, EmergencyMode,
     Feasibility, FeasibilityDate, DetailedDesign, DetailedDesignDate, RowAvailable,
     CreatedBy, CreatedDate, IsDeleted)
VALUES
    (N'PRG-2026-A001', 1, 1004, N'10-001',
     N'GOP', N'GAA-2026', 200000000.00, 100, N'GAA',
     2026, N'2026-101-1-04-003', '2026-01-01', '2026-12-31',
     N'LS', 1,
     N'MY-2026-0002', N'ALT-LS-B', N'EXT-LS-B', N'2026-101-1-04-003', 2, 2.0, '2026-01-30',
     N'National road network lumpsum wallet for FY2026 -- already at GAA.',
     N'0434', N'043401', N'043401',
     N'OI234', N'OI234', N'OI234', 1,
     2, 1, 2, 1,
     2, '2026-02-01', 2, '2026-04-01', 2,
     @SeededBy, GETDATE(), 0);
SET @WalletB = SCOPE_IDENTITY();

/* Wallet C is left sparse on purpose: it proves the view's ISNULL fallbacks and
   that the UI copes with a wallet whose optional detail was never filled in. */
INSERT INTO dbo.tLSWallets
    (ProgramFK, CategoryId, SubCategoryFK, OperatingUnit,
     FundingSource, FundingAgreement, Amount, FundingPercentage, CurrentStage,
     ComponentYear, ComponentUACS, ComponentStartDate, ComponentEndDate,
     ComponentType, HasStageData, [Description],
     CreatedBy, CreatedDate, IsDeleted)
VALUES
    (N'PRG-2026-C001', 6, 1001, N'10-001',
     N'GOP', N'GAA-2026', 50000000.00, 100, N'BP',
     2026, N'2026-101-1-04-004', '2026-01-01', '2026-12-31',
     N'LS', 0, N'Empty wallet -- no itemized projects yet.',
     @SeededBy, GETDATE(), 0);
SET @WalletC = SCOPE_IDENTITY();


/* ── 3. Itemize projects against the wallets ──────────────────────────────── */
/* Projects are addressed by ProjectPK (stable) rather than Id (identity).
   IsPublished is set explicitly on every seeded project: some rows ship
   already-published in the base data, and a published project whose
   WalletDrawFrozen is NULL contributes 0 to Used -- leaving it to chance
   silently changes the expected balances. */

/* Wallet A — all four project types, only the two LS rows may count. */
UPDATE dbo.tProjects SET ParentWalletId = @WalletA, ProjectType = N'LS',
       WalletDrawFrozen = NULL, IsPublished = 0
WHERE ProjectPK IN (N'BP01000092LZ', N'BP01000093LZ');

UPDATE dbo.tProjects SET ParentWalletId = @WalletA, ProjectType = N'AIP',
       WalletDrawFrozen = NULL, IsPublished = 0
WHERE ProjectPK = N'BP01000094LZ';

UPDATE dbo.tProjects SET ParentWalletId = @WalletA, ProjectType = N'NP',
       WalletDrawFrozen = NULL, IsPublished = 0
WHERE ProjectPK = N'BP01000095LZ';

UPDATE dbo.tProjects SET ParentWalletId = @WalletA, ProjectType = N'MY',
       WalletDrawFrozen = NULL, IsPublished = 0
WHERE ProjectPK = N'BP01000096LZ';

/* Wallet B — one published (draw frozen), one live. */
UPDATE dbo.tProjects SET ParentWalletId = @WalletB, ProjectType = N'LS',
       WalletDrawFrozen = 72000000.00, IsPublished = 1
WHERE ProjectPK = N'BP01000090LZ';

UPDATE dbo.tProjects SET ParentWalletId = @WalletB, ProjectType = N'LS',
       WalletDrawFrozen = NULL, IsPublished = 0
WHERE ProjectPK = N'BP01000091LZ';

/* Wallet C is intentionally left empty. */


/* ── 4. Flag the funding line that draws on the wallet ────────────────────── */
/* Deliberately applied to EVERY seeded project regardless of ProjectType, so
   the ProjectType filter in vLSWalletProjectSet / vLSWalletBalance is the only
   thing keeping AIP / NP / MY out of the totals.
   On BP01000090LZ only the GOP line is flagged, so its 48,000,000 ADB line
   must be ignored. */
UPDATE fp
   SET fp.IsWalletDraw = 1
FROM dbo.tProjectFundingProfile fp
JOIN dbo.tProjectRevisions pr ON pr.Id = fp.ProjectRevisionFK
JOIN dbo.tProjects p          ON p.ProjectPK = pr.ProjectFK
WHERE p.ParentWalletId IS NOT NULL
  AND pr.IsDeleted = 0
  AND fp.IsDeleted = 0
  AND fp.SourceOrg = N'GOP'
  AND pr.Id = (
        SELECT MAX(x.Id) FROM dbo.tProjectRevisions x
        WHERE x.ProjectFK = p.ProjectPK AND x.IsDeleted = 0
      );

COMMIT TRANSACTION;
GO


/* ── 5. Verification ──────────────────────────────────────────────────────── */
PRINT '--- vLSWalletLatest ---';
SELECT Id, ProgramId, ProgramName, CurrentStage, Amount, Total, Used, Available, ProjectCount
FROM   dbo.vLSWalletLatest
ORDER  BY Id;

PRINT '--- every project attached to a wallet, by type (only LS may appear in the set) ---';
SELECT p.ParentWalletId, p.ProjectType, pr.ProjectId, p.IsPublished,
       fp.Amount AS FlaggedDraw,
       CASE WHEN s.Id IS NULL THEN 'excluded' ELSE 'IN SET' END AS InProjectSet
FROM   dbo.tProjects p
OUTER APPLY (SELECT TOP 1 * FROM dbo.tProjectRevisions x
             WHERE x.ProjectFK = p.ProjectPK AND x.IsDeleted = 0 ORDER BY x.Id DESC) pr
OUTER APPLY (SELECT TOP 1 f.Amount FROM dbo.tProjectFundingProfile f
             WHERE f.ProjectRevisionFK = pr.Id AND f.IsDeleted = 0 AND f.IsWalletDraw = 1) fp
LEFT  JOIN dbo.vLSWalletProjectSet s ON s.Id = p.Id
WHERE  p.ParentWalletId IS NOT NULL
ORDER  BY p.ParentWalletId, p.ProjectType, pr.ProjectId;

PRINT '--- vLSWalletBalance vs SUM(EffectiveDraw) : Delta must be 0 ---';
SELECT b.WalletId, b.Total, b.Used, b.Available,
       ISNULL(s.SumDraw, 0)         AS SumEffectiveDraw,
       b.Used - ISNULL(s.SumDraw,0) AS Delta
FROM   dbo.vLSWalletBalance b
OUTER APPLY (
    SELECT SUM(x.EffectiveDraw) AS SumDraw
    FROM   dbo.vLSWalletProjectSet x
    WHERE  x.ParentWalletId = b.WalletId
) s
ORDER BY b.WalletId;

PRINT '--- leakage check: non-LS money that must NOT be in Used ---';
SELECT p.ProjectType, SUM(fp.Amount) AS FlaggedButExcluded
FROM   dbo.tProjects p
OUTER APPLY (SELECT TOP 1 * FROM dbo.tProjectRevisions x
             WHERE x.ProjectFK = p.ProjectPK AND x.IsDeleted = 0 ORDER BY x.Id DESC) pr
JOIN   dbo.tProjectFundingProfile fp
       ON fp.ProjectRevisionFK = pr.Id AND fp.IsDeleted = 0 AND fp.IsWalletDraw = 1
WHERE  p.ParentWalletId IS NOT NULL AND p.ProjectType <> N'LS'
GROUP  BY p.ProjectType;
GO
