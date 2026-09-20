/*
    Backup of dbo.fProgramStages as it exists on LOCALHOST myps_db_dpwh - a COPY OF
    PRODUCTION - BEFORE Migration.ProgramCost.Dpwh.2026-09-20.sql replaces it.

    WHAT THIS IS. The FUNDING-BASED body: the program list's per-stage Cost, summing dbo.tProjectFundingProfile for non-LS projects plus dbo.vLumpSumSet's OriginalAllocation at the matching stage. The replacement reads per-year
    component costs instead, overlays an approved Formal Revision at GAA-R, and
    counts a Lump Sum parent by its LS component Total at any stage. On this
    database that moves 3 of 32 programs, all downward, by 550,030,026,000 in
    total - see the migration's header.

    PROVENANCE. Captured from localhost / myps_db_dpwh on 2026-09-20 via:
      SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.fProgramStages'));
    Checksum at capture: CHECKSUM(OBJECT_DEFINITION(...)) = 867969802
    Section 1 of the migration re-checks that checksum before deploying and says
    so in its output; if it reports 'NO', this file is NOT what is deployed and
    the text the migration prints into its -o file is the rollback to use.

    CREATE was changed to CREATE OR ALTER so this file can be replayed; nothing
    else was touched, so the replayed definition differs from the captured one
    by those two words.

    Rollback: run this file against localhost myps_db_dpwh. Roll back
    pRecomputeProgramCost_backup_dpwh_pre_programcost_20260920.sql with it: the two objects are one rule by two paths and must move
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

 
CREATE OR ALTER FUNCTION [dbo].[fProgramStages]
(
    @ProgramPK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        pgs.Id                  AS Id,
        pg.ProgramPK            AS ProgramPK,
        pgr.ProgramId           AS ProgramId,
        pgs.RevisionId          AS RevisionId,
        pgs.StageId             AS StageId,
        pgs.StageName           AS StageName,
        ISNULL(ss.DisplayName, pgs.StageName) AS StageDisplayName,
        pg.UserGroup            AS UserGroup,
        pg.DataSecurityGroup    AS DataSecurityGroup,
 
        opt.[Name]              AS ProgramType,
        pg.StartYear            AS StartYear,
 
        (SELECT COUNT(*)
         FROM dbo.tProjectStages ps2
         WHERE ps2.ProgramFK = @ProgramPK
           AND ps2.StageId   = pgs.StageId
        )                       AS ProjectCount,
 
        ISNULL((SELECT SUM(fp.Amount)
         FROM dbo.tProjectStages ps3
         JOIN dbo.tProjectFundingProfile fp ON fp.ProjectRevisionFK = ps3.RevisionId AND fp.IsDeleted = 0
         JOIN dbo.tProjects prj ON prj.ProjectPK = ps3.ProjectFK
         WHERE ps3.ProgramFK = @ProgramPK
           AND ps3.StageId   = pgs.StageId
           AND prj.ProjectType <> N'LS'  -- RISK-009 guard
        ), 0)
        /* ADR-055: the program's Lump Sum appropriations at this stage. */
        + ISNULL((SELECT SUM(ls.OriginalAllocation)
                  FROM dbo.vLumpSumSet ls
                  WHERE ls.ProgramFK = @ProgramPK
                    AND ls.StageName = pgs.StageName), 0)
                                AS Cost
 
    FROM dbo.tProgramStages pgs
 
    JOIN dbo.tPrograms pg
        ON pg.ProgramPK = pgs.ProgramFK
    LEFT JOIN tOptionProgramType opt ON opt.NameId = pg.[Type]
    LEFT JOIN dbo.tOptionProgramStage ss ON ss.NameId = pgs.StageId
 
    JOIN dbo.tProgramRevisions pgr
        ON pgr.Id = pgs.RevisionId
 
    WHERE pgs.ProgramFK = @ProgramPK AND pg.IsDeleted = 0
);
GO
