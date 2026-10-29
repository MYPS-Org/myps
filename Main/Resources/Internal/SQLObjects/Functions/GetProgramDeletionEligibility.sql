/*  GetProgramDeletionEligibility.sql — single source of truth for "can this
    Program be deleted right now?". Delete Program and the Program list (its
    Delete button) both ask this script and nothing else.

    RUNTIME SCRIPT (2026-10-15 architecture): this is the former dbo.fProgramDeletionEligibility
    SQL function, converted to a plain parameterized SELECT run directly from this file via
    ISqlExecutor.ExecuteScriptFileInTransactionAsync — no compiled DB object.

    Params: @ProgramFKs NVARCHAR(MAX) — a JSON array of ProgramPKs (2026-10-16), so one call
    answers for a single delete or a whole list page. One row per program that exists;
    an unknown ProgramPK returns no row.

    POLICY (finalized 2026-10-14, operator-directed): replaces the old
    hardcoded stage-name allow/deny lists in ProgramController.DeleteProgram
    (StagesToCheck = NEP/NEPE/HGAB/HGABI/GAA/GAAR always rejected;
    AllowedStages = BP/RBP/RDIP/PIP always allowed) -- that design was
    RISK-112: it blocked legitimate "skip-BP" fresh programs created
    directly at NEP..GAAR, and it unconditionally allowed hard-delete of a
    program sitting at RBP/RDIP/PIP even after genuinely progressing through
    several real stages, destroying real history.

    RULE, first match wins (Reason is returned for the user-facing refusal):
      Blocked   the program's CURRENT status is Approved      'program is approved'
                (2026-10-15: an Approved program refuses every delete)
      Blocked   StageCount(ProgramFK) > 1                     'progressed beyond its initial stage'
                (genuinely advanced at least once, by any path)
      Blocked   its one stage is not BP or RBP                'it is at the <Stage> stage; a program can be
                                                              permanently deleted only at BP or RBP'
                (2026-10-29, delete-rules-projects-programs-stages.md, user rule: a permanent delete
                happens only at BP, or RBP -- the BP of the RBP -> RDIP -> PIP track -- the same rule
                GetProjectDeletionTier.sql applies to projects. A program created straight at NEP or
                later is never permanently deleted.)
      Blocked   LiveProjects > 0                              'it still has N project(s) that have not been deleted'
                (2026-10-16: NO CASCADE. A program is deleted only after every one of its
                projects has been deleted by a user allowed to -- Batch Delete in Program
                Details, or the Lump Sum module for Lump Sum projects.)
      Blocked   StuckLeftovers > 0                            'it has N deleted project(s) that cannot be removed
                                                              automatically (e.g. X); an administrator must clean them up'
      Eligible  otherwise.

    BlockedBy names the rule that refused ('Approved', 'Progressed', 'NotBP', 'LiveProjects',
    'StuckLeftovers'; NULL when Eligible), so callers branch on a code rather than on wording.
    The project counts are computed only when the first two rules pass (else 0).
    LIVE PROJECT (2026-10-16) = what Batch Delete can act on: an IsDeleted = 0 revision reached
    through a tProjectStages row at the program's CURRENT stage (ResolveBatchDeleteAsync's
    liveAtStage). Any other project linked to the program is a leftover of a deleted one: it does
    not block, and Delete Program removes it, only within this program; a project with history in
    other programs keeps it (ProgramHelper.DeleteProgramInTransactionAsync, ExecuteProjectDeletion.sql).
    STUCK LEFTOVERS (Step 3) are leftovers that delete could never remove; they refuse up front,
    'an administrator must clean them up', so the list and DeleteProgram agree.

    CURRENT STATUS = the Status of the revision the program's CURRENT STAGE ROW
    points at: tProgramStages ordered by tOptionProgramStage.StageHierarchy DESC,
    then Id DESC, joined to tProgramRevisions on RevisionId. This is exactly how
    dbo.vProgramLatest resolves the Status badge users see (verified against the
    live view definition 2026-10-15). It is NOT the newest tProgramRevisions row:
    on myps_db_migrated_uat that pick disagrees with the badge on 6 of 103
    programs, all GAA-R programs shown Approved whose newest revision is Working.
    Compared as the code (EnumProgramStatus.Approved = 1), never the name.

    There is no soft-delete at the Program level. */
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

