/* #############################################################################
   Migration - PROGRAM COST on the PRODUCTION COPY (localhost / myps_db_dpwh)
   Target:  localhost / myps_db_dpwh      Written: 2026-09-20
   Status:  NOT RUN. Written, parse-checked, and its read-only sections executed
            against this database; the objects themselves have not been replaced
            here. Running it is a separate, deliberate decision.
   -----------------------------------------------------------------------------
   WHAT THIS DOES, in one file: replaces the two objects that report a program's
   cost - dbo.fProgramStages (the program LIST, per stage) and
   dbo.pRecomputeProgramCost (writes tProgramRevisions.Cost, which Program
   Details shows) - and adds the three indexes they read through. Optional
   backfill in section 6, off by default.

   THE RULE IT INSTALLS:
     - an ordinary project counts at the program's current stage, from its
       per-year rows (tProjectComponentCostPerYear): one distinct Year counts
       whatever the year; several count only the program year;
     - at GAA-R only, an ordinary project with an effective approved Formal
       Revision is read from that revision's tRevision* per-year rows instead of
       its base ones (RISK-108). "Effective" is dbo.fProjectFundingProfile's own
       predicate: latest RO- and CO-approved tRevisionDetails on the project's
       stage revision, project published, no stage row at a higher
       StageHierarchy;
     - a Lump Sum parent counts ONLY the Total of its live 'LS' component on its
       latest live revision, at ANY stage - never its per-year rows;
     - an itemized child never counts.
   See documents/docs/engineering/MYPS_PROGRAM_COST_RECOMPUTE_SLOW_RCA.md.

   WHAT IT WILL DO TO THIS DATABASE, measured here on 2026-09-20 by running the
   new bodies under temporary names inside a rolled-back transaction:

     - This database currently runs the FUNDING-BASED bodies (dev-trunk, with
       the RISK-108 fix): program cost is the sum of funding profiles. The new
       rule reads per-year component costs instead, so figures move wherever a
       project's funding lines and its component costs disagree.
     - 3 of 32 programs move, all downward, by 550,030,026,000 in total:
         LAPTOP-DG33KKDI-local_09102026_093043   1,160,000,000,000 ->   770,000,000,000
         LAPTOP-DG33KKDI_09102026_152436           420,029,488,000 ->   260,014,475,000
         ferrermaa_09182026_153720                      29,488,000 ->        14,475,000
       Each is one or more projects funded above what their components cost -
       e.g. BP01093001LZ carries 450,000,000,000 of funding against
       60,000,000,000 of component cost at the program year. No multi-year
       effect: every project here holds a single distinct year.
     - The GAA-R overlay finds 6 projects with an effective approved revision
       (of 8 revision records, 7 fully approved). None of them moves a figure:
       each revision carries the same per-year total as its base today. 17 of
       the 32 programs sit at GAA-R, so the overlay is live here even though it
       is currently a no-op.
     - No program overflows tProgramRevisions.Cost (decimal(18,5)); section 2
       re-checks and aborts if that ever changes.
     - The procedure and the list function agree on all 32 programs.
     - Stored costs are ALREADY stale against the current rule on several
       programs (for example jimeneznr_09162026_144613 stores 0 against a live
       figure of 120,300,000). The three figures above are CURRENT RULE ->
       NEW RULE, which is what this deployment changes. Sections 2 and 5 compare
       against the STORED figure instead, so their tables also show staleness
       this script did not cause - four programs there move only because nothing
       had recomputed them yet.

   WHAT IT DOES NOT DO. No data change unless @RunBackfill is set in section 6.
   No other object. No server but localhost: the guard below refuses every
   database but myps_db_dpwh, and this database name exists only here.

   HOW TO RUN IT, when that decision is made. From the repository root:

     sqlcmd -S localhost -d myps_db_dpwh -E -C -b -I -f 65001
            -i Main/Resources/Internal/SQLScripts/Migration.ProgramCost.Dpwh.2026-09-20.sql
            -o <somewhere safe>\dpwh-program-cost-run.txt

   -I (QUOTED_IDENTIFIER ON) is required for the filtered indexes. -b stops at
   the first error. KEEP THE -o FILE: section 1 prints this database's current
   definitions of both objects into it, which is a second rollback beside the
   two files named below.

   Every refusal below also sets NOEXEC ON, so the rest of the file is parsed
   but not executed - for any login, not only a sysadmin, and whether or not -b
   is given (the 2026-09-20 guard review).

   LOCKING. The three CREATE INDEX statements build offline and block writes to
   their table while they run. This database is small (204 component costs, 204
   per-year rows), so they are near-instant here.

   ROLLBACK. Run, from this folder, in either order:
     pRecomputeProgramCost_backup_dpwh_pre_programcost_20260920.sql
     fProgramStages_backup_dpwh_pre_programcost_20260920.sql
   Both carry this database's definitions as captured on 2026-09-20
   (checksums 774742430 and 867969802). The indexes are additive and can stay.
   To remove them anyway:
     DROP INDEX IF EXISTS IX_tProjectStages_ProgramFK_StageId        ON dbo.tProjectStages;
     DROP INDEX IF EXISTS IX_tProjectComponentCost_Revision_Live     ON dbo.tProjectComponentCost;
     DROP INDEX IF EXISTS IX_tProjectComponentCostPerYear_Cost_Live  ON dbo.tProjectComponentCostPerYear;

   PROVENANCE. Sections 3 and 4 are byte-for-byte section 6b and section 11 of
   Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql,
   as deployed and tested on localhost myps_db_dev_200. Do not edit them here;
   edit the source and re-cut.
   ############################################################################# */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0. GUARD - refuse to run anywhere but localhost myps_db_dpwh
   -----------------------------------------------------------------------------
   The database name is the only thing this script can check. myps_db_dpwh is a
   COPY OF PRODUCTION: treat a refusal as a stop, not an obstacle, and never
   point this at a server that is not localhost.

   Severity 16 + SET NOEXEC ON, not RAISERROR(..., 20, 1) WITH LOG: severity 20
   ends the connection only for a sysadmin, and for any other login raises
   Msg 2778 and lets execution continue (measured 2026-09-20).
   ============================================================================= */
