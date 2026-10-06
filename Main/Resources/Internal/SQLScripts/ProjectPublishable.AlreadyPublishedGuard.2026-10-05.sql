/* #############################################################################
   ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql
   -----------------------------------------------------------------------------
   WHAT THIS DOES. CREATE OR ALTER of dbo.pRecomputeProjectPublishable only,
   adding one guard to its WHERE clause: AND p.IsPublished = 0. Nothing else
   about the procedure's logic, parameters, or result set changes.

   WHY. Per the operator (2026-10-05): once a project is published to PCMA
   (tProjects.IsPublished = 1), it is never published again through this path
   -- publishing again only happens through a separate revision function/
   module, out of scope here. IsPublishable is meant to freeze at whatever
   value it held at the moment of publishing and never drift afterward.

   Confirmed this procedure violates that today. It is called automatically
   from WebAPI/Controllers/Programs/ProgramController.cs (UpdateProgramDetails,
   ~line 814) every time a program is saved as Approved at GAA-R, and its
   WHERE clause filters only by ProgramFK -- it recomputes IsPublishable for
   EVERY project in the program, including already-published ones, with no
   exclusion. Live evidence on myps_db_dev, 2026-10-05:

       SELECT IsPublished, IsPublishable, COUNT(*) FROM tProjects
       GROUP BY IsPublished, IsPublishable;
       -- IsPublished=1, IsPublishable=0  ->  16 rows

   Those 16 rows are a published project whose underlying data changed after
   publishing (e.g. a cost-per-year row removed) such that it no longer
   passes the 7 GAA-R rules; a later unrelated Approve-at-GAA-R save then
   silently flipped IsPublishable to 0 on a project that should never be
   touched by this flag again. Per the operator, these 16 rows are NOT to be
   data-corrected -- IsPublished=1 with IsPublishable=0 is an accepted,
   understood terminal state, not corruption. Only the procedure's going-
   forward behavior is being fixed here, so the state can no longer drift
   further (e.g. back to IsPublishable=1, which would be equally undesirable
   even though it looks "fixed") after this script runs.

   SCOPE. This script fixes ONLY pRecomputeProjectPublishable. The two sibling
   defects in the SAME WHERE-clause-missing-IsPublished family --
   BatchRestrictPublish and BatchAllowPublish in ProgramController.cs -- are
   C# changes, not SQL, and ship in the same commit/PR as this script but as
   separate .cs edits. See that PR's description for the full three-part fix.

   BACKUP OF THE PRE-FIX DEFINITION. Captured by this same script, as
   pRecomputeProjectPublishable_backup_pre_published_guard_20261005, following
   the existing repo convention (see e.g.
   pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql).
   To roll back: DROP PROCEDURE dbo.pRecomputeProjectPublishable; then
   sp_rename the backup object back to the original name, OR re-run this
   backup's CREATE body under the original name.
   ============================================================================= */

/* =============================================================================
   0. BACKUP the pre-fix definition under a new name (idempotent: drops and
      re-creates the backup copy if this script is ever run twice)
   ============================================================================= */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.pRecomputeProjectPublishable_backup_pre_published_guard_20261005', 'P') IS NOT NULL
    DROP PROCEDURE dbo.pRecomputeProjectPublishable_backup_pre_published_guard_20261005;
GO

CREATE PROCEDURE [dbo].[pRecomputeProjectPublishable_backup_pre_published_guard_20261005]
    @ProgramFK NVARCHAR(50)          -- = tProjects.ProgramFK / tPrograms.ProgramPK
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @GAARStageId INT = (SELECT Id FROM dbo.tOptionProgramStage WHERE Name = 'GAA-R');

    ;WITH
    LatestBase AS (
        SELECT pr.Id, pr.ProjectFK,
               pr.DEO, pr.LegislativeDistrict, pr.ImplementingOffice, pr.OperatingUnit,
               ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
        FROM dbo.tProjectRevisions pr
        WHERE pr.IsDeleted = 0
    )
    UPDATE p
    SET p.IsPublishable =
        CASE WHEN
            -- 1. location fields non-blank (unchanged -- project-level scalar fields)
            lb.DEO                 IS NOT NULL AND DATALENGTH(lb.DEO)                 > 0 AND
            lb.LegislativeDistrict IS NOT NULL AND DATALENGTH(lb.LegislativeDistrict) > 0 AND
            lb.ImplementingOffice  IS NOT NULL AND DATALENGTH(lb.ImplementingOffice)  > 0 AND
            lb.OperatingUnit       IS NOT NULL AND DATALENGTH(lb.OperatingUnit)       > 0
            -- 2. at least one component must exist -- via the overlay the export reads
            AND EXISTS (SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId))
            -- 3+4. every component has >=1 per-year row, and every per-year row is well-formed
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId) fcc
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectComponentCostPerYear(p.ProjectPK, @GAARStageId) fccy
                    WHERE fccy.ComponentId = fcc.ComponentId
                )
            )
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCostPerYear(p.ProjectPK, @GAARStageId) fccy
                WHERE fccy.Amount IS NULL OR fccy.Year IS NULL
                   OR fccy.StartDate IS NULL OR fccy.EndDate IS NULL
            )
            -- 5. STRICT: every component has >=1 major work item
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId) fcc
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectMajorWorkItem(p.ProjectPK, @GAARStageId) fwi
                    WHERE fwi.ComponentId = fcc.ComponentId
                )
            )
            -- 6. STRICT: every work item has >=1 location
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectMajorWorkItem(p.ProjectPK, @GAARStageId) fwi
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectMajorWorkLocations(p.ProjectPK, @GAARStageId) fwl
                    WHERE fwl.ComponentId = fwi.ComponentId AND fwl.YearOfWork = fwi.YearOfWork
                )
            )
            -- 7. at least one funding profile row
            AND EXISTS (SELECT 1 FROM dbo.fProjectFundingProfile(p.ProjectPK, @GAARStageId))
        THEN 1 ELSE 0 END
    FROM dbo.tProjects p
    JOIN LatestBase lb ON lb.ProjectFK = p.ProjectPK AND lb.rn = 1
    WHERE p.ProgramFK = @ProgramFK;

    SELECT @@ROWCOUNT AS ProjectsEvaluated;
