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
using WebAPI.Controllers.Revision.RegionalOffice;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Revision : CoreController
    {
        public Revision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RevisionCategories()
        {
            try
            {
                var RevisionTypes = await _db.tOptionRevisionHeader.ToListAsync();
                var Categories = await _db.tOptionRevisionCategory.ToListAsync();
                var Reasons = await _db.tOptionRevisionReasons.ToListAsync();
                return Ok(new { RevisionTypes, Categories, Reasons });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}