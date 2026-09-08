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
        Assert.NotNull(factory.Services);
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    public void HangfireJobServices_ResolveWithIMYPSExceptionHandlerDependency()
    {
        // Proves ReportJobService/ImportProjectJobService's new IMYPSExceptionHandler constructor
        // parameter resolves cleanly under the same DI scoping Hangfire's own AspNetCoreJobActivator
        // uses (fresh IServiceScope per job) -- without needing a live Hangfire job run.
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

        using var scope = factory.Services.CreateScope();

        var reportJobService = scope.ServiceProvider.GetRequiredService<ReportJobService>();
        Assert.NotNull(reportJobService);

        // Not directly registered in DI (Hangfire's activator resolves it via
        // ActivatorUtilities too), so mirror that resolution path here.
        var importProjectJobService = ActivatorUtilities.CreateInstance<ImportProjectJobService>(scope.ServiceProvider);
        Assert.NotNull(importProjectJobService);
    }
}
