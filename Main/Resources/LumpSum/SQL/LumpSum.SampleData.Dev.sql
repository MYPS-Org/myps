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

   IDENTITIES ARE REMAPPED. Every table here has an identity Id; the copy lets
   each one allocate its own and rewrites the foreign keys as it goes, so the
   sample lands on any database regardless of what Ids are already taken.

   It used to preserve them with IDENTITY_INSERT, on the premise that "every
   source Id in this sample sits above this database's MAX". True of
   myps_db_dev; false of myps_db_dev_200, which has grown past MyMYPS's range —
   the script refused there with "Identity collision on 21 row(s)" (2026-09-13).
   Remapping removes the premise rather than asserting it.

   What is NOT remapped is what anything actually keys on: ProjectPK, ProjectId
   and ParentProjectId are strings and are copied verbatim, so children still
   find their parents and the pinned list in e2e/tests/helpers/lumpSumSweeper.ts
   still finds the sample.

   THE PROGRAM COMES TOO, if this database does not have it. All three parents
   sit in one program; without it they surface nowhere, because every Lump Sum
   view joins through the program for its stage and start year.

   Idempotent: re-running deletes the sample and re-copies it. Deletes are scoped
   to exactly the ProjectPKs listed below and nothing else; the program is left
   alone once present.
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

/* -- 2. Bring the sample's PROGRAM over if this database has none ------------
   The three parents all sit in one program. myps_db_dev has it; myps_db_dev_200
   — a different lineage — does not, and a project whose ProgramFK matches no
   tPrograms row surfaces nowhere: every Lump Sum view joins through the program
   for its stage and its start year.

   Copied faithfully, at the TF-R stage it really holds. That stage is NOT
   itemizable, so e2e's programOnStage() will never hand this program to a spec
   that needs a revision stage — the sample exists to be read, and specs that
   itemize provision their own parent in a program of their own choosing.

   Skipped entirely when the program is already present, so a re-run neither
   duplicates it nor disturbs a program this database already had.
   ---------------------------------------------------------------------------- */
DECLARE @ProgramPK nvarchar(200) =
    (SELECT TOP 1 p.ProgramFK
     FROM   MyMYPS.dbo.tProjects p
     WHERE  p.ProjectPK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1));

IF OBJECT_ID('tempdb..#ProgRevMap') IS NOT NULL DROP TABLE #ProgRevMap;
CREATE TABLE #ProgRevMap (OldId int PRIMARY KEY, NewId int NOT NULL);

