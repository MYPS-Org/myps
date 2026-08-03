using DBHelper.Data;
using DinkToPdf.Contracts;
using DinkToPdf;
using Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using System.Runtime.Loader;
using Hangfire;

namespace Main
{
    public static class ServiceRegistration
    {
        #region Builder
        public static IServiceCollection PrepareDatabaseConnection(this IServiceCollection Services)
        {
            Services.AddDbContext<MYPSDbContext>(options => {
                options.UseSqlServer(Appsetting.DbConnections.MYPSDb);
                options.EnableSensitiveDataLogging();
                options.EnableDetailedErrors();
                options.LogTo(Console.WriteLine, LogLevel.Information);
            });
            Services.AddDbContext<PCMADbContext>(options => {
                options.UseSqlServer(Appsetting.DbConnections.PCMADb);
                options.EnableSensitiveDataLogging();
                options.EnableDetailedErrors();
                options.LogTo(Console.WriteLine, LogLevel.Information);
            });
            Services.AddHangfire(config => config
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()
                .UseSqlServerStorage(Appsetting.DbConnections.MYPSDb));

            Services.AddHangfireServer();

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
                    if (Appsetting.Environment == "Development")
                    {
                        options.Cookie.SameSite = SameSiteMode.Lax; // cross-origin localhost
                        options.Cookie.SecurePolicy = CookieSecurePolicy.None; // allow HTTP
                    }
                    else if (Appsetting.Environment == "Staging")
                    {
                        options.Cookie.SameSite = SameSiteMode.Lax;  // same domain
                        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                    }
                    else // Production
                    {
                        options.Cookie.SameSite = SameSiteMode.Strict;
                        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                    }


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
                            Message = "Unauthorized.",
                            data = new { Authenticated = false, user = new { } }
                        };

                        return context.Response.WriteAsJsonAsync(responseObj);
                    };
                });
            return Services;
        }
        public static async Task<IServiceCollection> AuthRolesBasedOnDbAsync(this IServiceCollection services)
        {
            try
            {
                // Create temporary provider to fetch AppDbContext
                using (var serviceProvider = services.BuildServiceProvider())
                using (var scope = serviceProvider.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<MYPSDbContext>();
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
            }
            catch (Exception ex)
            {
                return services;
            }
            return services;
        }
        public static IServiceCollection AddSocketMicroService(this IServiceCollection services)
        {
            //services.AddSingleton<IProducer<Null, string>>(sp =>
            //{
            //    var config = new ProducerConfig
            //    {
            //        BootstrapServers = Appsetting.KafkaConfigs.KafkaServer,
            //        Acks = Acks.All
            //    };
            //    return new ProducerBuilder<Null, string>(config).Build();
            //});
            ////services.AddHostedService<OrderWorker>();
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
