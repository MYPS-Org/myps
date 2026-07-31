using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Table;
using Helpers;
using Main;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using OfficeOpenXml;
using WebAPI.Controllers;
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
            //.WithOrigins("http://localhost:8080", "http://192.168.50.201:8080", "http://myps.eptisa-dev.com")
            .WithOrigins(
                "http://dpwh.eptisa-dev.com",
                "http://myps.eptisa-dev.com"
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
//SPA fallback
app.MapFallbackToFile("index.html");
app.MapHub<RegistrationHub>("/notificationHub").RequireCors("AllowReactApp");
app.Run();
