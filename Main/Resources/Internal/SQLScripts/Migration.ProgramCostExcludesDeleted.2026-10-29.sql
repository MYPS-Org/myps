/* =============================================================================
   Migration — program cost and project counts without deleted projects
   Date: 2026-10-29 · Follow-up of documents/plans/restore-deleted-project-into-current-stage.md
   -----------------------------------------------------------------------------
   WHAT WAS WRONG.
     a. A project deleted at a later stage (Batch Delete, the per-row Delete) kept counting
        toward its program's Cost, in Program Details and in the Program list's stage rows,
        until it was permanently deleted. pRecomputeProgramCost and fProgramStages took each
        project's latest revision at the stage without looking at IsDeleted.
     b. pRecomputeProgramCost took the "current stage" from the newest program revision by
        Id. On a program whose stages were inserted out of order (legacy imports; 11 of 108
        programs on myps_db_dev, all at GAA-R) that is an earlier stage: the recompute wrote
        that stage's figure into that stage's revision, and the Cost Program Details shows at
        the current stage was never recomputed. It now picks the stage as vProgramLatest and
        the rest of the API do: the highest StageHierarchy, then the newest stage row.
     c. fProgramStages.ProjectCount (the "Projects" column of the Program list's stage rows)
        counted deleted projects too. It now counts the live stage rows, the rows the
        Program Details table lists at that stage.
     d. vProgramLatest.NumberOfProjects (the Program list's "No. of Projects", the Dashboard's
        program project count) counted every project ever created in the program, deleted
        ones included. It now leaves out a project whose newest revision in the program is
        deleted.

   WHAT THIS DOES.
     1. Creates IX_tProjectRevisions_Deleted_ProgramFK, a filtered index over the deleted
        revisions only (a handful of rows), which keeps 3 as fast as before (measured on
        myps_db_dev: 40 ms over all programs, against 1.5 s without it).
     2. dbo.fProgramStages and dbo.pRecomputeProgramCost (CREATE OR ALTER), fixes a-c.
        Byte-for-byte section 11 of
        Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql, which
        MYPS.DatabaseTests/RecomputeProgramCostTests.cs runs. Edit the source and re-cut;
        do not edit it here. ProgramCost.Objects.2026-09-18.sql carries the same text.
     3. vProgramLatest, fix d. The view's current definition lives only in each database (the
        repo has the version before 2026-09-10), so only its projCnt block is replaced, in
        place; the rest of each database's view is left as it is. Refused with nothing
        changed when that block is not the expected one.
     4. Recomputes the stored Cost of the programs a or b changes, so Program Details shows
        the right figure now and not at the program's next write. Each one's current revision
        only; the old and new figures are listed.
     5. Checks. Every result set under "want 0 rows" must be empty.

   BEFORE RUNNING IT, capture the definitions so there is something to roll back to:
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.fProgramStages'));
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pRecomputeProgramCost'));
     SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.vProgramLatest'));

   HOW TO RUN IT.
     sqlcmd -S <server> -d <database> -E -C -b -I -f 65001 -i Migration.ProgramCostExcludesDeleted.2026-10-29.sql
   -I (QUOTED_IDENTIFIER ON) is required for the filtered index. Idempotent; safe to re-run
   (step 4 then recomputes the same programs to the same figures).
   ============================================================================= */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* =============================================================================
   0. GUARD - never the retired production database name (SKL-005 / ADR-118)
   ============================================================================= */
IF DB_NAME() = N'myps_db'
BEGIN
    RAISERROR('REFUSED: this script will not run against myps_db, the retired production database name. Point it at a dev database. Nothing below will execute; run SET NOEXEC OFF or reconnect before reusing this session.', 16, 1);
    SET NOEXEC ON;
END
GO

PRINT CONCAT('Server   : ', @@SERVERNAME);
PRINT CONCAT('Database : ', DB_NAME());
PRINT CONCAT('Started  : ', CONVERT(varchar(19), GETDATE(), 120));
GO

