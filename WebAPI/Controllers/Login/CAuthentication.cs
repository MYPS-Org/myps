using DBHelper.Data;
using DBHelper.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.DirectoryServices;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Auth
{
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        public AuthController(AppDbContext db) : base (db)
        {
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (dto == null || string.IsNullOrEmpty(dto.UserName) || string.IsNullOrEmpty(dto.Password))
            {
                return BadRequest("Invalid login request.");
            }
            //var user = await _db.tUsers.FirstOrDefaultAsync(u => u.UserId == dto.UserName);
            //if (user == null)
            //{
            //    return Unauthorized(new
            //    {
            //        message = "Unauthorized",
            //        data = new { Authenticated = false },
            //        user = new { }
            //    });
            //}
            DirectoryEntry entry = new DirectoryEntry("LDAP://172.30.208.1:389", dto.UserName, dto.Password);
            return Ok(entry);
            //var result = _passwordHasher.VerifyHashedPassword(user, user.Password, dto.Password);
            //if (result == PasswordVerificationResult.Success)
            //{
            //    var claims = new List<Claim>
            //    {
            //        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            //        new Claim(ClaimTypes.Name, user.UserName),
            //        new Claim(ClaimTypes.Role, user.UserRole)
            //    };

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
