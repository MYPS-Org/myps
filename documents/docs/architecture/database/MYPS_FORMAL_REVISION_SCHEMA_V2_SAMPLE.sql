/*
    SUPERSEDED SCOPE NOTICE - DO NOT DEPLOY
    =======================================
    This file is retained only as an exploratory design record. The approved
    planning scope is now defined in:

      docs/formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md

    That scope changes only the 11 approved Revision transaction/data tables.
    It leaves tRevisionRules, tRevisionApprovals, all Revision option tables,
    and all base Program/Project lifecycle tables unchanged. Because this
    exploratory script creates or changes objects outside that boundary, it
    must not be used as the production migration.

    MYPS Formal Project Revision Schema V2 - DESIGN SAMPLE
    ======================================================

    Purpose
    -------
    This sample combines:
      1. the Revision tables and business fields supplied in
         LOCAL-MYPS(revision).sql; and
      2. the relational key pattern and reference tables already present in
         myps_db(08-10-2026-full-schema).sql.

    Important
    ---------
    - This is a proposed target schema, not an in-place migration script.
    - It does not DROP, ALTER, or migrate any existing production object.
    - It predates the corrected dual-modal workflow. CLIENT-CONFIRMED:
      IsApprovedDocument = 1 means the CO approval document. Whether zero
      exclusively means the IO submission document is still pending.
      This sample also lacks workflow-attempt/version metadata and therefore
      does not fully implement the document audit contract.
    - Test the final migration against a restored database before deployment.
    - The live database must have a UNIQUE key/index on dbo.tProjects.ProjectPK
      before FK_tRevisionDetails_Project can be created. The supplied schema
      export declares ProjectPK as the business key but does not show that
      unique constraint.

    Core identity rules
    -------------------
    - ProjectFK: stable Project identity; points to tProjects.ProjectPK.
    - ProjectRevisionFK: exact published lifecycle Project revision used as the
      starting baseline; points to tProjectRevisions.Id.
    - PreviousRevisionDetailFK: preceding approved Formal Revision, when the
      new Formal Revision starts from an earlier Formal Revision.
    - RevisionDetailFK: physical parent key used by every Formal Revision child.
    - TransactionId: unique external/business transaction identifier at the
      root only; it is not used as a child-table foreign key.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

/* -------------------------------------------------------------------------
   1. Rule selected from Revision reason + PCMA construction/package status
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionRules](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [ReasonId]              [int] NOT NULL,
    [PCMA_Status]           [nvarchar](50) NOT NULL,
    [Package_Status]        [nvarchar](20) NOT NULL,
    [Field]                 [nvarchar](max) NOT NULL,
    [RuleVersion]           [int] NOT NULL
        CONSTRAINT [DF_tRevisionRules_RuleVersion] DEFAULT (1),
    [IsActive]              [bit] NOT NULL
        CONSTRAINT [DF_tRevisionRules_IsActive] DEFAULT (1),
    [CreatedBy]             [nvarchar](100) NOT NULL,
    [CreatedDate]           [datetime] NOT NULL
        CONSTRAINT [DF_tRevisionRules_CreatedDate] DEFAULT (GETDATE()),
    CONSTRAINT [PK_tRevisionRules]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionRules_Reason]
        FOREIGN KEY ([ReasonId])
        REFERENCES [dbo].[tOptionRevisionReasons] ([ReasonId]),
    CONSTRAINT [CK_tRevisionRules_Field_IsJson]
        CHECK (ISJSON([Field]) = 1),
    CONSTRAINT [CK_tRevisionRules_PackageStatus]
        CHECK ([Package_Status] IN (N'Packaged', N'Not Packaged')),
    CONSTRAINT [CK_tRevisionRules_ConstructionStatus]
        CHECK ([PCMA_Status] IN
        (
            N'No Components',
            N'On-Going',
            N'Terminated',
            N'Not Yet Started',
            N'Completed'
        )),
    CONSTRAINT [CK_tRevisionRules_RuleVersion]
        CHECK ([RuleVersion] > 0)
);
GO

/* Only one active rule may match a reason/status combination. Old versions
   remain available for historical Revision transactions. */
