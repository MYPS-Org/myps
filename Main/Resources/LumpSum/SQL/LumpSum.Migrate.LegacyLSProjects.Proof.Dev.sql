/* =============================================================================
   Proof harness for LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
   -----------------------------------------------------------------------------
   LOCAL-DEV ONLY. Never run against a shared server.

   WHY THIS EXISTS

   Three branches of the migration have no live rows to exercise them on this
   database, or had none when they were written:

     - converting a non-Lump-Sum component into the allocation (section 3),
     - folding a second, non-identical component into the survivor (section 3),
     - linking a child from an itemization note after retiring its duplicate
       components, and deriving the parent's allocation as Remaining + children
       (sections 5b and 7).

   A branch that has never run is a branch that is only believed to work. This
   harness makes it run: it opens a transaction, injects three synthetic
   projects shaped exactly like the real cases, includes the migration with
   :r, checks what the views say, and rolls everything back. Nothing survives.
   It can be run any number of times.

   HOW THE TRANSACTION NESTING WORKS

   The migration opens its own BEGIN TRANSACTION and COMMITs. Inside this
   harness's outer transaction that COMMIT only decrements @@TRANCOUNT (2 -> 1);
   the harness's ROLLBACK at the end discards the lot. If the migration's own
   NOEXEC guard fires, the ROLLBACK at the end still runs because SET NOEXEC OFF
   is honoured under NOEXEC.

   THE FIXTURE

     P00899901LS  ProjectType 'NULL', one 'CW' / 'CW1' component of 123,000,000
                  with one per-year row carrying a UACS, no funding line.
                  -> section 3 must CONVERT it; section 7 must fund it at
                     123,000,000 + its child's 40,000,000.
     P00899902LS  ProjectType 'LS' already, one 'Lump Sum' component of
                  5,000,000 PLUS a stray 'CW1' of 700,000, funded at 5,000,000
                  by a line this script would recognise as its own.
                  -> section 1 must RE-ADMIT it (R2); section 3 must FOLD the
                     700,000 in; section 7 must RAISE the line to 5,700,000.
     P00899903LZ  a civil-works child of ...901LS: TWO identical 'CW1' copies of
                  40,000,000, one funding line, and an itemization note.
                  -> section 5b must retire one copy, link it, stamp it.

   Under an existing 2024 program so vProgramLatest, the funding agreement and
   the Sub-Category window all resolve as they do for the real rows.

   HOW TO RUN
       sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C \
         -i Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql

   Read the PASS / FAIL lines at the end. Every one must be PASS.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() = N'myps_db' OR DB_NAME() NOT LIKE N'%dev%'
BEGIN
    RAISERROR('REFUSED: the proof harness runs on a local dev database only.', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION HarnessOuter;
GO

/* ---------------------------------------------------------------------------
   The fixture
   --------------------------------------------------------------------------- */
DECLARE @Who  nvarchar(100) = N'harness:LumpSum.Migrate.LegacyLSProjects.Proof.Dev';
DECLARE @Mig  nvarchar(100) = N'migrate:LumpSum.Migrate.LegacyLSProjects.2026-09-14';
DECLARE @Now  datetime      = GETDATE();

/*  An existing 2024 program the real parents sit under. */
DECLARE @ProgramFK nvarchar(200) = N'MP_P_CO-PS-635_07212023_081334';   -- GAA 2024 SSP group
DECLARE @ProgramId nvarchar(200) = (SELECT TOP 1 pr.ProgramId FROM dbo.tProgramRevisions pr
                                    WHERE pr.ProgramFK = @ProgramFK ORDER BY pr.Id DESC);
DECLARE @StageId int, @StageName nvarchar(50);
SELECT TOP 1 @StageId = ps.StageId, @StageName = ps.StageName
FROM dbo.tProgramStages ps JOIN dbo.tProgramRevisions pr ON pr.Id = ps.RevisionId
WHERE pr.ProgramFK = @ProgramFK ORDER BY pr.Id DESC;

