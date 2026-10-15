/*  GetProjectDeletionTier.sql — THE single decision for deleting a project. Every
    delete path asks this script and nothing else: Batch Delete (and its preview),
    Delete Program, Delete Lump Sum and Delete Itemized Project; Batch Restore uses it
    only to resolve ids. Every hard delete goes through ProjectHelper.ExecuteProjectDeletionAsync
    (EF or ISqlExecutor form), which runs this script AGAIN inside the delete's own
    transaction and refuses anything but 'Hard'. ExecuteProjectDeletion.sql does not
    check anything itself, so never run it except through that helper. Do not restate
    the rule in C# or in another script; run this and read Tier.

    RUNTIME SCRIPT (2026-10-15 architecture): this is the former dbo.fProjectDeletionTier
    SQL function, converted to a plain parameterized SELECT run directly from this file via
    ISqlExecutor.ExecuteScriptFileInTransactionAsync — no compiled DB object. The policy,
    column shape and logic below are UNCHANGED from the function version; only the calling
    mechanism changed (file-read + Dapper, not CREATE FUNCTION + EXEC/catalog call).

    Params: @ProjectRef NVARCHAR(200), @ProgramFK NVARCHAR(200) — same contract as before.

    POLICY (2026-10-15):
      1. A project may be HARD-deleted only on its first project-stage entry. Once it
         has progressed with its program (a next stage was initiated for it), only a
         SOFT delete applies (the current-stage revision is flagged IsDeleted).
      2. The decision does not depend on the BP / P / MY prefix of the Project ID.
      3. A Lump Sum itemized project (created only at GAA-R) is ALWAYS hard-deleted,
         even when revised, so no row keeps holding its reserved Project ID. The ID
         allocator (tProjectIdSequence) is not rewound: re-itemizing issues a new one.
      A published project is never deleted by any path.
      4. (2026-10-15) An APPROVED program refuses every delete of its projects, soft or
         hard — except Lump Sum itemized children, which stay deletable so an import
         mistake in an Approved program remains correctable (Lump Sum rule 2026-09-09).
         "Approved" is the program's CURRENT status as dbo.vProgramLatest shows it; see
         GetProgramDeletionEligibility.sql's header for how that revision is resolved.

    TIER, first match wins:
      Blocked  tProjects.IsPublished = 1.
      Hard     Kind = 'LSChild'                 (rule 3, exempt from rule 4).
      Blocked  program is Approved              (rule 4).
      Hard     StageCount = 1                   (rule 1).
      Soft     otherwise — including StageCount = 0: with no stage history there is
               no evidence of a first stage entry, so nothing is destroyed on it.

    StageCount = COUNT(DISTINCT StageId) over tProjectStages for (project, program).
    It ignores IsDeleted on purpose: a project soft-deleted at NEP has still
    progressed. It is scoped by ProgramFK, which never changes, and never by
    ProgramId, which is regenerated on every stage advance.

    PREFIX-AGNOSTIC RESOLVE (rule 2). @ProjectRef may be the project's ProjectPK, or
    ANY revision ProjectId it carries under @ProgramFK. The PK keeps its creation
    prefix forever (BP…), while a BP->NEP advance rewrites the revision ProjectId to
    P… (ProgramController.UpdateProgramStage, ReplaceFirst("BP", …)). Both forms
    resolve to the same project, and every rule above runs on the resolved ProjectPK
    only. BP, P and MY numbers come from separate counters (pReserveProjectIdBlock
    @Suffix) and the BP->P swap reuses the BP digits, so one string can be one
    project's PK and another project's revision id (three such pairs were live,
    see MYPS.DatabaseTests/ProjectIdGenerationTests.cs). The query therefore
    returns ONE ROW PER PROJECT the reference names, never a silent pick: MatchedBy
    says whether it matched that project's PK. A caller resolving what a USER typed
    must refuse a reference with more than one row as ambiguous (Batch Delete,
    restore). A caller that already holds the ProjectPK (ExecuteProjectDeletion.sql,
    ExecuteProgramDeletion.sql, the Lump Sum actions) takes the row whose ProjectFK is
    that PK. No match: zero rows.

    Kind: 'LSChild'  tProjects.ParentProjectId IS NOT NULL (an itemized project);
          'LSParent' ProjectType = 'LS' and no parent;
          'Ordinary' otherwise. */
