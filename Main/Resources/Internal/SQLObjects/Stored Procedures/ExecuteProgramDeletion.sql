/*  ExecuteProgramDeletion.sql — the final step of deleting a Program: write its
    audit-trail row, then delete its own tProgramStages, tProgramRevisions and
    tPrograms rows, in that order (children before parent, mirrors the per-project
    cascade's own FK-safe ordering).

    RUNTIME SCRIPT (2026-10-15 architecture): this is PASS 4 (and its preceding audit
    insert) of the former dbo.pExecuteProgramDeletion stored procedure, converted to a
    plain parameterized script run via ISqlExecutor.ExecuteScriptFileNonQueryInTransactionAsync
    (fileName, parameters, tx) — tx is the SAME caller-owned transaction that already ran,
    in order, inside ProgramHelper.ExecuteProgramDeletionAsync:
      PASS 1   GetProgramDeletionEligibility.sql   (read-only; refused in C# before any tx opens)
      PASS 2   GetProjectDeletionTier.sql per child (read-only; refused in C# before any tx opens)
      PASS 3   ExecuteProjectDeletion.sql per child (inside this same tx, once per Hard child)
      PASS 3.5 postcondition: C# re-checks NOT EXISTS tProjects WHERE ProgramFK = @ProgramFK,
               inside this same tx, immediately before calling this script. If anything
               survived, C# throws WITHOUT ever running this script, and the caller's
               transaction rolls back everything (every child delete too) — this is the
               explicit enforcement of "program can never be deleted unless all projects
               in it have been totally hard-deleted," unchanged from the original design.
      PASS 4   this script.
    One caller-level transaction spans all of PASS 3 + 3.5 + 4, preserving the original
    stored procedure's all-or-nothing guarantee — the atomicity moved from a nested SQL
    transaction to a C#-owned ADO.NET transaction, nothing else about the guarantee changed.

    Params:
      @ProgramFK        NVARCHAR(200)
      @UserId            NVARCHAR(100)
      @CurrentDate       DATETIME2
      @ProjectsDeleted   INT — count of child projects hard-deleted in PASS 3, for the
                          audit snapshot only (matches the original procedure's
                          `(SELECT COUNT(*) FROM @Projects) AS ProjectsDeleted`).

    AUDIT: one tTransactionLog row for the program itself (each child already wrote its
    own row via ExecuteProjectDeletion.sql in PASS 3), written in this same transaction
    BEFORE the program's rows are deleted, so OldValue can say what the program was. */
SET QUOTED_IDENTIFIER ON;

DECLARE @ProgramSnapshot NVARCHAR(MAX) = (
    SELECT pg.ProgramPK, cur.Name, pg.StartYear, cur.StageName,
           @ProjectsDeleted AS ProjectsDeleted
    FROM dbo.tPrograms pg
    OUTER APPLY (
        SELECT TOP (1) rv.Name, ps.StageName
        FROM dbo.tProgramStages ps
        JOIN dbo.tOptionProgramStage o ON o.Id = ps.StageId
        LEFT JOIN dbo.tProgramRevisions rv ON rv.Id = ps.RevisionId
        WHERE ps.ProgramFK = pg.ProgramPK
        ORDER BY o.StageHierarchy DESC, ps.Id DESC
    ) cur
    WHERE pg.ProgramPK = @ProgramFK
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

INSERT INTO dbo.tTransactionLog
    (ReferenceId, TransactionType, AffectedTable, AffectedColumn, OldValue, NewValue, CreatedBy, Hostname, CreatedDate)
VALUES
    (@ProgramFK, N'Delete', N'tPrograms, tProgramRevisions, tProgramStages', N'Row',
     ISNULL(@ProgramSnapshot, N'{}'), N'Permanently deleted', ISNULL(@UserId, N''), ISNULL(HOST_NAME(), N''), @CurrentDate);

DELETE FROM dbo.tProgramStages WHERE ProgramFK = @ProgramFK;
DELETE FROM dbo.tProgramRevisions WHERE ProgramFK = @ProgramFK;
DELETE FROM dbo.tPrograms WHERE ProgramPK = @ProgramFK;