IF DB_NAME() <> N'myps_db_dpwh'
BEGIN
    DECLARE @db NVARCHAR(128) = DB_NAME();
    RAISERROR('REFUSED: this script is for localhost myps_db_dpwh only. Connected to %s. Nothing below will execute; run SET NOEXEC OFF or reconnect before reusing this session.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

/* =============================================================================
   1. PREFLIGHT - record what is there before anything changes
   -----------------------------------------------------------------------------
   The full current text of both objects is printed line by line, so the -o
   file holds a rollback whatever sqlcmd's column-width settings are.
   ============================================================================= */
PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));

SELECT OBJECT_NAME(o.object_id)                      AS [object],
       o.modify_date,
       CHECKSUM(OBJECT_DEFINITION(o.object_id))      AS definition_checksum,
       CASE OBJECT_NAME(o.object_id)
            WHEN 'pRecomputeProgramCost' THEN CASE WHEN CHECKSUM(OBJECT_DEFINITION(o.object_id)) = 774742430 THEN 'yes' ELSE 'NO - use the text printed below' END
            WHEN 'fProgramStages'        THEN CASE WHEN CHECKSUM(OBJECT_DEFINITION(o.object_id)) = 867969802 THEN 'yes' ELSE 'NO - use the text printed below' END
       END                                           AS matches_20260920_rollback_files
FROM   sys.objects o
WHERE  o.object_id IN (OBJECT_ID('dbo.pRecomputeProgramCost'), OBJECT_ID('dbo.fProgramStages'));
GO

DECLARE @name SYSNAME, @def NVARCHAR(MAX), @pos INT, @nl INT;
DECLARE obj CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM (VALUES (N'pRecomputeProgramCost'), (N'fProgramStages')) v(name);
OPEN obj;
FETCH NEXT FROM obj INTO @name;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @def = REPLACE(OBJECT_DEFINITION(OBJECT_ID(N'dbo.' + @name)), CHAR(13), N'');
    PRINT N'/* ======== ROLLBACK TEXT: current dbo.' + @name + N' (change CREATE to CREATE OR ALTER) ======== */';
    IF @def IS NULL
        PRINT N'-- (object does not exist)';
    ELSE
    BEGIN
        SET @pos = 1;
        WHILE @pos <= LEN(@def + N'x') - 1
        BEGIN
            SET @nl = CHARINDEX(NCHAR(10), @def, @pos);
            IF @nl = 0 SET @nl = LEN(@def + N'x');
            PRINT SUBSTRING(@def, @pos, @nl - @pos);
            SET @pos = @nl + 1;
        END
    END
    PRINT N'GO';
    PRINT N'/* ======== END ROLLBACK TEXT: dbo.' + @name + N' ======== */';
    FETCH NEXT FROM obj INTO @name;
