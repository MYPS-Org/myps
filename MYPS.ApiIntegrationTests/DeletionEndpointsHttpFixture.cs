using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MYPS.ApiIntegrationTests;

/*  The first real authenticated HTTP-level fixture in this repo: a WebApplicationFactory<Program>
    whose requests go through Kestrel's test host, the real [PermissionFilter] ->
    CoreController.OnActionExecuting chain and the real delete code, against a real MYPS database.
    TestAuthHandler bypasses only the password check; every DB-driven permission check still runs.

    OPT-IN AND LOCAL ONLY (2026-10-16, documents/plans/delete-policy-must-fix.md). The fixture
    writes a disposable user, group and grant plus ZZTEST program/project rows, so it runs only
    when MYPS_HTTP_TEST_MYPSDB holds a connection string, and only against a local server
    (localhost, ".", "(local)", 127.0.0.1 or LocalDB). Unset, it touches nothing and every test
    returns early; a remote server is refused outright. The database needs the real schema (the
    auth chain alone reads tUsers, tUserGroups, tGroups, tGroupRoles, tApiActions, vUsers,
    vUserActionPermission), e.g. a local copy of UAT -- run it under a snapshot and revert.
    Everything it creates is deleted again in DisposeAsync, unconditionally.

    The delete actions are granted by NAME: tApiActions.Id differs per database (the
    PreviewBatchDelete permission migration matches by name for the same reason). */
public sealed class DeletionEndpointsHttpFixture : IAsyncLifetime
{
    public const string TestPrefix = "ZZTEST-HttpTest-";

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public string TestUserId { get; } = $"{TestPrefix}{Guid.NewGuid():N}"[..40];
    public string ConnectionString { get; private set; } = string.Empty;

    /// <summary>Holds the connection string of the local database to run against; unset = disabled.</summary>
    public const string ConnectionStringVariable = "MYPS_HTTP_TEST_MYPSDB";

    /// <summary>The actions behind [RequiresDeletionObjects], granted to the test user by name.</summary>
    private static readonly (string Controller, string Action)[] DeleteActions =
    {
        ("ProgramController", "BatchDelete"),
        ("ProgramController", "DeleteProgram"),
        ("ProgramController", "PreviewBatchDelete"),
        ("ProgramController", "BatchAddExistingProject"),
        ("LumpsumController", "DeleteItemizedProject"),
        ("LumpsumController", "DeleteLumpSum"),
    };

    private static readonly string[] LocalHosts = { "localhost", ".", "(local)", "127.0.0.1" };

    /// <summary>False when <see cref="ConnectionStringVariable"/> is unset: nothing was created and
    /// every test returns without asserting.</summary>
    public bool Enabled { get; private set; }

    private int _groupId;
    private string? _previousMypsDb;

    public async Task InitializeAsync()
    {
        // See TestHostEnvironment.cs for why this must be environment variables, not
        // ConfigureAppConfiguration -- the latter is silently too late for Main/Program.cs's
        // own eager config reads, which is this project's 3 pre-existing
        // MYPS.ApiIntegrationTests failures' actual root cause (also fixed this session, see
        // ApplicationFactorySmokeTests.cs).
        string? configured = Environment.GetEnvironmentVariable(ConnectionStringVariable);
        if (string.IsNullOrWhiteSpace(configured))
        {
            return; // opt-in: disabled, nothing touched
        }
        ConnectionString = RequireLocalServer(configured);

        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        // Read-only, and the likeliest to fail (a database without the PreviewBatchDelete
        // migration): done before anything is written or overridden.
        int[] actionIds = await ReadDeleteActionIdsAsync(conn);

        Enabled = true;
        TestHostEnvironment.EnsureTestEnvironmentVariablesSet();
        // Restored in DisposeAsync so it cannot leak into another test class in this run.
        _previousMypsDb = Environment.GetEnvironmentVariable("ConnectionStrings__MYPSDb");
        Environment.SetEnvironmentVariable("ConnectionStrings__MYPSDb", ConnectionString);
        try
        {
            await CreateFactoryAndTestUserAsync(conn, actionIds);
        }
        catch
        {
            // xUnit skips DisposeAsync when InitializeAsync throws: clean up here, or the test
            // user and the environment override would outlive this fixture.
            await DisposeAsync();
            throw;
        }
    }

