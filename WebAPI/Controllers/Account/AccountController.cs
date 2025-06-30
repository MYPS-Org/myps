using DBHelper.Data;
using DBHelper.Models.Table;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace WebAPI.Controllers.Account
{
    //[ApiController]
    //[Route("api/[controller]/[action]")]
    //public class AccountController : CoreController
    //{
    //    private readonly IPasswordHasher<User> _passwordHasher; // Add this field

    //    public AccountController(AppDbContext db, IPasswordHasher<User> passwordHasher)
    //        : base(db)
    //    {
    //        _passwordHasher = passwordHasher; // Initialize the password hasher
    //    }
    //    [HttpPost]
    //    [Authorize(Roles = "DPD Admin")]
    //    public async Task<IActionResult> RegisterUser([FromBody] User model)
    //    {
    //        if (model == null || string.IsNullOrEmpty(model.UserName) || string.IsNullOrEmpty(model.Password) || string.IsNullOrEmpty(model.Name))
    //        {
    //            return BadRequest("Invalid registration request.");
    //        }
    //        // Check if user already exists
    //        var existingUser = await _db.tUsers.FirstOrDefaultAsync(u => u.UserName == model.UserName);
    //        if (existingUser != null)
    //        {
    //            return Conflict("User already exists.");
    //        }
    //        // Create new user
    //        var newUser = new User
    //        {
    //            Name = model.Name,
    //            UserName = model.UserName,
    //            Password = _passwordHasher.HashPassword(model, model.Password) // Use the password hasher
    //        };
    //        _db.tUsers.Add(newUser);
    //        await _db.SaveChangesAsync();
    //        return Ok("User registered successfully.");
    //    }
    //}
}