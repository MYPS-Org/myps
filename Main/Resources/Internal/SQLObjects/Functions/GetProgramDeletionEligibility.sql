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
      Blocked   LiveProjects > 0                              'it still has N project(s) that have not been deleted'
                (2026-10-16: NO CASCADE. A program is deleted only after every one of its
                projects has been deleted by a user allowed to -- Batch Delete in Program
                Details, or the Lump Sum module for Lump Sum projects.)
      Eligible  otherwise.

    BlockedBy names the rule that refused ('Approved', 'Progressed', 'LiveProjects'; NULL when
    Eligible), so callers branch on a code rather than on the Reason's wording.
    LiveProjects is counted only when the first two rules pass (else 0).
    LIVE PROJECT = a project with at least one tProjectRevisions row under the program
    with IsDeleted = 0 (a project carried in from another program counts too). A project
    with no live revision there was already deleted by a user (soft delete, e.g. the old
    Batch Delete on main): it does not block, and Delete Program removes what is left of it,
    only within this program; a project with history in other programs keeps it
    (ProgramHelper.DeleteProgramInTransactionAsync, ExecuteProjectDeletion.sql).

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

/*  Step 1: stage count and current status for every requested program (cheap). */
DECLARE @Programs TABLE (
    ProgramFK       NVARCHAR(200) COLLATE DATABASE_DEFAULT PRIMARY KEY,
    StageCount      INT NOT NULL,
    CurrentStatus   INT NULL,
    LiveProjects    INT NOT NULL DEFAULT 0);

INSERT @Programs (ProgramFK, StageCount, CurrentStatus)
SELECT pr.ProgramPK, ISNULL(st.StageCount, 0), cur.Status
FROM dbo.tPrograms pr
OUTER APPLY (
    SELECT COUNT(*) AS StageCount
    FROM dbo.tProgramStages s
    WHERE s.ProgramFK = pr.ProgramPK
) st
OUTER APPLY (
    SELECT TOP (1) rv.Status
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
    Program list page took seconds on myps_db_migrated_uat (2026-10-16). */
UPDATE p
SET LiveProjects = (
        SELECT COUNT(DISTINCT r.ProjectFK)
        FROM dbo.tProjectRevisions r
        WHERE r.ProgramFK = p.ProgramFK
          AND r.IsDeleted = 0)
FROM @Programs p
WHERE ISNULL(p.CurrentStatus, 0) <> 1
  AND p.StageCount <= 1;

/*  Step 3: the rule, first match wins. */
SELECT
    p.ProgramFK,
    p.StageCount,
    p.CurrentStatus,
    p.LiveProjects,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'Approved'
        WHEN p.StageCount > 1      THEN N'Progressed'
        WHEN p.LiveProjects > 0    THEN N'LiveProjects'
        ELSE NULL
    END AS BlockedBy,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'Blocked'
        WHEN p.StageCount > 1      THEN N'Blocked'
        WHEN p.LiveProjects > 0    THEN N'Blocked'
        ELSE N'Eligible'
    END AS Eligibility,
    CASE
        WHEN p.CurrentStatus = 1   THEN N'program is approved'
        WHEN p.StageCount > 1      THEN N'progressed beyond its initial stage'
        WHEN p.LiveProjects > 0    THEN N'it still has ' + CAST(p.LiveProjects AS NVARCHAR(10))
                                        + N' project(s) that have not been deleted'
        ELSE N''
    END AS Reason
FROM @Programs p;
