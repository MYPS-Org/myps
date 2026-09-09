/* Backup of dbo.vProgramLatest before fixing the pgr/pgs split-brain revision-selection bug (RISK: 4/28 programs return a Frankenstein row mixing fields from two different revisions). Rollback: re-run this exact CREATE OR ALTER. Captured 2026-09-10 via OBJECT_DEFINITION. */
 

CREATE   VIEW [dbo].[vProgramLatest] AS
SELECT
    pg.Id                   AS Id,
    pgr.Id                  AS RevisionId,
    pgs.Id				    AS StageFKId,
    pg.ProgramPK			AS ProgramPK,
    pgr.ProgramId			AS ProgramId,
    pgs.StageId			    AS StageId,
    pgs.StageName           AS StageName,
    pgr.[Name]              AS [Name],
    pgr.[Status]            AS [Status],
    pt.[Name]               AS [Type],
    pg.DataSecurityGroup    AS DataSecurityGroup,
    pg.UserGroup            AS UserGroup,
    projCnt.ProjectCount    AS NumberOfProjects,
    pg.StartYear            AS [StartYear]
FROM dbo.tPrograms pg

LEFT JOIN dbo.tOptionProgramType pt
    ON pt.NameId = pg.Type

CROSS APPLY (
    SELECT TOP 1 pr.Id, pr.[Name], pos.[Name] AS [Status], pr.ProgramId
    FROM dbo.tProgramRevisions pr
    LEFT JOIN tOptionProgramStatus pos ON pos.NameId = pr.[Status]
    -- was INNER JOIN (2026-07-10 fix, ADR-033): a program whose ONLY
    -- revisions had an unmapped Status vanished from vProgramLatest
    -- ENTIRELY -- CROSS APPLY drops the outer row when the subquery returns
    -- zero rows. No FK enforces Status against tOptionProgramStatus.
    WHERE ProgramFK = pg.ProgramPK
    ORDER BY pr.Id DESC
) pgr

CROSS APPLY (
    SELECT TOP 1 ps.StageId, ps.StageName, ps.Id
    FROM dbo.tProgramStages ps
    JOIN dbo.tOptionProgramStage o ON o.Id = ps.StageId
    WHERE ps.ProgramFK = pg.ProgramPK
    -- ADR-075 / RISK-062: order by StageHierarchy, NOT the row's Id.
    -- Ordering by Id assumed stage rows are always inserted in hierarchy order;
    -- a backfilled earlier stage would silently become "current".
    -- Tie-break on Id DESC for repeat visits to the same stage.
    ORDER BY o.StageHierarchy DESC, ps.Id DESC
) pgs

CROSS APPLY (
    SELECT COUNT(*) AS ProjectCount
    FROM dbo.tProjects
    WHERE ProgramFK = pg.ProgramPK
) projCnt;


