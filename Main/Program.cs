
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
string file = $"appsettings{(Appsetting.Environment == "Production" ? "." : $".{Appsetting.Environment}.")}json";
builder.Configuration.AddJsonFile(file, optional: true, reloadOnChange: true);
Appsetting.WebRootPath = builder.Environment.WebRootPath;
Appsetting.RootPath = builder.Environment.ContentRootPath;

Appsetting.PrepareAppsettings(builder.Configuration);
//Custom function in Services
builder.Services.PrepareDatabaseConnection();

//Custom function in Services
builder.Services.AddCookieAuthentication();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});

//Custom function in Services
builder.Services.AddSocketMicroService();

builder.Services.AddDinkToPdf();


//await builder.Services.AuthRolesBasedOnDbAsync();

builder.Services.AddEndpointsApiExplorer();

if (!builder.Environment.IsProduction())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp", builder =>
        {
            builder
            .WithOrigins(
                "http://dpwh.eptisa-dev.com",
                "http://myps.eptisa-dev.com",
                "http://localhost:8080"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
    });
    if(builder.Environment.IsDevelopment()) builder.Services.AddDevSwagger();
}
builder.Services.AddSignalR(opt =>
{
    opt.EnableDetailedErrors = true;
});

var app = builder.Build();

app.UseRouting();
if (!app.Environment.IsProduction())
{
    app.UseCors("AllowReactApp");
    if (builder.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
        app.AddDevSwaggerUI();
        app.UseHangfireDashboard("/hangfire"); // optional: remove in production
    }
}
app.UseStaticFiles(); // For wwwroot
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(Appsetting.RootPath, "Resources")),
    RequestPath = new PathString("/Resources"),
    ContentTypeProvider = new FileExtensionContentTypeProvider()
});
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
var registrationHub = app.MapHub<SignalRHub>("/notificationHub");
var importHub = app.MapHub<ImportHub>("/hubs/import");
if (!app.Environment.IsProduction())
{
    registrationHub.RequireCors("AllowReactApp");
    importHub.RequireCors("AllowReactApp");
}
//SPA fallback
app.MapFallbackToFile("index.html");
app.Run();
