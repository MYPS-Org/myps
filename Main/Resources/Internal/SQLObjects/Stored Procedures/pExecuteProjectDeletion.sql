/*  dbo.pExecuteProjectDeletion — THE hard delete of ONE project under ONE program:
    every row the project has under @ProgramFK is physically removed. It is the only
    hard cascade; Batch Delete, Delete Program, Delete Lump Sum and Delete Itemized
    Project all call it rather than deleting rows themselves.

    GATE: dbo.fProjectDeletionTier, the single deletion rule (see its header). This
    procedure runs only when the tier is 'Hard' — a first-stage-entry project, or a
    Lump Sum itemized project. 'Blocked' (published) and 'Soft' (progressed past its
    first stage) raise an error and write nothing; a soft delete is the caller's
    job, never this procedure's. @ProjectFK may be the ProjectPK or any revision
    ProjectId of the project under @ProgramFK (BP/P-agnostic, resolved by the
    function). A ProjectPK always names its own project; any other reference that
    names more than one project is refused as ambiguous.

    REFUSALS start with 'DELETE_REFUSED: ' followed by a plain-language reason; the
    C# wrappers (Helpers/ProjectHelper.cs) turn exactly those into
    DeletionRefusedException so the reason reaches the user as a 400.

    AUDIT: one tTransactionLog row per hard-deleted project (ReferenceId = ProjectPK,
    OldValue = a JSON snapshot of its stages and ids), in the same transaction.

    TRANSACTIONS: opens its own transaction only when none is active, and commits or
    rolls back only what it opened. Inside a caller's transaction (Delete Program's
    procedure, Batch Delete's and the Lump Sum actions' EF transaction) it never
    issues a ROLLBACK itself: that used to add error 266 ("Transaction count after
    EXECUTE…") on top of, and in place of, the real error. The real error is
    re-thrown, and because of XACT_ABORT ON SQL Server then ends the caller's
    transaction as the error leaves the procedure; callers treat it as finished
    (their rollbacks are guarded for exactly that).

    DELETE ORDER (children first). The tables marked * have no foreign key, so the
    database would not object to skipping them; they are deleted explicitly so no
    row is left pointing at a removed revision.
      Formal revisions, off tRevisionDetails (FK to tProjectRevisions and tProjects):
        tRevisionProjectMajorWorkLocations*  off tRevisionProjectMajorWorkItem.Id
        tRevisionProjectMajorWorkItem*       off tRevisionProjectComponentCost.Id
        tRevisionProjectComponentCostPerYear off tRevisionProjectComponentCost.Id
        tRevisionProjectComponentCost, tRevisionProjectFundingProfile,
        tRevisionProjectSnapshot, tRevisionApprovals, tRevisionDocuments,
        tRevisionForCorrectionDetails        off tRevisionDetails.Id
        tRevisionPCMAComponent*              by TransactionId, only when no other
                                             tRevisionDetails row shares it
        tRevisionDetails                     off this program's revisions
        tRevisionProjects*                   by ProjectFK + ProgramFK
      The project's own rows:
        tProjectMajorWorkLocations*          off tProjectMajorWorkItem.Id
        tProjectComponentCostPerYear*        off tProjectComponentCost.Id
        tProjectMajorWorkItem*               off tProjectComponentCost.Id
        tProjectComponentCost                off tProjectRevisions.Id
        tProjectNotes, tProjectFundingProfile,
        tProjectSupportingDocs*              off tProjectRevisions.Id
        tProjectStages, tProjectRevisions    scoped to (ProjectFK, ProgramFK)
        tProjects                            only when no stage or revision remains
                                             under another ProgramFK (multi-year guard)
    Supporting-document FILES are not touched: a stage advance copies the path, not
    the file, so a file may still be referenced by another row. Only the rows go. */
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

    DECLARE @Matches INT, @Tier NVARCHAR(20), @Reason NVARCHAR(100), @ResolvedFK NVARCHAR(200),
            @Kind NVARCHAR(20), @StageCount INT;

    -- A ProjectPK names exactly its own project, even when the same string is also
    -- another project's revision ProjectId (the function returns both rows).
    SELECT @Tier = Tier, @Reason = Reason, @ResolvedFK = ProjectFK, @Kind = Kind, @StageCount = StageCount
    FROM dbo.fProjectDeletionTier(@ProjectFK, @ProgramFK)
    WHERE ProjectFK = @ProjectFK;

    IF @ResolvedFK IS NULL
    BEGIN
        -- Any other reference (a revision ProjectId, BP- or P-form) must name one project.
        SELECT @Matches = COUNT(*) FROM dbo.fProjectDeletionTier(@ProjectFK, @ProgramFK);

        IF @Matches = 0
        BEGIN
            RAISERROR(N'DELETE_REFUSED: Project %s was not found in this program.', 16, 1, @ProjectFK);
            RETURN;
        END

        IF @Matches > 1
        BEGIN
            RAISERROR(N'DELETE_REFUSED: Project ID %s matches more than one project in this program.', 16, 1, @ProjectFK);
            RETURN;
        END

        SELECT @Tier = Tier, @Reason = Reason, @ResolvedFK = ProjectFK, @Kind = Kind, @StageCount = StageCount
        FROM dbo.fProjectDeletionTier(@ProjectFK, @ProgramFK);
    END

    IF @Tier <> N'Hard'
    BEGIN
        -- The DELETE_REFUSED: token is what the C# wrappers turn into DeletionRefusedException,
        -- whose text reaches the user verbatim; keep the reason in plain language.
        RAISERROR(N'DELETE_REFUSED: Project %s cannot be permanently deleted: %s.', 16, 1, @ResolvedFK, @Reason);
        RETURN;
    END

    SET @ProjectFK = @ResolvedFK;

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

        -- Formal revisions (tRevisionDetails and everything hanging off it)
        -- AUDIT (2026-10-15): one tTransactionLog row per hard-deleted project, written in
        -- the same transaction as the delete, BEFORE the rows go, so OldValue can say what
        -- the project was. It rolls back with the delete if anything below fails.
        DECLARE @Snapshot NVARCHAR(MAX) = (
            SELECT @ProjectFK AS ProjectPK, @ProgramFK AS ProgramFK, @Kind AS Kind,
                   @StageCount AS StageCount, @Reason AS Reason,
                   (SELECT s.StageName, r.ProjectId
                    FROM dbo.tProjectStages s
                    JOIN dbo.tProjectRevisions r ON r.Id = s.RevisionId
                    WHERE s.ProjectFK = @ProjectFK AND s.ProgramFK = @ProgramFK
                    ORDER BY s.Id
                    FOR JSON PATH) AS Stages
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

        INSERT INTO dbo.tTransactionLog
            (ReferenceId, TransactionType, AffectedTable, AffectedColumn, OldValue, NewValue, CreatedBy, Hostname, CreatedDate)
        VALUES
            (@ProjectFK, N'Delete', N'tProjects, tProjectRevisions, tProjectStages (+ child rows)', N'Row',
             ISNULL(@Snapshot, N'{}'), N'Permanently deleted', ISNULL(@UserId, N''), ISNULL(HOST_NAME(), N''), @CurrentDate);

        DECLARE @RevDetailIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @RevDetailIds (Id)
        SELECT d.Id FROM dbo.tRevisionDetails d
        WHERE d.ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);

        DECLARE @RevCostIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @RevCostIds (Id)
        SELECT c.Id FROM dbo.tRevisionProjectComponentCost c
        WHERE c.RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);

        DECLARE @RevWorkItemIds TABLE (Id INT PRIMARY KEY);
        INSERT INTO @RevWorkItemIds (Id)
        SELECT w.Id FROM dbo.tRevisionProjectMajorWorkItem w
        WHERE w.ComponentCostFK IN (SELECT Id FROM @RevCostIds);

        DELETE FROM dbo.tRevisionProjectMajorWorkLocations WHERE RevisionWorkItemFK IN (SELECT Id FROM @RevWorkItemIds);
        DELETE FROM dbo.tRevisionProjectMajorWorkItem      WHERE Id IN (SELECT Id FROM @RevWorkItemIds);
        DELETE FROM dbo.tRevisionProjectComponentCostPerYear WHERE RevisionComponentCostFK IN (SELECT Id FROM @RevCostIds);
        DELETE FROM dbo.tRevisionProjectComponentCost      WHERE Id IN (SELECT Id FROM @RevCostIds);
        DELETE FROM dbo.tRevisionProjectFundingProfile     WHERE RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);
        DELETE FROM dbo.tRevisionProjectSnapshot           WHERE RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);
        DELETE FROM dbo.tRevisionApprovals                 WHERE RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);
        DELETE FROM dbo.tRevisionDocuments                 WHERE RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);
        DELETE FROM dbo.tRevisionForCorrectionDetails      WHERE RevisionDetailFK IN (SELECT Id FROM @RevDetailIds);

        DELETE pc FROM dbo.tRevisionPCMAComponent pc
        WHERE pc.TransactionId IN (SELECT d.TransactionId FROM dbo.tRevisionDetails d
                                   WHERE d.Id IN (SELECT Id FROM @RevDetailIds))
          AND NOT EXISTS (SELECT 1 FROM dbo.tRevisionDetails o
                          WHERE o.TransactionId = pc.TransactionId
                            AND o.Id NOT IN (SELECT Id FROM @RevDetailIds));

        DELETE FROM dbo.tRevisionDetails  WHERE Id IN (SELECT Id FROM @RevDetailIds);
        DELETE FROM dbo.tRevisionProjects WHERE ProjectFK = @ProjectFK AND ProgramFK = @ProgramFK;

        -- The project's own rows
        DELETE FROM dbo.tProjectMajorWorkLocations   WHERE WorkItemFK IN (SELECT Id FROM @WorkItemIds);
        DELETE FROM dbo.tProjectComponentCostPerYear WHERE ComponentCostFK IN (SELECT Id FROM @CostIds);
        DELETE FROM dbo.tProjectMajorWorkItem        WHERE Id IN (SELECT Id FROM @WorkItemIds);
        DELETE FROM dbo.tProjectComponentCost        WHERE Id IN (SELECT Id FROM @CostIds);
        -- tProjectNotes' real column is ProjectRevisionFK (the EF model is stale).
        DELETE FROM dbo.tProjectNotes          WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);
        DELETE FROM dbo.tProjectFundingProfile WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);
        DELETE FROM dbo.tProjectSupportingDocs WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds);
        DELETE FROM dbo.tProjectStages         WHERE ProjectFK = @ProjectFK AND ProgramFK = @ProgramFK;
        DELETE FROM dbo.tProjectRevisions      WHERE Id IN (SELECT Id FROM @RevisionIds);

        -- Multi-year guard: keep the project row while another program still has history for it.
        IF NOT EXISTS (SELECT 1 FROM dbo.tProjectStages WHERE ProjectFK = @ProjectFK AND ProgramFK <> @ProgramFK)
           AND NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions WHERE ProjectFK = @ProjectFK AND ProgramFK <> @ProgramFK)
        BEGIN
            DELETE FROM dbo.tProjects WHERE ProjectPK = @ProjectFK;
        END

        IF @StartedOwnTran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        -- Roll back only what this procedure opened; a caller's transaction is the caller's.
        IF @StartedOwnTran = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