IF @ProgramId IS NULL
BEGIN
    RAISERROR('REFUSED: the fixture program is not on this database.', 16, 1);
    SET NOEXEC ON;
END

DECLARE @LSName nvarchar(200) = (SELECT TOP 1 ComponentName FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'LS');
DECLARE @CWName nvarchar(200) = (SELECT TOP 1 ComponentName FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'CW');

IF EXISTS (SELECT 1 FROM dbo.tProjects WHERE ProjectPK IN (N'P00899901LS', N'P00899902LS', N'P00899903LZ'))
BEGIN
    RAISERROR('REFUSED: a fixture id already exists on this database; it is not a real project id.', 16, 1);
    SET NOEXEC ON;
END

/*  ---- P00899901LS: untyped parent, CW component, no funding ---- */
INSERT dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, IsPublished, IsRevised, IsPublishable, PCMARevisionCount, CreatedBy, CreatedDate)
VALUES (N'P00899901LS', @ProgramFK, @ProgramId, N'NULL', 0, 0, 0, 0, @Who, @Now);

INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, AlternateId, Description, OperatingUnit, Category, Thrust, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate, IsDeleted)
VALUES (N'P00899901LS', @ProgramFK, @ProgramId, N'P00899901LS', N'P00899901LS', N'HARNESS Rain Water Collectors in Public Facilities', N'OI10', 29, 0, 31, 18001, 2, 1, @Who, @Now, 0);
DECLARE @Rev1 int = SCOPE_IDENTITY();

INSERT dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
VALUES (N'P00899901LS', @ProgramFK, @ProgramId, @Rev1, @StageId, @StageName, @Who, @Now);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev1, N'CW', N'CW1', N'Civil Works', 123000000, @Who, @Now, 0);
DECLARE @Cost1 int = SCOPE_IDENTITY();

INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, UACS, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost1, N'CW1', 123000000, 2024, N'300205100099001', @Who, @Now, 0);

/*  ---- P00899902LS: already 'LS', Lump Sum 5,000,000 + stray CW1 700,000, funded at 5,000,000 by "the migration" ---- */
INSERT dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, IsPublished, IsRevised, IsPublishable, PCMARevisionCount, CreatedBy, CreatedDate)
VALUES (N'P00899902LS', @ProgramFK, @ProgramId, N'LS', 0, 0, 0, 0, @Who, @Now);

INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, AlternateId, Description, OperatingUnit, Category, Thrust, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate, IsDeleted)
VALUES (N'P00899902LS', @ProgramFK, @ProgramId, N'P00899902LS', N'P00899902LS', N'HARNESS Septage and Sewerage', N'OI10', 29, 1137, 31, 18001, 2, 1, @Who, @Now, 0);
DECLARE @Rev2 int = SCOPE_IDENTITY();

INSERT dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
VALUES (N'P00899902LS', @ProgramFK, @ProgramId, @Rev2, @StageId, @StageName, @Who, @Now);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev2, @LSName, N'LS', N'Lump Sum', 5000000, @Who, @Now, 0);
DECLARE @Cost2 int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, StartDate, EndDate, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost2, N'LS', 5000000, 2024, '2024-01-01', '2024-12-31', @Who, @Now, 0);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev2, N'CW', N'CW1', N'Civil Works', 700000, @Who, @Now, 0);
DECLARE @Cost2b int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost2b, N'CW1', 700000, 2024, @Who, @Now, 0);

INSERT dbo.tProjectFundingProfile (ProjectRevisionFK, SourceOrg, AgreementCode, Amount, Percentage, IsWalletDraw, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev2, N'GOP', N'DPWH-GAA-2024', 5000000, 100, 0, @Mig, @Now, 0);

/*  ---- P00899903LZ: child of ...901LS, two identical CW1 copies, funded, with the note ---- */
INSERT dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, IsPublished, IsRevised, IsPublishable, PCMARevisionCount, CreatedBy, CreatedDate)
VALUES (N'P00899903LZ', @ProgramFK, @ProgramId, N'NULL', 0, 0, 1, 0, @Who, @Now);

INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, AlternateId, Description, OperatingUnit, Category, Thrust, Origin, Agency, RegionWide, Tier, Region, CreatedBy, CreatedDate, IsDeleted)
VALUES (N'P00899903LZ', @ProgramFK, @ProgramId, N'P00899903LZ', N'P00899903LZ', N'HARNESS child of P00899901LS', N'OI10', 29, 1138, 31, 18001, 2, 1, N'OI03', @Who, @Now, 0);
DECLARE @Rev3 int = SCOPE_IDENTITY();

INSERT dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
VALUES (N'P00899903LZ', @ProgramFK, @ProgramId, @Rev3, @StageId, @StageName, @Who, @Now);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev3, N'CW', N'CW1', N'Civil Works', 40000000, @Who, @Now, 0);
DECLARE @Cost3a int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost3a, N'CW1', 40000000, 2024, @Who, @Now, 0);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev3, N'CW', N'CW1', N'Civil Works', 40000000, @Who, @Now, 0);
DECLARE @Cost3b int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost3b, N'CW1', 40000000, 2024, @Who, @Now, 0);

INSERT dbo.tProjectFundingProfile (ProjectRevisionFK, SourceOrg, AgreementCode, Amount, Percentage, IsWalletDraw, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev3, N'GOP', N'DPWH-GAA-2024', 40000000, 100, 0, @Who, @Now, 0);

INSERT dbo.tProjectNotes (ProjectRevisionFK, FileName, FileExtension, FilePath, Description, CreatedBy, CreatedDate)
VALUES (@Rev3, N'', N'', N'', N'Itemized from Project: P00899901LS', @Who, @Now);

PRINT '';
PRINT '=== HARNESS: fixture in place, running the migration ===';
PRINT '';
GO

/* ---------------------------------------------------------------------------
   The migration, verbatim
   --------------------------------------------------------------------------- */
:r Main\Resources\LumpSum\SQL\LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql

/* ---------------------------------------------------------------------------
   The assertions
   --------------------------------------------------------------------------- */
SET NOEXEC OFF;
GO
PRINT '';
PRINT '=== HARNESS: assertions ===';

DECLARE @Fail int = 0;
DECLARE @Msg nvarchar(400);

/*  Helper pattern: one line per assertion, PASS or FAIL with the observed value. */
DECLARE @v1 decimal(18,5), @v2 decimal(18,5), @v3 decimal(18,5), @n int, @t nvarchar(200);

-- 1. ...901LS is listed, with allocation = 123,000,000 + 40,000,000
SELECT @v1 = OriginalAllocation, @v2 = Remaining, @v3 = ItemizedTotal, @n = ItemizedCount
FROM dbo.vLumpSumSet WHERE ProjectId = N'P00899901LS';
IF @v1 = 163000000 AND @v2 = 123000000 AND @v3 = 40000000 AND @n = 1
    PRINT 'PASS  901LS: allocation 163,000,000 / remaining 123,000,000 / itemized 40,000,000 / 1 child';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  901LS: allocation ', @v1, ' remaining ', @v2, ' itemized ', @v3, ' children ', @n, ' (or not listed)'); END

-- 2. ...901LS holds exactly one live component and it is the Lump Sum one
SELECT @n = COUNT(*), @t = MIN(cc.ComponentType) FROM dbo.tProjectComponentCost cc
JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK WHERE r.ProjectFK = N'P00899901LS' AND cc.IsDeleted = 0;
IF @n = 1 AND @t = (SELECT TOP 1 ComponentName FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'LS')
    PRINT 'PASS  901LS: one live component, typed Lump Sum (converted from CW)';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  901LS: ', @n, ' live component(s), type ', ISNULL(@t, '<none>')); END

