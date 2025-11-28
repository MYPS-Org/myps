using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Threading.Tasks;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class RORevision : CoreController
    {
        public RORevision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateRevisionRequest([FromBody] RORevisionDTO dto)
        {
            try
            {
                var CheckRevision = await _db.tProjectRevisions.AsNoTracking().Where(x => x.ProjectId == dto.ProjectId && x.isRevised == true).OrderByDescending(x => x.RevisedNumber).FirstOrDefaultAsync();
                if (CheckRevision == null)
                {
                    return Ok(new { Message = "Revision cannot be updated, no revision request!", Title = "Revision not found" });
                }
                string TransactionId = dto.ProjectId + "-" + CheckRevision.RevisedNumber;
                var RevisionDetails = await _db.tRevisionDetails.FirstOrDefaultAsync(x => x.TransactionId == TransactionId);
                if(RevisionDetails == null)
                {
                    return Ok(new { Message = "Revision Details not found! Please contact administrator", Title = "Revision Details Missing"});
                }
                RevisionDetails.RegionApprover = _Session.UserId;
                RevisionDetails.COApproveStatus = true;
                _db.tRevisionDetails.Update(RevisionDetails);
                return Ok(new { });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}