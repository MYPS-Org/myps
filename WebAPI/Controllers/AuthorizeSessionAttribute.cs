using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace WebAPI.Controllers
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class AuthorizeSession : Attribute, IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var httpContext = context.HttpContext;

            var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
            var hasAnonymous = controllerActionDescriptor?.MethodInfo
                .GetCustomAttributes(typeof(AllowAnonymousAttribute), true)
                .Any() ?? false;

            bool isAuthenticated = httpContext.User.Identity?.IsAuthenticated ?? false;
            if (!hasAnonymous && isAuthenticated)
            {
                var userRoleClaim = httpContext.User.Claims
                    .FirstOrDefault(c => c.Type == ClaimTypes.Role);

                var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(userId?.Value))
                {
                    var responseObj = new
                    {
                        message = "Unauthorized",
                        data = new { Authenticated = false },
                        user = new { }
                    };
                    context.Result = new JsonResult(responseObj);
                    return;
                }
            }
        }
    }
}