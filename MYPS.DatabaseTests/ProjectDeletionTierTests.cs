using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  The project/program hard-delete rule is implemented by 4 .sql script files under
    Main/Resources/Internal/SQLObjects/ (GetProjectDeletionTier.sql,
    GetProgramDeletionEligibility.sql, ExecuteProjectDeletion.sql, ExecuteProgramDeletion.sql),
    read and run directly by ISqlExecutor.ExecuteScriptFile*InTransactionAsync — no compiled DB
    function/procedure exists for this feature (converted 2026-10-16; documents/plans/
    project-deletion-single-rule.md):
      - hard only on a project's first stage entry, soft once it has progressed with its program;
      - Lump Sum itemized children always hard, published projects never deleted;
      - the same answer whether the project is named by its BP-form ProjectPK or its P-form revision id.
    Every test runs against its own throwaway MYPS_Test_<guid> database (LocalDbSafety), with the
    schema below carrying the live foreign keys the cascade has to respect, so a wrong delete
    order fails here exactly as it would on the server. TestAppsettingsBootstrap (a
    [ModuleInitializer]) points Appsetting.Resources.SQLScripts at the real checked-in scripts
    before any test runs. */
public sealed class ProjectDeletionTierTests : IAsyncLifetime
{
    private const string Program = "PROGRAM-1";
    private const string OtherProgram = "PROGRAM-2";
    private const int BP = 1, NEP = 2, GAAR = 7, RBP = 8;

    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        try
        {
            await ExecuteAsync(SchemaSql);
            await ExecuteAsync($"INSERT dbo.tPrograms (ProgramPK) VALUES ('{Program}'), ('{OtherProgram}');");
        }
        catch
        {
            // xUnit skips DisposeAsync when InitializeAsync throws; drop the database here or it leaks.
            await DisposeAsync();
            throw;
        }
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    // ---------------------------------------------------------------------------------------
    // The tier
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task FirstStageEntryAtBP_IsHard()
    {
        await SeedProjectAsync("BP01000001LZ", (BP, "BP01000001LZ"));
        var row = Assert.Single(await TierAsync("BP01000001LZ"));
        Assert.Equal(("Hard", "Ordinary", 1, "ProjectPK"), (row.Tier, row.Kind, row.StageCount, row.MatchedBy));
    }

    [Fact]
    public async Task FirstStageEntryBornAtNEP_IsSoft_PermanentDeleteOnlyAtBpOrRbp()
    {
        // 2026-10-29 (user rule): a permanent delete happens only at BP or RBP. A project whose
        // single stage entry is NEP (added there, or a program created at NEP) is soft-deleted.
        await SeedProjectAsync("P01000002LZ", (NEP, "P01000002LZ"));
        var row = Assert.Single(await TierAsync("P01000002LZ"));
        Assert.Equal(("Soft", 1, "only BP or RBP allows a permanent delete"), (row.Tier, row.StageCount, row.Reason));
    }

    [Fact]
    public async Task FirstStageEntryAtRBP_IsHard()
    {
        await SeedProjectAsync("BP01000017LZ", (RBP, "BP01000017LZ"));
        Assert.Equal(("Hard", "first stage entry"), (Assert.Single(await TierAsync("BP01000017LZ")).Tier, Assert.Single(await TierAsync("BP01000017LZ")).Reason));
    }

    [Fact]
    public async Task AdvancedProject_IsSoft_ByEitherPrefixForm()
    {
        // BP -> NEP: the PK keeps BP, the NEP revision carries P (UpdateProgramStage's ReplaceFirst).
        await SeedProjectAsync("BP01000003LZ", (BP, "BP01000003LZ"), (NEP, "P01000003LZ"));

        var byPK = Assert.Single(await TierAsync("BP01000003LZ"));
        var byRevisionId = Assert.Single(await TierAsync("P01000003LZ"));

        Assert.Equal(("Soft", 2, "BP01000003LZ", "ProjectPK"), (byPK.Tier, byPK.StageCount, byPK.ProjectFK, byPK.MatchedBy));
        Assert.Equal(("Soft", 2, "BP01000003LZ", "ProjectId"), (byRevisionId.Tier, byRevisionId.StageCount, byRevisionId.ProjectFK, byRevisionId.MatchedBy));
    }

    [Fact]
    public async Task AdvancedProject_SoftDeletedAtCurrentStage_IsStillSoft()
    {
        var revisions = await SeedProjectAsync("BP01000004LZ", (BP, "BP01000004LZ"), (NEP, "P01000004LZ"));
        await ExecuteAsync($"UPDATE dbo.tProjectRevisions SET IsDeleted = 1 WHERE Id = {revisions[1]};");
        Assert.Equal("Soft", Assert.Single(await TierAsync("P01000004LZ")).Tier);
    }

    [Fact]
    public async Task LumpSumItemizedChild_IsHard_EvenWhenRevisedOrOnSeveralStages()
    {
        await SeedProjectAsync("P01000005LZ", parentProjectId: "P01000099LS", isRevised: true, stages: new[] { (GAAR, "P01000005LZ"), (NEP, "P01000005LZ") });
        var row = Assert.Single(await TierAsync("P01000005LZ"));
        Assert.Equal(("Hard", "LSChild", "Lump Sum itemized project"), (row.Tier, row.Kind, row.Reason));
    }

    [Fact]
    public async Task LumpSumParent_FollowsTheStageRule()
    {
        // Only at BP or RBP is a single stage entry permanent; a Lump Sum parent at GAA-R is soft (2026-10-29).
        await SeedProjectAsync("P01000006LS", projectType: "LS", stages: new[] { (GAAR, "P01000006LS") });
        await SeedProjectAsync("BP01000018LS", projectType: "LS", stages: new[] { (BP, "BP01000018LS") });
        var atGaar = Assert.Single(await TierAsync("P01000006LS"));
        var atBp = Assert.Single(await TierAsync("BP01000018LS"));
        Assert.Equal(("Soft", "LSParent"), (atGaar.Tier, atGaar.Kind));
        Assert.Equal(("Hard", "LSParent"), (atBp.Tier, atBp.Kind));
    }

    [Fact]
    public async Task Published_IsBlocked_ForOrdinaryAndItemizedChild()
    {
        await SeedProjectAsync("BP01000007LZ", isPublished: true, stages: new[] { (BP, "BP01000007LZ") });
        await SeedProjectAsync("P01000008LZ", parentProjectId: "P01000099LS", isPublished: true, stages: new[] { (GAAR, "P01000008LZ") });

        Assert.Equal("Blocked", Assert.Single(await TierAsync("BP01000007LZ")).Tier);
        Assert.Equal("Blocked", Assert.Single(await TierAsync("P01000008LZ")).Tier);
    }

    [Fact]
    public async Task UnknownReference_OrAnotherProgramsProject_ReturnsNoRows()
    {
        await SeedProjectAsync("BP01000009LZ", program: OtherProgram, stages: new[] { (BP, "BP01000009LZ") });
        Assert.Empty(await TierAsync("NO-SUCH-ID"));
        Assert.Empty(await TierAsync("BP01000009LZ"));          // it exists, but not under PROGRAM-1
    }

