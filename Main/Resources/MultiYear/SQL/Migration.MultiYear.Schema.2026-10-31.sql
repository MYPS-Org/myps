/* =============================================================================
   Migration — Multi-Year module, Phase 1: portfolios and planning projects
   Date: 2026-10-31
   Plan: documents/plans/multi-year-phase-1-portfolio-module.md
   -----------------------------------------------------------------------------
   RDIP (one per region), UDIP (one per UPMO cluster office) and PIP (national)
   become PORTFOLIOS: one per kind, owner and fixed six-year term. A multi-year
   project has ONE lasting record (tMultiYearProject) and joins portfolios as
   MEMBERSHIPS, so the same project can sit in an RDIP and the PIP without being
   copied. Its planned yearly costs live in the shared yearly cost stream
   (tMultiYearComponentCostPerYear), marked Planned; Phase 3 adds Locked years.

   ADDITIVE ONLY. Creates new tables and seeds the three horizon types; touches no
   existing table, view or procedure. Nothing here is ever deleted: portfolios
   are never deleted (MY-PFL-07), a wrong planning project is cancelled, and a
   code-list value is retired with Active / Valid To, never removed. The
   constraints are written so later phases need not drop them (Amount >= 0, not
   > 0: a Phase 4 Costing Changes revision may take a locked year to zero).

   Idempotent: every object is created only when missing. Run by hand per
   environment, like the other Migration.* scripts, before deploying the build
   that has the Multi-Year module. Then run
   Migration.MultiYear.Permissions.2026-10-31.sql. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* ── Horizon type (MY-PRJ-06): drives warnings, not limits ─────────────────── */
IF OBJECT_ID(N'dbo.tOptionMultiYearType', N'U') IS NULL
CREATE TABLE dbo.tOptionMultiYearType (
    Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionMultiYearType PRIMARY KEY,
    Name        nvarchar(50)  NOT NULL CONSTRAINT UQ_tOptionMultiYearType_Name UNIQUE,
    Years       int           NULL,  -- NULL = open-ended (long term)
    Description nvarchar(250) NULL,
    IsActive    bit           NOT NULL CONSTRAINT DF_tOptionMultiYearType_IsActive DEFAULT (1),
    CONSTRAINT CK_tOptionMultiYearType_Years CHECK (Years IS NULL OR Years > 0)
);

/* ── Planning code lists (MY-PFL-14, -15). Years are plain ints, 0 = open, and a
      value can be picked when it is Active OR valid for the year: the rule the
      Category / Sub-Category lists already use (#482, #488). ─────────────────── */
IF OBJECT_ID(N'dbo.tOptionBasisForImplementation', N'U') IS NULL
CREATE TABLE dbo.tOptionBasisForImplementation (
    Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionBasisForImplementation PRIMARY KEY,
    Name          nvarchar(150) NOT NULL CONSTRAINT UQ_tOptionBasisForImplementation_Name UNIQUE,
    Description   nvarchar(250) NULL,
    ValidFromYear int           NOT NULL CONSTRAINT DF_tOptionBasisForImplementation_ValidFrom DEFAULT (0),
    ValidToYear   int           NOT NULL CONSTRAINT DF_tOptionBasisForImplementation_ValidTo DEFAULT (0),
    IsActive      bit           NOT NULL CONSTRAINT DF_tOptionBasisForImplementation_IsActive DEFAULT (1),
    CreatedBy     nvarchar(100) NOT NULL,
    CreatedDate   datetime      NOT NULL CONSTRAINT DF_tOptionBasisForImplementation_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy     nvarchar(100) NULL,
    UpdatedDate   datetime      NULL,
    CONSTRAINT CK_tOptionBasisForImplementation_Validity
        CHECK (ValidFromYear >= 0 AND ValidToYear >= 0 AND (ValidFromYear = 0 OR ValidToYear = 0 OR ValidFromYear <= ValidToYear))
);

