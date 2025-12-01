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
namespace WebAPI.Controllers.Revision.RegionalOffice
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
                DateTime CurrentDate = DateTime.UtcNow;
                var CheckRevision = await _db.tProjectRevisions.AsNoTracking().Where(x => x.ProjectId == dto.ProjectId && x.isRevised == true).OrderByDescending(x => x.RevisedNumber).FirstOrDefaultAsync();
                if (CheckRevision == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision cannot be updated, no revision request!", Title = "Revision not found" });
                }
                if(CheckRevision.RevisedNumber == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Revised Number is null! Please contact administrator", Title = "Revision Data Error" });
                }
                string RevisedNumber = CheckRevision.RevisedNumber.ToString()!;
                string TransactionId = $"{dto.ProjectId}-{RevisedNumber}";
                var RevisionDetails = await _db.tRevisionDetails.FirstOrDefaultAsync(x => x.TransactionId == TransactionId);
                if (RevisionDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Details not found! Please contact administrator", Title = "Revision Details Missing" });
                }
                var SelectedReason = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == RevisionDetails.ModificationReason);
                if (SelectedReason == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found! Please contact administrator", Title = "Revision Reason Missing" });
                }
                var SelectedCategory = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == SelectedReason.RevisionGroupId);
                if (SelectedCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Category not found! Please contact administrator", Title = "Revision Category Missing" });
                }
                RevisionDetails.RegionApprover = _Session.UserId;
                RevisionDetails.RegionApproveStatus = dto.Status;
                RevisionDetails.RegionDescription = dto.Status == DBHelper.Models.Enums.EnumRevisionStatus.ForReview ? dto.Description : null;
                RevisionDetails.RegionLastUpdatedDate = CurrentDate;
                _db.tRevisionDetails.Update(RevisionDetails);
                //await _db.SaveChangesAsync();
                #region SendEmail
                string loc = System.IO.File.ReadAllText(SMTPClass.PathEmailTemplate);
        //        string Body = $@"
        //<h3>Office Information:</h3>
        //<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
        //    <tbody>
        //        <tr style='border-top: none; background: #00148b; color: #fff;'>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Name</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Status</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Date</th>
        //        </tr>
        //        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
        //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
        //                    {SelectedCategory.RevisionName}
        //                </td>
        //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd
        //                    {SelectedReason.Reason}
        //                </td>
        //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
        //                    {_Session.Name}
        //                </td>
        //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
        //                    {dto.Status.ToString()}
        //                </td>
        //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
        //                    {CurrentDate}
        //                </td>
        //            </tr>
        //        </tbody>
        //</table>
        //<h3>Project Details Information:</h3>
        //<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
        //    <tbody>
        //        <tr style='border-top: none; background: #00148b; color: #fff;'>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Name</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Stage</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Reference Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Project Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Alternate Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>External Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>MY Id</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>UACS</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>MYCA Approval Date</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Island Code</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision #</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Description</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Category</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Thrust</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Origin</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>City</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Province</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Legislative District</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Operating Unit</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Implementing Office</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>DEO</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Region</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Agency</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Implementation Mode</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Emergency Mode</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Feasibility</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Feasibility Date</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Detailed Design</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Detailed Design Date</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>ROW Available</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Region Wide</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Tier</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created By</th>
        //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created Date</th>
        //        </tr>

        //        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.ProgramId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.ProgramName}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.StageName}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ReferenceId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ProjectId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.AlternateId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ExternalId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.MYId}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.UACS}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.MYCAApprovalDate}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.IslandCode}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RevisionNumber}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Description}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Category}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Thrust}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Origin}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.City}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Province}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.LegislativeDistrict}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.OperatingUnit}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ImplementingOffice}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DEO}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Region}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Agency}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ImplementationMode}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.EmergencyMode}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Feasibility}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.FeasibilityDate}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DetailedDesign}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DetailedDesignDate}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RowAvailable}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RegionWide}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Tier}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.CreatedBy}</td>
        //            <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.CreatedDate}</td>
        //        </tr>

        //    </tbody>
        //</table>""";
                loc = loc.Replace("{Title}", "Project Revision <b><u>Request</u></b>");
                loc = loc.Replace("{Body}", "");
                loc = loc.Replace("{Footer}", $"For more information click <a href='{Appsetting.RootPath}/Batch'>HERE</a>");
                loc = loc.Replace("{From}", "");
                string To = "";
                SMTPModel EmailConfig = new SMTPModel
                {
                    Recipient = "mf102798@gmail.com",
                    CCAddress = "yabutgerard@gmail.com",
                    Subject = "Request for Revision",
                    Body = loc
                };
                EmailConfig.SendEmail();
                #endregion
                return Ok(new { Message = $"Revision status updated to {dto.Status}", Title = "Revision Updated Successfully" });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}