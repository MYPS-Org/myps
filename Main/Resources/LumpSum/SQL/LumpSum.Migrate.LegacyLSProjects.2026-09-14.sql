/* =============================================================================
   Lump Sum — migrate the legacy 2024 '…LS' projects onto the V3 data model
   2026-09-14
   -----------------------------------------------------------------------------
   TARGET: localhost / myps_db_dev_200 first; SERVER-BOUND once proven.

   WHY THIS FILE EXISTS

   Migration.SchemaAndProgrammability.2026-09-10.sql gave myps_db_dev_200 the
   Lump Sum v3 SCHEMA and says so in its own header: "It contains NO DATA
   MIGRATIONS." It was right to. But this lineage carries 59 Lump Sum projects
   migrated from 2024 data — tProjects.ProjectPK ending in 'LS', under three
   GAA 2024 programs — and they are invisible to the module, because
   vLumpSumSet seeks on ProjectType = 'LS' and theirs is the literal string
   'NULL' (a restore artifact shared by 56,769 rows; only these 59 are touched).

   Flipping the type alone would surface them WRONG. Verified against the live
   database on 2026-09-14:

     - Their components store ComponentType as the CODE ('LS'), not the NAME
       ('Lump Sum'). Every Lump Sum reader joins on the NAME —
       vLumpSumSet's `opt.ComponentName = cc.ComponentType`,
       LumpsumHelper.FindLSComponentAsync, GetLSComponentAsync — so the join
       misses and HasLSComponent comes back 0. Flipping ProjectType alone would
       therefore list NONE of them. This is lineage-wide, not a Lump Sum quirk:
       245,367 'CW' rows, 100,566 'EAO' rows and 6,967 'ROW' rows are stored the
       same way, against just 5 rows database-wide holding 'Lump Sum'. Section 3
       normalises the 59 parents' own LS components and nothing else — the wider
       artifact is real but is its own decision, exactly like ProjectType.
     - 53 of the 59 carry an IDENTICAL DUPLICATE 'LS' component on their latest
       live revision (same Total, same per-year rows, same CreatedDate, same
       CreatedBy 'cabalrla'). vLumpSumSet SUMs the components, so every one of
       those would report DOUBLE its allocation.
     - Every component carries TEN per-year rows (2024-2033) of which only 2024
       is non-zero and holds the UACS. vLumpSumSet reads Remaining as the SUM of
       the live rows, and the Component Cost dialog renders every one of them.
     - NOT ONE parent has a funding line. Under the model of 2026-09-06 the
       allocation IS the sum of the funding lines, so SyncLSToFundingAsync would
       drive Total to zero on the first save.
     - 55 carry Thrust = 0, which is not a PAPKey. UpdateLumpSum's
       ValidateRequiredFieldsAsync refuses it, so Save, Replenish and Import
       would all be dead on them — the same unusability LumpSum.SampleData.Dev
       §4b/§4d exist to prevent for the MyMYPS sample.

   THE MODEL THIS BRINGS THEM ONTO (maintainer decision, 2026-09-06)

       LS component Total  = the FULL allocation = Σ the parent's live funding lines
       LS per-year Amount  = the REMAINING balance = Total − Σ children's costs

   THERE ARE NO CHILDREN. Searched five ways — tProjectRevisions.AlternateId
   equal to the parent's ProjectId, to its ProjectPK suffix, to its own
   AlternateId, to its ExternalId, and containing its numeric core; plus
   tProjects.ParentProjectId and ParentWalletId. Zero hits. (The 13 numeric-core
   matches are unrelated regular projects — P00800005VS/LZ/MN — that merely share
   a running number with P00800005LS.) So the balance equals the allocation for
   all 59, and ItemizedTotal is 0.

   WHAT THIS FILE DELIBERATELY DOES NOT DO

   1. MY-PREFIXED IDs ARE NOT MIGRATED. 'MY00003005LS' and 'MY00040003LS' belong
      to a module that is not implemented yet (instruction, 2026-09-14). They are
      inventoried in documents/MYPS_LS_MY_Prefixed_Projects.md and excluded by
      the scope predicate below. Note they are also the ONLY Lump-Sum-shaped ids
      in this database that genuinely have AlternateId-linked children (14 + 1) —
      which is precisely why they are someone else's migration.

   2. It does not touch the OLDER live revisions. Each parent has two (the P008
      group has five); 71 of them carry components of their own. Every Lump Sum
      view reads the LATEST live revision only, and rewriting history is not this
      script's job. Said here so the duplicate/ten-row shape found there later is
      recognised as left alone on purpose.

   3. It does not clean up ProjectType = 'NULL' on the other 56,710 projects.
      That is a real artifact and its own decision.

   4. It does not touch sp_RBP, a1_usp_AIP2, or READ_COMMITTED_SNAPSHOT. See the
      2026-09-10 migration's header for why "just run everything" is wrong here.

   RUN ORDER. AFTER Migration.SchemaAndProgrammability.2026-09-10.sql (the views
   and the three tProjects columns must exist) and AFTER
   LumpSum.Isolation.ReadCommittedSnapshot.sql. Independent of
   LumpSum.SampleData.Dev.sql — the sample's three parents are already on the
   model and the scope predicate skips them.

   IDEMPOTENT. Section 5 flips ProjectType to 'LS', which is what the scope
   predicate excludes, so a second run selects 0 rows and stops at section 1.

   DRY RUN. Set @DryRun = 1 in section 2 below. Everything is computed and every
   report printed, then the transaction is rolled back. Do this first.

   BACKUP FIRST. Section 3 soft-deletes component rows and section 4 soft-deletes
   per-year rows. Both are reversible by hand, neither by re-running this script.

   QUOTED_IDENTIFIER. sqlcmd defaults it OFF, and the filtered index
   IX_tProjects_ParentProjectId makes SQL Server refuse any UPDATE on tProjects
   when it is off. Set ON below for that reason.

   HOW TO RUN
       sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C \
         -i Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
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
   name (SKL-005 / ADR-118).

   SET NOEXEC ON after the RAISERROR is not decoration. The 2026-09-10
   migration's guard raises at severity 20 WITH LOG, which a NON-SYSADMIN login
   cannot do: it fails with Msg 2754, that batch aborts, and every later batch
   RUNS ANYWAY — the guard fails OPEN for exactly the login least likely to be
   trusted with it (bring-up code review, finding #3). NOEXEC does not care who
   raised what.
   ============================================================================= */
PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));
GO

IF DB_NAME() = N'myps_db'
BEGIN
    RAISERROR('REFUSED: this script will not run against myps_db, the retired production database name (SKL-005/ADR-118). Point it at a dev database.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO


/* =============================================================================
   1. The scope — built once, used by every section
   -----------------------------------------------------------------------------
   A legacy Lump Sum parent is:

     - a tProjects row whose ProjectPK ends in 'LS' (the parent's generated ID
       carries 'LS' as its island code — a constant, not a geographic one;
       FE/src/pages/LumpSum/LumpSum.md, "The model, in one paragraph"),
     - NOT already ProjectType 'LS' (so the sample's three, and a second run's
       own output, are excluded),
     - with no ParentProjectId (a parent, never a child),
     - and whose ProjectId does not start 'MY' (exclusion 1 in the header).

   The MY clause matches nothing today — no MY-prefixed id is a ProjectPK, they
   live only in AlternateId / MYId / ExternalId — but it states the exclusion
   where a future restore would need it to hold.
   ============================================================================= */
IF OBJECT_ID('tempdb..#Legacy') IS NOT NULL DROP TABLE #Legacy;

SELECT p.Id                 AS ProjectRowId,
       p.ProjectPK          AS ProjectPK,
       p.ProgramFK          AS ProgramFK,
       /*  The readable key. dbo.tPrograms does NOT carry it — it holds ProgramPK
           and StartYear only — so it is read off the project, which is where the
           Lump Sum views read it from too. */
       p.ProgramId          AS ProgramId,
       lr.Id                AS RevisionId,
       lr.ProjectId         AS ProjectId,
       lr.Category          AS Category,
       lr.Thrust            AS Thrust,
       lr.Description       AS Description,
       g.StartYear          AS StartYear,
       CAST(0 AS bit)       AS Skip
INTO   #Legacy
FROM   dbo.tProjects p
CROSS APPLY (
    SELECT TOP 1 r.*
    FROM   dbo.tProjectRevisions r
    WHERE  r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
    ORDER  BY r.Id DESC
) lr
JOIN   dbo.tPrograms g ON g.ProgramPK = p.ProgramFK
WHERE  p.ProjectPK LIKE N'%LS'
  AND  ISNULL(p.ProjectType, N'') <> N'LS'
  AND  p.ParentProjectId IS NULL
  AND  lr.ProjectId NOT LIKE N'MY%';

DECLARE @Scope int = (SELECT COUNT(*) FROM #Legacy);
PRINT CONCAT('Legacy Lump Sum parents in scope: ', @Scope);

IF @Scope = 0
BEGIN
    PRINT 'Nothing to migrate — every ...LS parent is already ProjectType ''LS''.';
    PRINT 'This is the expected result of a second run.';
    SET NOEXEC ON;
END
GO

PRINT '--- scope by program ---';
SELECT   l.ProgramId, MAX(pl.[Name]) AS ProgramName, MAX(l.StartYear) AS StartYear,
         MAX(pl.StageName) AS StageName, MAX(pl.Status) AS Status, COUNT(*) AS Parents
FROM     #Legacy l
LEFT JOIN dbo.vProgramLatest pl ON pl.ProgramPK = l.ProgramFK
GROUP BY l.ProgramId
ORDER BY Parents DESC;
GO


/* =============================================================================
   2. Lookups this migration cannot proceed without
   -----------------------------------------------------------------------------
   Checked in their OWN batch, before the transaction opens, and enforced with
   SET NOEXEC ON rather than RAISERROR alone.

   That is not belt-and-braces. XACT_ABORT does not cover RAISERROR: a severity
   16 RAISERROR inside the transaction prints, and then the very next statement
   runs anyway — so a "guard" written that way would announce the missing
   agreement and then insert 59 funding lines naming it. Same fail-open shape as
   the myps_db guard in section 0.
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'LS')
BEGIN
    RAISERROR('REFUSED: no ''LS'' row in dbo.tOptionProjectComponentType. Run Migration.SchemaAndProgrammability.2026-09-10.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.tOptionFundingAgreement
                WHERE Code = N'DPWH-GAA-2024' AND SourceOrg = N'GOP' AND IsActive = 1)
BEGIN
    RAISERROR('REFUSED: funding agreement ''DPWH-GAA-2024'' under ''GOP'' is not an active row in dbo.tOptionFundingAgreement. Section 7 needs it. Pick the agreement this lineage uses before running.', 16, 1);
    SET NOEXEC ON;
END
GO


/* =============================================================================
   2b. The work, in one transaction
   -----------------------------------------------------------------------------
   Sections 3 to 7 write. They are one transaction so a failure in the funding
   line cannot leave a half-consolidated component behind. XACT_ABORT is already
   ON, so any run-time error rolls the lot back.

   SET @DryRun = 1 to compute and report everything, then roll back. Do that
   first, read the section 6 pick table, and only then run for real.
   ============================================================================= */
DECLARE @DryRun bit = 0;          -- <<< 1 = report and roll back

DECLARE @Who   nvarchar(100) = N'migrate:LumpSum.Migrate.LegacyLSProjects.2026-09-14';
DECLARE @Now   datetime      = GETDATE();
DECLARE @Rows  int;

/*  The component type. tProjectComponentCost stores the component's NAME
    ("Lump Sum"), not its code, and that is what vLumpSumSet and
    LumpsumHelper.FindLSComponentAsync both match on. Resolve it rather than
    hard-coding: the names are editable, the codes are not. */
DECLARE @LSName nvarchar(200) =
    (SELECT TOP 1 ComponentName FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'LS');

BEGIN TRANSACTION;

PRINT '';
PRINT CONCAT('=== ', CASE WHEN @DryRun = 1 THEN 'DRY RUN — everything below is rolled back' ELSE 'LIVE RUN' END, ' ===');
PRINT '';


/* -----------------------------------------------------------------------------
   3. One live 'LS' component per parent
   -----------------------------------------------------------------------------
   53 of the 59 carry an identical duplicate. vLumpSumSet SUMs the components
   into LSCost, so leaving both doubles OriginalAllocation on every one of them.

   The survivor is the LOWEST Id — arbitrary but stable, and it is the one
   FindLSComponentAsync would return (OrderBy(x => x.Id).FirstOrDefault), so the
   script and the application agree about which row is the allocation.

   IDENTICAL, OR HANDS OFF. A duplicate that is a true copy is a copy; one that
   differs is DATA, and deleting it would destroy a figure nobody has looked at.
   Compared on Total, live per-year row count, live per-year Σ Amount and live
   UACS-bearing row count. A revision whose duplicates differ is marked Skip and
   sits out sections 4 and 7 — it is reported here and will show as DRIFT in the
   verification, which is the correct outcome: visible, not silently averaged.

   Soft delete only. IsDeleted = 1 on the component and on its per-year rows,
   stamped with @Who, reversible with one UPDATE.
   -------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Comp') IS NOT NULL DROP TABLE #Comp;

SELECT l.ProjectId,
       l.RevisionId,
       cc.Id                                                          AS CostId,
       cc.Total                                                       AS Total,
       PerYear   = (SELECT COUNT(*)            FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       PerYearSum= (SELECT ISNULL(SUM(cy.Amount), 0) FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       UacsRows  = (SELECT COUNT(*)            FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0 AND cy.UACS IS NOT NULL),
       rn        = ROW_NUMBER() OVER (PARTITION BY l.RevisionId ORDER BY cc.Id)
INTO   #Comp
FROM   #Legacy l
JOIN   dbo.tProjectComponentCost cc
  ON   cc.ProjectRevisionFK = l.RevisionId
 AND   cc.IsDeleted = 0
 /*  BY NAME **OR** BY CODE. The module writes the canonical NAME and every
     reader joins on it, but this lineage's legacy rows hold the CODE (see the
     header). Matching only the name finds nothing here; matching only the code
     would miss a parent someone has since re-saved through the form. Section 3
     normalises whichever it finds to the name, so after this runs there is one
     spelling and the readers agree with the data. */
 AND  (cc.ComponentType = @LSName OR cc.ComponentType = N'LS');

/*  Counted into variables first: PRINT takes only scalar expressions, so a
    subquery inside its CONCAT fails the whole batch at PARSE time — before a
    single statement of this transaction runs. */
DECLARE @CompRows int    = (SELECT COUNT(*) FROM #Comp);
DECLARE @CompParents int = (SELECT COUNT(DISTINCT RevisionId) FROM #Comp);
PRINT CONCAT('Live ''LS'' components found: ', @CompRows, ' across ', @CompParents, ' parent(s).');

/*  A parent with NO live LS component cannot be a Lump Sum Project — vLumpSumSet
    requires HasLSComponent = 1. Skip it and say so rather than flipping a type
    that makes it invisible anyway. */
UPDATE l SET Skip = 1
FROM   #Legacy l
WHERE  NOT EXISTS (SELECT 1 FROM #Comp c WHERE c.RevisionId = l.RevisionId);

IF @@ROWCOUNT > 0
BEGIN
    PRINT 'WARNING: these parents hold no live ''LS'' component and are SKIPPED —';
    PRINT '         vLumpSumSet would not list them whatever their ProjectType.';
    SELECT ProjectId, Description FROM #Legacy WHERE Skip = 1 ORDER BY ProjectId;
END

/*  Duplicates that are not true copies. */
IF OBJECT_ID('tempdb..#CompDiff') IS NOT NULL DROP TABLE #CompDiff;

SELECT DISTINCT keep.RevisionId, keep.ProjectId
INTO   #CompDiff
FROM   #Comp keep
JOIN   #Comp dup
  ON   dup.RevisionId = keep.RevisionId AND dup.rn > 1
WHERE  keep.rn = 1
  AND (keep.Total      <> dup.Total
    OR keep.PerYear    <> dup.PerYear
    OR keep.PerYearSum <> dup.PerYearSum
    OR keep.UacsRows   <> dup.UacsRows);

IF EXISTS (SELECT 1 FROM #CompDiff)
BEGIN
    PRINT 'WARNING: these parents carry SEVERAL live ''LS'' components that are NOT';
    PRINT '         identical. Nothing was deleted and nothing was derived for them;';
    PRINT '         section 8 will report them as DRIFT. Resolve by hand.';
    SELECT c.ProjectId, c.CostId, c.Total, c.PerYear, c.PerYearSum, c.UacsRows
    FROM   #Comp c JOIN #CompDiff d ON d.RevisionId = c.RevisionId
    ORDER  BY c.ProjectId, c.CostId;

    UPDATE l SET Skip = 1
    FROM   #Legacy l JOIN #CompDiff d ON d.RevisionId = l.RevisionId;
END

/*  Retire the surplus copies: their per-year rows first, then the components. */
UPDATE cy
   SET cy.IsDeleted = 1, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Comp c ON c.CostId = cy.ComponentCostFK
  LEFT JOIN #CompDiff d ON d.RevisionId = c.RevisionId
 WHERE c.rn > 1 AND d.RevisionId IS NULL AND cy.IsDeleted = 0;
SET @Rows = @@ROWCOUNT;

UPDATE cc
   SET cc.IsDeleted = 1, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc
  JOIN #Comp c ON c.CostId = cc.Id
  LEFT JOIN #CompDiff d ON d.RevisionId = c.RevisionId
 WHERE c.rn > 1 AND d.RevisionId IS NULL AND cc.IsDeleted = 0;

PRINT CONCAT('Retired ', @@ROWCOUNT, ' duplicate ''LS'' component(s) and ', @Rows, ' of their per-year row(s).');

/*  The survivor, per parent — every later section works from this. */
IF OBJECT_ID('tempdb..#Keep') IS NOT NULL DROP TABLE #Keep;

SELECT c.ProjectId, c.RevisionId, c.CostId, c.Total
INTO   #Keep
FROM   #Comp c
JOIN   #Legacy l ON l.RevisionId = c.RevisionId AND l.Skip = 0
WHERE  c.rn = 1;

/*  ComponentType: the CODE -> the canonical NAME.

    This is the change that actually makes these projects visible. vLumpSumSet's
    membership test is

        LEFT JOIN tOptionProjectComponentType opt ON opt.ComponentName = cc.ComponentType
        ... MAX(CASE WHEN opt.ComponentId = 'LS' THEN 1 ELSE 0 END) AS HasLSComponent

    so a row holding 'LS' where the view expects 'Lump Sum' joins to nothing and
    the parent is excluded no matter what its ProjectType says. Same for
    FindLSComponentAsync, which is how every writer locates the allocation row.

    Written against its post-condition, so a re-run and an already-correct row
    both match nothing. */
UPDATE cc SET cc.ComponentType = @LSName, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc JOIN #Keep k ON k.CostId = cc.Id
 WHERE cc.ComponentType <> @LSName;
PRINT CONCAT('ComponentType normalised to the canonical name on ', @@ROWCOUNT, ' component row(s).');

/*  ComponentId 'LS1' -> 'LS', the same normalisation LumpSum.ComponentMigration
    §1 applies. Expected to match nothing on this lineage (these rows already
    carry 'LS'); kept because the server copy is a different lineage and a
    Civil-Works-style running number here would make ComponentId a field the
    Approved-program guard compares against a value the form never sent
    (FirstChangedComponentAsync, 2026-09-10 finding 3). Denormalised onto the
    per-year rows too, so the two cannot disagree. */
UPDATE cc SET cc.ComponentId = N'LS', cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc JOIN #Keep k ON k.CostId = cc.Id
 WHERE ISNULL(cc.ComponentId, N'') <> N'LS';
PRINT CONCAT('ComponentId normalised to ''LS'' on ', @@ROWCOUNT, ' component row(s).');

UPDATE cy SET cy.ComponentId = N'LS', cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy JOIN #Keep k ON k.CostId = cy.ComponentCostFK
 WHERE cy.IsDeleted = 0 AND ISNULL(cy.ComponentId, N'') <> N'LS';
PRINT CONCAT('                              and on ', @@ROWCOUNT, ' per-year row(s).');


/* -----------------------------------------------------------------------------
   4. One live per-year row per component  (decision D1, 2026-09-14)
   -----------------------------------------------------------------------------
   Every component carries ten rows, 2024 to 2033. Only 2024 is non-zero and only
   2024 holds the UACS. The module creates exactly ONE row (CreateLumpSum, at the
   program's StartYear, carrying the whole allocation) and the Component Cost
   dialog renders Year and Amount read-only with no "Add Year" — so nine empty
   years are nine read-only ₱0.00 rows a user cannot remove.

   Both prior model migrations refuse a component that does not have exactly one
   live row (LumpSum.Migrate.BalanceToPerYear.2026-09-06 §scope;
   LumpSum.SampleData.Dev §4e) because splitting a balance across years is a data
   question. Here it is not a question: nine of the ten are empty.

   RETIRED ONLY IF EMPTY AND SILENT: Amount = 0 AND no UACS AND not the program's
   StartYear. A row carrying either a figure or a code is data and survives — and
   then the parent has more than one live row, is reported below, and sits out the
   derivation in section 7 rather than having its balance rewritten.

   "NO UACS" MEANS NULL **OR** BLANK. These rows carry '' where the module would
   store NULL, and `UACS IS NULL` alone matches none of them — the first dry run
   retired 0 rows for exactly this reason and reported all 59 parents as having
   ten live rows. Blank is also a hazard in its own right: vLumpSumSet picks the
   project's UACS with `WHERE cy.UACS IS NOT NULL ORDER BY cy.Year, cy.Id`, so a
   blank row sorting first would be surfaced as the project's code. The surviving
   rows are normalised to NULL below, which is the invariant the application
   maintains (NormalizeUacs never lets '' reach a row).

   Dates: CreateLumpSum writes 1 Jan – 31 Dec of the row's year, and the Component
   Cost dialog REFUSES TO SAVE without both — so a migrated parent with null dates
   cannot have its own component edited at all. Filled where null, from the row's
   own Year, which is the same derivation yearBounds() and CreateLumpSum use.
   -------------------------------------------------------------------------- */
UPDATE cy
   SET cy.IsDeleted = 1, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Keep k   ON k.CostId = cy.ComponentCostFK
  JOIN #Legacy l ON l.RevisionId = k.RevisionId
 WHERE cy.IsDeleted = 0
   AND cy.Amount = 0
   AND NULLIF(LTRIM(RTRIM(cy.UACS)), N'') IS NULL
   AND cy.Year <> l.StartYear;

PRINT CONCAT('Retired ', @@ROWCOUNT, ' empty per-year row(s).');

/*  Blank UACS -> NULL on what survives. The views filter IS NOT NULL only, so a
    blank row is "has a code" to them; the application's own writer never stores
    one. */
UPDATE cy
   SET cy.UACS = NULL, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Keep k ON k.CostId = cy.ComponentCostFK
 WHERE cy.IsDeleted = 0
   AND cy.UACS IS NOT NULL
   AND LTRIM(RTRIM(cy.UACS)) = N'';

PRINT CONCAT('Blank UACS cleared to NULL on ', @@ROWCOUNT, ' per-year row(s).');

UPDATE cy
   SET cy.StartDate = DATEFROMPARTS(cy.Year, 1, 1),
       cy.EndDate   = DATEFROMPARTS(cy.Year, 12, 31),
       cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Keep k ON k.CostId = cy.ComponentCostFK
 WHERE cy.IsDeleted = 0
   AND (cy.StartDate IS NULL OR cy.EndDate IS NULL);

PRINT CONCAT('Filled Start/End dates on ', @@ROWCOUNT, ' per-year row(s).');

/*  Parents that still do not have exactly one live row — reported and skipped by
    section 7's derivation, for the reason above. */
IF OBJECT_ID('tempdb..#RowCount') IS NOT NULL DROP TABLE #RowCount;

SELECT k.ProjectId, k.RevisionId, k.CostId,
       LiveRows  = (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = k.CostId AND cy.IsDeleted = 0),
       OnlyRowId = (SELECT MIN(cy.Id) FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = k.CostId AND cy.IsDeleted = 0)
INTO   #RowCount
FROM   #Keep k;

IF EXISTS (SELECT 1 FROM #RowCount WHERE LiveRows <> 1)
BEGIN
    PRINT 'WARNING: these parents do not have exactly one live per-year row, so their';
    PRINT '         balance is left alone. Section 8 will report them as DRIFT.';
    SELECT ProjectId, LiveRows FROM #RowCount WHERE LiveRows <> 1 ORDER BY ProjectId;
END


/* -----------------------------------------------------------------------------
   5. Identity
   -----------------------------------------------------------------------------
   ProjectType = 'LS' is the SEEK key vLumpSumSet uses to find parents
   (IX_tProjects_ProjectType); membership is still "holds an LS component".
   This is also the flip that makes the script idempotent — section 1's predicate
   excludes exactly what this writes.

   IsPublishable = 0: a Lump Sum Project is never published to PCMA, which is
   concerned with civil-works components (Operations Guide D.3, and the comment
   on CreateLumpSum's own write). Already 0 on all 59; stated so the server copy
   cannot inherit a 1.

   ParentProjectId, ItemizationType and ProjectStatus stay NULL — they are the
   CHILD's columns, and vLumpSumChildSet's membership is ParentProjectId IS NOT
   NULL. Writing them here would move all 59 into the children view.

   AlternateId is left exactly as found. On a PARENT it is free text
   (CreateLumpSum writes dto.AlternateId straight through); the "AlternateId is
   the parent's Project ID" rule of 2026-09-05 is the CHILD's, and there are no
   children. The P008 four carry their pre-renumber ID there, which is a fact
   about them worth keeping.
   -------------------------------------------------------------------------- */
UPDATE p
   SET p.ProjectType   = N'LS',
       p.IsPublishable = 0
  FROM dbo.tProjects p
  JOIN #Legacy l ON l.ProjectPK = p.ProjectPK
 WHERE l.Skip = 0;

PRINT CONCAT('ProjectType set to ''LS'' on ', @@ROWCOUNT, ' project(s).');


/* -----------------------------------------------------------------------------
   6. Sub-Category (Thrust)  (decision D3, 2026-09-14)
   -----------------------------------------------------------------------------
   55 of the 59 carry Thrust = 0. That is not a PAPKey — it is the same "a row Id
   where a PAPKey belongs" shape LumpSum.SampleData.Dev §4d found on the MyMYPS
   parents — and ValidateRequiredFieldsAsync refuses it, so Save, Replenish and
   Import are all dead on those projects until it is resolved. The four P008
   parents already carry valid keys (1024/1026/1027/1124) and are not touched.

   HOW THE REPLACEMENT IS CHOSEN. The candidate set is exactly what the
   validators and the FE dropdown allow: PAPKeys mapped to the project's Category
   by tOptionProjectCategoryToPAPMap, valid in the PROGRAM's StartYear per
   tOptionProjectThrustList's window. Within that set, the rules below match the
   project's own Description against the thrust it names.

   Unlike the sample script, these parents have NO children and NO work items, so
   there is no scope of work to read the family off. The Description is the only
   evidence, and it is unusually good evidence here: these are GAA line items and
   their text is near-verbatim the thrust's own wording ("Rainwater Collector
   System - Region I" against "…Rain Water Collectors in Public Facilities";
   "Construction/Rehabilitation/Improvement of Facilities for Persons with
   Disabilities (PWD) and Elderlies/Senior Citizens…" against the identically
   worded 1141).

   EVERY RULE IS VALIDATED BEFORE IT IS USED. A rule naming a PAPKey that is not
   allowed for that Category in that year is discarded and reported, never
   applied — so a rule that is right here and wrong on the server copy fails
   loudly instead of writing a plausible value.

   NO MATCH FALLS BACK TO THE LOWEST ALLOWED PAPKey and is reported as
   'fallback'. That is a placeholder, not an answer: it keeps the project
   saveable, and the report is the list of rows for someone to correct. The
   alternative — leaving 0 — makes the project unusable, which is worse and
   invisible. Every pick, rule-matched or fallback, is printed below.
   -------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Allowed') IS NOT NULL DROP TABLE #Allowed;

SELECT DISTINCT l.RevisionId, t.PAPKey, t.ThrustDescription
INTO   #Allowed
FROM   #Legacy l
JOIN   dbo.tOptionProjectCategoryToPAPMap m ON m.CategoryId = l.Category
JOIN   dbo.tOptionProjectThrustList t       ON t.PAPKey = m.PAPKey
WHERE  l.Skip = 0
  AND (t.ValidToDate = 0
       OR (t.ValidFromDate < l.StartYear AND t.ValidToDate > l.StartYear));

/*  The rules. Priority ascending; the first matching rule wins. Category-scoped
    so a word that means one thing under Buildings cannot pick a Roads thrust. */
IF OBJECT_ID('tempdb..#Rule') IS NOT NULL DROP TABLE #Rule;
CREATE TABLE #Rule (Priority int, Category int, Pattern nvarchar(200), PAPKey int, Why nvarchar(200));

INSERT #Rule (Priority, Category, Pattern, PAPKey, Why) VALUES
  -- Category 29 — Convergence / special support. 43 allowed keys.
  (10, 29, N'%Rainwater Collector%',        1138, N'"Rain Water Collectors in Public Facilities"'),
  (11, 29, N'%Rain Water Collector%',       1138, N'same thrust, spaced spelling'),
  (20, 29, N'%Septage and Sewerage%',       1137, N'"...- Septage and Sewerage"'),
  (30, 29, N'%Persons with Disabilities%',  1141, N'1141 is worded identically to these rows'),
  (31, 29, N'%(PWD)%',                      1141, N'same thrust, abbreviation only'),
  (40, 29, N'%Water Supply%',               1136, N'"...- Water Supply System"'),
  (50, 29, N'%Evacuation Center%',          1156, N'BIP - Evacuation Centers / Quarantine / Public Health'),
  -- Category 30 — Buildings and other structures. 3 allowed keys.
  (10, 30, N'%Expressway%',                 1078, N'National Roads - PPP Strategic Support Fund'),
  (11, 30, N'%Connector Road%',             1078, N'same: these are the PPP expressway line items'),
  (12, 30, N'%Public-Private%',             1078, N'names the fund directly'),
  (30, 30, N'%Building%',                   1031, N'Buildings and Other Structures - Multipurpose / Facilities'),
  (40, 30, N'%Facilit%',                    1031, N'same: a facility under the National Building Program'),
  (50, 30, N'%Evacuation Center%',          1031, N'same; Category 30 has no evacuation-specific key');

/*  Discard — loudly — any rule whose target is not allowed for that Category in
    that year on THIS database. */
IF OBJECT_ID('tempdb..#BadRule') IS NOT NULL DROP TABLE #BadRule;

SELECT DISTINCT r.Priority, r.Category, r.Pattern, r.PAPKey
INTO   #BadRule
FROM   #Rule r
JOIN   #Legacy l ON l.Category = r.Category AND l.Skip = 0
WHERE  NOT EXISTS (SELECT 1 FROM #Allowed a WHERE a.RevisionId = l.RevisionId AND a.PAPKey = r.PAPKey);

IF EXISTS (SELECT 1 FROM #BadRule)
BEGIN
    PRINT 'WARNING: these Sub-Category rules name a PAPKey that is not allowed for that';
    PRINT '         Category in the program''s year on this database. They are DISCARDED.';
    SELECT * FROM #BadRule ORDER BY Category, Priority;
END

/*  The pick: best matching valid rule, else the lowest allowed key. */
IF OBJECT_ID('tempdb..#Pick') IS NOT NULL DROP TABLE #Pick;

SELECT l.RevisionId,
       l.ProjectId,
       l.Category,
       l.Description,
       OldThrust = l.Thrust,
       NewThrust = ISNULL(hit.PAPKey, low.PAPKey),
       MatchedBy = CASE WHEN hit.PAPKey IS NOT NULL THEN N'rule: ' + hit.Pattern ELSE N'fallback: lowest allowed' END,
       Why       = ISNULL(hit.Why, N'no rule matched this description')
INTO   #Pick
FROM   #Legacy l
OUTER APPLY (
    SELECT TOP 1 r.PAPKey, r.Pattern, r.Why
    FROM   #Rule r
    JOIN   #Allowed a ON a.RevisionId = l.RevisionId AND a.PAPKey = r.PAPKey
    WHERE  r.Category = l.Category
      AND  l.Description LIKE r.Pattern
    ORDER  BY r.Priority
) hit
OUTER APPLY (
    SELECT TOP 1 a.PAPKey FROM #Allowed a WHERE a.RevisionId = l.RevisionId ORDER BY a.PAPKey
) low
WHERE  l.Skip = 0
  /*  Only rows whose CURRENT Sub-Category is not already allowed and in window —
      so a re-run changes nothing, and a value corrected by hand is left alone. */
  AND  NOT EXISTS (SELECT 1 FROM #Allowed a WHERE a.RevisionId = l.RevisionId AND a.PAPKey = l.Thrust);

PRINT '';
PRINT '--- Sub-Category picks (READ THIS: every fallback is a placeholder to correct by hand) ---';
SELECT   p.ProjectId, p.Category, p.OldThrust, p.NewThrust,
         ThrustDescription = (SELECT TOP 1 a.ThrustDescription FROM #Allowed a
                               WHERE a.RevisionId = p.RevisionId AND a.PAPKey = p.NewThrust),
         p.MatchedBy,
         Descr = LEFT(p.Description, 80)
FROM     #Pick p
ORDER BY p.Category, p.MatchedBy DESC, p.ProjectId;

PRINT '';
SELECT   MatchedBy, COUNT(*) AS Rows_ FROM #Pick GROUP BY MatchedBy ORDER BY Rows_ DESC;

UPDATE r
   SET r.Thrust = p.NewThrust, r.UpdatedBy = @Who, r.UpdatedDate = @Now
  FROM dbo.tProjectRevisions r
  JOIN #Pick p ON p.RevisionId = r.Id
 WHERE p.NewThrust IS NOT NULL;

PRINT CONCAT('Sub-Category set on ', @@ROWCOUNT, ' revision(s).');

IF EXISTS (SELECT 1 FROM #Pick WHERE NewThrust IS NULL)
BEGIN
    PRINT 'WARNING: these parents have NO allowed Sub-Category at all for their Category';
    PRINT '         and year — tOptionProjectCategoryToPAPMap has nothing to offer.';
    SELECT ProjectId, Category, Description FROM #Pick WHERE NewThrust IS NULL ORDER BY ProjectId;
END


/* -----------------------------------------------------------------------------
   7. The allocation: a funding line, then derive
   -----------------------------------------------------------------------------
   Not one of the 59 has a funding line, and since 2026-09-06 the allocation IS
   the sum of the live funding lines: SyncLSToFundingAsync sets
   Total := Σ funding on EVERY save. So a parent left without one does not merely
   look odd in the funding table — the first time anybody presses Save, its
   allocation is rewritten to zero. The line is not cosmetic; it is where the
   number lives.

   ONE LINE, at 100%, for the component's current Total — which is what
   CreateLumpSum writes for a new project, and what the project form's
   "funding must total 100%" rule requires.

   IsWalletDraw = FALSE. That flag marks a CHILD's draw against its parent;
   flagging a Lump Sum Project's own funding would make it a claimant against
   itself (CreateLumpSum's own comment).

   Source GOP / agreement DPWH-GAA-2024: these are GAA 2024 programs, and this is
   the 2024 analogue of the DPWH-GAA-2025 line the sample fixture carries.
   Resolved from the lookup and REFUSED if absent, rather than written blind —
   the project form validates the pair against tOptionFundingAgreement.

   SIX PARENTS HAVE Total = 0 (decision D2): they get a ₱0 line and list with
   OriginalAllocation 0 / Remaining 0. That is truthful — they are unfunded line
   items — and Replenish is how they would be funded later.

   THEN THE TWO DERIVATIONS, computed exactly as vLumpSumSet computes them or
   the view will disagree and section 8 reports DRIFT:
       Total  := Σ live funding lines
       Amount := Total − Σ children's costs, and there are no children, so Total.
   Only parents with exactly one live per-year row are derived (section 4).
   -------------------------------------------------------------------------- */
DECLARE @Source    nvarchar(100) = N'GOP';
DECLARE @Agreement nvarchar(100) = N'DPWH-GAA-2024';   -- proven present by section 2

INSERT dbo.tProjectFundingProfile
       (ProjectRevisionFK, SourceOrg, AgreementCode, Amount, Percentage, IsWalletDraw,
        CreatedBy, CreatedDate, IsDeleted)
SELECT k.RevisionId, @Source, @Agreement, k.Total, 100.0, 0,
       @Who, @Now, 0
FROM   #Keep k
WHERE  NOT EXISTS (SELECT 1 FROM dbo.tProjectFundingProfile f
                    WHERE f.ProjectRevisionFK = k.RevisionId AND f.IsDeleted = 0);

PRINT CONCAT('Added ', @@ROWCOUNT, ' funding line(s).');

/*  Total := Σ live funding. */
UPDATE cc
   SET cc.Total = f.Funded, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc
  JOIN #Keep k ON k.CostId = cc.Id
  CROSS APPLY (SELECT ISNULL(SUM(x.Amount), 0) AS Funded
               FROM   dbo.tProjectFundingProfile x
               WHERE  x.ProjectRevisionFK = k.RevisionId AND x.IsDeleted = 0) f
 WHERE cc.Total <> f.Funded;

PRINT CONCAT('Allocation derived from the funding lines on ', @@ROWCOUNT, ' component(s).');

/*  Amount := Total − Σ children. Children are counted the way vLumpSumSet counts
    them — each child's LATEST live revision only — so that a child appearing on
    the server copy is handled correctly rather than assumed away. */
UPDATE cy
   SET cy.Amount = d.Balance, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #RowCount rc ON rc.OnlyRowId = cy.Id AND rc.LiveRows = 1
  JOIN #Keep k      ON k.CostId = rc.CostId
  JOIN dbo.tProjectComponentCost cc ON cc.Id = k.CostId
  CROSS APPLY (
      SELECT cc.Total - ISNULL((
          SELECT SUM(kc.TotalCost)
          FROM   dbo.tProjects child
          CROSS APPLY (SELECT TOP 1 kr.Id FROM dbo.tProjectRevisions kr
                        WHERE kr.ProjectFK = child.ProjectPK AND kr.IsDeleted = 0
                        ORDER BY kr.Id DESC) kr
          CROSS APPLY (SELECT ISNULL(SUM(kcc.Total), 0) AS TotalCost
                       FROM   dbo.tProjectComponentCost kcc
                       WHERE  kcc.ProjectRevisionFK = kr.Id AND kcc.IsDeleted = 0) kc
          WHERE  child.ParentProjectId = k.ProjectId), 0) AS Balance
  ) d
 WHERE cy.IsDeleted = 0 AND cy.Amount <> d.Balance;

PRINT CONCAT('Remaining balance set on ', @@ROWCOUNT, ' per-year row(s).');

IF @DryRun = 1
BEGIN
    ROLLBACK TRANSACTION;
    PRINT '';
    PRINT '*** DRY RUN — rolled back. Nothing above was kept. ***';
END
ELSE
BEGIN
    COMMIT TRANSACTION;
    PRINT '';
    PRINT 'Committed.';
END
GO


/* =============================================================================
   8. Verification
   -----------------------------------------------------------------------------
   Read the VIEWS, not the tables. A migration that lands but does not surface
   through vLumpSumSet is of no use, and grepping the rows proves nothing about
   what the module will show.

   NOTE these blocks run AFTER the transaction, so on a dry run they describe the
   database as it still is — unchanged. That is deliberate: the dry run is for
   reading section 6's pick table, not for predicting these numbers.
   ============================================================================= */
PRINT '';
PRINT '--- referential integrity (every count must be 0) ---';

SELECT
    (SELECT COUNT(*) FROM dbo.tProjectRevisions r
      WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjects p WHERE p.ProjectPK = r.ProjectFK))
                                                        AS OrphanRevisions,
    (SELECT COUNT(*) FROM dbo.tProjectComponentCost cc
      WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions r WHERE r.Id = cc.ProjectRevisionFK))
                                                        AS OrphanComponentCosts,
    (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear cy
      WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjectComponentCost cc WHERE cc.Id = cy.ComponentCostFK))
                                                        AS OrphanCostPerYear,
    (SELECT COUNT(*) FROM dbo.tProjectFundingProfile fp
      WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions r WHERE r.Id = fp.ProjectRevisionFK))
                                                        AS OrphanFundingProfiles,
    (SELECT COUNT(*) FROM dbo.vLumpSumChildSet c
      WHERE NOT EXISTS (SELECT 1 FROM dbo.vLumpSumSet s WHERE s.ProjectId = c.ParentProjectId))
                                                        AS ChildrenWithNoParent;
GO

PRINT '--- model checks on the migrated set (every count must be 0) ---';

SELECT
    (SELECT COUNT(*) FROM #Legacy l
      WHERE l.Skip = 0 AND NOT EXISTS (SELECT 1 FROM dbo.vLumpSumSet v WHERE v.ProjectPK = l.ProjectPK))
                                                        AS NotListedByTheModule,
    /*  Wrapped in a derived table: the inner GROUP BY yields one row per
        offending parent, and a scalar subquery may return only one value. */
    (SELECT COUNT(*) FROM (
        SELECT l.RevisionId
        FROM   #Legacy l
        JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = l.RevisionId AND cc.IsDeleted = 0
        JOIN   dbo.tOptionProjectComponentType o ON o.ComponentName = cc.ComponentType AND o.ComponentId = N'LS'
        WHERE  l.Skip = 0
        GROUP  BY l.RevisionId HAVING COUNT(*) <> 1) x) AS ParentsNotHoldingExactlyOneLSComponent,
    (SELECT COUNT(*) FROM #Legacy l
      JOIN dbo.vLumpSumSet v ON v.ProjectPK = l.ProjectPK
      WHERE l.Skip = 0 AND ABS(v.OriginalAllocation - (v.Remaining + v.ItemizedTotal)) > 0.005)
                                                        AS AllocationDrift,
    (SELECT COUNT(*) FROM #Legacy l
      JOIN dbo.tProjectRevisions r ON r.Id = l.RevisionId
      WHERE l.Skip = 0
        AND NOT EXISTS (SELECT 1
                        FROM   dbo.tOptionProjectCategoryToPAPMap m
                        JOIN   dbo.tOptionProjectThrustList t ON t.PAPKey = m.PAPKey
                        WHERE  m.CategoryId = r.Category AND t.PAPKey = r.Thrust
                          AND (t.ValidToDate = 0
                               OR (t.ValidFromDate < l.StartYear AND t.ValidToDate > l.StartYear))))
                                                        AS StillInvalidSubCategory,
    (SELECT COUNT(*) FROM #Legacy WHERE Skip = 1)       AS SkippedAndReportedAbove;
GO

PRINT '--- what the module now sees ---';
SELECT COUNT(*) AS LumpSumProjects  FROM dbo.vLumpSumSet;
SELECT COUNT(*) AS ItemizedChildren FROM dbo.vLumpSumChildSet;

SELECT   v.ProgramId, MAX(v.ProgramName) AS ProgramName, COUNT(*) AS Projects,
         SUM(v.OriginalAllocation) AS Allocation, SUM(v.Remaining) AS Remaining,
         SUM(v.ItemizedTotal) AS Itemized
FROM     dbo.vLumpSumSet v
GROUP BY v.ProgramId
ORDER BY Projects DESC;
GO

PRINT '--- allocation invariant: Total = Remaining + Itemized (DRIFT means a row was missed) ---';
SELECT   v.ProjectId, LEFT(v.Description, 50) AS Descr, v.StageName,
         v.OriginalAllocation, v.Remaining, v.ItemizedTotal, v.ItemizedCount,
         Invariant = CASE WHEN ABS(v.OriginalAllocation - (v.Remaining + v.ItemizedTotal)) <= 0.005
                          THEN 'OK' ELSE 'DRIFT' END
FROM     dbo.vLumpSumSet v
JOIN     #Legacy l ON l.ProjectPK = v.ProjectPK
ORDER BY v.ProjectId;
GO

PRINT '';
PRINT 'LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql complete.';
GO

SET NOEXEC OFF;
GO
