using DBHelper.Data;
using Eaf.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Data;
using System.Security.Claims;

namespace WebAPI.Controllers
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public class PermissionFilter : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string? _controllerName;
        private readonly string? _actionName;

        // Use explicitly provided controller/action
        public PermissionFilter(string controllerName, string actionName)
        {
            _controllerName = controllerName;
            _actionName = actionName;
        }

        // Auto-detect controller/action from route
        public PermissionFilter()
        {
            _controllerName = null;
            _actionName = null;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            // 1. Get DbContext from DI
            bool hasAllowAnonymous = context.ActionDescriptor.EndpointMetadata
                .Any(meta => meta is AllowAnonymousAttribute);
            if (!hasAllowAnonymous)
            {
                var _db = context.HttpContext.RequestServices
                    .GetService<AppDbContext>();

                if (_db == null)
                {
                    context.Result = new ObjectResult(new
                    {
                        Message = "Authorization service is unavailable.",
                        Title = "Service Unavailable"
                    })
                    { StatusCode = 503 };
                    return;
                }

                // 2. Get UserId from claims
                var userId = context.HttpContext.User.FindFirstValue("UserId");// ?? "jimeneznr";
                if (string.IsNullOrWhiteSpace(userId))
                {
                    context.Result = new UnauthorizedObjectResult(new
                    {
                        Message = "You must be logged in to access this resource.",
                        Title = "Unauthorized"
                    });
                    return;
                }

                // 3. Resolve controller and action name
                var controllerName = _controllerName
                    ?? context.RouteData.Values["controller"]?.ToString() + "Controller";

                var actionName = _actionName
                    ?? context.RouteData.Values["action"]?.ToString();

                // 4. Check if user is active
                var isActive = await _db.vUsers
                    .AnyAsync(x => x.UserId == userId && x.IsActive);

                if (!isActive)
                {

                    var responseObj = new
                    {
                        Message = "Your account is inactive. Please contact your administrator.",
                        Title = "Access Denied",
                        data = new { Authenticated = false },
                        user = new { }
                    };
                    context.Result = new UnauthorizedObjectResult(responseObj);
                    return;
                }

                // 5. Check if user has permission for this controller and action
                var hasPermission = await _db.vUserActionPermission
                    .AnyAsync(x =>
                        x.UserId == userId &&
                        x.IsActive &&
                        x.PermissionController == controllerName &&
                        x.PermissionAction == actionName
                    );

                if (hasPermission)
                {
                    var responseObj = new
                    {
                        Message = $"You do not have permission to perform '{actionName}' on '{controllerName}'.",
                        Title = "Access Denied",
                        data = new { Authenticated = false },
                        user = new { }
                    };
                    context.Result = new UnauthorizedObjectResult(responseObj);
                    return;
                }
            }
        }
    }
}