using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Data;
using DBHelper.Models.Dtos;
using DBHelper.Models.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.Auth
{
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        private readonly IPasswordHasher<User> _passwordHasher; // Add this field
        public AuthController(AppDbContext db, IPasswordHasher<User> passwordHasher) : base (db)
        {
            _passwordHasher = passwordHasher;
        }

        [HttpPost]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (dto == null || string.IsNullOrEmpty(dto.UserName) || string.IsNullOrEmpty(dto.Password))
            {
                return BadRequest("Invalid login request.");
            }
            // Here you would typically validate the user credentials against the database
            // For demonstration, let's assume a successful login
            var user = await _db.tUsers.FirstOrDefaultAsync(u => u.UserName == dto.UserName);
            if (user == null)
            {
                return Unauthorized();
            }
            // Verify the password
            var result = _passwordHasher.VerifyHashedPassword(user, user.Password, dto.Password);
            if (result == PasswordVerificationResult.Success)
            {
                var token = "Hidden_Token" + user.UserName;
                return Ok(new { Token = token });
            }
            else
            {
                return Unauthorized();
            }
        }
    }
}
