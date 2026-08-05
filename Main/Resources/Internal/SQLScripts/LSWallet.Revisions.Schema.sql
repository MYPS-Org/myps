/* =============================================================================
   LS Wallet (Lumpsum) — normalized schema (header + revision + funding/component)
   -----------------------------------------------------------------------------
   SUPERSEDES LSWallet.Schema.sql. That script kept dbo.tLSWallets flat by
   design — "one funding source, one fixed 'LS' component line" — which was a
   deliberate Phase-1 decision. The frontend has since moved past it
   (documents/plans/lswallet-project-uniformity.md, implemented 2026-07-13):
   FE/src/pages/LSWallet/Model.d.ts now expects WalletFundingProfiles[],
   WalletComponentCosts[]/WalletComponentCostPerYear[] — multi-row arrays —
   plus full Project-detail-parity fields. This script reverses the flat
   design and normalizes dbo.tLSWallets into a header + revision + funding +
   component-cost shape mirroring dbo.tProjects / tProjectRevisions /
   tProjectFundingProfile / tProjectComponentCost / tProjectComponentCostPerYear
   column-for-column. See documents/plans/lswallet-backend-schema-normalization.md.

   Do NOT run LSWallet.Schema.sql after this script — its ALTER TABLE ADD
   statements target columns this script removes. LSWallet.Schema.sql is left
   in the repo for history only.

   Revision-ready, not revision-active: dbo.tLSWalletRevisions supports
   multiple revision rows per wallet structurally (same FK-chain shape as
   tProjectRevisions), but no revisioning workflow exists yet — the
   application maintains exactly one non-deleted revision row per wallet,
   the same "latest non-deleted revision" pattern already used for Projects
   (see the LatestRevision CTE in vLSWalletProjectSet / vLSWalletLatest).

   dbo.tLSWallets ships empty on every environment this has been checked
   against (confirmed 0 rows before this script was written), so this drops
   and recreates the table rather than carrying a column-existence-guarded
   data migration for columns that may not even exist depending on whether
   LSWallet.Schema.sql was ever run in a given environment. If a shared dev
   DB has wallet rows when this runs, back them up first — this is a
   destructive reset for dbo.tLSWallets specifically, no other table is
   dropped.

   Apply BEFORE LSWallet.sql (the views read the columns/tables created here)
   and BEFORE LSWallet.Seed.Dev.sql.

   Idempotent — safe to re-run.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0a. Project type: allow 'NP'
   -----------------------------------------------------------------------------
   Carried forward from LSWallet.Schema.sql section 1 (that file's section 2,
   the flat tLSWallets columns, is what this script actually supersedes — this
   constraint change is independent of the flat-vs-normalized wallet question
   and still needs to run).
   MY  = Multi-Year          LS = Itemized Lumpsum (draws on a wallet)
   AIP = Regular AIP         NP = Non Project (never published to PCMA)
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_tProjects_ProjectType')
    ALTER TABLE dbo.tProjects DROP CONSTRAINT CK_tProjects_ProjectType;
GO

ALTER TABLE dbo.tProjects WITH CHECK
    ADD CONSTRAINT CK_tProjects_ProjectType
    CHECK (ProjectType IN (N'MY', N'LS', N'AIP', N'NP'));
GO


/* =============================================================================
   0b. Drop dependents in reverse dependency order
   -----------------------------------------------------------------------------
   vLSWalletLatest / vLSWalletBalance read dbo.tLSWallets directly and are
   recreated by LSWallet.sql after this script runs. FK_tProjects_ParentWallet
   must be dropped before tLSWallets can be dropped/recreated, then reapplied
   pointing at the recreated table.
   ============================================================================= */
IF OBJECT_ID('dbo.vLSWalletLatest', 'V')  IS NOT NULL DROP VIEW dbo.vLSWalletLatest;
GO
IF OBJECT_ID('dbo.vLSWalletBalance', 'V') IS NOT NULL DROP VIEW dbo.vLSWalletBalance;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tProjects_ParentWallet')
    ALTER TABLE dbo.tProjects DROP CONSTRAINT FK_tProjects_ParentWallet;
GO
IF OBJECT_ID('dbo.tLSWalletComponentCostPerYear', 'U') IS NOT NULL DROP TABLE dbo.tLSWalletComponentCostPerYear;
GO
IF OBJECT_ID('dbo.tLSWalletComponentCost', 'U')        IS NOT NULL DROP TABLE dbo.tLSWalletComponentCost;
GO
IF OBJECT_ID('dbo.tLSWalletFundingProfile', 'U')       IS NOT NULL DROP TABLE dbo.tLSWalletFundingProfile;
GO
IF OBJECT_ID('dbo.tLSWalletRevisions', 'U')            IS NOT NULL DROP TABLE dbo.tLSWalletRevisions;
GO
IF OBJECT_ID('dbo.tLSWallets', 'U')                    IS NOT NULL DROP TABLE dbo.tLSWallets;
GO


