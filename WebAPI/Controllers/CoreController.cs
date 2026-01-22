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
    [AuthorizeSession]
    public abstract class CoreController : Controller
    {
        public AppDbContext _db;
        public DBHelper.Models.Views.Users _Session = new DBHelper.Models.Views.Users();
        private readonly IProducer<Null, string> _producer;
        public CoreController(AppDbContext db, IProducer<Null, string> producer)
        {
            _db = db;
            _producer = producer;
        }
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            try
            {
                if (context.ModelState.Root.ValidationState == ModelValidationState.Unvalidated)
                {
                    string errors = ValidateModel(context.ModelState);
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
                var controllerActionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
                bool hasAllowAnonymous = context.ActionDescriptor.EndpointMetadata
                    .Any(meta => meta is AllowAnonymousAttribute);

                bool IsAuthenticated = (HttpContext.User.Identity != null) ? HttpContext.User.Identity.IsAuthenticated : true;
                string userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "jimeneznr";
                if (!hasAllowAnonymous || IsAuthenticated || !string.IsNullOrEmpty(userId))
                {
                    var user = _db.vUsers.FirstOrDefault(x => x.UserId == userId && x.IsActive == true);
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
        public string ValidateModel(ModelStateDictionary ModelState)
        {
            var messages = new List<string>();

            foreach (var entry in ModelState.Where(ms => ms.Value.Errors.Count > 0))
            {
                string key = entry.Key;
                var errors = entry.Value!.Errors;

                foreach (var error in errors)
                {
                    var match = Regex.Match(key, @"^(\w+)\[(\d+)\]\.(\w+)$");

                    if (match.Success)
                    {
                        string collection = match.Groups[1].Value;
                        int index = int.Parse(match.Groups[2].Value);
                        string property = match.Groups[3].Value;

                        messages.Add($"{collection} {(index + 1).ToOrdinal()} row: {error.ErrorMessage}");
                    }
                    else
                    {
                        messages.Add($"{key}: {error.ErrorMessage}");
                    }
                }
            }

            return string.Join("\n", messages);
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
        private static readonly ConcurrentDictionary<string, LambdaExpression> _orderLambdaCache = new(StringComparer.OrdinalIgnoreCase);
        // Builds (T e) => e.<SortField> with proper underlying type (no object boxing)
        public static LambdaExpression GetOrderByLambda<T>(string sortField)
        {
            return _orderLambdaCache.GetOrAdd($"{typeof(T).FullName}.{sortField}", _ =>
            {
                var param = Expression.Parameter(typeof(T), "e");
                var body = Expression.PropertyOrField(param, sortField);
                var delegateType = typeof(Func<,>).MakeGenericType(typeof(T), body.Type);
                return Expression.Lambda(delegateType, body, param);
            });
        }
    }
}