CREATE UNIQUE NONCLUSTERED INDEX [UX_tRevisionRules_ActiveMatch]
ON [dbo].[tRevisionRules]
(
    [ReasonId],
    [PCMA_Status],
    [Package_Status]
)
WHERE [IsActive] = 1;
GO

/* -------------------------------------------------------------------------
   2. Formal Revision transaction root
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionDetails](
    [Id]                        [int] IDENTITY(1,1) NOT NULL,
    [TransactionId]             [nvarchar](200) NOT NULL,

    /* Stable Program/Project ownership and exact published baseline. */
    [ProgramFK]                 [nvarchar](200) NOT NULL,
    [ProgramRevisionFK]         [int] NOT NULL,
    [ProjectFK]                 [nvarchar](200) NOT NULL,
    [ProjectRevisionFK]         [int] NOT NULL,

    /* Null for the first Formal Revision; otherwise points to the previous
       approved/effective Formal Revision for the same Project. */
    [PreviousRevisionDetailFK]  [int] NULL,

    /* Freeze the selected rule row for the life of this transaction. */
    [RevisionRuleFK]            [int] NOT NULL,

    /* Selection contract: RevisionGroupId is the required Revision Type.
       CategoryId is null when that Type has no active Categories; otherwise
       Category is required. ReasonId must belong to the Type and, when used,
       the selected Category. The actual tOptionRevisionReasons.CategoryId
       text encoding must be verified from deployed data before migration. */
    [RevisionGroupId]           [int] NOT NULL,
    [CategoryId]                [int] NULL,
    [ReasonId]                  [int] NOT NULL,

    [IODocApprovalDate]         [datetime] NULL,
    [IODocPath]                 [nvarchar](500) NULL,
    [IsCertified]               [bit] NOT NULL
        CONSTRAINT [DF_tRevisionDetails_IsCertified] DEFAULT (0),
    [CreatedBy]                 [nvarchar](100) NOT NULL,
    [CreatedDate]               [datetime] NOT NULL
        CONSTRAINT [DF_tRevisionDetails_CreatedDate] DEFAULT (GETDATE()),

    CONSTRAINT [PK_tRevisionDetails]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_tRevisionDetails_TransactionId]
        UNIQUE NONCLUSTERED ([TransactionId] ASC),
    CONSTRAINT [FK_tRevisionDetails_Program]
        FOREIGN KEY ([ProgramFK])
        REFERENCES [dbo].[tPrograms] ([ProgramPK]),
    CONSTRAINT [FK_tRevisionDetails_ProgramRevision]
        FOREIGN KEY ([ProgramRevisionFK])
        REFERENCES [dbo].[tProgramRevisions] ([Id]),
    CONSTRAINT [FK_tRevisionDetails_Project]
        FOREIGN KEY ([ProjectFK])
        REFERENCES [dbo].[tProjects] ([ProjectPK]),
    CONSTRAINT [FK_tRevisionDetails_ProjectRevision]
        FOREIGN KEY ([ProjectRevisionFK])
        REFERENCES [dbo].[tProjectRevisions] ([Id]),
    CONSTRAINT [FK_tRevisionDetails_PreviousRevision]
        FOREIGN KEY ([PreviousRevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionDetails_Rule]
        FOREIGN KEY ([RevisionRuleFK])
        REFERENCES [dbo].[tRevisionRules] ([Id]),
    CONSTRAINT [FK_tRevisionDetails_Header]
        FOREIGN KEY ([RevisionGroupId])
        REFERENCES [dbo].[tOptionRevisionHeader] ([RevisionGroupId]),
    CONSTRAINT [FK_tRevisionDetails_Category]
        FOREIGN KEY ([CategoryId])
        REFERENCES [dbo].[tOptionRevisionCategory] ([CategoryId]),
    CONSTRAINT [FK_tRevisionDetails_Reason]
        FOREIGN KEY ([ReasonId])
        REFERENCES [dbo].[tOptionRevisionReasons] ([ReasonId]),
    CONSTRAINT [CK_tRevisionDetails_PreviousNotSelf]
        CHECK ([PreviousRevisionDetailFK] IS NULL OR [PreviousRevisionDetailFK] <> [Id])
);
GO

