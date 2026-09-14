/* =============================================================================
   Proof harness for LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
   -----------------------------------------------------------------------------
   LOCAL-DEV ONLY. Never run against a shared server.

   WHY THIS EXISTS

   Branches of the migration that have no live rows to exercise them on this
   database, or had none when they were written:

     - converting a non-Lump-Sum component into the allocation (section 3),
     - folding a second, non-identical component into the survivor (section 3),
     - linking a child from an itemization note after retiring its duplicate
       components, and deriving the parent's allocation as Remaining + children
       (sections 5b and 7),
     - a differing (non-identical) pair of the SAME component type -- marked
       Skip and left as DRIFT rather than collapsed (section 3), and still
       reported in scope on a second run,
     - a funding line the LOADER carried over from the old system -- recognised
       by its DataImportId rather than by CreatedBy, and raised (section 7).

   A branch that has never run is a branch that is only believed to work. This
   harness makes it run: it opens a transaction, injects five synthetic
   projects shaped exactly like the real cases, includes the migration with
   :r TWICE (proving idempotence on the fixture shapes, not just on real data),
   checks what the views say, and rolls everything back. Nothing survives. It
   can be run any number of times.

   HOW THE TRANSACTION NESTING WORKS

   The migration opens its own BEGIN TRANSACTION and COMMITs. Inside this
   harness's outer transaction that COMMIT only decrements @@TRANCOUNT (2 -> 1);
   the harness's ROLLBACK at the end discards the lot. If the migration's own
   NOEXEC guard fires, the ROLLBACK at the end still runs because SET NOEXEC OFF
   is honoured under NOEXEC.

   THE FIXTURE

     P00899901LS  ProjectType 'NULL', one 'CW' / 'CW1' component of 123,000,000
                  with one per-year row carrying a UACS, no funding line, and a
                  Description matching a Sub-Category rule.
                  -> section 3 must CONVERT it; section 6 must set its Thrust to
                     the matched PAPKey (1138); section 7 must fund it at
                     123,000,000 + its child's 40,000,000.
     P00899902LS  ProjectType 'LS' already, a VALID Thrust already, one
                  'Lump Sum' component of 5,000,000 PLUS a stray 'CW1' of
                  700,000, funded at 5,000,000 by a line this script's own run
                  would recognise as its own (CreatedBy = the migration's @Who).
                  -> section 1 must RE-ADMIT it (R2); section 3 must FOLD the
                     700,000 in; section 6 must leave its Thrust untouched;
                     section 7 must RAISE the line to 5,700,000.
     P00899903LZ  a civil-works child of ...901LS: TWO identical 'CW1' copies of
                  40,000,000, one funding line, and an itemization note.
                  -> section 5b must retire one copy, link it, stamp it.
     P00899904LS  ProjectType 'LS' already, TWO live 'Lump Sum' components that
                  are NOT identical (5,000,000 and 3,000,000, different per-year
                  shapes), no funding line -> in scope via R4 (drift: Funded 0
                  vs Remaining 8,000,000).
                  -> section 3 must mark it Skip (a differing pair is DATA, not
                     a duplicate to collapse); nothing of its retired, nothing
                     of its funding touched; it must still show the allocation
                     invariant broken in section 8's per-row table, and it must
                     still be in scope on a SECOND run (an unresolved DRIFT
                     parent is reported every time, not silently dropped).
     P00899905LS  ProjectType 'LS' already, one 'Lump Sum' component of
                  10,000,000, ONE funding line UNDER it at 8,000,000 (stale),
                  written by a DIFFERENT CreatedBy ('cabalrla') but carrying a
                  DataImportId -> simulates a line the reference LOADER carried
                  over from the old system, as P00700002LS's really was, rather
                  than one this script itself wrote.
                  -> section 1 must RE-ADMIT it (R4: 8,000,000 <> 10,000,000);
                     section 7 must recognise the line as the migration's own
                     BY ITS DataImportId, not by CreatedBy, and RAISE it to
                     10,000,000 rather than reporting it as a person's figure.

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

IF EXISTS (SELECT 1 FROM dbo.tProjects WHERE ProjectPK IN
       (N'P00899901LS', N'P00899902LS', N'P00899903LZ', N'P00899904LS', N'P00899905LS'))
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

/*  ---- P00899904LS: already 'LS', TWO non-identical Lump Sum components, ----
    ---- no funding -> in scope via R4, must be SKIPPED (differing pair is    ----
    ---- data, not a duplicate) and still show DRIFT                          ---- */
INSERT dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, IsPublished, IsRevised, IsPublishable, PCMARevisionCount, CreatedBy, CreatedDate)
VALUES (N'P00899904LS', @ProgramFK, @ProgramId, N'LS', 0, 0, 0, 0, @Who, @Now);

INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, AlternateId, Description, OperatingUnit, Category, Thrust, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate, IsDeleted)
VALUES (N'P00899904LS', @ProgramFK, @ProgramId, N'P00899904LS', N'P00899904LS', N'HARNESS Water Supply System', N'OI10', 29, 1136, 31, 18001, 2, 1, @Who, @Now, 0);
DECLARE @Rev4 int = SCOPE_IDENTITY();