IF OBJECT_ID(N'dbo.tOptionNedaProjectStatus', N'U') IS NULL
CREATE TABLE dbo.tOptionNedaProjectStatus (
    Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionNedaProjectStatus PRIMARY KEY,
    Name          nvarchar(150) NOT NULL CONSTRAINT UQ_tOptionNedaProjectStatus_Name UNIQUE,
    Description   nvarchar(250) NULL,
    ValidFromYear int           NOT NULL CONSTRAINT DF_tOptionNedaProjectStatus_ValidFrom DEFAULT (0),
    ValidToYear   int           NOT NULL CONSTRAINT DF_tOptionNedaProjectStatus_ValidTo DEFAULT (0),
    IsActive      bit           NOT NULL CONSTRAINT DF_tOptionNedaProjectStatus_IsActive DEFAULT (1),
    CreatedBy     nvarchar(100) NOT NULL,
    CreatedDate   datetime      NOT NULL CONSTRAINT DF_tOptionNedaProjectStatus_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy     nvarchar(100) NULL,
    UpdatedDate   datetime      NULL,
    CONSTRAINT CK_tOptionNedaProjectStatus_Validity
        CHECK (ValidFromYear >= 0 AND ValidToYear >= 0 AND (ValidFromYear = 0 OR ValidToYear = 0 OR ValidFromYear <= ValidToYear))
);

IF OBJECT_ID(N'dbo.tOptionReadinessLevel', N'U') IS NULL
CREATE TABLE dbo.tOptionReadinessLevel (
    Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionReadinessLevel PRIMARY KEY,
    Name          nvarchar(150) NOT NULL CONSTRAINT UQ_tOptionReadinessLevel_Name UNIQUE,
    Description   nvarchar(250) NULL,
    ValidFromYear int           NOT NULL CONSTRAINT DF_tOptionReadinessLevel_ValidFrom DEFAULT (0),
    ValidToYear   int           NOT NULL CONSTRAINT DF_tOptionReadinessLevel_ValidTo DEFAULT (0),
    IsActive      bit           NOT NULL CONSTRAINT DF_tOptionReadinessLevel_IsActive DEFAULT (1),
    CreatedBy     nvarchar(100) NOT NULL,
    CreatedDate   datetime      NOT NULL CONSTRAINT DF_tOptionReadinessLevel_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy     nvarchar(100) NULL,
    UpdatedDate   datetime      NULL,
    CONSTRAINT CK_tOptionReadinessLevel_Validity
        CHECK (ValidFromYear >= 0 AND ValidToYear >= 0 AND (ValidFromYear = 0 OR ValidToYear = 0 OR ValidFromYear <= ValidToYear))
);

IF OBJECT_ID(N'dbo.tOptionRdpOutcome', N'U') IS NULL
CREATE TABLE dbo.tOptionRdpOutcome (
    Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionRdpOutcome PRIMARY KEY,
    Name          nvarchar(250) NOT NULL CONSTRAINT UQ_tOptionRdpOutcome_Name UNIQUE,
    Description   nvarchar(250) NULL,
    ValidFromYear int           NOT NULL CONSTRAINT DF_tOptionRdpOutcome_ValidFrom DEFAULT (0),
    ValidToYear   int           NOT NULL CONSTRAINT DF_tOptionRdpOutcome_ValidTo DEFAULT (0),
    IsActive      bit           NOT NULL CONSTRAINT DF_tOptionRdpOutcome_IsActive DEFAULT (1),
    CreatedBy     nvarchar(100) NOT NULL,
    CreatedDate   datetime      NOT NULL CONSTRAINT DF_tOptionRdpOutcome_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy     nvarchar(100) NULL,
    UpdatedDate   datetime      NULL,
    CONSTRAINT CK_tOptionRdpOutcome_Validity
        CHECK (ValidFromYear >= 0 AND ValidToYear >= 0 AND (ValidFromYear = 0 OR ValidToYear = 0 OR ValidFromYear <= ValidToYear))
);

IF OBJECT_ID(N'dbo.tOptionRdpOutput', N'U') IS NULL
CREATE TABLE dbo.tOptionRdpOutput (
    Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tOptionRdpOutput PRIMARY KEY,
    OutcomeFK     int           NOT NULL CONSTRAINT FK_tOptionRdpOutput_Outcome REFERENCES dbo.tOptionRdpOutcome (Id),
    Name          nvarchar(250) NOT NULL,
    Description   nvarchar(250) NULL,
    ValidFromYear int           NOT NULL CONSTRAINT DF_tOptionRdpOutput_ValidFrom DEFAULT (0),
    ValidToYear   int           NOT NULL CONSTRAINT DF_tOptionRdpOutput_ValidTo DEFAULT (0),
    IsActive      bit           NOT NULL CONSTRAINT DF_tOptionRdpOutput_IsActive DEFAULT (1),
    CreatedBy     nvarchar(100) NOT NULL,
    CreatedDate   datetime      NOT NULL CONSTRAINT DF_tOptionRdpOutput_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy     nvarchar(100) NULL,
    UpdatedDate   datetime      NULL,
    CONSTRAINT UQ_tOptionRdpOutput_OutcomeName UNIQUE (OutcomeFK, Name),
    CONSTRAINT CK_tOptionRdpOutput_Validity
        CHECK (ValidFromYear >= 0 AND ValidToYear >= 0 AND (ValidFromYear = 0 OR ValidToYear = 0 OR ValidFromYear <= ValidToYear))
);

