using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using System.Web.Http.ExceptionHandling;
using CrystalReportService.Diagnostics;

namespace CrystalReportService
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // Web API configuration and services

            // Catch-all diagnostic logging for anything CrystalReportRenderer's own instrumented
            // catch blocks don't cover (an unknown report name, or a genuinely unexpected failure
            // outside the renderer entirely). Services.Add appends a logger rather than replacing
            // the default pipeline -- this slot was previously empty.
            config.Services.Add(typeof(IExceptionLogger), new ReportExceptionLogger());

            // Web API routes
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
        }
    }
}
