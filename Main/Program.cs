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
builder.Services.AddHttpClient("ReportService", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["ReportService:BaseUrl"]!);
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
// STATIC FILES
// ==========================================================

app.UseStaticFiles();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Appsetting.RootPath, "Resources")),

    RequestPath = new PathString("/Resources"),

    ContentTypeProvider = new FileExtensionContentTypeProvider()
});


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
