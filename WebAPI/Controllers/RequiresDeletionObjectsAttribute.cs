using Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace WebAPI.Controllers
{
    /// <summary>
    /// Answers 503 when the deletion SQL objects this build needs are not deployed (or are an older
    /// version), instead of letting the action fail with a 500 on its first query. Put on every action
    /// that reads dbo.fProjectDeletionTier / dbo.fProgramDeletionEligibility or runs
    /// dbo.pExecuteProjectDeletion / dbo.pExecuteProgramDeletion. Readiness comes from
    /// <see cref="IDeletionObjectsStatus"/>, which re-checks the database while not ready, so applying
    /// the objects recovers these endpoints without restarting the API.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class RequiresDeletionObjectsAttribute : Attribute, IAsyncActionFilter
    {
        public const string Title = "Delete Unavailable";
        public const string Message =
            "Database objects for deletion are not deployed on this environment. " +
            "Run Main.exe --apply-sql-objects --yes, then try again.";

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var status = context.HttpContext.RequestServices.GetService<IDeletionObjectsStatus>();
            if (status != null && !await status.EnsureReadyAsync(context.HttpContext.RequestAborted))
            {
                context.Result = new ObjectResult(new { Title, Message, Detail = status.Problem })
                {
                    StatusCode = StatusCodes.Status503ServiceUnavailable
                };
                return;
            }
            await next();
        }
    }
}
