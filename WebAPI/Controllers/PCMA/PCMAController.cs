//using Confluent.Kafka;
//using DBHelper.Data;
//using DBHelper.Models.API;
//using DBHelper.Models.Dtos;
//using Helpers;
//using Helpers.API;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.EntityFrameworkCore;
//using Microsoft.EntityFrameworkCore.Metadata.Internal;
//using Newtonsoft.Json;
//using System.Data.SqlClient;

//namespace WebAPI.Controllers.MockUps
//{
//    [ApiController]
//    [Route("api/[controller]/[action]")]
//    public class PCMAController : CoreController
//    {
//        public PCMAController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma) : base(db, hub, pcma) { }
//        [HttpPost]
//        public async Task<IActionResult> PublishProgram([FromBody] PublishProgramDTO dto, CancellationToken cancellationToken)
//        {
//            try
//            {
//                var checifExists = await _db.tProgramStages.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.StageName == "GAA-R");
//                if (checifExists == null)
//                {
//                    return new BadRequestObjectResult(
//                        new
//                        {
//                            Message = $"Program ID: '{dto.ProgramId}' does not exist",
//                            Title = "Program Not Found"
//                        }
//                    );
//                }

//                //var programIdParam = new SqlParameter("@ProgramId", dto.ProgramId);

//                //var result = await _db.sp_myps_pub_program
//                //    .FromSqlRaw("EXEC sp_myps_pub_program @ProgramId", programIdParam)
//                //    .ToListAsync();
//                //if(result.Count == 0)
//                //{
//                //    //return new BadRequestObjectResult(
//                //    //    new
//                //    //    {
//                //    //        Message = "Publish failed. Reason: There are no available projects to publish.",
//                //    //        Title = "Publish Failed"
//                //    //    }
//                //    //);
//                //}

//                var pcmaData = new PublishPCMA
//                {
//                    ProgramId = checifExists.ProgramUniqueId,
//                    MYPSUserName = _Session.Name
//                };
//                var request = new PCMA(pcmaData);
//                var PCMARespose = await APIRequest.XML(request);
//                if(!PCMARespose.Success)
//                {
//                    return new BadRequestObjectResult(
//                        new
//                        {
//                            Message = $"Failed to publish program. Reason: {PCMARespose.Message}",
//                            Title = "Publish Failed"
//                        }
//                    );
//                }
//                    var param = new Dictionary<string, object> { { "@ProgramId", dto.ProgramId } };
//                    int check = Sql.NormalQuery<int>(
//                        Appsetting.DbConnections.MYPSDb,
//                        "EXEC pPublishProgram @ProgramId = @ProgramId", param
//                    ).FirstOrDefault();
//                return Ok(new
//                {
//                    Message = "Program publish successfully.",
//                    Response = JsonConvert.SerializeObject(PCMARespose),
//                    Title = "Publish Complete"
//                });
//            }
//            catch (Exception ex)
//            {
//                return ExceptionHandler(ex);
//            }
//        }
//    }
//}