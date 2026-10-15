using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Helpers.SqlObjectDeployer -- `Main --apply-sql-objects` -- applies the CREATE OR ALTER files under
    Main/Resources/Internal/SQLObjects through Dapper, GO-split, in one transaction. Every test runs
    against its own throwaway MYPS_Test_<guid> database (LocalDbSafety) and a fixture folder in %TEMP%,
    except RealFolder_*, which applies the checked-in folder itself onto the minimal set of tables its
    inline functions need to exist at CREATE time. */
public sealed class SqlObjectDeployerTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private readonly string _fixtureRoot = Path.Combine(Path.GetTempPath(), "MYPS_SqlObjects_" + Guid.NewGuid().ToString("N"));
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    private SqlObjectDeployer Deployer => new(new SqlExecutor(ConnectionString), ConnectionString);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        Directory.CreateDirectory(_fixtureRoot);
    }

    public async Task DisposeAsync()
    {
        if (Directory.Exists(_fixtureRoot)) Directory.Delete(_fixtureRoot, recursive: true);
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    private static readonly string[] FixtureObjects = { "fDeployOne", "vDeployOne", "pDeployOne" };

    private void WriteFixture(bool withBrokenProcedure = false)
    {
        Write("Functions/fDeployOne.sql", "/* a header that mentions\nGO\n*/\nSET QUOTED_IDENTIFIER ON;\nGO\nCREATE OR ALTER FUNCTION dbo.fDeployOne()\nRETURNS TABLE AS RETURN (SELECT 1 AS One);\nGO\n");
        Write("Views/vDeployOne.sql", "CREATE OR ALTER VIEW dbo.vDeployOne AS SELECT One FROM dbo.fDeployOne();\nGO\n");
        Write("Stored Procedures/pDeployOne.sql", "CREATE OR ALTER PROCEDURE dbo.pDeployOne AS\nBEGIN\n    SELECT 'GO' AS Word, One FROM dbo.vDeployOne;\nEND\nGO\n");
        Write("Tables/dbo_tNeverApplied.sql", "CREATE TABLE dbo.tNeverApplied (Id INT);\nGO\n");
        if (withBrokenProcedure)
            Write("Stored Procedures/zzBroken.sql", "CREATE OR ALTER PROCEDURE dbo.zzBroken AS\nBEGIN\n    SELEC 1;\nEND\nGO\n");
    }

    private void Write(string relative, string content)
    {
        string path = Path.Combine(_fixtureRoot, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
    }

    [Fact]
    public void Discover_OrdersFunctionsViewsProcedures_AndSkipsTables()
    {
        WriteFixture();
        Assert.Equal(
            new[] { "Functions/fDeployOne.sql", "Views/vDeployOne.sql", "Stored Procedures/pDeployOne.sql" },
            SqlObjectDeployer.Discover(_fixtureRoot));
    }

    [Fact]
    public void Discover_OrderFile_PutsListedFilesFirst()
    {
        WriteFixture();
        Write(SqlObjectDeployer.OrderFileName, "# dependencies first\nViews\\vDeployOne.sql\n");
        Assert.Equal("Views/vDeployOne.sql", SqlObjectDeployer.Discover(_fixtureRoot)[0]);
    }

    [Fact]
    public async Task DryRun_ExecutesNothing()
    {
        WriteFixture();
        var log = new StringWriter();
        await Deployer.ApplyAsync(_fixtureRoot, execute: false, log);

        Assert.Equal(0, await CountObjectsAsync(FixtureObjects));
        Assert.Contains("DRY RUN", log.ToString());
        Assert.Contains(_databaseName, log.ToString());
    }

    [Fact]
    public async Task Apply_CreatesEveryObject_AndIsRepeatable()
    {
        WriteFixture();
        await Deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null);
        Assert.Equal(3, await CountObjectsAsync(FixtureObjects));
        Assert.Equal(0, await CountObjectsAsync("tNeverApplied"));

        await Deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null);
        Assert.Equal(3, await CountObjectsAsync(FixtureObjects));
    }

    [Fact]
    public async Task Apply_FailingFile_RollsBackEveryEarlierObject()
    {
        WriteFixture(withBrokenProcedure: true);

        var ex = await Assert.ThrowsAsync<SqlScriptBatchException>(() => Deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null));
        Assert.Equal("Stored Procedures/zzBroken.sql", ex.SourceName);
        Assert.Equal(1, ex.BatchIndex);
        Assert.Equal(0, await CountObjectsAsync(FixtureObjects));
    }

    [Fact]
    public async Task Preflight_CompatibilityBelow130_RefusesEvenTheDryRun_AndAppliesNothing()
    {
        WriteFixture();
        await ExecuteMasterAsync($"ALTER DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}] SET COMPATIBILITY_LEVEL = 120");

        var log = new StringWriter();
        var dryRun = await Assert.ThrowsAsync<InvalidOperationException>(() => Deployer.ApplyAsync(_fixtureRoot, execute: false, log));
        Assert.Contains("compatibility level 120", dryRun.Message);
        Assert.Contains("[FAIL] compatibility level 120", log.ToString());

        await Assert.ThrowsAsync<InvalidOperationException>(() => Deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null));
        Assert.Equal(0, await CountObjectsAsync(FixtureObjects));
    }

    [Fact]
    public async Task Preflight_LoginWithoutDdlRights_RefusesAndAppliesNothing()
    {
        WriteFixture();
        if (await IntegratedSecurityOnlyAsync())
            return; // a SQL login cannot connect to this server (e.g. LocalDB); nothing to prove here

        string login = $"MYPS_Test_login_{Guid.NewGuid():N}";
        string password = $"Pw!{Guid.NewGuid():N}";
        await ExecuteMasterAsync($"CREATE LOGIN [{login}] WITH PASSWORD = N'{password}', CHECK_POLICY = OFF;");
        try
        {
            await ExecuteAsync($"CREATE USER [{login}] FOR LOGIN [{login}]; ALTER ROLE db_datareader ADD MEMBER [{login}];");
            string lowPrivilege = new SqlConnectionStringBuilder(ConnectionString)
            {
                IntegratedSecurity = false,
                UserID = login,
                Password = password,
                Pooling = false
            }.ConnectionString;

            var deployer = new SqlObjectDeployer(new SqlExecutor(lowPrivilege), lowPrivilege);
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null));
            Assert.Contains("CREATE FUNCTION", ex.Message);
            Assert.Contains("ALTER on schema dbo", ex.Message);
            Assert.Equal(0, await CountObjectsAsync(FixtureObjects));
        }
        finally
        {
            // The login is server-level: dropping the test database does not remove it.
            await ExecuteMasterAsync($"IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'{login}') DROP LOGIN [{login}];");
        }
    }

    private static async Task<bool> IntegratedSecurityOnlyAsync()
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("SELECT CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS INT);", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync()) == 1;
    }

    private async Task ExecuteAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task Apply_WhileAnotherRunHoldsTheLock_FailsFast()
    {
        WriteFixture();
        await using var holder = new SqlConnection(ConnectionString);
        await holder.OpenAsync();
        await using var holderTx = (SqlTransaction)await holder.BeginTransactionAsync();
        await using (var take = new SqlCommand("EXEC sp_getapplock @Resource = 'MYPS_SqlObjectDeploy', @LockMode = 'Exclusive', @LockOwner = 'Transaction';", holder, holderTx))
            await take.ExecuteNonQueryAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => Deployer.ApplyAsync(_fixtureRoot, execute: true, TextWriter.Null));
        Assert.Contains("deploy lock", ex.Message);
        Assert.Equal(0, await CountObjectsAsync(FixtureObjects));
    }

    [Fact]
    public async Task RealFolder_NoLongerHasDeploymentObjects_SinceDeletionMovedToRuntimeScripts()
    {
        // 2026-10-16: the project/program hard-delete feature stopped deploying compiled DB
        // objects (fProjectDeletionTier, fProgramDeletionEligibility, pExecuteProjectDeletion,
        // pExecuteProgramDeletion) -- it now reads and runs its .sql files directly at request
        // time via ISqlExecutor.ExecuteScriptFile*InTransactionAsync (Main/Resources/Internal/
        // SQLScripts/Deletion/, see Helpers/ProjectHelper.cs and Helpers/ProgramHelper.cs), not
        // through this deployer. Main/Resources/Internal/SQLObjects/ is scaffolded for a FUTURE
        // migration of legacy Views/Stored Procedures/Functions (none has moved yet), so the
        // real checked-in folder legitimately applies zero objects today; this replaces the
        // former RealFolder_AppliesTheCheckedInObjects (which asserted the 4 deletion objects
        // were deployed from here -- no longer true, and no longer the right place to test it:
        // see ProjectDeletionTierTests for the script-file equivalent coverage).
        await using (var connection = new SqlConnection(ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = new SqlCommand(MinimalSchemaSql, connection);
            await command.ExecuteNonQueryAsync();
        }

        string root = FindRepositoryDirectory("Main/Resources/Internal/SQLObjects");
        var applied = await Deployer.ApplyAsync(root, execute: true, TextWriter.Null);

        Assert.Empty(applied);
        Assert.Equal(0, await CountObjectsAsync("fProgramDeletionEligibility", "fProjectDeletionTier", "pExecuteProgramDeletion", "pExecuteProjectDeletion"));
    }

    /// <summary>
    /// Every table the functions read must exist at CREATE time. A procedure may reference a
    /// table that does not exist yet (deferred name resolution), but NOT a missing column of a
    /// table that does — so any table created here carries every column the objects use.
    /// </summary>
    private const string MinimalSchemaSql = """
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

    private async Task<int> CountObjectsAsync(params string[] names)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(
            $"SELECT COUNT(*) FROM sys.objects WHERE name IN ({string.Join(", ", names.Select((_, i) => "@n" + i))});", connection);
        for (int i = 0; i < names.Length; i++) command.Parameters.AddWithValue("@n" + i, names[i]);
        return (int)(await command.ExecuteScalarAsync())!;
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
