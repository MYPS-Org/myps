/* =============================================================================
   Lump Sum — migrate the legacy '…LS' projects (2023 onwards) onto the V3 data model
   2026-09-14, REVISION 2 the same day
   -----------------------------------------------------------------------------
   TARGET: localhost / myps_db_dev_200 first; SERVER-BOUND once proven.

   REVISION 2 (2026-09-14). The first version migrated the 59 parents of 2024 and
   declared that they had no itemized children. They have 2,028. The old data
   model records an itemization as a dbo.history row against the CHILD —
   'Itemized from Project: <parent>' — and in no project column, so the first
   version's search of AlternateId / ParentProjectId / ParentWalletId could not
   have found them. Consequences and changes:

     - the 2023 and 2025 program groups were loaded from MYPS_BAK through the
       reference pipeline (myps-gis-backend, app/data_migration), which now also
       carries those history rows into tProjectNotes;
     - section 1's scope spans 2023 onwards and RE-ADMITS an already-migrated
       parent that holds a non-Lump-Sum component, has unlinked noted children,
       or whose funding no longer balances;
     - section 3 converts a non-Lump-Sum component (the 2025 OO-1 four hold a
       'CW' one and nothing else) into the allocation, and folds extras;
     - section 5b is new: it links the children from the notes and stamps them
       as ImportItemizedProjects would, retiring their duplicate components
       first;
     - section 7 now derives the allocation as Remaining + Σ children and never
       overwrites the stored balance — the first version had that backwards,
       which is why it wrote the 22 itemized parents' funding lines short and
       called six fully-itemized parents "unfunded".

   The text below the line was written for the first version and is kept where
   it is still true. Where it is not, the section's own header says so.

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

   THE CHILDREN (corrected in Revision 2). The first version said: "THERE ARE NO
   CHILDREN. Searched five ways — AlternateId equal to the parent's ProjectId, to
   its ProjectPK suffix, to its own AlternateId, to its ExternalId, and containing
   its numeric core; plus ParentProjectId and ParentWalletId. Zero hits." Every
   one of those searches was correct and the conclusion was not: the link is in
   dbo.history, a free-text log, and nowhere else. Section 5b reads it from the
   tProjectNotes rows the loader now carries across. 22 of the 59 have children;
   the six with a zero balance are the ones whose children hold all of it.

   WHAT THIS FILE DELIBERATELY DOES NOT DO

   1. MY-PREFIXED IDs ARE NOT MIGRATED. 'MY00003005LS' and 'MY00040003LS' belong
      to a module that is not implemented yet (instruction, 2026-09-14). They are
      inventoried in documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION.md,
      Appendix A, and excluded by the scope predicate below. That instruction is
      the only reason they are out of scope: AlternateId does not record
      itemization (section 5b's own header explains why), so their appearance
      there says nothing about whether they have children either way.

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

   SET NOEXEC ON after the RAISERROR is not decoration, and the RAISERROR itself
   is severity 16, NOT the 2026-09-10 migration's severity 20 WITH LOG. A
   NON-SYSADMIN login cannot raise WITH LOG: it fails with Msg 2754, and with
   XACT_ABORT ON that aborts the BATCH before SET NOEXEC ON ever runs — every
   later batch RUNS ANYWAY. That is the exact fail-open the 2026-09-10
   migration has (bring-up code review, finding #3); this guard is written to
   close it, not repeat it. NOEXEC does not care who raised what, and a plain
   severity-16 RAISERROR is something every login can raise.
   ============================================================================= */
PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));
GO

IF DB_NAME() = N'myps_db'
BEGIN
    RAISERROR('REFUSED: this script will not run against myps_db, the retired production database name (SKL-005/ADR-118). Point it at a dev database.', 16, 1);
    SET NOEXEC ON;
END
GO


/* =============================================================================
   1. The scope — built once, used by every section
   -----------------------------------------------------------------------------
   A CANDIDATE is a tProjects row that looks like a Lump Sum parent:

     - ProjectPK or the latest live revision's ProjectId ends in 'LS' (the
       parent's generated ID carries 'LS' as its island code — a constant, not a
       geographic one; FE/src/pages/LumpSum/LumpSum.md, "The model, in one
       paragraph"). ProjectId is checked as well as ProjectPK because the P008
       group was renumbered: PK '…_P00800001LS' carries ProjectId 'P00800005LS'.
     - no ParentProjectId — a parent, never a child,
     - its program starts in 2023 or later (instruction, 2026-09-14: older data
       needs sanitation before it is worth migrating),
     - and its ProjectId does not start 'MY' (exclusion 1 in the header).

   A candidate is IN SCOPE when any of four things is true of it (REVISION 2,
   2026-09-14). The first is the original rule; the rest are why this script now
   has work to do on projects it has already migrated once:

     R1  it is not ProjectType 'LS' yet — never migrated.
     R2  its latest revision holds a live component that is not the Lump Sum
         one. The 2025 OO-1 four hold a 'CW' Civil Works component and nothing
         else; section 3 converts it. Without this, they would be listed with
         an allocation the module cannot find.
     R3  it has an 'Itemized from Project: <this ProjectId>' note naming a child
         that is not yet linked. The 2024 parents were migrated on 2026-09-14
         believing they had no children — see the header — and 2,027 of their
         children are on this database with no ParentProjectId.
     R4  its funding no longer equals Remaining + what its children hold. That
         is the model's identity; a parent whose children were just linked by
         R3 fails it until section 7 re-derives the allocation.

   R1 alone is what made the previous version idempotent. R2-R4 are all written
   against their own post-condition, so a second run still selects nothing.
   ============================================================================= */
IF OBJECT_ID('tempdb..#Legacy') IS NOT NULL DROP TABLE #Legacy;

/*  The component type name, needed by R2 before section 2b declares its own copy.
    tProjectComponentCost stores the NAME ("Lump Sum") on rows the application
    wrote and the CODE ('LS') on rows the migration loader wrote; both count. */
DECLARE @LSNameScope nvarchar(200) =
    (SELECT TOP 1 ComponentName FROM dbo.tOptionProjectComponentType WHERE ComponentId = N'LS');

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
       CAST(0 AS bit)       AS Skip,
       /*  Why this row is here, printed below so the run explains itself. */
       CAST(CASE WHEN ISNULL(p.ProjectType, N'') <> N'LS' THEN 1 ELSE 0 END AS bit) AS R1NotTyped,
       CAST(CASE WHEN nonls.CostId IS NOT NULL          THEN 1 ELSE 0 END AS bit) AS R2NonLSComponent,
       CAST(CASE WHEN kids.Unlinked > 0                 THEN 1 ELSE 0 END AS bit) AS R3UnlinkedChildren,
       CAST(CASE WHEN ISNULL(p.ProjectType, N'') = N'LS'
                  AND ABS(ISNULL(fund.Funded,0) - (ISNULL(bal.Remaining,0) + ISNULL(held.KidCost,0))) > 0.005
                 THEN 1 ELSE 0 END AS bit) AS R4Drift
INTO   #Legacy
FROM   dbo.tProjects p
CROSS APPLY (
    SELECT TOP 1 r.*
    FROM   dbo.tProjectRevisions r
    WHERE  r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
    ORDER  BY r.Id DESC
) lr
JOIN   dbo.tPrograms g ON g.ProgramPK = p.ProgramFK