END
CLOSE obj;
DEALLOCATE obj;
GO

SELECT t.name AS [table], i.name AS [index], i.has_filter, i.filter_definition,
       STRING_AGG(CASE WHEN ic.is_included_column = 0 THEN c.name END, ',')
           WITHIN GROUP (ORDER BY ic.key_ordinal)    AS keys,
       STRING_AGG(CASE WHEN ic.is_included_column = 1 THEN c.name END, ',') AS includes
FROM   sys.indexes i
JOIN   sys.tables t         ON t.object_id = i.object_id
JOIN   sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN   sys.columns c        ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE  t.name IN ('tProjectStages', 'tProjectComponentCost', 'tProjectComponentCostPerYear')
GROUP  BY t.name, i.name, i.has_filter, i.filter_definition
ORDER  BY t.name, i.name;
GO

/* =============================================================================
   2. PREFLIGHT - which programs the new rule would overflow
   -----------------------------------------------------------------------------
   dbo.tProgramRevisions.Cost is decimal(18,5): it cannot hold 10 trillion or
   more. No program on this database reaches that under the new rule as of
   2026-09-20 - the largest computes about 770 billion - but the shared dev
   server has one that computes about 15.84 trillion, twice its stored figure,
   because a 2024 load doubled its component rows. Where that happens,
   pRecomputeProgramCost raises arithmetic overflow (Msg 8115) afterwards and
   every save that recomputes that program FAILS for the user.

   So this section recomputes every program's cost under the new rule,
   set-based, before anything is changed, prints it beside the stored figure,
   and stops the deployment if any would overflow - unless
   @IAcceptOverflowingPrograms is set to 1 deliberately. The ways out, before or
   after: de-duplicate the doubled rows, or widen the column to decimal(28,5).
   Both are decisions for the maintainer, not this script.

   READ THE TABLE IT PRINTS even when nothing overflows: it is the list of
   figures this deployment moves, on a copy of production.
   ============================================================================= */
DECLARE @IAcceptOverflowingPrograms BIT = 0;   -- set to 1 only with the above understood

DECLARE @MaxCost DECIMAL(38,5) = 9999999999999.99999;   -- decimal(18,5) ceiling