/* =============================================================================
   1. dbo.tLSWallets — header (identity + lifecycle only)
   -----------------------------------------------------------------------------
   Mirrors the tProjects/tProjectRevisions split: MYId/ExternalId stay on the
   header (Project keeps them on tProjects, not tProjectRevisions). Everything
   else — category/thrust/operating unit, General Information, Location,
   Organizational Responsibilities, Project Source, Implementation Readiness —
   moves to tLSWalletRevisions. Amount and ComponentType are dropped entirely:
   Amount is derived (SUM of the active revision's funding lines, computed in
   the views), ComponentType becomes a per-row column on tLSWalletComponentCost.
   ============================================================================= */
CREATE TABLE dbo.tLSWallets
(
    Id            int IDENTITY(1,1) NOT NULL,
    ProgramFK     nvarchar(200)     NOT NULL,   -- FK -> dbo.tPrograms(ProgramPK)
    MYId          nvarchar(200)     NULL,
    ExternalId    nvarchar(200)     NULL,
    CurrentStage  nvarchar(20)      NULL,        -- wallet's own lifecycle stage (BP/NEP/HGAB/GAA/GAA-R)
    HasStageData  bit               NOT NULL CONSTRAINT DF_tLSWallets_HasStageData DEFAULT (0),
    CreatedBy     nvarchar(100)     NOT NULL,
    CreatedDate   datetime          NOT NULL,
    UpdatedBy     nvarchar(100)     NULL,
    UpdatedDate   datetime          NULL,
    IsDeleted     bit               NOT NULL CONSTRAINT DF_tLSWallets_IsDeleted DEFAULT (0),

    CONSTRAINT PK_tLSWallets PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_tLSWallets_Program FOREIGN KEY (ProgramFK) REFERENCES dbo.tPrograms (ProgramPK)
);
GO
CREATE NONCLUSTERED INDEX IX_tLSWallets_ProgramFK ON dbo.tLSWallets (ProgramFK);
GO

ALTER TABLE dbo.tProjects WITH CHECK
    ADD CONSTRAINT FK_tProjects_ParentWallet FOREIGN KEY (ParentWalletId) REFERENCES dbo.tLSWallets (Id);
GO


/* =============================================================================
   2. dbo.tLSWalletRevisions — revision-ready detail (one active row per wallet, today)
   -----------------------------------------------------------------------------
   Geo/org/readiness/category fields are nullable — unlike tProjectRevisions'
   NOT NULL equivalents — because a wallet is program-wide, not site-specific
   (matches the FE's own "no required asterisk" treatment of these fields,
   see lswallet-project-uniformity.md). UACS has no Project-table equivalent
   (Project derives it per component-cost-year row); kept here as a single
   wallet-level field since the wallet form collects it that way.
   ============================================================================= */