/* =============================================================================
   1. THE DELETED-REVISIONS INDEX
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_tProjectRevisions_Deleted_ProgramFK'
                 AND object_id = OBJECT_ID('dbo.tProjectRevisions'))
    CREATE NONCLUSTERED INDEX IX_tProjectRevisions_Deleted_ProgramFK
        ON dbo.tProjectRevisions (ProgramFK, ProjectFK, Id)
        WHERE IsDeleted = 1;
GO

/* =============================================================================
   2. THE TWO COST OBJECTS (source: section 11)
   ============================================================================= */

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
     LIVE revision it has at that stage, from dbo.tProjectComponentCostPerYear:
     when it holds ONE distinct Year, that year's amount whatever the year is;
     when it holds SEVERAL, only the program year (dbo.tPrograms.StartYear).
     2026-10-29: a soft-deleted revision is out. Batch Delete flags the current
     stage's revision, so a project deleted at the stage stops counting there;
     it used to keep counting until hard-deleted. The current stage is the one
     vProgramLatest shows: the highest StageHierarchy, then the newest stage row.

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

        /*  The live stage rows, the rows fProgramProjects lists at this stage: a
            project deleted here is out (2026-10-29; it stayed in until hard-deleted).
            A stage row whose revision row is missing still counts, as it did.
            COUNT(*), not COUNT(DISTINCT ProjectFK): the same figure as the Program
            Details table, at a tenth of the cost on a 16,000-project stage. */
        (SELECT COUNT(*)
         FROM dbo.tProjectStages ps2
         WHERE ps2.ProgramFK = @ProgramPK
           AND ps2.StageId   = pgs.StageId
           AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions dr
                           WHERE dr.Id = ps2.RevisionId AND dr.IsDeleted = 1)
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
                  AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions dr
                                  WHERE dr.Id = ps3.RevisionId AND dr.IsDeleted = 1)
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

    /*  THE CURRENT STAGE, picked the way vProgramLatest picks it (2026-10-29): the highest
        StageHierarchy, then the newest stage row. It was the newest program revision by Id,
        which is another stage on a program whose stages were inserted out of order (legacy
        imports: 11 of 108 programs on myps_db_dev, all at GAA-R). There the recompute wrote
        an earlier stage's figure into that stage's revision, and the stored Cost of the
        current stage's revision, which Program Details shows there, was never recomputed. */
    SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
    FROM dbo.tProgramRevisions pgr
    JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
    JOIN dbo.tOptionProgramStage o ON o.Id = pgs.StageId
    WHERE pgr.ProgramFK = @ProgramPK
    ORDER BY o.StageHierarchy DESC, pgs.Id DESC;

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

        tProjectStages carries one row per revision, so the latest LIVE revision of
        each project at the stage is what counts: a revision Batch Delete flagged is
        skipped (2026-10-29), the same test its liveAtStage and the stage advance use.
        NOT EXISTS rather than a join, so a stage row whose revision row is missing
        counts as it did. Lump Sum PARENTS are not in this set:
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
          AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions dr
                          WHERE dr.Id = ps.RevisionId AND dr.IsDeleted = 1)
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
   3. vProgramLatest.NumberOfProjects WITHOUT DELETED PROJECTS
   ============================================================================= */
DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID(N'dbo.vProgramLatest'));
DECLARE @tag NVARCHAR(20) = N') projCnt';
DECLARE @expected NVARCHAR(400) = N'CROSSAPPLY(SELECTCOUNT(*)ASProjectCountFROMdbo.tProjectsWHEREProgramFK=pg.ProgramPK)projCnt';
DECLARE @newBlock NVARCHAR(MAX) = N'CROSS APPLY (
    -- 2026-10-29 NumberOfProjects: deleted projects are not counted
    -- (Migration.ProgramCostExcludesDeleted.2026-10-29.sql). A project is deleted when its
    -- newest revision in this program is flagged IsDeleted: deleted at the current stage,
    -- deleted at an earlier stage and so never carried forward, or deleted in the Lump Sum
    -- module (every revision flagged). A restored project has a live newest revision again.
    -- All projects minus the deleted ones, found through the filtered index
    -- IX_tProjectRevisions_Deleted_ProgramFK, so the view reads only the deleted rows.
    SELECT pa.Total - pd.Deleted AS ProjectCount
    FROM (SELECT COUNT(*) AS Total
          FROM dbo.tProjects
          WHERE ProgramFK = pg.ProgramPK) pa
    CROSS JOIN (
        SELECT COUNT(DISTINCT dr.ProjectFK) AS Deleted
        FROM dbo.tProjectRevisions dr
        JOIN dbo.tProjects dp ON dp.ProjectPK = dr.ProjectFK AND dp.ProgramFK = pg.ProgramPK
        WHERE dr.IsDeleted = 1
          AND dr.ProgramFK = pg.ProgramPK
          AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions lv
                          WHERE lv.ProjectFK = dr.ProjectFK
                            AND lv.ProgramFK = pg.ProgramPK
                            AND lv.IsDeleted = 0
                            AND lv.Id > dr.Id)) pd
) projCnt';
DECLARE @e INT, @s INT, @n INT, @first INT, @old NVARCHAR(MAX), @before NVARCHAR(MAX);