CREATE NONCLUSTERED INDEX [IX_tRevisionDetails_Project]
ON [dbo].[tRevisionDetails] ([ProjectFK], [CreatedDate] DESC);
GO

CREATE NONCLUSTERED INDEX [IX_tRevisionDetails_BaseProjectRevision]
ON [dbo].[tRevisionDetails] ([ProjectRevisionFK]);
GO

/* -------------------------------------------------------------------------
   3. PCMA component status snapshot used when the rule was selected
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionDetailsComponentsStatus](
    [Id]                        [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]          [int] NOT NULL,
    [ComponentId]               [nvarchar](10) NOT NULL,
    [ConstructionStatusCode]    [nvarchar](20) NULL,
    [ConstructionStatusName]    [nvarchar](50) NOT NULL,
    [IsPackaged]                [bit] NOT NULL,
    [CapturedDate]              [datetime] NOT NULL
        CONSTRAINT [DF_tRevisionComponentStatus_CapturedDate] DEFAULT (GETDATE()),
    CONSTRAINT [PK_tRevisionDetailsComponentsStatus]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_tRevisionComponentStatus_Component]
        UNIQUE NONCLUSTERED ([RevisionDetailFK], [ComponentId]),
    CONSTRAINT [FK_tRevisionComponentStatus_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id])
);
GO

/* -------------------------------------------------------------------------
   4. Editable Project snapshot copied from the exact published revision
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionProjects](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [IsActive]              [bit] NOT NULL
        CONSTRAINT [DF_tRevisionProjects_IsActive] DEFAULT (0),
    [ProjectId]             [nvarchar](200) NOT NULL,
    [AlternateId]           [nvarchar](400) NULL,
    [ExternalId]            [nvarchar](200) NULL,
    [MYId]                  [nvarchar](200) NULL,
    [UACS]                  [nvarchar](50) NULL,
    [MYCAApprovalDate]      [datetime] NULL,
    [Description]           [nvarchar](max) NOT NULL,
    [Region]                [nvarchar](20) NOT NULL,
    [Province]              [nvarchar](20) NULL,
    [City]                  [nvarchar](20) NULL,
    [LegislativeDistrict]   [nvarchar](20) NULL,
    [DEO]                   [nvarchar](20) NOT NULL,
    [OperatingUnit]         [nvarchar](20) NOT NULL,
    [ImplementingOffice]    [nvarchar](20) NOT NULL,
    [IslandCode]            [nvarchar](2) NULL,
    [Category]              [int] NOT NULL,
    [Thrust]                [int] NULL,
    [Origin]                [int] NOT NULL,
    [Agency]                [int] NOT NULL,
    [ImplementationMode]    [int] NULL,
    [EmergencyMode]         [int] NULL,
    [RegionWide]            [int] NOT NULL,
    [Feasibility]           [int] NULL,
    [FeasibilityDate]       [datetime] NULL,
    [DetailedDesign]        [int] NULL,
    [DetailedDesignDate]    [datetime] NULL,
    [RowAvailable]          [int] NULL,
    [Tier]                  [int] NOT NULL,
    [Rank]                  [float] NULL,
    [IsDeleted]             [bit] NOT NULL
        CONSTRAINT [DF_tRevisionProjects_IsDeleted] DEFAULT (0),
    CONSTRAINT [PK_tRevisionProjects]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_tRevisionProjects_Detail]
        UNIQUE NONCLUSTERED ([RevisionDetailFK]),
    CONSTRAINT [FK_tRevisionProjects_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id])
);
GO

/* -------------------------------------------------------------------------
   5. Documents, approval state, and correction history
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionDocuments](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [DocumentName]          [nvarchar](200) NOT NULL,
    [DocumentPath]          [nvarchar](max) NOT NULL,
    [IsApprovedDocument]    [bit] NOT NULL -- 1 = CO document; verify complete meaning of 0
        CONSTRAINT [DF_tRevisionDocuments_IsApproved] DEFAULT (0),
    CONSTRAINT [PK_tRevisionDocuments]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionDocuments_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id])
);
GO

/* One current approval-state row per Revision and approval level (IO/RO/CO).
   State changes are audited in tRevisionTransactionLog; returns are recorded
   in tRevisionForCorrectionDetails. */
