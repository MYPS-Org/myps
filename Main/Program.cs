using Hangfire;
using Hangfire.Hubs;
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

builder.Services.PrepareDatabaseConnection();

builder.Services.AddCookieAuthentication();

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

builder.Services.AddSocketMicroService();

builder.Services.AddDinkToPdf();

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
});


if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDevSwagger();
}


var app = builder.Build();


// ==========================================================
// DEVELOPMENT
// ==========================================================

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();

    app.AddDevSwaggerUI();

    app.UseHangfireDashboard("/hangfire");
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


// ==========================================================
// SPA
// ==========================================================

app.MapFallbackToFile("index.html");

app.Run();