/*  Step 1: stage count, current status and current stage for every requested program (cheap). */
DECLARE @Programs TABLE (
    ProgramFK       NVARCHAR(200) COLLATE DATABASE_DEFAULT PRIMARY KEY,
    StageCount      INT NOT NULL,
    CurrentStatus   INT NULL,
    CurrentStageId  INT NULL,
    CurrentStageName NVARCHAR(50) COLLATE DATABASE_DEFAULT NULL,
    LiveProjects    INT NOT NULL DEFAULT 0,
    StuckLeftovers  INT NOT NULL DEFAULT 0,
    StuckExample    NVARCHAR(200) COLLATE DATABASE_DEFAULT NULL);

INSERT @Programs (ProgramFK, StageCount, CurrentStatus, CurrentStageId, CurrentStageName)
SELECT pr.ProgramPK, ISNULL(st.StageCount, 0), cur.Status, cur.StageId, cur.StageName
FROM dbo.tPrograms pr
OUTER APPLY (
    SELECT COUNT(*) AS StageCount
    FROM dbo.tProgramStages s
    WHERE s.ProgramFK = pr.ProgramPK
) st
OUTER APPLY (
    SELECT TOP (1) rv.Status, ps.StageId, ps.StageName
    FROM dbo.tProgramStages ps
    JOIN dbo.tOptionProgramStage o ON o.Id = ps.StageId
    LEFT JOIN dbo.tProgramRevisions rv ON rv.Id = ps.RevisionId
    WHERE ps.ProgramFK = pr.ProgramPK
    ORDER BY o.StageHierarchy DESC, ps.Id DESC
) cur
WHERE pr.ProgramPK IN (SELECT j.ProgramFK COLLATE DATABASE_DEFAULT
                       FROM OPENJSON(@ProgramFKs) WITH (ProgramFK NVARCHAR(200) '$') j);

/*  Step 2: the live-project count, ONLY for programs the first two rules let through (not
    Approved, not progressed). A separate statement, so the counting really is skipped for
    the rest: an Approved GAA-R program can have 17,000+ projects, and counting them for a
    Program list page took seconds on myps_db_migrated_uat (2026-10-16).
    LIVE means what Batch Delete can act on (ProgramController.ResolveBatchDeleteAsync,
    liveAtStage): an IsDeleted = 0 revision reached through a tProjectStages row at the
    program's CURRENT stage. So "delete them first with Batch Delete" is always possible. */
UPDATE p
SET LiveProjects = (
        SELECT COUNT(DISTINCT r.ProjectFK)
        FROM dbo.tProjectStages s
        JOIN dbo.tProjectRevisions r ON r.Id = s.RevisionId
        WHERE s.ProgramFK = p.ProgramFK
          AND s.StageId = p.CurrentStageId
          AND r.IsDeleted = 0)
FROM @Programs p
WHERE ISNULL(p.CurrentStatus, 0) <> 1
  AND p.StageCount <= 1;

/*  Step 3: for a program with no live project, the projects linked to it that Delete Program
    must NOT or could NEVER remove (2026-10-16). Stuck when it:
      - still has a live revision under the program that Batch Delete cannot reach (no stage row at
        the current stage) -- it was never deleted, so Delete Program must not remove it;
      - is published (the project rule never removes a published project);
      - has no stage row under the program and is not a Lump Sum itemized child (no stage history:
        the rule says Soft; an itemized child is Hard regardless);
      - has history under the program only through stage rows (the rule cannot resolve it);
      - has no project row at all;
      - was created here and has history in another program (its project row would have to stay
        and point at a deleted program).
    Only an administrator can clean those up; saying so here keeps the Program list and
    DeleteProgram in agreement. DeleteProgram still decides on its own. */