IF @def IS NULL
    RAISERROR('vProgramLatest: the view does not exist. Nothing changed.', 16, 1);
ELSE IF CHARINDEX(N'2026-10-29 NumberOfProjects', @def) > 0
    PRINT 'vProgramLatest: NumberOfProjects already leaves deleted projects out. Nothing to do.';
ELSE
BEGIN
    SET @e = CHARINDEX(@tag, @def);
    IF @e = 0 OR CHARINDEX(@tag, @def, @e + 1) > 0
        RAISERROR('vProgramLatest: expected exactly one projCnt block. Nothing changed; edit the view by hand.', 16, 1);
    ELSE
    BEGIN
        SET @e = @e + LEN(@tag);                                    -- one past the block
        SET @before = LEFT(@def, @e - 1);
        SET @n = DATALENGTH(@before) / 2;
        SET @s = @n - CHARINDEX(REVERSE(N'CROSS APPLY'), REVERSE(@before)) - LEN(N'CROSS APPLY') + 2;
        SET @old = SUBSTRING(@def, @s, @e - @s);
        SET @first = PATINDEX(N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%', @def);

        IF REPLACE(REPLACE(REPLACE(REPLACE(@old, N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N'') <> @expected
            RAISERROR('vProgramLatest: its projCnt block is not the expected COUNT(*) over tProjects. Nothing changed; edit the view by hand.', 16, 1);
        ELSE IF UPPER(SUBSTRING(@def, @first, 6)) <> N'CREATE'
            RAISERROR('vProgramLatest: its definition does not start with CREATE. Nothing changed; edit the view by hand.', 16, 1);
        ELSE
        BEGIN
            SET @def = STUFF(@def, @s, @e - @s, @newBlock);
            SET @def = STUFF(@def, @first, 6, N'ALTER');
            EXEC sys.sp_executesql @def;
            PRINT 'vProgramLatest: NumberOfProjects now leaves deleted projects out.';
        END
    END
END
GO

/* =============================================================================
   4. RECOMPUTE THE PROGRAMS THIS CHANGES
   ============================================================================= */
DECLARE @Affected TABLE (ProgramPK NVARCHAR(200) NOT NULL PRIMARY KEY, Reason NVARCHAR(60) NOT NULL,
                         RevisionId INT NOT NULL, OldCost DECIMAL(18,5) NULL, NewCost DECIMAL(18,5) NULL,
                         Error NVARCHAR(2048) NULL);

;WITH cur AS (
    SELECT pg.ProgramPK, c.RevisionId, c.StageId
    FROM dbo.tPrograms pg
    CROSS APPLY (SELECT TOP 1 pgr.Id AS RevisionId, pgs.StageId
                 FROM dbo.tProgramRevisions pgr
                 JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
                 JOIN dbo.tOptionProgramStage o ON o.Id = pgs.StageId
                 WHERE pgr.ProgramFK = pg.ProgramPK
                 ORDER BY o.StageHierarchy DESC, pgs.Id DESC) c
    WHERE pg.IsDeleted = 0
), flagged AS (
    SELECT cur.ProgramPK, cur.RevisionId,
           CASE WHEN EXISTS (SELECT 1
                             FROM dbo.tProjectRevisions dr
                             JOIN dbo.tProjectStages ps ON ps.RevisionId = dr.Id
                             WHERE dr.IsDeleted = 1
                               AND dr.ProgramFK = cur.ProgramPK
                               AND ps.ProgramFK = cur.ProgramPK
                               AND ps.StageId = cur.StageId)
                THEN 1 ELSE 0 END AS HasDeleted,
           CASE WHEN cur.RevisionId <> (SELECT TOP 1 pgr.Id
                                        FROM dbo.tProgramRevisions pgr
                                        JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
                                        WHERE pgr.ProgramFK = cur.ProgramPK
                                        ORDER BY pgr.Id DESC)
                THEN 1 ELSE 0 END AS OutOfOrder
    FROM cur
)
INSERT @Affected (ProgramPK, Reason, RevisionId, OldCost)
SELECT f.ProgramPK,
       CASE WHEN f.HasDeleted = 1 AND f.OutOfOrder = 1 THEN N'deleted project at the current stage; stages out of order'
            WHEN f.HasDeleted = 1 THEN N'deleted project at the current stage'
            ELSE N'stages out of order' END,
       f.RevisionId,
       (SELECT r.Cost FROM dbo.tProgramRevisions r WHERE r.Id = f.RevisionId)
FROM flagged f
WHERE f.HasDeleted = 1 OR f.OutOfOrder = 1;

DECLARE @pk NVARCHAR(200);
DECLARE @sink TABLE (RevisionId INT, StageId INT, NewCost DECIMAL(18,2));   -- the procedure's one-row result
DECLARE recompute CURSOR LOCAL FAST_FORWARD FOR SELECT ProgramPK FROM @Affected;
OPEN recompute;
FETCH NEXT FROM recompute INTO @pk;
WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        INSERT @sink EXEC dbo.pRecomputeProgramCost @ProgramPK = @pk;
    END TRY
    BEGIN CATCH
        UPDATE @Affected SET Error = ERROR_MESSAGE() WHERE ProgramPK = @pk;
    END CATCH
    FETCH NEXT FROM recompute INTO @pk;
END
CLOSE recompute;
DEALLOCATE recompute;

UPDATE a SET NewCost = r.Cost
FROM @Affected a JOIN dbo.tProgramRevisions r ON r.Id = a.RevisionId;

DECLARE @count INT = (SELECT COUNT(*) FROM @Affected);
PRINT CONCAT('--- recomputed (', @count, ' programs) ---');
SELECT a.ProgramPK, v.[Name], v.StageName, a.Reason, a.OldCost, a.NewCost, a.Error
FROM @Affected a
LEFT JOIN dbo.vProgramLatest v ON v.ProgramPK = a.ProgramPK
ORDER BY a.Reason, a.ProgramPK;
GO

/* =============================================================================
   5. CHECKS
   ============================================================================= */
PRINT '--- the deleted-revisions index (want 1 row) ---';
SELECT name, filter_definition FROM sys.indexes
WHERE name = 'IX_tProjectRevisions_Deleted_ProgramFK' AND object_id = OBJECT_ID('dbo.tProjectRevisions');

PRINT '--- vProgramLatest leaves deleted projects out (want 1 row) ---';
SELECT 1 AS Patched WHERE CHARINDEX(N'2026-10-29 NumberOfProjects', OBJECT_DEFINITION(OBJECT_ID(N'dbo.vProgramLatest'))) > 0;

PRINT '--- want 0 rows: a program step 4 recomputes whose stored Cost differs from the Program list''s ---';
;WITH cur AS (
    SELECT pg.ProgramPK, c.RevisionId, c.StageId, c.Cost
    FROM dbo.tPrograms pg
    CROSS APPLY (SELECT TOP 1 pgr.Id AS RevisionId, pgs.StageId, pgr.Cost
                 FROM dbo.tProgramRevisions pgr
                 JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
                 JOIN dbo.tOptionProgramStage o ON o.Id = pgs.StageId
                 WHERE pgr.ProgramFK = pg.ProgramPK
                 ORDER BY o.StageHierarchy DESC, pgs.Id DESC) c
    WHERE pg.IsDeleted = 0
)
SELECT cur.ProgramPK, cur.StageId, cur.Cost AS StoredCost, fs.Cost AS ListCost
FROM cur
CROSS APPLY dbo.fProgramStages(cur.ProgramPK) fs
WHERE fs.RevisionId = cur.RevisionId
  AND ROUND(ISNULL(fs.Cost, 0), 2) <> ROUND(ISNULL(cur.Cost, 0), 2)
  AND (EXISTS (SELECT 1
               FROM dbo.tProjectRevisions dr
               JOIN dbo.tProjectStages ps ON ps.RevisionId = dr.Id
               WHERE dr.IsDeleted = 1
                 AND dr.ProgramFK = cur.ProgramPK
                 AND ps.ProgramFK = cur.ProgramPK
                 AND ps.StageId = cur.StageId)
       OR cur.RevisionId <> (SELECT TOP 1 pgr.Id
                             FROM dbo.tProgramRevisions pgr
                             JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
                             WHERE pgr.ProgramFK = cur.ProgramPK
                             ORDER BY pgr.Id DESC));

PRINT '--- want 0 rows: a negative project count ---';
SELECT ProgramPK, NumberOfProjects FROM dbo.vProgramLatest WHERE NumberOfProjects < 0;
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO
