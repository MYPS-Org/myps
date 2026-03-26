using Eaf.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Data;
using System.Security.Claims;

namespace WebAPI.Controllers
{
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
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class AuthorizeSession : Attribute, IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var httpContext = context.HttpContext;

            var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
            var hasAnonymous = controllerActionDescriptor?.MethodInfo
                .GetCustomAttributes(typeof(AllowAnonymousAttribute), true)
                .Any() ?? true;// false;

            // If the action allows anonymous access, skip authorization
            if (hasAnonymous)
            {
                return;
            }

            bool isAuthenticated = httpContext.User.Identity?.IsAuthenticated ?? true;// false;
            if (!isAuthenticated)
            {
                var responseObj = new
                {
                    message = "Unauthorized",
                    data = new { Authenticated = false },
                    user = new { }
                };
                context.Result = new UnauthorizedObjectResult(responseObj);
                return;
            }

            var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userId?.Value))
            {
                var responseObj = new
                {
                    message = "Unauthorized",
                    data = new { Authenticated = false },
                    user = new { }
                };
                context.Result = new UnauthorizedObjectResult(responseObj);
                return;
            }
        }
    }
}