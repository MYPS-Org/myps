/* =============================================================================
   Migration — Multi-Year module, Phase 2: link the portfolios to the annual programs
   Date: 2026-10-31
   Plan: documents/plans/multi-year-phase-2-annual-program-linking.md
   -----------------------------------------------------------------------------
   Phase 1 (Migration.MultiYear.Schema.2026-10-31.sql) made the portfolios, the
   lasting project records and their memberships. Phase 2 links them to the
   annual budget track:

     tMultiYearProposal          a planning project proposed into an RBP / UBP:
                                 the BP-numbered annual project it created
                                 (MY-PFL-20, MY-PRJ-02/03)
     tMultiYearUpdateRun         every run of the portfolio update after a GAA /
                                 GAA-R approval, a withdrawn GAA project or a
                                 request (MY-PFL-21, -22)
     tMultiYearTotalsSnapshot,   saved totals of planned, proposed and approved
     tMultiYearTotalsLine        cost per project and portfolio, never edited
                                 (MY-PFL-24)
     tMultiYearMemberStatusLog   + FromStartYear, ToStartYear, FromCost, ToCost,
                                 RunFK, ProposalFK: one history per membership
     tMultiYearProject           + OriginProgramFK: set when the GAA update made
                                 the record from an approved GAA project

   A planning project is recognised in a BP / NEP / GAA program by the annual
   project's Multi Year ID (tProjects.MYId) = its MY id: an RBP program never
   advances, and the Multi Year ID is what export, import and the project form
   carry from one program to the next.

   ADDITIVE ONLY. New tables and new NULL columns on the Phase 1 tables; no
   existing table outside the module is touched. Nothing here is deleted.

   Idempotent. Run by hand per environment AFTER the Phase 1 schema script and
   BEFORE deploying the build with Phase 2 (that build reads the new columns).
   Then run Migration.MultiYear.LinkingPermissions.2026-10-31.sql. Run with -I.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- Without the Phase 1 tables nothing below may run: NOEXEC skips every later batch.
IF OBJECT_ID(N'dbo.tMultiYearPortfolioMember', N'U') IS NULL
BEGIN
    RAISERROR(N'Nothing changed: the Multi-Year module is not on this database yet. Run Migration.MultiYear.Schema.2026-10-31.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

/* ── A planning project proposed into an RBP / UBP (MY-PFL-20) ──────────────
      ProjectFK / ProjectId name the annual project the proposal created
      (tProjects.ProjectPK and its BP id). A proposal counts while that project
      is not deleted; one live proposal per project and budget year is enforced
      by the application (a deleted proposal's project frees the year). */