;WITH cur AS (
    SELECT pg.ProgramPK, pg.StartYear, pgr.Id AS PgRev, pgs.StageId,
           CASE WHEN st.[Name] = N'GAA-R' THEN 1 ELSE 0 END AS AtGaaR,
           ROW_NUMBER() OVER (PARTITION BY pg.ProgramPK ORDER BY pgr.Id DESC) AS rn
    FROM   dbo.tPrograms pg
    JOIN   dbo.tProgramRevisions pgr ON pgr.ProgramFK  = pg.ProgramPK
    JOIN   dbo.tProgramStages   pgs ON pgs.RevisionId = pgr.Id
    LEFT   JOIN dbo.tOptionProgramStage st ON st.NameId = pgs.StageId
    WHERE  pg.IsDeleted = 0
),
sr AS (
    SELECT c.ProgramPK, c.StartYear, c.StageId, c.AtGaaR, ps.ProjectFK, ps.RevisionId,
           ROW_NUMBER() OVER (PARTITION BY c.ProgramPK, ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
    FROM   cur c
    JOIN   dbo.tProjectStages ps ON ps.ProgramFK = c.ProgramPK AND ps.StageId = c.StageId
    WHERE  c.rn = 1
),
ordinary AS (          -- no Lump Sum parent, no itemized child
    SELECT sr.ProgramPK, sr.StartYear, sr.StageId, sr.AtGaaR, sr.ProjectFK, sr.RevisionId
    FROM   sr
    JOIN   dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
    WHERE  sr.rn = 1
      AND  prj.ParentProjectId IS NULL
      AND  (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
),
eff AS (               -- at GAA-R only: the approved Formal Revision a project is read from
    SELECT o.RevisionId, x.RevisionDetailId
    FROM   ordinary o
    JOIN   dbo.tProjects prj ON prj.ProjectPK = o.ProjectFK
    CROSS  APPLY (
        SELECT TOP (1) rd.Id AS RevisionDetailId
        FROM   dbo.tRevisionDetails rd
        WHERE  rd.ProjectRevisionFK = o.RevisionId
          AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                       WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'RO' AND ra.Status = 1)
          AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                       WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'CO' AND ra.Status = 1)
        ORDER  BY rd.CreatedDate DESC, rd.Id DESC
    ) x
    WHERE  o.AtGaaR = 1
      AND  ISNULL(prj.IsPublished, 0) = 1
      AND  NOT EXISTS (SELECT 1
                       FROM   dbo.tProjectStages s2
                       JOIN   dbo.tOptionProgramStage h2 ON h2.Id = s2.StageId
                       JOIN   dbo.tOptionProgramStage h1 ON h1.NameId = o.StageId
                       WHERE  s2.ProjectFK = o.ProjectFK
                         AND  h2.StageHierarchy > h1.StageHierarchy)
),
py AS (
    SELECT o.ProgramPK, o.RevisionId,
           COUNT(DISTINCT y.[Year])                                  AS Yrs,
           SUM(y.Amount)                                             AS AllYears,
           SUM(CASE WHEN y.[Year] = o.StartYear THEN y.Amount END)   AS AtYear
    FROM   ordinary o
    LEFT   JOIN eff e ON e.RevisionId = o.RevisionId
    JOIN   dbo.tProjectComponentCost cc ON cc.ProjectRevisionFK = o.RevisionId AND cc.IsDeleted = 0
    JOIN   dbo.tProjectComponentCostPerYear y ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
    WHERE  e.RevisionDetailId IS NULL
    GROUP  BY o.ProgramPK, o.RevisionId

    UNION  ALL

    SELECT o.ProgramPK, o.RevisionId,
           COUNT(DISTINCT y.[Year]),
           SUM(y.Amount),
           SUM(CASE WHEN y.[Year] = o.StartYear THEN y.Amount END)
    FROM   ordinary o
    JOIN   eff e ON e.RevisionId = o.RevisionId
    JOIN   dbo.tRevisionProjectComponentCost rcc ON rcc.RevisionDetailFK = e.RevisionDetailId AND rcc.IsDeleted = 0
    JOIN   dbo.tRevisionProjectComponentCostPerYear y ON y.RevisionComponentCostFK = rcc.Id AND y.IsDeleted = 0
    GROUP  BY o.ProgramPK, o.RevisionId
),
ordinary_cost AS (
    SELECT ProgramPK,
           SUM(CASE WHEN Yrs <= 1 THEN AllYears ELSE ISNULL(AtYear, 0) END) AS Cost
    FROM   py
    GROUP  BY ProgramPK
),
lump_sum_cost AS (     -- every parent of the program, any stage: its LS component Total
    SELECT p.ProgramFK AS ProgramPK, SUM(cc.Total) AS Cost
    FROM   dbo.tProjects p
    CROSS  APPLY (SELECT TOP 1 pr.Id FROM dbo.tProjectRevisions pr
                  WHERE pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
                  ORDER BY pr.Id DESC) lr
    JOIN   dbo.tProjectComponentCost cc
      ON   cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0 AND cc.ComponentId = N'LS'
    WHERE  p.ProjectType = N'LS' AND p.ParentProjectId IS NULL
    GROUP  BY p.ProgramFK
)
SELECT c.ProgramPK, r.Cost AS StoredCostNow,
       ISNULL(o.Cost, 0) + ISNULL(l.Cost, 0) AS CostUnderNewRule
INTO   #NewRule
FROM   cur c
JOIN   dbo.tProgramRevisions r ON r.Id = c.PgRev
LEFT   JOIN ordinary_cost o ON o.ProgramPK = c.ProgramPK
LEFT   JOIN lump_sum_cost l ON l.ProgramPK = c.ProgramPK
WHERE  c.rn = 1;

PRINT '--- every program: stored cost now vs cost under the new rule (what a recompute will store) ---';
SELECT ProgramPK, StoredCostNow, CostUnderNewRule, CostUnderNewRule - StoredCostNow AS Difference,
       CASE WHEN CostUnderNewRule > @MaxCost THEN 'OVERFLOWS decimal(18,5)' ELSE '' END AS Note
