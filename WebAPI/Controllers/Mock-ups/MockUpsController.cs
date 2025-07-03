using DBHelper.Data;
using DBHelper.Models.Dtos;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Helpers;
using System.Text;
using DBHelper.Models.Extra;

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
                //var request = new XMLRequest<EmployeeResponse>();
                //var data = await APIRequest.XML<EmployeeResponse>();
                return Ok(checifExists);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        [AllowAnonymous]
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
                            Message = $"Employee: '{dto.EmployeeId}' already exists",
                            Title = "User Exists"
                        }
                    );
                }
                //var request = new XMLRequest<EmployeeResponse>();
                //var data = await APIRequest.XML<EmployeeResponse>();
                return Ok(checifExists);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        [Consumes("text/xml")]
        [AllowAnonymous]
        public async Task<IActionResult> ReceiveSoap()
        {
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var xmlContent = await reader.ReadToEndAsync();

            // ✅ Log or process the raw SOAP envelope
            // You can also deserialize it here if needed
            System.Diagnostics.Debug.WriteLine("Received SOAP:");
            System.Diagnostics.Debug.WriteLine(xmlContent);

            // 👇 You might want to parse employee_id, validate credentials, etc.
            // and generate an appropriate SOAP XML response

            var soapResponse = @"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance""
               xmlns:xsd=""http://www.w3.org/2001/XMLSchema""
               xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"">
  <soap:Body>
    <pis_get_employeeResponse xmlns=""https://www.dpwh.gov.ph/"">
      <pis_get_employeeResult>
        <employee_id>EMP00123</employee_id>
        <network_id>jdelacruz</network_id>
        <person_family_name>Dela Cruz</person_family_name>
        <person_forename>Juan</person_forename>
        <person_middle_initial_1>M</person_middle_initial_1>
        <position_code>POS456</position_code>
        <plantilla_position>Engineer II</plantilla_position>
        <plantilla_office_id>001-A</plantilla_office_id>
        <plantilla_office_name>Planning Service</plantilla_office_name>
        <bureau_service_ro_deo_id>BSR-21</bureau_service_ro_deo_id>
        <bureau_service_ro_deo_name>Regional Office IV-A</bureau_service_ro_deo_name>
        <central_or_region_id>CR-09</central_or_region_id>
        <central_or_region_name>Central Office</central_or_region_name>
        <designation_group>Technical</designation_group>
        <designation_code>DC-789</designation_code>
        <designation_title>Team Lead</designation_title>
        <designation_office_id>DO-114</designation_office_id>
        <designation_office_name>Office of Design Services</designation_office_name>
        <designation_start_date>2022-01-15</designation_start_date>
        <designation_end_date>2025-12-31</designation_end_date>
      </pis_get_employeeResult>
    </pis_get_employeeResponse>
  </soap:Body>
</soap:Envelope>";

            return Content(soapResponse, "text/xml", Encoding.UTF8);
        }

    }
}