INSERT dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
VALUES (N'P00899904LS', @ProgramFK, @ProgramId, @Rev4, @StageId, @StageName, @Who, @Now);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev4, @LSName, N'LS', N'Lump Sum', 5000000, @Who, @Now, 0);
DECLARE @Cost4a int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, StartDate, EndDate, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost4a, N'LS', 5000000, 2024, '2024-01-01', '2024-12-31', @Who, @Now, 0);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev4, @LSName, N'LS', N'Lump Sum', 3000000, @Who, @Now, 0);
DECLARE @Cost4b int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, StartDate, EndDate, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost4b, N'LS', 3000000, 2024, '2024-01-01', '2024-12-31', @Who, @Now, 0);

/*  ---- P00899905LS: already 'LS', one Lump Sum component of 10,000,000, one ----
    ---- STALE funding line the LOADER wrote (DataImportId set, CreatedBy is  ----
    ---- someone else's) -> must be recognised and RAISED by DataImportId,   ----
    ---- not by CreatedBy                                                     ---- */
INSERT dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, IsPublished, IsRevised, IsPublishable, PCMARevisionCount, CreatedBy, CreatedDate)
VALUES (N'P00899905LS', @ProgramFK, @ProgramId, N'LS', 0, 0, 0, 0, @Who, @Now);

INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, AlternateId, Description, OperatingUnit, Category, Thrust, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate, IsDeleted, DataImportId)
VALUES (N'P00899905LS', @ProgramFK, @ProgramId, N'P00899905LS', N'P00899905LS', N'HARNESS Septage and Sewerage', N'OI10', 29, 1137, 31, 18001, 2, 1, N'data_migration', @Now, 0, N'P00899905LS');
DECLARE @Rev5 int = SCOPE_IDENTITY();

INSERT dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
VALUES (N'P00899905LS', @ProgramFK, @ProgramId, @Rev5, @StageId, @StageName, N'data_migration', @Now);

INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Rev5, @LSName, N'LS', N'Lump Sum', 10000000, N'data_migration', @Now, 0);
DECLARE @Cost5 int = SCOPE_IDENTITY();
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, ComponentId, Amount, Year, StartDate, EndDate, CreatedBy, CreatedDate, IsDeleted)
VALUES (@Cost5, N'LS', 10000000, 2024, '2024-01-01', '2024-12-31', N'data_migration', @Now, 0);

/*  DataImportId here is what marks this as the LOADER's line — CreatedBy is
    deliberately NOT @Who, so the fix under test (matching on DataImportId
    rather than CreatedBy) is the only thing that can recognise it. */
INSERT dbo.tProjectFundingProfile (ProjectRevisionFK, SourceOrg, AgreementCode, Amount, Percentage, IsWalletDraw, CreatedBy, CreatedDate, IsDeleted, DataImportId)
VALUES (@Rev5, N'GOP', N'DPWH-GAA-2024', 8000000, 100, 0, N'cabalrla', @Now, 0, N'P00899905LS');

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

/*  T-SQL local variables do not survive a GO -- and the second :r below is a
    whole script's worth of GO-separated batches -- so the fail count for each
    run is kept here instead of in a variable that would go out of scope. */
IF OBJECT_ID('tempdb..#HarnessTally') IS NOT NULL DROP TABLE #HarnessTally;
CREATE TABLE #HarnessTally (Phase nvarchar(20), Fails int);

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

-- 9. 901LS's Sub-Category was set by the matching rule; 902LS's, already valid, was left alone
SELECT @n = r.Thrust FROM dbo.tProjectRevisions r WHERE r.ProjectFK = N'P00899901LS' AND r.IsDeleted = 0;
IF @n = 1138 PRINT 'PASS  901LS: Thrust set to 1138 by the ''Rain Water Collector'' rule';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  901LS: Thrust is ', @n, ', expected 1138'); END

SELECT @n = r.Thrust FROM dbo.tProjectRevisions r WHERE r.ProjectFK = N'P00899902LS' AND r.IsDeleted = 0;
IF @n = 1137 PRINT 'PASS  902LS: Thrust left at its already-valid 1137';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  902LS: Thrust is ', @n, ', expected unchanged 1137'); END

-- 10. the differing-duplicate parent was SKIPPED, not collapsed: both components survive,
--     nothing was funded, and it shows in #Legacy as skipped and in vLumpSumSet as DRIFT.
SELECT @n = COUNT(*) FROM dbo.tProjectComponentCost cc JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK WHERE r.ProjectFK = N'P00899904LS' AND cc.IsDeleted = 0;
IF @n = 2 PRINT 'PASS  904LS: both non-identical components still live (nothing retired)';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  904LS: ', @n, ' live component(s), expected 2'); END

SELECT @n = COUNT(*) FROM #Legacy WHERE ProjectId = N'P00899904LS' AND Skip = 1;
IF @n = 1 PRINT 'PASS  904LS: marked Skip in #Legacy (reported, not silently resolved)';
ELSE BEGIN SET @Fail += 1; PRINT 'FAIL  904LS: not marked Skip in #Legacy'; END

