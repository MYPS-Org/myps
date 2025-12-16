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
namespace WebAPI.Controllers.Revision.ImplementingOffice
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class IORevision : CoreController
    {
        public IORevision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ProjectRevisionDetails ([FromBody] RequstRevisionsDTO dto)
        {
            try
            {
                string RevisionString = JsonConvert.SerializeObject(dto);
                var Projects = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.ProjectId == "PR00001");
                return Ok(Projects);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
} 