CREATE TABLE dbo.tLSWalletRevisions
(
    Id                  int IDENTITY(1,1) NOT NULL,
    WalletFK            int               NOT NULL,   -- FK -> dbo.tLSWallets(Id)
    CategoryId          int               NULL,        -- FK -> dbo.tOptionProjectCategory(CategoryId)
    SubCategoryFK       int               NULL,        -- Thrust. FK -> dbo.tOptionProjectThrustList(PAPKey)
    OperatingUnit       nvarchar(20)      NULL,
    AlternateId         nvarchar(400)     NULL,
    MYCAApprovalDate    datetime          NULL,
    [Description]       nvarchar(max)     NULL,
    Region              nvarchar(20)      NULL,
    Province            nvarchar(20)      NULL,
    City                nvarchar(20)      NULL,
    LegislativeDistrict nvarchar(20)      NULL,
    DEO                 nvarchar(20)      NULL,
    ImplementingOffice  nvarchar(20)      NULL,
    Origin              int               NULL,
    Agency              int               NULL,
    ImplementationMode  int               NULL,
    EmergencyMode       int               NULL,
    RegionWide          int               NULL,
    Feasibility         int               NULL,
    FeasibilityDate     datetime          NULL,
    DetailedDesign      int               NULL,
    DetailedDesignDate  datetime          NULL,
    RowAvailable        int               NULL,
    Tier                int               NULL,
    [Rank]              float             NULL,
    UACS                nvarchar(50)      NULL,
    CreatedBy           nvarchar(100)     NOT NULL,
    CreatedDate         datetime          NOT NULL,
    UpdatedBy           nvarchar(100)     NULL,
    UpdatedDate         datetime          NULL,
    IsDeleted           bit               NOT NULL CONSTRAINT DF_tLSWalletRevisions_IsDeleted DEFAULT (0),

    CONSTRAINT PK_tLSWalletRevisions PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_tLSWalletRevisions_Wallet FOREIGN KEY (WalletFK) REFERENCES dbo.tLSWallets (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_tLSWalletRevisions_WalletFK ON dbo.tLSWalletRevisions (WalletFK);
GO


/* =============================================================================
   3. dbo.tLSWalletFundingProfile — multi-line funding, mirrors tProjectFundingProfile
   -----------------------------------------------------------------------------
   No IsWalletDraw column — that flag marks the draw-line on an ITEMIZED
   PROJECT's funding profile (tProjectFundingProfile.IsWalletDraw); it has no
   meaning on the wallet's own funding lines.
   ============================================================================= */
CREATE TABLE dbo.tLSWalletFundingProfile
(
    Id               int IDENTITY(1,1)  NOT NULL,
    WalletRevisionFK int                NOT NULL,   -- FK -> dbo.tLSWalletRevisions(Id)
    SourceOrg        nvarchar(100)      NOT NULL,    -- FK -> dbo.tOptionFundingSource(Organization)
    AgreementCode    nvarchar(50)       NOT NULL,    -- FK -> dbo.tOptionFundingAgreement(Code)
    Amount           decimal(18,5)      NOT NULL,
    Percentage       float              NOT NULL,
    CreatedBy        nvarchar(100)      NOT NULL,
    CreatedDate      datetime           NOT NULL,
    UpdatedBy        nvarchar(100)      NULL,
    UpdatedDate      datetime           NULL,
    IsDeleted        bit                NOT NULL CONSTRAINT DF_tLSWalletFundingProfile_IsDeleted DEFAULT (0),

    CONSTRAINT PK_tLSWalletFundingProfile PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_tLSWalletFundingProfile_Revision FOREIGN KEY (WalletRevisionFK) REFERENCES dbo.tLSWalletRevisions (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_tLSWalletFundingProfile_WalletRevisionFK ON dbo.tLSWalletFundingProfile (WalletRevisionFK);
GO


/* =============================================================================
   4. dbo.tLSWalletComponentCost / dbo.tLSWalletComponentCostPerYear
   -----------------------------------------------------------------------------
   Mirror tProjectComponentCost / tProjectComponentCostPerYear column-for-column.
   ComponentType defaults to 'LS' (the wallet's own component-cost dialog is
   the one place 'LS' is selectable — itemized projects exclude it via
   WALLET_EXCLUSIVE_COMPONENT_TYPES on the FE).
   ============================================================================= */
CREATE TABLE dbo.tLSWalletComponentCost
(
    Id               int IDENTITY(1,1) NOT NULL,
    WalletRevisionFK int               NOT NULL,   -- FK -> dbo.tLSWalletRevisions(Id)
    ComponentType    nvarchar(10)      NOT NULL CONSTRAINT DF_tLSWalletComponentCost_ComponentType DEFAULT (N'LS'), -- FK -> dbo.tOptionProjectComponentType(ComponentId)
    ComponentId      nvarchar(10)      NOT NULL,
    [Description]    nvarchar(max)     NULL,
    Total            decimal(18,5)     NOT NULL,
    CreatedBy        nvarchar(100)     NOT NULL,
    CreatedDate      datetime          NOT NULL,
    UpdatedBy        nvarchar(100)     NULL,
    UpdatedDate      datetime          NULL,
    IsDeleted        bit               NOT NULL CONSTRAINT DF_tLSWalletComponentCost_IsDeleted DEFAULT (0),

    CONSTRAINT PK_tLSWalletComponentCost PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_tLSWalletComponentCost_Revision FOREIGN KEY (WalletRevisionFK) REFERENCES dbo.tLSWalletRevisions (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_tLSWalletComponentCost_WalletRevisionFK ON dbo.tLSWalletComponentCost (WalletRevisionFK);
GO

CREATE TABLE dbo.tLSWalletComponentCostPerYear
(
    Id              int IDENTITY(1,1)  NOT NULL,
    ComponentCostFK int                NOT NULL,   -- FK -> dbo.tLSWalletComponentCost(Id)
    Amount          decimal(18,5)      NOT NULL,
    Year            int                NOT NULL,
    UACS            nvarchar(50)       NULL,
    StartDate       datetime           NULL,
    EndDate         datetime           NULL,
    CreatedBy       nvarchar(100)      NOT NULL,
    CreatedDate     datetime           NOT NULL,
    UpdatedBy       nvarchar(100)      NULL,
    UpdatedDate     datetime           NULL,
    IsDeleted       bit                NOT NULL CONSTRAINT DF_tLSWalletComponentCostPerYear_IsDeleted DEFAULT (0),

    CONSTRAINT PK_tLSWalletComponentCostPerYear PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_tLSWalletComponentCostPerYear_ComponentCost FOREIGN KEY (ComponentCostFK) REFERENCES dbo.tLSWalletComponentCost (Id)
);
GO
CREATE NONCLUSTERED INDEX IX_tLSWalletComponentCostPerYear_ComponentCostFK ON dbo.tLSWalletComponentCostPerYear (ComponentCostFK);
GO


/* ── Verification ─────────────────────────────────────────────────────────── */
PRINT '--- tables created ---';
SELECT name FROM sys.tables
WHERE name IN (N'tLSWallets', N'tLSWalletRevisions', N'tLSWalletFundingProfile',
               N'tLSWalletComponentCost', N'tLSWalletComponentCostPerYear')
ORDER BY name;

PRINT '--- FKs ---';
SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS ParentTable, OBJECT_NAME(fk.referenced_object_id) AS RefTable
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) LIKE 'tLSWallet%' OR OBJECT_NAME(fk.parent_object_id) = 'tProjects'
ORDER BY ParentTable;
GO
