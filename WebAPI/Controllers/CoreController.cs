using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace WebAPI.Controllers
{
    [AuthorizeSession]
    public abstract class CoreController : Controller
    {
        public AppDbContext _db;
        public Users _Session = new Users();
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
                string userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
                if (!hasAllowAnonymous || IsAuthenticated || !string.IsNullOrEmpty(userId))
                {
                    var user = _db.tUsers.FirstOrDefault(x => x.UserId == userId && x.IsActive == true);
                    if(user == null)
                    {
                        context.Result = UnauthorizedUser();
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
        [NonAction]
        public BadRequestObjectResult ExceptionHandler(Exception ex)
        {
            Guid errorReferenceId = Guid.NewGuid();
            try
            {
                string message = $"\n\n/========================= MYPS ERROR EVENT STARTS HERE =========================/" +
                    $"\n\n[{errorReferenceId}] \n\nMessage: {ex.Message}\n\nStackRace:{ex.StackTrace}\n\n" +
                    $"/========================= MYPS ERROR EVENT ENDS HERE =========================/\n\n";
                EventLog.WriteEntry("Application", message, EventLogEntryType.Error);
                string ErrorId = errorReferenceId.ToString();
                return new BadRequestObjectResult(
                    new
                    {
                        ErrorId = ErrorId,
                        Message = ex.Message,
                        Title = "Application Error"
                    }
                );
            }
            catch (Exception)
            {
                return new BadRequestObjectResult(
                    new
                    {
                        ErrorId = "No ErrorId",
                        Message = ex.Message,
                        Title = "Application Error"
                    }
                );
            }
        }

        [NonAction]
        public IActionResult UnauthorizedUser()
        {
            var responseObj = new
            {
                Message = "Unauthorized",
                Data = new { Authenticated = false, User = new { } },

            };
            return Unauthorized(responseObj);
        }
    }
}
