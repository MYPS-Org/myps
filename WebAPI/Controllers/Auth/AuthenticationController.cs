using DBHelper.Data;
using DBHelper.Models.Table;
using Helpers;
using Helpers.API;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Configuration;
using System.Net;
using System.Security.Claims;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Auth
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        public AuthController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base (db, hub, pcma, exceptionHandler) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> Login([FromBody] LoginDto dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            var LoginLog = new LoginHistory();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                var ipAddress = HttpContext.Connection.RemoteIpAddress;
                string clientIp = ipAddress?.IsIPv4MappedToIPv6 == true
                    ? ipAddress.MapToIPv4().ToString()
                    : ipAddress?.ToString() ?? "Unknown";
                string hostName = string.Empty;
                try
                {
                    var hostEntry = await Dns.GetHostEntryAsync(ipAddress!);
                    hostName = hostEntry.HostName.Replace(".","-");
                }
                catch
                {
                    hostName = dto.UserName;//clientIp;
                }
                LoginLog = new LoginHistory()
                {
                    UserId = dto.UserName,
                    IpAddress = clientIp,
                    HostName = hostName,
                    LogDate = CurrentDate,
                    IsValid = false,
                };
                var verifyAccount = await _db.vUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserName);

                if (verifyAccount == null)
                {
                    // 2026-09-04: restored -- an in-between edit removed this early return, which
                    // let execution fall through into the PIS call and, if PIS/BypassLogin still
                    // reported "Valid Login" for a username with no active vUsers row, crashed with
                    // a NullReferenceException on verifyAccount.UserId below (GAP-11). Every
                    // bad-username/inactive-account attempt -- including brute-force/enumeration
                    // attempts -- must still leave an audit trail, so the write stays here too.
                    LoginLog.ValidationMessage = "Account not found.";
                    _db.tLoginHistory.Add(LoginLog);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                    return UnauthorizedUser("Unable to sign in. Please verify your User ID and password and try again.");
                }
                if(!verifyAccount.IsActive)
                {
                    LoginLog.ValidationMessage = "Account is inactive.";
                    _db.tLoginHistory.Add(LoginLog);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                    return UnauthorizedUser($"{LoginLog.ValidationMessage}. Please contact your administrator. ");
                }
                // 2026-10-29: LocalLogin (the MonsterASP test site) checks the password against the
                // hashes in that host's settings and never calls PIS, so it also wins over BypassLogin.
                bool localLogin = Appsetting.LocalLogin.Enabled;
                bool bypassPIS = !localLogin && Appsetting.Environment == "Development" && Appsetting.PIS.BypassLogin;
                bool pisUnreachable = false;
                string employee;
                if (localLogin)
                {
                    employee = LocalPassword.Check(verifyAccount.UserId, dto.Password)
                        ? "Valid Login - Local Password"
                        : "Invalid Login - Local Password";
                    LoginLog.ValidationMessage = employee;
                }
                else if (bypassPIS)
                {
                    Console.WriteLine($"[WARN] PIS:BypassLogin is ON — signing in '{dto.UserName}' without a password check.");
                    employee = "Valid Login - Bypass Login";
                }
                else
                {
                    var request = new AuthenticatePIS(verifyAccount.UserId, dto.Password);
                    // 2026-09-04: removed an unguarded `XDocument.Parse(employee)` that had been
                    // added here -- `employee` can legitimately be the literal "PIS did not return
                    // a response." fallback below, which is not XML, so parsing it threw an
                    // unhandled XmlException (GAP-12), defeating the whole point of the
                    // null-coalesce. The parsed value was never used afterward either.
                    var pisResponse = await APIRequest.XML(request);
                    pisUnreachable = pisResponse == null;
                    employee = pisResponse ?? "PIS did not return a response.";
                    LoginLog.ValidationMessage = employee;
                }
                if (employee.Contains("Valid Login"))
                {
                    LoginLog.IsValid = true;
                }
                _db.tLoginHistory.Add(LoginLog);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();

                if (LoginLog.IsValid)
                {
                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.NameIdentifier, verifyAccount.UserId),
                        new Claim("Name", verifyAccount.Name),
                        new Claim("UserGroup", JsonConvert.SerializeObject(verifyAccount.UserGroupNames)),
                        new Claim("HostName", hostName)
                    };

                    var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                    var authProperties = new AuthenticationProperties
                    {
                        IsPersistent = true
                    };

                    await HttpContext.SignInAsync(
                        CookieAuthenticationDefaults.AuthenticationScheme,
                        new ClaimsPrincipal(claimsIdentity),
                        authProperties
                    );
                }

                // 2026-09-11 fix: previously always echoed LoginLog.ValidationMessage (PIS's own
                // response text) back to the user, which leaked the external system's raw wording
                // (and, before the PIS.cs fix, its raw XML tag too). Wrong-credentials now gets our
                // own controlled message, matching the sibling "Account not found"/"Account is
                // inactive" messages above. The PIS-unreachable case keeps its existing message
                // unchanged -- telling the user their password is wrong when the real problem is
                // the auth service being unreachable would be misleading.
                return LoginLog.IsValid ? Ok(new { Message = "Login successful",
                    Data = new { Authenticated = true, User = verifyAccount } }) :
                    UnauthorizedUser(pisUnreachable
                        ? $"{LoginLog.ValidationMessage}. Please check your user ID and password and try again. "
                        : "Unable to sign in. Please verify your User ID and password and try again.");
            }
            catch (Exception ex)
            {
                // 2026-09-04: any exception reaching here (network failure calling PIS, an
                // unexpected null, a DB error before the normal write path) previously left zero
                // tLoginHistory row -- best-effort audit write, isolated in its own try/catch so a
                // secondary logging failure can never mask or replace the real error response
                // below.
                await TryLogFailedLoginAsync(transaction, LoginLog, $"Unhandled exception: {ex.Message}", cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        // 2026-09-04: best-effort audit write for the LdapException/generic-Exception catch
        // blocks above. Isolated in its own try/catch -- if the DB/transaction itself is the
        // reason the original request failed, this secondary write attempt fails too, silently,
        // rather than throwing a new exception that would replace the caller's real error
        // response. Explicitly commits (the outer `using var transaction` in Login rolls back on
        // dispose if never committed) -- without this, a "successful" Add/SaveChanges here would
        // still be silently undone when the method returns.
        [NonAction]
        private async Task TryLogFailedLoginAsync(
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction,
            LoginHistory loginLog,
            string validationMessage,
            CancellationToken cancellationToken)
        {
            try
            {
                loginLog.ValidationMessage = validationMessage;
                loginLog.IsValid = false;
                _db.tLoginHistory.Add(loginLog);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception logEx)
            {
                Console.WriteLine($"[ERROR] TryLogFailedLoginAsync: could not persist failed-login audit row. {logEx}");
            }
        }

        [HttpPost]
        public async Task<IActionResult> Validate()
        {
            try
            {
                //var userId = User.Claims.ToList();
                bool NoUserFound = string.IsNullOrEmpty(_Session.UserId);
                //return Ok(new { Message = NoUserFound ? "No active session found" : "Session is valid", Data = new { Authenticated = !NoUserFound, User = _Session, userId } });
                if (NoUserFound)
                {
                    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return UnauthorizedUser();
                }
                var ViewAccess = _db.vUserViewPermission.Where(x => x.UserId == _Session.UserId && x.IsActive == true).Select(x => x.RouteName).ToList();
                return Ok(new { Message = "Login successful", Data = new { Authenticated = true, User = _Session, ViewAccess = ViewAccess } });
            }
            catch (Exception ex) { 
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString()); 
            }
        }
        [HttpPost]
        public async Task<IActionResult> GetLoginLogs(CancellationToken cancellationToken)
        {
            try
            {
                var Logs = await _db.tLoginHistory.ToListAsync(cancellationToken);
                return Ok(new { LoginLogs = Logs });
            }
            catch (Exception ex) { 
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString()); 
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            try
            {
                // 2026-09-04: this used to call HttpContext.SignOutAsync explicitly AND return a
                // SignOutResult, which itself triggers a second SignOutAsync when the MVC pipeline
                // executes the result -- cookie deletion is idempotent so this was harmless, but
                // redundant. One call now, via the returned SignOutResult (the standard ASP.NET
                // Core idiom), same RedirectUri behavior.
                return SignOut(new AuthenticationProperties { IsPersistent = true, RedirectUri = "/login" },
                    CookieAuthenticationDefaults.AuthenticationScheme);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
    }
}