IF OBJECT_ID(N'dbo.tMultiYearProposal', N'U') IS NULL
CREATE TABLE dbo.tMultiYearProposal (
    Id                 int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearProposal PRIMARY KEY,
    MultiYearProjectFK int           NOT NULL CONSTRAINT FK_tMultiYearProposal_Project REFERENCES dbo.tMultiYearProject (Id),
    MemberFK           int           NOT NULL CONSTRAINT FK_tMultiYearProposal_Member REFERENCES dbo.tMultiYearPortfolioMember (Id),
    ProgramFK          nvarchar(200) NOT NULL,
    ProjectFK          nvarchar(200) NOT NULL,
    ProjectId          nvarchar(50)  NOT NULL,
    BudgetYear         int           NOT NULL,
    Amount             decimal(18,5) NOT NULL,
    ProposedBy         nvarchar(100) NOT NULL,
    ProposedDate       datetime      NOT NULL CONSTRAINT DF_tMultiYearProposal_ProposedDate DEFAULT (GETDATE()),
    CONSTRAINT CK_tMultiYearProposal_Amount CHECK (Amount > 0),
    CONSTRAINT CK_tMultiYearProposal_Year   CHECK (BudgetYear BETWEEN 1990 AND 2100),
    CONSTRAINT UQ_tMultiYearProposal_ProjectFK UNIQUE (ProjectFK)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tMultiYearProposal_ProjectYear' AND object_id = OBJECT_ID(N'dbo.tMultiYearProposal'))
    CREATE INDEX IX_tMultiYearProposal_ProjectYear ON dbo.tMultiYearProposal (MultiYearProjectFK, BudgetYear);

/* ── One run of the portfolio update (MY-PFL-21, -22) ────────────────────────
      TriggerKind: 1 GAA approved, 2 GAA-R approved, 3 GAA advanced to GAA-R,
      4 Non-Implementable / Termination with No Disbursements approved,
      5 run on request. Summary is the run's counts as JSON. */
IF OBJECT_ID(N'dbo.tMultiYearUpdateRun', N'U') IS NULL
CREATE TABLE dbo.tMultiYearUpdateRun (
    Id                int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearUpdateRun PRIMARY KEY,
    [Year]            int            NOT NULL,
    TriggerKind       tinyint        NOT NULL,
    ProgramFK         nvarchar(200)  NULL,
    RevisionDetailsFK int            NULL,
    Summary           nvarchar(4000) NOT NULL CONSTRAINT DF_tMultiYearUpdateRun_Summary DEFAULT (N'{}'),
    RunBy             nvarchar(100)  NOT NULL,
    RunDate           datetime       NOT NULL CONSTRAINT DF_tMultiYearUpdateRun_RunDate DEFAULT (GETDATE()),
    CONSTRAINT CK_tMultiYearUpdateRun_Trigger CHECK (TriggerKind BETWEEN 1 AND 5),
    CONSTRAINT CK_tMultiYearUpdateRun_Year    CHECK ([Year] BETWEEN 1990 AND 2100),
    CONSTRAINT CK_tMultiYearUpdateRun_Summary CHECK (ISJSON(Summary) = 1)
);

/* ── Saved totals (MY-PFL-24): insert only, never edited ─────────────────────
      Reason: 1 term opened, 2 term closed, 3 after a GAA update, 4 on request.
      A line with MultiYearProjectFK NULL is the portfolio's total for the year. */
IF OBJECT_ID(N'dbo.tMultiYearTotalsSnapshot', N'U') IS NULL
CREATE TABLE dbo.tMultiYearTotalsSnapshot (
    Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearTotalsSnapshot PRIMARY KEY,
    PortfolioFK int           NOT NULL CONSTRAINT FK_tMultiYearTotalsSnapshot_Portfolio REFERENCES dbo.tMultiYearPortfolio (Id),
    Reason      tinyint       NOT NULL,
    RunFK       int           NULL CONSTRAINT FK_tMultiYearTotalsSnapshot_Run REFERENCES dbo.tMultiYearUpdateRun (Id),
    Note        nvarchar(250) NULL,
    TakenBy     nvarchar(100) NOT NULL,
    TakenDate   datetime      NOT NULL CONSTRAINT DF_tMultiYearTotalsSnapshot_TakenDate DEFAULT (GETDATE()),
    CONSTRAINT CK_tMultiYearTotalsSnapshot_Reason CHECK (Reason BETWEEN 1 AND 4)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_tMultiYearTotalsSnapshot_Portfolio' AND object_id = OBJECT_ID(N'dbo.tMultiYearTotalsSnapshot'))
    CREATE INDEX IX_tMultiYearTotalsSnapshot_Portfolio ON dbo.tMultiYearTotalsSnapshot (PortfolioFK, Id);

IF OBJECT_ID(N'dbo.tMultiYearTotalsLine', N'U') IS NULL
CREATE TABLE dbo.tMultiYearTotalsLine (
    Id                 int IDENTITY(1,1) NOT NULL CONSTRAINT PK_tMultiYearTotalsLine PRIMARY KEY,
    SnapshotFK         int           NOT NULL CONSTRAINT FK_tMultiYearTotalsLine_Snapshot REFERENCES dbo.tMultiYearTotalsSnapshot (Id),
    MultiYearProjectFK int           NULL CONSTRAINT FK_tMultiYearTotalsLine_Project REFERENCES dbo.tMultiYearProject (Id),
    [Year]             int           NOT NULL,
    Planned            decimal(18,5) NOT NULL CONSTRAINT DF_tMultiYearTotalsLine_Planned DEFAULT (0),
    Proposed           decimal(18,5) NOT NULL CONSTRAINT DF_tMultiYearTotalsLine_Proposed DEFAULT (0),
    Approved           decimal(18,5) NOT NULL CONSTRAINT DF_tMultiYearTotalsLine_Approved DEFAULT (0),
    Ceiling            decimal(18,5) NULL,
    CONSTRAINT UQ_tMultiYearTotalsLine_SnapshotProjectYear UNIQUE (SnapshotFK, MultiYearProjectFK, [Year])
);

/* ── One history per membership: status, start-year and PIP cost changes ──── */
IF COL_LENGTH('dbo.tMultiYearMemberStatusLog', 'FromStartYear') IS NULL
    ALTER TABLE dbo.tMultiYearMemberStatusLog ADD
        FromStartYear int           NULL,
        ToStartYear   int           NULL,
        FromCost      decimal(18,5) NULL,
        ToCost        decimal(18,5) NULL,
        RunFK         int           NULL CONSTRAINT FK_tMultiYearMemberStatusLog_Run REFERENCES dbo.tMultiYearUpdateRun (Id),
        ProposalFK    int           NULL CONSTRAINT FK_tMultiYearMemberStatusLog_Proposal REFERENCES dbo.tMultiYearProposal (Id);

/* ── A lasting record the GAA update made from an approved GAA project ────── */
IF COL_LENGTH('dbo.tMultiYearProject', 'OriginProgramFK') IS NULL
    ALTER TABLE dbo.tMultiYearProject ADD OriginProgramFK nvarchar(200) NULL;

COMMIT TRANSACTION;
GO

-- Verify: every Phase 2 object exists.
SELECT o.name, o.type_desc
FROM sys.objects o
WHERE o.name IN (N'tMultiYearProposal', N'tMultiYearUpdateRun', N'tMultiYearTotalsSnapshot', N'tMultiYearTotalsLine')
ORDER BY o.name;
SELECT COL_LENGTH('dbo.tMultiYearMemberStatusLog', 'RunFK') AS StatusLogRunFK,
       COL_LENGTH('dbo.tMultiYearProject', 'OriginProgramFK') AS ProjectOriginProgramFK;
GO

SET NOEXEC OFF;
GO
