/*  dbo.fProgramDeletionEligibility — single source of truth for "can this
    Program be deleted right now?", before any of its child projects are
    even considered.

    POLICY (finalized 2026-10-14, operator-directed): replaces the old
    hardcoded stage-name allow/deny lists in ProgramController.DeleteProgram
    (StagesToCheck = NEP/NEPE/HGAB/HGABI/GAA/GAAR always rejected;
    AllowedStages = BP/RBP/RDIP/PIP always allowed) -- that design was
    RISK-112: it blocked legitimate "skip-BP" fresh programs created
    directly at NEP..GAAR, and it unconditionally allowed hard-delete of a
    program sitting at RBP/RDIP/PIP even after genuinely progressing through
    several real stages, destroying real history.

    The replacement is ONE rule, uniform across ALL 12 EnumProgramStage
    values (BP, NEP, NEPE, HGAB, HGABI, GAA, GAAR, RBP, RDIP, PIP, TF, TFR)
    -- there is no more stage-name logic anywhere in this decision:

      StageCount(ProgramFK) <= 1 (never advanced past its very first
      recorded stage, whatever that stage's name is) -> Eligible.

      StageCount(ProgramFK) > 1 (genuinely advanced at least once, by any
      path -- normal BP->NEP->... progression OR a formal
      pPublishProgram/UpdateProgramStage transition) -> Blocked.

    There is no soft-delete at the Program level. A Program that passes
    this check is always fully hard-deleted, along with every one of its
    child projects (see pExecuteProgramDeletion) -- "no more program
    soft-delete, all will be hard-delete" (operator instruction).

    This function does NOT check tProjects.IsPublished anywhere -- that
    check belongs to fProjectDeletionTier and is evaluated per child project
    inside pExecuteProgramDeletion's own Pass 1. A program could in theory
    have StageCount = 1 at the program level while one of its children is
    independently flagged IsPublished = 1 through a path this function does
    not see; pExecuteProgramDeletion's two-pass design (program eligibility,
    then child-published check) is what actually closes that gap end to
    end, not this function alone. */
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER FUNCTION dbo.fProgramDeletionEligibility
(
    @ProgramFK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        pr.ProgramPK                                            AS ProgramFK,
        ISNULL(st.StageCount, 0)                                AS StageCount,
        CASE
            WHEN ISNULL(st.StageCount, 0) <= 1 THEN N'Eligible'
            ELSE N'Blocked'
        END                                                      AS Eligibility
    FROM dbo.tPrograms pr
    OUTER APPLY (
        SELECT COUNT(*) AS StageCount
        FROM dbo.tProgramStages s
        WHERE s.ProgramFK = pr.ProgramPK
    ) st
    WHERE pr.ProgramPK = @ProgramFK
);
GO