/* ── Portfolio: one per kind, owner and six-year term (MY-PFL-01, -03, -04) ──
      Kind 1 RDIP (owner = region ParticipantId), 2 UDIP (owner = PMO cluster
      office ParticipantId), 3 PIP (no owner). Status 1 Open, 2 Closed. A term is
      always six years: TermEndYear is computed, never entered. ──────────────── */
IF OBJECT_ID(N'dbo.tMultiYearPortfolio', N'U') IS NULL
CREATE TABLE dbo.tMultiYearPortfolio (
    Id                 int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearPortfolio PRIMARY KEY,
    Kind               tinyint       NOT NULL,
    OwnerParticipantId nvarchar(20)  NULL,
    OwnerKey           AS (ISNULL(OwnerParticipantId, N'')) PERSISTED,
    TermStartYear      int           NOT NULL,
    TermEndYear        AS (TermStartYear + 5) PERSISTED,
    Status             tinyint       NOT NULL CONSTRAINT DF_tMultiYearPortfolio_Status DEFAULT (1),
    PreviousPortfolioFK int          NULL CONSTRAINT FK_tMultiYearPortfolio_Previous REFERENCES dbo.tMultiYearPortfolio (Id),
    CreatedBy          nvarchar(100) NOT NULL,
    CreatedDate        datetime      NOT NULL CONSTRAINT DF_tMultiYearPortfolio_CreatedDate DEFAULT (GETDATE()),
    ClosedBy           nvarchar(100) NULL,
    ClosedDate         datetime      NULL,
    CONSTRAINT CK_tMultiYearPortfolio_Kind   CHECK (Kind IN (1, 2, 3)),
    CONSTRAINT CK_tMultiYearPortfolio_Status CHECK (Status IN (1, 2)),
    CONSTRAINT CK_tMultiYearPortfolio_Term   CHECK (TermStartYear BETWEEN 1990 AND 2095),
    CONSTRAINT CK_tMultiYearPortfolio_Owner  CHECK ((Kind = 3 AND OwnerParticipantId IS NULL) OR (Kind IN (1, 2) AND OwnerParticipantId IS NOT NULL)),
    CONSTRAINT UQ_tMultiYearPortfolio_KindOwnerTerm UNIQUE (Kind, OwnerKey, TermStartYear)
);

-- One next term per term: two simultaneous Open Next Term clicks cannot both succeed.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tMultiYearPortfolio_Previous' AND object_id = OBJECT_ID(N'dbo.tMultiYearPortfolio'))
    CREATE UNIQUE INDEX UX_tMultiYearPortfolio_Previous ON dbo.tMultiYearPortfolio (PreviousPortfolioFK) WHERE PreviousPortfolioFK IS NOT NULL;

/* ── The lasting record of a multi-year project (MY-PRJ-01, -04 … -07) ─────────
      OriginalCost is written once, when the record is made, and never again. */