/*  vLumpSumSet.OriginalAllocation reads the component's STORED Total, not live
    funding directly -- so a skipped parent whose Total happens to already sum
    to its per-year rows can look invariant-clean while genuinely having ZERO
    funding underneath (the app's own SyncLSToFundingAsync would zero it out
    the moment anyone opens and saves it). That is exactly why section 7 must
    leave a Skip=1 parent's Total alone rather than deriving it: the real check
    here is that no funding line exists and none was written for it. */
SELECT @n = COUNT(*) FROM dbo.tProjectFundingProfile f JOIN dbo.tProjectRevisions r ON r.Id = f.ProjectRevisionFK
WHERE r.ProjectFK = N'P00899904LS' AND f.IsDeleted = 0;
IF @n = 0 PRINT 'PASS  904LS: no funding line exists, and section 7 correctly wrote none for it';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  904LS: ', @n, ' funding line(s) found, expected 0'); END

-- 11. the loader-carried line (DataImportId set, CreatedBy is someone else's) was recognised
--     as the migration's own by its DataImportId and RAISED, not left as an unrecognised DRIFT.
SELECT @v1 = OriginalAllocation, @v2 = Remaining FROM dbo.vLumpSumSet WHERE ProjectId = N'P00899905LS';
SELECT @n = COUNT(*) FROM dbo.tProjectFundingProfile f JOIN dbo.tProjectRevisions r ON r.Id = f.ProjectRevisionFK
WHERE r.ProjectFK = N'P00899905LS' AND f.IsDeleted = 0;
IF @v1 = 10000000 AND @v2 = 10000000 AND @n = 1
    PRINT 'PASS  905LS: loader-carried line (by DataImportId, not CreatedBy) raised 8,000,000 -> 10,000,000';
ELSE BEGIN SET @Fail += 1; PRINT CONCAT('FAIL  905LS: allocation ', @v1, ' remaining ', @v2, ' live lines ', @n, ' (expected 10,000,000 / 10,000,000 / 1)'); END

PRINT '';
IF @Fail = 0 PRINT '*** HARNESS RESULT (first run): PASS ***';
ELSE PRINT CONCAT('*** HARNESS RESULT (first run): FAIL (', @Fail, ') ***');

INSERT #HarnessTally (Phase, Fails) VALUES (N'first run', @Fail);
GO

/* ---------------------------------------------------------------------------
   Second run: idempotence on the fixture shapes

   The real database run already proved idempotence on real data (a second run
   reports "parents in scope: 0"). It does not prove idempotence on the SKIP
   branch: an unresolved DRIFT parent (904LS) is BY DESIGN in scope again on
   every run until a human fixes it -- that is not a bug to fix here, so this
   check excludes it deliberately rather than asserting the whole of #Legacy
   is empty.
   --------------------------------------------------------------------------- */
:r Main\Resources\LumpSum\SQL\LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
SET NOEXEC OFF;
GO

DECLARE @Fail2 int = 0;
DECLARE @n2 int;

-- 12. the three RESOLVED fixture parents are gone from scope; the unresolved one is still there
SELECT @n2 = COUNT(*) FROM #Legacy WHERE ProjectId IN (N'P00899901LS', N'P00899902LS', N'P00899905LS');
IF @n2 = 0 PRINT 'PASS  second run: 901LS/902LS/905LS resolved, no longer in scope';
ELSE BEGIN SET @Fail2 += 1; PRINT CONCAT('FAIL  second run: ', @n2, ' resolved fixture parent(s) still in scope'); END

SELECT @n2 = COUNT(*) FROM #Legacy WHERE ProjectId = N'P00899904LS';
IF @n2 = 1 PRINT 'PASS  second run: 904LS (unresolved DRIFT) correctly still in scope';
ELSE BEGIN SET @Fail2 += 1; PRINT CONCAT('FAIL  second run: 904LS in scope ', @n2, ' time(s), expected 1'); END

PRINT '';
IF @Fail2 = 0 PRINT '*** HARNESS RESULT (second run): PASS ***';
ELSE PRINT CONCAT('*** HARNESS RESULT (second run): FAIL (', @Fail2, ') ***');

INSERT #HarnessTally (Phase, Fails) VALUES (N'second run', @Fail2);

DECLARE @FailTotal int = (SELECT SUM(Fails) FROM #HarnessTally);
PRINT '';
IF @FailTotal = 0 PRINT '*** HARNESS RESULT: PASS (16 of 16) ***';
ELSE PRINT CONCAT('*** HARNESS RESULT: FAIL (', @FailTotal, ' of 16) ***');
GO

/* ---------------------------------------------------------------------------
   Nothing survives
   --------------------------------------------------------------------------- */
SET NOEXEC OFF;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
/*  Into a variable first: PRINT cannot take a subquery inside CONCAT. */
DECLARE @Left int = (SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK IN
    (N'P00899901LS', N'P00899902LS', N'P00899903LZ', N'P00899904LS', N'P00899905LS'));
PRINT '';
PRINT CONCAT('Rolled back. @@TRANCOUNT = ', @@TRANCOUNT, '. Fixture rows remaining: ', @Left, ' (must be 0).');
GO
