using DBHelper.Data;
using DBHelper.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
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

                //Check Authentication if Not AllowAnonymous
                bool IsAuthenticated = (HttpContext.User.Identity != null) ? HttpContext.User.Identity.IsAuthenticated : true;
                if (!hasAllowAnonymous && IsAuthenticated)
                {
                    string userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
                    var user = _db.tUsers.FirstOrDefault(x => x.Id.ToString() == userId && x.isActive == true);
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
    }
}
