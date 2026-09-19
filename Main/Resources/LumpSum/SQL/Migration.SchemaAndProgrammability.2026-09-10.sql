/* =============================================================================
   MYPS — all-in-one schema + programmability migration
   2026-09-10
   -----------------------------------------------------------------------------
   TARGET: localhost / myps_db_dev_200.

   WHY THIS FILE EXISTS

   myps_db_dev_200 was restored on 2026-09-10 from the 192.168.50.200 server and
   is now the database Main/appsettings.Development.json points at. It is a
   DIFFERENT LINEAGE from localhost/myps_db_dev: it carries that server's
   reporting and revision fixes, but none of the Lump Sum v3 work. This repo is
   database-first — no EF migration pipeline, no runner, no tracking table — so
   nothing in the database records what has been applied to it.

   Every gap below was verified against the live database on 2026-09-10, not
   assumed from the file list.

   WHAT IS MISSING, AND WHICH SCRIPT IT COMES FROM

   LumpSum.Baseline.sql — entirely un-applied:
     - tProjects.ParentProjectId / ItemizationType / ProjectStatus  (all absent)
     - IX_tProjects_ParentProjectId (filtered)                      (absent)
     - IX_tProjectStages_RevisionId, IX_tProjects_ProjectType       (absent)
     - vLumpSumSet, vLumpSumChildSet, vLumpSumBalance               (absent)
     - fProgramStages, pRecomputeProgramCost, fProgramProjects      (stale:
       2026-08-14 / 08-31 / 08-24, all older than the repo file)
     - tProjectRevisions.Region / DEO / ImplementingOffice are still NOT NULL,
       so a Lump Sum Project cannot be saved at all
     - tLSWallets, vLSWalletBalance, vLSWalletProjectSet and
       FK_tProjects_ParentWallet survive from the wallet era (tLSWallets: 0 rows)

   Importing.Schema.sql / Importing.CategoryToPAPMap.Schema.sql — the tables
   exist but were made by hand, so the repo's IF NOT EXISTS (table) guard never
   added their constraints:
     - UX_tImportJobResult_JobId                                    (absent)
     - DF_tImportJobResult_ValidCount / _WarningCount / _ErrorCount (absent)
     - IX_tOptionProjectCategoryToPAPMap_CategoryId                 (absent)

   LumpSum.Permissions.sql — dbo.tApiActions still holds the wallet-era action
   names (InitFilterLumpsum, ShowLumpsum, LumpsumDetails, WalletBalance). Every
   Lump Sum endpoint 403s until they are replaced and granted.

   WHAT THIS FILE DELIBERATELY DOES NOT DO

   1. It does NOT re-apply Reports.CrystalReportSQLFixes.sql. The LIVE database
      is AHEAD of that file for two procedures, and replaying it would silently
      revert them:

          sp_RBP        live 9285 chars (2026-09-09)  vs  repo file 7162
          a1_usp_AIP2   live 10355 chars (2026-09-10) vs  repo file 8720

      Those are the 2026-09-09 legacy-parity fix and the 2026-09-10 UACS-filter
      fix — the two whose _backup_pre_*.sql snapshots were committed on
      2026-09-10 with no forward source written back into the repo. This is the
      exact failure mode Revision.Queue.sql's own header records. Do not "just
      run everything".

   2. It does NOT touch fRevisionQueue, vRevisionPending, fProjectStageTargets
      or pReserveProjectIdBlock. All four were checked and are already current.

   3. It contains NO DATA MIGRATIONS. The LumpSum.Repair.*, LumpSum.Migrate.*,
      ComponentMigration, SampleData.Dev and DataSecurity.Dev scripts are out of
      scope, and so is the Baseline's own §6 backfill — that backfill keys off
      "ParentProjectId IS NOT NULL", and this file creates that column empty, so
      it would touch zero rows here regardless.

      The one exception is the permission section at the end. Those are INSERTs,
      but they are registration rows, not business data: without them every
      object below exists and the module is still dead.

   4. It does NOT change READ_COMMITTED_SNAPSHOT, which is currently OFF on this
      database. That is a whole-database setting whose ALTER disconnects every
      other session, so it stays in its own script. RUN IT SEPARATELY:
          LumpSum.Isolation.ReadCommittedSnapshot.sql
      Left off, Lump Sum reads take shared locks and deadlock with writers; the
      symptom is a 12-second read or a timeout, not an error.

   ORDER IS NOT OPTIONAL. The foreign key goes before the table it points at,
   the views before the objects that read them, and the columns before the
   indexes built on them.

   QUOTED_IDENTIFIER. sqlcmd defaults it OFF, and the filtered index on
   tProjects makes SQL Server refuse any UPDATE on that table when it is off.
   Every batch below sets it ON for that reason.

   Idempotent — safe to re-run. A second run must change nothing.

   HOW TO RUN
       sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C \
         -i Main/Resources/Internal/SQLScripts/Migration.SchemaAndProgrammability.2026-09-10.sql
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0. Where am I?
   -----------------------------------------------------------------------------
   Print the target, then refuse to run against the retired production database
   name. 'myps_db' is flagged as forbidden/retired in
   Reports.CrystalReportSQLFixes.sql (SKL-005 / ADR-118), yet appsettings.json
   and appsettings.Staging.json still name it — so the guard is not theoretical.
   ============================================================================= */
PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));
GO

IF DB_NAME() = N'myps_db'
BEGIN
    RAISERROR('REFUSED: this script will not run against myps_db, the retired production database name (SKL-005/ADR-118). Point it at a dev database.', 20, 1) WITH LOG;
END
GO


/* #############################################################################
   PART 1 of 8 — project type constraint
   Source: LumpSum.Baseline.sql lines 58-105 (verbatim)
   ############################################################################# */

/* =============================================================================
   1. Project type: the CHECK constraint is REMOVED (decision 2026-09-05)
   -----------------------------------------------------------------------------
   Earlier revisions of this script (and LSWallet.Schema.sql before it) put a
   CHECK constraint on dbo.tProjects.ProjectType:

       CK_tProjects_ProjectType  CHECK (ProjectType IN ('MY','LS','AIP','NP'))
       MY = Multi-Year · LS = Lump Sum · AIP = Regular AIP · NP = Non Project

   It is dropped here and not re-created. The reasons, so nobody restores it:

   - A hard-coded value list in a constraint is the wrong shape for a code set
     the application grows (NP was itself bolted on in August 2026). The right
     design is an enum/lookup table — a dbo.tOptionProjectType with the codes,
     names and an IsActive flag, and a foreign key from tProjects — which can be
     extended by data, read by the UI for its dropdown, and validated by the
     same lookup everywhere. That table does not exist yet; it is the follow-up.

   - The Program importer (Hangfire/Importing/ImportingHelper.cs,
     SaveProjectDetails, three writes) puts the row's ISLAND CODE — 'LZ', 'VS',
     'MN' — into ProjectType, so every clean Program import failed this
     constraint at its first INSERT wherever this baseline had been applied.
     Found 2026-09-05. The importer is not changed by this decision; what it
     writes there is documented, and the column's meaning is settled when the
     lookup table is.

   - The data never conformed. On the 2026-09-01 localhost/myps_db_dev restore
     all 56,289 non-Lump-Sum tProjects rows carried the literal 4-character
     string 'NULL' in ProjectType (the word, not SQL NULL; the column is NOT
     NULL) — dirty data from an earlier import — so the constraint could only
     ever be added WITH NOCHECK, i.e. untrusted, validating new rows against a
     rule the existing rows already broke.

   What the Lump Sum module itself relies on is unchanged and needs no
   constraint: it writes ProjectType = 'LS' on a Lump Sum Project and on every
   itemized child, and identifies membership by ProjectType + ParentProjectId.
   An itemized child's ISLAND CODE goes where it belongs — the generated Project
   ID's suffix (LZ / VS / MN) and tProjectRevisions.IslandCode — never into
   ProjectType.

   Record: documents/docs/engineering/MYPS_PROJECTTYPE_CHECK_CONSTRAINT_REMOVED.md
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_tProjects_ProjectType')
BEGIN
    ALTER TABLE dbo.tProjects DROP CONSTRAINT CK_tProjects_ProjectType;
    PRINT 'CK_tProjects_ProjectType dropped — see §1 for why it is not re-created.';
END
GO

/* #############################################################################
   PART 2 of 8 — retire the wallet era, then widen the location columns
   Source: LumpSum.Baseline.sql lines 108-184 (verbatim)
   ############################################################################# */

/* =============================================================================
   2. Retire the wallet-era model
   -----------------------------------------------------------------------------
   V2 collapses Lump Sum onto the project model, so the parallel wallet storage
   is deleted, not migrated. Order matters: the FK on tProjects must go before
   tLSWallets can be dropped, and views before the tables they read.

   tLSWalletProjectRevisions goes with WF-6 (decision 7).
   ============================================================================= */
IF OBJECT_ID('dbo.vLSWalletLatest', 'V')          IS NOT NULL DROP VIEW dbo.vLSWalletLatest;
IF OBJECT_ID('dbo.vLSWalletBalance', 'V')         IS NOT NULL DROP VIEW dbo.vLSWalletBalance;
IF OBJECT_ID('dbo.vLSWalletProjectSet', 'V')      IS NOT NULL DROP VIEW dbo.vLSWalletProjectSet;
IF OBJECT_ID('dbo.vLSProjectSet', 'V')            IS NOT NULL DROP VIEW dbo.vLSProjectSet;
IF OBJECT_ID('dbo.vLSItemizableCandidates', 'V')  IS NOT NULL DROP VIEW dbo.vLSItemizableCandidates;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tProjects_ParentWallet')
    ALTER TABLE dbo.tProjects DROP CONSTRAINT FK_tProjects_ParentWallet;
GO

IF OBJECT_ID('dbo.tLSWalletComponentCostPerYear', 'U') IS NOT NULL DROP TABLE dbo.tLSWalletComponentCostPerYear;
IF OBJECT_ID('dbo.tLSWalletComponentCost', 'U')        IS NOT NULL DROP TABLE dbo.tLSWalletComponentCost;
IF OBJECT_ID('dbo.tLSWalletFundingProfile', 'U')       IS NOT NULL DROP TABLE dbo.tLSWalletFundingProfile;
IF OBJECT_ID('dbo.tLSWalletRevisions', 'U')            IS NOT NULL DROP TABLE dbo.tLSWalletRevisions;
IF OBJECT_ID('dbo.tLSWallets', 'U')                    IS NOT NULL DROP TABLE dbo.tLSWallets;
IF OBJECT_ID('dbo.tLSWalletProjectRevisions', 'U')     IS NOT NULL DROP TABLE dbo.tLSWalletProjectRevisions;
GO

PRINT 'Wallet-era Lump Sum objects retired.';
GO


