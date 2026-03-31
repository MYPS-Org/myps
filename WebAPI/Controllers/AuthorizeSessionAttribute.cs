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
                var userId = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "jimeneznr";
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
                var isActive = await _db.vUserActionPermission
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

                if (!hasPermission)
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
    // PermissionAuthorizeAttribute.cs
    //[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    //public class PermissionAuthorizeAttribute : TypeFilterAttribute
    //{
    //    public PermissionAuthorizeAttribute(string action)
    //        : base(typeof(PermissionFilter))
    //    {
    //        Arguments = new object[] { action };
    //    }
    //}// PermissionFilter.cs
    //public class PermissionFilter : IAsyncAuthorizationFilter
    //{
    //    private readonly string _action;
    //    private readonly IDbConnection _db; // or your DbContext

    //    public PermissionFilter(string action, IDbConnection db)
    //    {
    //        _action = action;
    //        _db = db;
    //    }

    //    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    //    {
    //        var userId = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    //        if (string.IsNullOrEmpty(userId))
    //        {
    //            context.Result = new UnauthorizedResult();
    //            return;
    //        }

    //        // Get the controller name from the route
    //        var controllerName = context.RouteData.Values["controller"]?.ToString();

    //        var hasPermission = await _db.QueryFirstOrDefaultAsync<int?>(
    //            @"SELECT 1 FROM tUserPermissions up
    //          INNER JOIN tPermissionActions pa ON pa.Id = up.ActionId
    //          WHERE up.UserId = @UserId
    //            AND pa.ControllerName = @Controller
    //            AND pa.ActionName = @Action",
    //            new { UserId = userId, Controller = controllerName, Action = _action }
    //        );

    //        if (hasPermission == null)
    //        {
    //            context.Result = new ForbidResult();
    //        }
    //    }
    //}
    //[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    //public class AuthorizeSession : Attribute, IAuthorizationFilter
    //{
    //    public void OnAuthorization(AuthorizationFilterContext context)
    //    {
    //        var httpContext = context.HttpContext;

    //        var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
    //        var hasAnonymous = controllerActionDescriptor?.MethodInfo
    //            .GetCustomAttributes(typeof(AllowAnonymousAttribute), true)
    //            .Any() ?? true;// false;

    //        // If the action allows anonymous access, skip authorization
    //        if (hasAnonymous)
    //        {
    //            return;
    //        }

    //        bool isAuthenticated = httpContext.User.Identity?.IsAuthenticated ?? true;// false;
    //        if (!isAuthenticated)
    //        {
    //            var responseObj = new
    //            {
    //                message = "Unauthorized",
    //                data = new { Authenticated = false },
    //                user = new { }
    //            };
    //            context.Result = new UnauthorizedObjectResult(responseObj);
    //            return;
    //        }

    //        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
    //        if (string.IsNullOrWhiteSpace(userId?.Value))
    //        {
    //            var responseObj = new
    //            {
    //                message = "Unauthorized",
    //                data = new { Authenticated = false },
    //                user = new { }
    //            };
    //            context.Result = new UnauthorizedObjectResult(responseObj);
    //            return;
    //        }
    //    }
    //}
}