/*
    Backup of dbo.pRecomputeProgramCost as it exists on LOCALHOST myps_db_dpwh - a COPY OF
    PRODUCTION - BEFORE Migration.ProgramCost.Dpwh.2026-09-20.sql replaces it.

    WHAT THIS IS. The FUNDING-BASED body: it sums funding through dbo.fProjectFundingProfile (the RISK-108 revision overlay, applied at every stage) for non-LS projects, plus dbo.vLumpSumSet's OriginalAllocation, and writes tProgramRevisions.Cost. The replacement reads per-year
    component costs instead, overlays an approved Formal Revision at GAA-R, and
    counts a Lump Sum parent by its LS component Total at any stage. On this
    database that moves 3 of 32 programs, all downward, by 550,030,026,000 in
    total - see the migration's header.

    PROVENANCE. Captured from localhost / myps_db_dpwh on 2026-09-20 via:
      SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pRecomputeProgramCost'));
    Checksum at capture: CHECKSUM(OBJECT_DEFINITION(...)) = 774742430
    Section 1 of the migration re-checks that checksum before deploying and says
    so in its output; if it reports 'NO', this file is NOT what is deployed and
    the text the migration prints into its -o file is the rollback to use.

    CREATE was changed to CREATE OR ALTER so this file can be replayed; nothing
    else was touched, so the replayed definition differs from the captured one
    by those two words.

    Rollback: run this file against localhost myps_db_dpwh. Roll back
    fProgramStages_backup_dpwh_pre_programcost_20260920.sql with it: the two objects are one rule by two paths and must move
    together. The three indexes the migration adds are additive and can stay.
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* =============================================================================
   GUARD - refuse to run anywhere but localhost myps_db_dpwh
   -----------------------------------------------------------------------------
   Severity 16 + SET NOEXEC ON, so the rest of the file is parsed but not
   executed whoever runs it and whether or not -b is given. Severity 20 would
   end the connection for a sysadmin only (the 2026-09-20 guard review).
   ============================================================================= */
IF DB_NAME() <> N'myps_db_dpwh'
BEGIN
    DECLARE @db NVARCHAR(128) = DB_NAME();
    RAISERROR('REFUSED: this rollback is for localhost myps_db_dpwh only. Connected to %s. Nothing below will execute; run SET NOEXEC OFF or reconnect before reusing this session.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost]
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
 
    -- RISK-108 fix: CROSS APPLY the effective-revision-aware function so an
    -- approved Formal Revision's funding overlays base, instead of a direct
    -- join that was blind to it.
    SELECT @NewCost = ISNULL(SUM(fp.Amount), 0)
    FROM dbo.tProjectStages ps
    JOIN dbo.tProjects prj ON prj.ProjectPK = ps.ProjectFK
    CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId) fp
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
 
    /*  StageId is extra: DBHelper.Models.Procedures.RecomputeProgramCost only
        declares RevisionId and NewCost. EF Core's FromSql mapping onto a
        keyless type ignores result columns with no matching property, so this
        column is harmless to keep and safe to drop -- kept here only because
        dropping it isn't part of this fix. */
    SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
END
 
GO