/* =============================================================================
   2b. Location and organizational columns become nullable
   -----------------------------------------------------------------------------
   The V2 field spec makes Region, DEO and ImplementingOffice OPTIONAL on a
   project revision (documents/plans/lump-sum-v2.md, "Field spec"). They are
   NOT NULL here, so a Lump Sum Project — which is program-wide and carries
   ImplementingOffice = '' by design, and need carry no Region, DEO, Province,
   City or Legislative District at all — cannot be saved.

   This is not a Lump Sum quirk being pushed onto shared tables. The same three
   columns are already nullable in the MyMYPS schema, which made the change for
   the same reason; this brings the column definitions into line with the spec
   the module is being built to.

   Widening NOT NULL to NULL is non-destructive and does not touch a single
   existing row. Province, City, LegislativeDistrict and Thrust are already
   nullable. Tier, Agency, Origin and RegionWide stay NOT NULL — the field spec
   makes all four REQUIRED, so the column definition and the spec already agree.
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.tProjectRevisions')
             AND name = 'Region' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.tProjectRevisions ALTER COLUMN Region nvarchar(20) NULL;
    PRINT 'dbo.tProjectRevisions.Region is now nullable.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.tProjectRevisions')
             AND name = 'DEO' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.tProjectRevisions ALTER COLUMN DEO nvarchar(20) NULL;
    PRINT 'dbo.tProjectRevisions.DEO is now nullable.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.tProjectRevisions')
             AND name = 'ImplementingOffice' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.tProjectRevisions ALTER COLUMN ImplementingOffice nvarchar(20) NULL;
    PRINT 'dbo.tProjectRevisions.ImplementingOffice is now nullable.';
END
GO

/* #############################################################################
   PART 3 of 8 — the three tProjects columns and their indexes
   Source: LumpSum.Baseline.sql lines 186-229 and 249-268 (verbatim; the §6 backfill between them is a data migration and is omitted)
   ############################################################################# */

/* -- 3. tProjects.ParentProjectId --------------------------------------------
   Additive. The design report calls this the "Parent Project ID field", set to
   the LS Project's ID on every itemized project. ParentWalletId is left alone;
   nothing reads it after this, and dropping a column is not this script's job.
   ---------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.tProjects', 'ParentProjectId') IS NULL
BEGIN
    ALTER TABLE dbo.tProjects ADD ParentProjectId NVARCHAR(200) NULL;
    PRINT 'Added dbo.tProjects.ParentProjectId.';
END
ELSE
    PRINT 'dbo.tProjects.ParentProjectId already present.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tProjects_ParentProjectId')
BEGIN
    /* Filtered: only itemized rows carry a parent, and they are a small minority
       of tProjects. The lookup is always "children of this LS Project". */
    CREATE INDEX IX_tProjects_ParentProjectId
        ON dbo.tProjects (ParentProjectId)
        WHERE ParentProjectId IS NOT NULL;
    PRINT 'Created IX_tProjects_ParentProjectId.';
END
GO

/* -- 4. tProjects.ItemizationType -------------------------------------------- */
IF COL_LENGTH('dbo.tProjects', 'ItemizationType') IS NULL
BEGIN
    ALTER TABLE dbo.tProjects ADD ItemizationType NVARCHAR(20) NULL;
    PRINT 'Added dbo.tProjects.ItemizationType.';
END
ELSE
    PRINT 'dbo.tProjects.ItemizationType already present.';
GO

/* -- 5. tProjects.ProjectStatus ---------------------------------------------- */
IF COL_LENGTH('dbo.tProjects', 'ProjectStatus') IS NULL
BEGIN
    ALTER TABLE dbo.tProjects ADD ProjectStatus NVARCHAR(20) NULL;
    PRINT 'Added dbo.tProjects.ProjectStatus.';
END
ELSE
    PRINT 'dbo.tProjects.ProjectStatus already present.';
GO
/* -- 6a. Indexes the per-project views seek on (2026-09-06) ------------------
   Both views below reach a project's rows through these keys. Without them the
   stage lookup (TOP 1 per revision, ORDER BY Id DESC) walked tProjectStages —
   the very page-level lock the deadlock graph shows the reader waiting on — and
   the list had to scan tProjects for its 33 parents among 56k rows.
   ---------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectStages_RevisionId'
                 AND object_id = OBJECT_ID('dbo.tProjectStages'))
    CREATE NONCLUSTERED INDEX IX_tProjectStages_RevisionId
        ON dbo.tProjectStages (RevisionId, Id)
        INCLUDE (StageName);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjects_ProjectType'
                 AND object_id = OBJECT_ID('dbo.tProjects'))
    CREATE NONCLUSTERED INDEX IX_tProjects_ProjectType
        ON dbo.tProjects (ProjectType, ParentProjectId)
        INCLUDE (ProjectPK, ProgramFK, ProgramId);
GO
/* -- 6b. Indexes the program cost rollups read through (2026-09-18) ----------
   dbo.pRecomputeProgramCost and dbo.fProgramStages (section 11) reach a
   program's projects by (ProgramFK, StageId). There was no such index, so every
   evaluation scanned all of tProjectStages (258,561 rows on myps_db_dev_200).
   They then read each component's Total and each per-year row's Year and Amount
   through a key lookup per row. The two filtered indexes below carry exactly the
   columns the rollups read, so those lookups disappear.

   NEW indexes, not wider versions of IX_tProjectComponentCost_Live and
   IX_tProjectComponentCostPerYear_Live: other readers seek on those, and an
   additive index cannot change their plans. Check sys.dm_db_index_usage_stats
   before ever dropping one of the older two.

   Both tables already carry a filtered index, so the QUOTED_IDENTIFIER rule in
   this file's header is not new here. tProjectComponentCostPerYear holds about
   5.6 million rows; its index takes on the order of a minute to build.
   ---------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectStages_ProgramFK_StageId'
                 AND object_id = OBJECT_ID('dbo.tProjectStages'))
    CREATE NONCLUSTERED INDEX IX_tProjectStages_ProgramFK_StageId
        ON dbo.tProjectStages (ProgramFK, StageId)
        INCLUDE (ProjectFK, RevisionId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectComponentCost_Revision_Live'
                 AND object_id = OBJECT_ID('dbo.tProjectComponentCost'))
    CREATE NONCLUSTERED INDEX IX_tProjectComponentCost_Revision_Live
        ON dbo.tProjectComponentCost (ProjectRevisionFK)
        INCLUDE (Total, ComponentId)
        WHERE IsDeleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectComponentCostPerYear_Cost_Live'
                 AND object_id = OBJECT_ID('dbo.tProjectComponentCostPerYear'))
    CREATE NONCLUSTERED INDEX IX_tProjectComponentCostPerYear_Cost_Live
        ON dbo.tProjectComponentCostPerYear (ComponentCostFK)
        INCLUDE ([Year], Amount)
        WHERE IsDeleted = 0;
GO

/* #############################################################################
   PART 4 of 8 — the three Lump Sum views
   Source: LumpSum.Baseline.sql lines 269-672 (verbatim)
   ############################################################################# */

/* -- 7. dbo.vLumpSumSet -----------------------------------------------------
   One row per Lump Sum Project with its allocation figures. Backs the /lumpsum
   list, the detail header, and the ADR-055 rollups below.

   SHAPE: PER PROJECT, BY APPLY (2026-09-06 — the deadlock RCA,
   documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md).

   The previous shape found each project's latest revision with
   ROW_NUMBER() OVER (PARTITION BY ProjectFK) in a CTE, GROUP BY'd the costs of
   EVERY project in the database, and evaluated that twice (parents, then their
   children). SQL Server cannot push "WHERE Id = @id" through a window function,
   so reading ONE project scanned the whole revisions table: 14 parallel scans
   and 15,126 logical reads on tProjectRevisions (128,751 rows) for a single
   detail row, taking shared locks on every other project's rows on the way.
   That read, meeting the hard delete of a DIFFERENT project, was the deadlock;
   the read was the victim every time.

   Now the parents are seeked from tProjects — ProjectType 'LS' with no parent,
   the predicate every migration script already uses to mean "a Lump Sum
   parent" — and everything else is a correlated TOP 1 or SUM against that one
   project's keys: 42 reads on tProjectRevisions for the same detail row, about
   200 for the whole list. Membership is STILL "holds an LS component"
   (HasLSComponent = 1): the type is the seek key, not the rule.
   ---------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vLumpSumSet AS
SELECT
    p.Id                        AS Id,              -- cursor key for FilterDataCursor
    p.ProjectPK                 AS ProjectPK,
    p.ProgramFK                 AS ProgramFK,
    p.ProgramId                 AS ProgramId,
    /*  The program this appropriation sits in. The view carried ProgramFK and
        ProgramId but never the NAME, so the detail page had nothing to print
        under its "Program" heading and fell back to the project's Description —
        every Lump Sum Project claimed a program called whatever it was
        described as. vProgramLatest is one row per ProgramPK, so this cannot
        multiply rows. */
    pl.[Name]                   AS ProgramName,
    /*  The program's budget year, for the /lumpsum list's Year filter.

        vProgramLatest is already joined for the name above and is one row per
        ProgramPK, so this adds a column and cannot multiply rows. The filter bar
        previously offered Operating Unit instead, which is a property of the
        PROJECT and had no bearing on which appropriation year you were looking
        at. */
    pl.StartYear                AS StartYear,
    p.ProjectType               AS ProjectType,
    lr.Id                       AS RevisionId,
    lr.ProjectId                AS ProjectId,
    lr.AlternateId              AS AlternateId,
    lr.Description              AS Description,
    lr.Category                 AS Category,
    cat.CategoryName            AS CategoryName,
    lr.OperatingUnit            AS OperatingUnit,
    lr.Region                   AS Region,

    /*  THE FULL DETAIL SET — everything the edit form binds.

        vLumpSumSet originally carried only what the LIST needed, so
        LumpSumDetails could not populate the edit form: five of the eight
        fields the V2 field spec makes REQUIRED (Thrust, Tier, RegionWide,
        Agency, Origin) were absent, along with every optional one. A user
        editing a Lump Sum Project would see them blank and UpdateLumpSum would
        then refuse the save for fields they were never shown.

        vLumpSumChildSet already carries all of these; the parent view simply
        never did. Adding a column is safe for EF, which ignores columns the
        model does not declare — it is a MISSING column that aborts the read. */
    lr.Thrust                   AS Thrust,
    lr.Tier                     AS Tier,
    lr.[Rank]                   AS [Rank],
    lr.RegionWide               AS RegionWide,
    lr.Origin                   AS Origin,
    lr.Agency                   AS Agency,
    lr.Province                 AS Province,
    lr.City                     AS City,
    lr.LegislativeDistrict      AS LegislativeDistrict,
    lr.DEO                      AS DEO,
    lr.ImplementingOffice       AS ImplementingOffice,
    lr.MYCAApprovalDate         AS MYCAApprovalDate,
    lr.ImplementationMode       AS ImplementationMode,
    lr.EmergencyMode            AS EmergencyMode,
    lr.Feasibility              AS Feasibility,
    lr.FeasibilityDate          AS FeasibilityDate,
    lr.DetailedDesign           AS DetailedDesign,
    lr.DetailedDesignDate       AS DetailedDesignDate,
    lr.RowAvailable             AS RowAvailable,
    p.MYId                      AS MYId,
    p.ExternalId                AS ExternalId,
    stg.StageName               AS StageName,

    /*  THE ALLOCATION FIGURES (model of 2026-09-06).

        OriginalAllocation is the LS component's Total — the full allocation, kept
        equal to the parent's funding lines. Remaining is the component's per-year
        Amount — what is left, deducted by imports and restored by child deletes.
        Both are stored; Total = Remaining + Itemized is a check, not an identity. */
    pc.LSBalance                      AS Remaining,
    ISNULL(kids.Total, 0)             AS ItemizedTotal,
    ISNULL(kids.Cnt, 0)               AS ItemizedCount,
    pc.LSCost                         AS OriginalAllocation,

    uacs.UACS                   AS UACS,
    p.IsPublished               AS IsPublished,
    p.CreatedBy                 AS CreatedBy,
    p.CreatedDate               AS CreatedDate,
    lr.UpdatedBy                AS UpdatedBy,
    lr.UpdatedDate              AS UpdatedDate

