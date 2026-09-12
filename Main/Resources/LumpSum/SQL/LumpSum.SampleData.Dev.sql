/* =============================================================================
   Lump Sum V2 — sample data, LOCAL DEV ONLY
   -----------------------------------------------------------------------------
   Copies a small set of real Lump Sum Projects and their itemized children from
   a MyMYPS database on the SAME SQL Server instance into this one, so the module
   has something to render and the e2e specs have a parent to itemize against.

   NOT FOR ANY SHARED OR PRODUCTION SERVER. It uses three-part naming
   (MyMYPS.dbo.*) and therefore only works where both databases are restored side
   by side; it is skipped with a message anywhere else.

   WHY THIS DATA. MyMYPS already stores Lump Sum the way V2 does — 87 parents
   holding an 'LS' component with ParentProjectId NULL, and 34 children pointing
   at them. It is real shaped data rather than something invented, and its
   Project IDs already end in the 'LS' segment V2 generates.

   IDENTITIES ARE PRESERVED. Every source Id in this sample sits above this
   database's MAX for the same table and none collide, so IDENTITY_INSERT keeps
   them and no foreign key has to be remapped. The script asserts that rather
   than assuming it, and refuses if it stops being true.

   Idempotent: re-running deletes the sample and re-copies it. Deletes are scoped
   to exactly the ProjectPKs listed below and nothing else.
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* -- 0. Guard: is a MyMYPS to copy from actually here? ---------------------- */
IF DB_ID('MyMYPS') IS NULL
BEGIN
    PRINT 'SKIPPED: no MyMYPS database on this server. Sample data is local-dev only.';
    SET NOEXEC ON;
END
GO