UPDATE p
SET StuckLeftovers = x.Cnt,
    StuckExample   = x.Example
FROM @Programs p
CROSS APPLY (
    SELECT COUNT(*) AS Cnt, MIN(l.ProjectFK) AS Example
    FROM (
        SELECT own.ProjectPK AS ProjectFK FROM dbo.tProjects own WHERE own.ProgramFK = p.ProgramFK
        UNION
        SELECT r.ProjectFK FROM dbo.tProjectRevisions r WHERE r.ProgramFK = p.ProgramFK
        UNION
        SELECT s.ProjectFK FROM dbo.tProjectStages s WHERE s.ProgramFK = p.ProgramFK
    ) l
    LEFT JOIN dbo.tProjects pj ON pj.ProjectPK = l.ProjectFK
    WHERE pj.ProjectPK IS NULL
       OR EXISTS (SELECT 1 FROM dbo.tProjectRevisions r
                  WHERE r.ProjectFK = l.ProjectFK AND r.ProgramFK = p.ProgramFK AND r.IsDeleted = 0)
       OR pj.IsPublished = 1
       OR (pj.ParentProjectId IS NULL
           AND NOT EXISTS (SELECT 1 FROM dbo.tProjectStages s
                           WHERE s.ProjectFK = l.ProjectFK AND s.ProgramFK = p.ProgramFK))
       OR (pj.ProgramFK <> p.ProgramFK
           AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions r
                           WHERE r.ProjectFK = l.ProjectFK AND r.ProgramFK = p.ProgramFK))
       OR (pj.ProgramFK = p.ProgramFK
           AND (   EXISTS (SELECT 1 FROM dbo.tProjectRevisions r
                           WHERE r.ProjectFK = l.ProjectFK AND r.ProgramFK <> p.ProgramFK)
                OR EXISTS (SELECT 1 FROM dbo.tProjectStages s
                           WHERE s.ProjectFK = l.ProjectFK AND s.ProgramFK <> p.ProgramFK)))
) x
WHERE ISNULL(p.CurrentStatus, 0) <> 1
  AND p.StageCount <= 1
  AND p.LiveProjects = 0;

/*  Step 4: the rule, first match wins. */
SELECT
    p.ProgramFK,
    p.StageCount,
    p.CurrentStatus,
    p.LiveProjects,
    p.StuckLeftovers,
    p.StuckExample,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'Approved'
        WHEN p.StageCount > 1      THEN N'Progressed'
        WHEN p.StageCount = 1 AND p.CurrentStageId NOT IN (1, 8) THEN N'NotBP'
        WHEN p.LiveProjects > 0    THEN N'LiveProjects'
        WHEN p.StuckLeftovers > 0  THEN N'StuckLeftovers'
        ELSE NULL
    END AS BlockedBy,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'Blocked'
        WHEN p.StageCount > 1      THEN N'Blocked'
        WHEN p.StageCount = 1 AND p.CurrentStageId NOT IN (1, 8) THEN N'Blocked'
        WHEN p.LiveProjects > 0    THEN N'Blocked'
        WHEN p.StuckLeftovers > 0  THEN N'Blocked'
        ELSE N'Eligible'
    END AS Eligibility,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'program is approved'
        WHEN p.StageCount > 1      THEN N'progressed beyond its initial stage'
        WHEN p.StageCount = 1 AND p.CurrentStageId NOT IN (1, 8)
                                   THEN N'it is at the ' + ISNULL(p.CurrentStageName, N'current')
                                        + N' stage; a program can be permanently deleted only at BP or RBP'
        WHEN p.LiveProjects > 0    THEN N'it still has ' + CAST(p.LiveProjects AS NVARCHAR(10))
                                        + N' project(s) that have not been deleted'
        WHEN p.StuckLeftovers > 0  THEN N'it has ' + CAST(p.StuckLeftovers AS NVARCHAR(10))
                                        + N' deleted project(s) that cannot be removed automatically (e.g. '
                                        + p.StuckExample + N'); an administrator must clean them up'
        ELSE N''
    END AS Reason
FROM @Programs p;