FROM dbo.tProjects p

/*  The latest live revision: TOP 1 for THIS project, a seek on
    IX_tProjectRevisions_ProjectFK. pr.* keeps every column the select list
    reads through lr. */
CROSS APPLY (
    SELECT TOP 1 pr.*
    FROM   dbo.tProjectRevisions pr
    WHERE  pr.ProjectFK = p.ProjectPK
      AND  pr.IsDeleted = 0
    ORDER  BY pr.Id DESC
) lr

/*  Cost of THIS revision, split so the LS component can be read on its own.
    An aggregate with no GROUP BY always yields exactly one row, so a revision
    with no components still appears — with zeros — and is then excluded by
    HasLSComponent below, exactly as the old LEFT JOIN + GROUP BY did.

    tProjectComponentCost.ComponentType stores the component's NAME
    ("Lump Sum"), not its code, so the code is resolved through the lookup
    rather than hard-coded — the names are editable, the codes are not. */
CROSS APPLY (
    SELECT  ISNULL(SUM(cc.Total), 0)                                                      AS TotalCost,
            ISNULL(SUM(CASE WHEN opt.ComponentId = N'LS' THEN cc.Total END), 0)           AS LSCost,
            ISNULL(MAX(CASE WHEN opt.ComponentId = N'LS' THEN 1 ELSE 0 END), 0)           AS HasLSComponent,
            /*  THE BALANCE: the LS component's live per-year Amount(s). A correlated
                subquery, NOT a join — joining the per-year rows in here would
                multiply SUM(cc.Total) by the number of rows. */
            ISNULL((SELECT SUM(cy.Amount)
                    FROM   dbo.tProjectComponentCostPerYear cy
                    JOIN   dbo.tProjectComponentCost c2 ON c2.Id = cy.ComponentCostFK
                    JOIN   dbo.tOptionProjectComponentType o2 ON o2.ComponentName = c2.ComponentType
                    WHERE  c2.ProjectRevisionFK = lr.Id
                      AND  c2.IsDeleted = 0
                      AND  cy.IsDeleted = 0
                      AND  o2.ComponentId = N'LS'), 0)                                    AS LSBalance
    FROM    dbo.tProjectComponentCost cc
    LEFT JOIN dbo.tOptionProjectComponentType opt
           ON opt.ComponentName = cc.ComponentType
    WHERE   cc.ProjectRevisionFK = lr.Id
      AND   cc.IsDeleted = 0
) pc

LEFT JOIN dbo.vProgramLatest pl ON pl.ProgramPK = p.ProgramFK

/*  What its children have drawn out: each child's whole cost on ITS latest
    live revision (a child with no live revision is not counted, as before).
    Children are found by ParentProjectId — IX_tProjects_ParentProjectId. */
OUTER APPLY (
    SELECT COUNT(*) AS Cnt, SUM(kc.TotalCost) AS Total
    FROM   dbo.tProjects child
    CROSS APPLY (
        SELECT TOP 1 kr.Id
        FROM   dbo.tProjectRevisions kr
        WHERE  kr.ProjectFK = child.ProjectPK
          AND  kr.IsDeleted = 0
        ORDER  BY kr.Id DESC
    ) kr
    CROSS APPLY (
        SELECT ISNULL(SUM(kcc.Total), 0) AS TotalCost
        FROM   dbo.tProjectComponentCost kcc
        WHERE  kcc.ProjectRevisionFK = kr.Id
          AND  kcc.IsDeleted = 0
    ) kc
    WHERE  child.ParentProjectId = lr.ProjectId
) kids

/*  The stage recorded against this revision — IX_tProjectStages_RevisionId. */
OUTER APPLY (
    SELECT TOP 1 ps.StageName
    FROM   dbo.tProjectStages ps
    WHERE  ps.RevisionId = lr.Id
    ORDER  BY ps.Id DESC
) stg

/*  UACS lives per component-cost / fiscal-year row. The spec requires an
    itemized project's UACS to equal its LS parent's, so it is surfaced here for
    the comparison. */
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

LEFT JOIN dbo.tOptionProjectCategory cat ON cat.CategoryId = lr.Category

/*  A Lump Sum Project is one that HOLDS an LS component - not one whose LS cost
    happens to be non-zero. A fully itemized LS Project has Remaining 0 and must
    still be listed. The two tProjects predicates are the SEEK
    (IX_tProjects_ProjectType); they are what every parent already satisfies. */
WHERE p.ProjectType = N'LS'
  AND p.ParentProjectId IS NULL
  AND pc.HasLSComponent = 1;
GO
/* -- 8. dbo.vLumpSumChildSet ----------------------------------------------
   Same shape as LSWallet.ProjectModel.sql defines it, plus ItemizationType,
   ProjectStatus, ConstructionStatus and IsPackaged.

   ConstructionStatus reduces the PCMA per-component statuses to one
   project-level answer using the SAME precedence RevisionController.cs applies
   (On-Going wins outright; Terminated only when it is the only status; then Not
   Yet Started; then Completed). Kept identical deliberately - two different
   answers to "what is this project's construction status" is the bug this
   avoids.
   ---------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vLumpSumChildSet AS
/*  PER PROJECT, BY APPLY (2026-09-06) — the same change as vLumpSumSet, for the
    same reason: a ROW_NUMBER CTE over every revision cannot be filtered by the
    parent, so listing one parent's children scanned the table. See §7. */
SELECT
    p.Id                        AS Id,              -- cursor key for FilterDataCursor
    p.ProjectPK                 AS ProjectPK,
    p.ParentProjectId           AS ParentProjectId, -- the live link
    p.ProgramFK                 AS ProgramFK,
    p.ProgramId                 AS ProgramId,
    p.ProjectType               AS ProjectType,

    /* Proj-1 / Proj-9 fields. */
    p.ItemizationType           AS ItemizationType,
    ISNULL(p.ProjectStatus, 'potential') AS ProjectStatus,

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

    /*  PCMA construction status, for the 2.6.8 delete popup. NULL-safe: a
        project PCMA has never heard of reports 'No Components', which the
        delete gate treats as "safe to remove". */
    ISNULL(pcma.ConstructionStatus, 'No Components') AS ConstructionStatus,
    /*  CAST to BIT, not left as int. LSWalletProjectSet.IsPackaged is a bool,
        and the aggregate below produces an int - which the reader could not
        convert, so every call to ShowItemizedProjects answered 400. */
    CAST(ISNULL(pcma.IsPackaged, 0) AS bit) AS IsPackaged,

    ISNULL(fundall.Amount, 0)   AS FundingTotal,
    ISNULL(cost.Total, 0)       AS ComponentCostTotal,

    /*  What this child drew from its parent - its whole cost. Deleting it
        returns exactly this to the LS component. */
    ISNULL(cost.Total, 0)       AS DrawnFromParent,

    ISNULL(draw.Amount, 0)      AS CurrentDrawAmount,

    p.CreatedBy                 AS CreatedBy,
    p.CreatedDate               AS CreatedDate,
    lr.UpdatedBy                AS UpdatedBy,
    lr.UpdatedDate              AS UpdatedDate

FROM dbo.tProjects p

/*  The latest live revision of THIS child — a seek on IX_tProjectRevisions_ProjectFK. */
CROSS APPLY (
    SELECT TOP 1 pr.*
    FROM   dbo.tProjectRevisions pr
    WHERE  pr.ProjectFK = p.ProjectPK
      AND  pr.IsDeleted = 0
    ORDER  BY pr.Id DESC
) lr

OUTER APPLY (
    SELECT TOP 1 ps.StageName
    FROM   dbo.tProjectStages ps
    WHERE  ps.RevisionId = lr.Id
    ORDER  BY ps.Id DESC
) stg

OUTER APPLY (
    SELECT SUM(fp.Amount) AS Amount
    FROM   dbo.tProjectFundingProfile fp
    WHERE  fp.ProjectRevisionFK = lr.Id AND fp.IsDeleted = 0
) fundall

OUTER APPLY (
    SELECT SUM(cc.Total) AS Total
    FROM   dbo.tProjectComponentCost cc
    WHERE  cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0
) cost

/* The wallet-draw line on the child's funding profile, summed into
   CurrentDrawAmount. Read by UpdateDrawAmount, which guards a change at
   CurrentDrawAmount + Available. */
OUTER APPLY (
    SELECT SUM(fp.Amount) AS Amount
    FROM   dbo.tProjectFundingProfile fp
    WHERE  fp.IsDeleted = 0 AND fp.IsWalletDraw = 1
      AND  fp.ProjectRevisionFK = (
             SELECT TOP 1 pr.Id
             FROM   dbo.tProjectRevisions pr
             JOIN   dbo.tProjectFundingProfile f2
               ON   f2.ProjectRevisionFK = pr.Id
              AND   f2.IsDeleted = 0 AND f2.IsWalletDraw = 1
             WHERE  pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
             ORDER  BY pr.Id DESC)
) draw

OUTER APPLY (
    SELECT TOP 1 cy.UACS
    FROM   dbo.tProjectComponentCost cc
    JOIN   dbo.tProjectComponentCostPerYear cy
      ON   cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0
    WHERE  cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0 AND cy.UACS IS NOT NULL
    ORDER  BY cy.Year, cy.Id
) uacs

