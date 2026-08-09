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
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq.Expressions;
using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using WebAPI.MicroService;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace WebAPI.Controllers
{
    [PermissionFilter]
    public abstract class CoreController : Controller
    {
        public MYPSDbContext _db;   
        public PCMADbContext _pcma;
        public DBHelper.Models.Views.Users _Session = new DBHelper.Models.Views.Users();
        public IHubContext<SignalRHub> _hubContext;
        protected readonly IMYPSExceptionHandler _exceptionHandler;
        public CoreController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler)
        {
            _db = db;
            _hubContext = hub;
            _pcma = pcma;
            _exceptionHandler = exceptionHandler;
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
