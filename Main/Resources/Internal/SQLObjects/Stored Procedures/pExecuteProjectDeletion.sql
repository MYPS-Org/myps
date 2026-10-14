/*  dbo.pExecuteProjectDeletion — physically removes every row belonging to
    ONE project under ONE program.

    SELF-ATOMIC, NESTING-SAFE: this procedure opens its own transaction only
    if none is already active (@@TRANCOUNT = 0) when called directly/
    standalone, and commits only the transaction it itself opened. When
    called from inside dbo.pExecuteProgramDeletion's own transaction (the
    per-project loop), it detects the existing transaction, does not open or
    commit a second one, and simply lets any error propagate up via THROW
    so the OUTER transaction rolls back everything -- SQL Server always
    rolls back the full transaction on an inner ROLLBACK regardless of
    nesting depth, so this is correct either way. This was added
    2026-10-14 after a code-behavior-audit found the original version had
    no BEGIN/COMMIT/ROLLBACK TRAN of its own and relied entirely on every
    caller remembering to wrap it -- a real rollback-readiness gap: a
    direct standalone EXEC (SSMS, a future script, a different caller)
    without a caller-supplied transaction would leave a partial delete on
    any mid-cascade failure, with no way back.

    POLICY (finalized 2026-10-14, operator-directed): there is no
    soft-delete path in this procedure. Every project reaching this call is
    force hard-deleted, regardless of its own stage/revision history
    ("hard-delete them all, for now"). The ONLY gate is
    tProjects.IsPublished -- checked via dbo.fProjectDeletionTier before
    any write. If published, this procedure raises an error and performs
    zero writes; the caller must have already excluded published projects
    via its own Pass 1 (see pExecuteProgramDeletion) -- this check here is a
    defense-in-depth backstop, not the primary gate.

    DELETE ORDER (children before parents, FK-safe):
      1. tProjectMajorWorkLocations  (off tProjectMajorWorkItem.Id via WorkItemFK --
                                       confirmed live: no FK constraint exists on this
                                       column, so skipping this step would silently
                                       orphan rows; not skipped)
      2. tProjectComponentCostPerYear (off tProjectComponentCost.Id via ComponentCostFK)
      3. tProjectMajorWorkItem        (off tProjectComponentCost.Id via ComponentCostFK)
      4. tProjectComponentCost        (off tProjectRevisions.Id via ProjectRevisionFK)
      5. tProjectNotes                (off tProjectRevisions.Id via ProjectRevisionFK --
                                        raw column access; dbo.tProjectNotes' real column
                                        is ProjectRevisionFK, the EF model is stale and
                                        declares StageName/ProjectId instead, confirmed
                                        live 2026-10-14 -- irrelevant here since this is a
                                        plain stored procedure, not EF)
      6. tProjectFundingProfile       (off tProjectRevisions.Id via ProjectRevisionFK)
      7. tProjectStages               (ProjectFK + ProgramFK scoped)
      8. tProjectRevisions            (ProjectFK + ProgramFK scoped)
      9. tProjects                    (ONLY if no tProjectStages/tProjectRevisions row
                                        remains for this ProjectFK under ANY OTHER
                                        ProgramFK -- the multi-year guard. A project that
                                        still has real history under a different program
                                        keeps its tProjects row; this program's slice is
                                        still fully removed in steps 1-8.) */
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.pExecuteProjectDeletion
    @ProjectFK NVARCHAR(200),
    @ProgramFK NVARCHAR(200),
    @UserId NVARCHAR(100),
    @CurrentDate DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Tier NVARCHAR(20);
    SELECT @Tier = Tier FROM dbo.fProjectDeletionTier(@ProjectFK, @ProgramFK);

    IF @Tier IS NULL
    BEGIN
        RAISERROR(N'pExecuteProjectDeletion: Project %s was not found under Program %s.', 16, 1, @ProjectFK, @ProgramFK);
        RETURN;
    END

    IF @Tier = N'Blocked'
    BEGIN
        RAISERROR(N'pExecuteProjectDeletion: Project %s is published and cannot be deleted. Cancel it through Programs first.', 16, 1, @ProjectFK);
        RETURN;
    END

    DECLARE @StartedOwnTran BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRANSACTION;
        SET @StartedOwnTran = 1;
    END

    BEGIN TRY
        DECLARE @RevisionIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @RevisionIds (Id)
        SELECT Id FROM dbo.tProjectRevisions
        WHERE ProjectFK = @ProjectFK AND ProgramFK = @ProgramFK;

        DECLARE @CostIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @CostIds (Id)
        SELECT c.Id FROM dbo.tProjectComponentCost c
        WHERE c.ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);

        DECLARE @WorkItemIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @WorkItemIds (Id)
        SELECT w.Id FROM dbo.tProjectMajorWorkItem w
        WHERE w.ComponentCostFK IN (SELECT Id FROM @CostIds);

        -- 1. Work locations off work items
        DELETE FROM dbo.tProjectMajorWorkLocations
        WHERE WorkItemFK IN (SELECT Id FROM @WorkItemIds);

        -- 2. Cost-per-year off component costs
        DELETE FROM dbo.tProjectComponentCostPerYear
        WHERE ComponentCostFK IN (SELECT Id FROM @CostIds);

        -- 3. Major work items off component costs
        DELETE FROM dbo.tProjectMajorWorkItem
        WHERE Id IN (SELECT Id FROM @WorkItemIds);

        -- 4. Component costs off revisions
        DELETE FROM dbo.tProjectComponentCost
        WHERE Id IN (SELECT Id FROM @CostIds);

        -- 5. Notes off revisions (raw column, confirmed live)
        DELETE FROM dbo.tProjectNotes
        WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);

        -- 6. Funding profile off revisions
        DELETE FROM dbo.tProjectFundingProfile
        WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);

        -- 7. Stages scoped to this project+program
        DELETE FROM dbo.tProjectStages
        WHERE ProjectFK = @ProjectFK AND ProgramFK = @ProgramFK;

        -- 8. Revisions scoped to this project+program
        DELETE FROM dbo.tProjectRevisions
        WHERE Id IN (SELECT Id FROM @RevisionIds);

        -- 9. The tProjects row itself, ONLY if no OTHER program still
        --    references this ProjectFK via stages or revisions (multi-year guard)
        IF NOT EXISTS (SELECT 1 FROM dbo.tProjectStages WHERE ProjectFK = @ProjectFK AND ProgramFK <> @ProgramFK)
           AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions WHERE ProjectFK = @ProjectFK AND ProgramFK <> @ProgramFK)
        BEGIN
            DELETE FROM dbo.tProjects WHERE ProjectPK = @ProjectFK;
        END

        IF @StartedOwnTran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