/*  PCMA per-component statuses, reduced to one. Precedence mirrors
    RevisionController.cs's UniqueComponentStatus switch exactly. */
OUTER APPLY (
    SELECT
        CASE
            WHEN COUNT(*) = 0 THEN 'No Components'
            WHEN MAX(CASE WHEN s.proj_comp_construction_status_desc = 'On-Going'        THEN 1 ELSE 0 END) = 1 THEN 'On-Going'
            WHEN MIN(CASE WHEN s.proj_comp_construction_status_desc = 'Terminated'      THEN 1 ELSE 0 END) = 1 THEN 'Terminated'
            WHEN MAX(CASE WHEN s.proj_comp_construction_status_desc = 'Not Yet Started' THEN 1 ELSE 0 END) = 1 THEN 'Not Yet Started'
            WHEN MAX(CASE WHEN s.proj_comp_construction_status_desc = 'Completed'       THEN 1 ELSE 0 END) = 1 THEN 'Completed'
            ELSE ''
        END                                                          AS ConstructionStatus,
        MIN(CASE WHEN s.is_packaged = 1 THEN 1 ELSE 0 END)           AS IsPackaged
    FROM   dbo.synPCMAStatusRev s
    WHERE  s.myps_project_id_FK = p.ProjectPK
) pcma

LEFT JOIN dbo.tOptionProjectCategory cat ON cat.CategoryId = lr.Category

/*  MEMBERSHIP BY PARENT PROJECT.

    Was ProjectType = 'LS' AND ParentWalletId IS NOT NULL, then briefly "any
    project of a program that has a wallet". Both were wrong: the design report
    ties an itemized project to ONE Lump Sum Project through the Parent Project
    ID field. */
WHERE p.ParentProjectId IS NOT NULL;
GO
/* -- 9. dbo.vLumpSumBalance -------------------------------------------------
   Per LS PROJECT now, keyed on tProjects.Id. Output shape must match
   DBHelper/Models/Views/Lumpsum/LSWalletBalance.cs exactly - EF binds FromSql
   results by column name.
   ---------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vLumpSumBalance AS
SELECT
    ls.Id                 AS WalletId,
    ls.OriginalAllocation AS Total,
    ls.ItemizedTotal      AS Itemized,
    ls.Remaining          AS Remaining
FROM dbo.vLumpSumSet ls;
GO

/* -- 10. (retired) dbo.vLumpSumItemizableCandidates ---------------------------
   REMOVED BY BUSINESS RULE. This view fed the Mode 2 picker — the projects that
   COULD be itemized, i.e. existing ones with no parent yet.

   The client's hard rule is that a Lump Sum Project is itemized into NEW
   projects ONLY, never existing ones. There is therefore no such thing as a
   candidate: children are created by the import, under the parent, and cannot
   pre-exist. A view listing "projects you could attach" describes an operation
   the business does not permit.

   Dropped explicitly below so a database carrying the earlier V2 baseline does
   not keep a view nothing reads.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.vLumpSumItemizableCandidates', 'V') IS NOT NULL
    DROP VIEW dbo.vLumpSumItemizableCandidates;
GO

/* #############################################################################
   PART 5 of 8 - the program cost rollups
   Rewritten 2026-09-18 (was: LumpSum.Baseline.sql lines 674-882, verbatim).
   ############################################################################# */

/* =============================================================================
   11. Program cost: one rule, two paths
   -----------------------------------------------------------------------------
   dbo.fProgramStages computes a program's cost live for the program LIST, per
   stage. dbo.pRecomputeProgramCost writes the same figure into
   tProgramRevisions.Cost, which Program Details shows. They are two
   implementations of ONE rule and must always be changed together - the test
   harness (MYPS.DatabaseTests/RecomputeProgramCostTests.cs) asserts they agree.

   THE RULE (2026-09-15 per-year basis; Lump Sum part decided 2026-09-18):

   - An ORDINARY project counts at the program's current stage, on the latest
     revision it has at that stage, from dbo.tProjectComponentCostPerYear: when
     it holds ONE distinct Year, that year's amount whatever the year is; when it
     holds SEVERAL, only the program year (dbo.tPrograms.StartYear).

   - AT GAA-R, AND ONLY THERE (2026-09-20, RISK-108): an ordinary project with an
     effective approved Formal Revision is read from that revision's
     tRevisionProjectComponentCost / tRevisionProjectComponentCostPerYear rows
     instead of its base ones, under the same per-year rule. Formal Revisions exist
     only at GAA-R (the Revision module admits nothing else), so every other stage
     reads the base tables only. "Effective" is exactly what
     dbo.fProjectFundingProfile and dbo.fProjectComponentCost use: the latest
     tRevisionDetails row on the project's stage revision (CreatedDate, then Id)
     that RO and CO have both approved (Status 1), the project published, and no
     stage row of the project at a higher StageHierarchy. Keep the three aligned.
     The predicate is inlined here, not applied through those functions: they are
     correlated per project and join snapshots, PCMA status and users, and applied
     across a 16,000-project stage they are the shape that took seconds.

   - A LUMP SUM PARENT (ProjectType 'LS', no ParentProjectId) counts the Total of
     its live 'LS' component (tProjectComponentCost, ComponentId = 'LS') on its
     latest live revision - the appropriation. Nothing else of it counts: its
     per-year row is the REMAINING balance after itemization and would shrink as
     the program itemized its own money. Every parent of the program counts,
     WHATEVER STAGE its own stage row sits at: parents are created and left at
     GAA-R while their programs move on, and a stage filter zeroed 86 of the 123
     parents on myps_db_dev_200.

   - An ITEMIZED CHILD (ParentProjectId set) never counts: its money was drawn
     out of the parent's appropriation, which is already counted whole
     (RISK-009). Children carry ProjectType 'LS' too, so ParentProjectId is what
     tells them apart.

   WHY IT IS SHAPED THIS WAY (2026-09-18, the slow-recompute RCA,
   documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md). The
   2026-09-15 procedure took 3.2 seconds on a 17,500-project program, inside
   every Lump Sum write's transaction. Its project set was a CTE the optimizer
   expanded three times, each a scan of tProjectStages, and the EXISTS against it
   inside the per-year aggregate became one tProjects lookup per PER-YEAR ROW
   (992,166 reads). The procedure now materialises that set once, keyed, and
   never touches a parent's or a child's per-year rows. Both objects reach a
   stage through IX_tProjectStages_ProgramFK_StageId (section 6b).
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE OR ALTER FUNCTION [dbo].[fProgramStages]
(
    @ProgramPK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        pgs.Id                  AS Id,
        pg.ProgramPK            AS ProgramPK,
        pgr.ProgramId           AS ProgramId,
        pgs.RevisionId          AS RevisionId,
        pgs.StageId             AS StageId,
        pgs.StageName           AS StageName,
        ISNULL(ss.DisplayName, pgs.StageName) AS StageDisplayName,
        pg.UserGroup            AS UserGroup,
        pg.DataSecurityGroup    AS DataSecurityGroup,

        opt.[Name]              AS ProgramType,
        pg.StartYear            AS StartYear,

        (SELECT COUNT(*)
         FROM dbo.tProjectStages ps2
         WHERE ps2.ProgramFK = @ProgramPK
           AND ps2.StageId   = pgs.StageId
        )                       AS ProjectCount,

        /*  THE PROGRAM'S COST AT THIS STAGE, on the rule dbo.pRecomputeProgramCost
            writes into tProgramRevisions.Cost (section 11 header).

            Part one: the ORDINARY projects at this stage - the latest revision of
            each, no Lump Sum parent, no itemized child - on the per-year rule. The
            per-year figures are grouped ONCE for every revision at the stage (agg,
            restricted by EXISTS to this program and stage) and then joined to the
            filtered project set, so a parent's or a child's figures never reach the
            sum. Grouping first, rather than joining the project set into the
            per-year rows, is what keeps ProgramHelper's one-stage read - run on
            every project validation - at or under the 2026-09-15 body's time on
            the largest programs (measured 2026-09-18). Correlated per stage row on
            purpose: a correlated subquery is evaluated only for the rows that
            survive the caller's WHERE.

            pgy re-reads the program year INSIDE this scope on purpose. Writing
            pg.StartYear here is refused: SQL Server will not aggregate an
            expression mixing an outer column with the query's own (Msg 8124).
            @ProgramPK is a parameter, not an outer column, so the seek is allowed,
            and it is one row on the key.

            AT THE GAA-R ROW ONLY, eff finds a project's effective approved Formal
            Revision - the predicate pRecomputeProgramCost's step 1b states, inlined
            the same way - and ragg reads that revision's tRevision* per-year rows in
            place of the base ones. Both are gated on the stage row's own Name
            (ss, joined below) and on eff having found one, so every other stage
            row, and every project without a revision, never evaluates them. */
        ISNULL((
            SELECT SUM(CASE WHEN eff.RevisionDetailId IS NULL
                            THEN CASE WHEN ISNULL(agg.[Years], 0) <= 1 THEN ISNULL(agg.AmountAllYears, 0)
                                      ELSE ISNULL(agg.AmountAtProgramYear, 0) END
                            ELSE CASE WHEN ISNULL(ragg.[Years], 0) <= 1 THEN ISNULL(ragg.AmountAllYears, 0)
                                      ELSE ISNULL(ragg.AmountAtProgramYear, 0) END
                       END)
            FROM (
                SELECT ps3.ProjectFK, ps3.RevisionId,
                       ROW_NUMBER() OVER (PARTITION BY ps3.ProjectFK ORDER BY ps3.RevisionId DESC) AS rn
                FROM dbo.tProjectStages ps3
                WHERE ps3.ProgramFK = @ProgramPK
                  AND ps3.StageId   = pgs.StageId
            ) sr
            JOIN dbo.tProjects prj
              ON prj.ProjectPK = sr.ProjectFK
            OUTER APPLY (
                SELECT TOP (1) rd.Id AS RevisionDetailId
                FROM dbo.tRevisionDetails rd
                WHERE ss.[Name]           = N'GAA-R'
                  AND prj.IsPublished     = 1
                  AND rd.ProjectRevisionFK = sr.RevisionId
                  AND EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                              WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'RO' AND ra.Status = 1)
                  AND EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                              WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'CO' AND ra.Status = 1)
                  AND NOT EXISTS (SELECT 1
                                  FROM dbo.tProjectStages s2
                                  JOIN dbo.tOptionProgramStage h2 ON h2.Id = s2.StageId
                                  JOIN dbo.tOptionProgramStage h1 ON h1.Id = pgs.StageId
                                  WHERE s2.ProjectFK = sr.ProjectFK
                                    AND h2.StageHierarchy > h1.StageHierarchy)
                ORDER BY rd.CreatedDate DESC, rd.Id DESC
            ) eff
            OUTER APPLY (
                SELECT COUNT(DISTINCT y.[Year])                                     AS [Years],
                       SUM(y.Amount)                                                AS AmountAllYears,
                       SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END)    AS AmountAtProgramYear
                FROM dbo.tRevisionProjectComponentCost rcc
                JOIN dbo.tRevisionProjectComponentCostPerYear y
                  ON y.RevisionComponentCostFK = rcc.Id AND y.IsDeleted = 0
                CROSS JOIN (SELECT TOP 1 pgx.StartYear
                            FROM dbo.tPrograms pgx
                            WHERE pgx.ProgramPK = @ProgramPK) pgy
                WHERE eff.RevisionDetailId IS NOT NULL
                  AND rcc.RevisionDetailFK = eff.RevisionDetailId
                  AND rcc.IsDeleted = 0
            ) ragg
            LEFT JOIN (
                SELECT cc.ProjectRevisionFK,
                       COUNT(DISTINCT y.[Year])                                     AS [Years],
                       SUM(y.Amount)                                                AS AmountAllYears,
                       SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END)    AS AmountAtProgramYear
                FROM dbo.tProjectComponentCost cc
                JOIN dbo.tProjectComponentCostPerYear y
                  ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
                CROSS JOIN (SELECT TOP 1 pgx.StartYear
                            FROM dbo.tPrograms pgx
                            WHERE pgx.ProgramPK = @ProgramPK) pgy
                WHERE cc.IsDeleted = 0
                  AND EXISTS (SELECT 1 FROM dbo.tProjectStages ps5
                              WHERE ps5.RevisionId = cc.ProjectRevisionFK
                                AND ps5.ProgramFK  = @ProgramPK
                                AND ps5.StageId    = pgs.StageId)
                GROUP BY cc.ProjectRevisionFK
            ) agg ON agg.ProjectRevisionFK = sr.RevisionId
            WHERE sr.rn = 1
              AND prj.ParentProjectId IS NULL
              AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
        ), 0)
        /*  Part two: the program's Lump Sum parents, ALL of them at ANY stage -
            the same figure on every stage row. */
        + ls.LumpSumCost        AS Cost

    FROM dbo.tProgramStages pgs

    JOIN dbo.tPrograms pg
        ON pg.ProgramPK = pgs.ProgramFK
    LEFT JOIN tOptionProgramType opt ON opt.NameId = pg.[Type]
    LEFT JOIN dbo.tOptionProgramStage ss ON ss.NameId = pgs.StageId

    JOIN dbo.tProgramRevisions pgr
        ON pgr.Id = pgs.RevisionId

    /*  The Lump Sum part. Uncorrelated with the stage row, so it is evaluated once
        per call rather than once per stage: SUM(Total) of the live 'LS' components
        on each parent's latest LIVE revision. A parent's per-year row (the
        remaining balance) and its children are never read. The latest revision is
        a TOP 1 per parent - vLumpSumSet's shape - because a ROW_NUMBER over the
        parents' revisions was planned as a scan of all of tProjectRevisions. */
    CROSS JOIN (
        SELECT ISNULL(SUM(cc.Total), 0) AS LumpSumCost
        FROM dbo.tProjects p
        CROSS APPLY (
            SELECT TOP 1 pr.Id
            FROM   dbo.tProjectRevisions pr
            WHERE  pr.ProjectFK = p.ProjectPK
              AND  pr.IsDeleted = 0
            ORDER  BY pr.Id DESC
        ) lr
        JOIN dbo.tProjectComponentCost cc
          ON cc.ProjectRevisionFK = lr.Id
         AND cc.IsDeleted   = 0
         AND cc.ComponentId = N'LS'
        WHERE p.ProgramFK        = @ProgramPK
          AND p.ProjectType      = N'LS'
          AND p.ParentProjectId IS NULL
    ) ls

    WHERE pgs.ProgramFK = @ProgramPK AND pg.IsDeleted = 0
);
GO

CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost]
    @ProgramPK NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @StartYear INT, @AtGaaR BIT,
            @OrdinaryCost DECIMAL(38,5), @LumpSumCost DECIMAL(38,5), @NewCost DECIMAL(18,2);

    SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
    FROM dbo.tProgramRevisions pgr
    JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
    WHERE pgr.ProgramFK = @ProgramPK
    ORDER BY pgr.Id DESC;

    IF @CurrentRevisionId IS NULL
    BEGIN
        RAISERROR('pRecomputeProgramCost: program %s has no revisions to recompute Cost for.', 16, 1, @ProgramPK);
        RETURN;
    END

    /*  THE PROGRAM YEAR. One value per program, shared by all of its stages.
        Guarded like the revision above: with a NULL here every multi-year project
        would silently contribute nothing. */
    SELECT @StartYear = pg.StartYear
    FROM dbo.tPrograms pg
    WHERE pg.ProgramPK = @ProgramPK;

    IF @StartYear IS NULL
    BEGIN
        RAISERROR('pRecomputeProgramCost: program %s has no StartYear to apply the program-year rule against.', 16, 1, @ProgramPK);
        RETURN;
    END

    /*  IS THE CURRENT STAGE GAA-R? Only there can an approved Formal Revision count
        (section 11 header). Matched on the stage's Name, through NameId as
        fProgramStages joins it - never on a literal id. */
    SET @AtGaaR = CASE WHEN EXISTS (SELECT 1 FROM dbo.tOptionProgramStage st
                                    WHERE st.NameId = @CurrentStageId AND st.[Name] = N'GAA-R')
                       THEN 1 ELSE 0 END;

    /*  1. THE ORDINARY PROJECTS AT THE CURRENT STAGE, materialised ONCE.

        tProjectStages carries one row per revision, so the latest revision of each
        project at the stage is what counts. Lump Sum PARENTS are not in this set:
        they count program-wide in step 3, whatever stage their own row sits at.
        Itemized CHILDREN are not in it either (RISK-009). A NULL ProjectType is an
        ordinary project.

        A keyed table variable, not a CTE: the CTE was expanded once per reference,
        three scans of tProjectStages, and the EXISTS against it became a tProjects
        lookup per per-year row. GROUP BY keeps the key unique on dirty data (two
        projects claiming one revision).

        OPTION (RECOMPILE), here and in step 2, is the parameter-sniffing guard: the
        cost of these statements scales with the program, from a handful of projects
        to 17,500, and a table variable carries no statistics. A plan cached for the
        first program called would be reused for all of them. Recompiling two small
        statements costs milliseconds. */
    DECLARE @Ordinary TABLE (RevisionId INT NOT NULL PRIMARY KEY, ProjectFK NVARCHAR(200) NOT NULL);

    INSERT @Ordinary (RevisionId, ProjectFK)
    SELECT sr.RevisionId, MIN(sr.ProjectFK)
    FROM (
        SELECT ps.ProjectFK, ps.RevisionId,
               ROW_NUMBER() OVER (PARTITION BY ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
        FROM dbo.tProjectStages ps
        WHERE ps.ProgramFK = @ProgramPK
          AND ps.StageId   = @CurrentStageId
    ) sr
    JOIN dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
    WHERE sr.rn = 1
      AND prj.ParentProjectId IS NULL
      AND (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
    GROUP BY sr.RevisionId
    OPTION (RECOMPILE);

    /*  1b. AT GAA-R ONLY: WHICH PROJECTS READ AN APPROVED FORMAL REVISION.

        The predicate is fProjectFundingProfile's / fProjectComponentCost's, inlined:
        the latest tRevisionDetails row on the project's stage revision (CreatedDate,
        then Id) that is RO- AND CO-approved; the project published; and no stage row
        of the project at a higher StageHierarchy. The two EXISTS equal
        fRevisionApprovalStatus's ROStatus = 1 AND COStatus = 1 because
        UQ_tRevisionApprovals_Level allows one row per level.

        Inlined, not applied: those functions are correlated per project and join
        snapshots, PCMA status and users; applied across a stage they are the shape
        that took seconds. Skipped outright at every other stage.

        The revised projects MOVE out of @Ordinary into @Revised, so step 2 stays
        the statement it was, plan included (measured 2026-09-20 on 16,592 projects
        at GAA-R): folding the revision rows into it as a UNION ALL turned its
        parallel hash plan into 14,557 serial seeks, and running the published and
        later-stage checks together with the revision lookup made the optimizer
        check every project, 390,000 reads. So the revision lookup runs first and
        leaves a handful of rows, and the project checks run on those alone - the
        same result, since published and later-stage are facts of the project, not
        of which revision was picked. */
    DECLARE @Revised TABLE (RevisionId INT NOT NULL PRIMARY KEY, RevisionDetailId INT NOT NULL);

    IF @AtGaaR = 1
    BEGIN
        /*  Driven from tRevisionDetails, not from @Ordinary: revisions are few and
            projects many, and a per-project TOP 1 seek cost 14,557 seeks on that
            program. ROW_NUMBER picks the same row the functions' TOP (1) does. */
        INSERT @Revised (RevisionId, RevisionDetailId)
        SELECT x.ProjectRevisionFK, x.RevisionDetailId
        FROM (
            SELECT rd.ProjectRevisionFK, rd.Id AS RevisionDetailId,
                   ROW_NUMBER() OVER (PARTITION BY rd.ProjectRevisionFK
                                      ORDER BY rd.CreatedDate DESC, rd.Id DESC) AS rn
            FROM   dbo.tRevisionDetails rd
            WHERE  EXISTS (SELECT 1 FROM @Ordinary o WHERE o.RevisionId = rd.ProjectRevisionFK)
              AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                           WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'RO' AND ra.Status = 1)
              AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                           WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'CO' AND ra.Status = 1)
        ) x
        WHERE x.rn = 1
        OPTION (RECOMPILE);

        IF EXISTS (SELECT 1 FROM @Revised)
        BEGIN
            DELETE r
            FROM   @Revised r
            JOIN   @Ordinary o ON o.RevisionId = r.RevisionId
            JOIN   dbo.tProjects prj ON prj.ProjectPK = o.ProjectFK
            WHERE  ISNULL(prj.IsPublished, 0) <> 1
               OR  EXISTS (SELECT 1
                           FROM   dbo.tProjectStages s2
                           JOIN   dbo.tOptionProgramStage h2 ON h2.Id = s2.StageId
                           JOIN   dbo.tOptionProgramStage h1 ON h1.Id = @CurrentStageId
                           WHERE  s2.ProjectFK = o.ProjectFK
                             AND  h2.StageHierarchy > h1.StageHierarchy);

            DELETE o
            FROM   @Ordinary o
            WHERE  EXISTS (SELECT 1 FROM @Revised r WHERE r.RevisionId = o.RevisionId);
        END
    END

    /*  2. THE PER-YEAR RULE over the projects read from the base tables, grouped
        once per revision.

        ONE distinct Year: its amount counts whatever the year is. SEVERAL: only the
        program year. "One" means one distinct Year, not one row - two components
        each holding a row for the same year are one year of cost between them. A
        project with no live per-year rows drops out of the joins and adds nothing. */
    SELECT @OrdinaryCost = ISNULL(SUM(
        CASE WHEN agg.[Years] <= 1 THEN agg.AmountAllYears
             ELSE agg.AmountAtProgramYear END), 0)
    FROM (
        SELECT o.RevisionId,
               COUNT(DISTINCT y.[Year])                                    AS [Years],
               SUM(y.Amount)                                               AS AmountAllYears,
               SUM(CASE WHEN y.[Year] = @StartYear THEN y.Amount END)      AS AmountAtProgramYear
        FROM @Ordinary o
        JOIN dbo.tProjectComponentCost cc
          ON cc.ProjectRevisionFK = o.RevisionId AND cc.IsDeleted = 0
        JOIN dbo.tProjectComponentCostPerYear y
          ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
        GROUP BY o.RevisionId
    ) agg
    OPTION (RECOMPILE);

    /*  2b. THE SAME RULE over the revised projects (1b), read from their approved
        revision's tRevision* rows INSTEAD of their base rows - the revision is the
        whole project, as in fProjectComponentCost. Empty everywhere but GAA-R. */
    IF EXISTS (SELECT 1 FROM @Revised)
        SELECT @OrdinaryCost = @OrdinaryCost + ISNULL(SUM(
            CASE WHEN agg.[Years] <= 1 THEN agg.AmountAllYears
                 ELSE agg.AmountAtProgramYear END), 0)
        FROM (
            SELECT r.RevisionId,
                   COUNT(DISTINCT y.[Year])                                    AS [Years],
                   SUM(y.Amount)                                               AS AmountAllYears,
                   SUM(CASE WHEN y.[Year] = @StartYear THEN y.Amount END)      AS AmountAtProgramYear
            FROM @Revised r
            JOIN dbo.tRevisionProjectComponentCost rcc
              ON rcc.RevisionDetailFK = r.RevisionDetailId AND rcc.IsDeleted = 0
            JOIN dbo.tRevisionProjectComponentCostPerYear y
              ON y.RevisionComponentCostFK = rcc.Id AND y.IsDeleted = 0
            GROUP BY r.RevisionId
        ) agg;

    /*  3. THE LUMP SUM PARENTS OF THE PROGRAM - all of them, at ANY stage.

        What a parent contributes is its appropriation: SUM(Total) of the live 'LS'
        components on its latest LIVE revision. Its per-year row is the remaining
        balance after itemization and is never read, and its children are never
        read at all. IX_tProjects_ProjectType seeks the parents; the latest live
        revision is a TOP 1 per parent on IX_tProjectRevisions_ProjectFK, the shape
        vLumpSumSet uses. */
    SELECT @LumpSumCost = ISNULL(SUM(cc.Total), 0)
    FROM dbo.tProjects p
    CROSS APPLY (
        SELECT TOP 1 pr.Id
        FROM   dbo.tProjectRevisions pr
        WHERE  pr.ProjectFK = p.ProjectPK
          AND  pr.IsDeleted = 0
        ORDER  BY pr.Id DESC
    ) lr
    JOIN dbo.tProjectComponentCost cc
      ON cc.ProjectRevisionFK = lr.Id
     AND cc.IsDeleted   = 0
     AND cc.ComponentId = N'LS'
    WHERE p.ProgramFK        = @ProgramPK
      AND p.ProjectType      = N'LS'
      AND p.ParentProjectId IS NULL;

    SET @NewCost = @OrdinaryCost + @LumpSumCost;

    UPDATE dbo.tProgramRevisions
    SET Cost = @NewCost
    WHERE Id = @CurrentRevisionId;

    /*  StageId is extra: DBHelper.Models.Procedures.RecomputeProgramCost declares
        only RevisionId and NewCost, and EF's FromSql ignores unmapped result
        columns. Kept so the result-set contract does not move. */
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
GO


SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* -- 12. dbo.fProgramProjects -----------------------------------------------
   Both office joins become LEFT so a Lump Sum Project — which has no
   implementing office — appears in its own program's list.

   NOT '' BUT NULL. This said "carries ImplementingOffice = '' by design",
   which was never true: CreateLumpSum writes NULL, deliberately. The raw
   ParticipantId and Region columns below therefore come back NULL, and
   ProgramProjects.cs declares them nullable to match. Only the joined Name
   columns are coalesced, and only so a missing office renders blank.
   ---------------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION [dbo].[fProgramProjects]
(
    @ProgramPK NVARCHAR(200),
    @StageId   INT
)
RETURNS TABLE AS RETURN
(
    SELECT
        p.Id                     AS Id,
        ps.RevisionId            AS RevisionId,
        CASE WHEN d.Source = N'Revision' THEN rd.ProjectRevisionFK ELSE NULL END AS OldSourceId,
        ps.Id                    AS StageFK,
        ps.ProjectFK             AS ProjectPK,
        d.ProgramFK,
        d.ProgramId,
        d.ProjectId,
        d.ProgramName,
        ps.StageName,
        d.Category,
        d.CategoryName,
        d.ThrustName,
        d.Description,
        d.Region,
        /*  ISNULL on the NAMES only, now that the joins are outer, so a Lump
            Sum Project's missing office renders blank rather than null.

            The ParticipantId columns beside them are passed through RAW. They
            come straight from fProjectDetails and are NULL for a Lump Sum
            parent; ProgramProjects.cs declares them string? for that reason.
            Do not coalesce them here — an id is either a real reference or
            absent, and '' is neither. */
        ISNULL(ou.[Name], N'')   AS OperatingUnitName,
        d.OperatingUnit          AS OperatingUnitParticipantId,
        ISNULL([io].[Name], N'') AS ImplementingOfficeName,
        d.ImplementingOffice     AS ImplementingOfficeParticipantId,
        d.Source,
        p.IsPublishable          AS IsPublishable,
        p.IsPublished            AS IsPublished,
        /*  CreatedBy was missing from this redefinition. dev-trunk f1a17924
            (2026-09-04) synced ProgramProjects.cs to the LIVE function, which
            returns it, and EF's FromSql refuses a result set that lacks a mapped
            column — so ShowProjectsInProgram failed with "The required column
            'CreatedBy' was not present" on every database carrying this
            baseline. Sourced from fProjectDetails like its neighbours. */
        d.CreatedBy,
        d.CreatedDate,
        d.LastUpdatedBy,
        d.LastUpdatedDate,
        ISNULL(rd.CreatedBy, pr.CreatedBy)     AS RevisionCreatedBy,
        ISNULL(rd.CreatedDate, pr.CreatedDate) AS RevisionCreatedDate
    FROM dbo.tProjectStages ps
    JOIN dbo.tProjects p ON p.ProjectPK = ps.ProjectFK
    JOIN dbo.tProjectRevisions pr ON pr.Id = ps.RevisionId
    CROSS APPLY dbo.fProjectDetails(ps.ProjectFK, ps.StageId) d
    CROSS APPLY dbo.fProjectEffectiveRevision(ps.ProjectFK) er
    LEFT JOIN dbo.tRevisionDetails rd ON rd.Id = er.RevisionDetailFK
    /*  LEFT, not JOIN: see the header. An absent ParticipantId is a legitimate
        state for a Lump Sum Project, not a reason to hide the project. */
    LEFT JOIN dbo.vAdminImplementingOffice [io] ON [io].ParticipantId = d.ImplementingOffice
    LEFT JOIN dbo.vAdminOperatingUnit ou ON ou.ParticipantId = d.OperatingUnit
    WHERE ps.ProgramFK = @ProgramPK
      AND (@StageId IS NULL OR ps.StageId = @StageId)
      AND pr.IsDeleted = 0
);
GO

/* #############################################################################
   PART 6 of 8 — import-table constraints
   Source: Importing.Schema.sql and Importing.CategoryToPAPMap.Schema.sql
   ############################################################################# */

/* =============================================================================
   14. dbo.tImportJobResult — the constraints its CREATE TABLE would have made
   -----------------------------------------------------------------------------
   The table is present on this database but was made by hand: it carries no
   DEFAULT constraints and no unique index on JobId. Importing.Schema.sql cannot
   repair that, because its guard is IF NOT EXISTS (the table) — the table
   exists, so the whole block is skipped and the index at its end is the only
   thing that could still apply.

   NULLABILITY IS LEFT ALONE, deliberately. The live columns are NOT NULL where
   Importing.Schema.sql's CREATE TABLE declares them NULL. The live shape is the
   one that matches the EF entity (DBHelper/Models/Table/ImportJobResult.cs,
   whose strings are non-nullable and default to string.Empty), so tightening
   or loosening either side here would be churn, not a fix.

   Adding a DEFAULT to an existing column is metadata-only: it does not rewrite
   or re-validate a single existing row.
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_tImportJobResult_ValidCount')
   AND COL_LENGTH('dbo.tImportJobResult', 'ValidCount') IS NOT NULL
BEGIN
    ALTER TABLE dbo.tImportJobResult ADD CONSTRAINT DF_tImportJobResult_ValidCount DEFAULT (0) FOR [ValidCount];
    PRINT 'Added DF_tImportJobResult_ValidCount.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_tImportJobResult_WarningCount')
   AND COL_LENGTH('dbo.tImportJobResult', 'WarningCount') IS NOT NULL
BEGIN
    ALTER TABLE dbo.tImportJobResult ADD CONSTRAINT DF_tImportJobResult_WarningCount DEFAULT (0) FOR [WarningCount];
    PRINT 'Added DF_tImportJobResult_WarningCount.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_tImportJobResult_ErrorCount')
   AND COL_LENGTH('dbo.tImportJobResult', 'ErrorCount') IS NOT NULL
BEGIN
    ALTER TABLE dbo.tImportJobResult ADD CONSTRAINT DF_tImportJobResult_ErrorCount DEFAULT (0) FOR [ErrorCount];
    PRINT 'Added DF_tImportJobResult_ErrorCount.';
END
GO

/*  UX_tImportJobResult_JobId (Importing.Schema.sql:44-45). GetImportStatus looks
    a job up by JobId and expects one row, so the uniqueness is the contract, not
    an optimisation.

    A UNIQUE index cannot be built over duplicate values, and this table already
    holds rows. Checked first, and reported rather than thrown, so one dirty
    table does not abort a migration whose remaining work is unrelated. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UX_tImportJobResult_JobId'
                 AND object_id = OBJECT_ID('dbo.tImportJobResult'))
BEGIN
    IF EXISTS (SELECT JobId FROM dbo.tImportJobResult GROUP BY JobId HAVING COUNT(*) > 1)
        PRINT 'WARN: dbo.tImportJobResult holds duplicate JobId values; UX_tImportJobResult_JobId NOT created. Resolve the duplicates, then re-run.';
    ELSE
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UX_tImportJobResult_JobId ON dbo.tImportJobResult ([JobId] ASC);
        PRINT 'Created UX_tImportJobResult_JobId.';
    END
END
GO

/* =============================================================================
   15. dbo.tOptionProjectCategoryToPAPMap — the covering index
   -----------------------------------------------------------------------------
   Importing.CategoryToPAPMap.Schema.sql:53-54. ImportLookupCache reads the whole
   table by CategoryId on every importer run.
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tOptionProjectCategoryToPAPMap_CategoryId'
                 AND object_id = OBJECT_ID('dbo.tOptionProjectCategoryToPAPMap'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_tOptionProjectCategoryToPAPMap_CategoryId
        ON dbo.tOptionProjectCategoryToPAPMap ([CategoryId] ASC) INCLUDE ([PAPKey]);
    PRINT 'Created IX_tOptionProjectCategoryToPAPMap_CategoryId.';
END
GO


/* #############################################################################
   PART 7 of 8 — API actions and route grants
   Source: LumpSum.Permissions.sql lines 62-192 (verbatim)
   -----------------------------------------------------------------------------
   The only INSERTs in this file, and the reason they are here: this database
   still registers the WALLET-ERA action names — InitFilterLumpsum, ShowLumpsum,
   LumpsumDetails, WalletBalance — verified live 2026-09-10. Without the swap
   below, every object this migration creates exists and the module is still
   dead, because [PermissionFilter] 403s an unregistered action for everyone,
   admins included.

   §0 MUST STAY FIRST. SQL Server's default collation is case-insensitive, so
   'ShowLumpsum' and 'ShowLumpSum' collide: retiring the old rows before
   inserting the new ones is what stops three of the new names being silently
   skipped as "already present".

   REGISTRATION IS NOT A GRANT (§1 vs §2), and an API grant is not a ROUTE grant
   (§3) — the React router only registers a route whose RouteName appears in the
   user's ViewAccess. All three halves are below and all three are needed.

   This is NOT the same as running POST /api/UserManagement/SyncAPIPermissions.
   That endpoint also DELETES actions missing from the assembly and rewrites
   every group's grants as a side effect, which belongs in a deliberate
   maintenance step and not in a migration.
   ############################################################################# */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @Controller nvarchar(50) = N'LumpsumController';

