/* Backup of dbo.vProjectLatest before fixing its embedded ProgramName sub-pick (same split-brain root cause as vProgramLatest). Rollback: re-run this exact CREATE OR ALTER. Captured 2026-09-10 via OBJECT_DEFINITION. */
 


CREATE VIEW [dbo].[vProjectLatest]
AS

WITH LatestBase AS
(
    SELECT
        pr.Id,
        pr.ProjectFK,
        pr.ProgramFK,
        pr.ProgramId,
        pr.ProjectId,
        pr.Category,
        pr.Description,
        pr.Region,
        pr.ImplementingOffice,
        pr.CreatedBy,
        pr.CreatedDate,
        pr.UpdatedBy,
        pr.UpdatedDate,

        ROW_NUMBER() OVER
        (
            PARTITION BY pr.ProjectFK
            ORDER BY pr.Id DESC
        ) AS rn

    FROM dbo.tProjectRevisions pr

    WHERE
        pr.IsDeleted = 0
)

SELECT
    p.Id AS Id,

    lb.Id AS RevisionId,

    rd.ProjectRevisionFK AS OldSourceId,

    ps.Id AS StageFK,

    p.ProjectPK,

    lb.ProgramFK,

    lb.ProgramId,


    -- ========================================================================
    -- PROJECT ID
    --
    -- Once Revision is effective, the Revision value is authoritative,
    -- including NULL.
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN la.ProjectId
        ELSE lb.ProjectId
    END AS ProjectId,


    pgr.Name AS ProgramName,

    ps.StageName,


    -- ========================================================================
    -- CATEGORY
    --
    -- Do NOT use ISNULL(la.Category, lb.Category).
    --
    -- An approved Revision NULL must remain NULL.
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN la.Category
        ELSE lb.Category
    END AS Category,


    cat.CategoryName,


    -- ========================================================================
    -- DESCRIPTION
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN la.Description
        ELSE lb.Description
    END AS Description,


    -- ========================================================================
    -- REGION
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN la.Region
        ELSE lb.Region
    END AS Region,


    -- ========================================================================
    -- IMPLEMENTING OFFICE
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN la.ImplementingOffice
        ELSE lb.ImplementingOffice
    END AS ImplementingOffice,


    er.Source AS Source,


    -- ========================================================================
    -- ORIGINAL PROJECT CREATED DATE
    -- ========================================================================

    p.CreatedDate AS CreatedDate,


    -- ========================================================================
    -- LAST UPDATED BY
    --
    -- Existing behavior uses the latest Base Revision's UpdatedBy.
    -- Resolve that UserId to the user's Name.
    --
    -- If tUsers cannot resolve the account, retain the stored UserId.
    -- ========================================================================

    ISNULL(
        baseUpdatedUser.[Name],
        lb.UpdatedBy
    ) AS LastUpdatedBy,


    lb.UpdatedDate AS LastUpdatedDate,


    -- ========================================================================
    -- REVISION CREATED BY
    --
    -- Source-aware selection:
    --
    -- Revision ? RevisionDetail.CreatedBy
    -- Base     ? ProjectRevision.CreatedBy
    --
    -- Then resolve the selected UserId to tUsers.Name.
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN ISNULL(
                revisionCreatedUser.[Name],
                rd.CreatedBy
            )

        ELSE ISNULL(
            baseCreatedUser.[Name],
            lb.CreatedBy
        )
    END AS RevisionCreatedBy,


    -- ========================================================================
    -- REVISION CREATED DATE
    -- ========================================================================

    CASE
        WHEN er.Source = N'Revision'
            THEN rd.CreatedDate
        ELSE lb.CreatedDate
    END AS RevisionCreatedDate


FROM dbo.tProjects p


-- ============================================================================
-- LATEST BASE REVISION
-- ============================================================================

INNER JOIN LatestBase lb
    ON lb.ProjectFK = p.ProjectPK
    AND lb.rn = 1


-- ============================================================================
-- EFFECTIVE REVISION
-- ============================================================================

CROSS APPLY dbo.fProjectEffectiveRevision(
    p.ProjectPK
) er


-- ============================================================================
-- REVISION DETAIL
-- ============================================================================

LEFT JOIN dbo.tRevisionDetails rd
    ON rd.Id = er.RevisionDetailFK


-- ============================================================================
-- REVISION PROJECT SNAPSHOT
-- ============================================================================

LEFT JOIN dbo.tRevisionProjectSnapshot la
    ON la.RevisionDetailFK = er.RevisionDetailFK


-- ============================================================================
-- PROGRAM
-- ============================================================================

INNER JOIN dbo.tPrograms pg
    ON pg.ProgramPK = p.ProgramFK


-- ============================================================================
-- LATEST PROGRAM REVISION
-- ============================================================================

OUTER APPLY
(
    SELECT TOP (1)
        prg.Name

    FROM dbo.tProgramRevisions prg

    WHERE
        prg.ProgramFK = pg.ProgramPK

    ORDER BY
        prg.Id DESC
) pgr


-- ============================================================================
-- LATEST / HIGHEST PROJECT STAGE
-- ============================================================================

OUTER APPLY
(
    SELECT TOP (1)
        s.Id,
        s.StageName

    FROM dbo.tProjectStages s

    INNER JOIN dbo.tOptionProgramStage h
        ON h.Id = s.StageId

    INNER JOIN dbo.tProjectRevisions r
        ON r.Id = s.RevisionId
        AND r.IsDeleted = 0

    WHERE
        s.ProjectFK = p.ProjectPK

    ORDER BY
        h.StageHierarchy DESC,
        s.Id DESC
) ps


-- ============================================================================
-- CATEGORY LOOKUP
--
-- IMPORTANT:
-- Lookup follows the effective source.
--
-- If Revision Category is NULL:
--      Category     = NULL
--      CategoryName = NULL
--
-- We do NOT resurrect the Base Category.
-- ============================================================================

LEFT JOIN dbo.tOptionProjectCategory cat
    ON cat.CategoryId =
        CASE
            WHEN er.Source = N'Revision'
                THEN la.Category
            ELSE lb.Category
        END


-- ============================================================================
-- BASE CREATOR USER
-- ============================================================================

LEFT JOIN dbo.tUsers baseCreatedUser
    ON baseCreatedUser.UserId = lb.CreatedBy


-- ============================================================================
-- BASE UPDATED USER
-- ============================================================================

LEFT JOIN dbo.tUsers baseUpdatedUser
    ON baseUpdatedUser.UserId = lb.UpdatedBy


-- ============================================================================
-- REVISION CREATOR USER
-- ============================================================================

LEFT JOIN dbo.tUsers revisionCreatedUser
    ON revisionCreatedUser.UserId = rd.CreatedBy
;

