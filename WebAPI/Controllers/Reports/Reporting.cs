using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data.SqlClient;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml;
using static Eaf.Domain.Uow.EafDataFilters;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Reporting : CoreController
    {
        public Reporting(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region Future Roads
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP()
        {
            try
            {
                SMTPModel EmailConfig = new SMTPModel
                {
                    Recipient = "mf102798@gmail.com",
                    Subject = "Request for Revision",
                    Body = "Dear Team,<br/><br/>A new revision request has been submitted. Please review the details and take the necessary actions.<br/><br/>Best Regards,<br/>Automated Notification System"
                };
                EmailConfig.SendEmail();
                var Classification = await _db.tFutureRoadsClassification.AsNoTracking().ToListAsync();
                var response = new
                {
                    Classifications = Classification
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}