IF OBJECT_ID(N'dbo.tMultiYearProject', N'U') IS NULL
CREATE TABLE dbo.tMultiYearProject (
    Id                  int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearProject PRIMARY KEY,
    ProjectId           nvarchar(20)  NOT NULL CONSTRAINT UQ_tMultiYearProject_ProjectId UNIQUE,
    Description         nvarchar(max) NOT NULL,
    Category            int           NOT NULL,
    Thrust              int           NULL,
    Region              nvarchar(20)  NULL,
    Province            nvarchar(20)  NULL,
    City                nvarchar(20)  NULL,
    LegislativeDistrict nvarchar(20)  NULL,
    DEO                 nvarchar(20)  NULL,
    ImplementingOffice  nvarchar(20)  NULL,
    ReportingRegion     nvarchar(20)  NULL,
    RegionWide          int           NULL,
    IslandCode          nvarchar(2)   NOT NULL,
    HorizonTypeFK       int           NOT NULL CONSTRAINT FK_tMultiYearProject_HorizonType REFERENCES dbo.tOptionMultiYearType (Id),
    StartYear           int           NOT NULL,
    EndYear             int           NULL,
    OriginalCost        decimal(18,5) NOT NULL,
    CurrentCost         decimal(18,5) NOT NULL,
    CreatedBy           nvarchar(100) NOT NULL,
    CreatedDate         datetime      NOT NULL CONSTRAINT DF_tMultiYearProject_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy           nvarchar(100) NULL,
    UpdatedDate         datetime      NULL,
    CONSTRAINT CK_tMultiYearProject_Years CHECK (StartYear BETWEEN 1990 AND 2100 AND (EndYear IS NULL OR EndYear BETWEEN StartYear AND 2100)),
    CONSTRAINT CK_tMultiYearProject_Costs CHECK (OriginalCost >= 0 AND CurrentCost >= 0)
);

/* ── Its components. A planning project has one Civil Works component (CW1) with
      one major item: infrastructure type (tOptionInfraType.InfraCode), dominant
      type of work (tOptionScopeOfWork.Enum) and target (MY-PFL-16). ─────────── */
IF OBJECT_ID(N'dbo.tMultiYearComponent', N'U') IS NULL
CREATE TABLE dbo.tMultiYearComponent (
    Id                 int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearComponent PRIMARY KEY,
    MultiYearProjectFK int           NOT NULL CONSTRAINT FK_tMultiYearComponent_Project REFERENCES dbo.tMultiYearProject (Id),
    ComponentId        nvarchar(10)  NOT NULL,
    ComponentType      nvarchar(100) NOT NULL,
    Description        nvarchar(max) NULL,
    InfraTypeFK        nvarchar(10)  NULL,
    WorkTypeFK         int           NULL,
    PhysicalTarget     float         NULL,
    TargetUnit         nvarchar(100) NULL,
    CreatedBy          nvarchar(100) NOT NULL,
    CreatedDate        datetime      NOT NULL CONSTRAINT DF_tMultiYearComponent_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy          nvarchar(100) NULL,
    UpdatedDate        datetime      NULL,
    CONSTRAINT UQ_tMultiYearComponent_ProjectComponent UNIQUE (MultiYearProjectFK, ComponentId)
);

/* ── The shared yearly cost stream (MY-PRJ-09 … -11, -25). Status 1 Planned;
      2 Locked and 3 Superseded are reserved for Phases 3 and 4. One CURRENT
      amount per component and year: superseded rows don't count. ───────────── */
