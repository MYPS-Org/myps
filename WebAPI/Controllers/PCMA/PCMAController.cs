using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.API;
using DBHelper.Models.Dtos;
using Helpers;
using Helpers.API;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace WebAPI.Controllers.MockUps
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class PCMAController : CoreController
    {
        public PCMAController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> PublishProgram([FromBody] PublishProgramDTO dto)
        {
            try
            {
                var checifExists = await _db.tProgramStages.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.StageName == "GAA-R");
                if (checifExists == null)
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Program ID: '{dto.ProgramId}' does not exist",
                            Title = "Program Not Found"
                        }
                    );
                }
                var pcmaData = new PublishPCMA
                {
                    ProgramId = dto.ProgramId,
                    MYPSUserName = "testuser"
                };
                var request = new PCMA(pcmaData);
                var employee = await APIRequest.XML(request);
                var param = new Dictionary<string, object> { { "@ProgramId", dto.ProgramId } };
                int check = Sql.NormalQuery<int>(
                    Appsetting.ConnectionString,
                    "EXEC pPublishProgram @ProgramId = @ProgramId", param
                ).FirstOrDefault();
                if (string.IsNullOrEmpty(employee.Message))
                {
                    return new BadRequestObjectResult(
                        new
                        {
                            Message = $"Program ID: '{dto.ProgramId}' not found",
                            Title = "User Not Found"
                        }
                    );
                }
                return Ok(new
                {
                    Message = "Program publish successfully!",
                    Title = "Publish Complete"
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}