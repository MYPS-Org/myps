/*
    Backup of dbo.pRecomputeProgramCost as it existed on myps_db_dev BEFORE the 2026-09-15 fix
    that changed the funding sum from a direct join against dbo.tProjectFundingProfile (base only)
    to a CROSS APPLY of dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId) -- the function that
    overlays a fully-approved (RO=1, CO=1) Formal Revision's funding on top of base.

    This is the RISK-108/ADR-132/ADR-133 defect: the live procedure was blind to approved Formal
    Revision funding changes, so a program's Cost kept reflecting the pre-revision base amount even
    after the revision was fully approved with a different funding total. The fix for this was
    already written and tested against an embedded copy of the SQL in
    MYPS.DatabaseTests/RecomputeProgramCostTests.cs, but had never been applied to the canonical
    checked-in source (Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql)
    or to this live database -- both still had this exact pre-fix definition.

    Confirmed live via: only 5 fully-approved revisions existed on myps_db_dev at investigation
    time, all with revision funding coincidentally equal to base funding, so the defect was latent
    (present in the code path, not yet visibly wrong on this dataset) rather than actively producing
    a wrong number for any program at capture time.

    Captured live via: SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pRecomputeProgramCost'));

    Rollback: re-run this exact CREATE OR ALTER to restore the pre-fix (base-join) behavior.
*/

CREATE   PROCEDURE [dbo].[pRecomputeProgramCost]
    @ProgramPK NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @NewCost DECIMAL(18,2);

    SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
    FROM dbo.tProgramRevisions pgr
    JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
    WHERE pgr.ProgramFK = @ProgramPK
    ORDER BY pgr.Id DESC;

    IF @CurrentRevisionId IS NULL
    BEGIN
        RAISERROR('pRecomputeProgramCost: program %s has no revisions to recompute Cost for.', 16, 1, @ProgramPK);
        RETURN;
    END

    SELECT @NewCost = ISNULL(SUM(fp.Amount), 0)
    FROM dbo.tProjectStages ps
    JOIN dbo.tProjectFundingProfile fp
        ON fp.ProjectRevisionFK = ps.RevisionId AND fp.IsDeleted = 0
    JOIN dbo.tProjects prj ON prj.ProjectPK = ps.ProjectFK
    WHERE ps.ProgramFK = @ProgramPK
      AND ps.StageId = @CurrentStageId
      AND prj.ProjectType <> N'LS';  -- RISK-009 guard

    /*  ADR-055: Program Total = non-LS project funding + the program's Lump Sum
        appropriations. Lump Sum Projects follow their program's stage, so all of
        the program's are the current-stage set. */
    SET @NewCost = @NewCost + ISNULL((SELECT SUM(ls.OriginalAllocation)
                                      FROM dbo.vLumpSumSet ls
                                      WHERE ls.ProgramFK = @ProgramPK), 0);

    UPDATE dbo.tProgramRevisions
    SET Cost = @NewCost
    WHERE Id = @CurrentRevisionId;

    /*  StageId is required by DBHelper.Models.Procedures.RecomputeProgramCost,
        which UpdateProjectDetails maps this result set onto with FromSql.
        Omitting it aborts the whole update with "The required column 'StageId'
        was not present in the results of a 'FromSql' operation." */
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