CREATE TABLE [dbo].[tRevisionApprovals](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [Level]                 [nvarchar](10) NOT NULL,
    [Status]                [int] NOT NULL,
    [Description]           [nvarchar](max) NULL,
    [Approver]              [nvarchar](100) NULL,
    [ApprovedDate]          [datetime] NULL,
    [LastUpdatedDate]       [datetime] NULL,
    CONSTRAINT [PK_tRevisionApprovals]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_tRevisionApprovals_Level]
        UNIQUE NONCLUSTERED ([RevisionDetailFK], [Level]),
    CONSTRAINT [FK_tRevisionApprovals_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionApprovals_Level]
        FOREIGN KEY ([Level])
        REFERENCES [dbo].[tOptionRevisionApprovalLevel] ([Code]),
    CONSTRAINT [FK_tRevisionApprovals_Status]
        FOREIGN KEY ([Status])
        REFERENCES [dbo].[tOptionRevisionStatus] ([Enum])
);
GO

CREATE TABLE [dbo].[tRevisionForCorrectionDetails](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [ReturnedBy]            [nvarchar](10) NOT NULL,
    [ReturnedTo]            [nvarchar](10) NOT NULL,
    [CorrectionReason]      [nvarchar](500) NOT NULL,
    [ForCorrectionDate]     [datetime] NOT NULL
        CONSTRAINT [DF_tRevisionCorrection_Date] DEFAULT (GETDATE()),
    [IsCentralOffice]       [bit] NOT NULL,
    CONSTRAINT [PK_tRevisionForCorrectionDetails]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionCorrection_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionCorrection_ReturnedBy]
        FOREIGN KEY ([ReturnedBy])
        REFERENCES [dbo].[tOptionRevisionApprovalLevel] ([Code]),
    CONSTRAINT [FK_tRevisionCorrection_ReturnedTo]
        FOREIGN KEY ([ReturnedTo])
        REFERENCES [dbo].[tOptionRevisionApprovalLevel] ([Code])
);
GO