/* ── 0. Retire the wallet-era action rows ─────────────────────────────────────
   Their Ids may still sit in group grants; clear those references first so no
   group is left pointing at a deleted action.
   ---------------------------------------------------------------------------- */
DECLARE @Retired TABLE (Id int PRIMARY KEY);
INSERT INTO @Retired (Id)
SELECT Id FROM dbo.tApiActions
WHERE  ControllerName = @Controller
  AND  ActionName COLLATE Latin1_General_BIN2 IN (
        N'InitFilterLumpsum', N'ShowLumpsum', N'LumpsumDetails', N'WalletBalance',
        N'ShowWalletActivity', N'CreateLumpsum', N'UpdateLumpsum',
        N'ReplenishLumpsum', N'DeleteLumpsum', N'AdvanceProgramStage',
        N'PublishItemizedProject', N'ShowWalletRevisions', N'SubmitWalletRevision',
        N'ApproveWalletRevision', N'RejectWalletRevision',
        N'ReturnWalletRevisionForReview', N'ItemizeProject', N'ShowItemizableProjects',
        N'ScheduleItemizedProjects', N'UpdateDrawAmount');

UPDATE gr
   SET gr.ActionIds = ISNULL((
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), k.Id)
            FROM (
                SELECT a.ActionId AS Id
                FROM   OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
                WHERE  a.ActionId NOT IN (SELECT Id FROM @Retired)
            ) k
            ORDER BY k.Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']'
       ), '[]')
FROM dbo.tGroupRoles gr
WHERE EXISTS (
    SELECT 1 FROM OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
    WHERE a.ActionId IN (SELECT Id FROM @Retired));

DELETE FROM dbo.tApiActions WHERE Id IN (SELECT Id FROM @Retired);

/* ── 1. Register the V2 actions ───────────────────────────────────────────── */
DECLARE @Actions TABLE (ActionName nvarchar(50) PRIMARY KEY, Description nvarchar(200));
INSERT INTO @Actions (ActionName, Description) VALUES
    /* Reads */
    (N'InitFilterLumpSum',       N'Dropdown sources for the Lump Sum list filter bar'),
    (N'ShowLumpSum',             N'Paged Lump Sum Project list'),
    (N'LumpSumDetails',          N'One Lump Sum Project with its balance and child rows'),
    (N'LumpSumBalance',          N'Live Total / Itemized / Remaining'),
    (N'ShowItemizedProjects',    N'Paged itemized projects under a Lump Sum Project'),
    (N'ShowLumpSumActivity',     N'Dated activity timeline'),
    (N'ValidateForItemization',  N'Gate check before importing itemized projects'),
    /* Writes */
    (N'CreateLumpSum',           N'Create a Lump Sum Project with its allocation'),
    (N'UpdateLumpSum',           N'Composite save of a Lump Sum Project and its child rows'),
    (N'ReplenishLumpSum',        N'Top a Lump Sum Project up to a new total'),
    (N'DeleteLumpSum',           N'Delete a Lump Sum Project (hard / soft / blocked)'),
    /* Itemization */
    (N'DeleteItemizedProject',   N'Delete an itemized project and restore its cost'),
    (N'ImportItemizedProjects',  N'Batch-create itemized projects from a workbook');

INSERT INTO dbo.tApiActions (ActionName, Description, ControllerName)
SELECT a.ActionName, a.Description, @Controller
FROM   @Actions a
WHERE  NOT EXISTS (
    SELECT 1 FROM dbo.tApiActions t
    WHERE t.ControllerName = @Controller
      AND t.ActionName COLLATE Latin1_General_BIN2 = a.ActionName COLLATE Latin1_General_BIN2);

/* ── 2. Grant every Lump Sum action to the Admin group (Id 1) ─────────────────
   ActionIds is a JSON int array; merge in anything missing and leave the rest of
   the group's grants untouched.
   ---------------------------------------------------------------------------- */
DECLARE @GroupId int = 1;

/*  THE MODULE DOES NOT LIVE ENTIRELY ON ITS OWN CONTROLLER. Itemization borrows
    two actions from ImportingController, and granting LumpsumController alone
    leaves both 403 for an Admin who can otherwise do everything:

      DownloadTemplate    the workbook the import dialog hands the user, and the
                          first call every itemization e2e spec makes
                          (e2e/tests/helpers/importWorkbook.ts)
      DownloadImportFile  the result/error workbook a finished import offers back
                          (FE/src/pages/LumpSum/Service.ts)

    Found on myps_db_dev_200 on 2026-09-13: six Lump Sum specs failed on "You do
    not have permission to perform 'DownloadTemplate' on 'ImportingController'",
    and because ls-module-ui-walkthrough is mode:'serial' it took 29 more tests
    with it. Admin held neither action on that lineage; both were granted to
    groups 2/3/4 only.

    MATCHED BY NAME, NEVER BY Id. tApiActions.Id is assigned per database and the
    two lineages have already diverged: Id 123 is DownloadTemplate on
    myps_db_dev_200 and DeleteItemizedProject on myps_db_dev. A grant script that
    merges literal Ids grants something different on each server.

    Deliberately just these two. Any other action Admin happens to lack on a
    given lineage is that lineage's business, not this migration's. */
;WITH LumpSumActions AS (
    SELECT Id FROM dbo.tApiActions WHERE ControllerName = @Controller
    UNION
    SELECT Id FROM dbo.tApiActions
    WHERE  ControllerName = N'ImportingController'
      AND  ActionName COLLATE Latin1_General_BIN2 IN (
            N'DownloadTemplate', N'DownloadImportFile')
),
Existing AS (
    SELECT a.ActionId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
    WHERE  gr.GroupId = @GroupId
),
Merged AS (
    SELECT Id FROM Existing
    UNION
    SELECT Id FROM LumpSumActions
)
UPDATE gr
   SET gr.ActionIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), Id)
            FROM Merged ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']'
       )
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;

/* ── 3. Grant the ROUTES, not just the API actions ────────────────────────────
   The React router only registers a route whose RouteName appears in the user's
   ViewAccess (FE/src/hooks/usePermittedRoutes.ts). Without this, /lumpsum/add
   fails with "No routes matched location" and renders nothing — the API grants
   above are necessary but not sufficient.
   ---------------------------------------------------------------------------- */
