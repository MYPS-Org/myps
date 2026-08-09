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
using Novell.Directory.Ldap;
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
                    hostName = hostEntry.HostName;
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
                var verifyAccount = await _db.vUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserName && x.IsActive == true);

                if (verifyAccount == null) { LoginLog.ValidationMessage = "Account not active."; return UnauthorizedUser("Invalid credentials. Please check your user ID and password and try again."); }

                var request = new AuthenticatePIS(dto.UserName, dto.Password);
                var employee = await APIRequest.XML(request);
                if(employee.Contains("Valid Login"))
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
                    LoginLog.IsValid = true;
                }
                else
                {
                    LoginLog.ValidationMessage = employee;
                }
                //LdapConnection ldap_conn = new LdapConnection();
                //await ldap_conn.ConnectAsync($"{Appsetting.LDAP.Host}", Appsetting.LDAP.Port);
                //await ldap_conn.BindAsync(Appsetting.LDAP.DN.Replace("[[USERNAME]]", verifyAccount.EmployeeId), dto.Password);
                //Console.WriteLine("LDAP Bind Successfull!");
                //if (ldap_conn.Bound)
                //{
                //    ldap_conn.Disconnect();


                //    var claims = new List<Claim>
                //    {
                //        new Claim(ClaimTypes.NameIdentifier, verifyAccount.UserId),
                //        new Claim("Name", verifyAccount.Name),
                //        new Claim("UserGroup", JsonConvert.SerializeObject(verifyAccount.UserGroupNames)),
                //        new Claim("HostName", hostName)
                //    };

                //    var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                //    var authProperties = new AuthenticationProperties
                //    {
                //        IsPersistent = true
                //    };

                //    await HttpContext.SignInAsync(
                //        CookieAuthenticationDefaults.AuthenticationScheme,
                //        new ClaimsPrincipal(claimsIdentity),
                //        authProperties
                //    );
                //    LoginLog.IsValid = true;
                //}
                //else
                //{
                //    LoginLog.ValidationMessage = "Invalid credentials";
                //}
                _db.tLoginHistory.Add(LoginLog);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return LoginLog.IsValid ? Ok(new { Message = "Login successful", Data = new { Authenticated = true, User = verifyAccount } }) : UnauthorizedUser("Invalid credentials. Please check your user ID and password and try again.");
            }
            catch (LdapException error)
            {
                Console.WriteLine($"Login Error: {error.Message}");
                var responseObj = new
                {
                    Message = "Login Error: " + error.Message,
                    Data = new { Authenticated = false, User = new { } },
                    Redirect = "/login"
                };
                return Unauthorized(responseObj);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
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
        public async Task<IActionResult> GetLoginLogs()
        {
            try
            {
                var Logs = await _db.tLoginHistory.ToListAsync();
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
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme, new AuthenticationProperties
                {
                    IsPersistent = true,
                    RedirectUri = "/login"
                });

                return SignOut(new AuthenticationProperties { RedirectUri = "/login" },
                    CookieAuthenticationDefaults.AuthenticationScheme);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
    }
}
