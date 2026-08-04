/* =============================================================================
   LS Wallet (Lumpsum) — schema extensions
   -----------------------------------------------------------------------------
   *** SUPERSEDED — DO NOT RUN. ***
   Section 2 (the flat tLSWallets columns) is replaced by
   LSWallet.Revisions.Schema.sql, which normalizes dbo.tLSWallets into a
   header + tLSWalletRevisions + tLSWalletFundingProfile +
   tLSWalletComponentCost(PerYear) shape instead. Section 1 (the
   CK_tProjects_ProjectType 'NP' addition) is independent of that and has
   been carried forward into LSWallet.Revisions.Schema.sql's own section 0a,
   so it still takes effect — this whole file is kept here for history only.
   See documents/plans/lswallet-backend-schema-normalization.md.

   Apply BEFORE LSWallet.sql (the views read the columns added here).

   1. Adds 'NP' (Non Project) to CK_tProjects_ProjectType. Flow doc §7 requires
      an NP type that is excluded from publishing, but the constraint previously
      allowed only 'MY', 'LS' and 'AIP'.
   2. Adds the wallet detail columns the LSWallet UI collects but had nowhere to
      store (FE/src/pages/LSWallet/Model.d.ts). These are all scalar, so the
      wallet stays flat — one funding line and one component year per wallet.

   Idempotent — safe to re-run.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   1. Project type: allow 'NP'
   -----------------------------------------------------------------------------
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
   2. tLSWallets — wallet detail columns
   ============================================================================= */

/* ── General Information ──────────────────────────────────────────────────── */
IF COL_LENGTH('dbo.tLSWallets', 'MYId')             IS NULL ALTER TABLE dbo.tLSWallets ADD MYId             nvarchar(200)  NULL;
IF COL_LENGTH('dbo.tLSWallets', 'AlternateId')      IS NULL ALTER TABLE dbo.tLSWallets ADD AlternateId      nvarchar(400)  NULL;
IF COL_LENGTH('dbo.tLSWallets', 'ExternalId')       IS NULL ALTER TABLE dbo.tLSWallets ADD ExternalId       nvarchar(200)  NULL;
/* Distinct from ComponentUACS: this is the wallet-level UACS shown under
   General Information; ComponentUACS belongs to the component/fiscal-year row. */
IF COL_LENGTH('dbo.tLSWallets', 'UACS')             IS NULL ALTER TABLE dbo.tLSWallets ADD UACS             nvarchar(50)   NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Tier')             IS NULL ALTER TABLE dbo.tLSWallets ADD Tier             int            NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Rank')             IS NULL ALTER TABLE dbo.tLSWallets ADD [Rank]           float          NULL;
IF COL_LENGTH('dbo.tLSWallets', 'MYCAApprovalDate') IS NULL ALTER TABLE dbo.tLSWallets ADD MYCAApprovalDate datetime       NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Description')      IS NULL ALTER TABLE dbo.tLSWallets ADD [Description]    nvarchar(max)  NULL;
GO

/* ── Location Details (GdbId references) ──────────────────────────────────── */
IF COL_LENGTH('dbo.tLSWallets', 'Province')            IS NULL ALTER TABLE dbo.tLSWallets ADD Province            nvarchar(20) NULL;
IF COL_LENGTH('dbo.tLSWallets', 'City')                IS NULL ALTER TABLE dbo.tLSWallets ADD City                nvarchar(20) NULL;
IF COL_LENGTH('dbo.tLSWallets', 'LegislativeDistrict') IS NULL ALTER TABLE dbo.tLSWallets ADD LegislativeDistrict nvarchar(20) NULL;
GO

/* ── Organizational Responsibilities (ParticipantId references) ───────────── */
IF COL_LENGTH('dbo.tLSWallets', 'DEO')                IS NULL ALTER TABLE dbo.tLSWallets ADD DEO                nvarchar(20) NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Region')             IS NULL ALTER TABLE dbo.tLSWallets ADD Region             nvarchar(20) NULL;
IF COL_LENGTH('dbo.tLSWallets', 'ImplementingOffice') IS NULL ALTER TABLE dbo.tLSWallets ADD ImplementingOffice nvarchar(20) NULL;
/* 1 = Region Wide, 2 = Non-Region Wide, 3 = Region Wide AIP ignores DEO */
IF COL_LENGTH('dbo.tLSWallets', 'RegionWide')         IS NULL ALTER TABLE dbo.tLSWallets ADD RegionWide         int          NULL;
GO

/* ── Project Source ───────────────────────────────────────────────────────── */
IF COL_LENGTH('dbo.tLSWallets', 'Origin') IS NULL ALTER TABLE dbo.tLSWallets ADD Origin int NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Agency') IS NULL ALTER TABLE dbo.tLSWallets ADD Agency int NULL;
GO

/* ── Implementation Readiness and Modality ────────────────────────────────── */
IF COL_LENGTH('dbo.tLSWallets', 'ImplementationMode') IS NULL ALTER TABLE dbo.tLSWallets ADD ImplementationMode int      NULL;
IF COL_LENGTH('dbo.tLSWallets', 'EmergencyMode')      IS NULL ALTER TABLE dbo.tLSWallets ADD EmergencyMode      int      NULL;
IF COL_LENGTH('dbo.tLSWallets', 'Feasibility')        IS NULL ALTER TABLE dbo.tLSWallets ADD Feasibility        int      NULL;
IF COL_LENGTH('dbo.tLSWallets', 'FeasibilityDate')    IS NULL ALTER TABLE dbo.tLSWallets ADD FeasibilityDate    datetime NULL;
IF COL_LENGTH('dbo.tLSWallets', 'DetailedDesign')     IS NULL ALTER TABLE dbo.tLSWallets ADD DetailedDesign     int      NULL;
IF COL_LENGTH('dbo.tLSWallets', 'DetailedDesignDate') IS NULL ALTER TABLE dbo.tLSWallets ADD DetailedDesignDate datetime NULL;
IF COL_LENGTH('dbo.tLSWallets', 'RowAvailable')       IS NULL ALTER TABLE dbo.tLSWallets ADD RowAvailable       int      NULL;
GO

/* ── Workflow flags ───────────────────────────────────────────────────────── */
/* HasStageData drives the WF-7 delete-tier matrix: false = wallet untouched
   since creation (hard delete allowed), true = soft delete only. */
IF COL_LENGTH('dbo.tLSWallets', 'HasStageData') IS NULL
    ALTER TABLE dbo.tLSWallets ADD HasStageData bit NOT NULL CONSTRAINT DF_tLSWallets_HasStageData DEFAULT (0);
GO
/* Always 'LS' — locked at creation. Stored so the value survives a raw export. */
IF COL_LENGTH('dbo.tLSWallets', 'ComponentType') IS NULL
    ALTER TABLE dbo.tLSWallets ADD ComponentType nvarchar(10) NOT NULL CONSTRAINT DF_tLSWallets_ComponentType DEFAULT (N'LS');
GO


/* ── Verification ─────────────────────────────────────────────────────────── */
PRINT '--- CK_tProjects_ProjectType ---';
SELECT definition FROM sys.check_constraints WHERE name = 'CK_tProjects_ProjectType';

PRINT '--- tLSWallets columns ---';
SELECT ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
       ISNULL(CONVERT(varchar, CHARACTER_MAXIMUM_LENGTH), '') AS Len, IS_NULLABLE
FROM   INFORMATION_SCHEMA.COLUMNS
WHERE  TABLE_NAME = 'tLSWallets'
ORDER  BY ORDINAL_POSITION;
GO