IF @ProgramPK IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.tPrograms WHERE ProgramPK = @ProgramPK)
BEGIN
    PRINT CONCAT('Program ', @ProgramPK, ' is absent here; copying it.');

    DECLARE @pCols nvarchar(max), @pSel nvarchar(max), @pVals nvarchar(max), @pSql nvarchar(max);

    /*  tPrograms — nothing references tPrograms.Id, so a plain insert will do. */
    SELECT @pCols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @pSel  = STRING_AGG('s.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.tPrograms')
      AND  c.is_computed = 0 AND c.name <> 'Id'
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
                   WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tPrograms') AND x.name = c.name);

    SET @pSql = 'INSERT INTO dbo.tPrograms (' + @pCols + ') SELECT ' + @pSel +
                ' FROM MyMYPS.dbo.tPrograms s WHERE s.ProgramPK = @pk;';
    EXEC sp_executesql @pSql, N'@pk nvarchar(200)', @pk = @ProgramPK;

    /*  tProgramRevisions — MERGE, because only MERGE's OUTPUT can emit a source
        column beside inserted.Id. A plain INSERT ... OUTPUT cannot, so there
        would be no way to tie each new Id back to the one it replaced. */
    SELECT @pCols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @pSel  = STRING_AGG('s.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @pVals = STRING_AGG('src.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.tProgramRevisions')
      AND  c.is_computed = 0 AND c.name <> 'Id'
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
                   WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProgramRevisions') AND x.name = c.name);

    SET @pSql =
        'MERGE dbo.tProgramRevisions AS tgt ' +
        'USING (SELECT ' + @pSel + ', s.Id AS SrcId FROM MyMYPS.dbo.tProgramRevisions s ' +
        '       WHERE s.ProgramFK = @pk) AS src ON (1 = 0) ' +
        'WHEN NOT MATCHED THEN INSERT (' + @pCols + ') VALUES (' + @pVals + ') ' +
        'OUTPUT src.SrcId, inserted.Id INTO #ProgRevMap (OldId, NewId);';
    EXEC sp_executesql @pSql, N'@pk nvarchar(200)', @pk = @ProgramPK;

    /*  tProgramStages — RevisionId follows the map above. */
    SELECT @pCols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @pSel  = STRING_AGG(CASE c.name WHEN 'RevisionId' THEN 'rm.NewId AS ' + QUOTENAME(c.name)
                                           ELSE 's.' + QUOTENAME(c.name) END, ', ')
                    WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.tProgramStages')
      AND  c.is_computed = 0 AND c.name <> 'Id'
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
                   WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProgramStages') AND x.name = c.name);

    SET @pSql = 'INSERT INTO dbo.tProgramStages (' + @pCols + ') SELECT ' + @pSel +
                ' FROM MyMYPS.dbo.tProgramStages s' +
                ' JOIN #ProgRevMap rm ON rm.OldId = s.RevisionId' +
                ' WHERE s.ProgramFK = @pk;';
    EXEC sp_executesql @pSql, N'@pk nvarchar(200)', @pk = @ProgramPK;

    PRINT '  program, its revision and its stage copied.';
END
ELSE
    PRINT CONCAT('Program ', ISNULL(@ProgramPK, '(none)'), ' already present; not copied.');
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

/*  NO ORPHAN SWEEP HERE, DELIBERATELY.

    This used to end with an unscoped

        DELETE mw FROM dbo.tProjectMajorWorkItem mw
        WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjectComponentCost cc
                          WHERE cc.Id = mw.ComponentCostFK);

    — every orphaned work item in the DATABASE, not just the sample's, which is
    far outside what a fixture script may touch and contradicted this section's
    own "scoped to the sample's own keys only" (code review, 2026-09-13).

    It existed only to serve preserved identities: a work item stranded by some
    earlier bug still occupied an Id, so re-copying with IDENTITY_INSERT hit
    "Violation of PRIMARY KEY constraint 'PK_tProjectMajorWorkItem'". Section 4
    now lets the identity allocate, so a stranded row cannot collide with
    anything and there is nothing to sweep. Rows orphaned by other bugs are
    someone else's to clean up, knowingly. */

/* -- 4. Copy, parents and children together ---------------------------------
   Column lists are still built from the INTERSECTION of the two schemas, so a
   column present in one and not the other (MyMYPS has MCAScore and
   DataImportProgramId where this database has DataImportId, today) cannot break
   the insert. What changed is that `Id` is now dropped from every list: each
   table's identity allocates its own, and every foreign key that pointed at one
   of the old Ids is rewritten as the copy goes.

   ORDER MATTERS, because each step's map feeds the next:

       tProjects            no map — ProjectPK / ParentProjectId are strings
       tProjectRevisions    -> #RevMap
       tProjectStages       RevisionId        via #RevMap
       tProjectFundingProfile, tProjectNotes
                            ProjectRevisionFK via #RevMap
       tProjectComponentCost
                            ProjectRevisionFK via #RevMap  -> #CostMap
       tProjectComponentCostPerYear, tProjectMajorWorkItem
                            ComponentCostFK   via #CostMap

   MERGE, not INSERT, wherever a map is produced: only MERGE's OUTPUT clause can
   emit a source column beside inserted.Id, which is what ties each new row back
   to the one it came from. INSERT ... OUTPUT sees only the inserted row.

   Spelled out per table rather than driven by one cursor, because each step now
   has a different join and a different map — the order above IS the logic, and
   hiding it inside a loop would make it unreadable.
   ---------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#RevMap')  IS NOT NULL DROP TABLE #RevMap;
IF OBJECT_ID('tempdb..#CostMap') IS NOT NULL DROP TABLE #CostMap;
CREATE TABLE #RevMap  (OldId int PRIMARY KEY, NewId int NOT NULL);
CREATE TABLE #CostMap (OldId int PRIMARY KEY, NewId int NOT NULL);

DECLARE @T sysname, @Cols nvarchar(max), @Sel nvarchar(max), @Vals nvarchar(max),
        @Sql nvarchar(max), @Copied int;

/* 4.1 tProjects. */
SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
       @Sel  = STRING_AGG('s.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
FROM   sys.columns c
WHERE  c.object_id = OBJECT_ID('dbo.tProjects') AND c.is_computed = 0 AND c.name <> 'Id'
  AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
               WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProjects') AND x.name = c.name);

SET @Sql = 'INSERT INTO dbo.tProjects (' + @Cols + ') SELECT ' + @Sel +
           ' FROM MyMYPS.dbo.tProjects s WHERE s.ProjectPK IN (SELECT ProjectPK FROM #Sample);' +
           ' SET @OutRows = @@ROWCOUNT;';
EXEC sp_executesql @Sql, N'@OutRows int OUTPUT', @OutRows = @Copied OUTPUT;
PRINT CONCAT('  copied ', @Copied, ' row(s) into tProjects');

/* 4.2 tProjectRevisions — produces #RevMap. */
SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
       @Sel  = STRING_AGG('s.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
       @Vals = STRING_AGG('src.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
FROM   sys.columns c
WHERE  c.object_id = OBJECT_ID('dbo.tProjectRevisions') AND c.is_computed = 0 AND c.name <> 'Id'
  AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
               WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProjectRevisions') AND x.name = c.name);

SET @Sql =
    'MERGE dbo.tProjectRevisions AS tgt ' +
    'USING (SELECT ' + @Sel + ', s.Id AS SrcId FROM MyMYPS.dbo.tProjectRevisions s ' +
    '       WHERE s.ProjectFK IN (SELECT ProjectPK FROM #Sample)) AS src ON (1 = 0) ' +
    'WHEN NOT MATCHED THEN INSERT (' + @Cols + ') VALUES (' + @Vals + ') ' +
    'OUTPUT src.SrcId, inserted.Id INTO #RevMap (OldId, NewId);';
EXEC sp_executesql @Sql;
SELECT @Copied = COUNT(*) FROM #RevMap;
PRINT CONCAT('  copied ', @Copied, ' row(s) into tProjectRevisions');

/* 4.3 tProjectStages — RevisionId follows #RevMap. */
SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
       @Sel  = STRING_AGG(CASE c.name WHEN 'RevisionId' THEN 'rm.NewId AS ' + QUOTENAME(c.name)
                                      ELSE 's.' + QUOTENAME(c.name) END, ', ')
               WITHIN GROUP (ORDER BY c.column_id)
FROM   sys.columns c
WHERE  c.object_id = OBJECT_ID('dbo.tProjectStages') AND c.is_computed = 0 AND c.name <> 'Id'
  AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
               WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProjectStages') AND x.name = c.name);

SET @Sql = 'INSERT INTO dbo.tProjectStages (' + @Cols + ') SELECT ' + @Sel +
           ' FROM MyMYPS.dbo.tProjectStages s JOIN #RevMap rm ON rm.OldId = s.RevisionId' +
           ' WHERE s.ProjectFK IN (SELECT ProjectPK FROM #Sample);' +
           ' SET @OutRows = @@ROWCOUNT;';
EXEC sp_executesql @Sql, N'@OutRows int OUTPUT', @OutRows = @Copied OUTPUT;
PRINT CONCAT('  copied ', @Copied, ' row(s) into tProjectStages');

/* 4.4 tProjectFundingProfile and tProjectNotes — ProjectRevisionFK via #RevMap.
       The join to the map also scopes the copy: only revisions this run created
       are in it, so no WHERE on #Sample is needed. */
DECLARE RevChild CURSOR LOCAL FAST_FORWARD FOR
SELECT 'tProjectFundingProfile' UNION ALL SELECT 'tProjectNotes';
OPEN RevChild;
FETCH NEXT FROM RevChild INTO @T;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @Sel  = STRING_AGG(CASE c.name WHEN 'ProjectRevisionFK' THEN 'rm.NewId AS ' + QUOTENAME(c.name)
                                          ELSE 's.' + QUOTENAME(c.name) END, ', ')
                   WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.' + @T) AND c.is_computed = 0 AND c.name <> 'Id'
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
                   WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.' + @T) AND x.name = c.name);

    SET @Sql = 'INSERT INTO dbo.' + QUOTENAME(@T) + ' (' + @Cols + ') SELECT ' + @Sel +
               ' FROM MyMYPS.dbo.' + QUOTENAME(@T) + ' s' +
               ' JOIN #RevMap rm ON rm.OldId = s.ProjectRevisionFK;' +
               ' SET @OutRows = @@ROWCOUNT;';
    EXEC sp_executesql @Sql, N'@OutRows int OUTPUT', @OutRows = @Copied OUTPUT;
    PRINT CONCAT('  copied ', @Copied, ' row(s) into ', @T);

    FETCH NEXT FROM RevChild INTO @T;
END
CLOSE RevChild;
DEALLOCATE RevChild;

/* 4.5 tProjectComponentCost — remaps ProjectRevisionFK, produces #CostMap. */
SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
       @Sel  = STRING_AGG(CASE c.name WHEN 'ProjectRevisionFK' THEN 'rm.NewId AS ' + QUOTENAME(c.name)
                                      ELSE 's.' + QUOTENAME(c.name) END, ', ')
               WITHIN GROUP (ORDER BY c.column_id),
       @Vals = STRING_AGG('src.' + QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id)
FROM   sys.columns c
WHERE  c.object_id = OBJECT_ID('dbo.tProjectComponentCost') AND c.is_computed = 0 AND c.name <> 'Id'
  AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
               WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.tProjectComponentCost') AND x.name = c.name);

SET @Sql =
    'MERGE dbo.tProjectComponentCost AS tgt ' +
    'USING (SELECT ' + @Sel + ', s.Id AS SrcId FROM MyMYPS.dbo.tProjectComponentCost s ' +
    '       JOIN #RevMap rm ON rm.OldId = s.ProjectRevisionFK) AS src ON (1 = 0) ' +
    'WHEN NOT MATCHED THEN INSERT (' + @Cols + ') VALUES (' + @Vals + ') ' +
    'OUTPUT src.SrcId, inserted.Id INTO #CostMap (OldId, NewId);';
EXEC sp_executesql @Sql;
SELECT @Copied = COUNT(*) FROM #CostMap;
PRINT CONCAT('  copied ', @Copied, ' row(s) into tProjectComponentCost');

/* 4.6 tProjectComponentCostPerYear and tProjectMajorWorkItem — ComponentCostFK
       via #CostMap. Neither table has a foreign key to the cost row; the
       reference is convention only, which is precisely why section 6 re-checks
       it rather than trusting it. */
DECLARE CostChild CURSOR LOCAL FAST_FORWARD FOR
SELECT 'tProjectComponentCostPerYear' UNION ALL SELECT 'tProjectMajorWorkItem';
OPEN CostChild;
FETCH NEXT FROM CostChild INTO @T;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @Cols = STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY c.column_id),
           @Sel  = STRING_AGG(CASE c.name WHEN 'ComponentCostFK' THEN 'cm.NewId AS ' + QUOTENAME(c.name)
                                          ELSE 's.' + QUOTENAME(c.name) END, ', ')
                   WITHIN GROUP (ORDER BY c.column_id)
    FROM   sys.columns c
    WHERE  c.object_id = OBJECT_ID('dbo.' + @T) AND c.is_computed = 0 AND c.name <> 'Id'
      AND  EXISTS (SELECT 1 FROM MyMYPS.sys.columns x
                   WHERE x.object_id = OBJECT_ID('MyMYPS.dbo.' + @T) AND x.name = c.name);

    SET @Sql = 'INSERT INTO dbo.' + QUOTENAME(@T) + ' (' + @Cols + ') SELECT ' + @Sel +
               ' FROM MyMYPS.dbo.' + QUOTENAME(@T) + ' s' +
               ' JOIN #CostMap cm ON cm.OldId = s.ComponentCostFK;' +
               ' SET @OutRows = @@ROWCOUNT;';
    EXEC sp_executesql @Sql, N'@OutRows int OUTPUT', @OutRows = @Copied OUTPUT;
    PRINT CONCAT('  copied ', @Copied, ' row(s) into ', @T);

    FETCH NEXT FROM CostChild INTO @T;
END
CLOSE CostChild;
DEALLOCATE CostChild;

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

/* -- 4e. Bring the copied parents onto the current allocation model ----------
   MyMYPS stores these rows as they were BEFORE two migrations this repo has
   since applied, so a straight copy lands pre-V2 data in a V2 database:

     1. ComponentId 'LS1' -> 'LS'  (LumpSum.ComponentMigration.sql)
        A Lump Sum Project holds exactly one component, so the Civil Works
        running number never meant anything. ComponentId is denormalised onto
        tProjectComponentCostPerYear as well, so both tables move together.

     2. The allocation and the balance swap places
        (LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql)
        Until 2026-09-06 the component Total WAS the remaining balance. The
        model now reads:

            LS component Total  = the FULL allocation = SUM of live funding lines
            LS per-year Amount  = the REMAINING balance = Total - SUM of children

        MyMYPS's parents carry Total 36,000,000 against 180,000,000 of funding,
        so vLumpSumSet reports OriginalAllocation 36,000,000 beneath an
        ItemizedTotal of 144,000,000 and section 5's invariant reports DRIFT.

   WHY HERE AND NOT BY RUNNING THOSE SCRIPTS. Neither exists on this branch, and
   both sweep every Lump Sum row in the database — which on a database whose only
   Lump Sum data is this sample is the same thing, but stops being so the moment
   someone creates a project. Scoped to #Sample, stated where the copy happens,
   for the same reason 4b-4d are: so a re-run cannot reintroduce what it fixed.

   Idempotent: each UPDATE is written against its own post-condition, so a second
   run matches nothing.
   ---------------------------------------------------------------------------- */
UPDATE cc
   SET cc.ComponentId = 'LS'
  FROM dbo.tProjectComponentCost cc
  JOIN dbo.tProjectRevisions r ON r.Id = cc.ProjectRevisionFK
 WHERE r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
   AND cc.ComponentId = 'LS1';

PRINT CONCAT('Component ''LS1'' -> ''LS'' on ', @@ROWCOUNT, ' parent cost row(s).');

UPDATE py
   SET py.ComponentId = 'LS'
  FROM dbo.tProjectComponentCostPerYear py
  JOIN dbo.tProjectComponentCost cc ON cc.Id = py.ComponentCostFK
  JOIN dbo.tProjectRevisions r      ON r.Id = cc.ProjectRevisionFK
 WHERE r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
   AND py.ComponentId = 'LS1';

PRINT CONCAT('                     and on ', @@ROWCOUNT, ' per-year row(s).');

/*  Total := SUM of the parent's own live funding lines. Only the parent's LIVE
    'LS' component on its live revision, and only where the two disagree. */
;WITH Parent AS (
    SELECT cc.Id            AS CostId,
           Funding = (SELECT ISNULL(SUM(f.Amount), 0)
                      FROM   dbo.tProjectFundingProfile f
                      WHERE  f.ProjectRevisionFK = r.Id AND f.IsDeleted = 0)
    FROM   dbo.tProjectRevisions r
    JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = r.Id AND cc.IsDeleted = 0
    WHERE  r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
      AND  r.IsDeleted = 0
      AND  cc.ComponentId = 'LS'
)
UPDATE cc
   SET cc.Total = pa.Funding
  FROM dbo.tProjectComponentCost cc
  JOIN Parent pa ON pa.CostId = cc.Id
 WHERE pa.Funding > 0 AND cc.Total <> pa.Funding;

PRINT CONCAT('Allocation set from the funding lines on ', @@ROWCOUNT, ' parent cost row(s).');

/*  Amount := Total - SUM of the children's costs. Left alone unless it differs,
    so a parent whose balance is already right is untouched. */
;WITH ParentYear AS (
    SELECT py.Id             AS YearId,
           Remaining = cc.Total - (
                SELECT ISNULL(SUM(kc.Total), 0)
                FROM   dbo.tProjects k
                JOIN   dbo.tProjectRevisions kr ON kr.ProjectFK = k.ProjectPK AND kr.IsDeleted = 0
                JOIN   dbo.tProjectComponentCost kc ON kc.ProjectRevisionFK = kr.Id AND kc.IsDeleted = 0
                WHERE  k.ParentProjectId = r.ProjectId)
    FROM   dbo.tProjectRevisions r
    JOIN   dbo.tProjectComponentCost cc        ON cc.ProjectRevisionFK = r.Id AND cc.IsDeleted = 0
    JOIN   dbo.tProjectComponentCostPerYear py ON py.ComponentCostFK = cc.Id AND py.IsDeleted = 0
    WHERE  r.ProjectFK IN (SELECT ProjectPK FROM #Sample WHERE IsParent = 1)
      AND  r.IsDeleted = 0
      AND  cc.ComponentId = 'LS'
)
UPDATE py
   SET py.Amount = pyr.Remaining
  FROM dbo.tProjectComponentCostPerYear py
  JOIN ParentYear pyr ON pyr.YearId = py.Id
 WHERE py.Amount <> pyr.Remaining;

PRINT CONCAT('Remaining balance set on ', @@ROWCOUNT, ' per-year row(s).');
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
   silently. Section 4 rewrites every one of those references as it copies, and
   a remap that drops a row links it to nothing at all; that the chain came
   through intact is a claim worth testing rather than asserting, so test it.

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
    Id that exists here for unrelated reasons would satisfy every check above
    while silently attaching a cost to another project's revision.

    COMPARED THROUGH THE MAPS, not by Id. Section 4 remaps every identity, so
    joining source to copy on s.Id = d.Id no longer compares a row with itself:
    it compares a copied row with whatever unrelated MyMYPS row happens to hold
    its new number, and reports nonsense. #RevMap and #CostMap are the only
    honest way to line the two databases up. */
PRINT '--- chain matches the source (every count must be 0) ---';

SELECT
    /*  Each copied revision hangs off the same project as its source. */
    (SELECT COUNT(*)
     FROM   #RevMap m
     JOIN   dbo.tProjectRevisions        d ON d.Id = m.NewId
     JOIN   MyMYPS.dbo.tProjectRevisions s ON s.Id = m.OldId
     WHERE  d.ProjectFK <> s.ProjectFK)                     AS RevisionsPointingElsewhere,

    /*  Each copied cost hangs off the copy of the revision its source did. */
    (SELECT COUNT(*)
     FROM   #CostMap m
     JOIN   dbo.tProjectComponentCost        d ON d.Id = m.NewId
     JOIN   MyMYPS.dbo.tProjectComponentCost s ON s.Id = m.OldId
     JOIN   #RevMap rm ON rm.OldId = s.ProjectRevisionFK
     WHERE  d.ProjectRevisionFK <> rm.NewId)                AS CostsPointingElsewhere,

    /*  The per-year and work-item rows carry no map of their own — they have no
        natural key to rebuild one from — so they are compared by COUNT PER COST:
        every cost must have gathered exactly as many rows here as it has there.
        A row that landed on the wrong cost shows up as two mismatched costs. */
    (SELECT COUNT(*)
     FROM   #CostMap m
     WHERE (SELECT COUNT(*) FROM dbo.tProjectComponentCostPerYear cy
             WHERE cy.ComponentCostFK = m.NewId)
        <> (SELECT COUNT(*) FROM MyMYPS.dbo.tProjectComponentCostPerYear cy
             WHERE cy.ComponentCostFK = m.OldId))           AS PerYearPointingElsewhere,

    (SELECT COUNT(*)
     FROM   #CostMap m
     WHERE (SELECT COUNT(*) FROM dbo.tProjectMajorWorkItem mw
             WHERE mw.ComponentCostFK = m.NewId)
        <> (SELECT COUNT(*) FROM MyMYPS.dbo.tProjectMajorWorkItem mw
             WHERE mw.ComponentCostFK = m.OldId))           AS WorkItemsPointingElsewhere;
GO

SET NOEXEC OFF;
GO
PRINT 'LumpSum.SampleData.Dev.sql complete.';
GO