-- 3. ...902LS was re-admitted, the stray CW folded, the line raised
SELECT @v1 = OriginalAllocation, @v2 = Remaining FROM dbo.vLumpSumSet WHERE ProjectId = N'P00899902LS';
SELECT @n = COUNT(*) FROM dbo.tProjectComponentCost cc JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK WHERE r.ProjectFK = N'P00899902LS' AND cc.IsDeleted = 0;
IF @v1 = 5700000 AND @v2 = 5700000 AND @n = 1
    PRINT 'PASS  902LS: 700,000 folded in, allocation and line 5,700,000, one component';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  902LS: allocation ', @v1, ' remaining ', @v2, ' live components ', @n); END

-- 4. the child is linked and stamped
SELECT @t = CONCAT(ISNULL(p.ParentProjectId,'-'), '|', ISNULL(p.ProjectType,'-'), '|', ISNULL(p.ItemizationType,'-'), '|', ISNULL(p.ProjectStatus,'-'))
FROM dbo.tProjects p WHERE p.ProjectPK = N'P00899903LZ';
IF @t = N'P00899901LS|LS|Itemized|potential'
    PRINT 'PASS  903LZ: ParentProjectId / ProjectType / ItemizationType / ProjectStatus stamped';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  903LZ: stamps are ', @t); END

-- 5. the child's revision AlternateId and funding flag
SELECT @t = r.AlternateId FROM dbo.tProjectRevisions r WHERE r.ProjectFK = N'P00899903LZ' AND r.IsDeleted = 0;
SELECT @n = COUNT(*) FROM dbo.tProjectFundingProfile f JOIN dbo.tProjectRevisions r ON r.Id = f.ProjectRevisionFK WHERE r.ProjectFK = N'P00899903LZ' AND f.IsDeleted = 0 AND f.IsWalletDraw = 1;
IF @t = N'P00899901LS' AND @n = 1
    PRINT 'PASS  903LZ: AlternateId = parent, funding line flagged IsWalletDraw';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  903LZ: AlternateId ', ISNULL(@t,'<null>'), ', draw lines ', @n); END

-- 6. the child's duplicate component was retired
SELECT @n = COUNT(*) FROM dbo.tProjectComponentCost cc JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK WHERE r.ProjectFK = N'P00899903LZ' AND cc.IsDeleted = 0;
IF @n = 1 PRINT 'PASS  903LZ: one live component (duplicate retired)';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  903LZ: ', @n, ' live components'); END

-- 7. the child appears under its parent in the children view
SELECT @n = COUNT(*) FROM dbo.vLumpSumChildSet c WHERE c.ProjectPK = N'P00899903LZ' AND c.ParentProjectId = N'P00899901LS' AND c.DrawnFromParent = 40000000;
IF @n = 1 PRINT 'PASS  903LZ: listed by vLumpSumChildSet under 901LS, DrawnFromParent 40,000,000';
ELSE BEGIN SET @Fail += 1; PRINT 'FAIL  903LZ: not listed under 901LS with the right draw'; END

-- 8. the invariant holds on both fixture parents
SELECT @n = COUNT(*) FROM dbo.vLumpSumSet v WHERE v.ProjectId IN (N'P00899901LS', N'P00899902LS') AND ABS(v.OriginalAllocation - (v.Remaining + v.ItemizedTotal)) > 0.005;
IF @n = 0 PRINT 'PASS  invariant Total = Remaining + Itemized on both fixture parents';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  invariant broken on ', @n, ' fixture parent(s)'); END

PRINT '';
IF @Fail = 0 PRINT '*** HARNESS RESULT: PASS (8 of 8) ***';
ELSE PRINT CONCAT('*** HARNESS RESULT: FAIL (', @Fail, ' of 8) ***');
GO

/* ---------------------------------------------------------------------------
   Nothing survives
   --------------------------------------------------------------------------- */
SET NOEXEC OFF;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
/*  Into a variable first: PRINT cannot take a subquery inside CONCAT. */
DECLARE @Left int = (SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK IN (N'P00899901LS', N'P00899902LS', N'P00899903LZ'));
PRINT '';
PRINT CONCAT('Rolled back. @@TRANCOUNT = ', @@TRANCOUNT, '. Fixture rows remaining: ', @Left, ' (must be 0).');
GO
