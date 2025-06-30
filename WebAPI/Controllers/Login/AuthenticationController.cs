using DBHelper.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Novell.Directory.Ldap;
using System.Security.Claims;

namespace WebAPI.Controllers.Auth
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        public AuthController(AppDbContext db) : base (db)
        {
        }
        /// <summary>
        /// Authenticate user using LDAP
        /// </summary>
        /// <param name="dto">Login credentials</param>
        /// <returns>Authentication result</returns>
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            string ldap_host = "192.168.50.146";
            if (dto == null || string.IsNullOrEmpty(dto.UserName) || string.IsNullOrEmpty(dto.Password))
            {
                return BadRequest("Invalid login request.");
            }
            try
            {
                LdapConnection ldap_conn = new LdapConnection();
                Console.WriteLine($"Connecting to: {ldap_host}:{LdapConnection.DefaultPort}");

                await ldap_conn.ConnectAsync($"{ldap_host}", LdapConnection.DefaultPort);
                await ldap_conn.BindAsync($"cn={dto.UserName},ou=myps,dc=dpwh,dc=net", dto.Password);
                 
                Console.WriteLine("LDAP Bind Successfull!");
                if (ldap_conn.Bound)
                {
                    ldap_conn.Disconnect();
                    return Ok("LDAP Authentication Successful!");
                }
                else
                {
                    return RedirectToAction("Fail");
                }
            }
            catch (LdapException)
            {
                return RedirectToAction("Fail"); // Authentication failed
            }
            //var result = _passwordHasher.VerifyHashedPassword(user, user.Password, dto.Password);
            //if (result == PasswordVerificationResult.Success)
            //{
            //    var claims = new List<Claim>
            //        {
            //            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            //            new Claim(ClaimTypes.Name, user.UserName),
            //            new Claim(ClaimTypes.Role, user.UserRole)
            //        };

            //    var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            //    var authProperties = new AuthenticationProperties
            //    {
            //        IsPersistent = true,
            //        ExpiresUtc = DateTime.UtcNow.AddDays(365),
            //        AllowRefresh = true
            //    };

            //    await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            //        new ClaimsPrincipal(claimsIdentity), authProperties);
            //    return Ok(new { message = "Login successful", data = new { Authenticated = true, user = new { UserRole = user.UserRole, Name = user.Name } } });
            //}
            //else
            //{
            //    return Unauthorized();
            //}
        }
    }
}
