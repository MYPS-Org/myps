using Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace WebAPI.Controllers
{
    /// <summary>
    /// Answers 503 when the delete feature cannot run on this server -- one of its SQL script files
    /// (Resources/Internal/SQLObjects/Functions, Stored Procedures) is missing from the build, or the
    /// database is unreachable or below compatibility level 130 -- instead of letting the action fail
    /// with a 500 on its first query. Put on every action that runs those scripts. Readiness comes from
    /// <see cref="IDeletionObjectsStatus"/>, which re-checks while not ready, so fixing the cause
    /// recovers these endpoints without restarting the API. What exactly is wrong goes to the API log
    /// (DeletionObjectsStatus), never to the response: it names server paths and SQL errors.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class RequiresDeletionObjectsAttribute : Attribute, IAsyncActionFilter
    {
        public const string Title = "Delete Unavailable";
        public const string Message =
            "The delete feature is unavailable on this server: its SQL script files are missing from the build, " +
            "or the database is unreachable or below compatibility level 130. Redeploy the build and check the API log.";

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var status = context.HttpContext.RequestServices.GetService<IDeletionObjectsStatus>();
            if (status != null && !await status.EnsureReadyAsync(context.HttpContext.RequestAborted))
            {
                context.Result = new ObjectResult(new { Title, Message })
                {
                    StatusCode = StatusCodes.Status503ServiceUnavailable
                };
                return;
            }
            await next();
        }
    }
}
