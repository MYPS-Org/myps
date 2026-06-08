using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq.Expressions;
using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using static Confluent.Kafka.ConfigPropertyNames;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace WebAPI.Controllers
{
    [PermissionFilter]
    public abstract class CoreController : Controller
    {
        public MYPSDbContext _db;
        public PCMADbContext _pcma;
        public DBHelper.Models.Views.Users _Session = new DBHelper.Models.Views.Users();
        private readonly IProducer<Null, string> _producer;
        public CoreController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma)
        {
            _db = db;
            _producer = producer;
            _pcma = pcma;
        }
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            try
            {
                if (context.ModelState.Root.ValidationState == ModelValidationState.Unvalidated)
                {
                    string errors = context.ModelState.ValidateModel();
                    if (!string.IsNullOrEmpty(errors))
                    {
                        var response = new
                        {
                            status = 400,
                            Title = "Validation failed",
                            Message = errors
                        };
                        context.Result = new BadRequestObjectResult(response);
                    }
                }
                //var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
                bool hasAllowAnonymous = context.ActionDescriptor.EndpointMetadata
                    .Any(meta => meta is AllowAnonymousAttribute);

                bool IsAuthenticated = (HttpContext.User.Identity != null) ? HttpContext.User.Identity.IsAuthenticated : true;
                /*
                    DPC: macatangayac
                    RPC: olegalml
                    AUC: jimeneznr
                 */
                string userId = User.FindFirstValue(ClaimTypes.NameIdentifier);// ?? "jimeneznr";
                if (!hasAllowAnonymous || IsAuthenticated || !string.IsNullOrEmpty(userId))
                {
                    var user = _db.vUsers.FirstOrDefault(x => x.UserId == userId && x.IsActive == true);
                    if(user == null)
                    {
                        context.Result = UnauthorizedUser("Your session has expired. Please sign in to continue.");
                        return;
                    }
                    _Session = user;
                    string HostName = User.FindFirstValue("HostName")!;
                    if (Appsetting.Environment != "Development" && string.IsNullOrEmpty(HostName))
                    {
                        var response = new
                        {
                            status = 401,
                            Title = "Invalid hostname",
                            Message = "Hostname not found in the ip, make sure your working pc is under the organization domain."
                        };
                        context.Result = new UnauthorizedObjectResult(response);
                    }
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
                string Header = "\n\n/========================= MYPS ERROR EVENT STARTS HERE =========================/\n\n";
                string Body = $"[{errorReferenceId}]\n\nException: [[EXCEPTION]]\n\n";
                string Footer = "/========================= MYPS ERROR EVENT ENDS HERE =========================/\n\n";
                if (ex is DbUpdateException dbEx)
                {
                    Body = Body.Replace("[[EXCEPTION]]", dbEx.ToString());
                }
                else
                {
                    Body = Body.Replace("[[EXCEPTION]]", ex.ToString());
                }
                
                string Message = Header + Body + Footer;

                EventLog.WriteEntry("Application", Message, EventLogEntryType.Error);
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
        public IActionResult UnauthorizedUser(string UnauthMessage = "Unauthorized.")
        {
            var responseObj = new
            {
                Message = UnauthMessage,
                Data = new { Authenticated = false, User = new { } },
                Redirect = "/login"
            };
            return Unauthorized(responseObj);
        }
    }
}
