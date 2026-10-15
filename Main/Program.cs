using Hangfire;
using Hangfire.Hubs;
using Hangfire.Services;
using Helpers;
using Main;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using OfficeOpenXml;
using WebAPI.MicroService;

var builder = WebApplication.CreateBuilder(args);

ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

Appsetting.Environment = builder.Environment.EnvironmentName;

string file =
    $"appsettings{(Appsetting.Environment == "Production"
        ? "."
        : $".{Appsetting.Environment}.")}json";

builder.Configuration.AddJsonFile(
    file,
    optional: true,
    reloadOnChange: true);

Appsetting.WebRootPath = builder.Environment.WebRootPath;
Appsetting.RootPath = builder.Environment.ContentRootPath;

Appsetting.PrepareAppsettings(builder.Configuration);

// `Main --apply-sql-objects [--yes]`: apply Resources/Internal/SQLObjects to MYPSDb and exit,
// before any service (Hangfire, SignalR, Kestrel) is registered. See Helpers/SqlObjectDeployer.cs.
if (args.Contains(SqlObjectDeployer.CommandFlag))
{
    Environment.ExitCode = await SqlObjectDeployer.RunCommandAsync(args, Console.Out);
    return;
}


// ==========================================================
// SERVICES
// ==========================================================

builder.Services.PrepareDatabaseConnection(
    startHangfireServer: !builder.Configuration.GetValue<bool>("Testing:DisableHangfire"));

builder.Services.AddCookieAuthentication();

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

builder.Services.AddSocketMicroService();

if (!builder.Configuration.GetValue<bool>("Testing:DisablePdfNativeLibrary"))
{
    builder.Services.AddDinkToPdf();
}

builder.Services.AddEndpointsApiExplorer();


// ==========================================================
// CORS
// DO NOT put this inside !IsProduction() for now.
// ==========================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:8080",
                "https://localhost:8080",

                "http://dpwh.eptisa-dev.com",
                "https://dpwh.eptisa-dev.com",

                "http://myps.eptisa-dev.com",
                "https://myps.eptisa-dev.com"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});


// ==========================================================
// SIGNALR
// ==========================================================

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
})
    // SignalR's JsonHubProtocol camelCases property names by default, independent of
    // the AddControllers().AddJsonOptions(...) override above. Match that override so
    // hub payloads (e.g. ImportHub's ImportStatusChanged) use the same PascalCase field
    // names as every REST DTO in this app instead of a second, inconsistent casing.
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = null;
    });


if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDevSwagger();
}

// Named HttpClient for the CrystalReportService microservice
// Validated eagerly at startup rather than left to throw lazily the first time a PDF report job
// calls CreateClient("ReportService") -- that deferred failure previously surfaced only as a
// generic "report generation failed" toast with no indication the server was ever misconfigured.
var reportServiceBaseUrl = builder.Configuration["ReportService:BaseUrl"];
if (string.IsNullOrWhiteSpace(reportServiceBaseUrl))
{
    throw new InvalidOperationException(
        $"Configuration 'ReportService:BaseUrl' is missing in the '{builder.Environment.EnvironmentName}' environment. " +
        "It is required for PDF report generation (RBP/AIP/RBP Summary reports call the CrystalReportService at this URL) " +
        "-- set it in the matching appsettings.{Environment}.json or via an environment variable before starting the app.");
}

builder.Services.AddHttpClient("ReportService", client =>
{
    client.BaseAddress = new Uri(reportServiceBaseUrl);
    client.Timeout = TimeSpan.FromMinutes(10); // report rendering can be slow
});

builder.Services.AddScoped<IExcelReportGenerator, ExcelReportGenerator>();

// Hangfire job service
builder.Services.AddTransient<ReportJobService>();

var app = builder.Build();

// 2026-09-04: APIRequest is a static helper with no DI of its own -- this is the minimal way
// to route its diagnostics through the same ILogger pipeline ExceptionHandler uses, instead of
// Console.WriteLine, which never reached the same log sink as the "MYPS ERROR EVENT" reports.
APIRequest.Logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Helpers.APIRequest");

// 2026-10-15: check once at startup whether the deletion SQL objects this build needs are deployed,
// so a release that skipped `Main.exe --apply-sql-objects --yes` is visible in the log immediately.
// Never fatal: only the delete endpoints answer 503 until it is ready ([RequiresDeletionObjects]),
// and they re-check on their own, so applying the objects later needs no restart.
// Skipped under the Testing environment: its connection string falls back to the base
// appsettings.json, and a test host must not open a connection just by starting.
if (!app.Environment.IsEnvironment("Testing"))
{
    _ = app.Services.GetRequiredService<IDeletionObjectsStatus>().EnsureReadyAsync();
}


// ==========================================================
// DEVELOPMENT
// ==========================================================

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();

    app.AddDevSwaggerUI();

    if (!builder.Configuration.GetValue<bool>("Testing:DisableHangfire"))
    {
        app.UseHangfireDashboard("/hangfire");
    }
}


// ==========================================================
// STATIC FILES -- SPA shell only. Stays public and stays first: the React app's own
// bundled JS/CSS/index.html must be reachable before login, or nobody could even load
// the login page. The /Resources-scoped mapping (uploaded documents) moved below,
// after authentication -- see the note there for why.
// ==========================================================

app.UseStaticFiles();


// ==========================================================
// ROUTING
// ==========================================================

app.UseRouting();


// ==========================================================
// CORS
//
// IMPORTANT:
// Routing -> CORS -> Authentication -> Authorization
// ==========================================================

app.UseCors("AllowReactApp");


// ==========================================================
// HTTPS
// ==========================================================

//app.UseHttpsRedirection();


// ==========================================================
// AUTHENTICATION
// ==========================================================

app.UseAuthentication();

app.UseAuthorization();


// ==========================================================
// /RESOURCES STATIC FILES -- gated behind authentication
//
// 2026-09-11 fix: this mapping used to run before UseAuthentication/UseAuthorization
// (up with the SPA-shell block above), which meant every uploaded document --
// Supporting Docs, Project Notes, Revision documents -- was served to anyone, no login
// required, at a deterministic path. Moving it after UseAuthentication alone is not
// enough: static-file middleware doesn't consult auth state on its own, it just matches
// a path and serves the file. The explicit check below is what actually closes the gap.
// Cookie auth means an already-logged-in browser keeps working with no FE change --
// only anonymous access is blocked.
// ==========================================================

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/Resources") && context.User.Identity?.IsAuthenticated != true)
    {
        context.Response.StatusCode = 401;
        return;
    }
    await next();
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Appsetting.RootPath, "Resources")),

    RequestPath = new PathString("/Resources"),

    ContentTypeProvider = new FileExtensionContentTypeProvider()
});


// ==========================================================
// ENDPOINTS
// ==========================================================

app.MapControllers();

app.MapHub<SignalRHub>("/notificationHub");

app.MapHub<ImportHub>("/hubs/import");

app.MapHub<ReportHub>("/hubs/report");


// ==========================================================
// SPA
// ==========================================================

app.MapFallbackToFile("index.html");

app.Run();

// Exposes the top-level entry point to WebApplicationFactory without changing
// the application's runtime behavior.
public partial class Program { }