/*  R2: a live component on the latest revision that is not the Lump Sum one,
    by NAME or by CODE, on either column. */
OUTER APPLY (
    SELECT TOP 1 cc.Id AS CostId
    FROM   dbo.tProjectComponentCost cc
    WHERE  cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0
      AND  cc.ComponentType <> @LSNameScope
      AND  cc.ComponentType <> N'LS'
      AND  ISNULL(cc.ComponentId, N'') NOT IN (N'LS', N'LS1')
) nonls

/*  R3: children this parent is named by in the itemization notes the loader
    carried across, that are not linked yet. A note lives on the CHILD's revision
    and reads 'Itemized from Project: <parent ProjectId>'. */
OUTER APPLY (
    SELECT SUM(CASE WHEN kp.ParentProjectId IS NULL THEN 1 ELSE 0 END) AS Unlinked
    FROM   dbo.tProjectNotes n
    JOIN   dbo.tProjectRevisions kr ON kr.Id = n.ProjectRevisionFK AND kr.IsDeleted = 0
    JOIN   dbo.tProjects kp         ON kp.ProjectPK = kr.ProjectFK
    WHERE  n.[Description] LIKE N'Itemized from Project:%'
      AND  LTRIM(RTRIM(SUBSTRING(n.[Description], 23, 60))) = lr.ProjectId
) kids

/*  R4: what the parent's children hold, counted the way vLumpSumSet counts it —
    every project whose ParentProjectId names this parent, latest live revision,
    live components — NOT by notes. The MyMYPS sample's three parents have
    eighteen children linked by ParentProjectId and no notes at all; counting by
    notes read them as childless and pulled them into scope as "drifting" when
    they balance exactly. The harness caught that. */
OUTER APPLY (
    SELECT SUM(kc.Cost) AS KidCost
    FROM   dbo.tProjects child
    CROSS APPLY (SELECT TOP 1 kr.Id FROM dbo.tProjectRevisions kr
                  WHERE kr.ProjectFK = child.ProjectPK AND kr.IsDeleted = 0 ORDER BY kr.Id DESC) kr
    CROSS APPLY (SELECT ISNULL(SUM(kcc.Total), 0) AS Cost
                 FROM   dbo.tProjectComponentCost kcc
                 WHERE  kcc.ProjectRevisionFK = kr.Id AND kcc.IsDeleted = 0) kc
    WHERE  child.ParentProjectId = lr.ProjectId
) held

OUTER APPLY (
    SELECT SUM(f.Amount) AS Funded
    FROM   dbo.tProjectFundingProfile f
    WHERE  f.ProjectRevisionFK = lr.Id AND f.IsDeleted = 0
) fund

OUTER APPLY (
    SELECT SUM(cy.Amount) AS Remaining
    FROM   dbo.tProjectComponentCost cc
    JOIN   dbo.tProjectComponentCostPerYear cy ON cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0
    JOIN   dbo.tOptionProjectComponentType o   ON o.ComponentName = cc.ComponentType
    WHERE  cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0 AND o.ComponentId = N'LS'
) bal

WHERE (p.ProjectPK LIKE N'%LS' OR lr.ProjectId LIKE N'%LS')
  AND  p.ParentProjectId IS NULL
  AND  lr.ProjectId NOT LIKE N'MY%'
  AND  g.StartYear >= 2023
  AND (
        /* R1 */ ISNULL(p.ProjectType, N'') <> N'LS'
     /* R2 */ OR nonls.CostId IS NOT NULL
     /* R3 */ OR kids.Unlinked > 0
     /* R4 */ OR (ISNULL(p.ProjectType, N'') = N'LS'
                  AND ABS(ISNULL(fund.Funded,0) - (ISNULL(bal.Remaining,0) + ISNULL(held.KidCost,0))) > 0.005)
      );

