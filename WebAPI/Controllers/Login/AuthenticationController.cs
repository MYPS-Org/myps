using Confluent.Kafka;
using DBHelper.Data;
using Helpers;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Novell.Directory.Ldap;
using System.Configuration;
using System.Security.Claims;

namespace WebAPI.Controllers.Auth
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        public AuthController(AppDbContext db, IProducer<Null, string> producer) : base (db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            try
            {
                if (dto == null || (string.IsNullOrEmpty(dto.UserName) && string.IsNullOrEmpty(dto.Password)))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing.", Title = "Parameter Error" });
                }
                var verifyAccount = await _db.tUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserName && x.IsActive == true);

                if (verifyAccount == null) return UnauthorizedUser();

                LdapConnection ldap_conn = new LdapConnection();
                await ldap_conn.ConnectAsync($"{Appsetting.LDAP.Host}", Appsetting.LDAP.Port);
                await ldap_conn.BindAsync(Appsetting.LDAP.DN.Replace("[[USERNAME]]", dto.UserName), dto.Password);

                Console.WriteLine("LDAP Bind Successfull!");
                if (ldap_conn.Bound)
                {
                    ldap_conn.Disconnect();
                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.NameIdentifier, verifyAccount.UserId),
                        new Claim(ClaimTypes.Name, verifyAccount.Name),
                        new Claim(ClaimTypes.Role, "Admin")
                    };

                    var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
                    var authProperties = new AuthenticationProperties
                    {
                        IsPersistent = true,
                        ExpiresUtc = DateTime.UtcNow.AddDays(365),
                        AllowRefresh = true
                    };

                    await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                        new ClaimsPrincipal(claimsIdentity), authProperties);
                    return Ok(new { Message = "Login successful", Data = new { Authenticated = true, User = verifyAccount } });
                }
                else
                {
                    return UnauthorizedUser();
                }
            }
            catch (LdapException error)
            {
                Console.WriteLine($"LDAP Error: {error.Message}");
                return UnauthorizedUser();
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public IActionResult Validate()
        {
            try
            {
                bool NoUserFound = string.IsNullOrEmpty(_Session.UserId);
                if (NoUserFound)
                    return UnauthorizedUser();
                return Ok(new { Message = "Login successful", Data = new { Authenticated = true, User = _Session } });
            }
            catch (Exception ex) { 
                return ExceptionHandler(ex); 
            }
        }
        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            try
            {
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Ok(new { Message = "Logout successful", Data = new { Authenticated = false, User = new { } } });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}
