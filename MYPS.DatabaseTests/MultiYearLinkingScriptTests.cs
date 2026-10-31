using Helpers;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking.2026-10-31.sql on a server that does not
    have the Phase 1 tables yet: it must say which script to run first and change nothing -- not fail
    halfway on the foreign keys to the Phase 1 tables. MultiYearSchemaTests covers the normal order. */
public sealed class MultiYearLinkingScriptTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync() =>
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task LinkingScript_WithoutPhaseOne_NamesTheSchemaScript_AndCreatesNothing()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        string path = Path.Combine(FindRepositoryDirectory("Main/Resources/MultiYear/SQL"), MultiYearSchemaTests.LinkingScript);
        var errors = new List<SqlException>();
        foreach (Helpers.SqlBatch batch in SqlBatchSplitter.Split(await File.ReadAllTextAsync(path)))
            for (int i = 0; i < batch.Repeat; i++)
            {
                try { await ExecuteAsync(connection, batch.Text); }
                catch (SqlException error) { errors.Add(error); }
            }

        SqlException only = Assert.Single(errors);
        Assert.Contains(MultiYearSchemaTests.SchemaScript, only.Message);
        await using var count = new SqlCommand("SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'tMultiYear%';", connection);
        Assert.Equal(0, Convert.ToInt32(await count.ExecuteScalarAsync()));
    }

    private static async Task ExecuteAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
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
