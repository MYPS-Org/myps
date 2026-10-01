using DBHelper.Data;
using DinkToPdf.Contracts;
using DinkToPdf;
using Helpers;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using System.Runtime.Loader;
using Hangfire;
using WebAPI.Services.Revision;

namespace Main
{
    public static class ServiceRegistration
    {
        #region Builder
        public static IServiceCollection PrepareDatabaseConnection(
            this IServiceCollection Services,
            bool startHangfireServer = true)
        {
            // Pooled registration also provides IDbContextFactory<MYPSDbContext> for
            // short-lived, read-only contexts used to run independent lookup queries
            // concurrently (a single DbContext instance cannot be used by more than one
            // operation at a time, so Task.WhenAll needs one context each). Registering
            // AddDbContext and AddPooledDbContextFactory separately for the same context
            // type conflicts (scoped DbContextOptions vs singleton pool), so this single
            // AddDbContextPool call covers both the scoped injection and the factory.
            Services.AddDbContextPool<MYPSDbContext>(options => {
                options.UseSqlServer(
                    Appsetting.DbConnections.MYPSDb,
                    sqlServerOptions => sqlServerOptions.CommandTimeout(90)
                );
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

            if (startHangfireServer)
            {
                Services.AddHangfireServer();
            }

            Services.AddSingleton<ISqlExecutor>(new SqlExecutor());
            return Services;
        }
        public static IServiceCollection AddCookieAuthentication(this IServiceCollection Services)
        {
            Services.AddHttpContextAccessor();
            Services.AddScoped<IMYPSExceptionHandler, ExceptionHandler>();
            Services.AddScoped<IRevisionPcmaPublisher, RevisionPcmaPublisher>();
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
                    else // Staging and Production
                    {
                        // 2026-09-04: Production previously had its own, stricter branch here
                        // (SameSiteMode.Strict + CookieSecurePolicy.Always, HTTPS-only). That
                        // requires the app to see the request as HTTPS -- but UseHttpsRedirection()
                        // is commented out (Main/Program.cs) and no ForwardedHeaders middleware is
                        // registered, so behind a reverse proxy terminating TLS the app sees plain
                        // HTTP regardless of what the browser used, and CookieSecurePolicy.Always
                        // silently drops the auth cookie -- a confirmed, plausible root cause of
                        // production login failures presenting as "login succeeded, then bounced
                        // back to /login". Rather than guess at unconfirmed reverse-proxy topology,
                        // Production now uses the same policy as Staging (confirmed working):
                        // SameAsRequest adapts to whatever scheme the request actually arrives as.
                        // Revisit if Production's actual topology is later confirmed and
                        // ForwardedHeaders/UseHttpsRedirection are properly configured instead.
                        options.Cookie.SameSite = SameSiteMode.Lax;
                        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
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
        // NOTE 2026-09: not currently called from Program.cs — confirmed unreferenced as of this fix.
        public static async Task<IServiceCollection> AuthRolesBasedOnDbAsync(this IServiceCollection services, CancellationToken cancellationToken)
        {
            try
            {
                // Create temporary provider to fetch AppDbContext
                using (var serviceProvider = services.BuildServiceProvider())
                using (var scope = serviceProvider.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<MYPSDbContext>();
                    var roles = await db.tGroups.Select(r => r.GroupName).ToListAsync(cancellationToken);
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
                // Logging must never be why this method throws -- GetService, not GetRequiredService.
                using var serviceProvider = services.BuildServiceProvider();
                serviceProvider.GetService<ILoggerFactory>()
                    ?.CreateLogger("Main.AuthRolesBasedOnDbAsync")
                    .LogError(ex, "AuthRolesBasedOnDbAsync failed to build role-based authorization policies");
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