FROM   #NewRule
ORDER  BY ProgramPK;

IF EXISTS (SELECT 1 FROM #NewRule WHERE CostUnderNewRule > @MaxCost)
BEGIN
    DECLARE @n INT = (SELECT COUNT(*) FROM #NewRule WHERE CostUnderNewRule > @MaxCost);
    IF @IAcceptOverflowingPrograms = 0
    BEGIN
        RAISERROR('ABORT: %d program(s) would overflow tProgramRevisions.Cost under the new rule (marked above). De-duplicate the doubled rows, widen the column, or set @IAcceptOverflowingPrograms = 1 to deploy anyway. Nothing below will execute.', 16, 1, @n);
        SET NOEXEC ON;
    END
    ELSE
        PRINT CONCAT('PROCEEDING with ', @n, ' known-overflowing program(s), by explicit choice.');
END
ELSE
    PRINT 'PREFLIGHT: no program overflows tProgramRevisions.Cost under the new rule.';

DROP TABLE IF EXISTS #NewRule;
GO

PRINT '--- GAA-R: projects whose figure the revision overlay moves (RISK-108, 2026-09-20) ---';
/*  Read-only. Every ordinary project at a program's CURRENT stage, where that stage
    is GAA-R, that has an effective approved Formal Revision - the predicate section
    11 states - with its base figure beside its revision figure under the same
    per-year rule. A row where they differ is a program cost that will move. */
;WITH cur AS (
    SELECT pgs.ProgramFK, pgs.StageId,
           ROW_NUMBER() OVER (PARTITION BY pgs.ProgramFK ORDER BY pgs.RevisionId DESC) AS rn
    FROM   dbo.tProgramStages pgs
), gaar AS (
    SELECT cur.ProgramFK, cur.StageId
    FROM   cur
    JOIN   dbo.tOptionProgramStage st ON st.NameId = cur.StageId AND st.[Name] = N'GAA-R'
    WHERE  cur.rn = 1
), stage_rev AS (
    SELECT g.ProgramFK, ps.ProjectFK, ps.RevisionId,
           ROW_NUMBER() OVER (PARTITION BY g.ProgramFK, ps.ProjectFK ORDER BY ps.RevisionId DESC) AS rn
    FROM   gaar g
    JOIN   dbo.tProjectStages ps ON ps.ProgramFK = g.ProgramFK AND ps.StageId = g.StageId
    JOIN   dbo.tProjects prj ON prj.ProjectPK = ps.ProjectFK
    WHERE  prj.ParentProjectId IS NULL
      AND  (prj.ProjectType <> N'LS' OR prj.ProjectType IS NULL)
), eff AS (
    SELECT sr.ProgramFK, sr.ProjectFK, sr.RevisionId, x.RevisionDetailId
    FROM   stage_rev sr
    JOIN   dbo.tProjects prj ON prj.ProjectPK = sr.ProjectFK
    CROSS  APPLY (
        SELECT TOP (1) rd.Id AS RevisionDetailId
        FROM   dbo.tRevisionDetails rd
        WHERE  rd.ProjectRevisionFK = sr.RevisionId
          AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                       WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'RO' AND ra.Status = 1)
          AND  EXISTS (SELECT 1 FROM dbo.tRevisionApprovals ra
                       WHERE ra.RevisionDetailFK = rd.Id AND ra.Level = N'CO' AND ra.Status = 1)
        ORDER  BY rd.CreatedDate DESC, rd.Id DESC
    ) x
    WHERE  sr.rn = 1
      AND  ISNULL(prj.IsPublished, 0) = 1
      AND  NOT EXISTS (SELECT 1
                       FROM   dbo.tProjectStages s2
                       JOIN   dbo.tOptionProgramStage h2 ON h2.Id = s2.StageId
                       JOIN   dbo.tOptionProgramStage h1 ON h1.NameId = (SELECT StageId FROM gaar WHERE gaar.ProgramFK = sr.ProgramFK)
                       WHERE  s2.ProjectFK = sr.ProjectFK
                         AND  h2.StageHierarchy > h1.StageHierarchy)
)
SELECT e.ProgramFK, e.ProjectFK, e.RevisionDetailId,
       b.Figure AS BaseFigure, r.Figure AS RevisionFigure,
       r.Figure - b.Figure AS Movement
FROM   eff e
/*  StartYear is read INSIDE each apply: an aggregate may not mix an outer column
    with the query's own (Msg 8124), the same reason fProgramStages re-reads it. */
CROSS  APPLY (SELECT CASE WHEN COUNT(DISTINCT y.[Year]) <= 1 THEN ISNULL(SUM(y.Amount), 0)
                          ELSE ISNULL(SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END), 0) END AS Figure
              FROM   dbo.tProjectComponentCost cc
              JOIN   dbo.tProjectComponentCostPerYear y ON y.ComponentCostFK = cc.Id AND y.IsDeleted = 0
              CROSS  JOIN (SELECT TOP 1 pg2.StartYear FROM dbo.tPrograms pg2 WHERE pg2.ProgramPK = e.ProgramFK) pgy
              WHERE  cc.ProjectRevisionFK = e.RevisionId AND cc.IsDeleted = 0) b