SET QUOTED_IDENTIFIER ON;
WITH Resolved AS
(
    SELECT p.ProjectPK, 1 AS IsPKMatch
    FROM dbo.tProjects p
    WHERE p.ProjectPK = @ProjectRef
      AND (   p.ProgramFK = @ProgramFK
           OR EXISTS (SELECT 1 FROM dbo.tProjectRevisions r
                      WHERE r.ProjectFK = p.ProjectPK AND r.ProgramFK = @ProgramFK))
    UNION
    SELECT r.ProjectFK, 0
    FROM dbo.tProjectRevisions r
    WHERE r.ProjectId = @ProjectRef
      AND r.ProgramFK = @ProgramFK
),
Chosen AS
(
    SELECT ProjectPK,
           CASE WHEN MAX(IsPKMatch) = 1 THEN N'ProjectPK' ELSE N'ProjectId' END AS MatchedBy
    FROM Resolved
    GROUP BY ProjectPK
)
SELECT
    @ProjectRef                                             AS Ref,
    p.ProjectPK                                             AS ProjectFK,
    @ProgramFK                                              AS ProgramFK,
    c.MatchedBy,
    k.Kind,
    p.IsPublished,
    p.IsRevised,
    st.StageCount,
    CAST(CASE WHEN prog.Status = 1 THEN 1 ELSE 0 END AS BIT) AS ProgramApproved,
    CASE
        WHEN p.IsPublished = 1     THEN N'Blocked'
        WHEN k.Kind = N'LSChild'   THEN N'Hard'
        WHEN prog.Status = 1       THEN N'Blocked'
        WHEN st.StageCount = 1     THEN N'Hard'
        ELSE N'Soft'
    END                                                     AS Tier,
    CASE
        WHEN p.IsPublished = 1     THEN N'published'
        WHEN k.Kind = N'LSChild'   THEN N'Lump Sum itemized project'
        WHEN prog.Status = 1       THEN N'program is approved'
        WHEN st.StageCount = 1     THEN N'first stage entry'
        WHEN st.StageCount = 0     THEN N'no stage history under this program'
        ELSE N'progressed past its first stage'
    END                                                     AS Reason
FROM Chosen c
JOIN dbo.tProjects p ON p.ProjectPK = c.ProjectPK
/*  The program's CURRENT status, resolved exactly as dbo.vProgramLatest resolves
    the Status badge (see GetProgramDeletionEligibility.sql's header): the current
    stage row's revision, not the newest revision row. */
OUTER APPLY (
    SELECT TOP (1) rv.Status
    FROM dbo.tProgramStages ps
    JOIN dbo.tOptionProgramStage o ON o.Id = ps.StageId
    LEFT JOIN dbo.tProgramRevisions rv ON rv.Id = ps.RevisionId
    WHERE ps.ProgramFK = @ProgramFK
    ORDER BY o.StageHierarchy DESC, ps.Id DESC
) prog
CROSS APPLY (
    SELECT CASE
               WHEN p.ParentProjectId IS NOT NULL THEN N'LSChild'
               WHEN p.ProjectType = N'LS'        THEN N'LSParent'
               ELSE N'Ordinary'
           END AS Kind
) k
CROSS APPLY (
    SELECT COUNT(DISTINCT s.StageId) AS StageCount
    FROM dbo.tProjectStages s
    WHERE s.ProjectFK = p.ProjectPK
      AND s.ProgramFK = @ProgramFK
) st;
