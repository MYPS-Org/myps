using System.Reflection;
using Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WebAPI.Controllers;
using WebAPI.Controllers.Lumpsum;
using WebAPI.Controllers.Programs;
using Xunit;

namespace MYPS.ApiIntegrationTests;

/*  The 503 safety net for a release that skipped `Main.exe --apply-sql-objects --yes`
    (documents/plans/delete-policy-release-blockers.md, 2.2): every action that uses the deletion SQL
    objects answers 503 "Delete Unavailable" while IDeletionObjectsStatus says they are not deployed,
    and runs normally once they are. The filter is exercised directly with a stub status (this
    codebase has no authenticated end-to-end HTTP pattern); the database side of the status is
    covered by MYPS.DatabaseTests/DeletionObjectsStatusTests. */
public sealed class RequiresDeletionObjectsTests
{
    private sealed class StubStatus : IDeletionObjectsStatus
    {
        public bool Ready { get; init; }
        public string? Problem => Ready ? null : "dbo.fProjectDeletionTier is missing";
        public Task<bool> EnsureReadyAsync(CancellationToken ct = default) => Task.FromResult(Ready);
    }

    private static ActionExecutingContext ContextWith(IDeletionObjectsStatus status)
    {
        var services = new ServiceCollection().AddSingleton(status).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        return new ActionExecutingContext(
            new ActionContext(http, new RouteData(), new ActionDescriptor()),
            new List<IFilterMetadata>(), new Dictionary<string, object?>(), controller: new object());
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public async Task NotReady_Answers503_AndDoesNotRunTheAction()
    {
        var context = ContextWith(new StubStatus { Ready = false });
        bool actionRan = false;

        await new RequiresDeletionObjectsAttribute().OnActionExecutionAsync(context, () =>
        {
            actionRan = true;
            return Task.FromResult<ActionExecutedContext>(null!);
        });

        Assert.False(actionRan);
        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, result.StatusCode);
        string body = System.Text.Json.JsonSerializer.Serialize(result.Value);
        Assert.Contains(RequiresDeletionObjectsAttribute.Title, body);
        Assert.Contains("--apply-sql-objects --yes", body);
        Assert.Contains("dbo.fProjectDeletionTier is missing", body);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public async Task Ready_RunsTheAction()
    {
        var context = ContextWith(new StubStatus { Ready = true });
        bool actionRan = false;

        await new RequiresDeletionObjectsAttribute().OnActionExecutionAsync(context, () =>
        {
            actionRan = true;
            return Task.FromResult<ActionExecutedContext>(null!);
        });

        Assert.True(actionRan);
        Assert.Null(context.Result);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    public void EveryActionThatUsesTheDeletionObjects_IsGuarded_AndNoOtherAction()
    {
        static IEnumerable<string> Guarded(Type controller) => controller
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttribute<RequiresDeletionObjectsAttribute>() != null)
            .Select(m => $"{controller.Name}.{m.Name}");

        var guarded = Guarded(typeof(ProgramController)).Concat(Guarded(typeof(LumpsumController))).OrderBy(x => x).ToArray();

        Assert.Equal(new[]
        {
            "LumpsumController.DeleteItemizedProject",
            "LumpsumController.DeleteLumpSum",
            "ProgramController.BatchAddExistingProject",
            "ProgramController.BatchDelete",
            "ProgramController.DeleteProgram",
            "ProgramController.PreviewBatchDelete",
        }, guarded);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public void Status_IsRegistered_AndStartingTheTestHostOpensNoConnection()
    {
        // Under the Testing environment Program.cs skips the startup probe, so constructing the host
        // must not need (or dial) a database; the status still resolves for the filter.
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureAppConfiguration((_, configuration) =>
                {
                    configuration.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Testing:DisableHangfire"] = "true",
                        ["Testing:DisablePdfNativeLibrary"] = "true"
                    });
                });
            });

        var status = factory.Services.GetRequiredService<IDeletionObjectsStatus>();
        Assert.IsType<DeletionObjectsStatus>(status);
        Assert.Equal("not checked yet", status.Problem);
    }
}