CROSS  APPLY (SELECT CASE WHEN COUNT(DISTINCT y.[Year]) <= 1 THEN ISNULL(SUM(y.Amount), 0)
                          ELSE ISNULL(SUM(CASE WHEN y.[Year] = pgy.StartYear THEN y.Amount END), 0) END AS Figure
              FROM   dbo.tRevisionProjectComponentCost rcc
              JOIN   dbo.tRevisionProjectComponentCostPerYear y ON y.RevisionComponentCostFK = rcc.Id AND y.IsDeleted = 0
              CROSS  JOIN (SELECT TOP 1 pg2.StartYear FROM dbo.tPrograms pg2 WHERE pg2.ProgramPK = e.ProgramFK) pgy
              WHERE  rcc.RevisionDetailFK = e.RevisionDetailId AND rcc.IsDeleted = 0) r
ORDER  BY ABS(r.Figure - b.Figure) DESC, e.ProgramFK, e.ProjectFK;
GO

/* =============================================================================
   3. INDEXES (source: section 6b)
   ============================================================================= */
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

/* =============================================================================
   4. THE TWO OBJECTS (source: section 11)
   ============================================================================= */

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

/* =============================================================================
   5. VERIFICATION - read-only, or rolled back
   ============================================================================= */
SET QUOTED_IDENTIFIER ON;
GO

PRINT '--- the three indexes exist (want 3) ---';
SELECT name, OBJECT_NAME(object_id) AS [table]
FROM   sys.indexes
WHERE  name IN ('IX_tProjectStages_ProgramFK_StageId',
                'IX_tProjectComponentCost_Revision_Live',
                'IX_tProjectComponentCostPerYear_Cost_Live');
GO

PRINT '--- Lump Sum parent data the rule relies on (5 parents, each with exactly one live LS component, as of 2026-09-20) ---';
/*  Each latest-live parent revision is expected to hold exactly one live 'LS'
    component. More than one would be counted in full (SUM). */
;WITH lr AS (
    SELECT p.ProjectPK, pr.Id AS RevisionId,
           ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
    FROM   dbo.tProjects p
    JOIN   dbo.tProjectRevisions pr ON pr.ProjectFK = p.ProjectPK AND pr.IsDeleted = 0
    WHERE  p.ProjectType = N'LS' AND p.ParentProjectId IS NULL
)
SELECT COUNT(*)                                                         AS Parents,
       ISNULL(SUM(CASE WHEN x.LsRows = 0 THEN 1 ELSE 0 END), 0)         AS WithNoLS,
       ISNULL(SUM(CASE WHEN x.LsRows > 1 THEN 1 ELSE 0 END), 0)         AS MultiLS,
       ISNULL(SUM(CASE WHEN x.LsRows <> x.LsByName THEN 1 ELSE 0 END), 0) AS ComponentIdDisagreesWithName
FROM   lr
/*  LsByName resolves 'LS' through the lookup, the way FindLSComponentAsync does.
    A join, not IN (SELECT ...): SQL Server refuses a subquery inside SUM. */
CROSS  APPLY (SELECT ISNULL(SUM(CASE WHEN cc.ComponentId = N'LS' THEN 1 ELSE 0 END), 0) AS LsRows,
                     ISNULL(SUM(CASE WHEN opt.ComponentId = N'LS' THEN 1 ELSE 0 END), 0) AS LsByName
              FROM   dbo.tProjectComponentCost cc
              LEFT   JOIN dbo.tOptionProjectComponentType opt ON opt.ComponentName = cc.ComponentType
              WHERE  cc.ProjectRevisionFK = lr.RevisionId AND cc.IsDeleted = 0) x
