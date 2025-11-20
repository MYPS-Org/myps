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
    public class IORevision : CoreController
    {
        public IORevision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestRevision([FromBody] RequstRevisionsDTO dto)
        {
            try
            {
                string loc = System.IO.File.ReadAllText(SMTPClass.PathEmailTemplate);
                string Body = $@"
<h3>Booking Information:</h3>
<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
    <tbody>
        <tr style='border-top: none; background: #00148b; color: #fff;'>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Booking ID</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Supplier</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Origin Country</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Destination Country</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Shipping Mode</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Number of PO</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Total Order Quantity</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Total Value in SAR</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created by</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created on</th>
        </tr>
        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{bk}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].supplier}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].Origin_Country}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].destination_country}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].ship_method}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].number_po}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{totalqty.ToString().Replace("".0"", """")}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{Functions.DecimalToStr(totalcost)}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{AccountSession.FullName}}
                </td>
                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                    {{po[0].booked_date.Date.ToString(""dd-MM-yyyy"")}}
                </td>
            </tr>
        </tbody>
</table>
<h3>Purchase Order Information:</h3>
<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
    <tbody>
        <tr style='border-top: none; background: #00148b; color: #fff;'>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Order Number</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Invoice No.</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Brand</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Readiness Date</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Launch Requred Date</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Total Order Qty</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Total Order Cost</th>
            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>PO Value in SAR</th>
        </tr>
        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.order_no}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.Inv_Number}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.brand}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.readiness_date?.Date.ToString(""dd-MM-yyyy"")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.launch_required_date?.Date.ToString(""dd-MM-yyyy"")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.total_order_qty.ToString().Replace("".0"", """")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.total_order_cost}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{Functions.DecimalToStr(rows1.po_value_in_sar)}}
            </td>
        </tr>
        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.order_no}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.Inv_Number}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.brand}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.readiness_date?.Date.ToString(""dd-MM-yyyy"")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.launch_required_date?.Date.ToString(""dd-MM-yyyy"")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.total_order_qty.ToString().Replace("".0"", """")}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{rows1.total_order_cost}}
            </td>
            <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                {{Functions.DecimalToStr(rows1.po_value_in_sar)}}
            </td>
        </tr>
    </tbody>
</table>""";
                loc = loc.Replace("{Title}", "FDC Invoice Payment Approval <b><u>Approved</u></b>");
                loc = loc.Replace("{Body}", Body);
                loc = loc.Replace("{Footer}", $"For more information click <a href='{Appsetting.RootPath}/Batch'>HERE</a>");
                loc = loc.Replace("{From}", "");
                string To = "";
                SMTPModel sMTPModel = new SMTPModel
                {
                    Recipient = "mf102798@gmail.com",
                    Subject = "Request for Revision",
                    Body = "Dear Team,<br/><br/>A new revision request has been submitted. Please review the details and take the necessary actions.<br/><br/>Best Regards,<br/>Automated Notification System"
                };
                Functions.SendEmail(sMTPModel);
                return Ok();
                var Details = dto.ProjectDetails;
                var FundingProfile = dto.FundingProfile;
                var Component = dto.ComponentCosts;
                var ComponentYear = dto.ComponentCostYear;
                var MajorWorks = dto.MajorItemOfWorks;
                var MajorWorkLocations = dto.MajorItemLocations;
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectsPerStage({dto.ProjectDetails.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectDetails.ProjectId} fp.StageName = {dto.ProjectDetails.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Invalid Project" });
                }
                var RevisionExists = await _db.tPCMARevisions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectDetails.ProjectId);
                string RevisionId = RevisionExists?.RevisionId ?? "R" + ("tCountSequence").GenerateCode();
                if (RevisionExists == null)
                {
                    PCMARevisions revisions = new PCMARevisions
                    {
                        RevisionId = RevisionId,
                        ProjectId = dto.ProjectDetails.ProjectId!,
                    };
                    await _db.tPCMARevisions.AddAsync(revisions);
                }
                DateTime CurrentDate = DateTime.UtcNow;
                var NewRevisionDetails = new PCMARevisionDetails
                {
                    RevisionId = RevisionId,
                    RevisionType = dto.RevisionDetails.RevisionName,
                    RevisionCategory = dto.RevisionDetails.RevisionCategory,
                    RevisionReason = dto.RevisionDetails.RevisionReason,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate,
                };
                List<PCMARevisionChangelogs> changelogs = new List<PCMARevisionChangelogs>();
                bool hasUpdated = false;
                #region Update Project Details
                if (Project != null)
                {
                    if (Project.Description != dto.ProjectDetails?.Description)
                    {
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Description,
                            OldValue = Project.Description,
                        });
                        Project.Description = dto.ProjectDetails!.Description;
                    }
                    if (Project.Category != dto.ProjectDetails?.Category)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Category.ToString(),
                            OldValue = Project.Category.ToString(),
                        });
                        Project.Category = dto.ProjectDetails!.Category;
                    }
                    if (Project.Thrust != dto.ProjectDetails?.Thrust)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Thrust.ToString()!,
                            OldValue = Project.Thrust!.ToString()!
                        });
                        Project.Thrust = dto.ProjectDetails!.Thrust;
                    }
                    if (Project.Origin != dto.ProjectDetails?.Origin)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Origin.ToString(),
                            OldValue = Project!.Origin.ToString(),
                        });
                        Project.Origin = dto.ProjectDetails!.Origin;
                    }
                    if (Project.City != dto.ProjectDetails?.City)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.City,
                            OldValue = Project.City
                        });
                        Project.City = dto.ProjectDetails!.City;
                    }
                    if (Project.LegislativeDistrict != dto.ProjectDetails?.LegislativeDistrict)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.LegislativeDistrict,
                            OldValue = Project.LegislativeDistrict
                        });
                        Project.LegislativeDistrict = dto.ProjectDetails!.LegislativeDistrict;
                    }
                    if (Project.OperatingUnit != dto.ProjectDetails?.OperatingUnit)
                    {
                        HashSet<string> OUList = new HashSet<string>() { "C", "DO" };
                        var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.OperatingUnit);
                        if (OperatingUnit == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.ProjectDetails!.OperatingUnit}' is not valid!", Title = "Invalid Operating Unit" });
                        }
                        var OldOperatingUnit = await _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.OperatingUnit);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.OperatingUnit!,
                            OldValue = Project.OperatingUnit!
                        });
                        Project.OperatingUnit = dto.ProjectDetails!.OperatingUnit;
                    }
                    if (Project.ImplementingOffice != dto.ProjectDetails?.ImplementingOffice)
                    {
                        var IO = await _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.ImplementingOffice);
                        if (IO == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{dto.ProjectDetails!.ImplementingOffice}' is not valid!", Title = "Invalid Implementing Office" });
                        }
                        var OldIO = await _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.ImplementingOffice);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.ImplementingOffice!,
                            OldValue = Project.ImplementingOffice!
                        });
                        Project.ImplementingOffice = dto.ProjectDetails!.ImplementingOffice;
                    }
                    if (Project.Agency != dto.ProjectDetails?.Agency)
                    {
                        var Agency = await _db.tProjectAgencyLists.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.ProjectDetails!.Agency);
                        if (Agency == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.ProjectDetails!.Agency}' is not valid!", Title = "Invalid Agency" });
                        }
                        var OldAgency = await _db.tProjectAgencyLists.AsNoTracking().FirstOrDefaultAsync(x => x.Id == Project.Agency);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Agency.ToString(),
                            OldValue = Project.Agency.ToString()
                        });
                        Project.Agency = dto.ProjectDetails!.Agency;
                    }
                    if (Project.ImplementationMode != dto.ProjectDetails?.ImplementationMode)
                    {
                        var ImplementationMode = await _db.tProjectImplementModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.ImplementationMode);
                        if (ImplementationMode == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ProjectDetails!.ImplementationMode}' is not valid!", Title = "Invalid Implementation Mode" });
                        }
                        var OldImplementationMode = await _db.tProjectImplementModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == Project.ImplementationMode);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.ImplementationMode.ToString(),
                            OldValue = Project.ImplementationMode.ToString()
                        });
                        Project.ImplementationMode = dto.ProjectDetails!.ImplementationMode;
                    }
                    if (Project.EmergencyMode != dto.ProjectDetails?.EmergencyMode)
                    {
                        var EmergencyMode = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.EmergencyMode);
                        if (EmergencyMode == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Emergency Mode" });
                        }
                        var OldEmergencyMode = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == Project.EmergencyMode);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.EmergencyMode.ToString(),
                            OldValue = Project.EmergencyMode.ToString()
                        });
                        Project.EmergencyMode = dto.ProjectDetails!.EmergencyMode;
                    }
                    if (Project.Feasibility != dto.ProjectDetails?.Feasibility)
                    {
                        var Feasib = await _db.tProjectLongFeasibilityEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.Feasibility);
                        if (Feasib == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.ProjectDetails!.Feasibility}' is not valid!", Title = "Invalid Feasibility" });
                        }
                        var OldFeasibility = await _db.tProjectLongFeasibilityEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == Project.Feasibility);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Feasibility.ToString()!,
                            OldValue = Project.Feasibility.ToString()!
                        });
                        Project.Feasibility = dto.ProjectDetails!.Feasibility;
                    }
                    if (Project.FeasibilityDate != dto.ProjectDetails?.FeasibilityDate)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.FeasibilityDate.ToString()!,
                            OldValue = Project.FeasibilityDate.ToString()!
                        });
                        Project.FeasibilityDate = dto.ProjectDetails?.FeasibilityDate;
                    }
                    if (Project.DetailedDesign != dto.ProjectDetails?.DetailedDesign)
                    {
                        var DetailedDesign = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.DetailedDesign);
                        if (DetailedDesign == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{dto.ProjectDetails!.DetailedDesign}' is not valid!", Title = "Invalid Detailed Design" });
                        }
                        var OldDetailedDesign = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == Project.DetailedDesign);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.DetailedDesign.ToString()!,
                            OldValue = Project.DetailedDesign.ToString()!
                        });
                        Project.DetailedDesign = dto.ProjectDetails!.DetailedDesign;
                    }
                    if (Project.DetailedDesignDate != dto.ProjectDetails?.DetailedDesignDate)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.DetailedDesignDate.ToString()!,
                            OldValue = Project.DetailedDesignDate.ToString()!
                        });
                        Project.DetailedDesignDate = dto.ProjectDetails?.DetailedDesignDate;
                    }
                    if (Project.RowAvailable != dto.ProjectDetails?.RowAvailable)
                    {
                        var RowAvailable = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.EmergencyMode);
                        if (RowAvailable == null)
                        {
                            return new BadRequestObjectResult(new { Message = $"Selected Row Available '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Row Available" });
                        }
                        var OldRowAvailable = await _db.tProjectEmergencyModeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == Project.RowAvailable);
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.RowAvailable.ToString()!,
                            OldValue = Project.RowAvailable.ToString()!
                        });
                        Project.RowAvailable = dto.ProjectDetails!.RowAvailable;
                    }
                    if (Project.RegionWide != dto.ProjectDetails?.RegionWide)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.RegionWide.ToString()!,
                            OldValue = Project.RegionWide.ToString()!
                        });
                        Project.RegionWide = dto.ProjectDetails!.RegionWide;
                    }
                    if (Project.Tier != dto.ProjectDetails?.Tier)
                    {
                        hasUpdated = true;
                        changelogs.Add(new PCMARevisionChangelogs
                        {
                            RevisionDetailsId = RevisionId,
                            NewValue = dto.ProjectDetails!.Tier.ToString()!,
                            OldValue = Project.Tier.ToString()!
                        });
                        Project.Tier = dto.ProjectDetails!.Tier;
                    }
                    if (hasUpdated)
                    {
                        //var LatestRevision = await _db.tProjectRevisions.AsNoTracking()
                        //    .Where(x => x.ProjectId == Project.ProjectId)
                        //    .OrderByDescending(x => x.RevisionNumber)
                        //    .FirstOrDefaultAsync();
                        //var NewRevision = new ProjectRevisions()
                        //{
                        //    ProjectId = Project.ProjectId!,
                        //    AlternateId = Project.AlternateId,
                        //    ExternalId = Project.ExternalId,
                        //    MYId = Project.MYId,
                        //    UACS = Project.UACS,
                        //    MYCAApprovalDate = Project.MYCAApprovalDate,
                        //    IslandCode = Project.IslandCode!,
                        //    RevisionNumber = LatestRevision!.RevisionNumber! + 1,
                        //    Description = Project!.Description!,
                        //    Category = Project!.Category,
                        //    Thrust = Project!.Thrust,
                        //    Origin = Project!.Origin,
                        //    City = Project!.City,
                        //    LegislativeDistrict = Project!.LegislativeDistrict,
                        //    OperatingUnit = Project!.OperatingUnit!,
                        //    ImplementingOffice = Project!.ImplementingOffice!,
                        //    DEO = Project.DEO!,
                        //    Region = Project.Region!,
                        //    Agency = Project.Agency,
                        //    ImplementationMode = Project.ImplementationMode,
                        //    EmergencyMode = Project.EmergencyMode,
                        //    Feasibility = Project.Feasibility,
                        //    DetailedDesign = Project.DetailedDesign,
                        //    RowAvailable = Project.RowAvailable,
                        //    CreatedBy = _Session.UserId,
                        //    CreatedDate = CurrentDate
                        //};
                        //await _db.tProjectRevisions.AddAsync(NewRevision);
                        //await _db.SaveChangesAsync();
                        //var newStage = new ProjectStages()
                        //{
                        //    ProgramId = Program.ProgramId!,
                        //    RevisionId = NewRevision.Id,
                        //    StageId = Program.StageId,
                        //    StageName = Program.StageName,
                        //    CreatedBy = _Session.UserId,
                        //    CreatedDate = CurrentDate,
                        //    IsPublished = false
                        //};
                        //await _db.tProjectStages.AddAsync(newStage);
                    }
                }
                #endregion
                #region Update Funding Profile
                var existingFundingProfiles = await _db.tProjectFundingProfile
                    .Where(fp => fp.ProjectId == Details.ProjectId && fp.StageName == dto.ProjectDetails.StageName)
                    .ToListAsync();
                #endregion
                #region Update Component Costs
                #endregion
                #region Update Component Cost Year
                #endregion
                #region Update Major Item of Works
                #endregion
                #region Update Major Item of Work Locations
                #endregion

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
    }
}