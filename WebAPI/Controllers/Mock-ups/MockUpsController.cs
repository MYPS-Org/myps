using DBHelper.Data;
using DBHelper.Models.Dtos;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace WebAPI.Controllers.MockUps
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class MockUpsController : CoreController
    {
        public MockUpsController(AppDbContext db) : base(db) { }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> SearchUser([FromBody] SearchUserDTO dto)
        {
            try
            {
                var checifExists = await _db.tUsers.FirstOrDefaultAsync(x => x.EmployeeId == dto.EmployeeId);
                if (checifExists != null)
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' already exists",
                            Title = "User Exists"
                        }
                    );
                }
                return Ok(checifExists);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}