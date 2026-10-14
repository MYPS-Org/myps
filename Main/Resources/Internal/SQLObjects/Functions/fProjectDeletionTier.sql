/*  dbo.fProjectDeletionTier — single source of truth for "can this project be
    deleted right now?" for one project, scoped to ONE specific Program.

    POLICY (finalized 2026-10-14, operator-directed, supersedes an earlier
    Hard/Soft/Blocked three-tier design that never shipped to this file):
      - There is no soft-delete at the project level under the Program-delete
        cascade. Every non-blocked project is force hard-deleted, regardless
        of its own stage or revision history ("hard-delete them all, for
        now" -- operator instruction).
      - The ONLY thing that blocks a project from being deleted is
        tProjects.IsPublished = 1. A published project can never be
        force-deleted as a side effect of deleting its program; the whole
        Program-delete request must be refused instead (see
        pExecuteProgramDeletion). In practice this is rare in isolation: per
        ProgramController.cs (confirmed live 2026-10-14), IsPublishable is
        only ever granted when a program's stage is GAA-R AND its status is
        Approved -- so a Program carrying a published child has almost
        always itself progressed past its first stage already, which
        independently blocks it via pProgramDeletionEligibility's own
        stage-count check. The published check here remains a separate,
        explicit, non-optional safeguard regardless -- it must never be
        inferred from the program-level stage count alone.
      - Stage/revision counts are still computed and returned for audit/
        diagnostic visibility (shown to the operator, logged), but they no
        longer change the Tier outcome by themselves.
      - Cost, funding, work-item and work-location data are still never
        checked here -- entering that data (UpdateProjectDetails) never
        creates a second tProjectRevisions row and never touches
        tProjectStages, so it was never a valid signal for "has this project
        progressed" to begin with. A brand-new project loaded with real cost
        data is still eligible exactly like one with none.

    WHY SCOPED BY ProgramFK AND NOT JUST ProjectFK:
    A multi-year project (the same tProjects.ProjectPK) can carry stage and
    revision history under more than one Program across fiscal years/cycles
    (tProjectStages and tProjectRevisions both carry their own ProgramFK
    column, independent of ProjectFK). The diagnostic counts below are
    always scoped to (@ProjectFK, @ProgramFK) together, never ProjectFK
    alone, so a project's history under a DIFFERENT program never leaks into
    this program's decision.

    TIER RULES (final):
      Blocked -> tProjects.IsPublished = 1. Wins over everything else.
      Hard    -> not published. Always, regardless of StageCount/RevisionCount.

    Returns exactly one row when @ProjectFK exists in tProjects; returns ZERO
    rows (not an error, not a false 'Hard') when it does not -- the FROM
    clause is tProjects itself and the WHERE filters on ProjectPK. The
    caller (ProjectHelper.cs) must treat an empty result as "project not
    found" and must not assume a row is always returned. */
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER FUNCTION dbo.fProjectDeletionTier
(
    @ProjectFK NVARCHAR(200),
    @ProgramFK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        p.ProjectPK                                            AS ProjectFK,
        @ProgramFK                                             AS ProgramFK,
        p.IsPublished,
        p.IsRevised,
        ISNULL(st.StageCount, 0)                                AS StageCount,
        ISNULL(rv.RevisionCount, 0)                             AS RevisionCount,
        CASE
            WHEN p.IsPublished = 1 THEN N'Blocked'
            ELSE N'Hard'
        END                                                      AS Tier
    FROM dbo.tProjects p
    OUTER APPLY (
        SELECT COUNT(*) AS StageCount
        FROM dbo.tProjectStages s
        WHERE s.ProjectFK = p.ProjectPK
          AND s.ProgramFK = @ProgramFK
    ) st
    OUTER APPLY (
        SELECT COUNT(*) AS RevisionCount
        FROM dbo.tProjectRevisions r
        WHERE r.ProjectFK = p.ProjectPK
          AND r.ProgramFK = @ProgramFK
    ) rv
    WHERE p.ProjectPK = @ProjectFK
);
GO
