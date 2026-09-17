/*
    MYPS project stage targets read model

    Backs the "Component Targets" panel on the project details page:
    project -> component -> its targets at every Program Stage the project has
    undergone, derived from the legacy desktop app's per-project Targets tab.
    The panel shows Stage Name, Project Description, Component Description,
    Type of Work, Target and Target Unit; the legacy Source and Component ID
    columns are kept in the result set for callers that want them.

    Deployment:
      This repo has no migration runner for database objects. Apply this
      script to the target database by hand before deploying the
      ProjectController.ShowProjectStageTargets and
      ProjectController.ShowProjectTargetComponents endpoints, exactly as
      Revision.Queue.sql is handled.

    Dependencies (all pre-existing):
      - dbo.fProjectStages(@ProjectFK)
      - dbo.fProjectDetails(@ProjectFK, @StageId)
      - dbo.fProjectMajorWorkItem(@ProjectFK, @StageId)
      - dbo.fProjectMajorWorkLocations(@ProjectFK, @StageId)
      - dbo.fProjectComponentCost(@ProjectFK, @StageId)
      - dbo.fProgramStages(@ProgramFK)
      - dbo.tOptionProgramStage, dbo.tOptionScopeOfWork

    Design notes:
      - This composes over the existing per-stage TVFs rather than the base
        tables on purpose. Those functions already encapsulate the "which
        project revision applies at this stage" resolution; duplicating that
        logic here would risk silently disagreeing with the project detail
        screen.
      - Unlike dbo.fProgramStageTargets, this function takes no @StageId: the
        panel groups by component and shows every stage side by side, so it
        fans out over dbo.fProjectStages instead.
      - Id is a ROW_NUMBER, not wi.Id. A work item id is unique within a
        revision, and distinct stages usually map to distinct revisions -- but
        that is not guaranteed, and a duplicate key would make the keyset
        pagination helper skip or repeat rows at a page boundary. The dense
        ROW_NUMBER is unique by construction and carries the stage-progression
        sort order. The real work item id is exposed as WorkItemId.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER FUNCTION dbo.fProjectStageTargets
(
    @ProjectFK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        -- Dense, stable key: the keyset pagination key AND the stage-progression
        -- sort order. Stages with no hierarchy row sort last rather than first.
        -- The CAST is load-bearing: StageHierarchy is decimal(7,5), so it holds only
        -- two integer digits, and ISNULL takes its type from the first argument --
        -- without widening it first, the sentinel overflows the conversion.
        ROW_NUMBER() OVER (
            ORDER BY
                ISNULL(CAST(ops.StageHierarchy AS DECIMAL(12, 5)), 999),
                s.StageId,
                wi.ComponentId,
                wi.Id
        )                                           AS Id,
        wi.Id                                       AS WorkItemId,
        @ProjectFK                                  AS ProjectPK,
        pd.ProjectId                                AS ProjectId,
        -- The project description as it stands at this stage -- the same value the
        -- Project Stages accordion on /projects shows. fProjectStages resolves each
        -- stage to its effective revision, so this tracks a description edited
        -- mid-programme rather than pinning every row to the latest one.
        s.Description                               AS ProjectDescription,
        s.StageId                                   AS StageId,
        s.StageName                                 AS StageName,
        -- The stage's long form, e.g. "NEP-Errata" for NEP-E. fProjectStages reads it
        -- from dbo.tOptionProgramStage.DisplayName, which is what the panel shows;
        -- StageName above is the short code, kept for the StageName filter.
        s.StageDisplayName                          AS StageDisplayName,
        -- Legacy "Source" is a composed stage label, e.g. "NEP 2026 OO-1". The panel
        -- shows StageDisplayName above instead; the composed form is kept for other
        -- callers. It is built from:
        -- stage short name + program start year + the project's Organizational
        -- Outcome (parsed from the category).
        -- NOT to be confused with wi.Source, which is the Base/Revision
        -- provenance flag exposed separately as Provenance below.
        LTRIM(RTRIM(
            s.StageName
            + ISNULL(N' ' + CAST(ps.StartYear AS NVARCHAR(4)), N'')
            + ISNULL(N' ' + oo.Code, N'')
        ))                                          AS Source,
        -- Where the row came from: 'Base' (project record) or 'Revision'
        -- (effective revision snapshot). Kept for callers that need to tell an
        -- approved figure from a pending revision.
        wi.Source                                   AS Provenance,
        wi.ComponentId                              AS ComponentId,
        -- Legacy screen renders "P01000001LZ-CW1".
        pd.ProjectId + N'-' + wi.ComponentId        AS ComponentCode,
        cc.Description                              AS ComponentDescription,
        sw.Description                              AS TypeOfWork,
        t.PhysicalTarget                            AS Target,
        -- Work locations carry the authoritative unit; fall back to the
        -- scope-of-work measure when a component has no locations yet.
        COALESCE(t.TargetUnit, sw.Measure)          AS TargetUnit
    FROM dbo.fProjectStages(@ProjectFK) s
    -- One row per work item per stage, guaranteed. dbo.fProjectMajorWorkItem can emit the
    -- same work item several times over (observed: work item 104 of BP01100001MN returned
    -- four byte-identical rows at every stage after BP). That is a defect upstream of this
    -- function, but it would surface here as duplicated target rows, so collapse it on the
    -- way in rather than trusting the source to be distinct.
    CROSS APPLY
    (
        SELECT
            w.Id,
            w.Source,
            w.ComponentId,
            w.WorkTypeFK,
            ROW_NUMBER() OVER (PARTITION BY w.Id ORDER BY w.Source) AS DedupeRank
        FROM dbo.fProjectMajorWorkItem(@ProjectFK, s.StageId) w
        WHERE w.IsDeleted = 0
    ) wi
    -- TOP 1: fProjectDetails can union a Base and a Revision row; we only want
    -- the identity columns, which are the same on both.
    OUTER APPLY
    (
        SELECT TOP 1
            d.ProjectId,
            d.ProgramFK,
            d.CategoryName
        FROM dbo.fProjectDetails(@ProjectFK, s.StageId) d
        ORDER BY d.Id
    ) pd
    -- Sum over DISTINCT work locations. fProjectMajorWorkLocations repeats rows the same
    -- way fProjectMajorWorkItem does (observed: location 116 of BP01100001MN returned four
    -- times), and here the damage is worse than a duplicated row -- it multiplies the
    -- target itself. Deduplicating on the location id before SUM is what keeps the figure
    -- honest.
    OUTER APPLY
    (
        SELECT
            SUM(d.PhysicalTarget) AS PhysicalTarget,
            MAX(d.TargetUnit)     AS TargetUnit
        FROM
        (
            SELECT
                l.PhysicalTarget,
                l.TargetUnit,
                ROW_NUMBER() OVER (PARTITION BY l.Id ORDER BY (SELECT NULL)) AS DedupeRank
            FROM dbo.fProjectMajorWorkLocations(@ProjectFK, s.StageId) l
            WHERE l.WorkItemFK = wi.Id
              AND l.IsDeleted = 0
        ) d
        WHERE d.DedupeRank = 1
    ) t
    OUTER APPLY
    (
        SELECT TOP 1
            c.Description
        FROM dbo.fProjectComponentCost(@ProjectFK, s.StageId) c
        WHERE c.ComponentId = wi.ComponentId
          AND c.IsDeleted = 0
        ORDER BY c.Id
    ) cc
    -- Program start year for the composed Source label.
    OUTER APPLY
    (
        SELECT TOP 1
            g.StartYear
        FROM dbo.fProgramStages(pd.ProgramFK) g
        WHERE g.StageId = s.StageId
    ) ps
    -- Organizational Outcome code, parsed from a category named like
    -- "OO1: Ensure Safe and Reliable National Road System" -> "OO-1".
    -- Categories that are not OO-shaped (e.g. "MFO 1: ...") yield NULL and are
    -- simply omitted from the label rather than mislabelled.
    OUTER APPLY
    (
        SELECT
            CASE
                WHEN pd.CategoryName LIKE N'OO[0-9]%'
                THEN N'OO-' + LEFT(
                        SUBSTRING(pd.CategoryName, 3, 10),
                        PATINDEX(N'%[^0-9]%', SUBSTRING(pd.CategoryName, 3, 10) + N'X') - 1
                     )
            END AS Code
    ) oo
    LEFT JOIN dbo.tOptionProgramStage ops
        ON ops.NameId = s.StageId
    LEFT JOIN dbo.tOptionScopeOfWork sw
        ON sw.Enum = wi.WorkTypeFK
    WHERE wi.DedupeRank = 1
);
GO
