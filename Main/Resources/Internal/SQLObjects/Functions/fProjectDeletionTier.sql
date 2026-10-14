/*  dbo.fProjectDeletionTier — THE single decision for deleting a project. Every
    delete path asks this function and nothing else: Batch Delete, Delete Program
    (through pExecuteProgramDeletion), Delete Lump Sum and Delete Itemized Project,
    and pExecuteProjectDeletion itself before it removes a row. Do not restate the
    rule in C# or in another SQL object; call this.

    POLICY (2026-10-15):
      1. A project may be HARD-deleted only on its first project-stage entry. Once it
         has progressed with its program (a next stage was initiated for it), only a
         SOFT delete applies (the current-stage revision is flagged IsDeleted).
      2. The decision does not depend on the BP / P / MY prefix of the Project ID.
      3. A Lump Sum itemized project (created only at GAA-R) is ALWAYS hard-deleted,
         even when revised, so no row keeps holding its reserved Project ID. The ID
         allocator (tProjectIdSequence) is not rewound: re-itemizing issues a new one.
      A published project is never deleted by any path.

    TIER, first match wins:
      Blocked  tProjects.IsPublished = 1.
      Hard     Kind = 'LSChild'                 (rule 3).
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
    see MYPS.DatabaseTests/ProjectIdGenerationTests.cs). The function therefore
    returns ONE ROW PER PROJECT the reference names, never a silent pick: MatchedBy
    says whether it matched that project's PK. A caller resolving what a USER typed
    must refuse a reference with more than one row as ambiguous (Batch Delete,
    restore). A caller that already holds the ProjectPK (pExecuteProjectDeletion,
    pExecuteProgramDeletion, the Lump Sum actions) takes the row whose ProjectFK is
    that PK. No match: zero rows.

    Kind: 'LSChild'  tProjects.ParentProjectId IS NOT NULL (an itemized project);
          'LSParent' ProjectType = 'LS' and no parent;
          'Ordinary' otherwise. */
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER FUNCTION dbo.fProjectDeletionTier
(
    @ProjectRef NVARCHAR(200),
    @ProgramFK  NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
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
        CASE
            WHEN p.IsPublished = 1     THEN N'Blocked'
            WHEN k.Kind = N'LSChild'   THEN N'Hard'
            WHEN st.StageCount = 1     THEN N'Hard'
            ELSE N'Soft'
        END                                                     AS Tier,
        CASE
            WHEN p.IsPublished = 1     THEN N'published'
            WHEN k.Kind = N'LSChild'   THEN N'Lump Sum itemized project'
            WHEN st.StageCount = 1     THEN N'first stage entry'
            WHEN st.StageCount = 0     THEN N'no stage history under this program'
            ELSE N'progressed past its first stage'
        END                                                     AS Reason
    FROM Chosen c
    JOIN dbo.tProjects p ON p.ProjectPK = c.ProjectPK
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
    ) st
);
GO
