using System.Net;
using System.Net.Http.Json;
using Microsoft.Data.SqlClient;
using Xunit;

namespace MYPS.ApiIntegrationTests;

/*  DEEP-PROTOCOL (2026-10-15/16): real HTTP-level tests for the 5 delete endpoints
    (DeleteProgram, BatchDelete, PreviewBatchDelete, DeleteItemizedProject, DeleteLumpSum) --
    closing the gap RequiresDeletionObjectsTests.cs's own comment names: "this codebase has no
    authenticated end-to-end HTTP pattern". Every request goes through real Kestrel test-host
    routing, the real [PermissionFilter] + CoreController.OnActionExecuting auth chain, and the
    real production entry points (ProgramHelper.ExecuteProgramDeletionAsync etc.) against a real
    LOCAL MYPS database -- nothing here is a direct C# method call or a stub. Opt-in: set
    MYPS_HTTP_TEST_MYPSDB (see DeletionEndpointsHttpFixture); unset, every test is reported as
    skipped ([LocalDatabaseFact]).

    See DeletionEndpointsHttpFixture for the disposable test user/group/permission setup and
    unconditional cleanup; see this session's earlier live ExecuteProgramDeletionAsync test
    (not committed -- a throwaway scratch probe) for the pattern this reuses: insert disposable
    ZZTEST rows satisfying every real NOT-NULL-no-default column, exercise the real code path,
    assert against the real database, verify cleanup independently. */
[Collection("DeletionEndpointsHttp")]
public sealed class DeletionEndpointsHttpTests : IAsyncLifetime
{
    private readonly DeletionEndpointsHttpFixture _fixture = new();

    public Task InitializeAsync() => _fixture.InitializeAsync();
    public Task DisposeAsync() => _fixture.DisposeAsync();