    [Fact]
    public async Task OneStringNamingTwoProjects_ReturnsBoth_AndTheProcedureDeletesOnlyThePKsOwn()
    {
        // BP and P numbers come from separate counters and the BP->P swap reuses the BP digits, so the
        // same string can be one project's PK and another project's revision id. Never a silent pick:
        // both come back (a user-facing caller refuses), while a caller holding the PK gets that project.
        await SeedProjectAsync("P01100001LZ", (BP, "P01100001LZ")); // at BP, so it may be hard-deleted below
        await SeedProjectAsync("BP01100001LZ", (BP, "BP01100001LZ"), (NEP, "P01100001LZ"));

        var rows = (await TierAsync("P01100001LZ")).OrderBy(x => x.ProjectFK).ToList();
        Assert.Equal(new[] { ("BP01100001LZ", "ProjectId"), ("P01100001LZ", "ProjectPK") },
                     rows.Select(x => (x.ProjectFK, x.MatchedBy)));

        await ExecSql("P01100001LZ");
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'P01100001LZ'"));
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01100001LZ'"));
        Assert.Equal(2, await CountAsync("dbo.tProjectRevisions", "ProjectFK = 'BP01100001LZ'"));
    }

    [Fact]
    public async Task NoStageHistoryUnderTheProgram_IsNotHard()
    {
        await SeedProjectAsync("BP01000016LZ", Array.Empty<(int, string)>());
        var row = Assert.Single(await TierAsync("BP01000016LZ"));
        Assert.Equal(("Soft", 0, "no stage history under this program"), (row.Tier, row.StageCount, row.Reason));
    }

    [Fact]
    public async Task RevisionIdShared_ByTwoProjects_ReturnsBoth_SoTheCallerRefuses()
    {
        await SeedProjectAsync("BP01200001LZ", (BP, "BP01200001LZ"), (NEP, "P01200001LZ"));
        await SeedProjectAsync("MY01200001LZ", (BP, "MY01200001LZ"), (NEP, "P01200001LZ"));
        Assert.Equal(2, (await TierAsync("P01200001LZ")).Count);
    }

    // ---------------------------------------------------------------------------------------
    // The cascade
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task Cascade_RemovesEveryRow_AndKeepsASharedPcmaTransaction()
    {
        var revisions = await SeedProjectAsync("P01000010LZ", parentProjectId: "P01000099LS", isRevised: true, stages: new[] { (GAAR, "P01000010LZ") });
        await SeedChildRowsAsync(revisions[0], transactionId: "TX-SHARED");
        var other = await SeedProjectAsync("BP01000011LZ", (BP, "BP01000011LZ"));
        await ExecuteAsync($"INSERT dbo.tRevisionDetails (TransactionId, ProjectFK, ProjectRevisionFK) VALUES ('TX-SHARED', 'BP01000011LZ', {other[0]});");

        await ExecSql("P01000010LZ");

        foreach (var (table, where) in CascadeTables(revisions[0]))
            Assert.True(await CountAsync(table, where) == 0, $"{table} still has rows for the deleted project");
        Assert.Equal(1, await CountAsync("dbo.tRevisionPCMAComponent", "TransactionId = 'TX-SHARED'")); // still used by BP01000011LZ
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01000011LZ'"));

        // One audit row, written by the procedure in the same transaction, saying what was removed.
        Assert.Equal(1, await CountAsync("dbo.tTransactionLog",
            "ReferenceId = 'P01000010LZ' AND TransactionType = 'Delete' AND NewValue = 'Permanently deleted' AND CreatedBy = 'test'"));
        Assert.Equal(1, await CountAsync("dbo.tTransactionLog",
            "ReferenceId = 'P01000010LZ' AND OldValue LIKE '%\"Kind\":\"LSChild\"%' AND OldValue LIKE '%\"ProjectId\":\"P01000010LZ\"%'"));
    }