/* -------------------------------------------------------------------------
   6. Project component costs and annual amounts
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionProjectComponentCost](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [SourceCostId]          [int] NULL,
    [ComponentType]         [nvarchar](20) NOT NULL,
    [ComponentId]           [nvarchar](10) NOT NULL,
    [Description]           [nvarchar](max) NULL,
    [Total]                 [decimal](18,5) NOT NULL,
    [IsDeleted]             [bit] NOT NULL
        CONSTRAINT [DF_tRevisionCost_IsDeleted] DEFAULT (0),
    CONSTRAINT [PK_tRevisionProjectComponentCost]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionCost_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionCost_ComponentType]
        FOREIGN KEY ([ComponentType])
        REFERENCES [dbo].[tOptionProjectComponentType] ([ComponentId]),
    CONSTRAINT [CK_tRevisionCost_Total]
        CHECK ([Total] >= 0)
);
GO

CREATE TABLE [dbo].[tRevisionProjectComponentCostPerYear](
    [Id]                        [int] IDENTITY(1,1) NOT NULL,
    [RevisionComponentCostFK]   [int] NOT NULL,
    [Amount]                    [decimal](18,5) NOT NULL,
    [Year]                      [int] NOT NULL,
    [UACS]                      [nvarchar](50) NULL,
    [StartDate]                 [datetime] NULL,
    [EndDate]                   [datetime] NULL,
    [DateOfApproval]            [datetime] NULL,
    [IsDeleted]                 [bit] NOT NULL
        CONSTRAINT [DF_tRevisionCostYear_IsDeleted] DEFAULT (0),
    CONSTRAINT [PK_tRevisionProjectComponentCostPerYear]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionCostYear_Cost]
        FOREIGN KEY ([RevisionComponentCostFK])
        REFERENCES [dbo].[tRevisionProjectComponentCost] ([Id]),
    CONSTRAINT [CK_tRevisionCostYear_Amount]
        CHECK ([Amount] >= 0),
    CONSTRAINT [CK_tRevisionCostYear_Dates]
        CHECK ([EndDate] IS NULL OR [StartDate] IS NULL OR [EndDate] >= [StartDate])
);
GO

/* -------------------------------------------------------------------------
   7. Funding profile - multiple rows are allowed for one Formal Revision
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionProjectFundingProfile](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [SourceOrg]             [nvarchar](100) NOT NULL,
    [AgreementCode]         [nvarchar](50) NOT NULL,
    [Amount]                [decimal](18,5) NOT NULL,
    [Percentage]            [decimal](9,6) NOT NULL,
    [IsDeleted]             [bit] NOT NULL
        CONSTRAINT [DF_tRevisionFunding_IsDeleted] DEFAULT (0),
    [IsWalletDraw]          [bit] NULL,
    CONSTRAINT [PK_tRevisionProjectFundingProfile]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionFunding_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionFunding_Source]
        FOREIGN KEY ([SourceOrg])
        REFERENCES [dbo].[tOptionFundingSource] ([Organization]),
    CONSTRAINT [FK_tRevisionFunding_Agreement]
        FOREIGN KEY ([AgreementCode])
        REFERENCES [dbo].[tOptionFundingAgreement] ([Code]),
    CONSTRAINT [CK_tRevisionFunding_Amount]
        CHECK ([Amount] >= 0),
    CONSTRAINT [CK_tRevisionFunding_Percentage]
        CHECK ([Percentage] >= 0 AND [Percentage] <= 100)
);
GO

/* -------------------------------------------------------------------------
   8. Major work items and their locations
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionProjectMajorWorkItem](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [SourceWorkItemId]      [int] NULL,
    [ComponentId]           [nvarchar](10) NOT NULL,
    [YearOfWork]            [int] NOT NULL,
    [WorkTypeFK]            [int] NOT NULL,
    [InfraTypeFK]           [nvarchar](10) NOT NULL,
    [IsDeleted]             [bit] NOT NULL
        CONSTRAINT [DF_tRevisionWorkItem_IsDeleted] DEFAULT (0),
    CONSTRAINT [PK_tRevisionProjectMajorWorkItem]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionWorkItem_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id]),
    CONSTRAINT [FK_tRevisionWorkItem_WorkType]
        FOREIGN KEY ([WorkTypeFK])
        REFERENCES [dbo].[tOptionScopeOfWork] ([Enum]),
    CONSTRAINT [FK_tRevisionWorkItem_InfraType]
        FOREIGN KEY ([InfraTypeFK])
        REFERENCES [dbo].[tOptionInfraType] ([InfraCode])
);
GO

CREATE TABLE [dbo].[tRevisionProjectMajorWorkLocations](
    [Id]                    [int] IDENTITY(1,1) NOT NULL,
    [RevisionWorkItemFK]    [int] NOT NULL,
    [InfraId]               [nvarchar](50) NOT NULL,
    [DetailedScope]         [nvarchar](max) NULL,
    [TargetUnitId]          [int] NOT NULL,
    [TargetUnit]            [nvarchar](100) NOT NULL,
    [StartX]                [float] NULL,
    [StartY]                [float] NULL,
    [EndX]                  [float] NULL,
    [EndY]                  [float] NULL,
    [PhysicalTarget]        [float] NULL,
    [StartStationLimit]     [nvarchar](100) NULL,
    [EndStationLimit]       [nvarchar](100) NULL,
    [StartChainage]         [float] NULL,
    [EndChainage]           [float] NULL,
    [Length]                [float] NULL,
    [IsDeleted]             [bit] NOT NULL
        CONSTRAINT [DF_tRevisionLocation_IsDeleted] DEFAULT (0),
    CONSTRAINT [PK_tRevisionProjectMajorWorkLocations]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionLocation_WorkItem]
        FOREIGN KEY ([RevisionWorkItemFK])
        REFERENCES [dbo].[tRevisionProjectMajorWorkItem] ([Id])
);
GO

/* -------------------------------------------------------------------------
   9. Immutable audit trail for edits and approval-state transitions
   ------------------------------------------------------------------------- */
