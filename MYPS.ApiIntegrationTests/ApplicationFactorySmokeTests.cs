using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
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
}
