using Hangfire.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MYPS.ApiIntegrationTests;

public sealed class ApplicationFactorySmokeTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    public void ApplicationFactory_CanBeConstructedWithExternalWorkersDisabled()
    {
        // 2026-10-16 FIX: this test previously threw at WebApplicationFactory construction
        // ("Configuration 'ReportService:BaseUrl' is missing") -- Main/Program.cs reads that
        // key off builder.Configuration BEFORE builder.Build() runs, but
        // ConfigureAppConfiguration's override below only applies AT Build() time, too late.
        // See TestHostEnvironment.cs for the full explanation; this is the actual root cause
        // of what had been treated as a pre-existing, unrelated failure.
        TestHostEnvironment.EnsureTestEnvironmentVariablesSet();
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });
        Assert.NotNull(factory.Services);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public void HangfireJobServices_ResolveWithIMYPSExceptionHandlerDependency()
    {
        // Proves ReportJobService/ImportProjectJobService's new IMYPSExceptionHandler constructor
        // parameter resolves cleanly under the same DI scoping Hangfire's own AspNetCoreJobActivator
        // uses (fresh IServiceScope per job) -- without needing a live Hangfire job run.
        // See the sibling test above for why TestHostEnvironment is needed here.
        TestHostEnvironment.EnsureTestEnvironmentVariablesSet();
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });

        using var scope = factory.Services.CreateScope();

        var reportJobService = scope.ServiceProvider.GetRequiredService<ReportJobService>();
        Assert.NotNull(reportJobService);

        // Not directly registered in DI (Hangfire's activator resolves it via
        // ActivatorUtilities too), so mirror that resolution path here.
        var importProjectJobService = ActivatorUtilities.CreateInstance<ImportProjectJobService>(scope.ServiceProvider);
        Assert.NotNull(importProjectJobService);
    }
}