IF OBJECT_ID(N'dbo.tMultiYearComponentCostPerYear', N'U') IS NULL
CREATE TABLE dbo.tMultiYearComponentCostPerYear (
    Id                   int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearComponentCostPerYear PRIMARY KEY,
    MultiYearComponentFK int           NOT NULL CONSTRAINT FK_tMultiYearComponentCostPerYear_Component REFERENCES dbo.tMultiYearComponent (Id),
    [Year]               int           NOT NULL,
    Amount               decimal(18,5) NOT NULL,
    Status               tinyint       NOT NULL CONSTRAINT DF_tMultiYearComponentCostPerYear_Status DEFAULT (1),
    CreatedBy            nvarchar(100) NOT NULL,
    CreatedDate          datetime      NOT NULL CONSTRAINT DF_tMultiYearComponentCostPerYear_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy            nvarchar(100) NULL,
    UpdatedDate          datetime      NULL,
    CONSTRAINT CK_tMultiYearComponentCostPerYear_Year   CHECK ([Year] BETWEEN 1990 AND 2100),
    CONSTRAINT CK_tMultiYearComponentCostPerYear_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_tMultiYearComponentCostPerYear_Status CHECK (Status IN (1, 2, 3))
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_tMultiYearComponentCostPerYear_Current' AND object_id = OBJECT_ID(N'dbo.tMultiYearComponentCostPerYear'))
    CREATE UNIQUE INDEX UX_tMultiYearComponentCostPerYear_Current
        ON dbo.tMultiYearComponentCostPerYear (MultiYearComponentFK, [Year]) WHERE Status <> 3;

/* ── Membership of a project in a portfolio (MY-PFL-09 … -14). Its own status,
      start year, cost and planning fields. Status 1 new, 2 potential, 3 ongoing,
      4 completed, 5 cancelled. The multi-valued fields are JSON arrays, like
      tGroupRoles.ActionIds, so changing a selection never deletes a row:
        ReadinessLevelIds  [1,4]
        RdpOutcomes        [{"OutcomeId":1,"OutputId":2}]   one output per outcome */
IF OBJECT_ID(N'dbo.tMultiYearPortfolioMember', N'U') IS NULL
CREATE TABLE dbo.tMultiYearPortfolioMember (
    Id                       int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearPortfolioMember PRIMARY KEY,
    PortfolioFK              int           NOT NULL CONSTRAINT FK_tMultiYearPortfolioMember_Portfolio REFERENCES dbo.tMultiYearPortfolio (Id),
    MultiYearProjectFK       int           NOT NULL CONSTRAINT FK_tMultiYearPortfolioMember_Project REFERENCES dbo.tMultiYearProject (Id),
    IsOwner                  bit           NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_IsOwner DEFAULT (0),
    SourcePortfolioFK        int           NULL CONSTRAINT FK_tMultiYearPortfolioMember_Source REFERENCES dbo.tMultiYearPortfolio (Id),
    CarriedFromMemberFK      int           NULL CONSTRAINT FK_tMultiYearPortfolioMember_CarriedFrom REFERENCES dbo.tMultiYearPortfolioMember (Id),
    Status                   tinyint       NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_Status DEFAULT (1),
    StartYear                int           NOT NULL,
    Cost                     decimal(18,5) NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_Cost DEFAULT (0),
    OriginalCost             decimal(18,5) NULL,
    BasisForImplementationFK int           NULL CONSTRAINT FK_tMultiYearPortfolioMember_Basis REFERENCES dbo.tOptionBasisForImplementation (Id),
    NedaProjectStatusFK      int           NULL CONSTRAINT FK_tMultiYearPortfolioMember_Neda REFERENCES dbo.tOptionNedaProjectStatus (Id),
    ReadinessLevelIds        nvarchar(1000) NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_Readiness DEFAULT (N'[]'),
    RdpOutcomes              nvarchar(4000) NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_Rdp DEFAULT (N'[]'),
    Tier                     int           NULL,
    McaScore                 decimal(9,4)  NULL,
    CreatedBy                nvarchar(100) NOT NULL,
    CreatedDate              datetime      NOT NULL CONSTRAINT DF_tMultiYearPortfolioMember_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy                nvarchar(100) NULL,
    UpdatedDate              datetime      NULL,
    CONSTRAINT CK_tMultiYearPortfolioMember_Status    CHECK (Status BETWEEN 1 AND 5),
    CONSTRAINT CK_tMultiYearPortfolioMember_StartYear CHECK (StartYear BETWEEN 1990 AND 2100),
    CONSTRAINT CK_tMultiYearPortfolioMember_Cost      CHECK (Cost >= 0 AND (OriginalCost IS NULL OR OriginalCost >= 0)),
    CONSTRAINT CK_tMultiYearPortfolioMember_Json      CHECK (ISJSON(ReadinessLevelIds) = 1 AND ISJSON(RdpOutcomes) = 1),
    CONSTRAINT UQ_tMultiYearPortfolioMember_PortfolioProject UNIQUE (PortfolioFK, MultiYearProjectFK)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tMultiYearPortfolioMember_Project' AND object_id = OBJECT_ID(N'dbo.tMultiYearPortfolioMember'))
    CREATE INDEX IX_tMultiYearPortfolioMember_Project ON dbo.tMultiYearPortfolioMember (MultiYearProjectFK);

/* ── Every membership status change, who and when (insert only) ─────────────── */
IF OBJECT_ID(N'dbo.tMultiYearMemberStatusLog', N'U') IS NULL
CREATE TABLE dbo.tMultiYearMemberStatusLog (
    Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearMemberStatusLog PRIMARY KEY,
    MemberFK    int           NOT NULL CONSTRAINT FK_tMultiYearMemberStatusLog_Member REFERENCES dbo.tMultiYearPortfolioMember (Id),
    FromStatus  tinyint       NULL,
    ToStatus    tinyint       NOT NULL,
    Reason      nvarchar(500) NULL,
    ChangedBy   nvarchar(100) NOT NULL,
    ChangedDate datetime      NOT NULL CONSTRAINT DF_tMultiYearMemberStatusLog_ChangedDate DEFAULT (GETDATE())
);

/* ── Budget ceiling per portfolio and year of its term (MY-PFL-23) ──────────── */
IF OBJECT_ID(N'dbo.tMultiYearPortfolioCeiling', N'U') IS NULL
CREATE TABLE dbo.tMultiYearPortfolioCeiling (
    Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearPortfolioCeiling PRIMARY KEY,
    PortfolioFK int           NOT NULL CONSTRAINT FK_tMultiYearPortfolioCeiling_Portfolio REFERENCES dbo.tMultiYearPortfolio (Id),
    [Year]      int           NOT NULL,
    Amount      decimal(18,5) NOT NULL,
    CreatedBy   nvarchar(100) NOT NULL,
    CreatedDate datetime      NOT NULL CONSTRAINT DF_tMultiYearPortfolioCeiling_CreatedDate DEFAULT (GETDATE()),
    UpdatedBy   nvarchar(100) NULL,
    UpdatedDate datetime      NULL,
    CONSTRAINT CK_tMultiYearPortfolioCeiling_Amount CHECK (Amount >= 0),
    CONSTRAINT UQ_tMultiYearPortfolioCeiling_PortfolioYear UNIQUE (PortfolioFK, [Year])
);

/* ── Seed: the three horizon types, by name ────────────────────────────────── */
INSERT INTO dbo.tOptionMultiYearType (Name, Years, Description)
SELECT s.Name, s.Years, s.Description
FROM (VALUES
        (N'Short term',  3,    N'Up to 3 years'),
        (N'Medium term', 6,    N'Up to 6 years'),
        (N'Long term',   NULL, N'Open-ended')
     ) s (Name, Years, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.tOptionMultiYearType t WHERE t.Name = s.Name);

COMMIT TRANSACTION;
GO

/* ── The Members tab's paged list (Helpers.QueryPaginationExtensions.FilterDataCursor
      reads it by name). One row per membership with its project's planned total and
      its yearly amounts as JSON: [{"Year":2026,"Amount":100.00000}, ...]. Only
      Multi-Year tables, so the names of category and region are added by the API. */
CREATE OR ALTER VIEW dbo.vMultiYearPortfolioMemberList
AS
SELECT
    m.Id,
    m.PortfolioFK,
    m.MultiYearProjectFK,
    p.ProjectId,
    p.Description,
    p.Category,
    p.Region,
    p.DEO,
    p.ImplementingOffice,
    m.IsOwner,
    m.Status,
    m.StartYear,
    p.EndYear,
    m.Cost,
    m.OriginalCost,
    m.SourcePortfolioFK,
    m.Tier,
    m.McaScore,
    ht.Name AS HorizonType,
    ISNULL(cost.PlannedTotal, 0) AS PlannedTotal,
    ISNULL((
        SELECT y.[Year] AS [Year], SUM(y.Amount) AS Amount
        FROM dbo.tMultiYearComponent c
        JOIN dbo.tMultiYearComponentCostPerYear y ON y.MultiYearComponentFK = c.Id AND y.Status <> 3
        WHERE c.MultiYearProjectFK = m.MultiYearProjectFK
        GROUP BY y.[Year]
        ORDER BY y.[Year]
        FOR JSON PATH), N'[]') AS YearAmounts
FROM dbo.tMultiYearPortfolioMember m
JOIN dbo.tMultiYearProject p ON p.Id = m.MultiYearProjectFK
JOIN dbo.tOptionMultiYearType ht ON ht.Id = p.HorizonTypeFK
OUTER APPLY (
    SELECT SUM(y.Amount) AS PlannedTotal
    FROM dbo.tMultiYearComponent c
    JOIN dbo.tMultiYearComponentCostPerYear y ON y.MultiYearComponentFK = c.Id AND y.Status <> 3
    WHERE c.MultiYearProjectFK = m.MultiYearProjectFK
) cost;
GO

-- Verify: every Multi-Year table and its row count.
SELECT t.name AS TableName, SUM(p.rows) AS [Rows]
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE t.name LIKE N'tMultiYear%'
   OR t.name IN (N'tOptionMultiYearType', N'tOptionBasisForImplementation', N'tOptionNedaProjectStatus',
                 N'tOptionReadinessLevel', N'tOptionRdpOutcome', N'tOptionRdpOutput')
GROUP BY t.name
ORDER BY t.name;
GO
