using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Table;
using DinkToPdf.Contracts;
using DinkToPdf;
using Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Runtime.InteropServices;
using System.Runtime.Loader;

namespace Main
{
    public static class ServiceRegistration
    {
        #region Builder
        public static IServiceCollection PrepareDatabaseConnection(this IServiceCollection Services)
        {
            Services.AddDbContext<AppDbContext>(options => {
                options.UseSqlServer(Appsetting.ConnectionString);
                options.EnableSensitiveDataLogging();
                options.EnableDetailedErrors();
                options.LogTo(Console.WriteLine, LogLevel.Information);
            });

            return Services;
        }
        public static IServiceCollection AddCookieAuthentication(this IServiceCollection Services)
        {
            Services.AddHttpContextAccessor();
            Services.AddDistributedMemoryCache();
            Services.AddAuthentication(options =>
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
                    options.ExpireTimeSpan = TimeSpan.FromHours(8); // Make session persistent
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
            Services.AddAuthorization(Options =>
            {
                Options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
                Options.AddPolicy("Club", policy => policy.RequireRole("Club"));
                Options.AddPolicy("User", policy => policy.RequireRole("User"));
            });
            return Services;
        }
        public static async Task<IServiceCollection> AuthRolesBasedOnDbAsync(this IServiceCollection services)
        {
            // Create temporary provider to fetch AppDbContext
            using (var serviceProvider = services.BuildServiceProvider())
            using (var scope = serviceProvider.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var roles = await db.tGroups.Select(r => r.GroupName).ToListAsync();
                if (roles != null)
                {
                    services.AddAuthorization(options =>
                    {
                        foreach (var role in roles)
                        {
                            options.AddPolicy(role!, policy => policy.RequireRole(role!));
                        }
                    });

                }
            }
            return services;
        }
        public static IServiceCollection AddSocketMicroService(this IServiceCollection services)
        {
            services.AddSingleton<IProducer<Null, string>>(sp =>
            {
                var config = new ProducerConfig
                {
                    BootstrapServers = Appsetting.KafkaConfigs.KafkaServer,
                    Acks = Acks.All
                };
                return new ProducerBuilder<Null, string>(config).Build();
            });
            //services.AddHostedService<OrderWorker>();
            return services;
        }
        public static IServiceCollection AddDinkToPdf(this IServiceCollection services)
        {
            // Load the native library manually
            var context = new CustomAssemblyLoadContext();
            var wkHtmlToPdfPath = Path.Combine(AppContext.BaseDirectory, "libwkhtmltox.dll");
            
            // Load the DLL if it exists
            if (File.Exists(wkHtmlToPdfPath))
            {
                context.LoadUnmanagedLibrary(wkHtmlToPdfPath);
            }
            else
            {
                throw new FileNotFoundException($"libwkhtmltox.dll not found at: {wkHtmlToPdfPath}");
            }

            services.AddSingleton(typeof(IConverter), new SynchronizedConverter(new PdfTools()));
            return services;
        }

        internal class CustomAssemblyLoadContext : AssemblyLoadContext
        {
            public IntPtr LoadUnmanagedLibrary(string absolutePath)
            {
                return LoadUnmanagedDll(absolutePath);
            }

            protected override IntPtr LoadUnmanagedDll(string unmanagedDllName)
            {
                return LoadUnmanagedDllFromPath(unmanagedDllName);
            }

            protected override System.Reflection.Assembly? Load(System.Reflection.AssemblyName assemblyName)
            {
                return null;
            }
        }
        #endregion
        #region
        public static IServiceCollection AddDevSwagger(this IServiceCollection Services)
        {
            Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
                {
                    Title = "MyPS Backend Development API",
                    Version = "v1",
                    Description = "API for MyPS Backend Development Stage"
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
            return Services;
        }
        public static IApplicationBuilder AddDevSwaggerUI(this IApplicationBuilder app)
        {
            app.UseSwagger();
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "MyPS Backend API v1");
                options.RoutePrefix = "swagger";
                options.ConfigObject.AdditionalItems["withCredentials"] = true;
                options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);
                options.DefaultModelsExpandDepth(-1);
            });
            return app;
        }
        #endregion
    }
}
