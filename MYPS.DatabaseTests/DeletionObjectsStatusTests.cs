using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Helpers.DeletionObjectsStatus decides whether the delete endpoints answer 503: it must report
    "not ready" when the deletion objects are missing, are an OLDER version than this build reads
    (the 2026-10-14 functions lack Kind/Reason/ProgramApproved; the old procedures lack the
    DELETE_REFUSED: token), or the compatibility level is below 130 — and it must recover, without
    a restart, once `Main.exe --apply-sql-objects --yes` has run. Each test runs against its own
    throwaway MYPS_Test_<guid> database (LocalDbSafety). */
public sealed class DeletionObjectsStatusTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        try
        {
            await ExecuteAsync(SchemaSql);
        }
        catch
        {
            await DisposeAsync(); // xUnit skips DisposeAsync when InitializeAsync throws
            throw;
        }
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    public async Task Probe_WithNoObjects_NamesEveryMissingOne()
    {
        string? problem = await DeletionObjectsStatus.ProbeAsync(ConnectionString);
        Assert.NotNull(problem);
        foreach (string name in new[] { "fProjectDeletionTier", "fProgramDeletionEligibility", "pExecuteProjectDeletion", "pExecuteProgramDeletion" })
            Assert.Contains($"dbo.{name} is missing", problem);
    }

    [Fact]
    public async Task Probe_AfterApplyingTheCheckedInObjects_IsReady()
    {
        await ApplyRealObjectsAsync();
        Assert.Null(await DeletionObjectsStatus.ProbeAsync(ConnectionString));
    }

    [Fact]
    public async Task Probe_AnOlderFunction_IsNotReady()
    {
        await ApplyRealObjectsAsync();
        // The 2026-10-14 shape: no Ref/MatchedBy/Kind/ProgramApproved/Reason.
        await ExecuteAsync("""
            CREATE OR ALTER FUNCTION dbo.fProjectDeletionTier (@ProjectFK NVARCHAR(200), @ProgramFK NVARCHAR(200))
            RETURNS TABLE AS RETURN (SELECT CAST(NULL AS NVARCHAR(200)) AS ProjectFK, CAST(NULL AS NVARCHAR(200)) AS ProgramFK,
                CAST(0 AS BIT) AS IsPublished, CAST(0 AS BIT) AS IsRevised, 0 AS StageCount, 0 AS RevisionCount, N'Hard' AS Tier);
            """);

        string? problem = await DeletionObjectsStatus.ProbeAsync(ConnectionString);
        Assert.NotNull(problem);
        Assert.Contains("dbo.fProjectDeletionTier is an older version", problem);
        Assert.Contains("Kind", problem);
    }

    [Fact]
    public async Task Probe_AnOlderProcedure_IsNotReady()
    {
        await ApplyRealObjectsAsync();
        await ExecuteAsync("CREATE OR ALTER PROCEDURE dbo.pExecuteProgramDeletion @ProgramFK NVARCHAR(200), @UserId NVARCHAR(100), @CurrentDate DATETIME2 AS BEGIN RAISERROR(N'pExecuteProgramDeletion: old text', 16, 1); END");
        Assert.Equal("dbo.pExecuteProgramDeletion is an older version", await DeletionObjectsStatus.ProbeAsync(ConnectionString));
    }

    [Fact]
    public async Task Probe_CompatibilityBelow130_IsNotReady()
    {
        await ApplyRealObjectsAsync();
        await ExecuteMasterAsync($"ALTER DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}] SET COMPATIBILITY_LEVEL = 120");
        Assert.Equal("compatibility level 120 is below 130", await DeletionObjectsStatus.ProbeAsync(ConnectionString));
    }

    [Fact]
    public async Task EnsureReady_RecoversWithoutARestart_OnceTheObjectsAreApplied()
    {
        var status = new DeletionObjectsStatus(ConnectionString, recheckInterval: TimeSpan.Zero);
        Assert.False(await status.EnsureReadyAsync());
        Assert.Contains("is missing", status.Problem);

        await ApplyRealObjectsAsync();

        Assert.True(await status.EnsureReadyAsync());
        Assert.Null(status.Problem);
    }

    [Fact]
    public async Task EnsureReady_DoesNotHitTheDatabaseAgainWithinTheInterval()
    {
        var status = new DeletionObjectsStatus(ConnectionString, recheckInterval: TimeSpan.FromHours(1));
        Assert.False(await status.EnsureReadyAsync());

        await ApplyRealObjectsAsync();

        Assert.False(await status.EnsureReadyAsync()); // still the cached "not ready" until the interval passes
    }

    private async Task ApplyRealObjectsAsync()
    {
        string root = FindRepositoryDirectory("Main/Resources/Internal/SQLObjects");
        await new SqlObjectDeployer(new SqlExecutor(ConnectionString), ConnectionString).ApplyAsync(root, execute: true, TextWriter.Null);
    }

    /// <summary>Every column the deletion objects use; a procedure may defer a missing table, not a missing column.</summary>
    private const string SchemaSql = """
        CREATE TABLE dbo.tPrograms (ProgramPK NVARCHAR(200) PRIMARY KEY, StartYear INT);
        CREATE TABLE dbo.tProgramStages (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), StageId INT, StageName NVARCHAR(20), RevisionId INT);
        CREATE TABLE dbo.tOptionProgramStage (Id INT PRIMARY KEY, StageHierarchy INT);
        CREATE TABLE dbo.tProgramRevisions (Id INT IDENTITY PRIMARY KEY, ProgramFK NVARCHAR(200), Name NVARCHAR(200), Status INT);
        CREATE TABLE dbo.tProjects (ProjectPK NVARCHAR(200) PRIMARY KEY, ProgramFK NVARCHAR(200), IsPublished BIT, IsRevised BIT,
            ProjectType NVARCHAR(10), ParentProjectId NVARCHAR(200));
        CREATE TABLE dbo.tProjectStages (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200), ProgramFK NVARCHAR(200), StageId INT,
            StageName NVARCHAR(20), RevisionId INT);
        CREATE TABLE dbo.tProjectRevisions (Id INT IDENTITY PRIMARY KEY, ProjectFK NVARCHAR(200), ProgramFK NVARCHAR(200), ProjectId NVARCHAR(200));
        """;

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
