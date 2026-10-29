using Microsoft.Data.SqlClient;
using System.Data;
using Xunit;

namespace MYPS.DatabaseTests;

/*  dbo.pRecomputeProgramCost (writes tProgramRevisions.Cost, what Program Details shows) and
    dbo.fProgramStages (the program list's per-stage Cost) are ONE rule by two paths. Every test
    here that computes a figure asserts it through BOTH (AssertCostAsync), so the two cannot
    drift apart unnoticed.

    THE RULE (section 11 of Migration.SchemaAndProgrammability.2026-09-10.sql):
      - an ordinary project counts at the program's current stage (highest StageHierarchy),
        on its latest LIVE revision there: one distinct Year of per-year rows counts whatever
        the year; several count only the program year (tPrograms.StartYear);
      - at GAA-R only, an ordinary project with an effective approved Formal Revision (RO and CO
        approved, project published, no later stage) is read from that revision's tRevision*
        per-year rows instead of the base ones (RISK-108, rule of 2026-09-20);
      - a Lump Sum parent counts ONLY the Total of its live 'LS' component on its latest live
        revision, at ANY stage -- never its per-year rows;
      - an itemized child never counts.

    The objects under test are READ FROM THAT SOURCE FILE at run time, not copied in here. The
    previous version of this file embedded a hand-kept copy of the procedure, and the copy and
    the source drifted apart twice (RISK-108's fix lived only in the copy for a week). */
