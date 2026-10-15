namespace MYPS.ApiIntegrationTests;

/*  DEEP-PROTOCOL (2026-10-16): Main/Program.cs reads several config keys (ReportService:BaseUrl,
    Testing:DisableHangfire, Testing:DisablePdfNativeLibrary) directly off builder.Configuration
    BEFORE builder.Build() runs. WebApplicationFactory's own ConfigureAppConfiguration callback
    only applies ITS overrides AT Build() time -- too late for code that already ran during
    WebApplication.CreateBuilder() itself. Confirmed empirically while closing the HTTP
    integration test gap this session: the in-memory-collection pattern every existing
    WebApplicationFactory<Program> test in this project used (ApplicationFactorySmokeTests x2,
    RequiresDeletionObjectsTests x1) was silently ignored, and Program.cs threw its "missing"
    exception exactly as if nothing had been configured -- these were this project's 3
    pre-existing MYPS.ApiIntegrationTests failures, previously assumed unrelated/pre-existing
    and out of scope; this is their actual, now-understood root cause.

    Environment variables ARE visible at CreateBuilder() time (ASP.NET Core's default host
    configuration always calls AddEnvironmentVariables() before user code runs), so this is the
    one config source early enough to reach Program.cs's own eager reads. Call
    EnsureTestEnvironmentVariablesSet() once before constructing any WebApplicationFactory<Program>
    in this test assembly -- idempotent, safe to call from every test class independently. */
public static class TestHostEnvironment
{
    public static void EnsureTestEnvironmentVariablesSet()
    {
        Environment.SetEnvironmentVariable("ReportService__BaseUrl", "http://127.0.0.1:1");
        Environment.SetEnvironmentVariable("Testing__DisableHangfire", "true");
        Environment.SetEnvironmentVariable("Testing__DisablePdfNativeLibrary", "true");
    }
}