DECLARE @Scope int = (SELECT COUNT(*) FROM #Legacy);
PRINT CONCAT('Lump Sum parents in scope: ', @Scope);

IF @Scope = 0
BEGIN
    PRINT 'Nothing to migrate — every ...LS parent from 2023 on is already on the model,';
    PRINT 'holds only its Lump Sum component, has every noted child linked, and balances.';
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
ORDER BY MAX(l.StartYear), Parents DESC;
GO

PRINT '--- scope by reason (a parent can be here for several) ---';
SELECT SUM(CAST(R1NotTyped AS int))         AS [R1 not typed 'LS'],
       SUM(CAST(R2NonLSComponent AS int))   AS [R2 holds a non-LS component],
       SUM(CAST(R3UnlinkedChildren AS int)) AS [R3 has unlinked noted children],
       SUM(CAST(R4Drift AS int))            AS [R4 allocation drift],
       COUNT(*)                             AS [total]
FROM   #Legacy;
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

/*  ONE FUNDING AGREEMENT PER PROGRAM YEAR IN SCOPE (Revision 2). The scope now
    spans 2023-2025, and a GAA 2023 line item is funded under DPWH-GAA-2023, not
    2024. Resolved for every distinct StartYear in #Legacy; any year without an
    active 'GOP' / 'DPWH-GAA-<year>' row refuses the whole run, because writing a
    2023 parent's funding line under the 2024 agreement would be a quiet lie the
    project form then validates as fine. */
IF OBJECT_ID('tempdb..#Agreement') IS NOT NULL DROP TABLE #Agreement;

SELECT DISTINCT l.StartYear,
       AgreementCode = N'DPWH-GAA-' + CAST(l.StartYear AS nvarchar(4)),
       Present = CASE WHEN EXISTS (SELECT 1 FROM dbo.tOptionFundingAgreement a
                                    WHERE a.Code = N'DPWH-GAA-' + CAST(l.StartYear AS nvarchar(4))
                                      AND a.SourceOrg = N'GOP' AND a.IsActive = 1)
                      THEN 1 ELSE 0 END
INTO   #Agreement
FROM   #Legacy l;

PRINT '--- funding agreements by program year ---';
SELECT StartYear, AgreementCode, CASE WHEN Present = 1 THEN 'active' ELSE 'MISSING' END AS state FROM #Agreement ORDER BY StartYear;

IF EXISTS (SELECT 1 FROM #Agreement WHERE Present = 0)
BEGIN
    RAISERROR('REFUSED: a program year in scope has no active ''GOP'' / ''DPWH-GAA-<year>'' row in dbo.tOptionFundingAgreement (see the table above). Section 7 needs one per year. Add the agreement this lineage uses before running.', 16, 1);
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
   3. Exactly one live component, and it is the Lump Sum one
   -----------------------------------------------------------------------------
   A Lump Sum Project holds ONE component: the allocation. UpdateLumpSum refuses
   any payload with a different number ("A Lump Sum Project holds exactly one
   component…"), and vLumpSumSet SUMs whatever it finds into LSCost. Three shapes
   arrive here that break that, and this section reduces all three to one row.

   1. AN IDENTICAL DUPLICATE — 53 of the 2024 parents carried one, and so do the
      2023 rows. Not a data problem: the loader's component query selected
      per-year columns under a SELECT DISTINCT meant to be per component, so one
      component became one row per distinct (cost, dates) shape, each carrying
      the whole Total. Left alone, every such parent reports DOUBLE its
      allocation. Fixed at source on 2026-09-14 (app/data_migration/queries.py in
      the myps-gis-backend repo), but rows already on this database still need
      retiring.

   2. A COMPONENT THAT IS NOT THE LUMP SUM ONE — the 2025 OO-1 four hold a 'CW'
      Civil Works component and nothing else. That money IS their allocation:
      they are Lump Sum line items whose component was never typed as such. The
      survivor is CONVERTED, not discarded.

   3. BOTH AT ONCE — an already-migrated parent that has since gained a stray
      component. No such row exists here; the branch is for the server copy.

   THE SURVIVOR is the lowest-Id Lump Sum component if the revision has one, else
   the lowest-Id component of any type. Lowest Id because that is the row
   FindLSComponentAsync returns (OrderBy(x => x.Id).FirstOrDefault) — so the
   script and the application agree about which row is the allocation.

   IDENTICAL, OR HANDS OFF. A duplicate proved a true copy is retired; one that
   differs is DATA, and deleting it would destroy a figure nobody has looked at.
   Compared on Total, live per-year row count, live per-year Σ Amount and live
   UACS-bearing row count. A revision whose duplicates differ is marked Skip and
   sits out the rest — reported here and showing as DRIFT in the verification,
   which is the correct outcome: visible, not silently averaged.

   A NON-DUPLICATE EXTRA COMPONENT IS FOLDED: its Total is added to the survivor
   and it is retired, both figures printed. Its money belongs to the allocation,
   and leaving it would fail the single-component rule. No row in this data needs
   it; the branch exists so the server copy cannot surprise us.

   Soft delete only. IsDeleted = 1 on the component and on its per-year rows,
   stamped with @Who, reversible with one UPDATE.
   -------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Comp') IS NOT NULL DROP TABLE #Comp;

SELECT l.ProjectId,
       l.RevisionId,
       cc.Id                                                          AS CostId,
       cc.Total                                                       AS Total,
       cc.ComponentType                                               AS ComponentType,
       ISNULL(cc.ComponentId, N'')                                    AS ComponentId,
       /*  IS THIS THE LUMP SUM COMPONENT? By NAME **or** by CODE, on either
           column. The module writes the canonical NAME ("Lump Sum") and every
           reader joins on it; this lineage's loaded rows hold the CODE ('LS').
           Matching only the name finds nothing here; matching only the code
           would miss a parent someone has since re-saved through the form. */
       CAST(CASE WHEN cc.ComponentType = @LSName
                   OR cc.ComponentType = N'LS'
                   OR ISNULL(cc.ComponentId, N'') IN (N'LS', N'LS1')
                 THEN 1 ELSE 0 END AS bit)                            AS IsLS,
       PerYear   = (SELECT COUNT(*)            FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       PerYearSum= (SELECT ISNULL(SUM(cy.Amount), 0) FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       UacsRows  = (SELECT COUNT(*)            FROM dbo.tProjectComponentCostPerYear cy
                     WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0 AND cy.UACS IS NOT NULL),
       /*  Survivor first: a Lump Sum component outranks any other, then lowest Id. */
       rn        = ROW_NUMBER() OVER (
                       PARTITION BY l.RevisionId
                       ORDER BY CASE WHEN cc.ComponentType = @LSName
                                       OR cc.ComponentType = N'LS'
                                       OR ISNULL(cc.ComponentId, N'') IN (N'LS', N'LS1')
                                     THEN 0 ELSE 1 END,
                                cc.Id)
INTO   #Comp
FROM   #Legacy l
JOIN   dbo.tProjectComponentCost cc
  ON   cc.ProjectRevisionFK = l.RevisionId
 AND   cc.IsDeleted = 0;

/*  Counted into variables first: PRINT takes only scalar expressions, so a
    subquery inside its CONCAT fails the whole batch at PARSE time — before a
    single statement of this transaction runs. */
DECLARE @CompRows int    = (SELECT COUNT(*) FROM #Comp);
DECLARE @CompParents int = (SELECT COUNT(DISTINCT RevisionId) FROM #Comp);
DECLARE @CompLS int      = (SELECT COUNT(*) FROM #Comp WHERE IsLS = 1);
PRINT CONCAT('Live components found: ', @CompRows, ' across ', @CompParents,
             ' parent(s); ', @CompLS, ' already typed as Lump Sum.');

/*  A parent with NO live component at all cannot be a Lump Sum Project —
    vLumpSumSet requires HasLSComponent = 1 and there is nothing to convert.
    Skip it and say so rather than flipping a type that leaves it invisible. */
UPDATE l SET Skip = 1
FROM   #Legacy l
WHERE  NOT EXISTS (SELECT 1 FROM #Comp c WHERE c.RevisionId = l.RevisionId);

IF @@ROWCOUNT > 0
BEGIN
    PRINT 'WARNING: these parents hold no live component at all and are SKIPPED —';
    PRINT '         there is nothing to convert and vLumpSumSet would not list them.';
    SELECT ProjectId, Description FROM #Legacy WHERE Skip = 1 ORDER BY ProjectId;
END

/*  Duplicates that are not true copies. */
IF OBJECT_ID('tempdb..#Dup') IS NOT NULL DROP TABLE #Dup;

/*  A TRUE COPY, or not. Compared against the survivor on everything that makes a
    component what it is — its type class, its Total, and the shape of its
    per-year rows. Only rows of the SAME class are compared: a 'CW' beside an
    'LS' is not a duplicate of it, it is an extra component, and it is folded
    below rather than retired as a copy. */
SELECT keep.RevisionId, keep.ProjectId, dup.CostId,
       CAST(CASE WHEN keep.IsLS = dup.IsLS
                  AND keep.Total      = dup.Total
                  AND keep.PerYear    = dup.PerYear
                  AND keep.PerYearSum = dup.PerYearSum
                  AND keep.UacsRows   = dup.UacsRows
                 THEN 1 ELSE 0 END AS bit) AS IsTrueCopy
INTO   #Dup
FROM   #Comp keep
JOIN   #Comp dup ON dup.RevisionId = keep.RevisionId AND dup.rn > 1
WHERE  keep.rn = 1;

/*  Several components of the SAME class that are NOT identical. That is data:
    two different Lump Sum figures, or two different Civil Works figures, and no
    rule here says which is right. Reported, skipped, left to a human. */
IF OBJECT_ID('tempdb..#CompDiff') IS NOT NULL DROP TABLE #CompDiff;

SELECT DISTINCT d.RevisionId, d.ProjectId
INTO   #CompDiff
FROM   #Dup d
JOIN   #Comp keep ON keep.RevisionId = d.RevisionId AND keep.rn = 1
JOIN   #Comp dup  ON dup.CostId = d.CostId
WHERE  d.IsTrueCopy = 0 AND keep.IsLS = dup.IsLS;

IF EXISTS (SELECT 1 FROM #CompDiff)
BEGIN
    PRINT 'WARNING: these parents carry SEVERAL live components of the same kind that';
    PRINT '         are NOT identical. Nothing was deleted and nothing was derived for';
    PRINT '         them; section 8 reports them as DRIFT. Resolve by hand.';
    SELECT c.ProjectId, c.CostId, c.ComponentType, c.ComponentId, c.IsLS, c.Total, c.PerYear, c.PerYearSum, c.UacsRows
    FROM   #Comp c JOIN #CompDiff d ON d.RevisionId = c.RevisionId
    ORDER  BY c.ProjectId, c.CostId;

    UPDATE l SET Skip = 1
    FROM   #Legacy l JOIN #CompDiff d ON d.RevisionId = l.RevisionId;
END

/*  The survivor, per parent — every later section works from this. Declared
    before the retirements so the fold can add to it. */
IF OBJECT_ID('tempdb..#Keep') IS NOT NULL DROP TABLE #Keep;

SELECT c.ProjectId, c.RevisionId, c.CostId, c.Total, c.IsLS, c.ComponentType, c.ComponentId
INTO   #Keep
FROM   #Comp c
JOIN   #Legacy l ON l.RevisionId = c.RevisionId AND l.Skip = 0
WHERE  c.rn = 1;

/*  FOLD the extras that are not true copies: their money is part of the
    allocation, and the single-component rule leaves nowhere else to put it.
    Printed in full — a fold changes a stored figure, which is the kind of thing
    that must never happen quietly. Expected to be 0 on this data. */
IF OBJECT_ID('tempdb..#Fold') IS NOT NULL DROP TABLE #Fold;

SELECT d.RevisionId, d.ProjectId, d.CostId, c.ComponentType, c.ComponentId, c.Total
INTO   #Fold
FROM   #Dup d
JOIN   #Comp c    ON c.CostId = d.CostId
JOIN   #Keep k    ON k.RevisionId = d.RevisionId      -- excludes skipped parents
JOIN   #Comp keep ON keep.RevisionId = d.RevisionId AND keep.rn = 1
WHERE  d.IsTrueCopy = 0 AND keep.IsLS <> c.IsLS;

IF EXISTS (SELECT 1 FROM #Fold)
BEGIN
    PRINT 'FOLDING these extra components into the surviving allocation:';
    SELECT f.ProjectId, f.CostId, f.ComponentType, f.ComponentId, f.Total AS FoldedIn,
           k.Total AS SurvivorBefore, k.Total + f.Total AS SurvivorAfter
    FROM   #Fold f JOIN #Keep k ON k.RevisionId = f.RevisionId
    ORDER  BY f.ProjectId, f.CostId;

    UPDATE cc
       SET cc.Total = cc.Total + fold.Amount, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
      FROM dbo.tProjectComponentCost cc
      JOIN #Keep k ON k.CostId = cc.Id
      JOIN (SELECT RevisionId, SUM(Total) AS Amount FROM #Fold GROUP BY RevisionId) fold
        ON fold.RevisionId = k.RevisionId;
    PRINT CONCAT('Folded into ', @@ROWCOUNT, ' surviving component(s).');

    /*  Keep #Keep's Total in step — section 7 reads it. */
    UPDATE k SET k.Total = k.Total + fold.Amount
      FROM #Keep k
      JOIN (SELECT RevisionId, SUM(Total) AS Amount FROM #Fold GROUP BY RevisionId) fold
        ON fold.RevisionId = k.RevisionId;

    /*  THE BALANCE RISES BY THE SAME AMOUNT. Folded money is allocation nobody has
        drawn on, so it is also remaining — exactly what RaiseLSAllocationAsync does
        for a Replenish: Total and the per-year row move together. Onto the
        survivor's row for the PROGRAM's StartYear when one exists (falling back to
        the earliest live row otherwise), as MoveLSBalanceAsync puts it. This runs
        before section 4 retires the nine empty rows, so a component whose rows
        were not loaded in year order must still land the raise on the row that
        will SURVIVE section 4 — targeting the lowest Id there could raise an
        empty later-year row instead, leaving it non-zero (so section 4 keeps it),
        the parent with two live rows, and both skipped by section 7's derivation.
        Without the raise at all, section 7 (which derives the allocation FROM the
        balance, D14) would read the pre-fold balance and quietly undo the fold —
        the harness caught exactly that: 5,000,000 + 700,000 folded, allocation
        back at 5,000,000. */
    UPDATE cy
       SET cy.Amount = cy.Amount + fold.Amount, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
      FROM dbo.tProjectComponentCostPerYear cy
      JOIN #Keep k   ON k.CostId = cy.ComponentCostFK
      JOIN #Legacy l ON l.RevisionId = k.RevisionId
      JOIN (SELECT RevisionId, SUM(Total) AS Amount FROM #Fold GROUP BY RevisionId) fold
        ON fold.RevisionId = k.RevisionId
     WHERE cy.Id = (SELECT TOP 1 x.Id FROM dbo.tProjectComponentCostPerYear x
                    WHERE x.ComponentCostFK = k.CostId AND x.IsDeleted = 0
                    ORDER BY CASE WHEN x.Year = l.StartYear THEN 0 ELSE 1 END, x.Id);
    PRINT CONCAT('Balance raised by the folded amount on ', @@ROWCOUNT, ' per-year row(s).');
END

/*  Retire every surplus row: true copies and folded extras alike. A component
    belonging to a skipped parent is left exactly as found. */
UPDATE cy
   SET cy.IsDeleted = 1, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Dup d ON d.CostId = cy.ComponentCostFK
  LEFT JOIN #CompDiff x ON x.RevisionId = d.RevisionId
 WHERE x.RevisionId IS NULL AND cy.IsDeleted = 0;
SET @Rows = @@ROWCOUNT;

UPDATE cc
   SET cc.IsDeleted = 1, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc
  JOIN #Dup d ON d.CostId = cc.Id
  LEFT JOIN #CompDiff x ON x.RevisionId = d.RevisionId
 WHERE x.RevisionId IS NULL AND cc.IsDeleted = 0;

PRINT CONCAT('Retired ', @@ROWCOUNT, ' surplus component(s) and ', @Rows, ' of their per-year row(s).');

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
IF EXISTS (SELECT 1 FROM #Keep WHERE IsLS = 0)
BEGIN
    PRINT 'CONVERTING these components to the Lump Sum allocation — their money IS the';
    PRINT 'allocation; the component was simply never typed as such:';
    SELECT ProjectId, CostId, ComponentType AS WasType, ComponentId AS WasId, Total
    FROM   #Keep WHERE IsLS = 0 ORDER BY ProjectId;
END

UPDATE cc SET cc.ComponentType = @LSName, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc JOIN #Keep k ON k.CostId = cc.Id
 WHERE cc.ComponentType <> @LSName;
PRINT CONCAT('ComponentType set to the canonical Lump Sum name on ', @@ROWCOUNT, ' component row(s).');

/*  A converted component still describes the work it used to be ("Civil Works").
    Left alone where it says anything else: a description someone typed is theirs. */
UPDATE cc SET cc.[Description] = @LSName, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc JOIN #Keep k ON k.CostId = cc.Id
 WHERE k.IsLS = 0 AND cc.[Description] IN (N'Civil Works', N'CW');
PRINT CONCAT('Description updated on ', @@ROWCOUNT, ' converted component(s).');

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

/*  A YEAR THAT IS NOT A YEAR. The loader derives Year from the id's digit
    segment (+2015+stream year), which is right for every id here, but a
    malformed id or a hand-made row can land 1 or 0 — and DATEFROMPARTS below
    would then mint the year 0001 without complaint. Clamped to the program's
    StartYear before the dates are derived, and printed, because a wrong year is
    a fact about the row worth knowing. Expected 0 on this data. */
UPDATE cy
   SET cy.Year = l.StartYear, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #Keep k   ON k.CostId = cy.ComponentCostFK
  JOIN #Legacy l ON l.RevisionId = k.RevisionId
 WHERE cy.IsDeleted = 0
   AND (cy.Year < 2000 OR cy.Year > 2100);

PRINT CONCAT('Year clamped to the program start year on ', @@ROWCOUNT, ' per-year row(s).');

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

   ParentProjectId, ItemizationType and ProjectStatus stay NULL ON THE PARENT —
   they are the CHILD's columns, and vLumpSumChildSet's membership is
   ParentProjectId IS NOT NULL. Writing them here would move every parent into
   the children view. Section 5b writes them on the children.

   AlternateId is left exactly as found on a PARENT: it is free text there
   (CreateLumpSum writes dto.AlternateId straight through). The "AlternateId is
   the parent's Project ID" rule of 2026-09-05 is the CHILD's, and section 5b
   applies it to the children. The P008 four carry their pre-renumber ID here,
   which is a fact about them worth keeping.
   -------------------------------------------------------------------------- */
UPDATE p
   SET p.ProjectType   = N'LS',
       p.IsPublishable = 0
  FROM dbo.tProjects p
  JOIN #Legacy l ON l.ProjectPK = p.ProjectPK
 WHERE l.Skip = 0
   AND (ISNULL(p.ProjectType, N'') <> N'LS' OR p.IsPublishable <> 0);

PRINT CONCAT('ProjectType set to ''LS'' on ', @@ROWCOUNT, ' project(s).');


/* -----------------------------------------------------------------------------
   5b. The children  (Revision 2, 2026-09-14)
   -----------------------------------------------------------------------------
   THE FIRST VERSION OF THIS SCRIPT SAID THERE WERE NO CHILDREN. It searched
   AlternateId, ParentProjectId and ParentWalletId and found none, and concluded
   from that. The conclusion was wrong: the old data model records an itemization
   in NONE of those columns. It records it as a dbo.history row against the
   CHILD, in the GAA-R program only —

       'Itemized from Project: P00730052LS'

   — and the loader now carries those rows into tProjectNotes on the child's
   revision (build_project_notes_sql, myps-gis-backend). Of 42,589 such notes in
   the source, not one has the child's alternate_id equal to the parent it names;
   the original search was thorough and could not have found them.

   This section is the consumer of those notes. For every note naming a parent
   in scope it does what ImportItemizedProjects does when it creates a child
   (LumpsumController.Import.cs, the tProjects and tProjectRevisions writes):

     tProjects.ParentProjectId   := the parent's ProjectId   — THE LINK. It is
                                    what vLumpSumChildSet lists by, what
                                    vLumpSumSet counts ItemizedTotal from, what
                                    ShowItemizedProjects filters on and what
                                    DeleteItemizedProject resolves the parent
                                    through.
     tProjects.ProjectType       := 'LS'        (the importer writes it on every child)
     tProjects.ItemizationType   := 'Itemized'
     tProjects.ProjectStatus     := 'potential', or 'scheduled' if the child is
                                    already published (LumpSum.Baseline §6's rule)
     revision.AlternateId        := the parent's ProjectId   (rule 2026-09-05)
     funding.IsWalletDraw        := 1 on the child's live lines — the flag
                                    vLumpSumChildSet.CurrentDrawAmount sums

   FIRST, THE CHILD'S OWN DUPLICATE COMPONENTS (decision D13). The 2024 children
   were loaded by the old component query and carry two identical copies of each
   component — 2,237 of their 2,280 (revision, component) pairs. vLumpSumSet reads
   a child's cost as the SUM of its live components, so linking them as-is would
   double every 2024 parent's ItemizedTotal. The same identical-copy rule as
   section 3, per ComponentId, lowest Id survives; a child whose copies are NOT
   identical is still linked — its cost is whatever its live rows sum to — and is
   printed, because that is a figure someone should look at.

   Only where ParentProjectId IS NULL. A child already linked to THIS parent is
   left alone; one linked to a DIFFERENT parent is printed and left alone too,
   since two notes disagreeing is not something a migration should settle.
   -------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Kids') IS NOT NULL DROP TABLE #Kids;

/*  One row per (child, parent) named by a note, restricted to parents in scope.
    The note text after the 22-character prefix is the parent's ProjectId. */
SELECT DISTINCT
       kp.ProjectPK                                    AS ChildPK,
       kp.ParentProjectId                              AS ChildLinkedTo,   -- NULL today
       kp.IsPublished                                  AS ChildIsPublished,
       l.ProjectId                                     AS ParentProjectId,
       l.RevisionId                                    AS ParentRevisionId,
       l.StartYear                                     AS StartYear
INTO   #Kids
FROM   dbo.tProjectNotes n
JOIN   dbo.tProjectRevisions kr ON kr.Id = n.ProjectRevisionFK AND kr.IsDeleted = 0
JOIN   dbo.tProjects kp         ON kp.ProjectPK = kr.ProjectFK
JOIN   #Legacy l                ON l.ProjectId = LTRIM(RTRIM(SUBSTRING(n.[Description], 23, 60)))
                               AND l.Skip = 0
WHERE  n.[Description] LIKE N'Itemized from Project:%';

DECLARE @KidRows int = (SELECT COUNT(*) FROM #Kids);
DECLARE @KidParents int = (SELECT COUNT(DISTINCT ParentProjectId) FROM #Kids);
PRINT CONCAT('Itemization notes naming a parent in scope: ', @KidRows, ' child(ren) under ', @KidParents, ' parent(s).');

/*  A child two notes give to two different parents, or one already linked
    elsewhere. Neither is this script's to decide. */
IF EXISTS (SELECT 1 FROM #Kids k WHERE k.ChildLinkedTo IS NOT NULL AND k.ChildLinkedTo <> k.ParentProjectId)
   OR EXISTS (SELECT ChildPK FROM #Kids GROUP BY ChildPK HAVING COUNT(DISTINCT ParentProjectId) > 1)
BEGIN
    PRINT 'WARNING: these children are claimed by more than one parent, or are already';
    PRINT '         linked to a different one. Left exactly as found; resolve by hand.';
    SELECT k.ChildPK, k.ChildLinkedTo, k.ParentProjectId
    FROM   #Kids k
    WHERE (k.ChildLinkedTo IS NOT NULL AND k.ChildLinkedTo <> k.ParentProjectId)
       OR  k.ChildPK IN (SELECT ChildPK FROM #Kids GROUP BY ChildPK HAVING COUNT(DISTINCT ParentProjectId) > 1)
    ORDER  BY k.ChildPK;

    DELETE k FROM #Kids k
    WHERE (k.ChildLinkedTo IS NOT NULL AND k.ChildLinkedTo <> k.ParentProjectId)
       OR  k.ChildPK IN (SELECT ChildPK FROM #Kids GROUP BY ChildPK HAVING COUNT(DISTINCT ParentProjectId) > 1);
END

/*  Each child's latest live revision — the one every view reads. */
IF OBJECT_ID('tempdb..#KidRev') IS NOT NULL DROP TABLE #KidRev;

SELECT k.ChildPK, k.ParentProjectId, k.StartYear, kr.Id AS RevisionId
INTO   #KidRev
FROM   #Kids k
CROSS APPLY (SELECT TOP 1 r.Id FROM dbo.tProjectRevisions r
             WHERE r.ProjectFK = k.ChildPK AND r.IsDeleted = 0 ORDER BY r.Id DESC) kr;

/*  Duplicate components on the children, same rule as section 3. */
IF OBJECT_ID('tempdb..#KidComp') IS NOT NULL DROP TABLE #KidComp;

SELECT kr.ChildPK, kr.StartYear, cc.Id AS CostId, ISNULL(cc.ComponentId, N'') AS ComponentId, cc.Total,
       PerYear    = (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear cy WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       PerYearSum = (SELECT ISNULL(SUM(cy.Amount), 0) FROM dbo.tProjectComponentCostPerYear cy WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0),
       UacsRows   = (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear cy WHERE cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0 AND cy.UACS IS NOT NULL),
       rn         = ROW_NUMBER() OVER (PARTITION BY kr.RevisionId, ISNULL(cc.ComponentId, N'') ORDER BY cc.Id)
INTO   #KidComp
FROM   #KidRev kr
JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = kr.RevisionId AND cc.IsDeleted = 0;

IF OBJECT_ID('tempdb..#KidDup') IS NOT NULL DROP TABLE #KidDup;

SELECT dup.ChildPK, dup.StartYear, dup.CostId, dup.ComponentId,
       IsTrueCopy = CAST(CASE WHEN keep.Total = dup.Total AND keep.PerYear = dup.PerYear
                               AND keep.PerYearSum = dup.PerYearSum AND keep.UacsRows = dup.UacsRows
                              THEN 1 ELSE 0 END AS bit)
INTO   #KidDup
FROM   #KidComp keep
JOIN   #KidComp dup ON dup.ChildPK = keep.ChildPK AND dup.ComponentId = keep.ComponentId AND dup.rn > 1
WHERE  keep.rn = 1;

IF EXISTS (SELECT 1 FROM #KidDup WHERE IsTrueCopy = 0)
BEGIN
    PRINT 'WARNING: these children carry several live rows of the same component that are';
    PRINT '         NOT identical. Linked anyway; their cost is the sum of their live rows,';
    PRINT '         and nothing of theirs was retired. Look at them.';
    SELECT c.ChildPK, c.CostId, c.ComponentId, c.Total, c.PerYear, c.PerYearSum
    FROM   #KidComp c JOIN #KidDup d ON d.ChildPK = c.ChildPK AND d.ComponentId = c.ComponentId AND d.IsTrueCopy = 0
    ORDER  BY c.ChildPK, c.ComponentId, c.CostId;
END

UPDATE cy
   SET cy.IsDeleted = 1, cy.UpdatedBy = @Who, cy.UpdatedDate = @Now
  FROM dbo.tProjectComponentCostPerYear cy
  JOIN #KidDup d ON d.CostId = cy.ComponentCostFK
 WHERE d.IsTrueCopy = 1 AND cy.IsDeleted = 0;
SET @Rows = @@ROWCOUNT;

UPDATE cc
   SET cc.IsDeleted = 1, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc
  JOIN #KidDup d ON d.CostId = cc.Id
 WHERE d.IsTrueCopy = 1 AND cc.IsDeleted = 0;

PRINT CONCAT('Retired ', @@ROWCOUNT, ' duplicate child component(s) and ', @Rows, ' of their per-year row(s).');
SELECT StartYear, COUNT(*) AS retired_copies FROM #KidDup WHERE IsTrueCopy = 1 GROUP BY StartYear ORDER BY StartYear;

/*  THE LINK, and the stamps that go with it. */
UPDATE p
   SET p.ParentProjectId = k.ParentProjectId,
       p.ProjectType     = N'LS',
       p.ItemizationType = N'Itemized',
       p.ProjectStatus   = CASE WHEN p.IsPublished = 1 THEN N'scheduled' ELSE N'potential' END
  FROM dbo.tProjects p
  JOIN #Kids k ON k.ChildPK = p.ProjectPK
 WHERE p.ParentProjectId IS NULL;

PRINT CONCAT('Linked ', @@ROWCOUNT, ' child(ren) to their Lump Sum parent.');

UPDATE r
   SET r.AlternateId = k.ParentProjectId, r.UpdatedBy = @Who, r.UpdatedDate = @Now
  FROM dbo.tProjectRevisions r
  JOIN #KidRev k ON k.RevisionId = r.Id
 WHERE ISNULL(r.AlternateId, N'') <> k.ParentProjectId;

PRINT CONCAT('Alternate ID set to the parent''s Project ID on ', @@ROWCOUNT, ' child revision(s).');

UPDATE f
   SET f.IsWalletDraw = 1, f.UpdatedBy = @Who, f.UpdatedDate = @Now
  FROM dbo.tProjectFundingProfile f
  JOIN #KidRev k ON k.RevisionId = f.ProjectRevisionFK
 WHERE f.IsDeleted = 0 AND f.IsWalletDraw = 0;

PRINT CONCAT('IsWalletDraw set on ', @@ROWCOUNT, ' child funding line(s).');

/*  What the NOTES gave each parent — informational. Section 7 does not read
    this: it counts children by ParentProjectId, which after the link above
    includes these and any linked by other means (the sample fixture's eighteen). */
IF OBJECT_ID('tempdb..#NoteKidCost') IS NOT NULL DROP TABLE #NoteKidCost;

SELECT k.ParentProjectId,
       Children = COUNT(*),
       KidCost  = SUM(kc.Cost)
INTO   #NoteKidCost
FROM   #KidRev k
CROSS APPLY (SELECT ISNULL(SUM(cc.Total), 0) AS Cost
             FROM   dbo.tProjectComponentCost cc
             WHERE  cc.ProjectRevisionFK = k.RevisionId AND cc.IsDeleted = 0) kc
GROUP  BY k.ParentProjectId;

PRINT '--- children linked from the notes, per parent ---';
SELECT l.StartYear, kc.ParentProjectId, kc.Children, kc.KidCost
FROM   #NoteKidCost kc JOIN #Legacy l ON l.ProjectId = kc.ParentProjectId
ORDER  BY l.StartYear, kc.ParentProjectId;


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

   Unlike the sample script, these parents have NO work items of their own (their
   children do, but a child's work items were never a candidate source here), so
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
   7. The allocation  (Revision 2, 2026-09-14 — decisions D12 / D14)
   -----------------------------------------------------------------------------
   THE MODEL (maintainer decision, 2026-09-06):

       LS component Total   = the FULL allocation  = Σ the parent's live funding lines
       LS per-year Amount   = the REMAINING balance = Total − Σ children's costs

   WHAT THE FIRST VERSION GOT WRONG. It wrote the funding line at the component's
   stored Total and then set Amount := Total − Σ children. With no children
   linked, that made Amount = Total, and both equal to the stored figure. But the
   stored figure IS the remaining balance: itemization in the old system deducted
   each child from the parent's cost, so what the loader carried over is what was
   LEFT, not what was GIVEN. P00730052LS: 11,000,000,000 at GAA, 9,826,178,558.32
   at GAA-R, 446 children costing 10,429,053,146.08. The 22 parents that had
   children therefore received a funding line short by their itemized total — and
   the six with nothing left were written up as "unfunded" when they were fully
   itemized.

   THE DIRECTION IS NOW THE OTHER WAY (D14). The stored per-year Amount is never
   overwritten: it is the remaining balance and always was. The allocation is
   DERIVED from it:

       Kids      := Σ linked children's latest-revision live component Totals
       Remaining := the surviving per-year row's Amount, as stored
       Target    := Remaining + Kids

   and the funding line and component Total are set to Target. The old
   "Amount := Total − Kids" UPDATE is now an ASSERTION: a row that fails it is
   printed as DRIFT and not written. That reversal is what makes correcting the
   2024 parents non-destructive — nothing they hold has to be undone, only the
   line this script itself wrote gets raised.

   THE FUNDING LINE. One line at 100%, IsWalletDraw = 0 (that flag marks a
   CHILD's draw; a parent's own line is not a claim against itself). Source GOP
   under the program year's DPWH-GAA agreement, proven present per year by
   section 2. Three shapes:

     - no live line                   → insert one at Target (most 2023 / 2025 parents)
     - exactly one live line that is THE MIGRATION's — either written by this
       script on an earlier run (CreatedBy = @Who) or carried over by the loader
       on a revision it wrote (the revision carries DataImportId) — and it
       disagrees with Target         → set it to Target, old and new printed.
                                       The 22 already-migrated 2024 parents are
                                       the first kind; P00700002LS is the
                                       second: the old system's own funding row,
                                       which recorded the same post-itemization
                                       figure the cost did, and pre-dates the
                                       model just as much.
     - anything else — several lines, or a line a person entered in the app
                                     → not touched, printed, shows as DRIFT in 8.
                                       A figure a person entered is theirs.

   CHILDREN ARE COUNTED BY ParentProjectId, exactly as vLumpSumSet counts
   ItemizedTotal — not by notes. After section 5b that includes every noted
   child, and it also includes children linked by other means, such as the
   sample fixture's eighteen, which have no notes and must still be subtracted.

   Since 2026-09-06 SyncLSToFundingAsync sets Total := Σ funding on EVERY save, so
   the line is not cosmetic — it is where the allocation lives, and a parent
   without one is rewritten to zero the first time anyone presses Save.

   Only parents with exactly one live per-year row are derived (section 4); the
   rest are reported there and left alone.
   -------------------------------------------------------------------------- */
DECLARE @Source nvarchar(100) = N'GOP';

/*  What each parent's children hold NOW — by ParentProjectId, latest live
    revision, live components: vLumpSumSet's own arithmetic. */
IF OBJECT_ID('tempdb..#KidCost') IS NOT NULL DROP TABLE #KidCost;

SELECT k.ProjectId AS ParentProjectId,
       Children = COUNT(child.ProjectPK),
       KidCost  = ISNULL(SUM(kc.Cost), 0)
INTO   #KidCost
FROM   #Keep k
LEFT JOIN dbo.tProjects child ON child.ParentProjectId = k.ProjectId
OUTER APPLY (SELECT TOP 1 kr.Id FROM dbo.tProjectRevisions kr
              WHERE kr.ProjectFK = child.ProjectPK AND kr.IsDeleted = 0 ORDER BY kr.Id DESC) kr
OUTER APPLY (SELECT ISNULL(SUM(kcc.Total), 0) AS Cost
             FROM   dbo.tProjectComponentCost kcc
             WHERE  kcc.ProjectRevisionFK = kr.Id AND kcc.IsDeleted = 0) kc
GROUP  BY k.ProjectId;

IF OBJECT_ID('tempdb..#Alloc') IS NOT NULL DROP TABLE #Alloc;

SELECT k.ProjectId, k.RevisionId, k.CostId,
       ag.AgreementCode,
       Remaining = cy.Amount,
       Kids      = ISNULL(kc.KidCost, 0),
       Children  = ISNULL(kc.Children, 0),
       Target    = cy.Amount + ISNULL(kc.KidCost, 0),
       LiveLines = (SELECT COUNT(*) FROM dbo.tProjectFundingProfile f
                    WHERE f.ProjectRevisionFK = k.RevisionId AND f.IsDeleted = 0),
       Funded    = (SELECT ISNULL(SUM(f.Amount), 0) FROM dbo.tProjectFundingProfile f
                    WHERE f.ProjectRevisionFK = k.RevisionId AND f.IsDeleted = 0),
       /*  The migration's line: this script's own (CreatedBy = @Who), or one the
           loader wrote when it carried an old-system funding row across
           (tProjectFundingProfile.DataImportId is set only by the loader — never
           by the application, so a person's line in the app never matches this).
           Checking the LINE's own provenance, not the revision's: Replenish and
           Save write to the parent's current (imported) revision, so a person's
           correction sits on that same revision and must not be mistaken for the
           migration's own line. */
       OwnLineId = (SELECT MIN(f.Id) FROM dbo.tProjectFundingProfile f
                    WHERE f.ProjectRevisionFK = k.RevisionId AND f.IsDeleted = 0
                      AND (f.CreatedBy = @Who OR f.DataImportId IS NOT NULL))
INTO   #Alloc
FROM   #Keep k
JOIN   #RowCount rc ON rc.CostId = k.CostId AND rc.LiveRows = 1
JOIN   dbo.tProjectComponentCostPerYear cy ON cy.Id = rc.OnlyRowId
JOIN   #Legacy l    ON l.RevisionId = k.RevisionId
JOIN   #Agreement ag ON ag.StartYear = l.StartYear
LEFT JOIN #KidCost kc ON kc.ParentProjectId = k.ProjectId;

/*  No live line: insert one at Target. */
INSERT dbo.tProjectFundingProfile
       (ProjectRevisionFK, SourceOrg, AgreementCode, Amount, Percentage, IsWalletDraw,
        CreatedBy, CreatedDate, IsDeleted)
SELECT a.RevisionId, @Source, a.AgreementCode, a.Target, 100.0, 0, @Who, @Now, 0
FROM   #Alloc a
WHERE  a.LiveLines = 0;

PRINT CONCAT('Added ', @@ROWCOUNT, ' funding line(s) at Remaining + children.');

/*  Exactly one live line, this script's own, disagreeing: raise it. */
IF EXISTS (SELECT 1 FROM #Alloc a WHERE a.LiveLines = 1 AND a.OwnLineId IS NOT NULL AND ABS(a.Funded - a.Target) > 0.005)
BEGIN
    PRINT 'RAISING these funding lines — this script''s from an earlier run, or the loader''s';
    PRINT 'from the old system — written at the remaining balance, before the children were linked:';
    SELECT a.ProjectId, a.Children, a.Funded AS LineWas, a.Remaining, a.Kids, a.Target AS LineNow
    FROM   #Alloc a
    WHERE  a.LiveLines = 1 AND a.OwnLineId IS NOT NULL AND ABS(a.Funded - a.Target) > 0.005
    ORDER  BY a.ProjectId;

    UPDATE f
       SET f.Amount = a.Target, f.UpdatedBy = @Who, f.UpdatedDate = @Now
      FROM dbo.tProjectFundingProfile f
      JOIN #Alloc a ON a.OwnLineId = f.Id
     WHERE a.LiveLines = 1 AND ABS(a.Funded - a.Target) > 0.005;

    PRINT CONCAT('Raised ', @@ROWCOUNT, ' funding line(s).');
END

/*  Any other shape that disagrees is somebody's figure, not this script's. */
IF EXISTS (SELECT 1 FROM #Alloc a
           WHERE ABS(a.Funded - a.Target) > 0.005
             AND NOT (a.LiveLines = 0 OR (a.LiveLines = 1 AND a.OwnLineId IS NOT NULL)))
BEGIN
    PRINT 'WARNING: these parents have funding lines this script did not write, and they';
    PRINT '         do not agree with Remaining + children. Left alone; section 8 reports';
    PRINT '         them as DRIFT. Resolve by hand.';
    SELECT a.ProjectId, a.LiveLines, a.Funded, a.Remaining, a.Kids, a.Target
    FROM   #Alloc a
    WHERE  ABS(a.Funded - a.Target) > 0.005
      AND  NOT (a.LiveLines = 0 OR (a.LiveLines = 1 AND a.OwnLineId IS NOT NULL))
    ORDER  BY a.ProjectId;
END

/*  Total := Σ live funding — re-read, since the lines above just changed.
    Scoped to #Alloc, NOT every #Keep survivor: #Alloc is exactly the parents
    with one live per-year row, the ones this section actually derived a
    funding line for. A parent with >1 live row (section 4's WARNING) has no
    row in #Alloc and its funding was never touched above — joining #Keep here
    instead would still overwrite its Total from whatever funding happens to
    exist (often none), zeroing an allocation section 4 said was left alone. */
UPDATE cc
   SET cc.Total = f.Funded, cc.UpdatedBy = @Who, cc.UpdatedDate = @Now
  FROM dbo.tProjectComponentCost cc
  JOIN #Alloc a ON a.CostId = cc.Id
  CROSS APPLY (SELECT ISNULL(SUM(x.Amount), 0) AS Funded
               FROM   dbo.tProjectFundingProfile x
               WHERE  x.ProjectRevisionFK = a.RevisionId AND x.IsDeleted = 0) f
 WHERE cc.Total <> f.Funded;

PRINT CONCAT('Allocation (component Total) set from the funding lines on ', @@ROWCOUNT, ' component(s).');

/*  THE ASSERTION that replaced the derivation: Amount must equal Total − Kids.
    Nothing is written here. A row that fails is a parent whose funding was left
    alone above, and it is listed so nobody has to hunt for it in section 8. */
IF EXISTS (SELECT 1 FROM #Alloc a
           JOIN dbo.tProjectComponentCost cc ON cc.Id = a.CostId
           WHERE ABS(a.Remaining - (cc.Total - a.Kids)) > 0.005)
BEGIN
    PRINT 'DRIFT: on these parents Remaining <> Total - children after this section.';
    PRINT '       Nothing was written to their balance; the model does not hold for them.';
    SELECT a.ProjectId, a.Remaining, cc.Total, a.Kids, cc.Total - a.Kids AS RemainingShouldBe
    FROM   #Alloc a JOIN dbo.tProjectComponentCost cc ON cc.Id = a.CostId
    WHERE  ABS(a.Remaining - (cc.Total - a.Kids)) > 0.005
    ORDER  BY a.ProjectId;
END
ELSE
    PRINT 'Remaining = Total - children holds on every derived parent.';

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

PRINT '--- Revision 2 checks (every count must be 0) ---';

SELECT
    /*  A parent still holding a live component that is not the Lump Sum one. */
    (SELECT COUNT(*) FROM (
        SELECT DISTINCT l.RevisionId
        FROM   #Legacy l
        JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = l.RevisionId AND cc.IsDeleted = 0
        LEFT JOIN dbo.tOptionProjectComponentType o ON o.ComponentName = cc.ComponentType
        WHERE  l.Skip = 0 AND ISNULL(o.ComponentId, N'') <> N'LS') x)
                                                        AS ParentsHoldingANonLSComponent,
    /*  A note naming an in-scope parent whose child is still unlinked. */
    (SELECT COUNT(*) FROM dbo.tProjectNotes n
      JOIN dbo.tProjectRevisions kr ON kr.Id = n.ProjectRevisionFK AND kr.IsDeleted = 0
      JOIN dbo.tProjects kp         ON kp.ProjectPK = kr.ProjectFK
      JOIN #Legacy l                ON l.ProjectId = LTRIM(RTRIM(SUBSTRING(n.[Description], 23, 60))) AND l.Skip = 0
      WHERE n.[Description] LIKE N'Itemized from Project:%' AND kp.ParentProjectId IS NULL)
                                                        AS NotedChildrenUnlinked,
    /*  A linked child still carrying two live rows of one component. */
    (SELECT COUNT(*) FROM (
        SELECT cc.ProjectRevisionFK, cc.ComponentId
        FROM   dbo.vLumpSumChildSet c
        JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = c.RevisionId AND cc.IsDeleted = 0
        GROUP  BY cc.ProjectRevisionFK, cc.ComponentId HAVING COUNT(*) > 1) x)
                                                        AS LinkedChildrenWithDuplicateComponents,
    /*  A child pointing at a parent the module does not list. */
    (SELECT COUNT(*) FROM dbo.vLumpSumChildSet c
      WHERE NOT EXISTS (SELECT 1 FROM dbo.vLumpSumSet s WHERE s.ProjectId = c.ParentProjectId))
                                                        AS ChildrenLinkedToAnUnlistedParent,
    /*  A linked child without the stamps ImportItemizedProjects writes. */
    (SELECT COUNT(*) FROM dbo.tProjects p
      WHERE p.ParentProjectId IS NOT NULL
        AND (ISNULL(p.ProjectType, N'') <> N'LS' OR p.ItemizationType IS NULL OR p.ProjectStatus IS NULL))
                                                        AS LinkedChildrenMissingStamps;
GO

PRINT '--- by program year: parents listed, children linked, what they hold ---';
SELECT   g.StartYear,
         Parents      = COUNT(DISTINCT v.ProjectPK),
         Children     = SUM(v.ItemizedCount),
         Allocation   = SUM(v.OriginalAllocation),
         Remaining    = SUM(v.Remaining),
         Itemized     = SUM(v.ItemizedTotal)
FROM     dbo.vLumpSumSet v
JOIN     dbo.tPrograms g ON g.ProgramPK = v.ProgramFK
GROUP BY g.StartYear
ORDER BY g.StartYear;
GO

PRINT '--- the parents that were listed at zero: what they hold now ---';
SELECT   v.ProjectId, v.OriginalAllocation, v.Remaining, v.ItemizedTotal, v.ItemizedCount
FROM     dbo.vLumpSumSet v
WHERE    v.ProjectId IN (N'P00800007LS', N'P00830004LS', N'P00830010LS', N'P00830013LS', N'P00830014LS', N'P00830018LS')
ORDER BY v.ProjectId;
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
