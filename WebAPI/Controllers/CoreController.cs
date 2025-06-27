using DBHelper.Data;
using DBHelper.Models.Table;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Diagnostics;
using System.Security.Claims;

namespace WebAPI.Controllers
{
    [AuthorizeSession]
    public abstract class CoreController : Controller
    {
        public AppDbContext _db;
        public User _Session = new User();
        public CoreController(AppDbContext db)
        {
            _db = db;
        }
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            try
            {
                var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
                bool hasAllowAnonymous = context.ActionDescriptor.EndpointMetadata
                    .Any(meta => meta is AllowAnonymousAttribute);

                bool IsAuthenticated = (HttpContext.User.Identity != null) ? HttpContext.User.Identity.IsAuthenticated : true;
                if (!hasAllowAnonymous && IsAuthenticated)
                {
                    string userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
                    var user = _db.tUsers.FirstOrDefault(x => x.Id.ToString() == userId && x.IsActive == true);
                    if(user == null)
                    {
                        var responseObj = new
                        {
                            message = "Unauthorized",
                            data = new { Authenticated = false },
                            user = new { }
                        };
                        context.Result = Unauthorized(responseObj);
                        return;
                    }
                    _Session = user;
                }

                base.OnActionExecuting(context);
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message);
            }
        }
        public string ExceptionHandler(Exception ex, string FunctionName)
        {
            Guid errorReferenceId = Guid.NewGuid();
            try
            {
                string message = $"/========================= ERROR EVENT STARTS HERE =========================/" +
                    $"\n\n[{errorReferenceId}] \n\nMessage: {ex.Message}\n\nStackRace:{ex.StackTrace}\n\n" +
                    $"/========================= ERROR EVENT ENDS HERE =========================/";
                EventLog.WriteEntry("Application", message, EventLogEntryType.Error);

                return errorReferenceId.ToString();
            }
            catch (Exception logEx)
            {
                // Consider logging to a fallback mechanism here
                return $"[{errorReferenceId}] Logging failed: {logEx.Message}\nOriginal error: {ex.Message}";
            }
        }
    }
}
