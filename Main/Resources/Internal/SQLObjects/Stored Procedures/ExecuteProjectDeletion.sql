/*  ExecuteProjectDeletion.sql — THE hard delete of ONE project under ONE program:
    every row the project has under @ProgramFK is physically removed. It is the only
    hard cascade; Batch Delete, Delete Program, Delete Lump Sum and Delete Itemized
    Project all run it rather than deleting rows themselves.

    RUNTIME SCRIPT (2026-10-15 architecture): this is the cascade body of the former
    dbo.pExecuteProjectDeletion stored procedure, converted to a plain parameterized
    script run via ISqlExecutor.ExecuteScriptFileNonQueryInTransactionAsync(fileName,
    parameters, tx) — tx is a transaction the CALLER already opened and will commit or
    roll back. UNLIKE the former procedure, this script does NOT:
      - re-run the tier check (the caller already ran GetProjectDeletionTier.sql and
        refused the call in C# if Tier <> 'Hard' — see ProjectHelper.ExecuteProjectDeletionAsync);
      - open or commit/rollback any transaction of its own (the caller's tx wraps it,
        and one caller-level transaction spans every project in a cascade plus the
        program's own delete, preserving the original all-or-nothing guarantee);
      - resolve @ProjectFK from an arbitrary reference (the caller already resolved it
        to the exact ProjectPK via GetProjectDeletionTier.sql's Ref/ProjectFK columns).
    The actual DELETE statements, their order and every column name below are
    UNCHANGED from the former procedure body.

    Params:
      @ProjectFK   NVARCHAR(200) — the resolved ProjectPK (NOT a raw user reference).
      @ProgramFK   NVARCHAR(200)
      @UserId      NVARCHAR(100)
      @CurrentDate DATETIME2
      @Kind        NVARCHAR(20)  — from GetProjectDeletionTier.sql's Kind column, for the audit snapshot.
      @StageCount  INT           — from GetProjectDeletionTier.sql's StageCount column, for the audit snapshot.
      @Reason      NVARCHAR(100) — from GetProjectDeletionTier.sql's Reason column, for the audit snapshot.

    AUDIT: one tTransactionLog row per hard-deleted project (ReferenceId = ProjectPK,
    OldValue = a JSON snapshot of its stages and ids), in the same transaction, BEFORE
    the rows go, so OldValue can say what the project was. It rolls back with the
    delete if anything below fails (XACT_ABORT is the caller's concern now, via its
    own transaction / SqlException handling in C#).

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
        tProjectStages, tProjectRevisions

    Supporting-document FILES are not touched: a stage advance copies the path, not
    the file, so a file may still be referenced by another row. Only the rows go.

    Multi-year guard: the tProjects row itself is only removed when no OTHER program
    still has tProjectStages or tProjectRevisions history for this ProjectPK — a
    multi-year project with history under a different ProgramFK keeps its row. */
SET QUOTED_IDENTIFIER ON;

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

-- AUDIT (2026-10-15): one tTransactionLog row per hard-deleted project, written
-- BEFORE the rows go, so OldValue can say what the project was.
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
