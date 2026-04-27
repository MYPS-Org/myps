using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Dtos;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Helpers.API;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace WebAPI.Controllers.MockUps
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class PISController : CoreController
    {
        public PISController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> SearchUser([FromBody] SearchUserDTO dto)
        {
            try
            {
                var checifExists = await _db.tUsers.FirstOrDefaultAsync(x => x.EmployeeId == dto.EmployeeId);
                if (checifExists == null)
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' already exists",
                            Title = "User Exists"
                        }
                    );
                }
                var request = new GetUserInfoPIS(dto.EmployeeId);
                var employee = await APIRequest.XML(request);
                if (string.IsNullOrEmpty(employee.EmployeeId))
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' not found",
                            Title = "User Not Found"
                        }
                    );
                }
                var getRegCode = await _db.tImplementingOffice.FirstOrDefaultAsync(x => x.OrgId == employee.CentralOrRegionId);
                var getPlantillaOffice = await _db.tImplementingOffice.FirstOrDefaultAsync(x => x.OrgId == employee.PlantillaOfficeId);
                string UserId = $"{employee.PersonFamilyName?.Replace(" ","")}{employee.PersonForename?[0]}{employee.PersonMiddleInitial1?[0]}".ToLower();
                DBHelper.Models.Table.Users newuser = new DBHelper.Models.Table.Users()
                {
                    EmployeeId = employee.EmployeeId,
                    UserId = UserId,
                    Name = $"{employee.PersonForename} {employee.PersonMiddleInitial1}. {employee.PersonFamilyName}",
                    Email = "",
                    RegCode = (getRegCode != null) ? getRegCode.OrgName : $"{employee.CentralOrRegionId} (Not Exists)",
                    PlantillaOffice = (getPlantillaOffice != null) ? getPlantillaOffice.OrgName : $"{employee.PlantillaOfficeId} (Not Exists)",
                    IsActive = false
                };
                return Ok(newuser);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> GetUserInfo([FromBody] SearchUserDTO dto)
        {
            try
            {
                var checifExists = await _db.tUsers.FirstOrDefaultAsync(x => x.EmployeeId == dto.EmployeeId);
                if (checifExists == null)
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' does not exist",
                            Title = "User Not Found"
                        }
                    );
                }
                var request = new GetUserInfoPIS(dto.EmployeeId);
                var employee = await APIRequest.XML(request);
                if (string.IsNullOrEmpty(employee.EmployeeId))
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' not found",
                            Title = "User Not Found"
                        }
                    );
                }
                string UserId = $"{employee.PersonFamilyName?.Replace(" ", "")}{employee.PersonForename?[0]}{employee.PersonMiddleInitial1?[0]}".ToLower();
                DBHelper.Models.Table.Users newuser = new DBHelper.Models.Table.Users()
                {
                    EmployeeId = employee.EmployeeId,
                    UserId = UserId,
                    Name = $"{employee.PersonForename} {employee.PersonMiddleInitial1}. {employee.PersonFamilyName}",
                    Email = "",
                    RegCode = employee.CentralOrRegionId!,
                    PlantillaOffice = employee.PlantillaOfficeId,
                    IsActive = false
                };
                return Ok(newuser);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AuthenticateAcccount([FromBody] AuthenticateUserDTO dto)
        {
            try
            {
                var checifExists = await _db.tUsers.FirstOrDefaultAsync(x => x.EmployeeId == dto.EmployeeId);
                if (checifExists == null)
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Employee: '{dto.EmployeeId}' does not exist",
                            Title = "User Not Found"
                        }
                    );
                }
                var request = new AuthenticatePIS(dto.EmployeeId, dto.Password);
                var employee = await APIRequest.XML(request);
                //if (employee == null || string.IsNullOrEmpty(employee.NetworkId))
                //{
                //    return new BadRequestObjectResult(
                //        new
                //        {
                //            Message = $"Authentication failed for employee: '{dto.EmployeeId}'",
                //            Title = "Authentication Failed"
                //        }
                //    );
                //}
                //string UserId = $"{employee.PersonFamilyName?.Replace(" ", "")}{employee.PersonForename?[0]}{employee.PersonMiddleInitial1?[0]}".ToLower();
                //DBHelper.Models.Table.Users newuser = new DBHelper.Models.Table.Users()
                //{
                //    EmployeeId = checifExists.EmployeeId,
                //    UserId = UserId,
                //    Name = $"{employee.PersonForename} {employee.PersonMiddleInitial1}. {employee.PersonFamilyName}",
                //    Email = "",
                //    RegCode = employee.CentralOrRegionId!,
                //    PlantillaOffice = employee.PlantillaOfficeId,
                //    IsActive = false
                //};
                return Ok(employee);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}