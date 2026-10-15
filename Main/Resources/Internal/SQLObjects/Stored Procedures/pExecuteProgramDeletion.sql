/*  dbo.pExecuteProgramDeletion — the single entry point for deleting a
    Program. Replaces the inline stage-allowlist + cost-guard + blanket
    RemoveRange logic that previously lived in
    ProgramController.DeleteProgram (WebAPI/Controllers/Programs/ProgramController.cs).

    POLICY (finalized 2026-10-14, operator-directed):
      "program can never be deleted unless all projects in it have been
      totally hard-deleted" -- this is a POSTCONDITION, verified explicitly
      (see PASS 3.5 below), not merely an ordering guarantee. A
      code-behavior-audit on 2026-10-14 found the original version ran the
      per-project loop and then proceeded straight to deleting the
      program's own rows without ever checking that the loop actually
      resulted in zero remaining tProjects rows under that program. Since
      there is no real FK constraint from tProjectStages/tProjectRevisions
      to tPrograms (confirmed live), nothing in the database itself would
      have caught this -- it was a pure application-logic gap. Fixed by
      adding an explicit NOT EXISTS check immediately after the loop and
      before any tPrograms/tProgramRevisions/tProgramStages row is touched.

      "project should remove first in order to fully delete a program" --
      every child project is resolved BEFORE the Program's own rows are
      touched, in the SAME transaction, all-or-nothing.

      "no more program soft-delete, all will be hard-delete" -- there is no
      soft-delete anywhere in this procedure, at either the program or the
      project level.

      "if a program has 1 project published already, then project deletion
      should be soft-delete, any project. Never to hard-delete on this
      condition. the published project should be blocked to be deleted." --
      reconciled: since the published project itself can never be deleted
      at all, no soft-delete branch is ever actually reached. The concrete
      behavior is: ANY published child blocks the ENTIRE Program-delete
      request, with ZERO writes to the program or to any of its children,
      published or not.

      MULTI-YEAR PROJECTS (clarified 2026-10-14, operator-confirmed domain
      fact, cross-checked live against myps_db_dev: zero ProjectFK values
      currently span 2+ distinct ProgramFK in tProjectStages or
      tProjectRevisions): a multi-year project is a DISTINCT tProjects row
      per program/fiscal-year cycle, never the same ProjectPK shared live
      across two programs. The per-project loop below is therefore always
      scoped correctly to exactly the children of @ProgramFK, and the
      PASS 3.5 postcondition check below will always succeed for every
      non-published child, by construction -- it exists as a hard
      guarantee/defense-in-depth, not because cross-program survivors are
      expected in practice.

    SELF-ATOMIC, NESTING-SAFE: opens its own transaction only if none is
    already active, commits only what it opened, and on any error rolls
    back and re-throws. This is the OUTER transaction for the whole
    program-delete operation -- dbo.pExecuteProjectDeletion, called once
    per child inside Pass 3 below, detects this already-open transaction
    and does not open or commit a second one of its own; any error inside
    it propagates straight up to this procedure's own CATCH.

    FIVE-PASS DESIGN:

      PASS 1 -- Program eligibility (dbo.fProgramDeletionEligibility):
      StageCount(ProgramFK) <= 1, uniform across all 12 EnumProgramStage
      values (BP, NEP, NEPE, HGAB, HGABI, GAA, GAAR, RBP, RDIP, PIP, TF,
      TFR -- no stage-name special-casing of any kind, this is what closes
      RISK-112). If Blocked, RAISERROR and return -- zero writes. Runs
      BEFORE any transaction opens -- nothing to roll back.

      PASS 2 -- Child check (dbo.fProjectDeletionTier per child, the single
      project-deletion rule): every project under @ProgramFK must come back
      'Hard'. If EVEN ONE is 'Blocked' (published) or 'Soft' (progressed past
      its first stage), RAISERROR naming it with its reason and return --
      zero writes to any child. Also runs BEFORE any transaction opens --
      purely read-only.

      PASS 3 -- Execute (only reached if Pass 1 and Pass 2 both passed, now
      inside the transaction opened above): force hard-delete every child
      project via dbo.pExecuteProjectDeletion.

      PASS 3.5 -- Postcondition verification (NEW, 2026-10-14): confirm
      NOT EXISTS (SELECT 1 FROM tProjects WHERE ProgramFK = @ProgramFK).
      If even one child project row survived the loop for any reason, this
      RAISERRORs inside the TRY block, which the existing CATCH below
      rolls back in full -- the program and every child stay exactly as
      they were, nothing commits. This is the explicit enforcement of
      "program can never be deleted unless all projects in it have been
      totally hard-deleted."

      PASS 4 (same transaction, only reached if PASS 3.5 passed): delete
      the program's own tProgramStages, tProgramRevisions and tPrograms
      rows, in that order (children before parent, mirrors the per-project
      cascade's own FK-safe ordering).

    Returns a result set the caller can log/display: one row per deleted
    project (ProjectFK only -- Tier is always 'Hard' by this point so it is
    not worth repeating), for audit-trail purposes, matching the
    TransactionLog pattern already used elsewhere in ProgramController.cs. */
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.pExecuteProgramDeletion
    @ProgramFK NVARCHAR(200),
    @UserId NVARCHAR(100),
    @CurrentDate DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- PASS 1: Program-level eligibility. Read-only, no transaction yet.
    DECLARE @Eligibility NVARCHAR(20), @EligibilityReason NVARCHAR(100);
    SELECT @Eligibility = Eligibility, @EligibilityReason = Reason
    FROM dbo.fProgramDeletionEligibility(@ProgramFK);

    IF @Eligibility IS NULL
    BEGIN
        RAISERROR(N'DELETE_REFUSED: Program %s was not found.', 16, 1, @ProgramFK);
        RETURN;
    END

    IF @Eligibility = N'Blocked'
    BEGIN
        -- Reason comes from the function: 'program is approved' or 'progressed beyond its initial stage'.
        RAISERROR(N'DELETE_REFUSED: Program %s cannot be deleted: %s.', 16, 1, @ProgramFK, @EligibilityReason);
        RETURN;
    END

    -- PASS 2: every child project's tier, still read-only, no transaction yet.
    -- The same single rule every project delete uses (dbo.fProjectDeletionTier): a
    -- program is hard-deleted only when EVERY child is 'Hard'. A published child
    -- ('Blocked') or one that has progressed past its first stage ('Soft') refuses
    -- the whole request.
    DECLARE @Projects TABLE (ProjectFK NVARCHAR(200) PRIMARY KEY, Tier NVARCHAR(20), Reason NVARCHAR(100));

    INSERT INTO @Projects (ProjectFK, Tier, Reason)
    SELECT p.ProjectPK, t.Tier, t.Reason
    FROM dbo.tProjects p
    CROSS APPLY dbo.fProjectDeletionTier(p.ProjectPK, @ProgramFK) t
    WHERE p.ProgramFK = @ProgramFK
      AND t.ProjectFK = p.ProjectPK;   -- the PK's own row; the string may also be another project's revision id

    IF EXISTS (SELECT 1 FROM @Projects WHERE Tier <> N'Hard')
    BEGIN
        DECLARE @BlockedList NVARCHAR(MAX) = (
            SELECT STRING_AGG(ProjectFK + N' (' + Reason + N')', N', ') FROM @Projects WHERE Tier <> N'Hard'
        );
        RAISERROR(N'DELETE_REFUSED: Program %s cannot be deleted because some of its projects cannot be permanently deleted: %s', 16, 1, @ProgramFK, @BlockedList);
        RETURN;
    END

    -- PASS 3 + 3.5 + 4: execute, now inside a transaction. Children first,
    -- verify they are actually gone, then the program's own rows.
    DECLARE @StartedOwnTran BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRANSACTION;
        SET @StartedOwnTran = 1;
    END

    BEGIN TRY
        DECLARE @CurProjectFK NVARCHAR(200);
        DECLARE ProjectCursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT ProjectFK FROM @Projects;

        OPEN ProjectCursor;
        FETCH NEXT FROM ProjectCursor INTO @CurProjectFK;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC dbo.pExecuteProjectDeletion
                @ProjectFK = @CurProjectFK,
                @ProgramFK = @ProgramFK,
                @UserId = @UserId,
                @CurrentDate = @CurrentDate;

            FETCH NEXT FROM ProjectCursor INTO @CurProjectFK;
        END
        CLOSE ProjectCursor;
        DEALLOCATE ProjectCursor;

        -- PASS 3.5: postcondition. "program can never be deleted unless all
        -- projects in it have been totally hard-deleted" -- enforced here,
        -- explicitly, rather than assumed from the loop having run.
        IF EXISTS (SELECT 1 FROM dbo.tProjects WHERE ProgramFK = @ProgramFK)
        BEGIN
            DECLARE @SurvivingList NVARCHAR(MAX) = (
                SELECT STRING_AGG(ProjectPK, N', ') FROM dbo.tProjects WHERE ProgramFK = @ProgramFK
            );
            RAISERROR(N'DELETE_REFUSED: Program %s cannot be deleted because some of its projects could not be fully removed: %s', 16, 1, @ProgramFK, @SurvivingList);
        END

        -- AUDIT (2026-10-15): one tTransactionLog row for the program itself, in this
        -- transaction (each child already wrote its own row in pExecuteProjectDeletion).
        DECLARE @ProgramSnapshot NVARCHAR(MAX) = (
            SELECT pg.ProgramPK, cur.Name, pg.StartYear, cur.StageName,
                   (SELECT COUNT(*) FROM @Projects) AS ProjectsDeleted
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

        -- PASS 4: only reached if PASS 3.5 raised nothing.
        DELETE FROM dbo.tProgramStages WHERE ProgramFK = @ProgramFK;
        DELETE FROM dbo.tProgramRevisions WHERE ProgramFK = @ProgramFK;
        DELETE FROM dbo.tPrograms WHERE ProgramPK = @ProgramFK;

        IF @StartedOwnTran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'ProjectCursor') >= -1
        BEGIN
            CLOSE ProjectCursor;
            DEALLOCATE ProjectCursor;
        END
        IF @StartedOwnTran = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH

    -- Audit-trail result set for the caller to log/display.
    SELECT ProjectFK FROM @Projects;
END
GO