public sealed class RecomputeProgramCostTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, SchemaSql);
        await ExecuteNonQueryAsync(connection, Section11.Value.Function);
        await ExecuteNonQueryAsync(connection, Section11.Value.Procedure);
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    // ---------------------------------------------------------------------------------------
    // Contract and failure modes
    // ---------------------------------------------------------------------------------------

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_ReturnsContractAndExcludesPriorStage()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("dbo.pRecomputeProgramCost", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@ProgramPK", SqlDbType.NVarChar, 200) { Value = "PROGRAM-1" });
        await using SqlDataReader reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(new[] { "RevisionId", "StageId", "NewCost" }, Enumerable.Range(0, reader.FieldCount).Select(reader.GetName));
        Assert.Equal(1, reader.GetInt32(0));
        Assert.Equal(2, reader.GetInt32(1));
        // PROJECT-MULTI contributes its 2026 row (100) and nothing else; PROJECT-OLD sits at a
        // prior stage and contributes nothing at all.
        Assert.Equal(100.00m, reader.GetDecimal(2));
        Assert.False(await reader.ReadAsync());
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_UpdateRollsBackWithCallingTransaction()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using SqlTransaction transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        await ExecuteNonQueryAsync(connection, "UPDATE dbo.tProjectComponentCostPerYear SET Amount = 250 WHERE ComponentCostFK = 1001 AND [Year] = 2026;", transaction);
        await ExecuteProcedureAsync(connection, transaction, "PROGRAM-1");
        Assert.Equal(250.00m, await ReadStoredCostAsync(connection, transaction));
        await transaction.RollbackAsync();
        Assert.Equal(0.00m, await ReadStoredCostAsync(connection, null));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_MissingRevisionThrowsSpecificSqlError()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        SqlException error = await Assert.ThrowsAsync<SqlException>(() => ExecuteProcedureAsync(connection, null, "MISSING"));
        // RAISERROR with an ad hoc message string (not a sys.messages id) always reports 50000.
        Assert.Equal(50000, error.Number);
        Assert.Contains("has no revisions to recompute Cost for", error.Message, StringComparison.Ordinal);
    }

    // With no program year, every multi-year project would silently contribute nothing. The
    // procedure refuses instead, the way it refuses a program with no revision.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_NullStartYearThrowsSpecificSqlError()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        const string sql = """
            INSERT dbo.tPrograms(ProgramPK, StartYear, IsDeleted) VALUES (N'PROGRAM-NOYEAR', NULL, 0);
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (9, N'PROGRAM-NOYEAR', 0);
            INSERT dbo.tProgramStages(ProgramFK, RevisionId, StageId, StageName) VALUES (N'PROGRAM-NOYEAR', 9, 2, N'HGAB');
            """;
        await ExecuteNonQueryAsync(connection, sql);

        SqlException error = await Assert.ThrowsAsync<SqlException>(() => ExecuteProcedureAsync(connection, null, "PROGRAM-NOYEAR"));

        Assert.Equal(50000, error.Number);
        Assert.Contains("has no StartYear", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_IsSafeUnderConcurrentRecomputation()
    {
        await SeedProgramAsync();
        Task<decimal>[] tasks = Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var connection = new SqlConnection(ConnectionString);
            await connection.OpenAsync();
            await ExecuteProcedureAsync(connection, null, "PROGRAM-1");
            return await ReadStoredCostAsync(connection, null);
        }).ToArray();
        decimal[] results = await Task.WhenAll(tasks);
        Assert.All(results, value => Assert.Equal(100.00m, value));
    }

    // ---------------------------------------------------------------------------------------
    // Ordinary projects: the per-year, program-year rule
    // ---------------------------------------------------------------------------------------

    // Several years of rows count ONLY the program year.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_WithSeveralYearsCountsOnlyTheProgramYear()
    {
        await SeedProgramAsync();

        // PROJECT-MULTI holds 100 at 2026 (the program year) and 900 at 2027.
        await AssertCostAsync(100.00m);
    }

    // A project with ONE year counts it whatever the year is. Here the only row sits at 2030,
    // four years off the program year, and still counts in full.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_WithOneYearCountsItWhateverTheYear()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES (N'PROJECT-SINGLE', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-SINGLE', N'PROGRAM-1', 110, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1010, 110, N'CW1', 777, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES (1010, 42, 2030, 0);
            """);

        // 100 from PROJECT-MULTI's program-year row + 42 from the single off-year row.
        await AssertCostAsync(142.00m);
    }

    // "One year" means one distinct Year, not one row: two components each holding a single row
    // for the same year are one year of cost between them, and both rows count.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_TreatsTwoComponentsInOneYearAsASingleYear()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES (N'PROJECT-TWOCOMP', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-TWOCOMP', N'PROGRAM-1', 111, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1011, 111, N'CW1', 5, 0), (1012, 111, N'CW2', 7, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1011, 5, 2031, 0), (1012, 7, 2031, 0);
            """);

        // 100 + (5 + 7): one distinct year, so both rows count despite being off the program year.
        await AssertCostAsync(112.00m);
    }

    // A project at the stage with no per-year rows adds nothing. It must not fall through to its
    // component Total: that is the Lump Sum parent's figure, and only the parent's.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_ProjectWithNoPerYearRowsAddsNothing()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES (N'PROJECT-BARE', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-BARE', N'PROGRAM-1', 112, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1013, 112, N'CW1', 9999, 0);
            """);

        await AssertCostAsync(100.00m);
    }

    // tProjectStages holds one row per revision, so a project revised in place at the same stage
    // appears twice. Only its latest revision counts, or the project pays twice.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_CountsOnlyTheLatestRevisionOfAProjectAtTheStage()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            -- a second, later revision of PROJECT-MULTI at the same stage, worth 60 at the program year
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-MULTI', N'PROGRAM-1', 120, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1020, 120, N'CW1', 60, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1020, 60, 2026, 0), (1020, 10, 2027, 0);
            """);

        // The later revision (60), not 100, and not 160.
        await AssertCostAsync(60.00m);
    }

    // Deleted component rows and deleted per-year rows are both out of the sum.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_IgnoresDeletedComponentsAndDeletedYears()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES (N'PROJECT-DELETED', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-DELETED', N'PROGRAM-1', 113, 2);
            -- deleted component, live year
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1014, 113, N'CW1', 70, 1);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES (1014, 70, 2026, 0);
            -- live component, deleted year
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1015, 113, N'CW2', 80, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES (1015, 80, 2026, 1);
            """);

        await AssertCostAsync(100.00m);
    }

    // A project soft-deleted at the stage (Batch Delete flags that stage's revision) no longer
    // counts there, in the cost or in the stage's project count. It used to count until it was
    // hard-deleted (2026-10-29).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_ProjectSoftDeletedAtTheStageNoLongerCounts()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES (N'PROJECT-SOFT', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectRevisions(Id, ProjectFK, IsDeleted) VALUES (114, N'PROJECT-SOFT', 1);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-SOFT', N'PROGRAM-1', 114, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1016, 114, N'CW1', 40, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES (1016, 40, 2026, 0);
            """);

        // PROJECT-MULTI's 100 only, and PROJECT-MULTI is the stage's one project.
        await AssertCostAsync(100.00m);
        Assert.Equal(1, await ReadProjectCountAsync(2));
    }

    // Batch Delete flags a project's latest LIVE revision at the stage. When an older revision
    // there is still live, the project is still at the stage, and that revision is what counts.
    // The deleted revision's stage row is out of the stage's project count.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Rule_OlderLiveRevisionCountsWhenTheLatestIsDeleted()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            -- a later revision of PROJECT-MULTI at the same stage, worth 60, deleted
            INSERT dbo.tProjectRevisions(Id, ProjectFK, IsDeleted) VALUES (120, N'PROJECT-MULTI', 1);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-MULTI', N'PROGRAM-1', 120, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1020, 120, N'CW1', 60, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1020, 60, 2026, 0), (1020, 10, 2027, 0);
            """);

        // The older live revision (100), not the deleted one (60).
        await AssertCostAsync(100.00m);
        Assert.Equal(1, await ReadProjectCountAsync(2));
    }

    // The current stage is the one vProgramLatest shows, the highest StageHierarchy, not the
    // newest program revision: legacy imports inserted their stages out of order, and the
    // recompute then wrote an earlier stage's figure into that stage's revision (2026-10-29).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_PicksTheCurrentStageByStageOrderNotInsertionOrder()
    {
        await ExecuteAsync("""
            INSERT dbo.tPrograms(ProgramPK, StartYear, IsDeleted) VALUES (N'PROGRAM-1', 2026, 0);
            -- GAA (revision 1) was inserted before NEP (revision 2); GAA is the current stage.
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (1, N'PROGRAM-1', 0), (2, N'PROGRAM-1', 0);
            INSERT dbo.tProgramStages(ProgramFK, RevisionId, StageId, StageName) VALUES
                (N'PROGRAM-1', 1, 6, N'GAA'),
                (N'PROGRAM-1', 2, 2, N'NEP');
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES
                (N'PROJECT-AT-GAA', N'PROGRAM-1', N'LZ', NULL),
                (N'PROJECT-AT-NEP', N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES
                (N'PROJECT-AT-GAA', N'PROGRAM-1', 140, 6),
                (N'PROJECT-AT-NEP', N'PROGRAM-1', 141, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES
                (1040, 140, N'CW1', 70, 0),
                (1041, 141, N'CW1', 30, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1040, 70, 2026, 0),
                (1041, 30, 2026, 0);
            """);

        // GAA's 70 written into GAA's revision (1); NEP's revision (2) is left alone.
        await AssertCostAsync(70.00m, stageId: 6);
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("SELECT Cost FROM dbo.tProgramRevisions WHERE Id = 2", connection);
        Assert.Equal(0.00m, Convert.ToDecimal(await command.ExecuteScalarAsync()));
    }

    // ---------------------------------------------------------------------------------------
    // Lump Sum parents and itemized children (rule of 2026-09-18)
    // ---------------------------------------------------------------------------------------

    // A LUMP SUM PARENT contributes its LS component Total -- the appropriation -- and NOT its
    // per-year row, which holds only what is left after itemization. Seeded to differ on purpose:
    // Total 500, per-year balance 200. A rule reading the per-year row would report 300.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ParentCountsItsLsComponentTotalNeverItsPerYearBalance()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();

        // 100 (PROJECT-MULTI) + 500 (the parent's appropriation).
        await AssertCostAsync(600.00m);
    }

    // An ITEMIZED CHILD adds nothing: its money was drawn out of the parent's appropriation,
    // already counted whole (RISK-009). It is seeded to look as countable as possible -- an 'LS'
    // component, ProjectType 'LS', a per-year row at the program year, at the current stage --
    // because only ParentProjectId may exclude it.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ItemizedChildNeverCounts()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();

        // The child holds 300 at the program year. Were it counted, the total would be 900.
        await AssertCostAsync(600.00m);
    }

    // A parent counts WHATEVER STAGE its own stage row sits at. Parents stay at GAA-R while their
    // program moves on; a stage filter zeroed 86 of 123 of them on myps_db_dev_200.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ParentAtAnotherStageStillCounts()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        await ExecuteAsync("UPDATE dbo.tProjectStages SET StageId = 7 WHERE ProjectFK = N'PROJECT-LS-PARENT';");

        await AssertCostAsync(600.00m);
    }

    // ... and a parent with no stage row at all still counts: the rule reads the parent from
    // tProjects and its latest live revision, not from tProjectStages.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ParentWithNoStageRowStillCounts()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        await ExecuteAsync("DELETE dbo.tProjectStages WHERE ProjectFK = N'PROJECT-LS-PARENT';");

        await AssertCostAsync(600.00m);
    }

    // Only the 'LS' component is the appropriation. Any other component on the parent -- with a
    // per-year row at the program year, so the per-year rule would have counted it -- adds nothing.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_NonLsComponentOnAParentDoesNotCount()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (1032, 130, N'CW1', 999, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES (1032, 999, 2026, 0);
            """);

        await AssertCostAsync(600.00m);
    }

    // The parent's figure comes from its latest LIVE revision: an older live revision (400) is
    // superseded, and a newer soft-deleted one (9000) is ignored.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ParentUsesItsLatestLiveRevision()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjectRevisions(Id, ProjectFK, IsDeleted) VALUES (129, N'PROJECT-LS-PARENT', 0), (132, N'PROJECT-LS-PARENT', 1);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES
                (1029, 129, N'LS', 400, 0),
                (1033, 132, N'LS', 9000, 0);
            """);

        await AssertCostAsync(600.00m);
    }

    // A parent of another program is not this program's money.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LumpSum_ParentOfAnotherProgramDoesNotCount()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        await ExecuteAsync("UPDATE dbo.tProjects SET ProgramFK = N'PROGRAM-2' WHERE ProjectPK = N'PROJECT-LS-PARENT';");

        await AssertCostAsync(100.00m);
    }

    // The program list shows one Cost per stage. The ordinary part differs by stage; the Lump Sum
    // part is the same on every row, because parents count at any stage.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Function_EveryStageRowCarriesTheSameLumpSumFigure()
    {
        await SeedProgramAsync();
        await SeedLumpSumFamilyAsync();
        // An earlier program revision at stage 1, where PROJECT-OLD (one year, 50) sits.
        await ExecuteAsync("""
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (0, N'PROGRAM-1', 0);
            INSERT dbo.tProgramStages(ProgramFK, RevisionId, StageId, StageName) VALUES (N'PROGRAM-1', 0, 1, N'BP');
            """);

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        Assert.Equal(550.00m, await ReadListCostAsync(connection, stageId: 1));   // 50 + 500
        Assert.Equal(600.00m, await ReadListCostAsync(connection, stageId: 2));   // 100 + 500
    }

    // ---------------------------------------------------------------------------------------
    // GAA-R: an approved Formal Revision replaces the base figures (rule of 2026-09-20)
    // ---------------------------------------------------------------------------------------

    // The revision's per-year rows replace the base ones outright, and the program-year rule
    // applies to them unchanged: 400 at 2026 counts, 50 at 2027 does not, and the deleted 5000
    // row is out. Base alone would have been 100.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_EffectiveRevisionReplacesTheBaseFigures()
    {
        await SeedGaaRProgramAsync();

        await AssertCostAsync(400.00m, stageId: GaaRStageId);
    }

    // The revision branch has its own one-year rule: a single revision row off the program year
    // still counts in full.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_RevisionWithOneYearCountsItWhateverTheYear()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("""
            UPDATE dbo.tRevisionProjectComponentCostPerYear SET IsDeleted = 1 WHERE RevisionComponentCostFK = 3001;
            INSERT dbo.tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, Amount, [Year], IsDeleted) VALUES (3001, 70, 2030, 0);
            """);

        await AssertCostAsync(70.00m, stageId: GaaRStageId);
    }

    // RO approval alone is not approval. CO is still For Approval (0), so the base counts.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_RevisionApprovedByROOnlyIsNotRead()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("UPDATE dbo.tRevisionApprovals SET Status = 0 WHERE RevisionDetailFK = 1 AND Level = N'CO';");

        await AssertCostAsync(100.00m, stageId: GaaRStageId);
    }

    // An unpublished project never takes its revision, as in fProjectFundingProfile.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_UnpublishedProjectReadsTheBase()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("UPDATE dbo.tProjects SET IsPublished = 0 WHERE ProjectPK = N'PROJECT-REV';");

        await AssertCostAsync(100.00m, stageId: GaaRStageId);
    }

    // A project that already has a row at a later stage (TF) is past its revision, as in
    // fProjectFundingProfile: the base counts at GAA-R.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_ProjectWithALaterStageRowReadsTheBase()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-REV', N'PROGRAM-1', 202, 12);");

        await AssertCostAsync(100.00m, stageId: GaaRStageId);
    }

    // Of several approved revisions the latest by CreatedDate (then Id) wins, and a still newer
    // one that is not approved is ignored.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_LatestApprovedRevisionWins()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tRevisionDetails(Id, ProjectRevisionFK, CreatedDate) VALUES
                (2, 201, '2026-09-05'),
                (3, 201, '2026-09-09');
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES
                (2, N'RO', 1), (2, N'CO', 1),
                (3, N'RO', 1), (3, N'CO', 0);
            INSERT dbo.tRevisionProjectComponentCost(Id, RevisionDetailFK, ComponentId, Total, IsDeleted) VALUES
                (3002, 2, N'CW1', 250, 0),
                (3003, 3, N'CW1', 9999, 0);
            INSERT dbo.tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (3002, 250, 2026, 0), (3002, 1, 2027, 0),
                (3003, 9999, 2026, 0), (3003, 1, 2027, 0);
            """);

        await AssertCostAsync(250.00m, stageId: GaaRStageId);
    }

    // The overlay belongs to GAA-R alone. The same approved, published revision on a project at
    // any other stage (here the baseline program at stage 2) leaves the base figure in place.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Stage_RevisionOutsideGaaRIsNeverRead()
    {
        await SeedProgramAsync();
        await ExecuteAsync("""
            UPDATE dbo.tProjects SET IsPublished = 1 WHERE ProjectPK = N'PROJECT-MULTI';
            INSERT dbo.tRevisionDetails(Id, ProjectRevisionFK, CreatedDate) VALUES (1, 101, '2026-09-01');
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES (1, N'RO', 1), (1, N'CO', 1);
            INSERT dbo.tRevisionProjectComponentCost(Id, RevisionDetailFK, ComponentId, Total, IsDeleted) VALUES (3001, 1, N'CW1', 400, 0);
            INSERT dbo.tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, Amount, [Year], IsDeleted) VALUES (3001, 400, 2026, 0), (3001, 50, 2027, 0);
            """);

        await AssertCostAsync(100.00m);
    }

    // An itemized child is an ordinary project to the Revision module, so it can carry an approved
    // revision. It still never counts (RISK-009): the overlay does not bring it back.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaR_ItemizedChildWithAnApprovedRevisionStillNeverCounts()
    {
        await SeedGaaRProgramAsync();
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId, IsPublished) VALUES (N'PROJECT-REV-CHILD', N'PROGRAM-1', N'LS', N'P-PARENT-ID', 1);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-REV-CHILD', N'PROGRAM-1', 210, 7);
            INSERT dbo.tRevisionDetails(Id, ProjectRevisionFK, CreatedDate) VALUES (10, 210, '2026-09-01');
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES (10, N'RO', 1), (10, N'CO', 1);
            INSERT dbo.tRevisionProjectComponentCost(Id, RevisionDetailFK, ComponentId, Total, IsDeleted) VALUES (3010, 10, N'LS', 300, 0);
            INSERT dbo.tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, Amount, [Year], IsDeleted) VALUES (3010, 300, 2026, 0);
            """);

        await AssertCostAsync(400.00m, stageId: GaaRStageId);
    }

    // ---------------------------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------------------------

    /*  The baseline program: year 2026, current stage 2 (HGAB).

        PROJECT-MULTI   several years -- 100 at 2026, 900 at 2027 -- so 100 counts.
        PROJECT-OLD     sits at stage 1, a prior stage, so nothing counts at stage 2.  */
    private async Task SeedProgramAsync()
    {
        await ExecuteAsync("""
            INSERT dbo.tPrograms(ProgramPK, StartYear, IsDeleted) VALUES (N'PROGRAM-1', 2026, 0);
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (1, N'PROGRAM-1', 0);
            INSERT dbo.tProgramStages(ProgramFK, RevisionId, StageId, StageName) VALUES (N'PROGRAM-1', 1, 2, N'HGAB');
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES
                (N'PROJECT-MULTI', N'PROGRAM-1', N'LZ', NULL),
                (N'PROJECT-OLD',   N'PROGRAM-1', N'LZ', NULL);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES
                (N'PROJECT-MULTI', N'PROGRAM-1', 101, 2),
                (N'PROJECT-OLD',   N'PROGRAM-1', 103, 1);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES
                (1001, 101, N'CW1', 1000, 0),
                (1003, 103, N'CW1', 50, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1001, 100, 2026, 0),
                (1001, 900, 2027, 0),
                (1003, 50, 2026, 0);
            """);
    }

    /*  A Lump Sum parent with one itemized child, both at the program's current stage.

        The parent's appropriation is 500 (its LS component Total) and its per-year row holds 200,
        the balance left after the child drew 300. The two figures are seeded different on
        purpose, so a rule reading the wrong one cannot accidentally agree.

        The child carries ProjectType 'LS' and an 'LS' component too -- that is real, and is why
        ParentProjectId, not the type, is what separates them.  */
    private async Task SeedLumpSumFamilyAsync()
    {
        await ExecuteAsync("""
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId) VALUES
                (N'PROJECT-LS-PARENT', N'PROGRAM-1', N'LS', NULL),
                (N'PROJECT-LS-CHILD',  N'PROGRAM-1', N'LS', N'P-PARENT-ID');
            INSERT dbo.tProjectRevisions(Id, ProjectFK, IsDeleted) VALUES
                (130, N'PROJECT-LS-PARENT', 0),
                (131, N'PROJECT-LS-CHILD',  0);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES
                (N'PROJECT-LS-PARENT', N'PROGRAM-1', 130, 2),
                (N'PROJECT-LS-CHILD',  N'PROGRAM-1', 131, 2);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES
                (1030, 130, N'LS', 500, 0),
                (1031, 131, N'LS', 300, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (1030, 200, 2026, 0),
                (1031, 300, 2026, 0);
            """);
    }

    /*  A program at GAA-R (stage 7), year 2026, with one published project carrying an effective
        approved Formal Revision.

        PROJECT-REV   base: 100 at 2026, 900 at 2027 -- 100 would count.
                      revision 1 (RO and CO approved): 400 at 2026, 50 at 2027, and a deleted
                      5000 at 2026 -- 400 counts.  */
    private async Task SeedGaaRProgramAsync()
    {
        await ExecuteAsync("""
            INSERT dbo.tPrograms(ProgramPK, StartYear, IsDeleted) VALUES (N'PROGRAM-1', 2026, 0);
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (1, N'PROGRAM-1', 0);
            INSERT dbo.tProgramStages(ProgramFK, RevisionId, StageId, StageName) VALUES (N'PROGRAM-1', 1, 7, N'GAA-R');
            INSERT dbo.tProjects(ProjectPK, ProgramFK, ProjectType, ParentProjectId, IsPublished) VALUES (N'PROJECT-REV', N'PROGRAM-1', N'LZ', NULL, 1);
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES (N'PROJECT-REV', N'PROGRAM-1', 201, 7);
            INSERT dbo.tProjectComponentCost(Id, ProjectRevisionFK, ComponentId, Total, IsDeleted) VALUES (2001, 201, N'CW1', 1000, 0);
            INSERT dbo.tProjectComponentCostPerYear(ComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (2001, 100, 2026, 0),
                (2001, 900, 2027, 0);
            INSERT dbo.tRevisionDetails(Id, ProjectRevisionFK, CreatedDate) VALUES (1, 201, '2026-09-01');
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES (1, N'RO', 1), (1, N'CO', 1);
            INSERT dbo.tRevisionProjectComponentCost(Id, RevisionDetailFK, ComponentId, Total, IsDeleted) VALUES (3001, 1, N'CW1', 450, 0);
            INSERT dbo.tRevisionProjectComponentCostPerYear(RevisionComponentCostFK, Amount, [Year], IsDeleted) VALUES
                (3001, 400, 2026, 0),
                (3001, 50, 2027, 0),
                (3001, 5000, 2026, 1);
            """);
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    private const int GaaRStageId = 7;

    /// <summary>
    /// Runs the procedure for PROGRAM-1 and asserts that BOTH paths report
    /// <paramref name="expected"/>: the stored tProgramRevisions.Cost, and fProgramStages' Cost
    /// at the program's current stage, <paramref name="stageId"/>.
    /// </summary>
    private async Task AssertCostAsync(decimal expected, int stageId = 2)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        await ExecuteProcedureAsync(connection, null, "PROGRAM-1");

        Assert.Equal(expected, await ReadStoredCostAsync(connection, null));
        Assert.Equal(expected, await ReadListCostAsync(connection, stageId));
    }

    private async Task ExecuteAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, sql);
    }

    private static async Task ExecuteProcedureAsync(SqlConnection connection, SqlTransaction? transaction, string programPk)
    {
        await using var command = new SqlCommand("dbo.pRecomputeProgramCost", connection, transaction) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@ProgramPK", SqlDbType.NVarChar, 200) { Value = programPk });
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<decimal> ReadStoredCostAsync(SqlConnection connection, SqlTransaction? transaction)
    {
        await using var command = new SqlCommand("SELECT Cost FROM dbo.tProgramRevisions WHERE Id = 1", connection, transaction);
        return Convert.ToDecimal(await command.ExecuteScalarAsync());
    }

    private static async Task<decimal> ReadListCostAsync(SqlConnection connection, int stageId)
    {
        await using var command = new SqlCommand("SELECT Cost FROM dbo.fProgramStages(N'PROGRAM-1') WHERE StageId = @StageId", connection);
        command.Parameters.Add(new SqlParameter("@StageId", SqlDbType.Int) { Value = stageId });
        object? value = await command.ExecuteScalarAsync();
        Assert.NotNull(value);
        return Convert.ToDecimal(value);
    }

    private async Task<int> ReadProjectCountAsync(int stageId)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("SELECT ProjectCount FROM dbo.fProgramStages(N'PROGRAM-1') WHERE StageId = @StageId", connection);
        command.Parameters.Add(new SqlParameter("@StageId", SqlDbType.Int) { Value = stageId });
        object? value = await command.ExecuteScalarAsync();
        Assert.NotNull(value);
        return Convert.ToInt32(value);
    }

    private static async Task ExecuteNonQueryAsync(SqlConnection connection, string sql, SqlTransaction? transaction = null)
    {
        await using var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, sql);
    }

    // ---------------------------------------------------------------------------------------
    // The objects under test, read from the checked-in source
    // ---------------------------------------------------------------------------------------

    private const string SourceRelativePath = "Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql";

    private static readonly Lazy<(string Function, string Procedure)> Section11 = new(() =>
    {
        string[] lines = File.ReadAllLines(FindRepositoryFile(SourceRelativePath));
        return (ExtractBatch(lines, "CREATE OR ALTER FUNCTION [dbo].[fProgramStages]"),
                ExtractBatch(lines, "CREATE OR ALTER PROCEDURE [dbo].[pRecomputeProgramCost]"));
    });

    /// <summary>The batch that starts at the line <paramref name="header"/> and ends before its GO.</summary>
    private static string ExtractBatch(string[] lines, string header)
    {
        int[] starts = Enumerable.Range(0, lines.Length).Where(i => lines[i].TrimEnd() == header).ToArray();
        if (starts.Length != 1)
            throw new InvalidOperationException($"Expected exactly one '{header}' in {SourceRelativePath}, found {starts.Length}.");

        int end = Array.FindIndex(lines, starts[0], line => line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase));
        if (end < 0)
            throw new InvalidOperationException($"No GO ends '{header}' in {SourceRelativePath}.");

        return string.Join("\n", lines[starts[0]..end]);
    }

    private static string FindRepositoryFile(string relativePath)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory != null; directory = directory.Parent)
        {
            string candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate))
                return candidate;
        }
        throw new FileNotFoundException($"Could not find {relativePath} above {AppContext.BaseDirectory}.");
    }

    /*  Minimal stand-ins for the tables the two objects read. Only the columns they touch are
        here: this is a behavioural harness for one rule, not a copy of the schema.

        tProgramRevisions.Cost is decimal(18,5), the live type. StartYear is nullable here, unlike
        live, only so the NULL guard can be exercised.

        tOptionProgramStage carries the live Id/NameId/Name/StageHierarchy of the stages the tests
        use (Id = NameId on every live row). tRevisionApprovals keeps the live unique key on
        (RevisionDetailFK, Level): it is what makes two EXISTS checks equal to
        fRevisionApprovalStatus.  */
    private const string SchemaSql = """
        CREATE TABLE dbo.tPrograms(ProgramPK nvarchar(200) NOT NULL PRIMARY KEY, StartYear int NULL, IsDeleted bit NOT NULL,
                                   [Type] nvarchar(50) NULL, UserGroup nvarchar(1000) NULL, DataSecurityGroup nvarchar(1000) NULL);
        CREATE TABLE dbo.tProgramRevisions(Id int NOT NULL PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, ProgramId nvarchar(255) NULL, Cost decimal(18,5) NULL);
        CREATE TABLE dbo.tProgramStages(Id int IDENTITY PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, RevisionId int NOT NULL, StageId int NOT NULL, StageName nvarchar(100) NULL);
        CREATE TABLE dbo.tOptionProgramType(NameId nvarchar(50) NOT NULL, [Name] nvarchar(50) NULL);
        CREATE TABLE dbo.tOptionProgramStage(Id int NOT NULL PRIMARY KEY, NameId int NOT NULL, [Name] nvarchar(50) NOT NULL, DisplayName nvarchar(100) NULL,
                                             StageHierarchy decimal(7,5) NOT NULL);
        INSERT dbo.tOptionProgramStage(Id, NameId, [Name], DisplayName, StageHierarchy) VALUES
            (1, 1, N'BP', NULL, 1.0), (2, 2, N'NEP', NULL, 1.1), (6, 6, N'GAA', NULL, 1.5),
            (7, 7, N'GAA-R', N'GAA-Revisions', 1.6), (12, 12, N'TF', NULL, 2.1);
        -- ParentProjectId is what separates an itemized child from its Lump Sum parent; both carry ProjectType 'LS'.
        CREATE TABLE dbo.tProjects(ProjectPK nvarchar(200) NOT NULL PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, ProjectType nvarchar(20) NULL, ParentProjectId nvarchar(100) NULL,
                                   IsPublished bit NOT NULL DEFAULT 0);
        CREATE TABLE dbo.tProjectRevisions(Id int NOT NULL PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, IsDeleted bit NOT NULL);
        CREATE TABLE dbo.tProjectStages(Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProgramFK nvarchar(200) NOT NULL, RevisionId int NOT NULL, StageId int NOT NULL);
        CREATE TABLE dbo.tProjectComponentCost(Id int NOT NULL PRIMARY KEY, ProjectRevisionFK int NOT NULL, ComponentId nvarchar(10) NULL, Total decimal(18,5) NOT NULL, IsDeleted bit NOT NULL);
        CREATE TABLE dbo.tProjectComponentCostPerYear(Id int IDENTITY PRIMARY KEY, ComponentCostFK int NOT NULL, Amount decimal(18,5) NOT NULL, [Year] int NOT NULL, IsDeleted bit NOT NULL);
        CREATE TABLE dbo.tRevisionDetails(Id int NOT NULL PRIMARY KEY, ProjectRevisionFK int NOT NULL, CreatedDate datetime NOT NULL);
        CREATE TABLE dbo.tRevisionApprovals(Id int IDENTITY PRIMARY KEY, RevisionDetailFK int NOT NULL, Level nvarchar(10) NOT NULL, Status int NOT NULL,
                                            CONSTRAINT UQ_tRevisionApprovals_Level UNIQUE (RevisionDetailFK, Level));
        CREATE TABLE dbo.tRevisionProjectComponentCost(Id int NOT NULL PRIMARY KEY, RevisionDetailFK int NOT NULL, ComponentId nvarchar(10) NOT NULL, Total decimal(18,5) NOT NULL, IsDeleted bit NOT NULL);
        CREATE TABLE dbo.tRevisionProjectComponentCostPerYear(Id int IDENTITY PRIMARY KEY, RevisionComponentCostFK int NOT NULL, Amount decimal(18,5) NOT NULL, [Year] int NOT NULL, IsDeleted bit NOT NULL);
        """;
}
