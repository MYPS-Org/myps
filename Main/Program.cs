using DBHelper.Data;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

Appsetting.Environment = builder.Environment.EnvironmentName;
string file = $"appsettings{(Appsetting.Environment == "Production" ? "." : $".{Appsetting.Environment}.")}json";
builder.Configuration.AddJsonFile(file, optional: true, reloadOnChange: true);

Appsetting.PrepareAppsettings(builder.Configuration);
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(Appsetting.ConnectionString));

builder.Services.AddScoped<IPasswordHasher<Users>, PasswordHasher<Users>>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = builder.Environment.IsDevelopment() ? false : true; // Protect against XSS // FALSE 
        options.Cookie.SameSite = builder.Environment.IsDevelopment() ? SameSiteMode.None : SameSiteMode.Strict; // Prevent CSRF attacks
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Ensure secure transport
        options.Cookie.Name = CookieAuthenticationDefaults.AuthenticationScheme; // Custom cookie name
                                                                                 //options.LoginPath = "/login"; // Redirect unauthorized users
                                                                                 //options.AccessDeniedPath = "/login"; // Handle forbidden access
        options.Cookie.IsEssential = true; // Ensures cookie is stored even without user consent
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromSeconds(10); // Make session persistent
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";

            var responseObj = new
            {
                message = "Unauthorized",
                data = new { Authenticated = false, user = new { } }
            };

            return context.Response.WriteAsJsonAsync(responseObj);
        };
    });
builder.Services.AddAuthorization(Options =>
{
    Options.AddPolicy("User Management", policy => policy.RequireRole("Admin"));
    Options.AddPolicy("Club", policy => policy.RequireRole("Club"));
    Options.AddPolicy("User", policy => policy.RequireRole("User"));
});
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp", builder =>
        {
            builder.WithOrigins("http://localhost:8080")
                   .AllowCredentials()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
    });
    
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
        {
            Title = "MyPS Backend API",
            Version = "v1",
            Description = "API for MyPS Backend Application"
        });
        
        // Include XML comments
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
        {
            options.IncludeXmlComments(xmlPath);
        }
        
        options.AddSecurityDefinition("cookieAuth", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
            Name = "Cookie",
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Description = "Session-based authentication using cookies."
        });

        options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference
                    {
                        Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                        Id = "cookieAuth"
                    }
                },
                new string[] { }
            }
        });
    });
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowReactApp");
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "MyPS Backend API v1");
        options.RoutePrefix = "swagger";
        options.ConfigObject.AdditionalItems["withCredentials"] = true;
        options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);
        options.DefaultModelsExpandDepth(-1);
    });
}
else { app.MapFallbackToFile("index.html"); }

app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowReactApp");
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
