using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MYPS.ApiIntegrationTests;

/*  DEEP-PROTOCOL (2026-10-15/16): the first REAL authenticated HTTP-level test fixture in this
    repo. Every prior "integration" test either asserted static source text
    (ProgramControllerPublishRestrictionContractTests) or exercised a filter directly with a
    stub (RequiresDeletionObjectsTests, whose own header comment says "this codebase has no
    authenticated end-to-end HTTP pattern") -- never a real POST through Kestrel's test host,
    through the real [PermissionFilter] -> CoreController.OnActionExecuting chain, against a
    real database.

    This fixture: builds a WebApplicationFactory<Program> pointed at the REAL myps_db_dev
    (the same database this session's earlier live smoke test already proved safe for
    disposable rows, independently re-verified with a zero-residue check afterward), registers
    TestAuthHandler as the default auth scheme (bypasses only the password check -- every
    downstream DB-driven permission check still runs for real), and inserts one disposable
    test user + group + role + tApiActions grant covering exactly the 5 delete actions this
    gap targets. Everything it creates is deleted in DisposeAsync, unconditionally, mirroring
    the pattern already proven in this session's earlier live ExecuteProgramDeletionAsync test.

    Why myps_db_dev and not a fresh throwaway database: the auth chain alone touches 6 real
    tables/views (tUsers, tUserGroups, tGroups, tGroupRoles, tApiActions, vUsers,
    vUserActionPermission) plus 2 real inline functions/views the delete actions themselves
    need (fProgramStages, vProgramLatest) -- recreating all of that from scratch in a disposable
    database would mean re-deriving the real schema a second time, with no guarantee of staying
    in sync with it. Disposable, unmistakably-prefixed rows against the real schema is the
    pattern this session already used and verified; this fixture reuses it rather than
    inventing a second approach. */
public sealed class DeletionEndpointsHttpFixture : IAsyncLifetime
{
    public const string TestPrefix = "ZZTEST-HttpTest-";

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public string TestUserId { get; } = $"{TestPrefix}{Guid.NewGuid():N}"[..40];
    public string ConnectionString { get; private set; } = string.Empty;

    // Real tApiActions.Id values for the 5 delete endpoints, confirmed live against myps_db_dev
    // (SELECT Id, ControllerName, ActionName FROM dbo.tApiActions WHERE ActionName IN (...)):
    //   13  ProgramController.BatchDelete
    //   22  ProgramController.DeleteProgram
    //  153  LumpsumController.DeleteItemizedProject
    //  154  LumpsumController.DeleteLumpSum
    //  160  ProgramController.PreviewBatchDelete
    private static readonly int[] DeleteActionIds = { 13, 22, 153, 154, 160 };

    private int _groupId;

    public async Task InitializeAsync()
    {
        // See TestHostEnvironment.cs for why this must be environment variables, not
        // ConfigureAppConfiguration -- the latter is silently too late for Main/Program.cs's
        // own eager config reads, which is this project's 3 pre-existing
        // MYPS.ApiIntegrationTests failures' actual root cause (also fixed this session, see
        // ApplicationFactorySmokeTests.cs).
        TestHostEnvironment.EnsureTestEnvironmentVariablesSet();
        Environment.SetEnvironmentVariable("ConnectionStrings__MYPSDb", ReadDevConnectionString());

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

        ConnectionString = ReadDevConnectionString();

        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
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
        cmd2.Parameters.AddWithValue("@ActionIdsJson", System.Text.Json.JsonSerializer.Serialize(DeleteActionIds));
        await cmd2.ExecuteNonQueryAsync();
    }

    private static string ReadDevConnectionString()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(@"C:\Users\Msi\source\repos\myps_server\Main")
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();
        return config.GetConnectionString("MYPSDb")
            ?? throw new InvalidOperationException("ConnectionStrings:MYPSDb missing from appsettings.Development.json.");
    }

    public HttpClient CreateAuthenticatedClient()
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, TestUserId);
        return client;
    }

    public async Task DisposeAsync()
    {
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

        await Factory.DisposeAsync();
    }
}
