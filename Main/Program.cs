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
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle

await builder.Services.AuthRolesBasedOnDbAsync();

builder.Services.AddEndpointsApiExplorer();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp", builder =>
        {
            builder.SetIsOriginAllowed(origin => true) // Allow any origin
                    //WithOrigins("http://localhost:8080","http://myps.eptisa-dev.com")
                   .AllowCredentials()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
    });

    builder.Services.AddDevSwagger();
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowReactApp");
    app.UseDeveloperExceptionPage();
    app.AddDevSwaggerUI();
}
else { app.MapFallbackToFile("index.html"); }

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
app.Run();
