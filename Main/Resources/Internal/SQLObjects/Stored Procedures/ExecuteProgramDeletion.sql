/*  ExecuteProgramDeletion.sql — the final step of deleting a Program: write its
    audit-trail row, then delete its own tProgramStages, tProgramRevisions and
    tPrograms rows, in that order (children before parent, mirrors the per-project
    cascade's own FK-safe ordering).

    RUNTIME SCRIPT (2026-10-15 architecture): this is PASS 4 (and its preceding audit
    insert) of the former dbo.pExecuteProgramDeletion stored procedure, converted to a
    plain parameterized script run via ISqlExecutor.ExecuteScriptFileNonQueryInTransactionAsync
    (fileName, parameters, tx) — tx is the SAME caller-owned transaction that already ran,
    in order, inside ProgramHelper.DeleteProgramInTransactionAsync (2026-10-16: every pass
    runs in that one transaction, under the per-program delete lock and row locks). NO CASCADE:
    a program with a live project is refused in PASS 1; only leftovers of projects users already
    deleted are removed with it:
      PASS 1   GetProgramDeletionEligibility.sql   (refused in C# if Blocked: Approved, progressed,
               live projects, or leftovers that could never be removed)
      PASS 2   GetProjectDeletionTier.sql, one call for every leftover (refused in C#, naming every
               non-Hard one)
      PASS 3   ExecuteProjectDeletion.sql per leftover (its rows under this program only)
      PASS 3.5 postcondition: C# checks that no tProjects, tProjectRevisions or tProjectStages
               row is left under @ProgramFK, immediately before calling this script. If any
               is, C# throws WITHOUT ever running this script, and the caller's transaction
               rolls back everything (every child delete too) — the explicit enforcement of
               "program can never be deleted unless all projects in it have been totally
               hard-deleted".
      PASS 4   this script.
    One caller-level transaction spans every pass, so the delete is all-or-nothing.

    Params:
      @ProgramFK        NVARCHAR(200)
      @UserId            NVARCHAR(100)
      @CurrentDate       DATETIME2
      @ProjectsDeleted   INT — count of leftovers removed in PASS 3 (normally 0), for the
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