    private async Task CreateFactoryAndTestUserAsync(SqlConnection conn, int[] actionIds)
    {
        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureTestServices(services =>
                {
                    services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                        options.DefaultScheme = TestAuthHandler.SchemeName;
                    })
                        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                });
            });

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO dbo.tUsers (EmployeeId, UserId, Name, Email, RegCode, PlantillaOffice, IsActive)
            VALUES (@UserId, @UserId, @UserId, NULL, N'ZZTEST', NULL, 1);

            INSERT INTO dbo.tGroups (GroupName, Description, ApplyFilter, CreatedBy, CreatedDate)
            VALUES (@UserId, N'Deep-protocol HTTP test group', 0, @UserId, SYSUTCDATETIME());
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;
        cmd.Parameters.AddWithValue("@UserId", TestUserId);
        _groupId = (int)(await cmd.ExecuteScalarAsync())!;

        await using var cmd2 = conn.CreateCommand();
        cmd2.CommandText = """
            INSERT INTO dbo.tUserGroups (UserId, GroupIds, CreatedBy, CreatedDate)
            VALUES (@UserId, @GroupIdsJson, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tGroupRoles (GroupId, ActionIds, ViewIds)
            VALUES (@GroupId, @ActionIdsJson, N'[]');
            """;
        cmd2.Parameters.AddWithValue("@UserId", TestUserId);
        cmd2.Parameters.AddWithValue("@GroupIdsJson", $"[{_groupId}]");
        cmd2.Parameters.AddWithValue("@GroupId", _groupId);
        cmd2.Parameters.AddWithValue("@ActionIdsJson", System.Text.Json.JsonSerializer.Serialize(actionIds));
        await cmd2.ExecuteNonQueryAsync();
    }

    /// <summary>Refuses any server but a local one: this fixture writes users and grants.</summary>
    private static string RequireLocalServer(string connectionString)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        string host = builder.DataSource.Trim();
        if (host.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase)) host = host[4..];
        int comma = host.IndexOf(',');
        if (comma >= 0) host = host[..comma];
        bool isLocalDb = host.StartsWith("(localdb)", StringComparison.OrdinalIgnoreCase);
        int slash = host.IndexOf('\\');
        if (!isLocalDb && slash >= 0) host = host[..slash];

        if (!isLocalDb && !LocalHosts.Contains(host, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"{ConnectionStringVariable} points at '{builder.DataSource}'. These tests create users, grants and " +
                "program rows, so they run only against a local server (localhost, '.', '(local)', 127.0.0.1 or LocalDB).");
        }
        return connectionString;
    }

    private static async Task<int[]> ReadDeleteActionIdsAsync(SqlConnection conn)
    {
        var ids = new List<int>();
        var missing = new List<string>();
        foreach (var (controller, action) in DeleteActions)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT Id FROM dbo.tApiActions
                WHERE ControllerName = @Controller AND ActionName COLLATE Latin1_General_BIN2 = @Action;
                """;
            cmd.Parameters.AddWithValue("@Controller", controller);
            cmd.Parameters.AddWithValue("@Action", action);
            if (await cmd.ExecuteScalarAsync() is int id) ids.Add(id);
            else missing.Add($"{controller}.{action}");
        }
        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"tApiActions has no row for {string.Join(", ", missing)}. For PreviewBatchDelete run " +
                "Main/Resources/Internal/SQLScripts/Migration.PreviewBatchDeletePermission.2026-10-15.sql first.");
        }
        return ids.ToArray();
    }

    public HttpClient CreateAuthenticatedClient()
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, TestUserId);
        return client;
    }

    public async Task DisposeAsync()
    {
        if (!Enabled)
        {
            return;
        }
        Environment.SetEnvironmentVariable("ConnectionStrings__MYPSDb", _previousMypsDb);

        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        // Unconditional cleanup -- runs even if a test throws (IAsyncLifetime.DisposeAsync
        // always runs). Order matters only for the tGroupRoles/tGroups pair; ZZTEST program/
        // project rows a test created are cleaned here too so no test needs its own teardown.
        cmd.CommandText = """
            DELETE FROM dbo.tTransactionLog WHERE ReferenceId LIKE @TestPrefix;
            DELETE FROM dbo.tProjectComponentCost WHERE ProjectRevisionFK IN (
                SELECT Id FROM dbo.tProjectRevisions WHERE ProgramFK LIKE @TestPrefix);
            DELETE FROM dbo.tProjectStages WHERE ProgramFK LIKE @TestPrefix;
            DELETE FROM dbo.tProjectRevisions WHERE ProgramFK LIKE @TestPrefix;
            DELETE FROM dbo.tProjects WHERE ProgramFK LIKE @TestPrefix;
            DELETE FROM dbo.tProgramStages WHERE ProgramFK LIKE @TestPrefix;
            DELETE FROM dbo.tProgramRevisions WHERE ProgramFK LIKE @TestPrefix;
            DELETE FROM dbo.tPrograms WHERE ProgramPK LIKE @TestPrefix;
            DELETE FROM dbo.tUserGroups WHERE UserId = @UserId;
            DELETE FROM dbo.tGroupRoles WHERE GroupId = @GroupId;
            DELETE FROM dbo.tGroups WHERE Id = @GroupId;
            DELETE FROM dbo.tUsers WHERE UserId = @UserId;
            """;
        cmd.Parameters.AddWithValue("@TestPrefix", $"{TestPrefix}%");
        cmd.Parameters.AddWithValue("@UserId", TestUserId);
        cmd.Parameters.AddWithValue("@GroupId", _groupId);
        await cmd.ExecuteNonQueryAsync();

        if (Factory != null)
        {
            await Factory.DisposeAsync();
        }
    }
}
