using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Helpers;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.2026-10-31.sql and Phase 2's
    Migration.MultiYear.Linking.2026-10-31.sql, run as written (read from the file, split on GO)
    against a disposable MYPS_Test_ database -- each twice, since they must be safe to re-run on
    every server. Then the rules the requirements put on the tables themselves:
    one portfolio per kind/owner/term (MY-PFL-04), one next term per term (MY-PFL-06), one current
    amount per component and year (MY-PRJ-25), the owner/kind pairing and the JSON columns.
    Plan: documents/plans/multi-year-phase-1-portfolio-module.md. */
public sealed class MultiYearSchemaTests : IAsyncLifetime
{
    private const int UniqueConstraintViolation = 2627;
    private const int UniqueIndexViolation = 2601;
    private const int CheckOrForeignKeyViolation = 547;
    internal const string SchemaScript = "Migration.MultiYear.Schema.2026-10-31.sql";
    internal const string LinkingScript = "Migration.MultiYear.Linking.2026-10-31.sql";

    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await RunScriptAsync(connection, SchemaScript);
        await RunScriptAsync(connection, SchemaScript);
        await RunScriptAsync(connection, LinkingScript);
        await RunScriptAsync(connection, LinkingScript);
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Script_RunsTwice_AndSeedsTheHorizonTypesOnce()
    {
        await using var connection = await OpenAsync();
        Assert.Equal(3, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tOptionMultiYearType;"));
        Assert.Equal(6, await ScalarAsync(connection, "SELECT Years FROM dbo.tOptionMultiYearType WHERE Name = N'Medium term';"));
        Assert.Equal(1, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tOptionMultiYearType WHERE Name = N'Long term' AND Years IS NULL;"));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Portfolio_IsOnePerKindOwnerAndTerm_AndItsTermIsSixYears()
    {
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (1, N'R06', 2023, N'test');");
        Assert.Equal(2028, await ScalarAsync(connection, "SELECT TermEndYear FROM dbo.tMultiYearPortfolio WHERE OwnerParticipantId = N'R06';"));

        await AssertRefusedAsync(connection, UniqueConstraintViolation,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (1, N'R06', 2023, N'test');");

        // Same owner and term in another kind is a different portfolio; one PIP per term.
        await ExecuteAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (2, N'R06', 2023, N'test');");
        await ExecuteAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (3, NULL, 2023, N'test');");
        await AssertRefusedAsync(connection, UniqueConstraintViolation,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (3, NULL, 2023, N'test');");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Portfolio_OwnerMatchesItsKind()
    {
        await using var connection = await OpenAsync();
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (3, N'R06', 2023, N'test');");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (1, NULL, 2023, N'test');");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (4, N'R06', 2023, N'test');");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Portfolio_HasAtMostOneNextTerm()
    {
        await using var connection = await OpenAsync();
        int first = await ScalarAsync(connection,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) OUTPUT INSERTED.Id VALUES (1, N'R06', 2017, N'test');");
        await ExecuteAsync(connection,
            $"INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, PreviousPortfolioFK, CreatedBy) VALUES (1, N'R06', 2023, {first}, N'test');");
        await AssertRefusedAsync(connection, UniqueIndexViolation,
            $"INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, PreviousPortfolioFK, CreatedBy) VALUES (1, N'R07', 2023, {first}, N'test');");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task CostStream_HasOneCurrentAmountPerComponentAndYear_SupersededRowsDoNotCount()
    {
        await using var connection = await OpenAsync();
        int component = await SeedComponentAsync(connection);
        await ExecuteAsync(connection, $"INSERT dbo.tMultiYearComponentCostPerYear (MultiYearComponentFK, [Year], Amount, CreatedBy) VALUES ({component}, 2026, 100, N'test');");

        await AssertRefusedAsync(connection, UniqueIndexViolation,
            $"INSERT dbo.tMultiYearComponentCostPerYear (MultiYearComponentFK, [Year], Amount, CreatedBy) VALUES ({component}, 2026, 50, N'test');");

        // A superseded amount is history, kept beside the current one (MY-PRJ-24, -25).
        await ExecuteAsync(connection, $"INSERT dbo.tMultiYearComponentCostPerYear (MultiYearComponentFK, [Year], Amount, Status, CreatedBy) VALUES ({component}, 2026, 80, 3, N'test');");
        Assert.Equal(2, await ScalarAsync(connection, $"SELECT COUNT(*) FROM dbo.tMultiYearComponentCostPerYear WHERE MultiYearComponentFK = {component} AND [Year] = 2026;"));

        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            $"INSERT dbo.tMultiYearComponentCostPerYear (MultiYearComponentFK, [Year], Amount, CreatedBy) VALUES ({component}, 2027, -1, N'test');");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Member_IsOncePerPortfolio_AndItsMultiValuedFieldsAreJson()
    {
        await using var connection = await OpenAsync();
        int project = await SeedProjectAsync(connection);
        int portfolio = await ScalarAsync(connection,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) OUTPUT INSERTED.Id VALUES (1, N'R06', 2023, N'test');");
        string insert = $"INSERT dbo.tMultiYearPortfolioMember (PortfolioFK, MultiYearProjectFK, IsOwner, StartYear, CreatedBy) VALUES ({portfolio}, {project}, 1, 2026, N'test');";
        await ExecuteAsync(connection, insert);
        Assert.Equal("[]", await StringAsync(connection, "SELECT ReadinessLevelIds FROM dbo.tMultiYearPortfolioMember;"));

        await AssertRefusedAsync(connection, UniqueConstraintViolation, insert);
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "UPDATE dbo.tMultiYearPortfolioMember SET ReadinessLevelIds = N'1,2';");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "UPDATE dbo.tMultiYearPortfolioMember SET Status = 6;");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Linking_OneProposalPerAnnualProject_AndOneTotalLinePerSnapshotProjectAndYear()
    {
        await using var connection = await OpenAsync();
        int component = await SeedComponentAsync(connection);
        int project = await ScalarAsync(connection, $"SELECT MultiYearProjectFK FROM dbo.tMultiYearComponent WHERE Id = {component};");
        int portfolio = await ScalarAsync(connection,
            "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) OUTPUT INSERTED.Id VALUES (1, N'R06', 2023, N'test');");
        int member = await ScalarAsync(connection,
            $"INSERT dbo.tMultiYearPortfolioMember (PortfolioFK, MultiYearProjectFK, IsOwner, StartYear, CreatedBy) OUTPUT INSERTED.Id VALUES ({portfolio}, {project}, 1, 2026, N'test');");

        string proposal = $"INSERT dbo.tMultiYearProposal (MultiYearProjectFK, MemberFK, ProgramFK, ProjectFK, ProjectId, BudgetYear, Amount, ProposedBy) VALUES ({project}, {member}, N'P1', N'X1', N'BP01000001VS', 2026, 10, N'test');";
        await ExecuteAsync(connection, proposal);
        await AssertRefusedAsync(connection, UniqueConstraintViolation, proposal);
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            $"INSERT dbo.tMultiYearProposal (MultiYearProjectFK, MemberFK, ProgramFK, ProjectFK, ProjectId, BudgetYear, Amount, ProposedBy) VALUES ({project}, {member}, N'P1', N'X2', N'BP01000002VS', 2026, 0, N'test');");

        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "INSERT dbo.tMultiYearUpdateRun ([Year], TriggerKind, Summary, RunBy) VALUES (2026, 1, N'not json', N'test');");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation,
            "INSERT dbo.tMultiYearUpdateRun ([Year], TriggerKind, RunBy) VALUES (2026, 6, N'test');");

        int snapshot = await ScalarAsync(connection,
            $"INSERT dbo.tMultiYearTotalsSnapshot (PortfolioFK, Reason, TakenBy) OUTPUT INSERTED.Id VALUES ({portfolio}, 4, N'test');");
        await ExecuteAsync(connection, $"INSERT dbo.tMultiYearTotalsLine (SnapshotFK, MultiYearProjectFK, [Year], Planned) VALUES ({snapshot}, {project}, 2026, 10);");
        await ExecuteAsync(connection, $"INSERT dbo.tMultiYearTotalsLine (SnapshotFK, MultiYearProjectFK, [Year], Planned) VALUES ({snapshot}, NULL, 2026, 10);");
        await AssertRefusedAsync(connection, UniqueConstraintViolation,
            $"INSERT dbo.tMultiYearTotalsLine (SnapshotFK, MultiYearProjectFK, [Year], Planned) VALUES ({snapshot}, NULL, 2026, 20);");
    }

    // EF binds by column name: a model property with no matching column fails every query on the
    // table. Writes and reads one row of every Multi-Year entity through MYPSDbContext.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task EfModel_MatchesTheScriptsTables()
    {
        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);
        var now = DateTime.Now;

        var basis = new OptionBasisForImplementation { Name = "Basis", IsActive = true, CreatedBy = "test", CreatedDate = now };
        var neda = new OptionNedaProjectStatus { Name = "ICC-CC Approved", ValidToYear = 2030, IsActive = true, CreatedBy = "test", CreatedDate = now };
        var readiness = new OptionReadinessLevel { Name = "Feasibility Study", IsActive = true, CreatedBy = "test", CreatedDate = now };
        var outcome = new OptionRdpOutcome { Name = "Outcome", IsActive = true, CreatedBy = "test", CreatedDate = now };
        db.AddRange(basis, neda, readiness, outcome);
        await db.SaveChangesAsync();
        db.Add(new OptionRdpOutput { OutcomeFK = outcome.Id, Name = "Output", IsActive = true, CreatedBy = "test", CreatedDate = now });

        var portfolio = new MultiYearPortfolio { Kind = EnumPortfolioKind.UDIP, OwnerParticipantId = "OI2690", TermStartYear = 2023, Status = EnumPortfolioStatus.Open, CreatedBy = "test", CreatedDate = now };
        var project = new MultiYearProject
        {
            ProjectId = "MY00700001VS", Description = "Flood wall", Category = 1, IslandCode = "VS",
            HorizonTypeFK = (await db.tOptionMultiYearType.SingleAsync(t => t.Name == "Medium term")).Id,
            StartYear = 2026, OriginalCost = 100, CurrentCost = 100, CreatedBy = "test", CreatedDate = now,
        };
        db.AddRange(portfolio, project);
        await db.SaveChangesAsync();

        var component = new MultiYearComponent { MultiYearProjectFK = project.Id, ComponentId = "CW1", ComponentType = "Civil Works", InfraTypeFK = "FC", WorkTypeFK = 3, PhysicalTarget = 1.5, TargetUnit = "km", CreatedBy = "test", CreatedDate = now };
        var member = new MultiYearPortfolioMember
        {
            PortfolioFK = portfolio.Id, MultiYearProjectFK = project.Id, IsOwner = true, Status = EnumMembershipStatus.New, StartYear = 2026, Cost = 100,
            BasisForImplementationFK = basis.Id, NedaProjectStatusFK = neda.Id, ReadinessLevelIds = $"[{readiness.Id}]", McaScore = 71.5m, CreatedBy = "test", CreatedDate = now,
        };
        db.AddRange(component, member, new MultiYearPortfolioCeiling { PortfolioFK = portfolio.Id, Year = 2026, Amount = 2500, CreatedBy = "test", CreatedDate = now });
        await db.SaveChangesAsync();
        db.AddRange(
            new MultiYearComponentCostPerYear { MultiYearComponentFK = component.Id, Year = 2026, Amount = 60, Status = EnumCostStreamStatus.Planned, CreatedBy = "test", CreatedDate = now },
            new MultiYearMemberStatusLog { MemberFK = member.Id, ToStatus = EnumMembershipStatus.New, ChangedBy = "test", ChangedDate = now });
        await db.SaveChangesAsync();

        // Phase 2: a proposal, a run that moved the membership, and saved totals.
        var proposal = new MultiYearProposal { MultiYearProjectFK = project.Id, MemberFK = member.Id, ProgramFK = "HOST_01012095_000000", ProjectFK = "HOST_01012095_000001", ProjectId = "BP07900001VS", BudgetYear = 2026, Amount = 60, ProposedBy = "test", ProposedDate = now };
        var run = new MultiYearUpdateRun { Year = 2026, TriggerKind = EnumUpdateTrigger.GaaApproved, ProgramFK = "HOST_01012095_000002", Summary = "{\"Moved\":1}", RunBy = "test", RunDate = now };
        db.AddRange(proposal, run);
        await db.SaveChangesAsync();
        var snapshot = new MultiYearTotalsSnapshot { PortfolioFK = portfolio.Id, Reason = EnumTotalsReason.GaaUpdate, RunFK = run.Id, TakenBy = "test", TakenDate = now };
        db.Add(snapshot);
        db.Add(new MultiYearMemberStatusLog { MemberFK = member.Id, FromStatus = EnumMembershipStatus.New, ToStatus = EnumMembershipStatus.Potential, FromStartYear = 2026, ToStartYear = 2026, FromCost = 100, ToCost = 100, RunFK = run.Id, ProposalFK = proposal.Id, ChangedBy = "test", ChangedDate = now });
        project.OriginProgramFK = "HOST_01012095_000002";
        await db.SaveChangesAsync();
        db.AddRange(
            new MultiYearTotalsLine { SnapshotFK = snapshot.Id, MultiYearProjectFK = project.Id, Year = 2026, Approved = 60 },
            new MultiYearTotalsLine { SnapshotFK = snapshot.Id, Year = 2026, Approved = 60, Ceiling = 2500 });
        await db.SaveChangesAsync();

        db.ChangeTracker.Clear();
        var saved = await db.tMultiYearPortfolio.AsNoTracking().SingleAsync();
        Assert.Equal(2028, saved.TermEndYear);
        Assert.Equal("OI2690", saved.OwnerKey);
        Assert.Equal(EnumMembershipStatus.New, (await db.tMultiYearPortfolioMember.AsNoTracking().SingleAsync()).Status);
        Assert.Equal(60m, (await db.tMultiYearComponentCostPerYear.AsNoTracking().SingleAsync()).Amount);
        Assert.Equal(2, await db.tMultiYearMemberStatusLog.AsNoTracking().CountAsync());
        Assert.Equal(proposal.Id, (await db.tMultiYearMemberStatusLog.AsNoTracking().SingleAsync(l => l.RunFK != null)).ProposalFK);
        Assert.Equal("BP07900001VS", (await db.tMultiYearProposal.AsNoTracking().SingleAsync()).ProjectId);
        Assert.Equal(EnumUpdateTrigger.GaaApproved, (await db.tMultiYearUpdateRun.AsNoTracking().SingleAsync()).TriggerKind);
        Assert.Equal(EnumTotalsReason.GaaUpdate, (await db.tMultiYearTotalsSnapshot.AsNoTracking().SingleAsync()).Reason);
        Assert.Equal(2500m, (await db.tMultiYearTotalsLine.AsNoTracking().SingleAsync(l => l.MultiYearProjectFK == null)).Ceiling);
        Assert.Equal("HOST_01012095_000002", (await db.tMultiYearProject.AsNoTracking().SingleAsync()).OriginProgramFK);
        Assert.Single(await db.tMultiYearPortfolioCeiling.AsNoTracking().ToListAsync());
        Assert.Single(await db.tOptionRdpOutput.AsNoTracking().ToListAsync());
        Assert.Equal(2030, (await db.tOptionNedaProjectStatus.AsNoTracking().SingleAsync()).ValidToYear);
        Assert.Equal(1.5, (await db.tMultiYearComponent.AsNoTracking().SingleAsync()).PhysicalTarget);
    }

    // -------------------------------------------------------------------------------------------

    private static async Task<int> SeedProjectAsync(SqlConnection connection) =>
        await ScalarAsync(connection, """
            INSERT dbo.tMultiYearProject (ProjectId, Description, Category, IslandCode, HorizonTypeFK, StartYear, OriginalCost, CurrentCost, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (N'MY01000001VS', N'Test road', 1, N'VS', (SELECT Id FROM dbo.tOptionMultiYearType WHERE Name = N'Medium term'), 2026, 100, 100, N'test');
            """);

    private static async Task<int> SeedComponentAsync(SqlConnection connection)
    {
        int project = await SeedProjectAsync(connection);
        return await ScalarAsync(connection,
            $"INSERT dbo.tMultiYearComponent (MultiYearProjectFK, ComponentId, ComponentType, CreatedBy) OUTPUT INSERTED.Id VALUES ({project}, N'CW1', N'Civil Works', N'test');");
    }

    private static async Task RunScriptAsync(SqlConnection connection, string fileName)
    {
        string path = Path.Combine(FindRepositoryDirectory("Main/Resources/MultiYear/SQL"), fileName);
        foreach (Helpers.SqlBatch batch in SqlBatchSplitter.Split(await File.ReadAllTextAsync(path)))
            for (int i = 0; i < batch.Repeat; i++)
                await ExecuteAsync(connection, batch.Text);
    }

    private static async Task AssertRefusedAsync(SqlConnection connection, int expectedNumber, string sql)
    {
        SqlException error = await Assert.ThrowsAsync<SqlException>(() => ExecuteAsync(connection, sql));
        Assert.Equal(expectedNumber, error.Number);
    }

    private async Task<SqlConnection> OpenAsync()
    {
        var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task ExecuteAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<string?> StringAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        return (string?)await command.ExecuteScalarAsync();
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await ExecuteAsync(connection, sql);
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
