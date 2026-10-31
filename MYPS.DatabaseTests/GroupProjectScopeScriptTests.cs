using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Main/Resources/Internal/SQLScripts/Migration.GroupProjectScope.2026-10-31.sql and
    Migration.GroupProjectScopeCluster.2026-10-31.sql, run as written (split on GO, every batch run
    and its error kept, as SSMS and sqlcmd do) against a disposable MYPS_Test_ database on the three
    servers they meet: one without the column, a fresh one, and one where the first script ran when
    the check was still 0-3. The Cluster script once failed to compile on a server without the
    column ("Invalid column name 'ProjectScope'") instead of saying which script to run first. */
public sealed class GroupProjectScopeScriptTests : IAsyncLifetime
{
    private const string BaseScript = "Migration.GroupProjectScope.2026-10-31.sql";
    private const string ClusterScript = "Migration.GroupProjectScopeCluster.2026-10-31.sql";
    private const int InvalidColumnName = 207;
    private const int CheckOrForeignKeyViolation = 547;

    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, """
            CREATE TABLE dbo.tGroups (Id int IDENTITY PRIMARY KEY, GroupName nvarchar(100) NOT NULL, ApplyFilter bit NOT NULL DEFAULT 0);
            INSERT dbo.tGroups (GroupName) VALUES (N'Admin'), (N'AUC'), (N'RPC'), (N'DPC'), (N'UPC');
            """);
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ClusterScript_WithoutTheColumn_NamesTheScriptToRunFirst_AndChangesNothing()
    {
        await using var connection = await OpenAsync();

        List<SqlException> errors = await RunScriptAsync(connection, ClusterScript);

        SqlException error = Assert.Single(errors);
        Assert.DoesNotContain(error.Errors.Cast<SqlError>(), e => e.Number == InvalidColumnName);
        Assert.Contains(BaseScript, error.Message);
        Assert.Equal(0, await ScalarAsync(connection, "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.tGroups') AND name = N'ProjectScope';"));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task BaseScript_OnAFreshServer_AllowsOwnUpmoCluster_AndTheClusterScriptHasNothingToDo()
    {
        await using var connection = await OpenAsync();

        Assert.Empty(await RunScriptAsync(connection, BaseScript));
        Assert.Empty(await RunScriptAsync(connection, BaseScript));
        string? definition = await ConstraintDefinitionAsync(connection);
        Assert.Contains("<=(4)", definition);
        Assert.Equal(1, await ScalarAsync(connection, "SELECT ProjectScope FROM dbo.tGroups WHERE GroupName = N'AUC';"));
        Assert.Equal(2, await ScalarAsync(connection, "SELECT ProjectScope FROM dbo.tGroups WHERE GroupName = N'RPC';"));
        Assert.Equal(3, await ScalarAsync(connection, "SELECT ProjectScope FROM dbo.tGroups WHERE GroupName = N'DPC';"));

        Assert.Empty(await RunScriptAsync(connection, ClusterScript));
        Assert.Equal(definition, await ConstraintDefinitionAsync(connection));

        await ExecuteAsync(connection, "UPDATE dbo.tGroups SET ProjectScope = 4 WHERE GroupName = N'UPC';");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation, "UPDATE dbo.tGroups SET ProjectScope = 5 WHERE GroupName = N'UPC';");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ClusterScript_OnAServerWithTheOldCheck_WidensIt_AndKeepsEveryGroupsSetting()
    {
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, """
            ALTER TABLE dbo.tGroups ADD ProjectScope tinyint NOT NULL
                CONSTRAINT DF_tGroups_ProjectScope DEFAULT (0)
                CONSTRAINT CK_tGroups_ProjectScope CHECK (ProjectScope BETWEEN 0 AND 3);
            """);
        await ExecuteAsync(connection, "UPDATE dbo.tGroups SET ProjectScope = 1 WHERE GroupName = N'AUC'; UPDATE dbo.tGroups SET ProjectScope = 3 WHERE GroupName = N'DPC';");
        await AssertRefusedAsync(connection, CheckOrForeignKeyViolation, "UPDATE dbo.tGroups SET ProjectScope = 4 WHERE GroupName = N'UPC';");

        Assert.Empty(await RunScriptAsync(connection, ClusterScript));
        Assert.Empty(await RunScriptAsync(connection, ClusterScript));

        Assert.Contains("<=(4)", await ConstraintDefinitionAsync(connection));
        Assert.Equal(1, await ScalarAsync(connection, "SELECT ProjectScope FROM dbo.tGroups WHERE GroupName = N'AUC';"));
        Assert.Equal(3, await ScalarAsync(connection, "SELECT ProjectScope FROM dbo.tGroups WHERE GroupName = N'DPC';"));
        await ExecuteAsync(connection, "UPDATE dbo.tGroups SET ProjectScope = 4 WHERE GroupName = N'UPC';");
    }

    private static Task<string?> ConstraintDefinitionAsync(SqlConnection connection) =>
        StringAsync(connection, "SELECT definition FROM sys.check_constraints WHERE name = N'CK_tGroups_ProjectScope';");

    /// <summary>Runs every batch and keeps each one's error, as SSMS and sqlcmd without -b do.</summary>
    private static async Task<List<SqlException>> RunScriptAsync(SqlConnection connection, string fileName)
    {
        string path = Path.Combine(FindRepositoryDirectory("Main/Resources/Internal/SQLScripts"), fileName);
        var errors = new List<SqlException>();
        foreach (Helpers.SqlBatch batch in SqlBatchSplitter.Split(await File.ReadAllTextAsync(path)))
            for (int i = 0; i < batch.Repeat; i++)
            {
                try { await ExecuteAsync(connection, batch.Text); }
                catch (SqlException error) { errors.Add(error); }
            }
        return errors;
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