    private async Task<int> CountAsync(string sql)
    {
        await using var conn = new SqlConnection(_fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return (int)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task<(string ProgramFK, string Project1FK, string Project2FK)> SeedProgramWithTwoProjectsAsync(int programStatus = 3)
    {
        string suffix = Guid.NewGuid().ToString("N")[..8];
        string programFK = $"{DeletionEndpointsHttpFixture.TestPrefix}P{suffix}";
        string project1FK = $"{DeletionEndpointsHttpFixture.TestPrefix}P1{suffix}";
        string project2FK = $"{DeletionEndpointsHttpFixture.TestPrefix}P2{suffix}";

        await using var conn = new SqlConnection(_fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO dbo.tPrograms (ProgramPK, UserGroup, DataSecurityGroup, Type, StartYear, CreatedBy, CreatedDate)
            VALUES (@ProgramFK, N'[]', N'[]', 1, 2026, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProgramRevisions (ProgramFK, ProgramId, Name, Status, Cost, CreatedBy, CreatedDate)
            VALUES (@ProgramFK, @ProgramFK, N'Deep Protocol HTTP Test Program', @Status, 0, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProgramStages (ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
            VALUES (@ProgramFK, @ProgramFK, SCOPE_IDENTITY(), 1, N'BP', @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProjects (ProjectPK, ProgramFK, ProgramId, CreatedBy, CreatedDate)
            VALUES (@Project1FK, @ProgramFK, @ProgramFK, @UserId, SYSUTCDATETIME());
            INSERT INTO dbo.tProjects (ProjectPK, ProgramFK, ProgramId, CreatedBy, CreatedDate)
            VALUES (@Project2FK, @ProgramFK, @ProgramFK, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, Description, OperatingUnit, Category, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate)
            VALUES (@Project1FK, @ProgramFK, @ProgramFK, @Project1FK, N'test', N'test', 1, 1, 1, 1, 1, @UserId, SYSUTCDATETIME());
            INSERT INTO dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, Description, OperatingUnit, Category, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate)
            VALUES (@Project2FK, @ProgramFK, @ProgramFK, @Project2FK, N'test', N'test', 1, 1, 1, 1, 1, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
            VALUES (@Project1FK, @ProgramFK, @ProgramFK, (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK = @Project1FK), 1, N'BP', @UserId, SYSUTCDATETIME());
            INSERT INTO dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
            VALUES (@Project2FK, @ProgramFK, @ProgramFK, (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK = @Project2FK), 1, N'BP', @UserId, SYSUTCDATETIME());
            """;
        cmd.Parameters.AddWithValue("@ProgramFK", programFK);
        cmd.Parameters.AddWithValue("@Project1FK", project1FK);
        cmd.Parameters.AddWithValue("@Project2FK", project2FK);
        cmd.Parameters.AddWithValue("@UserId", _fixture.TestUserId);
        cmd.Parameters.AddWithValue("@Status", programStatus);
        await cmd.ExecuteNonQueryAsync();

        return (programFK, project1FK, project2FK);
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteProgram_RealHttpCall_RefusedWhileItHasProjects_DeletedOnceAPermittedUserDeletedThem()
    {
        var (programFK, project1FK, project2FK) = await SeedProgramWithTwoProjectsAsync(programStatus: 3 /* Working, not Approved */);
        using var client = _fixture.CreateAuthenticatedClient();
        var deleteProgram = new
        {
            Id = 0,
            ProgramId = programFK,
            RevisionId = 0,
            StageName = "BP",
            Name = "",
            DataSecurityGroup = Array.Empty<string>()
        };

        // No cascade (2026-10-16): the program still has its two projects.
        var refused = await client.PostAsJsonAsync("/api/Program/DeleteProgram", deleteProgram);
        string refusedBody = await refused.Content.ReadAsStringAsync();
        Assert.True(refused.StatusCode == HttpStatusCode.BadRequest, $"Expected 400, got {refused.StatusCode}: {refusedBody}");
        Assert.Contains("still has 2 project(s)", refusedBody);
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '{programFK}'"));
        Assert.Equal(2, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProgramFK = '{programFK}'"));

        // A user allowed to Batch Delete deletes them (first stage entry: permanently).
        var batchDelete = await client.PostAsJsonAsync("/api/Program/BatchDelete", new { ProgramId = programFK, ProjectIds = $"{project1FK},{project2FK}" });
        Assert.True(batchDelete.StatusCode == HttpStatusCode.OK, $"Batch Delete: {batchDelete.StatusCode}: {await batchDelete.Content.ReadAsStringAsync()}");

        var response = await client.PostAsJsonAsync("/api/Program/DeleteProgram", deleteProgram);
        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {response.StatusCode}: {body}");

        Assert.Equal(0, await CountAsync($"SELECT COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '{programFK}'"));
        Assert.Equal(2, await CountAsync(
            $"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId IN ('{project1FK}', '{project2FK}') AND TransactionType = 'Delete' AND NewValue = 'Permanently deleted'"));
        Assert.Equal(1, await CountAsync(
            $"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId = '{programFK}' AND OldValue LIKE '%\"ProjectsDeleted\":0%'"));
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteProgram_RealHttpCall_RefusesAnApprovedProgram_AndDeletesNothing()
    {
        var (programFK, _, _) = await SeedProgramWithTwoProjectsAsync(programStatus: 1 /* Approved */);
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Program/DeleteProgram", new
        {
            Id = 0,
            ProgramId = programFK,
            RevisionId = 0,
            StageName = "BP",
            Name = "",
            DataSecurityGroup = Array.Empty<string>()
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("approved", body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '{programFK}'"));
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteProgram_RealHttpCall_NoAuthHeader_Returns401()
    {
        using var client = _fixture.Factory.CreateClient(); // no X-Test-UserId header attached

        var response = await client.PostAsJsonAsync("/api/Program/DeleteProgram", new
        {
            Id = 0,
            ProgramId = "does-not-matter",
            RevisionId = 0,
            StageName = "BP",
            Name = "",
            DataSecurityGroup = Array.Empty<string>()
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteProgram_RealHttpCall_UserWithNoPermissionGrant_Returns403()
    {
        // A real authenticated user (vUsers resolves them), but with no tApiActions grant for
        // ProgramController.DeleteProgram -- proves PermissionFilter's vUserActionPermission
        // check is actually exercised, not bypassed by TestAuthHandler.
        string unauthorizedUserId = $"{DeletionEndpointsHttpFixture.TestPrefix}NoPerm{Guid.NewGuid():N}"[..40];
        await using (var conn = new SqlConnection(_fixture.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO dbo.tUsers (EmployeeId, UserId, Name, Email, RegCode, PlantillaOffice, IsActive)
                VALUES (@UserId, @UserId, @UserId, NULL, N'ZZTEST', NULL, 1);

                -- vUsers INNER JOINs tUserGroups -- without a row here, vUsers has zero rows
                -- for this user, and CoreController's OnActionExecuting re-resolution 401s
                -- before PermissionFilter's own 403 logic is ever reached. An empty GroupIds
                -- array is enough: a real user, with real active status, with zero group
                -- membership and therefore zero tApiActions grants -- exactly the scenario this
                -- test means to prove.
                INSERT INTO dbo.tUserGroups (UserId, GroupIds, CreatedBy, CreatedDate)
                VALUES (@UserId, N'[]', @UserId, SYSUTCDATETIME());
                """;
            cmd.Parameters.AddWithValue("@UserId", unauthorizedUserId);
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            using var client = _fixture.Factory.CreateClient();
            client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, unauthorizedUserId);

            var response = await client.PostAsJsonAsync("/api/Program/DeleteProgram", new
            {
                Id = 0,
                ProgramId = "does-not-matter",
                RevisionId = 0,
                StageName = "BP",
                Name = "",
                DataSecurityGroup = Array.Empty<string>()
            });

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
        finally
        {
            await using var conn = new SqlConnection(_fixture.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM dbo.tUserGroups WHERE UserId = @UserId; DELETE FROM dbo.tUsers WHERE UserId = @UserId;";
            cmd.Parameters.AddWithValue("@UserId", unauthorizedUserId);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task PreviewBatchDelete_RealHttpCall_ReportsHardTierWithoutDeletingAnything()
    {
        var (programFK, project1FK, project2FK) = await SeedProgramWithTwoProjectsAsync(programStatus: 3);
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Program/PreviewBatchDelete", new
        {
            ProgramId = programFK,
            ProjectIds = $"{project1FK},{project2FK}"
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {response.StatusCode}: {body}");
        Assert.Contains(project1FK, body);
        Assert.Contains(project2FK, body);

        // Preview must not delete or write anything -- it only reports the plan.
        Assert.Equal(2, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProgramFK = '{programFK}'"));
        Assert.Equal(0, await CountAsync($"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId IN ('{project1FK}', '{project2FK}')"));
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task BatchDelete_RealHttpCall_HardDeletesTheNamedProjectsAndWritesAuditRows()
    {
        var (programFK, project1FK, project2FK) = await SeedProgramWithTwoProjectsAsync(programStatus: 3);
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Program/BatchDelete", new
        {
            ProgramId = programFK,
            ProjectIds = $"{project1FK},{project2FK}"
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {response.StatusCode}: {body}");

        Assert.Equal(0, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK IN ('{project1FK}', '{project2FK}')"));
        Assert.Equal(2, await CountAsync(
            $"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId IN ('{project1FK}', '{project2FK}') AND TransactionType = 'Delete' AND NewValue = 'Permanently deleted'"));
        // The program itself is untouched by BatchDelete -- only its named projects go.
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '{programFK}'"));
    }

    /*  UAT S01-TC008-P001 (2026-10-25): the batch actions find the program by its CURRENT ProgramId,
        and the Program Details page sends the ProgramId of the stage being viewed. On a stage the
        program has moved past, the answer was "Program ID '<code>' does not exist", for a program
        that plainly exists. It must name the program and its current stage, and never echo the code. */
    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task BatchDelete_RealHttpCall_OlderStageProgramId_NamesTheProgramAndItsCurrentStage()
    {
        var (programFK, project1FK, project2FK) = await SeedProgramWithTwoProjectsAsync(programStatus: 3);
        // Advance to NEP the way UpdateProgramStage does: a new revision under a new ProgramId.
        await using (var conn = new SqlConnection(_fixture.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO dbo.tProgramRevisions (ProgramFK, ProgramId, Name, Status, Cost, CreatedBy, CreatedDate)
                VALUES (@ProgramFK, @NepProgramId, N'Deep Protocol HTTP Test Program', 3, 0, @UserId, SYSUTCDATETIME());
                INSERT INTO dbo.tProgramStages (ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
                VALUES (@ProgramFK, @NepProgramId, SCOPE_IDENTITY(), 2, N'NEP', @UserId, SYSUTCDATETIME());
                """;
            cmd.Parameters.AddWithValue("@ProgramFK", programFK);
            cmd.Parameters.AddWithValue("@NepProgramId", $"{programFK}-NEP");
            cmd.Parameters.AddWithValue("@UserId", _fixture.TestUserId);
            await cmd.ExecuteNonQueryAsync();
        }
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Program/BatchDelete", new
        {
            ProgramId = programFK, // the BP-era ProgramId, as a page still on BP would send
            ProjectIds = $"{project1FK},{project2FK}"
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"Expected 400, got {response.StatusCode}: {body}");
        Assert.Contains("Not the Current Stage", body);
        Assert.Contains("Deep Protocol HTTP Test Program", body);
        Assert.Contains("moved on to the NEP stage", body);
        Assert.DoesNotContain(programFK, body);
        Assert.Equal(2, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProgramFK = '{programFK}'"));
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task BatchDelete_RealHttpCall_UnknownProgramId_SaysNotFoundWithoutEchoingTheId()
    {
        string unknownProgramId = $"{DeletionEndpointsHttpFixture.TestPrefix}NoSuchProgram";
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Program/BatchDelete", new
        {
            ProgramId = unknownProgramId,
            ProjectIds = "BP00000000LZ"
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"Expected 400, got {response.StatusCode}: {body}");
        Assert.Contains("Program Not Found", body);
        Assert.Contains("This program could not be found", body);
        Assert.DoesNotContain(unknownProgramId, body);
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteItemizedProject_RealHttpCall_HardDeletesAnOrdinaryProjectAndWritesAuditRow()
    {
        // DeleteItemizedProject requires the target to resolve a real Lump Sum parent via
        // ParentProjectId -> vLumpSumSet (ProjectType='LS', no parent of its own, holds an LS
        // component) -- a project with none is refused ("not itemized from a Lump Sum
        // Project"), by design (2026-10-15 fix: deleting an ordinary project belongs to
        // Projects, not this endpoint). Build a real minimal LS parent and link project1FK to
        // it so the real resolution chain runs, rather than hitting the refusal path.
        var (programFK, project1FK, project2FK) = await SeedProgramWithTwoProjectsAsync(programStatus: 3);
        var (lsParentFK, _) = await SeedLumpSumParentAsync(programFK, project1FK);
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Lumpsum/DeleteItemizedProject", new
        {
            ProjectId = project1FK
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {response.StatusCode}: {body}");

        Assert.Equal(0, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK = '{project1FK}'"));
        Assert.Equal(1, await CountAsync(
            $"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId = '{project1FK}' AND TransactionType = 'Delete' AND NewValue = 'Permanently deleted'"));
        // The control project, the LS parent and the program are untouched.
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK = '{project2FK}'"));
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK = '{lsParentFK}'"));
        Assert.Equal(1, await CountAsync($"SELECT COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '{programFK}'"));
    }

    /// <summary>Minimal real Lump Sum parent (ProjectType='LS', no parent of its own, one
    /// tProjectComponentCost row with ComponentId='LS' so vLumpSumSet.HasLSComponent = 1),
    /// with <paramref name="childProjectFK"/> linked to it via ParentProjectId -- the exact
    /// shape DeleteItemizedProject's LSParent resolution (vLumpSumSet by ParentProjectId)
    /// requires to accept the child as a real itemized project rather than refusing it.
    /// Returns (ProjectPK, Id) -- Id is what DeleteLumpSum's DTO (vLumpSumSet.Id) needs.</summary>
    private async Task<(string ProjectPK, int Id)> SeedLumpSumParentAsync(string programFK, string? childProjectFK = null)
    {
        string lsParentFK = $"{DeletionEndpointsHttpFixture.TestPrefix}LS{Guid.NewGuid():N}"[..40];

        await using var conn = new SqlConnection(_fixture.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO dbo.tProjects (ProjectPK, ProgramFK, ProgramId, ProjectType, CreatedBy, CreatedDate)
            VALUES (@LsParentFK, @ProgramFK, @ProgramFK, N'LS', @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProjectRevisions (ProjectFK, ProgramFK, ProgramId, ProjectId, Description, OperatingUnit, Category, Origin, Agency, RegionWide, Tier, CreatedBy, CreatedDate)
            VALUES (@LsParentFK, @ProgramFK, @ProgramFK, @LsParentFK, N'test', N'test', 1, 1, 1, 1, 1, @UserId, SYSUTCDATETIME());

            INSERT INTO dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Total, CreatedBy, CreatedDate)
            VALUES ((SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK = @LsParentFK), N'Lump Sum', N'LS', 1000, @UserId, SYSUTCDATETIME());

            -- GetProjectDeletionTier.sql: StageCount = 0 (no row at all) resolves 'Soft', not
            -- 'Hard' -- exactly 1 distinct StageId is what "first stage entry, never
            -- progressed" means. Without this row DeleteLumpSum flags the parent (soft) instead
            -- of physically deleting it, which is the real bug this test would otherwise hide.
            INSERT INTO dbo.tProjectStages (ProjectFK, ProgramFK, ProgramId, RevisionId, StageId, StageName, CreatedBy, CreatedDate)
            VALUES (@LsParentFK, @ProgramFK, @ProgramFK, (SELECT Id FROM dbo.tProjectRevisions WHERE ProjectFK = @LsParentFK), 1, N'BP', @UserId, SYSUTCDATETIME());

            IF @ChildProjectFK IS NOT NULL
                UPDATE dbo.tProjects SET ParentProjectId = @LsParentFK WHERE ProjectPK = @ChildProjectFK;

            SELECT Id FROM dbo.tProjects WHERE ProjectPK = @LsParentFK;
            """;
        cmd.Parameters.AddWithValue("@LsParentFK", lsParentFK);
        cmd.Parameters.AddWithValue("@ProgramFK", programFK);
        cmd.Parameters.AddWithValue("@ChildProjectFK", (object?)childProjectFK ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@UserId", _fixture.TestUserId);
        int id = (int)(await cmd.ExecuteScalarAsync())!;

        return (lsParentFK, id);
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteLumpSum_RealHttpCall_HardDeletesTheParentAndWritesAuditRow()
    {
        var (programFK, _, _) = await SeedProgramWithTwoProjectsAsync(programStatus: 3);
        var (lsParentFK, lsParentId) = await SeedLumpSumParentAsync(programFK);
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Lumpsum/DeleteLumpSum", new
        {
            LumpSumId = lsParentId
        });

        string body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected 200, got {response.StatusCode}: {body}");

        Assert.Equal(0, await CountAsync($"SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK = '{lsParentFK}'"));
        Assert.Equal(1, await CountAsync(
            $"SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId = '{lsParentFK}' AND TransactionType = 'Delete' AND NewValue = 'Permanently deleted'"));
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteLumpSum_RealHttpCall_NotFoundId_Returns400()
    {
        using var client = _fixture.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/Lumpsum/DeleteLumpSum", new
        {
            LumpSumId = int.MaxValue - 1 // astronomically unlikely to be a real row
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [LocalDatabaseFact]
    [Trait("Layer", "HttpIntegration")]
    public async Task DeleteItemizedProject_RealHttpCall_NotFoundProject_Returns400AndDeletesNothing()
    {
        using var client = _fixture.CreateAuthenticatedClient();
        string missingId = $"{DeletionEndpointsHttpFixture.TestPrefix}DoesNotExist";

        var response = await client.PostAsJsonAsync("/api/Lumpsum/DeleteItemizedProject", new
        {
            ProjectId = missingId
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

[CollectionDefinition("DeletionEndpointsHttp", DisableParallelization = true)]
public sealed class DeletionEndpointsHttpCollection { }