WHERE  lr.rn = 1;
GO

PRINT '--- per program: stored Cost vs the list figure at the current stage (list figure is what a recompute would store) ---';
;WITH cur AS (
    SELECT pgr.ProgramFK, pgr.Id AS RevisionId, pgr.Cost AS StoredCost, pgs.StageId,
           ROW_NUMBER() OVER (PARTITION BY pgr.ProgramFK ORDER BY pgr.Id DESC) AS rn
    FROM   dbo.tProgramRevisions pgr
    JOIN   dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
)
SELECT cur.ProgramFK, cur.StageId, cur.StoredCost, fs.Cost AS ListCost,
       fs.Cost - cur.StoredCost AS Difference
FROM   cur
JOIN   dbo.tPrograms pg ON pg.ProgramPK = cur.ProgramFK AND pg.IsDeleted = 0
CROSS  APPLY (SELECT TOP 1 f.Cost FROM dbo.fProgramStages(cur.ProgramFK) f
              WHERE f.StageId = cur.StageId ORDER BY f.Id DESC) fs
WHERE  cur.rn = 1
ORDER  BY cur.ProgramFK;
GO

PRINT '--- the procedure runs (rolled back), on one non-overflowing program ---';
DECLARE @pk NVARCHAR(200) =
    (SELECT TOP 1 pg.ProgramPK FROM dbo.tPrograms pg
     WHERE pg.IsDeleted = 0
       AND EXISTS (SELECT 1 FROM dbo.tProgramRevisions r WHERE r.ProgramFK = pg.ProgramPK)
     ORDER BY pg.ProgramPK);
IF @pk IS NOT NULL
BEGIN
    SET STATISTICS TIME ON;
    BEGIN TRY
        BEGIN TRAN;
            EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
        ROLLBACK TRAN;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRAN;
        PRINT CONCAT('pRecomputeProgramCost failed for ', @pk, ': ', ERROR_MESSAGE());
    END CATCH
    SET STATISTICS TIME OFF;
END
GO

/* =============================================================================
   6. OPTIONAL BACKFILL - store the new figure for every program now
   -----------------------------------------------------------------------------
   Program Details reads the STORED cost, which otherwise moves to the new rule
   only when a write recomputes that program - so until then Program Details and
   the program list disagree on every program whose figure changed. Off by
   default: storing the new figures is a second decision after reading
   section 2's table. Set @RunBackfill to 1 to run it. A program that fails -
   the overflow group is the expected one - is reported and skipped, never fatal.
   ============================================================================= */
DECLARE @RunBackfill BIT = 0;

/*  XACT_ABORT off for this batch only: one program's error must reach the CATCH
    and be recorded, not abort the loop. */
SET XACT_ABORT OFF;

IF @RunBackfill = 1
BEGIN
    DECLARE @pk NVARCHAR(200);
    DECLARE @Skipped TABLE (ProgramPK NVARCHAR(200), ErrorMessage NVARCHAR(4000));
    DECLARE @Sink TABLE (RevisionId INT, StageId INT, NewCost DECIMAL(18,2));

    DECLARE backfill_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0 ORDER BY ProgramPK;

    OPEN backfill_cursor;
    FETCH NEXT FROM backfill_cursor INTO @pk;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            INSERT @Sink EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
        END TRY
        BEGIN CATCH
            IF XACT_STATE() <> 0 ROLLBACK TRAN;
            INSERT @Skipped VALUES (@pk, ERROR_MESSAGE());
        END CATCH
        FETCH NEXT FROM backfill_cursor INTO @pk;
    END
    CLOSE backfill_cursor;
    DEALLOCATE backfill_cursor;

    DECLARE @Recomputed INT = (SELECT COUNT(*) FROM @Sink);
    PRINT CONCAT('Backfill complete: ', @Recomputed, ' programs recomputed.');
    SELECT ProgramPK, ErrorMessage AS SkippedBecause FROM @Skipped;
END
ELSE
    PRINT 'Backfill not run (@RunBackfill = 0).';

SET XACT_ABORT ON;
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO

/*  A refusal above set NOEXEC ON; turn it back off so the session is usable. */
SET NOEXEC OFF;
GO
