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
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestRevision([FromBody] RequstRevisionsDTO dto)
        {
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = DateTime.UtcNow;
                var NewComponent = new List<ProjectComponentCost>();
                var NewComponentYear = new List<ProjectComponentCostYear>();
                var NewMajorWorkItem = new List<ProjectMajorWorkItem>();
                var NewMajorWorkLocations = new List<ProjectMajorWorkLocations>();
                #region Validations
                var Project = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectDetails.ProjectId && x.Id == dto.ProjectDetails.RevisionNumber);
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Invalid Project" });
                }
                var ProjectStage = await _db.tProjectStages.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionId == dto.ProjectDetails.RevisionNumber);
                if(ProjectStage == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Stage not found!", Title = "Invalid Project Stage" });
                }
                var RevisionRules = await _db.vRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionDetails.ReasonId);
                if(RevisionRules == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision type does not exist!", Title = "Invalid Revision Type" });
                }
                var RevisionCategory = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionRules.RevisionGroupId);
                if(RevisionCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision category does not match with the selected revision reason!", Title = "Invalid Revision Category" });
                }
                var HasPendingModification = await _db.tRevisionDetails.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TransactionId == dto.ProjectDetails.ProjectId);
                if(HasPendingModification != null && (HasPendingModification.COApproveStatus == DBHelper.Models.Enums.EnumRevisionStatus.Pending || HasPendingModification.RegionApproveStatus == DBHelper.Models.Enums.EnumRevisionStatus.Pending))
                {
                    return new BadRequestObjectResult(new { Message = "There is a pending modification request for this project. Please wait for the current request to be processed before submitting a new one.", Title = "Pending Modification Request" });
                }
                var jsonRules = JsonConvert.DeserializeObject<ModificationRules>(RevisionRules.Field);
                #endregion
                #region ProjectRevision
                var ProjectDetailsRules = jsonRules.ProjectDetailsRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ProjectDetailsRules) == true)
                .Select(p => p.Name)
                .ToList();
                var NewProjectRevision = dto.ProjectDetails;
                if(ProjectDetailsRules.Count > 0)
                {
                    hasUpdated = true;
                    Project = ProjectDetailsRules.UpdateRevisionData(NewProjectRevision, Project);
                }
                #endregion
                #region ComponentCosts
                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                var ComponentCostRules = jsonRules.ComponentCostRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostRules) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCost = dto.ComponentCosts;
                if (ComponentCostRules.Count > 0)
                {
                    foreach (var component in UpdateComponentCost)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ComponentCost.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            hasUpdated = true;
                            SelectedComponent.RevisedNumber = 1;
                            SelectedComponent = ComponentCostRules.UpdateRevisionData(component, SelectedComponent);
                            SelectedComponent.RevisedNumber = 1;
                        }
                    }
                }
                var NewComponentToInsert = UpdateComponentCost.Where(x => x.Id == 0);
                if(NewComponentToInsert.Count() > 0)
                {
                    NewComponent.AddRange(NewComponentToInsert.Select(x => new ProjectComponentCost
                    {
                        ProjectId = Project.ProjectId,
                        ReferenceId = x.ReferenceId,
                        ComponentType = x.ComponentType,
                        ComponentId = x.ComponentId,
                        Description = x.Description,
                        Total = x.Total,
                        StageName = ProjectStage.StageName,
                        RevisedNumber = 1,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }));
                }
                #endregion
                #region ComponentCostYear
                var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(c => c.ReferenceId).Contains(x.ParentId)).ToListAsync();
                var ComponentCostYearRules = jsonRules.ComponentCostYearRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostYearRules) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCostYear = dto.ComponentCostYear;
                if (ComponentCostYearRules.Count > 0)
                {
                    foreach (var year in UpdateComponentCostYear)
                    {
                        var UpdateCostYear = ComponentCostYear.FirstOrDefault(x => x.Id == year.Id);
                        if (UpdateCostYear != null)
                        {
                            hasUpdated = true;
                            UpdateCostYear = ComponentCostYearRules.UpdateRevisionData(year, UpdateCostYear);
                        }
                    }
                }
                var NewComponentYearToInsert = UpdateComponentCostYear.Where(x => NewComponentToInsert.Select(c => c.ReferenceId).Contains(x.ParentId));
                if (NewComponentYearToInsert.Count() > 0)
                {
                    NewComponentYear.AddRange(NewComponentYearToInsert.Select(x => new ProjectComponentCostYear
                    {
                        ParentId = x.ParentId,
                        CostYear = x.CostYear,
                        Cost = x.Cost,
                        StartDate = x.StartDate,
                        EndDate = x.EndDate,
                    }));
                }
                #endregion
                #region MajorWorkItem
                var MajorWorkItem = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                var MajorWorkItemRules = jsonRules.MajorItemOfWorkRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemOfWorkRules) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorItemOfWorks = dto.MajorItemOfWorks;
                if (MajorWorkItemRules.Count > 0)
                {
                    foreach (var item in UpdateMajorItemOfWorks)
                    {
                        var UpdateMajorWorkItem = MajorWorkItem.FirstOrDefault(x => x.Id == item.Id);
                        if (UpdateMajorWorkItem != null)
                        {
                            hasUpdated = true;
                            UpdateMajorWorkItem = MajorWorkItemRules.UpdateRevisionData(item, UpdateMajorWorkItem);
                            UpdateMajorWorkItem.RevisedNumber = 1;
                        }
                    }
                }
                var NewMajorItemOfWorksToInsert = UpdateMajorItemOfWorks.Where(x => x.Id == 0);
                if (NewMajorItemOfWorksToInsert.Count() > 0)
                {
                    NewMajorWorkItem.AddRange(NewMajorItemOfWorksToInsert.Select(x => new ProjectMajorWorkItem
                    {
                        ProjectId = Project.ProjectId,
                        ReferenceId = x.ReferenceId,
                        ComponentId = x.ComponentId,
                        YearOfWork = x.YearOfWork,
                        WorkTypeId = x.WorkTypeId,
                        InfraType = x.InfraType,
                        StageName = ProjectStage.StageName,
                        RevisedNumber = 1,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }));
                }
                #endregion
                #region MajorWorkLocations
                var MajorWorkLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorWorkItem.Select(c => c.ReferenceId).Contains(x.ParentId)).ToListAsync();
                var MajorItemLocationsRules = jsonRules.MajorItemLocationRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemLocationRules) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorWorkLocations = dto.MajorItemLocations;
                if (MajorWorkItemRules.Count > 0)
                {
                    foreach (var location in UpdateMajorWorkLocations)
                    {
                        var UpdateMajorWorkLocation = MajorWorkLocations.FirstOrDefault(x => x.Id == location.Id);
                        if (UpdateMajorWorkLocation != null)
                        {
                            hasUpdated = true;
                            UpdateMajorWorkLocation = MajorItemLocationsRules.UpdateRevisionData(location, UpdateMajorWorkLocation);
                        }
                    }
                }
                var NewMajorWorkLocationsToInsert = UpdateMajorWorkLocations.Where(x => NewMajorItemOfWorksToInsert.Select(c => c.ReferenceId).Contains(x.ParentId));
                if (NewMajorWorkLocationsToInsert.Count() > 0)
                {
                    NewMajorWorkLocations.AddRange(NewMajorWorkLocationsToInsert.Select(x => new ProjectMajorWorkLocations
                    {
                        ParentId = x.ParentId,
                        InfraId = x.InfraId,
                        DetailedScope = x.DetailedScope,
                        TargetUnitId = x.TargetUnitId,
                        TargetUnit = x.TargetUnit,
                        StartX = x.StartX,
                        StartY = x.StartY,
                        EndX = x.EndX,
                        EndY = x.EndY,
                        PhysicalTarget = x.PhysicalTarget,
                        StartStationLimit = x.StartStationLimit,
                        EndStationLimit = x.EndStationLimit,
                        From = x.From,
                        To = x.To,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }));
                }
                #endregion
                if (hasUpdated)
                {
                    Project.isRevised = true;
                    Project.RevisedNumber = (Project.RevisedNumber ?? 0) + 1;
                    await _db.tProjectRevisions.AddAsync(Project);
                    _db.tProjectComponentCost.UpdateRange(ComponentCost);
                    _db.tProjectComponentCostYear.UpdateRange(ComponentCostYear);
                    _db.tProjectMajorWorkItem.UpdateRange(MajorWorkItem);
                    _db.tProjectMajorWorkLocations.UpdateRange(MajorWorkLocations);
                    if(NewComponent.Count > 0)
                    {
                        await _db.tProjectComponentCost.AddRangeAsync(NewComponent);
                    }
                    if (NewComponentYear.Count > 0)
                    {
                        await _db.tProjectComponentCostYear.AddRangeAsync(NewComponentYear);
                    }
                    if (NewMajorWorkItem.Count > 0)
                    {
                        await _db.tProjectMajorWorkItem.AddRangeAsync(NewMajorWorkItem);
                    }
                    if (NewMajorWorkLocations.Count > 0)
                    {
                        await _db.tProjectMajorWorkLocations.AddRangeAsync(NewMajorWorkLocations);
                    }
                    await _db.tRevisionDetails.AddAsync(new RevisionDetails
                    {
                        TransactionId = Project.ProjectId + "-" + Project.RevisedNumber,
                        ModificationCategory = RevisionCategory.RevisionGroupId,
                        ModificationReason = RevisionRules.ReasonId,
                        RegionApproveStatus = DBHelper.Models.Enums.EnumRevisionStatus.Pending,
                        RegionApprover = null,
                        RegionApprovedDate = null,
                        COApproveStatus = DBHelper.Models.Enums.EnumRevisionStatus.Pending,
                        COApprover = null,
                        COApprovedDate = null,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    await _db.SaveChangesAsync();
                }
                string loc = System.IO.File.ReadAllText(SMTPClass.PathEmailTemplate);
                string Body = $@"
        <h3>Revision Information:</h3>
        <table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
            <tbody>
                <tr style='border-top: none; background: #00148b; color: #fff;'>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision Category</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision Reason</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Requested by</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Requested on</th>
                </tr>
                <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
                        <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                            {RevisionCategory.RevisionName}
                        </td>
                        <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd
                            {RevisionRules.Reason}
                        </td>
                        <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                            {_Session.UserId}
                        </td>
                        <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                            {CurrentDate}
                        </td>
                    </tr>
                </tbody>
        </table>
        <h3>Project Details Information:</h3>
        <table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
            <tbody>
                <tr style='border-top: none; background: #00148b; color: #fff;'>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Name</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Stage</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Reference Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Project Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Alternate Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>External Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>MY Id</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>UACS</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>MYCA Approval Date</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Island Code</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision #</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Description</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Category</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Thrust</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Origin</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>City</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Province</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Legislative District</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Operating Unit</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Implementing Office</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>DEO</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Region</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Agency</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Implementation Mode</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Emergency Mode</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Feasibility</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Feasibility Date</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Detailed Design</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Detailed Design Date</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>ROW Available</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Region Wide</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Tier</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created By</th>
                    <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Created Date</th>
                </tr>

                <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.ProgramId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.ProgramName}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{dto.ProjectDetails.StageName}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ReferenceId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ProjectId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.AlternateId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ExternalId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.MYId}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.UACS}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.MYCAApprovalDate}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.IslandCode}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RevisionNumber}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Description}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Category}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Thrust}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Origin}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.City}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Province}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.LegislativeDistrict}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.OperatingUnit}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ImplementingOffice}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DEO}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Region}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Agency}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.ImplementationMode}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.EmergencyMode}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Feasibility}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.FeasibilityDate}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DetailedDesign}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.DetailedDesignDate}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RowAvailable}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.RegionWide}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.Tier}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.CreatedBy}</td>
                    <td style='padding: .5em 1em; border: 1px solid #ddd;'>{Project.CreatedDate}</td>
                </tr>

            </tbody>
        </table>""";
                loc = loc.Replace("{Title}", "Project Revision <b><u>Request</u></b>");
                loc = loc.Replace("{Body}", Body);
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
                return Ok(
                    new
                    {
                        Message = "Revision request submitted successfully.",
                        Title = "Success"
                    }
                );
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
} 