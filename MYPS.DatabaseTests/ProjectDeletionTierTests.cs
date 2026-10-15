using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  The project/program hard-delete rule is implemented by 4 .sql script files under
    Main/Resources/Internal/SQLScripts/Deletion/ (GetProjectDeletionTier.sql,
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
    private const int BP = 1, NEP = 2, GAAR = 7;

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
    public async Task FirstStageEntryBornAtNEP_WithPPrefix_IsHard()
    {
        await SeedProjectAsync("P01000002LZ", (NEP, "P01000002LZ"));
        Assert.Equal("Hard", Assert.Single(await TierAsync("P01000002LZ")).Tier);
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
        await SeedProjectAsync("P01000006LS", projectType: "LS", stages: new[] { (GAAR, "P01000006LS") });
        var row = Assert.Single(await TierAsync("P01000006LS"));
        Assert.Equal(("Hard", "LSParent"), (row.Tier, row.Kind));
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
        await SeedProjectAsync("P01100001LZ", (NEP, "P01100001LZ"));
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
    public async Task Cascade_RefusesAnAdvancedProject_NamedByItsPFormId()
    {
        // The P-form revision id resolves to the BP-form project, which has progressed: refused, nothing written.
        await SeedProjectAsync("BP01000012LZ", (BP, "BP01000012LZ"), (NEP, "P01000012LZ"));
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecSql("P01000012LZ"));
        Assert.Equal("Project BP01000012LZ cannot be permanently deleted: progressed past its first stage.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tProjects", "ProjectPK = 'BP01000012LZ'"));
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

    [Fact]
    public async Task ProgramDeletion_RefusesAnApprovedProgram_WithTheReason()
    {
        await SetProgramStageAsync(GAAR, status: Approved);
        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Equal($"Program {Program} cannot be deleted: program is approved.", ex.Reason);
        Assert.Equal(1, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
    }

    [Fact]
    public async Task ProgramDeletion_LogsEveryProjectAndTheProgram()
    {
        await SetProgramStageAsync(BP, status: Working);
        await SeedProjectAsync("BP01000023LZ", (BP, "BP01000023LZ"));
        await SeedProjectAsync("BP01000024LZ", (BP, "BP01000024LZ"));

        await ExecuteProgramDeletionAsync();

        Assert.Equal(0, await CountAsync("dbo.tPrograms", $"ProgramPK = '{Program}'"));
        Assert.Equal(2, await CountAsync("dbo.tTransactionLog", "ReferenceId IN ('BP01000023LZ', 'BP01000024LZ') AND NewValue = 'Permanently deleted'"));
        Assert.Equal(1, await CountAsync("dbo.tTransactionLog",
            $"ReferenceId = '{Program}' AND AffectedTable = 'tPrograms, tProgramRevisions, tProgramStages' AND OldValue LIKE '%\"ProjectsDeleted\":2%'"));
    }

    [Fact]
    public async Task Wrapper_TurnsARefusalIntoDeletionRefusedException_WithAPlainReason()
    {
        await SeedProjectAsync("BP01000025LZ", isPublished: true, stages: new[] { (BP, "BP01000025LZ") });

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() =>
            new SqlExecutor(ConnectionString).ExecuteProjectDeletionAsync("BP01000025LZ", Program, "test", new DateTime(2026, 10, 15)));
        Assert.Equal("Project BP01000025LZ cannot be permanently deleted: published.", ex.Reason);
    }

    [Fact]
    public async Task ProgramDeletion_RefusesWhenAChildIsNotHard_NamingIt()
    {
        await ExecuteAsync($"INSERT dbo.tProgramStages (ProgramFK) VALUES ('{Program}');");
        await SeedProjectAsync("BP01000015LZ", isPublished: true, stages: new[] { (BP, "BP01000015LZ") });

        var ex = await Assert.ThrowsAsync<ProjectHelper.DeletionRefusedException>(() => ExecuteProgramDeletionAsync());
        Assert.Contains("BP01000015LZ (published)", ex.Reason);
    }

    // ---------------------------------------------------------------------------------------
    // Fixture
    // ---------------------------------------------------------------------------------------

    private const int Approved = 1, Working = 3;

    /// <summary>One program revision + stage row for <see cref="Program"/> at <paramref name="stageId"/>.</summary>
    private async Task SetProgramStageAsync(int stageId, int status)
    {
        int revisionId = await ScalarAsync(
            $"INSERT dbo.tProgramRevisions (ProgramFK, Name, Status) VALUES ('{Program}', 'Test program', {status}); SELECT CAST(SCOPE_IDENTITY() AS INT);");
        await ExecuteAsync($"INSERT dbo.tProgramStages (ProgramFK, StageId, StageName, RevisionId) VALUES ('{Program}', {stageId}, 'S{stageId}', {revisionId});");
    }

    private async Task<(string Eligibility, string Reason)> EligibilityAsync()
    {
        var result = await new SqlExecutor(ConnectionString).DetermineProgramDeletionEligibilityAsync(Program);
        Assert.NotNull(result);
        return (result!.Eligibility, result.Reason);
    }

    /// <summary>Runs the real hard-delete cascade through the actual production entry point
    /// (ISqlExecutor.ExecuteProjectDeletionAsync — re-derives and re-checks the tier first,
    /// resolves ambiguous/alternate-form references exactly as the real code path does). Pass
    /// <paramref name="transaction"/> so a test can observe a mid-cascade failure or a
    /// caller-owned rollback; when omitted, runs standalone.</summary>
    private Task ExecSql(string projectRef, SqlConnection? connection = null, SqlTransaction? transaction = null) =>
        new SqlExecutor(ConnectionString).ExecuteProjectDeletionAsync(
            projectRef, Program, "test", new DateTime(2026, 10, 15), tx: transaction);

    /// <summary>Runs the real Program-delete orchestration (ProgramHelper.ExecuteProgramDeletionAsync)
    /// against this test's database, through the actual production entry point.</summary>
    private Task<IEnumerable<string>> ExecuteProgramDeletionAsync() =>
        new SqlExecutor(ConnectionString).ExecuteProgramDeletionAsync(Program, "test", new DateTime(2026, 10, 15));

    private Task<List<int>> SeedProjectAsync(string projectPK, params (int StageId, string ProjectId)[] stages) =>
        SeedProjectAsync(projectPK, stages, Program); // three positional args: the params overload cannot match itself

    /// <summary>One tProjects row, and one tProjectRevisions + tProjectStages pair per stage, in order. Returns the revision ids.</summary>
    private async Task<List<int>> SeedProjectAsync(string projectPK, (int StageId, string ProjectId)[] stages, string program = Program,
        bool isPublished = false, bool isRevised = false, string projectType = "", string? parentProjectId = null)
    {
        await ExecuteAsync(
            "INSERT dbo.tProjects (ProjectPK, ProgramFK, IsPublished, IsRevised, ProjectType, ParentProjectId) " +
            $"VALUES ('{projectPK}', '{program}', {(isPublished ? 1 : 0)}, {(isRevised ? 1 : 0)}, '{projectType}', {(parentProjectId is null ? "NULL" : $"'{parentProjectId}'")});");

        var revisionIds = new List<int>();
        foreach (var (stageId, projectId) in stages)
        {
            int revisionId = await ScalarAsync(
                $"INSERT dbo.tProjectRevisions (ProjectFK, ProgramFK, ProjectId, IsDeleted) VALUES ('{projectPK}', '{program}', '{projectId}', 0); SELECT CAST(SCOPE_IDENTITY() AS INT);");
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
        CREATE TABLE dbo.tPrograms (ProgramPK NVARCHAR(200) PRIMARY KEY, StartYear INT NULL);
        CREATE TABLE dbo.tOptionProgramStage (Id INT PRIMARY KEY, StageHierarchy INT NOT NULL);
        INSERT dbo.tOptionProgramStage (Id, StageHierarchy) VALUES (1, 1), (2, 2), (7, 7);
        CREATE TABLE dbo.tProgramRevisions (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), Name NVARCHAR(200) NULL, Status INT NULL);
        CREATE TABLE dbo.tProgramStages (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), StageId INT NULL, StageName NVARCHAR(20) NULL, RevisionId INT NULL);
        CREATE TABLE dbo.tTransactionLog (Id INT IDENTITY PRIMARY KEY, ReferenceId NVARCHAR(200) NOT NULL, TransactionType NVARCHAR(50) NOT NULL,
            AffectedTable NVARCHAR(100) NOT NULL, AffectedColumn NVARCHAR(100) NOT NULL, OldValue NVARCHAR(MAX) NOT NULL, NewValue NVARCHAR(MAX) NOT NULL,
            CreatedBy NVARCHAR(100) NOT NULL, Hostname NVARCHAR(100) NOT NULL, CreatedDate DATETIME NOT NULL);
        CREATE TABLE dbo.tProjects (ProjectPK NVARCHAR(200) PRIMARY KEY, ProgramFK NVARCHAR(200) NOT NULL, IsPublished BIT NOT NULL, IsRevised BIT NOT NULL,
            ProjectType NVARCHAR(10) NOT NULL, ParentProjectId NVARCHAR(200) NULL);
        CREATE TABLE dbo.tProjectRevisions (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200) NOT NULL CONSTRAINT FK_tProjectRevisions_Project REFERENCES dbo.tProjects(ProjectPK),
            ProgramFK NVARCHAR(200) NOT NULL, ProjectId NVARCHAR(200) NULL, IsDeleted BIT NOT NULL);
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