END;
GO

/* =============================================================================
   1. CREATE OR ALTER the real procedure with the one-line guard added
   ============================================================================= */
CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProjectPublishable]
    @ProgramFK NVARCHAR(50)          -- = tProjects.ProgramFK / tPrograms.ProgramPK
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @GAARStageId INT = (SELECT Id FROM dbo.tOptionProgramStage WHERE Name = 'GAA-R');

    ;WITH
    LatestBase AS (
        SELECT pr.Id, pr.ProjectFK,
               pr.DEO, pr.LegislativeDistrict, pr.ImplementingOffice, pr.OperatingUnit,
               ROW_NUMBER() OVER (PARTITION BY pr.ProjectFK ORDER BY pr.Id DESC) AS rn
        FROM dbo.tProjectRevisions pr
        WHERE pr.IsDeleted = 0
    )
    UPDATE p
    SET p.IsPublishable =
        CASE WHEN
            -- 1. location fields non-blank (unchanged -- project-level scalar fields)
            lb.DEO                 IS NOT NULL AND DATALENGTH(lb.DEO)                 > 0 AND
            lb.LegislativeDistrict IS NOT NULL AND DATALENGTH(lb.LegislativeDistrict) > 0 AND
            lb.ImplementingOffice  IS NOT NULL AND DATALENGTH(lb.ImplementingOffice)  > 0 AND
            lb.OperatingUnit       IS NOT NULL AND DATALENGTH(lb.OperatingUnit)       > 0
            -- 2. at least one component must exist -- via the overlay the export reads
            AND EXISTS (SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId))
            -- 3+4. every component has >=1 per-year row, and every per-year row is well-formed
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId) fcc
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectComponentCostPerYear(p.ProjectPK, @GAARStageId) fccy
                    WHERE fccy.ComponentId = fcc.ComponentId
                )
            )
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCostPerYear(p.ProjectPK, @GAARStageId) fccy
                WHERE fccy.Amount IS NULL OR fccy.Year IS NULL
                   OR fccy.StartDate IS NULL OR fccy.EndDate IS NULL
            )
            -- 5. STRICT: every component has >=1 major work item
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectComponentCost(p.ProjectPK, @GAARStageId) fcc
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectMajorWorkItem(p.ProjectPK, @GAARStageId) fwi
                    WHERE fwi.ComponentId = fcc.ComponentId
                )
            )
            -- 6. STRICT: every work item has >=1 location
            AND NOT EXISTS (
                SELECT 1 FROM dbo.fProjectMajorWorkItem(p.ProjectPK, @GAARStageId) fwi
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.fProjectMajorWorkLocations(p.ProjectPK, @GAARStageId) fwl
                    WHERE fwl.ComponentId = fwi.ComponentId AND fwl.YearOfWork = fwi.YearOfWork
                )
            )
            -- 7. at least one funding profile row
            AND EXISTS (SELECT 1 FROM dbo.fProjectFundingProfile(p.ProjectPK, @GAARStageId))
        THEN 1 ELSE 0 END
    FROM dbo.tProjects p
    JOIN LatestBase lb ON lb.ProjectFK = p.ProjectPK AND lb.rn = 1
    WHERE p.ProgramFK = @ProgramFK
      -- 2026-10-05 added: once a project is published to PCMA (IsPublished = 1),
      -- it is never published again through this path -- see this script's
      -- header for the operator confirmation and the 16-row live evidence this
      -- fixes. IsPublishable now freezes at its value at the moment of
      -- publishing and this procedure never writes it again afterward.
      AND p.IsPublished = 0;

    SELECT @@ROWCOUNT AS ProjectsEvaluated;
END;
GO

/* =============================================================================
   2. SMOKE CHECK - the guard is in place and the procedure still binds and
      runs (rolled back, touches no real data)
   ============================================================================= */
PRINT '--- guard text present in the live definition? (want 1 row) ---';
SELECT OBJECT_NAME(object_id) AS [procedure]
FROM sys.sql_modules
WHERE object_id = OBJECT_ID('dbo.pRecomputeProjectPublishable')
  AND definition LIKE '%AND p.IsPublished = 0%';
GO

PRINT '--- procedure binds and runs (rolled back) ---';
DECLARE @pk NVARCHAR(200) =
    (SELECT TOP 1 ProgramPK FROM dbo.tPrograms WHERE IsDeleted = 0);

IF @pk IS NOT NULL
BEGIN
    BEGIN TRAN;
        EXEC dbo.pRecomputeProjectPublishable @ProgramFK = @pk;
    ROLLBACK TRAN;
END
ELSE
    PRINT 'No program available to exercise the procedure against.';
GO

PRINT '--- already-published rows this fixes going forward (informational; not corrected) ---';
SELECT IsPublished, IsPublishable, COUNT(*) AS Cnt
FROM dbo.tProjects
GROUP BY IsPublished, IsPublishable
ORDER BY IsPublished DESC, IsPublishable DESC;
GO

PRINT CONCAT('Finished : ', CONVERT(varchar(19), GETDATE(), 120));
GO
