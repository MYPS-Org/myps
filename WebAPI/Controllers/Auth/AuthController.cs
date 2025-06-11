using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Data;
using DBHelper.Models.Dtos;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.Auth
{
    [Route("api/[controller]/[action]")]
    public class AuthController : CoreController
    {
        public AuthController(AppDbContext db, IHttpContextAccessor context) : base(db, context)
        {
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
            var user = await _db.tUsers.FirstOrDefaultAsync(u => u.UserName == dto.UserName && u.Password == dto.Password);
            if (user == null)
            {
                return Unauthorized();
            }
            var token = "fucking_token" + user.UserName;
            return Ok(new { Token = token });
        }
    }
}