/* -- 1. The sample ----------------------------------------------------------
   Three Lump Sum Projects with six itemized children each. Enough to exercise
   the balance arithmetic, the child grid and a delete-restores case without
   dragging in all 121.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Sample') IS NOT NULL DROP TABLE #Sample;
CREATE TABLE #Sample (ProjectPK nvarchar(200) PRIMARY KEY, IsParent bit);

INSERT #Sample (ProjectPK, IsParent)
VALUES ('P00900023LS', 1), ('P00900016LS', 1), ('P00900040LS', 1);

INSERT #Sample (ProjectPK, IsParent)
SELECT k.ProjectPK, 0
FROM   MyMYPS.dbo.tProjects k
JOIN   MyMYPS.dbo.tProjectRevisions r
  ON   r.ProjectId = k.ParentProjectId AND r.IsDeleted = 0
WHERE  r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
  AND  k.ProjectPK NOT IN (SELECT ProjectPK FROM #Sample);

/* Revision and component-cost keys, for the child tables. */
IF OBJECT_ID('tempdb..#Rev') IS NOT NULL DROP TABLE #Rev;
SELECT Id INTO #Rev FROM MyMYPS.dbo.tProjectRevisions
WHERE  ProjectFK IN (SELECT ProjectPK FROM #Sample);

IF OBJECT_ID('tempdb..#Cost') IS NOT NULL DROP TABLE #Cost;
SELECT Id INTO #Cost FROM MyMYPS.dbo.tProjectComponentCost
WHERE  ProjectRevisionFK IN (SELECT Id FROM #Rev);

DECLARE @Parents int = (SELECT COUNT(*) FROM #Sample WHERE IsParent = 1);
DECLARE @Children int = (SELECT COUNT(*) FROM #Sample WHERE IsParent = 0);
PRINT CONCAT('Sample: ', @Parents, ' Lump Sum Project(s), ', @Children, ' itemized child/children.');
GO

/* -- 2. Assert the identities are still free --------------------------------
   The whole approach rests on this. If someone has since inserted into the
   ranges these rows occupy, preserving ids would collide and remapping every FK
   is a different script — so stop rather than half-apply.
   ---------------------------------------------------------------------------- */
DECLARE @Clash int =
    (SELECT COUNT(*) FROM MyMYPS.dbo.tProjects s
      JOIN dbo.tProjects t ON t.Id = s.Id
     WHERE s.ProjectPK IN (SELECT ProjectPK FROM #Sample)
       AND t.ProjectPK <> s.ProjectPK)
  + (SELECT COUNT(*) FROM MyMYPS.dbo.tProjectRevisions s
      JOIN dbo.tProjectRevisions t ON t.Id = s.Id
     WHERE s.Id IN (SELECT Id FROM #Rev)
       AND t.ProjectFK NOT IN (SELECT ProjectPK FROM #Sample));

IF @Clash > 0
BEGIN
    RAISERROR('Identity collision on %d row(s): rows unrelated to the sample already occupy these Ids. Remapping is out of scope for this script.', 16, 1, @Clash);
    SET NOEXEC ON;
END
GO

/* -- 3. Remove any previous copy (idempotency) -------------------------------
   Children first, then parents. Scoped to the sample's own keys only.
   ---------------------------------------------------------------------------- */
BEGIN TRAN;

DELETE FROM dbo.tProjectComponentCostPerYear
WHERE ComponentCostFK IN (SELECT cc.Id FROM dbo.tProjectComponentCost cc
                          JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
                          WHERE r.ProjectFK IN (SELECT ProjectPK FROM #Sample));

DELETE FROM dbo.tProjectMajorWorkItem
WHERE ComponentCostFK IN (SELECT cc.Id FROM dbo.tProjectComponentCost cc
                          JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
                          WHERE r.ProjectFK IN (SELECT ProjectPK FROM #Sample));

DELETE FROM dbo.tProjectComponentCost
WHERE ProjectRevisionFK IN (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK IN (SELECT ProjectPK FROM #Sample));

DELETE FROM dbo.tProjectFundingProfile
WHERE ProjectRevisionFK IN (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK IN (SELECT ProjectPK FROM #Sample));

DELETE FROM dbo.tProjectNotes
WHERE ProjectRevisionFK IN (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK IN (SELECT ProjectPK FROM #Sample));

DELETE FROM dbo.tProjectStages   WHERE ProjectFK IN (SELECT ProjectPK FROM #Sample);
DELETE FROM dbo.tProjectRevisions WHERE ProjectFK IN (SELECT ProjectPK FROM #Sample);
DELETE FROM dbo.tProjects        WHERE ProjectPK IN (SELECT ProjectPK FROM #Sample);

/*  SWEEP ORPHANED WORK ITEMS.

    The deletes above reach tProjectMajorWorkItem through its ComponentCostFK —
    which only works while the cost row still exists. Anything that removed a
    cost row WITHOUT removing its work items first leaves rows this script can no
    longer find by lineage, and re-copying then fails on
    "Violation of PRIMARY KEY constraint 'PK_tProjectMajorWorkItem'".

    That is exactly what happened: DeleteItemizedProject's hard tier deleted
    component costs but not their work items (now fixed), and with no foreign key
    on the table the database raised nothing at the time. Sweeping by
    orphanhood rather than by lineage makes this script re-runnable regardless of
    what else has mangled the data. */
DELETE mw
FROM   dbo.tProjectMajorWorkItem mw
WHERE  NOT EXISTS (SELECT 1 FROM dbo.tProjectComponentCost cc WHERE cc.Id = mw.ComponentCostFK);

/* -- 4. Copy, parents and children together ---------------------------------
   Column lists are built from the INTERSECTION of the two schemas, so a column
   present in one and not the other (MyMYPS.tProjectRevisions.MCAScore, today)
   cannot break the insert.
   ---------------------------------------------------------------------------- */
DECLARE @Table sysname, @Cols nvarchar(max), @Sql nvarchar(max), @Where nvarchar(max), @Identity bit;

DECLARE Copy CURSOR LOCAL FAST_FORWARD FOR
SELECT 'tProjects',                    'ProjectPK IN (SELECT ProjectPK FROM #Sample)',                 1
UNION ALL SELECT 'tProjectRevisions',  'ProjectFK IN (SELECT ProjectPK FROM #Sample)',                 1
UNION ALL SELECT 'tProjectStages',     'ProjectFK IN (SELECT ProjectPK FROM #Sample)',                 1
UNION ALL SELECT 'tProjectFundingProfile',       'ProjectRevisionFK IN (SELECT Id FROM #Rev)',         1
UNION ALL SELECT 'tProjectComponentCost',        'ProjectRevisionFK IN (SELECT Id FROM #Rev)',         1
UNION ALL SELECT 'tProjectComponentCostPerYear', 'ComponentCostFK IN (SELECT Id FROM #Cost)',          1
UNION ALL SELECT 'tProjectMajorWorkItem',        'ComponentCostFK IN (SELECT Id FROM #Cost)',          1
UNION ALL SELECT 'tProjectNotes',                'ProjectRevisionFK IN (SELECT Id FROM #Rev)',         1;

OPEN Copy;
FETCH NEXT FROM Copy INTO @Table, @Where, @Identity;

WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.' + @Table)
      AND  c.is_computed = 0
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns s
                   WHERE s.object_id = OBJECT_ID('MyMYPS.dbo.' + @Table) AND s.name = c.name);

    /*  @@ROWCOUNT after sp_executesql reports the LAST statement in the batch,
        which is SET IDENTITY_INSERT OFF — always 0. Capture the insert's own
        count inside the dynamic SQL and hand it back, or every table reports
        "copied 0 rows" while copying correctly. */
    DECLARE @Copied int;
    SET @Sql =
        CASE WHEN @Identity = 1 THEN 'SET IDENTITY_INSERT dbo.' + QUOTENAME(@Table) + ' ON; ' ELSE '' END +
        'INSERT INTO dbo.' + QUOTENAME(@Table) + ' (' + @Cols + ') ' +
        'SELECT ' + @Cols + ' FROM MyMYPS.dbo.' + QUOTENAME(@Table) + ' WHERE ' + @Where + ';' +
        ' SET @OutRows = @@ROWCOUNT;' +
        CASE WHEN @Identity = 1 THEN ' SET IDENTITY_INSERT dbo.' + QUOTENAME(@Table) + ' OFF;' ELSE '' END;

    EXEC sp_executesql @Sql, N'@OutRows int OUTPUT', @OutRows = @Copied OUTPUT;
    PRINT CONCAT('  copied ', @Copied, ' row(s) into ', @Table);

    FETCH NEXT FROM Copy INTO @Table, @Where, @Identity;
END
CLOSE Copy;
DEALLOCATE Copy;

COMMIT;
GO

/* -- 4b. Normalise Tier on the copied parents -------------------------------
   MyMYPS stores Tier = 0 on its Lump Sum Projects. That is not a tier: the V2
   field spec makes Tier REQUIRED, and dbo.tOptionProjectTier holds only NameIds
   1 and 2 — so 0 matches no lookup row at all.

   Left alone, the sample looks fine in every list and read, and only fails when
   someone opens a sample project in the edit form and saves: UpdateLumpSum
   refuses with "Select a Tier between 1 and 5" for a value the user never
   touched. The sample would be unusable for exactly the narrated run it exists
   to support.

   The 18 imported children already carry Tier = 1; only the three parents need
   this. Set here rather than in the database directly so a re-run of this script
   does not reintroduce the problem.
   ---------------------------------------------------------------------------- */
UPDATE r
SET    r.Tier = 1
FROM   dbo.tProjectRevisions r
WHERE  r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
  AND  r.Tier NOT IN (SELECT NameId FROM dbo.tOptionProjectTier);

PRINT CONCAT('Normalised Tier on ', @@ROWCOUNT, ' parent revision(s).');
GO

/* -- 4c. Children carry their parent's Project ID as Alternate ID -----------
   Business rule (2026-09-05): an itemized child's AlternateId is the Project ID
   of the Lump Sum Project it was carved from — exactly what ImportItemizedProjects
   writes on every child it creates. MyMYPS kept the workbook's row labels
   ('ITEM-1', 'ITEM-2', ...) there instead, so the copied children are brought
   into line here. Set here rather than in the database directly so a re-run of
   this script does not reintroduce the labels.

   Scoped to the sample's children only; the import writes its own children
   correctly and anything else in the database is not this script's to touch.
   ---------------------------------------------------------------------------- */
UPDATE r
SET    r.AlternateId = p.ParentProjectId
FROM   dbo.tProjectRevisions r
JOIN   dbo.tProjects p ON p.ProjectPK = r.ProjectFK
WHERE  r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 0)
  AND  p.ParentProjectId IS NOT NULL
  AND  ISNULL(r.AlternateId, '') <> p.ParentProjectId;

PRINT CONCAT('Set Alternate ID to the parent''s Project ID on ', @@ROWCOUNT, ' child revision(s).');
GO

/* -- 4d. Normalise Sub-Category (Thrust) on the copied rows ------------------
   MyMYPS stores a Sub-Category these projects cannot keep:

     - the three PARENTS carry Thrust = 1, which is not a PAPKey at all (thrust
       PAPKeys start at 1001; 1 is a row Id), so it resolves to nothing here and
       nothing in MyMYPS either;
     - the 18 CHILDREN carry PAPKey 1003 — a real thrust, but a 2016-era one
       whose validity window closed in 2018 and which
       tOptionProjectCategoryToPAPMap does not map to their Category (16). Its
       successor, worded almost identically, is 1115.

   Left alone, every sample project fails the Category <-> Sub-Category relation
   rule (ImportingHelper.ValidateProjectDetails) and the Lump Sum form's own
   Sub-Category validation, so the sample cannot be re-saved from the form —
   the same class of unusability 4b fixes for Tier.

   HOW THE REPLACEMENT IS CHOSEN. Never guessed; three tables narrow it to one:

     1. tOptionProjectCategoryToPAPMap — which PAPKeys this Category allows.
     2. tOptionProjectThrustList       — of those, which are valid in the
                                         PROGRAM's StartYear: the same window
                                         the validators and the FE dropdown use.
     3. tOptionScopeOfWork             — what the project actually DOES, read off
                                         its major work items, which chooses
                                         among the survivors.

   Scope descriptions and thrust descriptions share the noun naming the work
   family ("Drainage", "Slope"); no column joins them, so @Family below IS that
   link, stated rather than implied. A row whose scope matches no family is left
   untouched and named in the report — never given a plausible-looking value.

   A PARENT holds only the 'LS' allocation and does no work of its own, so it
   takes the family its CHILDREN most often do.

   Ties break to the lowest PAPKey, the "Primary Roads" variant of each family —
   which is what the source's own 1003 was, and nothing in this data
   distinguishes road class.
   ---------------------------------------------------------------------------- */
DECLARE @Family TABLE (Keyword nvarchar(50) PRIMARY KEY);
INSERT @Family (Keyword) VALUES (N'Drainage'), (N'Slope');

IF OBJECT_ID('tempdb..#Work') IS NOT NULL DROP TABLE #Work;
CREATE TABLE #Work (RevisionId int, Category int, StartYear int, Keyword nvarchar(50), Items int);

/*  A child's own work items. */
INSERT #Work (RevisionId, Category, StartYear, Keyword, Items)
SELECT r.Id, r.Category, prg.StartYear, f.Keyword, COUNT(*)
FROM   #Sample s
JOIN   dbo.tProjects p                ON p.ProjectPK = s.ProjectPK AND s.IsParent = 0
JOIN   dbo.tProjectRevisions r        ON r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
JOIN   dbo.tPrograms prg              ON prg.ProgramPK = p.ProgramFK
JOIN   dbo.tProjectComponentCost cc   ON cc.ProjectRevisionFK = r.Id AND cc.IsDeleted = 0
JOIN   dbo.tProjectMajorWorkItem mw   ON mw.ComponentCostFK = cc.Id AND mw.IsDeleted = 0
JOIN   dbo.tOptionScopeOfWork sw      ON sw.Enum = mw.WorkTypeFK
JOIN   @Family f                      ON sw.Description LIKE N'%' + f.Keyword + N'%'
GROUP  BY r.Id, r.Category, prg.StartYear, f.Keyword;

/*  A parent's work is its children's. */
INSERT #Work (RevisionId, Category, StartYear, Keyword, Items)
SELECT pr.Id, pr.Category, prg.StartYear, f.Keyword, COUNT(*)
FROM   #Sample s
JOIN   dbo.tProjects pp               ON pp.ProjectPK = s.ProjectPK AND s.IsParent = 1
JOIN   dbo.tProjectRevisions pr       ON pr.ProjectFK = pp.ProjectPK AND pr.IsDeleted = 0
JOIN   dbo.tPrograms prg              ON prg.ProgramPK = pp.ProgramFK
JOIN   dbo.tProjects c                ON c.ParentProjectId = pr.ProjectId
JOIN   dbo.tProjectRevisions cr       ON cr.ProjectFK = c.ProjectPK AND cr.IsDeleted = 0
JOIN   dbo.tProjectComponentCost cc   ON cc.ProjectRevisionFK = cr.Id AND cc.IsDeleted = 0
JOIN   dbo.tProjectMajorWorkItem mw   ON mw.ComponentCostFK = cc.Id AND mw.IsDeleted = 0
JOIN   dbo.tOptionScopeOfWork sw      ON sw.Enum = mw.WorkTypeFK
JOIN   @Family f                      ON sw.Description LIKE N'%' + f.Keyword + N'%'
GROUP  BY pr.Id, pr.Category, prg.StartYear, f.Keyword;

IF OBJECT_ID('tempdb..#ThrustPick') IS NOT NULL DROP TABLE #ThrustPick;
CREATE TABLE #ThrustPick (RevisionId int PRIMARY KEY, PAPKey int);

INSERT #ThrustPick (RevisionId, PAPKey)
SELECT w.RevisionId, MIN(t.PAPKey)
FROM  (SELECT RevisionId, Category, StartYear, Keyword,
              ROW_NUMBER() OVER (PARTITION BY RevisionId ORDER BY Items DESC, Keyword) AS rn
       FROM   #Work) w
JOIN   dbo.tOptionProjectCategoryToPAPMap m ON m.CategoryId = w.Category
JOIN   dbo.tOptionProjectThrustList t       ON t.PAPKey = m.PAPKey
                                            AND t.ThrustDescription LIKE N'%' + w.Keyword + N'%'
                                            AND (t.ValidToDate = 0
                                                 OR (t.ValidFromDate < w.StartYear AND t.ValidToDate > w.StartYear))
WHERE  w.rn = 1
GROUP  BY w.RevisionId;

/*  Only rows whose current Sub-Category is not already an allowed, in-window
    PAPKey are touched — so a re-run changes nothing, and a value someone has
    since corrected by hand is left alone. */
UPDATE r
SET    r.Thrust = tp.PAPKey
FROM   dbo.tProjectRevisions r
JOIN   #ThrustPick tp  ON tp.RevisionId = r.Id
JOIN   dbo.tProjects p ON p.ProjectPK = r.ProjectFK
JOIN   dbo.tPrograms prg ON prg.ProgramPK = p.ProgramFK
WHERE  NOT EXISTS (SELECT 1
                   FROM   dbo.tOptionProjectCategoryToPAPMap m
                   JOIN   dbo.tOptionProjectThrustList t ON t.PAPKey = m.PAPKey
                   WHERE  m.CategoryId = r.Category
                     AND  t.PAPKey = r.Thrust
                     AND  (t.ValidToDate = 0
                           OR (t.ValidFromDate < prg.StartYear AND t.ValidToDate > prg.StartYear)));

PRINT CONCAT('Normalised Sub-Category on ', @@ROWCOUNT, ' sample revision(s).');

/*  Say plainly what could not be resolved, rather than leaving it to be found
    later by a save that refuses. */
IF EXISTS (SELECT 1
           FROM   #Sample s
           JOIN   dbo.tProjects p ON p.ProjectPK = s.ProjectPK
           JOIN   dbo.tProjectRevisions r ON r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
           JOIN   dbo.tPrograms prg ON prg.ProgramPK = p.ProgramFK
           WHERE  NOT EXISTS (SELECT 1
                              FROM   dbo.tOptionProjectCategoryToPAPMap m
                              JOIN   dbo.tOptionProjectThrustList t ON t.PAPKey = m.PAPKey
                              WHERE  m.CategoryId = r.Category
                                AND  t.PAPKey = r.Thrust
                                AND  (t.ValidToDate = 0
                                      OR (t.ValidFromDate < prg.StartYear AND t.ValidToDate > prg.StartYear))))
BEGIN
    PRINT 'WARNING: these sample rows still carry an unresolved Sub-Category —';
    PRINT '         no scope of work matched a family in @Family above.';
    SELECT r.ProjectId, r.Category, r.Thrust, prg.StartYear
    FROM   #Sample s
    JOIN   dbo.tProjects p ON p.ProjectPK = s.ProjectPK
    JOIN   dbo.tProjectRevisions r ON r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
    JOIN   dbo.tPrograms prg ON prg.ProgramPK = p.ProgramFK
    WHERE  NOT EXISTS (SELECT 1
                       FROM   dbo.tOptionProjectCategoryToPAPMap m
                       JOIN   dbo.tOptionProjectThrustList t ON t.PAPKey = m.PAPKey
                       WHERE  m.CategoryId = r.Category
                         AND  t.PAPKey = r.Thrust
                         AND  (t.ValidToDate = 0
                               OR (t.ValidFromDate < prg.StartYear AND t.ValidToDate > prg.StartYear)))
    ORDER  BY r.ProjectId;
END
GO

/* -- 5. Verification --------------------------------------------------------
   The point of the sample is that the module has readable rows, so check the
   VIEWS rather than the tables — a copy that lands but does not surface through
   vLumpSumSet is of no use.
   ---------------------------------------------------------------------------- */
PRINT '--- what the module now sees ---';
SELECT COUNT(*) AS LumpSumProjects FROM dbo.vLumpSumSet;
SELECT COUNT(*) AS ItemizedChildren FROM dbo.vLumpSumChildSet;

PRINT '--- allocation check: Total = Remaining + Itemized (both stored since 2026-09-06; DRIFT means a writer or the migration missed a row) ---';
SELECT ProjectId, Description, StageName, Remaining, ItemizedTotal, ItemizedCount, OriginalAllocation,
       CASE WHEN ABS(OriginalAllocation - (Remaining + ItemizedTotal)) <= 0.005 THEN 'OK' ELSE 'DRIFT' END AS Invariant
FROM   dbo.vLumpSumSet
ORDER  BY ProjectId;
GO

/* -- 6. Referential integrity -----------------------------------------------
   THESE TABLES CARRY NO FOREIGN KEY CONSTRAINTS. Primary keys are present and
   did enforce Id uniqueness, but nothing enforces that a ProjectRevisionFK or a
   ComponentCostFK points at a row that exists — a bad reference inserts
   silently. Preserving identities keeps the chain coherent, but "keeps" is a
   claim worth testing rather than asserting, so test it.

   Each check must report 0. Anything else means the copy linked rows to the
   wrong parents, which no amount of correct-looking totals would reveal.
   ---------------------------------------------------------------------------- */
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

/*  THE PROJECT-ID ALLOCATOR IS A SECOND COUNTER, AND IDENTITY_INSERT DOES NOT
    TOUCH IT EITHER.

    ProjectPK is not an identity column. Helpers/ProjectHelper.cs GenerateProjectID
    composes it as {Suffix}{YearStart-2016:D3}{Sequence:D5}{IslandCode}, where
    Sequence is handed out by dbo.pReserveProjectIdBlock out of
    dbo.tProjectIdSequence, bucketed on (CategoryId, Suffix, IslandCode, YearStart).

    This script copies ProjectPKs verbatim from MyMYPS, so it spends sequence
    numbers the allocator has no idea are spent. The three sample parents take
    16, 23 and 40 in the (16, 'P', 'LS', 2025) bucket while CurrentSequence sits
    at 15 -- so the next CreateLumpSum composes P00900016LS, trips the generator's
    duplicate guard, and EVERY create in the database fails from then on. The
    failed transaction rolls the counter back with it, so the bucket never gets
    past the collision on its own: it is stuck, not merely behind. Nothing about
    the error names this script, which is why the repair belongs in it.

    Parsing ids is safe here only because it is confined to #Sample -- rows this
    script wrote. tProjects at large holds legacy keys such as
    'MPP_P_CO-PS-634_07172024_134347_BP00936795LZ' that fit no format at all. */
IF OBJECT_ID('tempdb..#Buckets') IS NOT NULL DROP TABLE #Buckets;

SELECT  r.Category                                                             AS CategoryId,
        LEFT(s.ProjectPK, LEN(s.ProjectPK) - 10)                               AS Suffix,
        RIGHT(s.ProjectPK, 2)                                                  AS IslandCode,
        CAST(SUBSTRING(s.ProjectPK, LEN(s.ProjectPK) - 9, 3) AS int) + 2016     AS YearStart,
        MAX(CAST(SUBSTRING(s.ProjectPK, LEN(s.ProjectPK) - 6, 5) AS int))       AS MaxSequence
INTO    #Buckets
FROM    #Sample s
JOIN    dbo.tProjectRevisions r
          ON r.ProjectFK = s.ProjectPK AND r.IsDeleted = 0
WHERE   LEN(s.ProjectPK) IN (11, 12)                     -- 1-2 char Suffix + 3 + 5 + 2
  AND   SUBSTRING(s.ProjectPK, LEN(s.ProjectPK) - 9, 8) NOT LIKE '%[^0-9]%'
GROUP BY r.Category,
         LEFT(s.ProjectPK, LEN(s.ProjectPK) - 10),
         RIGHT(s.ProjectPK, 2),
         CAST(SUBSTRING(s.ProjectPK, LEN(s.ProjectPK) - 9, 3) AS int) + 2016;

UPDATE  t
   SET  t.CurrentSequence = b.MaxSequence,
        t.UpdatedDate     = GETDATE()
FROM    dbo.tProjectIdSequence t
JOIN    #Buckets b
          ON  b.CategoryId  = t.CategoryId
          AND b.Suffix      = t.Suffix
          AND b.IslandCode  = t.IslandCode
          AND b.YearStart   = t.YearStart
WHERE   t.CurrentSequence < b.MaxSequence;

PRINT CONCAT('Advanced ', @@ROWCOUNT, ' ProjectId bucket(s) past the sample data.');

/*  A bucket the allocator has never seen is the worse case: it would initialise
    at Minimum-1 and collide from its very first id. */
INSERT INTO dbo.tProjectIdSequence (CategoryId, Suffix, IslandCode, YearStart, CurrentSequence, UpdatedDate)
SELECT  b.CategoryId, b.Suffix, b.IslandCode, b.YearStart, b.MaxSequence, GETDATE()
FROM    #Buckets b
WHERE   NOT EXISTS (
            SELECT 1 FROM dbo.tProjectIdSequence t
            WHERE t.CategoryId = b.CategoryId AND t.Suffix     = b.Suffix
              AND t.IslandCode = b.IslandCode AND t.YearStart  = b.YearStart);

PRINT CONCAT('Created ', @@ROWCOUNT, ' ProjectId bucket(s) the allocator had never seen.');

PRINT '--- ProjectId buckets (each must be >= the sample maximum) ---';
SELECT  b.CategoryId, b.Suffix, b.IslandCode, b.YearStart,
        b.MaxSequence, t.CurrentSequence,
        CASE WHEN t.CurrentSequence >= b.MaxSequence
             THEN 'OK' ELSE '*** NEXT CREATE WILL COLLIDE ***' END AS Verdict
FROM    #Buckets b
LEFT JOIN dbo.tProjectIdSequence t
          ON  t.CategoryId  = b.CategoryId AND t.Suffix    = b.Suffix
          AND t.IslandCode  = b.IslandCode AND t.YearStart = b.YearStart
ORDER BY b.CategoryId, b.Suffix, b.IslandCode, b.YearStart;

DROP TABLE #Buckets;
GO

/*  IDENTITY_INSERT does not always leave the identity counter above the values
    it wrote. Where it does not, the NEXT ordinary insert reuses an Id that is
    already taken and fails on the primary key — a failure that would surface
    much later, in CreateLumpSum, looking nothing like a data-load problem. */
PRINT '--- identity seeds (each must be >= its MAX) ---';

SELECT TableName, Seed, MaxId,
       CASE WHEN Seed >= MaxId THEN 'OK' ELSE '*** NEXT INSERT WILL COLLIDE ***' END AS Verdict
FROM (
    SELECT 'tProjects' AS TableName, CAST(IDENT_CURRENT('dbo.tProjects') AS bigint) AS Seed,
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjects) AS MaxId
    UNION ALL SELECT 'tProjectRevisions', CAST(IDENT_CURRENT('dbo.tProjectRevisions') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectRevisions)
    UNION ALL SELECT 'tProjectComponentCost', CAST(IDENT_CURRENT('dbo.tProjectComponentCost') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectComponentCost)
    UNION ALL SELECT 'tProjectComponentCostPerYear', CAST(IDENT_CURRENT('dbo.tProjectComponentCostPerYear') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectComponentCostPerYear)
    UNION ALL SELECT 'tProjectFundingProfile', CAST(IDENT_CURRENT('dbo.tProjectFundingProfile') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectFundingProfile)
    UNION ALL SELECT 'tProjectStages', CAST(IDENT_CURRENT('dbo.tProjectStages') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectStages)
    UNION ALL SELECT 'tProjectMajorWorkItem', CAST(IDENT_CURRENT('dbo.tProjectMajorWorkItem') AS bigint),
           (SELECT ISNULL(MAX(Id),0) FROM dbo.tProjectMajorWorkItem)
) x
ORDER BY TableName;
GO

/*  Cross-database proof: every copied row must point where MyMYPS points it.
    Orphan checks cannot catch a reference that resolves to the WRONG row — an
    Id that happened to exist here already would satisfy every check above while
    silently attaching a cost to another project's revision. */
PRINT '--- chain matches the source (every count must be 0) ---';

SELECT
    (SELECT COUNT(*) FROM dbo.tProjectRevisions d
      JOIN MyMYPS.dbo.tProjectRevisions s ON s.Id = d.Id
     WHERE d.ProjectFK IN (SELECT ProjectPK FROM #Sample) AND d.ProjectFK <> s.ProjectFK)
                                                            AS RevisionsPointingElsewhere,
    (SELECT COUNT(*) FROM dbo.tProjectComponentCost d
      JOIN MyMYPS.dbo.tProjectComponentCost s ON s.Id = d.Id
     WHERE d.ProjectRevisionFK IN (SELECT Id FROM #Rev) AND d.ProjectRevisionFK <> s.ProjectRevisionFK)
                                                            AS CostsPointingElsewhere,
    (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear d
      JOIN MyMYPS.dbo.tProjectComponentCostPerYear s ON s.Id = d.Id
     WHERE d.ComponentCostFK IN (SELECT Id FROM #Cost) AND d.ComponentCostFK <> s.ComponentCostFK)
                                                            AS PerYearPointingElsewhere;
GO

SET NOEXEC OFF;
GO
PRINT 'LumpSum.SampleData.Dev.sql complete.';
GO