CREATE TABLE [dbo].[tRevisionTransactionLog](
    [Id]                    [bigint] IDENTITY(1,1) NOT NULL,
    [RevisionDetailFK]      [int] NOT NULL,
    [ReferenceId]           [nvarchar](200) NULL,
    [TypeOfTransaction]     [nvarchar](50) NOT NULL,
    [AffectedTable]         [nvarchar](128) NOT NULL,
    [AffectedColumn]        [nvarchar](128) NULL,
    [OldValue]              [nvarchar](max) NULL,
    [NewValue]              [nvarchar](max) NULL,
    [CreatedBy]             [nvarchar](100) NOT NULL,
    [CreatedDate]           [datetime] NOT NULL
        CONSTRAINT [DF_tRevisionTransactionLog_CreatedDate] DEFAULT (GETDATE()),
    CONSTRAINT [PK_tRevisionTransactionLog]
        PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_tRevisionTransactionLog_Detail]
        FOREIGN KEY ([RevisionDetailFK])
        REFERENCES [dbo].[tRevisionDetails] ([Id])
);
GO

CREATE NONCLUSTERED INDEX [IX_tRevisionTransactionLog_DetailDate]
ON [dbo].[tRevisionTransactionLog] ([RevisionDetailFK], [CreatedDate] DESC);
GO

/* -------------------------------------------------------------------------
   Application/service invariants that require a stored procedure or service
   transaction; individual CHECK/FK constraints cannot prove these conditions.
   -------------------------------------------------------------------------

   A. Revision creation
      1. Project must have an exact published tProjectRevisions baseline.
      2. ProjectFK must equal the ProjectFK on ProjectRevisionFK.
      3. ProgramFK and ProgramRevisionFK must belong to the same Program.
      4. Read component construction/package statuses from the read-only linked
         server view PCMA_vw_ProjectComponentConstructionStatus.
      5. Derive the aggregate construction and package statuses using the
         client-confirmed precedence rules.
      6. Resolve exactly one active tRevisionRules row.
      7. Copy the published Project aggregate and component statuses in one
         database transaction.
      8. Missing JSON field rules are read-only; true means editable.

   B. Approval and PCMA republication
      1. IO/RO/CO approval transitions follow tOptionRevisionApprovalLevel and
         tOptionRevisionStatus.
      2. A returned Revision keeps the existing published baseline effective.
      3. CO final approval, effective-state activation, and PCMA republication
         are one coordinated operation.
      4. If PCMA publication fails, roll back the local CO approval/effective
         change and show an error so the user can retry or contact support.
      5. After successful CO approval/publication, this Revision becomes the
         PreviousRevisionDetailFK baseline of the next Formal Revision.

   C. Open decisions
      1. Whether more than one unresolved Revision may exist per Project.
      2. LS/wallet Project eligibility and special rules.
      3. Final handling of rule updates when pending Revisions exist.
*/