    [Fact]
    public async Task Cascade_TakesProjectPKsOnly_AndRefusesARevisionId()
    {
        // 2026-10-17: the destructive path acts on the ProjectPK it is given and nothing else. A P-form
        // revision id is resolved by the caller (Batch Delete's plan) before it gets here; handed one
        // directly, it is refused as not found, nothing written.
        await SeedProjectAsync("BP01000012LZ", (BP, "BP01000012LZ"), (NEP, "P01000012LZ"));
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecSql("P01000012LZ"));
        Assert.Equal("Project P01000012LZ was not found in this program.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01000012LZ'"));
        Assert.Equal(2, await CountAsync("dbo.tProjectRevisions", "ProjectFK = 'BP01000012LZ'"));
    }

    [Fact]
    public async Task LockedDecision_NeverActsOnAnotherProject_WhenTheKeyIsGone()
    {
        // Risk #1 (2026-10-17). P01100002LZ is a PK; BP01100002LZ carries the same string as its revision
        // ProjectId (BP/P digits are shared) and, on one stage, rates Hard. Once the first delete has
        // removed P01100002LZ, a second delete of the same PK used to fall back to BP01100002LZ -- a
        // project nobody asked for, whose rows were never locked -- and hard-delete it.
        // At BP: since 2026-10-29 a single stage entry is Hard only at BP or RBP.
        await SeedProjectAsync("P01100002LZ", (BP, "P01100002LZ"));
        await SeedProjectAsync("BP01100002LZ", (BP, "P01100002LZ"));
        Assert.Equal("Hard", (await TierAsync("P01100002LZ")).Single(x => x.ProjectFK == "BP01100002LZ").Tier);

        await ExecSql("P01100002LZ");
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'P01100002LZ'"));

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecSql("P01100002LZ"));
        Assert.Equal("Project P01100002LZ was not found in this program.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01100002LZ'"));
        Assert.Equal(1, await CountAsync("dbo.tProjectRevisions", "ProjectFK = 'BP01100002LZ'"));
        Assert.Equal(1, await CountAsync("dbo.tProjectStages", "ProjectFK = 'BP01100002LZ'"));
        Assert.Equal(0, await CountAsync("dbo.tTransactionLog", "ReferenceId = 'BP01100002LZ'"));
    }

    [Fact]
    public async Task Cascade_RefusesPublished_WithNoWrites()
    {
        await SeedProjectAsync("BP01000013LZ", isPublished: true, stages: new[] { (BP, "BP01000013LZ") });
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecSql("BP01000013LZ"));
        Assert.Equal("Project BP01000013LZ cannot be permanently deleted: published.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tProjectRevisions", "ProjectFK = 'BP01000013LZ'"));
    }

    [Fact]
    public async Task Cascade_FailingInsideACallersTransaction_ReportsTheRealErrorAndWritesNothing()
    {
        var revisions = await SeedProjectAsync("BP01000014LZ", (BP, "BP01000014LZ"));
        // A row the cascade does not know about, holding a real FK to the revision: the delete fails mid-cascade.
        await ExecuteAsync("CREATE TABLE dbo.tUnknownChild (Id INT IDENTITY PRIMARY KEY, ProjectRevisionFK INT NOT NULL REFERENCES dbo.tProjectRevisions(Id));" +
                           $"INSERT dbo.tUnknownChild (ProjectRevisionFK) VALUES ({revisions[0]});");

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        {
            var ex = await Assert.ThrowsAsync<SqlException>(() => ExecSql("BP01000014LZ", connection, transaction));
            Assert.Contains("REFERENCE constraint", ex.Message);
            // Error 266 ("Transaction count after EXECUTE…") was specific to the old nested stored
            // procedure design; this script never opens/rolls back a transaction of its own, so
            // that failure mode cannot recur, but the assertion stays as a regression guard.
            Assert.DoesNotContain("Transaction count", ex.Message);
            await transaction.RollbackAsync();
        }

        // The explicit RollbackAsync() above is what undoes this now — the script has no
        // XACT_ABORT/TRY-CATCH of its own (unlike the former procedure); the caller's
        // transaction is the caller's responsibility to roll back, which this test does
        // directly, and which every real production caller does too (confirmed: ProgramHelper.
        // ExecuteProgramDeletionAsync's own ExecuteTransactionAsync, and all 3 real controller
        // call sites' catch blocks — see this session's code-behavior-audit).
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01000014LZ'"));
        Assert.Equal(1, await CountAsync("dbo.tProjectStages", "ProjectFK = 'BP01000014LZ'"));
        Assert.Equal(0, await CountAsync("dbo.tTransactionLog", "ReferenceId = 'BP01000014LZ'")); // the audit row went with it
    }

    // ---------------------------------------------------------------------------------------
    // The Approved-program gate (2026-10-15)
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task ApprovedProgram_BlocksOrdinaryProjects_ButNotItemizedChildren()
    {
        await SetProgramStageAsync(GAAR, status: Approved);
        await SeedProjectAsync("P01000020LZ", (GAAR, "P01000020LZ"));
        await SeedProjectAsync("P01000021LZ", parentProjectId: "P01000099LS", stages: new[] { (GAAR, "P01000021LZ") });

        var ordinary = Assert.Single(await TierAsync("P01000020LZ"));
        var child = Assert.Single(await TierAsync("P01000021LZ"));
        Assert.Equal(("Blocked", "program is approved", true), (ordinary.Tier, ordinary.Reason, ordinary.ProgramApproved));
        Assert.Equal(("Hard", "Lump Sum itemized project"), (child.Tier, child.Reason)); // an import mistake stays correctable
    }

    [Fact]
    public async Task ApprovedStatus_IsReadFromTheCurrentStageRevision_NotTheNewestRevision()
    {
        // vProgramLatest's rule: the current stage row (highest StageHierarchy) names the revision.
        // Here the NEWEST revision row is Working but belongs to a lower stage; the current stage's
        // revision is Approved, which is what users see — so the gate must say Approved.
        await SetProgramStageAsync(GAAR, status: Approved);
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("P01000022LZ", (GAAR, "P01000022LZ"));

        Assert.Equal("Blocked", Assert.Single(await TierAsync("P01000022LZ")).Tier);
        Assert.Equal(("Blocked", "program is approved"), await EligibilityAsync());
    }

    [Fact]
    public async Task ProgramEligibility_SaysWhy()
    {
        Assert.Equal(("Eligible", ""), await EligibilityAsync());               // no stage history

        await SetProgramStageAsync(BP, status: Working);
        Assert.Equal(("Eligible", ""), await EligibilityAsync());

        await SetProgramStageAsync(NEP, status: Working);
        Assert.Equal(("Blocked", "progressed beyond its initial stage"), await EligibilityAsync());

        await SetProgramStageAsync(GAAR, status: Approved);
        Assert.Equal(("Blocked", "program is approved"), await EligibilityAsync()); // approval wins
    }

    // ---------------------------------------------------------------------------------------
    // ID reuse (2026-10-29): a permanently deleted project's BP/P id is released for reuse;
    // MY ids, and ids something still carries, are not.
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task HardDelete_ReleasesItsBpId_ButNotAnMyId()
    {
        await ExecuteAsync(ReleasedTableSql);
        await SeedProjectAsync("BP01300060LZ", new[] { (BP, "BP01300060LZ") }, category: 2);
        await SeedProjectAsync("MY01300061LZ", new[] { (BP, "MY01300061LZ") }, category: 2);

        await ExecSql("BP01300060LZ");
        await ExecSql("MY01300061LZ");

        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK IN ('BP01300060LZ', 'MY01300061LZ')"));
        Assert.Equal(1, await CountAsync("dbo.tProjectIdReleased", "1 = 1"));
        Assert.Equal(1, await CountAsync("dbo.tProjectIdReleased",
            "CategoryId = 2 AND Suffix = 'BP' AND IslandCode = 'LZ' AND YearStart = 2029 AND Sequence = 60 AND ProjectId = 'BP01300060LZ' AND ReleasedBy = 'test'"));
    }

    [Fact]
    public async Task HardDelete_OfALumpSumItemizedProject_DoesNotReleaseItsId()
    {
        await ExecuteAsync(ReleasedTableSql);
        await SeedProjectAsync("P01300065LZ", new[] { (GAAR, "P01300065LZ") }, parentProjectId: "P01300099LS", category: 2);
        await ExecSql("P01300065LZ");
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'P01300065LZ'"));
        Assert.Equal(0, await CountAsync("dbo.tProjectIdReleased", "1 = 1")); // itemize again for a new id
    }

    [Fact]
    public async Task ProgramDeletion_OnlyAtBpOrRbp()
    {
        // 2026-10-29 (user rule): a program created straight at a later stage is never permanently deleted.
        await SetProgramStageAsync(NEP, status: Working);
        Assert.Equal(("Blocked", "it is at the S2 stage; a program can be permanently deleted only at BP or RBP"), await EligibilityAsync());
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Equal("This program cannot be deleted: it is at the S2 stage; a program can be permanently deleted only at BP or RBP.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
    }

    [Fact]
    public async Task ProgramDeletion_AtRbp_IsAllowed()
    {
        await SetProgramStageAsync(RBP, status: Working);
        Assert.Equal(("Eligible", ""), await EligibilityAsync());
    }

    [Fact]
    public async Task HardDelete_KeepsAnIdThatAnotherRowStillCarries()
    {
        await ExecuteAsync(ReleasedTableSql);
        await SeedProjectAsync("BP01300062LZ", new[] { (BP, "BP01300062LZ") }, category: 2);
        // Another project's revision carries the same string (the BP/P digit sharing the tier rule describes).
        await SeedProjectAsync("BP01300063LZ", new[] { (BP, "BP01300062LZ") }, program: OtherProgram, category: 2);

        await ExecSql("BP01300062LZ");

        Assert.Equal(0, await CountAsync("dbo.tProjectIdReleased", "1 = 1"));
    }

    [Fact]
    public async Task HardDelete_WithoutTheReleasedTable_DeletesAsBefore()
    {
        await SeedProjectAsync("BP01300064LZ", new[] { (BP, "BP01300064LZ") }, category: 2);
        await ExecSql("BP01300064LZ");
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01300064LZ'"));
    }

    [Fact]
    public async Task ProgramDeletion_RefusesAnApprovedProgram_WithTheReason()
    {
        await SetProgramStageAsync(GAAR, status: Approved);
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Equal("This program cannot be deleted: program is approved.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
    }

    // ---------------------------------------------------------------------------------------
    // No cascade (2026-10-16, program-delete-no-cascade.md): a program is deleted only once all
    // its projects have been deleted by a user. What goes with it is only what is left of
    // projects users already deleted (soft-deleted), and only within this program.
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task ProgramDeletion_RefusesWhileAProjectIsLive_SayingWhatToDo_AndWritesNothing()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000030LZ", (BP, "BP01000030LZ"));
        await SeedProjectAsync("BP01000031LZ", (BP, "BP01000031LZ"));
        await SoftDeleteAsync("BP01000031LZ");

        Assert.Equal(("Blocked", "it still has 1 project(s) that have not been deleted"), await EligibilityAsync());
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Equal("This program cannot be deleted: it still has 1 project(s) that have not been deleted. " +
                     "Delete them first (Batch Delete in Program Details; Lump Sum projects from the Lump Sum module).", ex.Reason);
        await AssertNothingDeletedAsync("BP01000030LZ", "BP01000031LZ");
    }

    [Fact]
    public async Task ProgramDeletion_OfAnEmptyProgram_DeletesItAndLogsIt()
    {
        await SetProgramStageAsync(BP, status: Working);

        var removed = await ExecuteProgramDeletionAsync();

        Assert.Empty(removed);
        Assert.Equal(0, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
        Assert.Equal(1, await CountAsync("dbo.tTransactionLog",
            $"ReferenceId = '{Program}' AND AffectedTable = 'tPrograms, tProgramRevisions, tProgramStages' AND OldValue LIKE '%\"ProjectsDeleted\":0%'"));
    }

    [Fact]
    public async Task ProgramDeletion_RemovesTheLeftoversOfDeletedProjects_AndLogsEach()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000023LZ", (BP, "BP01000023LZ"));
        await SeedProjectAsync("BP01000024LZ", (BP, "BP01000024LZ"));
        await SoftDeleteAsync("BP01000023LZ");
        await SoftDeleteAsync("BP01000024LZ");

        var removed = await ExecuteProgramDeletionAsync();

        Assert.Equal(new[] { "BP01000023LZ", "BP01000024LZ" }, removed.OrderBy(x => x));
        Assert.Equal(0, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK IN ('BP01000023LZ', 'BP01000024LZ')"));
        Assert.Equal(2, await CountAsync("dbo.tTransactionLog", "ReferenceId IN ('BP01000023LZ', 'BP01000024LZ') AND NewValue = 'Permanently deleted'"));
        Assert.Equal(1, await CountAsync("dbo.tTransactionLog",
            $"ReferenceId = '{Program}' AND AffectedTable = 'tPrograms, tProgramRevisions, tProgramStages' AND OldValue LIKE '%\"ProjectsDeleted\":2%'"));
    }

    [Fact]
    public async Task ProgramDeletion_ADeletedProjectFromAPreviousYear_LosesOnlyItsRowsInThisProgram()
    {
        // The user's rule: a project with previous years is removed only within the selected
        // program. Created under another program, carried into this one, deleted here.
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000037LZ", new[] { (BP, "BP01000037LZ") }, program: OtherProgram);
        int revisionId = await ScalarAsync(
            $"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, IsDeleted) VALUES ('BP01000037LZ', '{Program}', 'BP01000037LZ', 1); SELECT CAST(SCOPE_IDENTITY() AS INT);");
        await ExecuteAsync($"INSERT dbo.tProjectStages (ProjectFK, ProgramFK, RevisionId, StageId) VALUES ('BP01000037LZ', '{Program}', {revisionId}, {BP});");

        var removed = await ExecuteProgramDeletionAsync();

        Assert.Equal(new[] { "BP01000037LZ" }, removed);
        Assert.Equal(0, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
        Assert.Equal(0, await CountAsync("dbo.tProjectRevisions", $"ProgramFK = '{Program}'"));
        Assert.Equal(0, await CountAsync("dbo.tProjectStages", $"ProgramFK = '{Program}'"));
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01000037LZ'"));            // still the other program's
        Assert.Equal(1, await CountAsync("dbo.tProjectRevisions", $"ProgramFK = '{OtherProgram}'")); // its previous year is kept
    }

    [Fact]
    public async Task ProgramDeletion_ADeletedProjectCarriedIntoALaterYear_IsARefusal_AndRollsEverythingBack()
    {
        // Created in this program and carried into another: its tProjects row would have to stay
        // and point at a deleted program, so the delete is refused and nothing is written. Since
        // 2026-10-16 the eligibility script says so up front (a stuck leftover), so the Program list
        // and DeleteProgram agree.
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000034LZ", (BP, "BP01000034LZ"));
        await SeedProjectAsync("BP01000035LZ", (BP, "BP01000035LZ"));
        await SoftDeleteAsync("BP01000034LZ");
        await SoftDeleteAsync("BP01000035LZ");
        await ExecuteAsync($"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, IsDeleted) VALUES ('BP01000035LZ', '{OtherProgram}', 'P01000035LZ', 0);");

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Equal("This program cannot be deleted: it has 1 deleted project(s) that cannot be removed automatically (e.g. BP01000035LZ); an administrator must clean them up.", ex.Reason);
        Assert.Equal(("Blocked", "StuckLeftovers"), await EligibilityCodeAsync());
        await AssertNothingDeletedAsync("BP01000034LZ", "BP01000035LZ");
    }

    [Fact]
    public async Task ProgramDeletion_ADeletedProjectTheRuleRefuses_IsNamed()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000015LZ", isPublished: true, stages: new[] { (BP, "BP01000015LZ") });
        await SoftDeleteAsync("BP01000015LZ");

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Contains("(e.g. BP01000015LZ); an administrator must clean them up", ex.Reason);
        await AssertNothingDeletedAsync("BP01000015LZ");
    }

    [Fact]
    public async Task ProgramEligibility_ForSeveralPrograms_InOneCall()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000038LZ", (BP, "BP01000038LZ"));
        await SeedProjectAsync("BP01000039LZ", (BP, "BP01000039LZ"));
        await SoftDeleteAsync("BP01000039LZ");

        var rows = await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilitiesAsync(new[] { Program, OtherProgram, "NO-SUCH-PROGRAM" });

        Assert.Equal(2, rows.Count);
        Assert.Equal((1, "LiveProjects", "Blocked"), (rows[Program].LiveProjects, rows[Program].BlockedBy, rows[Program].Eligibility));
        Assert.Equal((0, (string?)null, "Eligible"), (rows[OtherProgram].LiveProjects, rows[OtherProgram].BlockedBy, rows[OtherProgram].Eligibility));
    }

    // ---------------------------------------------------------------------------------------
    // Program delete decides inside its transaction (2026-10-16, delete-policy-must-fix.md)
    //
    // ProgramHelper.ExecuteProgramDeletionAsync decides and deletes inside one transaction, on
    // locked rows. These change the facts first and then run that transactional part, the state a
    // concurrent restore, publish or approval would leave -- without having to race. (That the
    // lock really holds such writers off was checked by hand on localhost UAT, 2026-10-16.)
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task ProgramDeletion_InTransaction_RefusesAProjectRestoredAfterTheUserLooked()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000032LZ", (BP, "BP01000032LZ"));
        await SoftDeleteAsync("BP01000032LZ");
        Assert.Equal(("Eligible", ""), await EligibilityAsync()); // what the Program list showed

        await ExecuteAsync("UPDATE dbo.tProjectRevisions SET IsDeleted = 0 WHERE ProjectFK = 'BP01000032LZ';"); // Batch Restore

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => DeleteProgramInTransactionAsync());
        Assert.StartsWith("This program cannot be deleted: it still has 1 project(s)", ex.Reason);
        await AssertNothingDeletedAsync("BP01000032LZ");
    }

    [Fact]
    public async Task ProgramDeletion_InTransaction_RefusesALeftoverPublishedAfterTheUserLooked()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000030LZ", (BP, "BP01000030LZ"));
        await SeedProjectAsync("BP01000031LZ", (BP, "BP01000031LZ"));
        await SoftDeleteAsync("BP01000030LZ");
        await SoftDeleteAsync("BP01000031LZ");

        await ExecuteAsync("UPDATE dbo.tProjects SET IsPublished = 1 WHERE ProjectPK = 'BP01000031LZ';");

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => DeleteProgramInTransactionAsync());
        Assert.Contains("(e.g. BP01000031LZ)", ex.Reason);
        Assert.DoesNotContain("BP01000030LZ", ex.Reason); // only the blocking one is named
        await AssertNothingDeletedAsync("BP01000030LZ", "BP01000031LZ");
    }

    [Fact]
    public async Task ProgramDeletion_InTransaction_RefusesAProgramApprovedAfterTheUserLooked()
    {
        await SetProgramStageAsync(BP, status: Working);

        await ExecuteAsync($"UPDATE dbo.tProgramRevisions SET Status = {Approved} WHERE ProgramFK = '{Program}';");

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => DeleteProgramInTransactionAsync());
        Assert.Equal("This program cannot be deleted: program is approved.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
    }

    // ---------------------------------------------------------------------------------------
    // Review fixes on top of main (2026-10-16, delete-policy-review-fixes.md)
    // ---------------------------------------------------------------------------------------

    [Fact]
    public async Task ProgramDeletion_NeverRemovesAProjectWithALiveRevision_EvenWhenBatchDeleteCannotReachIt()
    {
        // Round-2 fix 1: a program with no stage rows (no current stage) and a project with a live
        // revision. Batch Delete cannot reach it, so it is not "live" -- but it was never deleted, so
        // Delete Program must not remove it either: it is stuck, and nothing is written.
        await SeedProjectAsync("BP01000046LZ", (BP, "BP01000046LZ"));

        var row = (await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilitiesAsync(new[] { Program }))[Program];
        Assert.Equal((0, 1, "StuckLeftovers"), (row.LiveProjects, row.StuckLeftovers, row.BlockedBy));

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Contains("(e.g. BP01000046LZ); an administrator must clean them up", ex.Reason);
        await AssertNothingDeletedAsync("BP01000046LZ");
        Assert.Equal(1, await CountAsync("dbo.tProjectRevisions", "ProjectFK = 'BP01000046LZ' AND IsDeleted = 0"));
    }

    [Fact]
    public async Task ProgramDeletion_RemovesADeletedItemizedChildWithNoStageRow()
    {
        // Round-2 fix 4 (criterion 3): an itemized child is Hard whatever its stage history, so a
        // deleted one with no stage row is a removable leftover, not "stuck". (The program is at BP:
        // since 2026-10-29 a program is permanently deleted only at BP or RBP.)
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("P01000045LZ", Array.Empty<(int, string)>(), parentProjectId: "P01000099LS");
        await ExecuteAsync($"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, IsDeleted) VALUES ('P01000045LZ', '{Program}', 'P01000045LZ', 1);");

        var row = (await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilitiesAsync(new[] { Program }))[Program];
        Assert.Equal(("Eligible", 0), (row.Eligibility, row.StuckLeftovers));

        var removed = await ExecuteProgramDeletionAsync();
        Assert.Equal(new[] { "P01000045LZ" }, removed);
        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'P01000045LZ'"));
        Assert.Equal(0, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
    }

    [Fact]
    public async Task BatchDecision_LocksAndDecidesEveryProjectInOnePass()
    {
        // Round-2 fix 6: Batch Delete decides its whole batch on locked rows in one lock statement
        // and one tier query. A project that is not there refuses the batch.
        await SeedProjectAsync("BP01000047LZ", (BP, "BP01000047LZ"));
        await SeedProjectAsync("BP01000048LZ", (BP, "BP01000048LZ"), (NEP, "P01000048LZ"));
        var sql = new SqlExecutor(ConnectionString);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using (var transaction = connection.BeginTransaction())
        {
            var decided = await sql.DecideProjectDeletionsUnderLockAsync(new[] { "BP01000047LZ", "BP01000048LZ" }, Program, transaction);
            Assert.Equal(("Hard", "Soft"), (decided["BP01000047LZ"].Tier, decided["BP01000048LZ"].Tier));
            await transaction.RollbackAsync();
        }
        await using (var transaction = connection.BeginTransaction())
        {
            var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() =>
                sql.DecideProjectDeletionsUnderLockAsync(new[] { "BP01000047LZ", "BP09999999LZ" }, Program, transaction));
            Assert.Equal("Project BP09999999LZ was not found in this program.", ex.Reason);
            await transaction.RollbackAsync();
        }
    }

    [Fact]
    public async Task ProgramEligibility_ALiveRevisionWithNoStageRowAtTheCurrentStage_IsNotLive_ButStuck()
    {
        // Live means what Batch Delete can act on: a live revision reached through a stage row at the
        // program's current stage. One with no stage row cannot be batch-deleted, so it is not "live";
        // and Delete Program could not remove it either, so the program says an administrator must.
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000040LZ", Array.Empty<(int, string)>());
        await ExecuteAsync($"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, IsDeleted) VALUES ('BP01000040LZ', '{Program}', 'BP01000040LZ', 0);");

        var row = (await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilitiesAsync(new[] { Program }))[Program];
        Assert.Equal((0, 1, "BP01000040LZ", "StuckLeftovers"), (row.LiveProjects, row.StuckLeftovers, row.StuckExample, row.BlockedBy));
    }

    [Fact]
    public async Task ProgramDeletionLock_IsExclusiveAgainstOtherDeletesOfTheSameProgram()
    {
        // Every delete path takes it exclusively (2026-10-16, round-3 #1): two deletes in one program
        // queue -- the second waits, here 200 ms, then refuses -- and never meet on row locks.
        await using var holder = new SqlConnection(ConnectionString);
        await holder.OpenAsync();
        await using var holderTx = holder.BeginTransaction();
        await holder.AcquireProgramDeletionLockAsync(holderTx, Program);   // e.g. a Batch Delete

        await using var other = new SqlConnection(ConnectionString);
        await other.OpenAsync();
        await using (var sameProgramTx = other.BeginTransaction())
        {
            var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() =>
                other.AcquireProgramDeletionLockAsync(sameProgramTx, Program, timeoutMs: 200)); // another delete: waits, then refuses
            Assert.Equal("Another delete in this program is in progress. Try again in a moment.", ex.Reason);
            await sameProgramTx.RollbackAsync();
        }
        await using (var otherProgramTx = other.BeginTransaction())
        {
            await other.AcquireProgramDeletionLockAsync(otherProgramTx, OtherProgram, timeoutMs: 200); // other programs unaffected
            await otherProgramTx.RollbackAsync();
        }
        await holderTx.RollbackAsync();
    }

    [Fact]
    public async Task ProgramDeletion_RefusedForAnApprovedProgram_LocksNoProjectRow()
    {
        // The refusal comes from the program's own rows; its (possibly thousands of) project rows
        // are never locked for a delete that cannot happen.
        await SetProgramStageAsync(GAAR, status: Approved);
        await SeedProjectAsync("P01000041LZ", (GAAR, "P01000041LZ"));
        await SeedProjectAsync("P01000042LZ", (GAAR, "P01000042LZ"));

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var transaction = connection.BeginTransaction();
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() =>
            new SqlExecutor(ConnectionString).DeleteProgramInTransactionAsync(Program, "test", new DateTime(2026, 10, 16), connection, transaction));
        Assert.Equal("This program cannot be deleted: program is approved.", ex.Reason);

        await using var locks = connection.CreateCommand();
        locks.Transaction = transaction;
        locks.CommandText = """
            SELECT COUNT(*) FROM sys.dm_tran_locks l
            WHERE l.request_session_id = @@SPID
              AND (   l.resource_associated_entity_id IN (SELECT p.hobt_id FROM sys.partitions p
                                                          WHERE p.object_id IN (OBJECT_ID('dbo.tProjects'), OBJECT_ID('dbo.tProjectRevisions'), OBJECT_ID('dbo.tProjectStages')))
                   OR (l.resource_type = 'OBJECT' AND l.request_mode NOT IN ('IS', 'Sch-S')
                       AND l.resource_associated_entity_id IN (OBJECT_ID('dbo.tProjects'), OBJECT_ID('dbo.tProjectRevisions'), OBJECT_ID('dbo.tProjectStages'))));
            """;
        Assert.Equal(0, Convert.ToInt32(await locks.ExecuteScalarAsync()));
        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task TierScript_AnswersSeveralReferencesInOneCall()
    {
        await SeedProjectAsync("BP01000043LZ", (BP, "BP01000043LZ"));
        await SeedProjectAsync("BP01000044LZ", (BP, "BP01000044LZ"), (NEP, "P01000044LZ"));

        var rows = (await new SqlExecutor(ConnectionString).ExecuteScriptFileInTransactionAsync<ProjectHelper.ProjectDeletionTierResult>(
            "Functions/GetProjectDeletionTier.sql",
            new { ProjectRefs = "[\"BP01000043LZ\",\"P01000044LZ\",\"NO-SUCH-PROJECT\"]", ProgramFK = Program })).ToList();

        Assert.Equal(2, rows.Count);
        Assert.Equal(("BP01000043LZ", "Hard"), (rows.Single(x => x.Ref == "BP01000043LZ").ProjectFK, rows.Single(x => x.Ref == "BP01000043LZ").Tier));
        Assert.Equal(("BP01000044LZ", "ProjectId", "Soft"), (rows.Single(x => x.Ref == "P01000044LZ").ProjectFK, rows.Single(x => x.Ref == "P01000044LZ").MatchedBy, rows.Single(x => x.Ref == "P01000044LZ").Tier));
    }

    [Fact]
    public void CurrentProgramStatus_IsResolvedIdenticallyInEveryScript()
    {
        // "Approved" must mean the same in the project rule, the program rule and the program delete's
        // audit snapshot: the current stage row (StageHierarchy, then Id) and its revision -- as
        // vProgramLatest resolves the badge. The scripts cannot share code, so this keeps the copies
        // identical (the WHERE line differs only in how each names its program).
        string root = FindRepositoryDirectory("Main/Resources/Internal/SQLObjects");
        static string Resolution(string script)
        {
            var lines = script.Replace("\r\n", "\n").Split('\n').Select(l => l.Trim()).ToList();
            int from = lines.FindIndex(l => l == "FROM dbo.tProgramStages ps");
            int order = lines.FindIndex(from, l => l.StartsWith("ORDER BY o.StageHierarchy", StringComparison.Ordinal));
            Assert.True(from >= 0 && order > from, "the current-status block was not found");
            return string.Join("\n", lines.Skip(from).Take(order - from + 1).Where(l => !l.StartsWith("WHERE ", StringComparison.Ordinal)));
        }

        var blocks = new[] { "Functions/GetProjectDeletionTier.sql", "Functions/GetProgramDeletionEligibility.sql", "Stored Procedures/ExecuteProgramDeletion.sql" }
            .Select(f => Resolution(File.ReadAllText(Path.Combine(root, f))))
            .Distinct()
            .ToList();
        Assert.Single(blocks);
    }

    [Fact]
    public async Task ItemizedChild_InAnApprovedProgram_IsStillHardDeleted()
    {
        // Criterion 3: an itemized child is always hard-deleted, so no row keeps its Project ID.
        await SetProgramStageAsync(GAAR, status: Approved);
        await SeedProjectAsync("P01000036LZ", parentProjectId: "P01000099LS", isRevised: true, stages: new[] { (GAAR, "P01000036LZ") });

        await ExecSql("P01000036LZ");

        Assert.Equal(0, await CountAsync("dbo.tProjects", "ProjectPK = 'P01000036LZ'"));
        Assert.Equal(0, await CountAsync("dbo.tProjectRevisions", "ProjectId = 'P01000036LZ'"));
    }

    // ---------------------------------------------------------------------------------------
    // Fixture
    // ---------------------------------------------------------------------------------------

    /// <summary>The transactional part of program delete alone (ProgramHelper.DeleteProgramInTransactionAsync),
    /// in a transaction that rolls back on any exception, as ExecuteProgramDeletionAsync runs it.</summary>
    private Task<IEnumerable<string>> DeleteProgramInTransactionAsync()
    {
        var sql = new SqlExecutor(ConnectionString);
        return sql.ExecuteTransactionAsync((connection, transaction) =>
            sql.DeleteProgramInTransactionAsync(Program, "test", new DateTime(2026, 10, 16), connection, transaction));
    }

    /// <summary>A user's soft delete: every revision of the project under <see cref="Program"/> flagged.</summary>
    private Task SoftDeleteAsync(string projectPK) =>
        ExecuteAsync($"UPDATE dbo.tProjectRevisions SET IsDeleted = 1 WHERE ProjectFK = '{projectPK}' AND ProgramFK = '{Program}';");

    private async Task AssertNothingDeletedAsync(params string[] projectPKs)
    {
        Assert.Equal(1, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
        foreach (string projectPK in projectPKs)
        {
            Assert.Equal(1, await CountAsync("dbo.tProjects", $"ProjectPK = '{projectPK}'"));
            Assert.Equal(0, await CountAsync("dbo.tTransactionLog", $"ReferenceId = '{projectPK}'"));
        }
        Assert.Equal(0, await CountAsync("dbo.tTransactionLog", $"ReferenceId = '{Program}'"));
    }

    private const int Approved = 1, Working = 3;

    /// <summary>One program revision + stage row for <see cref="Program"/> at <paramref name="stageId"/>.</summary>
    private async Task SetProgramStageAsync(int stageId, int status)
    {
        int revisionId = await ScalarAsync(
            $"INSERT dbo.tProgramRevisions (ProgramFK, Name, Status) VALUES ('{Program}', 'Test program', {status}); SELECT CAST(SCOPE_IDENTITY() AS INT);");
        await ExecuteAsync($"INSERT dbo.tProgramStages (ProgramFK, StageId, StageName, RevisionId) VALUES ('{Program}', {stageId}, 'S{stageId}', {revisionId});");
    }

    private async Task<(string Eligibility, string? BlockedBy)> EligibilityCodeAsync()
    {
        var result = await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilityAsync(Program);
        Assert.NotNull(result);
        return (result!.Eligibility, result.BlockedBy);
    }

    private async Task<(string Eligibility, string Reason)> EligibilityAsync()
    {
        var result = await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilityAsync(Program);
        Assert.NotNull(result);
        return (result!.Eligibility, result.Reason);
    }

    /// <summary>Runs the real hard-delete cascade through the actual production entry point
    /// (ISqlExecutor.ExecuteProjectDeletionAsync — decides the tier on locked rows first and acts on
    /// the named ProjectPK only; a revision id is not resolved there). Pass
    /// <paramref name="transaction"/> so a test can observe a mid-cascade failure or a
    /// caller-owned rollback; when omitted, runs standalone.</summary>
    private Task ExecSql(string projectRef, SqlConnection? connection = null, SqlTransaction? transaction = null) =>
        new SqlExecutor(ConnectionString).ExecuteProjectDeletionAsync(
            projectRef, Program, "test", new DateTime(2026, 10, 15), tx: transaction);

    /// <summary>Runs the real Program-delete orchestration (ProgramHelper.ExecuteProgramDeletionAsync)
    /// against this test's database, through the actual production entry point.</summary>
    private Task<IEnumerable<string>> ExecuteProgramDeletionAsync() =>
        new SqlExecutor(ConnectionString).ExecuteProgramDeletionAsync(Program, "test", new DateTime(2026, 10, 15));

    /// <summary>dbo.tProjectIdReleased exactly as Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql creates it.</summary>
    private static readonly string ReleasedTableSql = ExtractReleasedTableDdl();

    private static string ExtractReleasedTableDdl()
    {
        string script = File.ReadAllText(Path.Combine(
            FindRepositoryDirectory("Main/Resources/Internal/SQLScripts"), "Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql"));
        int start = script.IndexOf("CREATE TABLE dbo.tProjectIdReleased", StringComparison.Ordinal);
        int end = script.IndexOf(");", start, StringComparison.Ordinal) + 2;
        return script[start..end];
    }

    private Task<List<int>> SeedProjectAsync(string projectPK, params (int StageId, string ProjectId)[] stages) =>
        SeedProjectAsync(projectPK, stages, Program); // three positional args: the params overload cannot match itself

    /// <summary>One tProjects row, and one tProjectRevisions + tProjectStages pair per stage, in order. Returns the revision ids.</summary>
    private async Task<List<int>> SeedProjectAsync(string projectPK, (int StageId, string ProjectId)[] stages, string program = Program,
        bool isPublished = false, bool isRevised = false, string projectType = "", string? parentProjectId = null, int? category = null)
    {
        await ExecuteAsync(
            "INSERT dbo.tProjects (ProjectPK, ProgramFK, IsPublished, IsRevised, ProjectType, ParentProjectId) " +
            $"VALUES ('{projectPK}', '{program}', {(isPublished ? 1 : 0)}, {(isRevised ? 1 : 0)}, '{projectType}', {(parentProjectId is null ? "NULL" : $"'{parentProjectId}'")});");

        var revisionIds = new List<int>();
        foreach (var (stageId, projectId) in stages)
        {
            int revisionId = await ScalarAsync(
                $"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, Category, IsDeleted) VALUES ('{projectPK}', '{program}', '{projectId}', {(category?.ToString() ?? "NULL")}, 0); SELECT CAST(SCOPE_IDENTITY() AS INT);");
            await ExecuteAsync($"INSERT dbo.tProjectStages (ProjectFK, ProgramFK, RevisionId, StageId) VALUES ('{projectPK}', '{program}', {revisionId}, {stageId});");
            revisionIds.Add(revisionId);
        }
        return revisionIds;
    }

    /// <summary>A row in every table the cascade must clear, hung off <paramref name="revisionId"/>.</summary>
    private async Task SeedChildRowsAsync(int revisionId, string transactionId)
    {
        string projectFK = "(SELECT ProjectFK FROM dbo.tProjectRevisions WHERE Id = " + revisionId + ")";
        await ExecuteAsync($"""
            DECLARE @cost INT, @item INT, @detail INT, @rcost INT, @ritem INT;
            INSERT dbo.tProjectComponentCost (ProjectRevisionFK) VALUES ({revisionId}); SET @cost = SCOPE_IDENTITY();
            INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK) VALUES (@cost);
            INSERT dbo.tProjectMajorWorkItem (ComponentCostFK) VALUES (@cost); SET @item = SCOPE_IDENTITY();
            INSERT dbo.tProjectMajorWorkLocations (WorkItemFK) VALUES (@item);
            INSERT dbo.tProjectNotes (ProjectRevisionFK) VALUES ({revisionId});
            INSERT dbo.tProjectFundingProfile (ProjectRevisionFK) VALUES ({revisionId});
            INSERT dbo.tProjectSupportingDocs (ProjectRevisionFK) VALUES ({revisionId});
            INSERT dbo.tRevisionDetails (TransactionId, ProjectFK, ProjectRevisionFK) VALUES ('{transactionId}', {projectFK}, {revisionId}); SET @detail = SCOPE_IDENTITY();
            INSERT dbo.tRevisionProjectComponentCost (RevisionDetailFK) VALUES (@detail); SET @rcost = SCOPE_IDENTITY();
            INSERT dbo.tRevisionProjectComponentCostPerYear (RevisionComponentCostFK) VALUES (@rcost);
            INSERT dbo.tRevisionProjectMajorWorkItem (ComponentCostFK) VALUES (@rcost); SET @ritem = SCOPE_IDENTITY();
            INSERT dbo.tRevisionProjectMajorWorkLocations (RevisionWorkItemFK) VALUES (@ritem);
            INSERT dbo.tRevisionProjectFundingProfile (RevisionDetailFK) VALUES (@detail);
            INSERT dbo.tRevisionProjectSnapshot (RevisionDetailFK) VALUES (@detail);
            INSERT dbo.tRevisionApprovals (RevisionDetailFK) VALUES (@detail);
            INSERT dbo.tRevisionDocuments (RevisionDetailFK) VALUES (@detail);
            INSERT dbo.tRevisionForCorrectionDetails (RevisionDetailFK) VALUES (@detail);
            INSERT dbo.tRevisionPCMAComponent (TransactionId) VALUES ('{transactionId}');
            INSERT dbo.tRevisionProjects (ProjectFK, ProgramFK) VALUES ({projectFK}, '{Program}');
            """);
    }

    private static IEnumerable<(string Table, string Where)> CascadeTables(int revisionId) => new[]
    {
        ("dbo.tProjects", "ProjectPK = 'P01000010LZ'"),
        ("dbo.tProjectRevisions", "ProjectFK = 'P01000010LZ'"),
        ("dbo.tProjectStages", "ProjectFK = 'P01000010LZ'"),
        ("dbo.tProjectComponentCost", $"ProjectRevisionFK = {revisionId}"),
        ("dbo.tProjectComponentCostPerYear", "1 = 1"),
        ("dbo.tProjectMajorWorkItem", "1 = 1"),
        ("dbo.tProjectMajorWorkLocations", "1 = 1"),
        ("dbo.tProjectNotes", "1 = 1"),
        ("dbo.tProjectFundingProfile", "1 = 1"),
        ("dbo.tProjectSupportingDocs", "1 = 1"),
        ("dbo.tRevisionDetails", "ProjectFK = 'P01000010LZ'"),
        ("dbo.tRevisionProjectComponentCost", "1 = 1"),
        ("dbo.tRevisionProjectComponentCostPerYear", "1 = 1"),
        ("dbo.tRevisionProjectMajorWorkItem", "1 = 1"),
        ("dbo.tRevisionProjectMajorWorkLocations", "1 = 1"),
        ("dbo.tRevisionProjectFundingProfile", "1 = 1"),
        ("dbo.tRevisionProjectSnapshot", "1 = 1"),
        ("dbo.tRevisionApprovals", "1 = 1"),
        ("dbo.tRevisionDocuments", "1 = 1"),
        ("dbo.tRevisionForCorrectionDetails", "1 = 1"),
        ("dbo.tRevisionProjects", "ProjectFK = 'P01000010LZ'"),
    };

    /// <summary>The columns the objects touch, with the live database's real foreign keys.</summary>
    private const string SchemaSql = """
        CREATE TABLE dbo.tPrograms (ProgramPK NVARCHAR(200) PRIMARY KEY, StartYear INT NULL, IsPublished BIT NOT NULL DEFAULT 0);
        CREATE TABLE dbo.tOptionProgramStage (Id INT PRIMARY KEY, StageHierarchy INT NOT NULL);
        INSERT dbo.tOptionProgramStage (Id, StageHierarchy) VALUES (1, 1), (2, 2), (7, 7), (8, 0);
        CREATE TABLE dbo.tProgramRevisions (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), Name NVARCHAR(200) NULL, Status INT NULL);
        CREATE TABLE dbo.tProgramStages (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), ProgramId NVARCHAR(200) NULL, StageId INT NULL, StageName NVARCHAR(20) NULL, RevisionId INT NULL);
        CREATE TABLE dbo.tTransactionLog (Id INT IDENTITY PRIMARY KEY, ReferenceId NVARCHAR(200) NOT NULL, TransactionType NVARCHAR(50) NOT NULL,
            AffectedTable NVARCHAR(100) NOT NULL, AffectedColumn NVARCHAR(100) NOT NULL, OldValue NVARCHAR(MAX) NOT NULL, NewValue NVARCHAR(MAX) NOT NULL,
            CreatedBy NVARCHAR(100) NOT NULL, Hostname NVARCHAR(100) NOT NULL, CreatedDate DATETIME NOT NULL);
        CREATE TABLE dbo.tProjects (ProjectPK NVARCHAR(200) PRIMARY KEY, ProgramFK NVARCHAR(200) NOT NULL, IsPublished BIT NOT NULL, IsRevised BIT NOT NULL,
            ProjectType NVARCHAR(10) NOT NULL, ParentProjectId NVARCHAR(200) NULL);
        CREATE TABLE dbo.tProjectRevisions (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200) NOT NULL CONSTRAINT FK_tProjectRevisions_Project REFERENCES dbo.tProjects(ProjectPK),
            ProgramFK NVARCHAR(200) NOT NULL, ProgramId NVARCHAR(200) NULL, ProjectId NVARCHAR(200) NULL, Category INT NULL, IsDeleted BIT NOT NULL);
        CREATE TABLE dbo.tProjectStages (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200) NOT NULL CONSTRAINT FK_tProjectStages_Project REFERENCES dbo.tProjects(ProjectPK),
            ProgramFK NVARCHAR(200) NOT NULL, RevisionId INT NOT NULL CONSTRAINT FK_tProjectStages_Revision REFERENCES dbo.tProjectRevisions(Id), StageId INT NOT NULL,
            StageName NVARCHAR(20) NULL);
        CREATE TABLE dbo.tProjectComponentCost (Id INT IDENTITY PRIMARY KEY, ProjectRevisionFK INT NOT NULL CONSTRAINT FK_tProjectComponentCost_Revision REFERENCES dbo.tProjectRevisions(Id));
        CREATE TABLE dbo.tProjectComponentCostPerYear (Id INT IDENTITY PRIMARY KEY, ComponentCostFK INT NOT NULL);
        CREATE TABLE dbo.tProjectMajorWorkItem (Id INT IDENTITY PRIMARY KEY, ComponentCostFK INT NOT NULL);
        CREATE TABLE dbo.tProjectMajorWorkLocations (Id INT IDENTITY PRIMARY KEY, WorkItemFK INT NOT NULL);
        CREATE TABLE dbo.tProjectNotes (Id INT IDENTITY PRIMARY KEY, ProjectRevisionFK INT NOT NULL CONSTRAINT FK_tProjectNotes_Revision REFERENCES dbo.tProjectRevisions(Id));
        CREATE TABLE dbo.tProjectFundingProfile (Id INT IDENTITY PRIMARY KEY, ProjectRevisionFK INT NOT NULL CONSTRAINT FK_tProjectFundingProfile_Revision REFERENCES dbo.tProjectRevisions(Id));
        CREATE TABLE dbo.tProjectSupportingDocs (Id INT IDENTITY PRIMARY KEY, ProjectRevisionFK INT NOT NULL);
        CREATE TABLE dbo.tRevisionDetails (Id INT IDENTITY PRIMARY KEY, TransactionId NVARCHAR(100) NOT NULL,
            ProjectFK NVARCHAR(200) NOT NULL CONSTRAINT FK_tRevisionDetails_Project REFERENCES dbo.tProjects(ProjectPK),
            ProjectRevisionFK INT NOT NULL CONSTRAINT FK_tRevisionDetails_ProjectRevision REFERENCES dbo.tProjectRevisions(Id));
        CREATE TABLE dbo.tRevisionProjectComponentCost (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionProjectComponentCostPerYear (Id INT IDENTITY PRIMARY KEY, RevisionComponentCostFK INT NOT NULL REFERENCES dbo.tRevisionProjectComponentCost(Id));
        CREATE TABLE dbo.tRevisionProjectMajorWorkItem (Id INT IDENTITY PRIMARY KEY, ComponentCostFK INT NOT NULL);
        CREATE TABLE dbo.tRevisionProjectMajorWorkLocations (Id INT IDENTITY PRIMARY KEY, RevisionWorkItemFK INT NOT NULL);
        CREATE TABLE dbo.tRevisionProjectFundingProfile (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionProjectSnapshot (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionApprovals (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionDocuments (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionForCorrectionDetails (Id INT IDENTITY PRIMARY KEY, RevisionDetailFK INT NOT NULL REFERENCES dbo.tRevisionDetails(Id));
        CREATE TABLE dbo.tRevisionPCMAComponent (Id INT IDENTITY PRIMARY KEY, TransactionId NVARCHAR(100) NOT NULL);
        CREATE TABLE dbo.tRevisionProjects (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200) NOT NULL, ProgramFK NVARCHAR(200) NOT NULL);
        """;

    private async Task<List<ProjectHelper.ProjectDeletionTierResult>> TierAsync(string projectRef)
    {
        var rows = await new SqlExecutor(ConnectionString).DetermineProjectDeletionTierAsync(projectRef, Program);
        return rows;
    }

    private async Task<int> CountAsync(string table, string where) =>
        await ScalarAsync($"SELECT COUNT(*) FROM {table} WHERE {where};");

    private async Task<int> ScalarAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private async Task ExecuteAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static string FindRepositoryDirectory(string relativePath)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            string candidate = Path.Combine(dir.FullName, relativePath);
            if (Directory.Exists(candidate)) return candidate;
        }
        throw new DirectoryNotFoundException($"{relativePath} not found above {AppContext.BaseDirectory}.");
    }
}