;WITH LumpSumViews AS (
    SELECT Id FROM dbo.tAppViews
    WHERE RouteName IN (N'LumpSumList', N'LumpSumDetails', N'AddWallet')
),
ExistingViews AS (
    SELECT v.ViewId AS Id
    FROM   dbo.tGroupRoles gr
    CROSS APPLY OPENJSON(gr.ViewIds) WITH (ViewId INT '$') v
    WHERE  gr.GroupId = @GroupId
),
MergedViews AS (
    SELECT Id FROM ExistingViews
    UNION
    SELECT Id FROM LumpSumViews
)
UPDATE gr
   SET gr.ViewIds = (
        SELECT '[' + STUFF((
            SELECT ',' + CONVERT(varchar(12), Id)
            FROM MergedViews ORDER BY Id
            FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, '') + ']'
       )
FROM dbo.tGroupRoles gr
WHERE gr.GroupId = @GroupId;

COMMIT TRANSACTION;
GO

/* #############################################################################
   PART 8 of 8 — verification
   Source: LumpSum.Baseline.sql lines 883-1016 (verbatim), then the checks that
   are specific to this migration.

   Grepping definitions proves nothing: an object that still referenced a
   dropped column would bind fine until called. EXECUTION is the test.
   ############################################################################# */

/* =============================================================================
   13. Verification
   -----------------------------------------------------------------------------
   Grepping definitions proves nothing — an object that still referenced a
   dropped table would bind fine until called. EXECUTION is the test, which is
   exactly how the wallet-era Amount bug surfaced. So run them.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
GO

PRINT '--- the three views bind ---';
SELECT COUNT(*) AS vLumpSumSet                  FROM dbo.vLumpSumSet;
SELECT COUNT(*) AS vLumpSumChildSet             FROM dbo.vLumpSumChildSet;
SELECT COUNT(*) AS vLumpSumBalance              FROM dbo.vLumpSumBalance;
GO

PRINT '--- isolation: READ_COMMITTED_SNAPSHOT (expected ON — LumpSum.Isolation.ReadCommittedSnapshot.sql) ---';
SELECT CASE WHEN is_read_committed_snapshot_on = 1 THEN 'ON'
            ELSE 'WARN: OFF — reads take shared locks and can deadlock with writers; run LumpSum.Isolation.ReadCommittedSnapshot.sql'
       END AS ReadCommittedSnapshot
FROM   sys.databases
WHERE  database_id = DB_ID();
GO

PRINT '--- the two indexes the per-project views seek on ---';
SELECT name, OBJECT_NAME(object_id) AS [table]
FROM   sys.indexes
WHERE  name IN ('IX_tProjectStages_RevisionId', 'IX_tProjects_ProjectType');
GO

PRINT '--- the three indexes the program cost rollups read through (section 6b; want 3) ---';
SELECT name, OBJECT_NAME(object_id) AS [table]
FROM   sys.indexes
WHERE  name IN ('IX_tProjectStages_ProgramFK_StageId',
                'IX_tProjectComponentCost_Revision_Live',
                'IX_tProjectComponentCostPerYear_Cost_Live');
GO

PRINT '--- no wallet-era object survives ---';
SELECT name, type_desc
FROM   sys.objects
WHERE  name IN ('tLSWallets','tLSWalletRevisions','tLSWalletFundingProfile',
                'tLSWalletComponentCost','tLSWalletComponentCostPerYear',
                'tLSWalletProjectRevisions','vLSWalletLatest','vLSWalletBalance',
                'vLSWalletProjectSet','vLSProjectSet','vLSItemizableCandidates');
GO

PRINT '--- Total = Remaining + itemized (a CHECK since 2026-09-06: both figures are stored; DRIFT means the migration or a writer missed a row) ---';
SELECT TOP 20 ProjectId, Remaining, ItemizedTotal, OriginalAllocation,
       CASE WHEN ABS(OriginalAllocation - (Remaining + ItemizedTotal)) <= 0.005
            THEN 'OK' ELSE 'DRIFT' END AS Invariant
FROM   dbo.vLumpSumSet
ORDER  BY CASE WHEN ABS(OriginalAllocation - (Remaining + ItemizedTotal)) <= 0.005 THEN 1 ELSE 0 END;
GO

PRINT '--- every live LS component has a live per-year row (its balance lives there; without one the balance CANNOT MOVE) ---';
/*  THE ROW IS THE BALANCE (2026-09-06). MoveLSBalanceAsync moves the LS
    component's per-year Amount and returns quietly when there is no live row, so
    a Replenish top-up or a deleted child's refund is DROPPED while the API still
    answers 200. SyncLSToFundingAsync cannot repair it — it derives from the same
    missing rows — and LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql skips
    exactly these parents. CreateLumpSum always writes one, so the invariant is
    that the offender count is 0; anything else is a Lump Sum Project whose money
    silently stops moving. The count line comes first so an empty offender list
    reads as "0 of N", not as "the query found nothing".

    'LS' is resolved through tOptionProjectComponentType the same way
    FindLSComponentAsync resolves it, so this cannot drift from the code.

    OUTER APPLY, not SUM(CASE WHEN NOT EXISTS ...): SQL Server refuses an
    aggregate over a subquery (Msg 130). The apply turns the existence test into
    a column the SUM can see. */
SELECT COUNT(*) AS LiveLSComponents,
       SUM(CASE WHEN py.LiveRows = 0 THEN 1 ELSE 0 END) AS WithNoLiveYearRow
FROM   dbo.tProjectComponentCost cc
OUTER  APPLY (SELECT COUNT(*) AS LiveRows
              FROM   dbo.tProjectComponentCostPerYear cy
              WHERE  cy.ComponentCostFK = cc.Id
                AND  cy.IsDeleted = 0) py
WHERE  cc.IsDeleted = 0
  AND  cc.ComponentType IN (SELECT ComponentName
                            FROM   dbo.tOptionProjectComponentType
                            WHERE  ComponentId = 'LS');

/*  The offenders themselves, so a non-zero count above is actionable rather than
    merely alarming. Empty is the healthy result. */
SELECT TOP 20
       ls.ProjectId,
       cc.Id                AS ComponentCostId,
       cc.ProjectRevisionFK AS RevisionId,
       'DRIFT: no live per-year row — this project''s balance cannot move' AS Invariant
FROM   dbo.tProjectComponentCost cc
LEFT   JOIN dbo.vLumpSumSet ls ON ls.RevisionId = cc.ProjectRevisionFK
WHERE  cc.IsDeleted = 0
  AND  cc.ComponentType IN (SELECT ComponentName
                            FROM   dbo.tOptionProjectComponentType
                            WHERE  ComponentId = 'LS')
  AND  NOT EXISTS (SELECT 1
                   FROM   dbo.tProjectComponentCostPerYear cy
                   WHERE  cy.ComponentCostFK = cc.Id
                     AND  cy.IsDeleted = 0)
ORDER  BY cc.Id;
GO

PRINT '--- fProgramStages and pRecomputeProgramCost bind (rolled back) ---';
DECLARE @pk nvarchar(200) = (SELECT TOP 1 ProgramFK FROM dbo.vLumpSumSet);
IF @pk IS NULL
    SELECT TOP 1 @pk = ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0;

IF @pk IS NOT NULL
BEGIN
    SELECT StageName, StageDisplayName, ProjectCount, Cost
    FROM   dbo.fProgramStages(@pk) ORDER BY StageId;

    BEGIN TRAN;
        EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
    ROLLBACK TRAN;
END
ELSE
    PRINT 'No program available to exercise the rollups against.';
GO

PRINT '--- fProgramProjects binds and includes Lump Sum Projects ---';
/*  Takes (@ProgramPK, @StageId) — both are required. */
DECLARE @pk2 nvarchar(200) = (SELECT TOP 1 ProgramFK FROM dbo.vLumpSumSet);
IF @pk2 IS NULL
    SELECT TOP 1 @pk2 = ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0;

DECLARE @stage2 int = (SELECT TOP 1 StageId FROM dbo.tProgramStages
                       WHERE ProgramFK = @pk2 ORDER BY StageId DESC);

IF @pk2 IS NOT NULL AND @stage2 IS NOT NULL
BEGIN
    /*  Row count only — fProgramProjects does not surface ProjectType. That an
        LS Project appears here at all is what the LEFT joins fix, and it is
        asserted properly by e2e, not by this smoke check. */
    SELECT COUNT(*) AS ProjectsInProgram FROM dbo.fProgramProjects(@pk2, @stage2);
END
ELSE
    PRINT 'No program/stage available to exercise fProgramProjects against.';
GO

PRINT '--- import-table constraints (want 3 defaults + both indexes) ---';
SELECT name AS DefaultConstraint FROM sys.default_constraints
WHERE  parent_object_id = OBJECT_ID('dbo.tImportJobResult')
ORDER  BY name;

SELECT i.name AS [Index], OBJECT_NAME(i.object_id) AS [Table]
FROM   sys.indexes i
WHERE  i.name IN ('UX_tImportJobResult_JobId', 'IX_tOptionProjectCategoryToPAPMap_CategoryId');
GO

PRINT '--- registered Lump Sum actions (want the 13 V2 names, none of the wallet-era ones) ---';
SELECT Id, ActionName FROM dbo.tApiActions
WHERE  ControllerName = N'LumpsumController' ORDER BY ActionName;

PRINT '--- any wallet-era action name left behind? (want none) ---';
SELECT ActionName FROM dbo.tApiActions
WHERE  ControllerName = N'LumpsumController'
  AND  ActionName COLLATE Latin1_General_BIN2 IN (
        N'InitFilterLumpsum', N'ShowLumpsum', N'LumpsumDetails', N'WalletBalance',
        N'ShowWalletActivity', N'CreateLumpsum', N'UpdateLumpsum', N'ReplenishLumpsum',
        N'DeleteLumpsum');

PRINT '--- any registered action NOT granted to Admin? (want none) ---';
SELECT a.ActionName
FROM   dbo.tApiActions a
WHERE  a.ControllerName = N'LumpsumController'
  AND  NOT EXISTS (
        SELECT 1 FROM dbo.tGroupRoles gr
        CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') j
        WHERE gr.GroupId = 1 AND j.ActionId = a.Id);

/*  DELIBERATELY LOOSER THAN THE GRANT. The grant above matches the two names
    byte-for-byte (BIN2), as every other action match in this file does. This
    check matches them case-insensitively, so a row whose casing has drifted
    from the code's — say 'Downloadtemplate' — is one the grant silently skipped
    AND one this check still finds and reports as ungranted. Were both to use
    BIN2, such a row would grant nothing and report nothing. */
PRINT '--- Lump Sum''s ImportingController dependencies not granted to Admin (want none) ---';
SELECT a.ControllerName + '.' + a.ActionName AS Ungranted
FROM   dbo.tApiActions a
WHERE  a.ControllerName = N'ImportingController'
  AND  a.ActionName COLLATE Latin1_General_CI_AS IN (
        N'DownloadTemplate', N'DownloadImportFile')
  AND  NOT EXISTS (
        SELECT 1 FROM dbo.tGroupRoles gr
        CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') j
        WHERE gr.GroupId = 1 AND j.ActionId = a.Id);

PRINT '--- any grant pointing at an action that no longer exists? (want none) ---';
SELECT DISTINCT j.ActionId AS DanglingActionId
FROM   dbo.tGroupRoles gr
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') j
WHERE  NOT EXISTS (SELECT 1 FROM dbo.tApiActions a WHERE a.Id = j.ActionId);
GO

/*  The report procedures must be EXACTLY as this migration found them. This
    file never touches them, so a changed length here means someone also ran
    Reports.CrystalReportSQLFixes.sql, whose checked-in copy is OLDER than the
    live definitions and would have reverted the 2026-09-09 legacy-parity fix
    and the 2026-09-10 UACS-filter fix. Measured on myps_db_dev_200 immediately
    before this migration was written. */
PRINT '--- report procedures untouched (expect sp_RBP 9285, a1_usp_AIP2 10355 on myps_db_dev_200) ---';
SELECT 'sp_RBP'      AS [Procedure], LEN(OBJECT_DEFINITION(OBJECT_ID('dbo.sp_RBP')))      AS DefinitionLength, 9285  AS ExpectedOnDev200
UNION ALL
SELECT 'a1_usp_AIP2',               LEN(OBJECT_DEFINITION(OBJECT_ID('dbo.a1_usp_AIP2'))),  10355;
GO

PRINT '';
PRINT '=============================================================================';
PRINT 'Migration.SchemaAndProgrammability.2026-09-10.sql complete.';
PRINT '';
PRINT 'STILL TO DO, separately:';
PRINT '  1. LumpSum.Isolation.ReadCommittedSnapshot.sql  (RCSI is a whole-database';
PRINT '     setting whose ALTER disconnects every other session).';
PRINT '  2. Any DATA migration you need on this database - LumpSum.Migrate.*,';
PRINT '     LumpSum.Repair.*, LumpSum.ComponentMigration.sql - none of which are';
PRINT '     in this file.';
PRINT '=============================================================================';
GO
