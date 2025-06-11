using DBHelper.Data;
using DBHelper.Models.Entities;
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

builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<UserManager<User>>();
builder.Services.AddScoped<RoleManager<IdentityRole>>();

builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
})
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();


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
        options.Cookie.HttpOnly = true; // Protect against XSS
        options.Cookie.SameSite = Appsetting.Environment != "Development" ? SameSiteMode.Strict : SameSiteMode.None; // Prevent CSRF attacks
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
    Options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
    Options.AddPolicy("Club", policy => policy.RequireRole("Club"));
    Options.AddPolicy("User", policy => policy.RequireRole("User"));
});
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseCors(builder => builder.WithOrigins("http://localhost:8080"));
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else { app.MapFallbackToFile("index.html"); }

app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
