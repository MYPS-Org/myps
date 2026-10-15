/*  GetProgramDeletionEligibility.sql — single source of truth for "can this
    Program be deleted right now?", before any of its child projects are
    even considered.

    RUNTIME SCRIPT (2026-10-15 architecture): this is the former dbo.fProgramDeletionEligibility
    SQL function, converted to a plain parameterized SELECT run directly from this file via
    ISqlExecutor.ExecuteScriptFileInTransactionAsync — no compiled DB object. The policy,
    column shape and logic below are UNCHANGED from the function version; only the calling
    mechanism changed (file-read + Dapper, not CREATE FUNCTION + EXEC/catalog call).

    Params: @ProgramFK NVARCHAR(200) — same contract as before.

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
      Eligible  otherwise (never advanced past its very first recorded stage,
                whatever that stage's name is)

    CURRENT STATUS = the Status of the revision the program's CURRENT STAGE ROW
    points at: tProgramStages ordered by tOptionProgramStage.StageHierarchy DESC,
    then Id DESC, joined to tProgramRevisions on RevisionId. This is exactly how
    dbo.vProgramLatest resolves the Status badge users see (verified against the
    live view definition 2026-10-15). It is NOT the newest tProgramRevisions row:
    on myps_db_migrated_uat that pick disagrees with the badge on 6 of 103
    programs, all GAA-R programs shown Approved whose newest revision is Working.
    Compared as the code (EnumProgramStatus.Approved = 1), never the name.

    There is no soft-delete at the Program level. A Program that passes
    this check is fully hard-deleted, along with every one of its child
    projects (see ExecuteProgramDeletion.sql). Child projects are judged
    separately by GetProjectDeletionTier.sql inside that same orchestration. */
SET QUOTED_IDENTIFIER ON;
SELECT
    pr.ProgramPK                                            AS ProgramFK,
    ISNULL(st.StageCount, 0)                                AS StageCount,
    cur.Status                                              AS CurrentStatus,
    CASE
        WHEN cur.Status = 1                    THEN N'Blocked'
        WHEN ISNULL(st.StageCount, 0) > 1      THEN N'Blocked'
        ELSE N'Eligible'
    END                                                      AS Eligibility,
    CASE
        WHEN cur.Status = 1                    THEN N'program is approved'
        WHEN ISNULL(st.StageCount, 0) > 1      THEN N'progressed beyond its initial stage'
        ELSE N''
    END                                                      AS Reason
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
WHERE pr.ProgramPK = @ProgramFK;
