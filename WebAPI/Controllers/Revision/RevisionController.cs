using Castle.Components.DictionaryAdapter.Xml;
using Castle.MicroKernel.Registration;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Functions.Revision;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Revision;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Reflection;
using System.Xml;
using WebAPI.Controllers.Login;
using WebAPI.Controllers.Programs;
using WebAPI.MicroService;
using static Helpers.ProjectHelper;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class RevisionController : CoreController
    {
        public RevisionController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        [HttpPost]
        public async Task<IActionResult> RevisionRequests([FromBody] RevisionRequestsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();


                if (!string.IsNullOrWhiteSpace(dto.Filters.TransactionId))
                {
                    filters.Add((
                        "v.TransactionId = @TransactionId",
                        "@TransactionId",
                        dto.Filters.TransactionId));
                }
                if (!string.IsNullOrWhiteSpace(dto.Filters.ProjectId))
                {
                    filters.Add((
                        "v.TransactionId = @TransactionId",
                        "@TransactionId",
                        dto.Filters.TransactionId));
                }
                if (!string.IsNullOrWhiteSpace(dto.Filters.RevisionType))
                {
                    filters.Add((
                        "v.RevisionType = @RevisionType",
                        "@RevisionStatus",
                        dto.Filters.RevisionType));
                }
                if (!string.IsNullOrWhiteSpace(dto.Filters.RevisionStatus))
                {
                    filters.Add((
                        "v.RevisionStatus = @RevisionStatus",
                        "@RevisionStatus",
                        dto.Filters.RevisionStatus));
                }
                if (!string.IsNullOrWhiteSpace(dto.Filters.CurrentStage))
                {
                    filters.Add((
                        "v.CurrentStage = @CurrentStage",
                        "@CurrentStage",
                        dto.Filters.CurrentStage));
                }

                string @Level = "IO";
                string[] UserGroup = _Session.UserGroupNames.ToArray();
                if (UserGroup.Contains("RPC"))
                {
                    @Level = "RO";
                }
                if (UserGroup.Contains("DPDAdmin"))
                {
                    @Level = "CO";
                }
                var sourceParameters =
                new List<(string ParamName, object? Value)>
                {
                    ("@Level", @Level)
                };
                FilterDataResult<RevisionQueue> result =
                    await _db.FilterDataCursor<
                        RevisionQueue,
                        RevisionRequestsFilter>(
                            tableName: $"fRevisionQueue",
                            sourceParameters: sourceParameters,
                            isTableValuedFunction: true,
                            dto: dto,
                            filter: filters,
                            keyColumn: "Id",
                            descending: true,
                            includeTotal: true,
                            ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(
                        new ErrorResult
                        {
                            Title = "Pagination error",
                            Message =
                                result.ErrorMessage ??
                                "Unable to retrieve the records."
                        });
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ViewReviseProject([FromBody] ViewReviseProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var RevisionTransation = dto.TransactionId.Split('-');
                string ProjectId = RevisionTransation[0];
                var Project = await _db.fRevisionProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fRevisionProjectDetails({dto.TransactionId})")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found or not in GAA-R stage.", Title = "Invalid Project" });
                }
                if (_Session.ApplyFilter && Project.Region == _Session.RegCode)
                {
                    return new BadRequestObjectResult(new { Message = "You don't have permission to view this project.", Title = "Permission Denied" });
                }
                //int? RevisedNumber = Project;
                var RevisionDetails = await _db.vRevisionLists.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId, cancellationToken);
                if (RevisionDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision details not found.", Title = "Invalid Revision" });
                }
                string ProjectRevisionStatus = (RevisionDetails.RegionStatus == EnumRevisionStatus.ForCorrection) ? RevisionDetails.RegionStatusName : RevisionDetails.COStatusName;

                #region Validate PCMA Status
                var ComponentCost = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                bool HasConstrunctionStatus = ComponentCost.Select(x => !string.IsNullOrEmpty(x.ConstructionStatusCode)).Any() ? true : false;
                if (ComponentCost == null || !HasConstrunctionStatus)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
                #region Project Construction Status Validation
                var UniqueComponentStatus = ComponentCost.Select(x => x.ConstructionStatusName).Distinct().ToList();
                string ConStatus = UniqueComponentStatus switch
                {
                    // Rule 0: If there are no components at all
                    { Count: 0 } => "No Components",

                    // Rule 1: "On-Going" ALWAYS wins if it exists anywhere in the list
                    _ when UniqueComponentStatus.Contains("On-Going")
                        => "On-Going",

                    // Rule 2: If the ONLY status in the list is "Terminated"
                    _ when UniqueComponentStatus.Count == 1 && UniqueComponentStatus.Contains("Terminated")
                        => "Terminated",

                    // Rule 3: If there is "Not Yet Started" mixed with anything else (except On-Going)
                    _ when UniqueComponentStatus.Contains("Not Yet Started")
                        => "Not Yet Started",

                    // Rule 4: If everything left is "Completed" (ignoring any Terminated components)
                    _ when UniqueComponentStatus.Contains("Completed")
                        => "Completed",

                    // Fallback default case
                    _ => string.Empty
                };
                #endregion
                #region Project Packaged Status Validation
                string PackedStatus =
                    (ComponentCost.FirstOrDefault(x => x.IsPackaged == true) != null) ?
                    "Not Packaged" :
                    "Packaged";
                #endregion
                DBHelper.Models.Views.RevisionRules SelectedRules = new();
                if (RevisionDetails.CreatedBy == _Session.UserId && (RevisionDetails.RegionStatus == EnumRevisionStatus.ForCorrection || RevisionDetails.COStatus == EnumRevisionStatus.ForCorrection))
                {
                    SelectedRules = await _db.vRevisionRules.FirstOrDefaultAsync(x => x.ReasonId == RevisionDetails.ReasonId && x.RevisionGroupId == RevisionDetails.RevisionGroupId && x.PCMA_Status == ConStatus && x.Package_Status == PackedStatus);
                }
                #endregion

                #region Validate Selected Revision Details
                var SelectedType = new OptionRevisionHeader();
                var SelectedCategory = new OptionRevisionCategory();
                var SelectedReason = new OptionRevisionReasons();
                SelectedType = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionDetails.RevisionGroupId);
                if (SelectedType == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Type not found.", Title = "Invalid Revision Type" });
                }
                //if (dto.RevisionCategory != null)
                //{
                //    SelectedCategory = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == dto.RevisionCategory);
                //    if (SelectedCategory == null)
                //    {
                //        return new BadRequestObjectResult(new { Message = "Revision Category not found!", Title = "Invalid Revision Category" });
                //    }
                //}
                SelectedReason = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == RevisionDetails.ReasonId && x.RevisionGroupId == RevisionDetails.RevisionGroupId);
                if (SelectedReason == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found.", Title = "Invalid Revision Reason" });
                }
                var RevisionDoc = await _db.tRevisionDocuments.AsNoTracking().Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                var ForCorrections = await _db.tRevisionForCorrectionDetails.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                #endregion

                #region Program Validation
                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = Project.ProgramFK,
                    StageName = "GAA-R",
                    _Session = _Session,
                }, cancellationToken);
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;

                #endregion

                #region Full Project Details
                int ProjectRevisionFK = Project.ProjectRevisionFK;
                string ProjectFK = Project.ProjectFK;
                int CurrentYear = (int)Functions.CurrentDate().Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisionFK).ToListAsync();
                var SupportingDoc = await _db.tOptionSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                //var ComponentCost = await _db.vRevisionProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.TransactionId == dto.TransactionId).ToListAsync();
                //var ComponentCost = await _db.tProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fPendingProjectComponentCost({dto.TransactionId}) fp WHERE fp.StageName = {Project.StageName}").AsNoTracking().ToListAsync();


                var ComponentCostYear = await _db.fProjectComponentCostPerYear.FromSqlInterpolated($"SELECT * FROM fProjectComponentCostPerYear({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);

                var MajorItemOfWork = await _db.fProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var MajorWorkLocation = await _db.fProjectMajorWorkLocations.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkLocations({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);



                //var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Funding = await _db.fProjectFundingProfile.FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({ProjectFK},{EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                #endregion

                #region TransactionLogs
                var Logs = await _db.tRevisionTransactionLog.AsNoTracking().Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                #endregion

                #region Dropdowns
                var ComponentType = await _db.tOptionProjectComponentType.AsNoTracking().OrderBy(x => x.ComponentName).ToListAsync();
                var Category = await _db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.CategoryName).ToListAsync();
                var Thrust = await _db.tOptionProjectThrustList.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tOptionProjectOrigin.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.vAdminDEO.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tOptionProjectAgency.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                var Agreement = await _db.tOptionFundingAgreement.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Source = await _db.tOptionFundingSource.AsNoTracking().OrderBy(x => x.Organization == "GOP" ? 0 : 1).ThenBy(x => x.Name).ToListAsync();

                var ScopeOfWork = await _db.tOptionScopeOfWork.AsNoTracking().OrderBy(x => x.WorkCategory).ToListAsync();
                var InfraTypes = await _db.tOptionInfraType.AsNoTracking().OrderBy(x => x.InfraName).ToListAsync();
                #endregion

                return Ok(new
                {
                    Header = SelectedType,
                    Category = SelectedCategory,
                    Reason = SelectedReason,

                    RevisionDetails = RevisionDetails,
                    ForCorrectionsDetails = ForCorrections,
                    RevisionDocs = RevisionDoc,
                    ProjectStatus = new
                    {
                        ConstructionStatus = ConStatus,
                        PackageStatus = PackedStatus,
                        RevisionStatus = ProjectRevisionStatus
                    },

                    Rules = SelectedRules,
                    ComponentsStatus = ComponentCost,

                    IsActive = true,
                    ProgramDetails = ProgramRevision,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    MajorItemLocations = MajorWorkLocation,
                    //ProjectNotes = Notes,

                    Docs = Doc,
                    FundingProfile = Funding,
                    TransactionLogs = Logs,
                    Dropdowns = new
                    {
                        //Project Details
                        Categories = Category,
                        Thrusts = Thrust,
                        Origins = Origin,
                        Cities = City,
                        Provinces = Province,
                        LDs = LD,
                        OperatingUnits = OperatingUnit,
                        IOs = IO,
                        DEOs = DEO,
                        Regions = Region,
                        Feasibility = Feasib,
                        Agencies = Agency,
                        ImplementationModes = ImplementationMode,
                        EmergencyModes = EmergencyMode,

                        //SupportingDocs
                        SupportingDocs = SupportingDoc,

                        //Component Cost
                        ComponentTypes = ComponentType,

                        //Major Item Of Work
                        ScopeOfWorks = ScopeOfWork,
                        InfraTypes = InfraTypes,

                        //Funding Profile
                        Agreements = Agreement,
                        Sources = Source,
                    }
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ReviseProject([FromBody] ReviseProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var Project = await _db.fProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.StageName = 'GAA-R' AND fp.ProjectId = {dto.ProjectId} AND ({regionCode} IS NULL OR fp.Region = {regionCode})")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found or not in GAA-R stage.", Title = "Invalid Project" });
                }
                var ComponentCost = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({dto.ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                bool HasConstrunctionStatus = ComponentCost.Select(x => !string.IsNullOrEmpty(x.ConstructionStatusCode)).Any() ? true : false;
                if (ComponentCost == null || !HasConstrunctionStatus)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
                if (dto.RevisionHeader == 9 || dto.RevisionHeader == 16 || dto.RevisionReason == 47)
                {
                    var hasTerminated = ComponentCost.FirstOrDefault(x => x.ConstructionStatusName == "Terminated");
                    if (hasTerminated == null)
                    {
                        return new BadRequestObjectResult(new { Message = "Project has no terminated components", Title = "No Terminated Components" });
                    }
                }

                var HasPendingModification = await _db.vRevisionLists
                    .FromSqlInterpolated($"SELECT * FROM vRevisionLists v WHERE v.TransactionId LIKE {dto.ProjectId + "-%"} AND v.COStatus != {EnumRevisionStatus.Approved}")
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cancellationToken);
                if (HasPendingModification != null && (HasPendingModification.RegionStatus == EnumRevisionStatus.Pending || HasPendingModification.COStatus == EnumRevisionStatus.Pending))
                {
                    return new BadRequestObjectResult(new { Message = $"There is a pending {HasPendingModification.RevisionName} request for this project. Please wait for the current request to be processed before submitting a new one.", Title = "Pending Modification Request" });
                }
                #region Validate PCMA Status
                if (ComponentCost == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
                #region Project Construction Status Validation
                var UniqueComponentStatus = ComponentCost.Select(x => x.ConstructionStatusName).Distinct().ToList();
                string ConStatus = UniqueComponentStatus switch
                {
                    // Rule 0: If there are no components at all
                    { Count: 0 } => "No Components",

                    // Rule 1: "On-Going" ALWAYS wins if it exists anywhere in the list
                    _ when UniqueComponentStatus.Contains("On-Going")
                        => "On-Going",

                    // Rule 2: If the ONLY status in the list is "Terminated"
                    _ when UniqueComponentStatus.Count == 1 && UniqueComponentStatus.Contains("Terminated")
                        => "Terminated",

                    // Rule 3: If there is "Not Yet Started" mixed with anything else (except On-Going)
                    _ when UniqueComponentStatus.Contains("Not Yet Started")
                        => "Not Yet Started",

                    // Rule 4: If everything left is "Completed" (ignoring any Terminated components)
                    _ when UniqueComponentStatus.Contains("Completed")
                        => "Completed",

                    // Fallback default case
                    _ => string.Empty
                };
                #endregion
                #region Project Packaged Status Validation
                string PackedStatus =
                    (ComponentCost.FirstOrDefault(x => x.IsPackaged == true) != null) ?
                    "Not Packaged" :
                    "Packaged";
                #endregion

                var SelectedRules = await _db.vRevisionRules.FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason && x.RevisionGroupId == dto.RevisionHeader && x.PCMA_Status == ConStatus && x.Package_Status == PackedStatus, cancellationToken);
                #endregion

                #region Validate Selected Revision Details
                var SelectedType = new DBHelper.Models.Table.Revision.OptionRevisionHeader();
                var SelectedCategory = new DBHelper.Models.Table.Revision.OptionRevisionCategory();
                var SelectedReason = new DBHelper.Models.Table.Revision.OptionRevisionReasons();
                SelectedType = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == dto.RevisionHeader, cancellationToken);
                if (SelectedType == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Type not found.", Title = "Invalid Revision Type" });
                }
                if (dto.RevisionCategory != null)
                {
                    SelectedCategory = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == dto.RevisionCategory);
                    if (SelectedCategory == null)
                    {
                        return new BadRequestObjectResult(new { Message = "Revision Category not found.", Title = "Invalid Revision Category" });
                    }
                }
                SelectedReason = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason && x.RevisionGroupId == dto.RevisionHeader);
                if (SelectedReason == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found.", Title = "Invalid Revision Reason" });
                }
                #endregion

                #region Program Validation
                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = Project.ProgramFK,
                    StageName = "GAA-R",
                    _Session = _Session,
                }, cancellationToken);
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;
                #endregion

                #region Full Project Details
                int ProjectRevisionFK = Project.Id;
                string ProjectFK = Project.ProjectFK;
                int CurrentYear = (int)Functions.CurrentDate().Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisionFK).ToListAsync();
                var SupportingDoc = await _db.tOptionSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                //var ComponentCost = await _db.vRevisionProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.TransactionId == dto.TransactionId).ToListAsync();
                //var ComponentCost = await _db.tProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fPendingProjectComponentCost({dto.TransactionId}) fp WHERE fp.StageName = {Project.StageName}").AsNoTracking().ToListAsync();


                var ComponentCostYear = await _db.fProjectComponentCostPerYear.FromSqlInterpolated($"SELECT * FROM fProjectComponentCostPerYear({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);

                var MajorItemOfWork = await _db.fProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var MajorWorkLocation = await _db.fProjectMajorWorkLocations.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkLocations({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);



                //var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Funding = await _db.fProjectFundingProfile.FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({ProjectFK},{EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                #endregion

                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.ReferenceId == dto.ProjectId).ToListAsync();

                #region Dropdowns
                var ComponentType = await _db.tOptionProjectComponentType.AsNoTracking().OrderBy(x => x.ComponentName).ToListAsync();
                var Category = await _db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.CategoryName).ToListAsync();
                var Thrust = await _db.tOptionProjectThrustList.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tOptionProjectOrigin.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.vAdminDEO.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tOptionProjectAgency.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                var Agreement = await _db.tOptionFundingAgreement.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Source = await _db.tOptionFundingSource.AsNoTracking().OrderBy(x => x.Organization == "GOP" ? 0 : 1).ThenBy(x => x.Name).ToListAsync();

                var InfraTypes = await _db.tOptionInfraType.AsNoTracking().OrderBy(x => x.InfraName).ToListAsync();
                var ScopeOfWork = await _db.tOptionScopeOfWork.AsNoTracking().OrderBy(x => x.WorkCategory).ToListAsync();
                #endregion

                return Ok(new
                {
                    Header = SelectedType,
                    Category = SelectedCategory,
                    Reason = SelectedReason,

                    ProjectStatus = new
                    {
                        ConstructionStatus = ConStatus,
                        PackageStatus = PackedStatus
                    },

                    Rules = SelectedRules,

                    IsActive = true,
                    ProgramDetails = ProgramRevision,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    MajorItemLocations = MajorWorkLocation,
                    //ProjectNotes = Notes,

                    Docs = Doc,
                    FundingProfile = Funding,
                    TransactionLogs = Transactions,
                    Dropdowns = new
                    {
                        //Project Details
                        Categories = Category,
                        Thrusts = Thrust,
                        Origins = Origin,
                        Cities = City,
                        Provinces = Province,
                        LDs = LD,
                        OperatingUnits = OperatingUnit,
                        IOs = IO,
                        DEOs = DEO,
                        Regions = Region,
                        Feasibility = Feasib,
                        Agencies = Agency,
                        ImplementationModes = ImplementationMode,
                        EmergencyModes = EmergencyMode,

                        //SupportingDocs
                        SupportingDocs = SupportingDoc,

                        //Component Cost
                        ComponentTypes = ComponentType,

                        //Major Item Of Work
                        ScopeOfWorks = ScopeOfWork,
                        InfraTypes = InfraTypes,

                        //Funding Profile
                        Agreements = Agreement,
                        Sources = Source,
                    }
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestRevision([FromBody] RequstRevisionsDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (_Session.UserGroupNames.Count() == 0)
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to submit Revision. Please contact administrator.", Title = "User Groups Missing" });
                }
                if (dto.RevisionDetails.ApprovedDocument == null)
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document is required.", Title = "Missing Approved Document" });
                }
                if (dto.RevisionDetails.ApprovedDocument.IsPdfCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file is corrupted or not a valid PDF.", Title = "Invalid File" });
                }
                if (!dto.RevisionDetails.ApprovedDocument.ValidateFileSize(50))
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file size exceeds the maximum limit of 50 MB.", Title = "File Size Exceeded" });
                }
                string User = _Session.UserId;
                DateTime CurrentDate = Functions.CurrentDate();
                var NewRevisionProject = new RevisionProjects();

                var NewFundingProfile = new List<RevisionProjectFundingProfile>();
                var NewComponent = new List<DBHelper.Models.Table.Revision.RevisionProjectComponentCost>();
                var NewComponentPerYear = new List<DBHelper.Models.Table.Revision.RevisionProjectComponentCostPerYear>();
                var NewMajorWorkItem = new List<DBHelper.Models.Table.Revision.RevisionProjectMajorWorkItem>();
                var NewMajorWorkLocations = new List<DBHelper.Models.Table.Revision.RevisionProjectMajorWorkLocations>();
                var NewProjectRevision = dto.ProjectDetails;
                var ProjectRevision = new ProjectDetails();
                List<RevisionTransactionLog> Logs = new List<RevisionTransactionLog>();
                #region Validations

                #region Project Details
                string ProjectId = dto.ProjectDetails.ProjectId;
                string StageName = dto.ProjectDetails.StageName;
                string ProgramFK = dto.ProjectDetails.ProgramFK;
                string ProjectFK = dto.ProjectDetails.ProjectFK;
                var ValidateProjectId = await _db.ValidateProjectId(new ValidateProjectIdParams
                {
                    ProjectId = ProjectId,
                    StageName = StageName,
                    _Session = _Session,
                }, cancellationToken);
                if (!ValidateProjectId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProjectId.Title,
                        Message = ValidateProjectId.Message
                    });
                }
                var ProjectParent = ValidateProjectId.Data.Project;
                var ProjectRevisions = ValidateProjectId.Data.ProjectRevision;
                var ProjectStage = ValidateProjectId.Data.ProjectStage;

                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = ProgramFK,
                    StageName = StageName,
                    _Session = _Session,
                }, cancellationToken);
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;


                var RevisionRules = await _db.vRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionDetails.ReasonId && x.PCMA_Status == dto.RevisionDetails.ConstructionStatus && x.Package_Status == dto.RevisionDetails.PackageStatus);
                if (RevisionRules == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision type does not exist in PCMA_Status: {dto.RevisionDetails.ConstructionStatus} Package_Status: {dto.RevisionDetails.PackageStatus}.", Title = "Invalid Revision Type" });
                }
                var RevisionCategory = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionRules.RevisionGroupId);
                if (RevisionCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision category does not match with the selected revision reason.", Title = "Invalid Revision Category" });
                }
                var DocumentNaming = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => (x.CategoryId != null && x.CategoryId == dto.RevisionDetails.CategoryId) || x.RevisionGroupId == RevisionCategory.RevisionGroupId);
                if (DocumentNaming == null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return new BadRequestObjectResult(new { Message = "Document naming convention not found for the selected revision reason. Please contact Administrator.", Title = "Missing Document Naming" });
                }
                var HasPendingModification = await _db.vRevisionLists.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TransactionId.Contains(dto.ProjectDetails.ProjectId!) && x.COStatus != EnumRevisionStatus.Approved);
                if (HasPendingModification != null && (HasPendingModification.COStatus == EnumRevisionStatus.Pending || HasPendingModification.RegionStatus == EnumRevisionStatus.Pending))
                {
                    return new BadRequestObjectResult(new { Message = $"There is a pending {HasPendingModification.RevisionName} request for this project. Please wait for the current request to be processed before submitting a new one.", Title = "Pending Modification Request" });
                }
                var jsonRules = JsonConvert.DeserializeObject<ModificationRules>(RevisionRules.Field);
                if (jsonRules == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Rules does not exist in {RevisionRules.Reason}. Please contact admin.", Title = "No Rules Exists" });
                }
                ProjectParent.IsRevised = true;
                ProjectParent.PCMARevisionCount = ProjectParent.PCMARevisionCount + 1;
                string TransactionId = ProjectId + "-" + ProjectParent.PCMARevisionCount;
                //var HasTransactionId = await _db.tRevisionDetails.Where(x => x.TransactionId.Contains(ProjectId + "-")).OrderByDescending(x => x.Id).FirstOrDefaultAsync(cancellationToken);
                //if (HasTransactionId != null)
                //{
                //    var SplitTransaction = HasTransactionId.TransactionId.Split("-");
                //    TransactionId = ProjectId + "-" + (int.Parse(SplitTransaction[1]) + 1).ToString();
                //}
                bool isROUser = _Session.UserGroupNames.Contains("RPC");
                bool isCOUser = _Session.UserGroupNames.Contains("AUC");
                #endregion
                #region Funding Profile
                var BlankFunding = dto.FundingProfile.Where(x => x.Amount <= 0).ToList();
                if (!BlankFunding.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid amount(s). Please check and try again.", Title = "Invalid Funding Profile Amount" });
                }
                var BlankFundingSource = dto.FundingProfile.Where(x => string.IsNullOrEmpty(x.SourceOrg)).ToList();
                if (!BlankFundingSource.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid source(s). Please check and try again.", Title = "Invalid Funding Profile Source" });
                }
                var BlankFundingAgreement = dto.FundingProfile.Where(x => string.IsNullOrEmpty(x.AgreementCode)).ToList();
                if (!BlankFundingAgreement.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid agreement(s). Please check and try again.", Title = "Invalid Funding Profile Agreement" });
                }
                #endregion
                #region Component Cost
                var BlankComponentCost = dto.ComponentCosts.Where(x => x.Total < 1 && x.Id == 0).ToList();
                if (!BlankComponentCost.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Component Cost contains invalid amount(s). Please check and try again.", Title = "Invalid Component Cost Amount" });
                }
                var BlankComponentType = dto.ComponentCosts.Where(x => string.IsNullOrEmpty(x.ComponentType)).ToList();
                if (!BlankComponentType.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Component Cost contains invalid component type(s). Please check and try again.", Title = "Invalid Component Cost Type" });
                }
                var DuplicateComponentId = dto.ComponentCosts.Where(x => x.Id == 0).GroupBy(x => x.ComponentId).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
                if (DuplicateComponentId.Any())
                {
                    return new BadRequestObjectResult(new { Message = $"Component Cost contains duplicate component IDs: {string.Join(", ", DuplicateComponentId)}. Please check and try again.", Title = "Duplicate Component IDs" });
                }

                var ExistingComponentCosts = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);

                var NewComponentIds = dto.ComponentCosts.Where(x => x.Id == 0).Select(x => x.ComponentId).ToList();
                var DuplicateExistingComponentId = ExistingComponentCosts.Where(x => NewComponentIds.Contains(x.ComponentId)).Select(x => x.ComponentId).ToList();

                var CheckIsDeletedComponent = dto.ComponentCosts.Where(x => x.Id != 0 && x.IsDeleted == true).ToList();
                var HasNoDeletedComponent = DuplicateExistingComponentId
                    .Where(componentId => !CheckIsDeletedComponent
                        .Any(x => x.ComponentId == componentId))
                    .ToList();
                if (HasNoDeletedComponent.Any())
                {
                    return new BadRequestObjectResult(new { Message = $"Component Cost contains component IDs that already exist in the system: {string.Join(", ", HasNoDeletedComponent)}. Please check and try again.", Title = "Duplicate Existing Component IDs" });
                }
                #endregion
                #region Major Work Item

                var DuplicateMajorItemComponentId = dto.MajorItemOfWorks.Where(x => x.Id == 0).GroupBy(x => x.ComponentId).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
                if (DuplicateMajorItemComponentId.Any())
                {
                    return new BadRequestObjectResult(new { Message = $"Major Work Item contains duplicate component IDs: {string.Join(", ", DuplicateMajorItemComponentId)}. Please check and try again.", Title = "Duplicate Major Work Item Component IDs" });
                }
                var ExistingMajorItemComponentIds = await _db.fProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().Select(x => x.ComponentId).ToListAsync(cancellationToken);
                var NewMajorItemComponentIds = dto.MajorItemOfWorks.Where(x => x.Id == 0).Select(x => x.ComponentId).ToList();
                var DuplicateExistingMajorItemComponentIds = ExistingMajorItemComponentIds.Where(x => NewMajorItemComponentIds.Contains(x)).ToList();

                var CheckIsDeletedMajorItem = dto.MajorItemOfWorks.Where(x => x.Id != 0 && x.IsDeleted == true).ToList();
                var HasNoDeletedMajorItem = DuplicateExistingMajorItemComponentIds
                    .Where(componentId => !CheckIsDeletedMajorItem
                        .Any(x => x.ComponentId == componentId))
                    .ToList();
                if (HasNoDeletedMajorItem.Any())
                {
                    return new BadRequestObjectResult(new { Message = $"Major Work Item contains component IDs that already exist in the system: {string.Join(", ", DuplicateExistingMajorItemComponentIds)}. Please check and try again.", Title = "Duplicate Existing Major Work Item Component IDs" });
                }
                #endregion
                #region Major Work Location

                var duplicates = dto.MajorItemLocations
                    .Where(x => !x.IsDeleted && !string.IsNullOrEmpty(x.StartStationLimit) && !string.IsNullOrEmpty(x.EndStationLimit) && x.Id == 0)
                    .Select((item, index) => new { Item = item, Index = index })
                    .GroupBy(x => new
                    {
                        DetailedScope = (x.Item.DetailedScope!).Trim().ToUpperInvariant(),
                        StartStation = (x.Item.StartStationLimit!).Trim().ToUpperInvariant(),
                        EndStation = (x.Item.EndStationLimit!).Trim().ToUpperInvariant()
                    })
                    .Where(g => g.Count() > 1)
                    .Select(g => new
                    {
                        DetailedScope = g.Key.DetailedScope,
                        StartStationLimit = g.Key.StartStation,
                        EndStationLimit = g.Key.EndStation,
                        Count = g.Count(),
                        Rows = g.Select(x => new
                        {
                            Id = x.Item.Id,
                            ComponentId = x.Item.ComponentId,
                            InfraId = x.Item.InfraId,
                            DetailedScopeOriginal = x.Item.DetailedScope,
                            StartStationLimitOriginal = x.Item.StartStationLimit,
                            EndStationLimitOriginal = x.Item.EndStationLimit
                        }).ToList()
                    })
                    .ToList();

                if (duplicates.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Duplicate MajorItemLocations",
                        Message = "Found duplicate MajorItemLocations by DetailedScope + StartStationLimit + EndStationLimit.",
                        Duplicates = duplicates
                    });
                }
                #endregion

                #endregion

                #region ProjectRevision
                var ProjectDetailsRules = jsonRules.ProjectDetailsRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ProjectDetailsRules) == true)
                .Select(p => p.Name)
                .ToList();
                ProjectRevision.ProjectId = (RevisionRules.RevisionGroupId == 13) ? $"{ProjectRevision.ProjectId}-A" : ProjectRevision.ProjectId;
                if (ProjectRevisions != null)
                {
                    var UpdateAndGenerateLogs = ProjectDetailsRules.UpdateRevisionData(User, TransactionId, "tRevisionProjects", CurrentDate, NewProjectRevision, ProjectRevisions);
                    Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                    ProjectRevision = UpdateAndGenerateLogs.Data;
                    NewRevisionProject.IsActive = isCOUser ? true : false;
                    NewRevisionProject.TransactionId = TransactionId;
                    NewRevisionProject.RevisionId = ProjectRevision.Id;
                    NewRevisionProject.ProjectFK = ProjectRevisions.ProjectFK;
                    NewRevisionProject.ProjectId = ProjectRevision.ProjectId;
                    NewRevisionProject.ProgramFK = ProjectRevision.ProgramFK;
                    NewRevisionProject.ProgramId = ProjectRevision.ProgramId;
                    NewRevisionProject.AlternateId = ProjectRevision.AlternateId;
                    NewRevisionProject.ExternalId = ProjectParent.ExternalId;
                    NewRevisionProject.MYId = ProjectParent.MYId;
                    //NewRevisionProject.UACS = ProjectRevision.UACS;
                    NewRevisionProject.MYCAApprovalDate = ProjectRevision.MYCAApprovalDate;
                    NewRevisionProject.Description = ProjectRevision.Description;
                    NewRevisionProject.Region = ProjectRevision.Region;
                    NewRevisionProject.Province = ProjectRevision.Province;
                    NewRevisionProject.City = ProjectRevision.City;
                    NewRevisionProject.LegislativeDistrict = ProjectRevision.LegislativeDistrict;
                    NewRevisionProject.DEO = ProjectRevision.DEO;
                    NewRevisionProject.OperatingUnit = ProjectRevision.OperatingUnit;
                    NewRevisionProject.ImplementingOffice = ProjectRevision.ImplementingOffice;
                    NewRevisionProject.IslandCode = ProjectRevision.IslandCode;
                    NewRevisionProject.Category = ProjectRevision.Category;
                    NewRevisionProject.Thrust = ProjectRevision.Thrust;
                    NewRevisionProject.Origin = ProjectRevision.Origin;
                    NewRevisionProject.Agency = ProjectRevision.Agency;
                    NewRevisionProject.ImplementationMode = ProjectRevision.ImplementationMode;
                    NewRevisionProject.EmergencyMode = ProjectRevision.EmergencyMode;
                    NewRevisionProject.RegionWide = ProjectRevision.RegionWide;
                    NewRevisionProject.Feasibility = ProjectRevision.Feasibility;
                    NewRevisionProject.FeasibilityDate = ProjectRevision.FeasibilityDate;
                    NewRevisionProject.DetailedDesign = ProjectRevision.DetailedDesign;
                    NewRevisionProject.DetailedDesignDate = ProjectRevision.DetailedDesignDate;
                    NewRevisionProject.RowAvailable = ProjectRevision.RowAvailable;
                    NewRevisionProject.Tier = ProjectRevision.Tier;
                    NewRevisionProject.Rank = ProjectRevision.Rank;
                    NewRevisionProject.CreatedBy = User;
                    NewRevisionProject.CreatedDate = CurrentDate;
                    NewRevisionProject.IsDeleted = false;
                }
                #endregion
                #region FundingProfile
                var FundingIds = dto.FundingProfile.Where(x => x.Id != 0).Select(x => x.Id);
                //var FundingProfile = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && FundingIds.Contains(x.Id)).ToListAsync();
                var FundingProfile = await _db.fProjectFundingProfile.FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({ProjectFK},{EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var FundingProfileRules = jsonRules.FundingProfileRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.FundingProfileRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateFundingProfile = dto.FundingProfile.Where(x => x.Id != 0);
                if (FundingProfile.Count > 0)
                {
                    bool CanDelete = jsonRules.FundingProfileRules.CRUD.CanDelete;
                    foreach (var component in UpdateFundingProfile)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = FundingProfile.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            if (FundingProfileRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = FundingProfileRules.UpdateRevisionData(User, TransactionId, "tRevisionProjectFundingProfile", CurrentDate, component, SelectedComponent);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponent = UpdateAndGenerateLogs.Data;
                            }
                            var AddRow = new RevisionProjectFundingProfile
                            {
                                TransactionId = TransactionId,
                                SourceOrg = SelectedComponent.SourceOrg,
                                AgreementCode = SelectedComponent.AgreementCode,
                                Amount = SelectedComponent.Amount,
                                Percentage = SelectedComponent.Percentage,
                                IsDeleted = CanDelete ? component.IsDeleted : false
                            };
                            NewFundingProfile.Add(AddRow);
                            if (CanDelete)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = TransactionId,
                                    AffectedTable = "tRevisionProjectFundingProfile",
                                    TypeOfTransaction = "Delete",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(AddRow),
                                    NewValue = string.Empty,
                                    CreatedBy = User,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }
                }
                if (jsonRules.FundingProfileRules.CRUD.CanAdd)
                {
                    var NewFunding = dto.FundingProfile.Where(x => x.Id == 0);
                    Logs.AddRange(NewFunding.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = TransactionId,
                        AffectedTable = "tRevisionProjectFundingProfile",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "FundingProfile",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    NewFundingProfile.AddRange(NewFunding.Select(x => new RevisionProjectFundingProfile
                    {
                        TransactionId = TransactionId,
                        SourceOrg = x.SourceOrg,
                        AgreementCode = x.AgreementCode,
                        Amount = x.Amount,
                        Percentage = x.Percentage,
                    }));
                }
                //else
                //{
                //    return new BadRequestObjectResult(new
                //    {
                //        Message = "Submission failed. Funding Profile is required before submitting a revision.",
                //        Title = "Funding Profile Required"
                //    });
                //}
                #endregion
                #region ComponentCosts
                var CostIds = dto.ComponentCosts.Where(x => x.Id != 0).Select(x => x.Id).ToList();
                var ComponentCost = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var ComponentCostYear = await _db.fProjectComponentCostPerYear.FromSqlInterpolated($"SELECT * FROM fProjectComponentCostPerYear({ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var ComponentCostRules = jsonRules.ComponentCostRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCost = dto.ComponentCosts.Where(x => x.Id != 0);
                if (ComponentCost.Count > 0)
                {
                    bool CanDelete = jsonRules.ComponentCostRules.CRUD.CanDelete;
                    foreach (var component in UpdateComponentCost)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ComponentCost.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            if (ComponentCostRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = ComponentCostRules.UpdateRevisionData(User, TransactionId, "tRevisionProjectComponentCost", CurrentDate, component, SelectedComponent);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponent = UpdateAndGenerateLogs.Data;
                            }
                            var AddRow = new DBHelper.Models.Table.Revision.RevisionProjectComponentCost
                            {
                                TransactionId = TransactionId,
                                ComponentType = SelectedComponent.ComponentType,
                                ComponentId = SelectedComponent.ComponentId,
                                Description = SelectedComponent.Description,
                                Total = (decimal)SelectedComponent.Total!,
                                IsDeleted = CanDelete ? component.IsDeleted : false,
                            };
                            NewComponent.Add(AddRow);
                            if (CanDelete)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = TransactionId,
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    TypeOfTransaction = "Delete",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(AddRow),
                                    NewValue = string.Empty,
                                    CreatedBy = User,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }

                }
                if (jsonRules.ComponentCostRules.CRUD.CanAdd)
                {
                    var NewCost = dto.ComponentCosts.Where(x => x.Id == 0);
                    Logs.AddRange(NewCost.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = TransactionId,
                        AffectedTable = "tRevisionProjectComponentCost",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "ComponentCost",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    NewComponent.AddRange(NewCost.Select(x => new DBHelper.Models.Table.Revision.RevisionProjectComponentCost
                    {
                        TransactionId = TransactionId,
                        ComponentType = x.ComponentType,
                        ComponentId = x.ComponentId,
                        Description = x.Description,
                        Total = (decimal)x.Total!
                    }));
                }
                //else
                //{
                //    return new BadRequestObjectResult(new
                //    {
                //        Message = "Submission failed. Component Cost is required before submitting a revision.",
                //        Title = "Component Cost Required"
                //    });
                //}
                #endregion
                #region ComponentCostYear
                var UpdateComponentCostYear = dto.ComponentCostPerYear.Where(x => x.Id != 0).ToList();
                var ComponentCostPerYearRules = jsonRules.ComponentCostYearRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostYearRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                if (ComponentCostYear.Count > 0)
                {
                    bool CanDelete = jsonRules.ComponentCostRules.CRUD.CanDelete;
                    foreach (var component in UpdateComponentCostYear)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ComponentCostYear.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            if (ComponentCostRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = ComponentCostPerYearRules.UpdateRevisionData(User, TransactionId, "tRevisionProjectComponentCostPerYear", CurrentDate, component, SelectedComponent);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponent = UpdateAndGenerateLogs.Data;
                                var AddRow = new RevisionProjectComponentCostPerYear
                                {
                                    TransactionId = TransactionId,
                                    ComponentId = SelectedComponent.ComponentId,
                                    Amount = (decimal)SelectedComponent.Amount!,
                                    StartDate = (DateTime)SelectedComponent.StartDate,
                                    EndDate = (DateTime)SelectedComponent.EndDate,
                                    UACS = SelectedComponent.UACS,
                                    DateOfApproval = SelectedComponent.DateOfApproval,
                                    IsDeleted = CanDelete ? component.IsDeleted : false,
                                };
                                NewComponentPerYear.Add(AddRow);
                                if (CanDelete)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = TransactionId,
                                        AffectedTable = "tRevisionProjectComponentCostPerYear",
                                        TypeOfTransaction = "Delete",
                                        AffectedColumn = "Row",
                                        OldValue = JsonConvert.SerializeObject(AddRow),
                                        NewValue = string.Empty,
                                        CreatedBy = User,
                                        CreatedDate = CurrentDate
                                    });
                                }
                            }
                        }
                    }
                }
                if (jsonRules.ComponentCostYearRules.CRUD.CanAdd)
                {
                    var NewCostPerYear = dto.ComponentCostPerYear.Where(x => x.Id == 0);//Where(x => dto.ComponentCosts.Select(c => c.CostId).Contains(x.ComponentCostId) && x.Id == 0);
                    Logs.AddRange(NewCostPerYear.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = TransactionId,
                        AffectedTable = "tRevisionProjectComponentCostPerYear",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "ComponentCost",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    NewComponentPerYear.AddRange(NewCostPerYear.Select(x => new DBHelper.Models.Table.Revision.RevisionProjectComponentCostPerYear
                    {
                        TransactionId = TransactionId,
                        ComponentId = x.ComponentId,
                        Amount = (decimal)x.Amount!,
                        StartDate = (DateTime)x.StartDate,
                        EndDate = (DateTime)x.EndDate,
                        UACS = x.UACS,
                        DateOfApproval = x.DateOfApproval,
                    }));
                }
                //else
                //{
                //    return new BadRequestObjectResult(new
                //    {
                //        Message = "Submission failed. Component Cost Year is required before submitting a revision.",
                //        Title = "Component Cost Year Required"
                //    });
                //}
                #endregion
                #region MajorWorkItem
                var MajorItemIds = dto.MajorItemOfWorks.Where(x => x.Id != 0).Select(x => x.Id);
                var MajorWorkItem = await _db.tProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({ProjectId}) fp WHERE fp.StageName = {ProjectStage.StageName}").AsNoTracking().Where(x => !x.IsDeleted).ToListAsync();
                //var MajorWorkItem = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && MajorItemIds.Contains(x.Id)).ToListAsync();


                var MajorWorkLocations = await _db.fProjectMajorWorkLocations.FromSqlInterpolated($"SELECT * FROM ProjectMajorWorkLocations({ProjectId}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);
                var MajorWorkItemRules = jsonRules.MajorItemOfWorkRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemOfWorkRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorItemOfWorks = dto.MajorItemOfWorks.Where(x => x.Id != 0);
                var NewMajorItemOfWorksToInsert = dto.MajorItemOfWorks.Where(x => x.Id == 0);
                if (MajorWorkItem.Count > 0)
                {
                    bool CanDelete = jsonRules.MajorItemOfWorkRules.CRUD.CanDelete;
                    foreach (var item in UpdateMajorItemOfWorks)
                    {
                        var UpdateMajorWorkItem = MajorWorkItem.FirstOrDefault(x => x.Id == item.Id);
                        if (UpdateMajorWorkItem != null)
                        {
                            if (MajorWorkItemRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = MajorWorkItemRules.UpdateRevisionData(User, TransactionId, "tRevisionProjectMajorWorkItem", CurrentDate, item, UpdateMajorWorkItem);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                UpdateMajorWorkItem = UpdateAndGenerateLogs.Data;
                            }
                            var AddRow = new RevisionProjectMajorWorkItem
                            {
                                TransactionId = TransactionId,
                                ComponentId = UpdateMajorWorkItem.ComponentId,
                                YearOfWork = UpdateMajorWorkItem.YearOfWork,
                                WorkTypeFK = UpdateMajorWorkItem.WorkTypeFK,
                                InfraTypeFK = UpdateMajorWorkItem.InfraTypeFK,
                                IsDeleted = (CanDelete) ? UpdateMajorWorkItem.IsDeleted : false
                            };
                            NewMajorWorkItem.Add(AddRow);
                            if (CanDelete)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = TransactionId,
                                    AffectedTable = "tRevisionProjectMajorWorkItem",
                                    TypeOfTransaction = "Delete",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(AddRow),
                                    NewValue = string.Empty,
                                    CreatedBy = User,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }
                }
                if (jsonRules.MajorItemOfWorkRules.CRUD.CanAdd)
                {
                    Logs.AddRange(NewMajorItemOfWorksToInsert.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = TransactionId,
                        AffectedTable = "tRevisionProjectMajorWorkItem",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "MajorWorkItem",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    NewMajorWorkItem.AddRange(NewMajorItemOfWorksToInsert.Select(x => new RevisionProjectMajorWorkItem
                    {
                        TransactionId = TransactionId,
                        ComponentId = x.ComponentId,
                        YearOfWork = x.YearOfWork,
                        WorkTypeFK = x.WorkTypeFK,
                        InfraTypeFK = x.InfraTypeFK,
                        IsDeleted = false
                    }));
                }
                //else
                //{
                //    return new BadRequestObjectResult(new
                //    {
                //        Message = "Submission failed. Major Work Item is required before submitting a revision.",
                //        Title = "Major Work Item Required"
                //    });
                //}
                #endregion
                #region MajorWorkLocations
                var MajorItemLocationsRules = jsonRules.MajorItemLocationRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemLocationRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorWorkLocations = dto.MajorItemLocations.Where(x => x.Id != 0);
                if (MajorWorkLocations.Count > 0)
                {
                    bool CanDelete = jsonRules.MajorItemOfWorkRules.CRUD.CanDelete;
                    foreach (var location in UpdateMajorWorkLocations)
                    {
                        var UpdateMajorWorkLocation = MajorWorkLocations.FirstOrDefault(x => x.Id == location.Id);
                        if (UpdateMajorWorkLocation != null)
                        {
                            if (MajorWorkItemRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = MajorWorkItemRules.UpdateRevisionData(User, TransactionId, "tRevisionProjectMajorWorkLocations", CurrentDate, location, UpdateMajorWorkLocation);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                UpdateMajorWorkLocation = UpdateAndGenerateLogs.Data;
                            }
                            var AddRow = new RevisionProjectMajorWorkLocations
                            {
                                TransactionId = TransactionId,
                                ComponentId = UpdateMajorWorkLocation.ComponentId,
                                InfraId = UpdateMajorWorkLocation.InfraId,
                                DetailedScope = UpdateMajorWorkLocation.DetailedScope,
                                TargetUnitId = UpdateMajorWorkLocation.TargetUnitId,
                                TargetUnit = UpdateMajorWorkLocation.TargetUnit,
                                StartX = UpdateMajorWorkLocation.StartX,
                                StartY = UpdateMajorWorkLocation.StartY,
                                EndX = UpdateMajorWorkLocation.EndX,
                                EndY = UpdateMajorWorkLocation.EndY,
                                PhysicalTarget = UpdateMajorWorkLocation.PhysicalTarget,
                                StartStationLimit = UpdateMajorWorkLocation.StartStationLimit,
                                EndStationLimit = UpdateMajorWorkLocation.EndStationLimit,
                                EndChainage = UpdateMajorWorkLocation.EndChainage,
                                StartChainage = UpdateMajorWorkLocation.StartChainage,
                                Length = UpdateMajorWorkLocation.Length,
                                IsDeleted = (CanDelete) ? location.IsDeleted : false
                            };
                            NewMajorWorkLocations.Add(AddRow);
                            if (CanDelete)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = TransactionId,
                                    AffectedTable = "tRevisionProjectMajorWorkLocations",
                                    TypeOfTransaction = "Delete",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(AddRow),
                                    NewValue = string.Empty,
                                    CreatedBy = User,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }
                }
                if (jsonRules.MajorItemLocationRules.CRUD.CanAdd)
                {
                    var NewMajorWorkLocationsToInsert = dto.MajorItemLocations.Where(x => x.Id == 0);
                    if (NewMajorWorkLocationsToInsert.Count() > 0)
                    {
                        Logs.AddRange(NewMajorWorkLocationsToInsert.Select(x => new RevisionTransactionLog
                        {
                            TransactionId = TransactionId,
                            AffectedTable = "tRevisionProjectMajorWorkLocations",
                            TypeOfTransaction = "Create",
                            AffectedColumn = "MajorWorkLocation",
                            OldValue = string.Empty,
                            NewValue = JsonConvert.SerializeObject(x),
                            CreatedBy = User,
                            CreatedDate = CurrentDate
                        }));
                        NewMajorWorkLocations.AddRange(NewMajorWorkLocationsToInsert.Select(x => new RevisionProjectMajorWorkLocations
                        {
                            TransactionId = TransactionId,
                            ComponentId = x.ComponentId,
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
                            EndChainage = x.EndChainage,
                            StartChainage = x.StartChainage,
                            Length = x.Length
                        }));
                    }
                }
                //else
                //{
                //    return new BadRequestObjectResult(new
                //    {
                //        Message = "Submission failed. Major Work Item is required before submitting a revision.",
                //        Title = "Major Work Item Required"
                //    });
                //}
                #endregion

                await _db.tRevisionDetails.AddAsync(new RevisionDetails
                {
                    ProgramFK = (ProjectStage.ProgramId + "-" + ProjectParent.PCMARevisionCount),
                    ProgramId = ProjectStage.ProgramId,
                    TransactionId = TransactionId,
                    RevisionGroupId = RevisionCategory.RevisionGroupId,
                    CategoryId = dto.RevisionDetails.CategoryId,
                    ReasonId = RevisionRules.ReasonId,
                    IODocApprovalDate = dto.RevisionDetails.ApprovalDate,
                    RegionStatus = (isROUser || isCOUser) ? EnumRevisionStatus.Approved : EnumRevisionStatus.Pending,
                    RegionApprover = isROUser ? _Session.UserId : null,
                    RegionApprovedDate = isROUser ? CurrentDate : null,
                    COStatus = isCOUser ? EnumRevisionStatus.Approved : EnumRevisionStatus.Pending,
                    COApprover = null,
                    COApprovedDate = null,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                });
                string DocumentName = $"{TransactionId}_{DocumentNaming.SecondSegmentName}_{CurrentDate.ToString("MM-dd-yyyy")}.{dto.RevisionDetails.ApprovedDocument.Extension}";
                string Folder = isCOUser ? Appsetting.Resources.Revision.CentralOffice : Appsetting.Resources.Revision.ImplementingOffice;
                string FilePath = Path.Combine(Folder, DocumentName);
                string ResourcePath = Path.Combine(Directory.GetCurrentDirectory(), FilePath);
                if (!dto.RevisionDetails.ApprovedDocument.UploadFile(ResourcePath))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted.", Title = "File Corrupted" });
                }
                await _db.tRevisionDocuments.AddAsync(new RevisionDocuments
                {
                    TransactionId = TransactionId,
                    DocumentPath = FilePath,
                    DocumentName = DocumentName,
                    IsApprovedDocument = isCOUser ? true : false
                });
                if (isCOUser)
                {
                    //Termination
                    if (RevisionRules.RevisionGroupId == 9)
                    {
                        var entities = NewComponent
                        .Where(x => !x.IsDeleted)
                        .Select(x => new RevisionDetailsComponentsStatus
                        {
                            TransactionId = TransactionId,
                            ComponentId = x.ComponentId,
                            ConstructionStatusCode = 252,
                            ConstructionStatusName = dto.RevisionDetails.ConstructionStatus,
                            IsPackaged = dto.RevisionDetails.PackageStatus == "Packaged"
                        })
                        .ToList();

                        await _db.tRevisionDetailsComponentsStatus.AddRangeAsync(entities);
                    }
                    //Mode of Implementation
                    else if (RevisionRules.RevisionGroupId == 13)
                    {
                        string NewProjectId = $"{ProjectId}-A";
                        var AddFromProjectHeader = new DBHelper.Models.Table.Project.Projects
                        {
                            ProjectPK = ProjectFK,
                            ProgramFK = ProjectParent.ProjectPK,
                            ProgramId = ProjectParent.ProgramId,
                            ExternalId = ProjectParent.ExternalId,
                            MYId = ProjectParent.MYId,
                            ProjectType = ProjectParent.ProjectType,
                            ProjectGroupFK = ProjectParent.ProjectGroupFK,
                            ParentWalletId = ProjectParent.ParentWalletId,
                            WalletDrawFrozen = ProjectParent.WalletDrawFrozen,
                            IsPublished = ProjectParent.IsPublished,
                            IsRevised = ProjectParent.IsRevised,
                            IsPublishable = ProjectParent.IsPublishable,
                            PCMARevisionCount = ProjectParent.PCMARevisionCount,
                            LockedBy = ProjectParent.LockedBy,
                            LockedDate = ProjectParent.LockedDate,

                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        _db.tProjects.Add(AddFromProjectHeader);
                        ProjectRevision.ProjectId = NewProjectId;
                        ProjectRevision.Id = 0;
                        var AddNewProjectRevision = new DBHelper.Models.Table.Project.ProjectRevisions()
                        {

                            ProjectFK = ProjectRevisions.ProjectFK,
                            ProjectId = ProjectRevision.ProjectId,
                            ProgramFK = ProjectRevision.ProgramFK,
                            ProgramId = ProjectRevision.ProgramId,
                            AlternateId = ProjectRevision.AlternateId,
                            MYCAApprovalDate = ProjectRevision.MYCAApprovalDate,
                            Description = ProjectRevision.Description,
                            Region = ProjectRevision.Region,
                            Province = ProjectRevision.Province,
                            City = ProjectRevision.City,
                            LegislativeDistrict = ProjectRevision.LegislativeDistrict,
                            DEO = ProjectRevision.DEO,
                            OperatingUnit = ProjectRevision.OperatingUnit,
                            ImplementingOffice = ProjectRevision.ImplementingOffice,
                            IslandCode = ProjectRevision.IslandCode,
                            Category = ProjectRevision.Category,
                            Thrust = ProjectRevision.Thrust,
                            Origin = ProjectRevision.Origin,
                            Agency = ProjectRevision.Agency,
                            ImplementationMode = ProjectRevision.ImplementationMode,
                            EmergencyMode = ProjectRevision.EmergencyMode,
                            RegionWide = ProjectRevision.RegionWide,
                            Feasibility = ProjectRevision.Feasibility,
                            FeasibilityDate = ProjectRevision.FeasibilityDate,
                            DetailedDesign = ProjectRevision.DetailedDesign,
                            DetailedDesignDate = ProjectRevision.DetailedDesignDate,
                            RowAvailable = ProjectRevision.RowAvailable,
                            Tier = ProjectRevision.Tier,
                            Rank = ProjectRevision.Rank,
                            CreatedBy = User,
                            CreatedDate = CurrentDate,
                            IsDeleted = false
                        };


                        _db.tProjectRevisions.AddRange(AddNewProjectRevision);
                        await _db.SaveChangesAsync(cancellationToken);
                        var AddProjectStage = new DBHelper.Models.Table.Project.ProjectStages
                        {
                            ProjectFK = ProjectRevision.ProjectFK,
                            ProgramFK = ProjectRevision.ProgramFK,
                            ProgramId = ProjectRevision.ProgramId,
                            RevisionId = AddNewProjectRevision.Id,
                            StageId = EnumProgramStage.GAAR,
                            StageName = ProjectStage.StageName,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        _db.tProjectStages.Add(AddProjectStage);
                        //NewFundingProfile.ForEach(x =>
                        //{
                        //    x.ProjectId = NewProjectId;
                        //});
                        //NewComponent.ForEach(x =>
                        //{
                        //    x.ProjectId = NewProjectId;
                        //});
                        //NewMajorWorkItem.ForEach(x =>
                        //{
                        //    x.ProjectId = NewProjectId;
                        //});
                    }
                }
                _db.tProjects.Update(ProjectParent);
                await _db.tRevisionProjects.AddAsync(NewRevisionProject);
                await _db.tRevisionProjectFundingProfile.AddRangeAsync(NewFundingProfile);
                await _db.tRevisionProjectComponentCost.AddRangeAsync(NewComponent);
                await _db.tRevisionProjectComponentCostPerYear.AddRangeAsync(NewComponentPerYear);
                await _db.tRevisionProjectMajorWorkItem.AddRangeAsync(NewMajorWorkItem);
                await _db.tRevisionProjectMajorWorkLocations.AddRangeAsync(NewMajorWorkLocations);
                await _db.tRevisionTransactionLog.AddRangeAsync(Logs);
                var ExistingProjectRevisions = await _db.tRevisionProjects.FirstOrDefaultAsync(x => x.IsActive == true && x.ProjectId == dto.ProjectDetails.ProjectId);
                if (ExistingProjectRevisions != null)
                {
                    ExistingProjectRevisions.IsActive = false;
                    _db.tRevisionProjects.Update(ExistingProjectRevisions);
                }
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                #region Commented Email Notification
                //        string loc = System.IO.File.ReadAllText(SMTPClass.PathEmailTemplate);
                //        string Body = $@"
                //<h3>Revision Information:</h3>
                //<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
                //    <tbody>
                //        <tr style='border-top: none; background: #00148b; color: #fff;'>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision Category</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Revision Reason</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Requested by</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Requested on</th>
                //        </tr>
                //        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {RevisionCategory.RevisionName}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd
                //                    {RevisionRules.Reason}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {_Session.UserId}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {CurrentDate}
                //                </td>
                //            </tr>
                //        </tbody>
                //</table>
                //<h3>Program Information:</h3>
                //<table style='margin: auto; min-width: 300px; max-width: 100%; border-collapse: collapse; color: #333; border-top-left-radius: 10px; border-top-right-radius: 10px; overflow: hidden; border: 1px solid #ddd;'>
                //    <tbody>
                //        <tr style='border-top: none; background: #00148b; color: #fff;'>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Name</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Start Year</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Type</th>
                //            <th style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>Program Stage</th>
                //        </tr>
                //        <tr style='border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; background-color: #f5f9fc;'>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {ProgramDetails.Name}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd
                //                    {ProgramDetails.YearStart}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {ProgramDetails.Type}
                //                </td>
                //                <td style='padding: .5em 1em; text-align: left; border: 1px solid #ddd;'>
                //                    {ProgramDetails.StageName}
                //                </td>
                //            </tr>
                //        </tbody>
                //</table>
                //<h3 style='margin:0 0 12px 0; font-family:Segoe UI, Arial, sans-serif; color:#1F2A37;'>
                //    Project General Information:
                //</h3>

                //<table style='margin:auto; min-width:300px; max-width:100%; border-collapse:collapse; color:#1F2A37;
                //    font-family:Segoe UI, Arial, sans-serif; border-top-left-radius:10px; border-top-right-radius:10px;
                //    overflow:hidden; border:1px solid #D8E1EA; box-shadow:0 2px 10px rgba(0,0,0,.05);'>
                //    <tbody>

                //    <!-- Header -->
                //    <tr style='border-top:none; background:#013261; color:#ffffff;'>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>Project ID</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>MY ID</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>Alternate ID</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>External ID</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>OA Project Code (UACS)</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>Tier</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>Category</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>Sub-Category</th>
                //        <th style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>MYCA Approval date</th>
                //    </tr>

                //    <!-- Data row -->
                //    <tr style='border-top:1px solid #D8E1EA; border-bottom:1px solid #D8E1EA; background-color:#F3F7FF;'>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.ProjectId}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.MYId}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.AlternateId}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.ExternalId}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.UACS}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.Tier}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.Category}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.Thrust}}</td>
                //        <td style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>{{Project.MYCAApprovalDate}}</td>
                //    </tr>

                //    <!-- Description header -->
                //    <tr style='border-top:none; background:#013261; color:#ffffff;'>
                //        <th colspan='9' style='padding:.6em 1em; text-align:left; border:1px solid #013261; border-bottom:2px solid #9DC4FE;'>
                //        Description
                //        </th>
                //    </tr>

                //    <!-- Description body -->
                //    <tr style='border-top:1px solid #D8E1EA; border-bottom:1px solid #D8E1EA; background-color:#F3F7FF;'>
                //        <td colspan='9' style='padding:.6em 1em; text-align:left; border:1px solid #D8E1EA;'>
                //        {{Project.Description}}
                //        </td>
                //    </tr>

                //    </tbody>
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
                //        loc = loc.Replace("{Title}", "Project Revision <b><u>Request</u></b>");
                //        loc = loc.Replace("{Body}", Body);
                //        loc = loc.Replace("{Footer}", $"For more information click <a href='{Appsetting.RootPath}/Batch'>HERE</a>");
                //        loc = loc.Replace("{From}", "");
                //        string To = "";
                //        SMTPModel EmailConfig = new SMTPModel
                //        {
                //            Recipient = "mf102798@gmail.com",
                //            CCAddress = "yabutgerard@gmail.com",
                //            Subject = "Request for Revision",
                //            Body = loc
                //        };
                //EmailConfig.SendEmail();
                #endregion
                return Ok(
                    new
                    {
                        Message = "Revision request submitted successfully.",
                        Title = "Success",
                        TransactionId = TransactionId
                    }
                );
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateRevisionStatus([FromBody] UpdateRevisionStatusDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate(); ;
                var RevisionDetails = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId && (x.RegionStatus != EnumRevisionStatus.Rejected || x.COStatus != EnumRevisionStatus.Rejected));
                if (RevisionDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision Transaction ID {dto.TransactionId} does not exist in revision requests", Title = "Transaction ID not found" });
                }
                if (_Session.UserGroupNames.Count() == 0)
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to submit Revision. Please contact administrator.", Title = "User Groups Missing" });
                }
                bool isROUser = _Session.UserGroupNames.Contains("RPC");
                bool isCOUser = _Session.UserGroupNames.Contains("AUC");
                if (!isCOUser && !isROUser)
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to update Revision. Please contact administrator.", Title = "Invalid User Group" });
                }
                var SelectedProjectRevision = await _db.tRevisionProjects.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId);
                if (SelectedProjectRevision == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Project Revision details not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Project Revision not found" });
                }
                var OldRevisionProjects = await _db.tRevisionProjects.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == SelectedProjectRevision.ProjectId && x.IsActive);
                #region Commented
                if ((dto.Status == EnumRevisionStatus.Rejected || dto.Status == EnumRevisionStatus.ForCorrection) && string.IsNullOrEmpty(dto.Remarks))
                {
                    string RevisionStatusMessage = dto.Status == EnumRevisionStatus.Rejected ? "rejectin revision request" : "sending revision for correction";
                    return new BadRequestObjectResult(new { Message = $"Reason is required when {RevisionStatusMessage}", Title = "Reason Required" });
                }
                if (dto.Status == EnumRevisionStatus.Approved || dto.Status == EnumRevisionStatus.Rejected)
                {
                    if (isROUser)
                    {
                        RevisionDetails.RegionStatus = dto.Status;
                        RevisionDetails.RegionApprover = _Session.UserId;
                        RevisionDetails.RegionApprovedDate = CurrentDate;
                    }
                    else
                    {
                        RevisionDetails.RegionStatus = (dto.Status == EnumRevisionStatus.Approved) ? dto.Status : RevisionDetails.RegionStatus;
                        RevisionDetails.COStatus = dto.Status;
                        RevisionDetails.COApprover = _Session.UserId;
                        RevisionDetails.COApprovedDate = CurrentDate;
                        SelectedProjectRevision.IsActive = true;
                        if (OldRevisionProjects != null)
                        {
                            OldRevisionProjects.IsActive = false;
                        }
                        if (dto.Status == EnumRevisionStatus.Approved)
                        {
                            var DocumentNaming = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => (x.CategoryId != null && x.CategoryId == RevisionDetails.CategoryId) || x.RevisionGroupId == RevisionDetails.RevisionGroupId);
                            if (DocumentNaming == null)
                            {
                                return new BadRequestObjectResult(new { Message = "Document naming convention not found for the selected revision reason! Please contact Administrator", Title = "Missing Document Naming" });
                            }
                            if (dto.Document == null)
                            {
                                return new BadRequestObjectResult(new { Message = "Approved document is required when approving revision request", Title = "Approved Document Required" });
                            }
                            if (RevisionDetails.RevisionGroupId == 9)
                            {
                                var entities = await _db.fPendingProjectComponentCost.FromSqlInterpolated($@"
                                    SELECT *
                                    FROM fPendingProjectComponentCost({SelectedProjectRevision.TransactionId}) fp
                                    WHERE fp.IsDeleted = 0").ToListAsync();
                                var status = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({SelectedProjectRevision.ProjectFK}, {EnumProgramStage.GAAR})").AsNoTracking().ToListAsync(cancellationToken);

                                await _db.tRevisionDetailsComponentsStatus.AddRangeAsync(entities.Select(x => new RevisionDetailsComponentsStatus
                                {
                                    TransactionId = dto.TransactionId,
                                    ComponentId = x.ComponentId,
                                    ConstructionStatusCode = 252,
                                    ConstructionStatusName = "Terminated",
                                    IsPackaged = status.FirstOrDefault(a => a.ComponentId == x.ComponentId)?.IsPackaged == true
                                }));
                            }
                            if (RevisionDetails.RevisionGroupId == 13)
                            {
                                var ProjectDetails = await _db.tRevisionProjects.FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId);
                                if (ProjectDetails == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Project details not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Project details not found" });
                                }
                                string NewProjectId = $"{ProjectDetails.ProjectFK}-A";
                                ProjectDetails.ProjectFK = NewProjectId;
                                var FundingProfile = await _db.tRevisionProjectFundingProfile.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                                if (FundingProfile == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Revision funding profile not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision funding profile not found" });
                                }
                                var ComponentCost = await _db.tRevisionProjectComponentCost.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                                if (ComponentCost == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Revision component cost not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision component cost not found" });
                                }
                                var MajorWorkItems = await _db.tRevisionProjectMajorWorkItem.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                                if (MajorWorkItems == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Revision major work item not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision major work item not found" });
                                }
                                var MajorWorkLocations = await _db.tRevisionProjectMajorWorkLocations.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                                if (MajorWorkLocations == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Revision major work location not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision major work location not found" });
                                }
                                var getProgramId = await _db.tProjects.FirstOrDefaultAsync(x => x.ProjectPK == $"B{ProjectDetails.ProjectFK}");
                                if (getProgramId == null)
                                {
                                    return new BadRequestObjectResult(new { Message = $"Program details not found for the given project reference ID,\n\n<b>Project Reference ID:</b> <i><u>B{ProjectDetails.ProjectId}</u></i> ", Title = "Program details not found" });
                                }
                                var AddFromProjectHeader = new DBHelper.Models.Table.Project.Projects
                                {
                                    ProjectPK = ProjectDetails.ProjectFK + "-A",
                                    ProgramFK = getProgramId.ProgramFK,
                                    ProgramId = getProgramId.ProgramId,
                                    ExternalId = ProjectDetails.ExternalId,
                                    MYId = ProjectDetails.MYId,
                                    ProjectType = getProgramId.ProjectType,
                                    ProjectGroupFK = getProgramId.ProjectGroupFK,
                                    ParentWalletId = getProgramId.ParentWalletId,
                                    WalletDrawFrozen = getProgramId.WalletDrawFrozen,
                                    IsPublished = false,
                                    IsRevised = true,
                                    IsPublishable = false,
                                    PCMARevisionCount = getProgramId.PCMARevisionCount,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate,
                                };
                                _db.tRevisionProjects.Update(ProjectDetails);
                                _db.tRevisionProjectFundingProfile.UpdateRange(FundingProfile);
                                _db.tRevisionProjectComponentCost.UpdateRange(ComponentCost);
                                _db.tRevisionProjectMajorWorkItem.UpdateRange(MajorWorkItems);
                                _db.tRevisionProjectMajorWorkLocations.UpdateRange(MajorWorkLocations);
                                _db.tProjects.Add(AddFromProjectHeader);
                            }
                            var ExistingProjectRevisions = await _db.tRevisionProjects.FirstOrDefaultAsync(x => x.IsActive == true && x.ProjectId == SelectedProjectRevision.ProjectId);
                            if (ExistingProjectRevisions != null)
                            {
                                ExistingProjectRevisions.IsActive = false;
                                _db.tRevisionProjects.Update(ExistingProjectRevisions);
                            }
                            string DocumentName = $"{dto.TransactionId}_{DocumentNaming.SecondSegmentName}_{CurrentDate.ToString("MM-dd-yyyy")}.{dto.Document.Extension}";
                            string FilePath = Path.Combine(Appsetting.Resources.Revision.CentralOffice, DocumentName);
                            string ResourcePath = Path.Combine(Directory.GetCurrentDirectory(), FilePath);
                            if (!dto.Document.UploadFile(ResourcePath))
                            {
                                return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted.", Title = "File Corrupted" });
                            }
                            await _db.tRevisionDocuments.AddAsync(new RevisionDocuments
                            {
                                TransactionId = dto.TransactionId,
                                DocumentPath = FilePath,
                                DocumentName = DocumentName,
                                IsApprovedDocument = true
                            });
                        }
                    }

                    _db.tRevisionProjects.Update(SelectedProjectRevision);
                    if (OldRevisionProjects != null)
                    {
                        _db.tRevisionProjects.Update(OldRevisionProjects);
                    }
                }
                else if (dto.Status == EnumRevisionStatus.ForCorrection)
                {
                    if (isROUser)
                    {
                        await _db.tRevisionForCorrectionDetails.AddAsync(new RevisionForCorrectionDetails
                        {
                            TransactionId = dto.TransactionId,
                            CorrectionReason = dto.Remarks,
                            ForCorrectionDate = CurrentDate,
                            IsCentralOffice = false
                        });
                        RevisionDetails.RegionStatus = EnumRevisionStatus.ForCorrection;
                    }
                    else
                    {
                        await _db.tRevisionForCorrectionDetails.AddAsync(new RevisionForCorrectionDetails
                        {
                            TransactionId = dto.TransactionId,
                            CorrectionReason = dto.Remarks,
                            ForCorrectionDate = CurrentDate,
                            IsCentralOffice = true
                        });
                        RevisionDetails.COStatus = EnumRevisionStatus.ForCorrection;
                    }
                }
                _db.tRevisionDetails.Update(RevisionDetails);
                #endregion
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new { Message = $"Revision Updated by {_Session.UserGroupNames}", Title = "Updated Successfully" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ResubmitRevision([FromBody] ResubmitRevisionDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (_Session.UserGroupNames.Count() == 0)
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to submit Revision. Please contact administrator.", Title = "User Groups Missing" });
                }
                if (dto.RevisionDetails.ApprovedDocument == null)
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document is required.", Title = "Missing Approved Document" });
                }
                if (dto.RevisionDetails.ApprovedDocument.IsPdfCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file is corrupted or not a valid PDF.", Title = "Invalid File" });
                }
                if (!dto.RevisionDetails.ApprovedDocument.ValidateFileSize(50))
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file size exceeds the maximum limit of 50 MB.", Title = "File Size Exceeded" });
                }
                string User = _Session.UserId;
                DateTime CurrentDate = Functions.CurrentDate();
                List<RevisionTransactionLog> Logs = new List<RevisionTransactionLog>();
                #region Validating Created Revision Project Data
                var ExistingRevision = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId && (x.RegionStatus == EnumRevisionStatus.ForCorrection || x.COStatus == EnumRevisionStatus.ForCorrection));
                if (ExistingRevision == null)
                {
                    return new BadRequestObjectResult(new { Message = $"For Correction revision status does not exist in revision requests,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Transaction ID not found" });
                }
                var ExistingRevisionProject = await _db.tRevisionProjects.FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId);
                if (ExistingRevisionProject == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision project details not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Project not found" });
                }
                var ExistingFundingProfile = await _db.tRevisionProjectFundingProfile.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                if (ExistingFundingProfile == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision funding profile not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Funding Profile not found" });
                }
                var ExistingComponent = await _db.tRevisionProjectComponentCost.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                if (ExistingComponent == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision component cost not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Component Cost not found" });
                }
                var ExistingComponentYear = await _db.tRevisionProjectComponentCostPerYear.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                if (ExistingComponentYear == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision component cost per year not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Component Cost Per Year not found" });
                }
                var ExistingMajorWorkItem = await _db.tRevisionProjectMajorWorkItem.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                if (ExistingMajorWorkItem == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision major work item not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Major Work Item not found" });
                }
                var ExistingMajorWorkLocations = await _db.tRevisionProjectMajorWorkLocations.Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                if (ExistingMajorWorkLocations == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision major work locations not found for the given transaction ID,\n\n<b>Transaction ID:</b> <i><u>{dto.TransactionId}</u></i> ", Title = "Revision Major Work Locations not found" });
                }
                #endregion
                #region Validations
                #region Project
                var ValidateProjectId = await _db.ValidateProjectId(new ValidateProjectIdParams
                {
                    ProjectId = dto.ProjectDetails.ProjectId,
                    StageName = dto.ProjectDetails.StageName,
                    _Session = _Session,
                }, cancellationToken);
                if (!ValidateProjectId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProjectId.Title,
                        Message = ValidateProjectId.Message
                    });
                }
                var ProjectParent = ValidateProjectId.Data.Project;
                var ProjectRevisions = ValidateProjectId.Data.ProjectRevision;
                var ProjectStage = ValidateProjectId.Data.ProjectStage;
                #endregion

                var RevisionRules = await _db.vRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionDetails.ReasonId && x.PCMA_Status == dto.RevisionDetails.ConstructionStatus && x.Package_Status == dto.RevisionDetails.PackageStatus);
                if (RevisionRules == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision type does not exist in PCMA_Status: {dto.RevisionDetails.ConstructionStatus} Package_Status: {dto.RevisionDetails.PackageStatus}.", Title = "Invalid Revision Type" });
                }
                var RevisionCategory = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionRules.RevisionGroupId);
                if (RevisionCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision category does not match with the selected revision reason.", Title = "Invalid Revision Category" });
                }
                var DocumentNaming = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => (x.CategoryId != null && x.CategoryId == dto.RevisionDetails.CategoryId) || x.RevisionGroupId == RevisionCategory.RevisionGroupId);
                if (DocumentNaming == null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return new BadRequestObjectResult(new { Message = "Document naming convention not found for the selected revision reason! Please contact Administrator.", Title = "Missing Document Naming" });
                }
                var HasPendingModification = await _db.vRevisionLists.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TransactionId.Contains(dto.ProjectDetails.ProjectId!) && x.COStatus != EnumRevisionStatus.Approved);
                if (HasPendingModification != null)
                {
                    if (HasPendingModification.RegionStatus == EnumRevisionStatus.Pending || (HasPendingModification.COStatus == EnumRevisionStatus.Pending && HasPendingModification.RegionStatus != EnumRevisionStatus.ForCorrection))
                    {
                        return new BadRequestObjectResult(new { Message = $"There is a pending {HasPendingModification.RevisionName} request for this project. Please wait for the current request to be processed before submitting a new one.", Title = "Pending Modification Request" });
                    }
                }
                var jsonRules = JsonConvert.DeserializeObject<ModificationRules>(RevisionRules.Field);
                if (jsonRules == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Rules does not exist in {RevisionRules.Reason}. Please contact Administrator.", Title = "No Rules Exists" });
                }
                string RevisionTransactionId = $"{dto.ProjectDetails.ProjectId}-{DocumentNaming.SecondSegmentName}";
                #endregion
                #region ProjectRevision
                var ProjectDetailsRules = jsonRules.ProjectDetailsRules.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ProjectDetailsRules) == true)
                .Select(p => p.Name)
                .ToList();
                var NewProjectRevision = dto.ProjectDetails;
                if (ProjectDetailsRules.Count > 0)
                {
                    var UpdateAndGenerateLogs = ProjectDetailsRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjects", CurrentDate, NewProjectRevision, ProjectRevisions);
                    Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                    var RevisionProject = UpdateAndGenerateLogs.Data;
                    if (ExistingRevisionProject.AlternateId != RevisionProject.AlternateId)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "AlternateId",
                            OldValue = ExistingRevisionProject.AlternateId,
                            NewValue = RevisionProject.AlternateId,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.AlternateId = RevisionProject.AlternateId;
                    }
                    if (ExistingRevisionProject.MYCAApprovalDate != RevisionProject.MYCAApprovalDate)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "MYCAApprovalDate",
                            OldValue = ExistingRevisionProject.MYCAApprovalDate?.ToString("dd-MM-yyyy"),
                            NewValue = RevisionProject.MYCAApprovalDate?.ToString("dd-MM-yyyy"),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.MYCAApprovalDate = RevisionProject.MYCAApprovalDate;
                    }
                    if (ExistingRevisionProject.Description != RevisionProject.Description)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "Description",
                            OldValue = ExistingRevisionProject.Description,
                            NewValue = RevisionProject.Description,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.Description = RevisionProject.Description;
                    }
                    if (ExistingRevisionProject.Category != RevisionProject.Category)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "Category",
                            OldValue = ExistingRevisionProject.Category.ToString(),
                            NewValue = RevisionProject.Category.ToString(),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.Category = RevisionProject.Category;
                    }
                    if (ExistingRevisionProject.Thrust != RevisionProject.Thrust)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "Thrust",
                            OldValue = ExistingRevisionProject.Thrust.ToString(),
                            NewValue = RevisionProject.Thrust.ToString(),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.Thrust = RevisionProject.Thrust;
                    }
                    if (ExistingRevisionProject.Origin != RevisionProject.Origin)
                    {
                        //var OldOrigin = await _db.tProjectOriginEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == ExistingRevisionProject.Origin);
                        //if(OldOrigin == null)
                        //{
                        //    return new BadRequestObjectResult(new { Message = "Old Project Source Origin data not found! Please contact admin", Title = "Invalid Origin Data" });
                        //}
                        //var ExistingOrigin = await _db.tProjectOriginEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == RevisionProject.Origin);
                        //if(ExistingOrigin == null)
                        //{
                        //    return new BadRequestObjectResult(new { Message = "Project Source Origin data not found! Please contact admin", Title = "Invalid Origin Data" });
                        //}
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "Origin",
                            OldValue = ExistingRevisionProject.Origin.ToString(),
                            NewValue = RevisionProject.Origin.ToString(),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.Origin = RevisionProject.Origin;
                    }
                    if (ExistingRevisionProject.City != RevisionProject.City)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "City",
                            OldValue = ExistingRevisionProject.City,
                            NewValue = RevisionProject.City,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.City = RevisionProject.City;
                    }
                    if (ExistingRevisionProject.LegislativeDistrict != RevisionProject.LegislativeDistrict)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "LegislativeDistrict",
                            OldValue = ExistingRevisionProject.LegislativeDistrict,
                            NewValue = RevisionProject.LegislativeDistrict,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.LegislativeDistrict = RevisionProject.LegislativeDistrict;
                    }
                    if (ExistingRevisionProject.OperatingUnit != RevisionProject.OperatingUnit)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "OperatingUnit",
                            OldValue = ExistingRevisionProject.OperatingUnit,
                            NewValue = RevisionProject.OperatingUnit,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.OperatingUnit = RevisionProject.OperatingUnit;
                    }
                    if (ExistingRevisionProject.ImplementingOffice != RevisionProject.ImplementingOffice)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "ImplementingOffice",
                            OldValue = ExistingRevisionProject.ImplementingOffice,
                            NewValue = RevisionProject.ImplementingOffice,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.ImplementingOffice = RevisionProject.ImplementingOffice;
                    }
                    if (ExistingRevisionProject.DEO != RevisionProject.DEO)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "DEO",
                            OldValue = ExistingRevisionProject.DEO,
                            NewValue = RevisionProject.DEO,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.DEO = RevisionProject.DEO;
                    }
                    if (ExistingRevisionProject.ImplementationMode != RevisionProject.ImplementationMode)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "ImplementationMode",
                            OldValue = ExistingRevisionProject.ImplementationMode.ToString(),
                            NewValue = RevisionProject.ImplementationMode.ToString(),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.ImplementationMode = RevisionProject.ImplementationMode;
                    }
                    if (ExistingRevisionProject.EmergencyMode != RevisionProject.EmergencyMode)
                    {
                        Logs.Add(new RevisionTransactionLog
                        {
                            TransactionId = RevisionTransactionId,
                            ReferenceId = dto.TransactionId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tRevisionProjects",
                            AffectedColumn = "EmergencyMode",
                            OldValue = ExistingRevisionProject.EmergencyMode.ToString(),
                            NewValue = RevisionProject.EmergencyMode.ToString(),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        ExistingRevisionProject.EmergencyMode = RevisionProject.EmergencyMode;
                    }
                }
                #endregion
                #region FundingProfile
                var SaveNewFundingProfile = new List<RevisionProjectFundingProfile>();
                var FundingProfileRules = jsonRules.FundingProfileRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.FundingProfileRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateFundingProfile = dto.FundingProfile.Where(x => x.Id != 0);
                if (ExistingFundingProfile.Count > 0)
                {
                    bool CanDelete = jsonRules.FundingProfileRules.CRUD.CanDelete;
                    foreach (var component in UpdateFundingProfile)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ExistingFundingProfile.FirstOrDefault(x => x.Id == ComponentId);
                        var OldSelectedFunding = new RevisionProjectFundingProfile
                        {
                            Id = SelectedComponent.Id,
                            TransactionId = SelectedComponent.TransactionId,
                            SourceOrg = SelectedComponent.SourceOrg,
                            AgreementCode = SelectedComponent.AgreementCode,
                            Amount = SelectedComponent.Amount,
                            Percentage = SelectedComponent.Percentage,
                            IsDeleted = CanDelete ? component.IsDeleted : false
                        };
                        if (OldSelectedFunding != null)
                        {
                            if (FundingProfileRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = FundingProfileRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjectFundingProfile", CurrentDate, component, SelectedComponent);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponent = UpdateAndGenerateLogs.Data;
                                if (OldSelectedFunding.SourceOrg != SelectedComponent.SourceOrg)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectFundingProfile",
                                        AffectedColumn = "SourceOrg",
                                        OldValue = OldSelectedFunding.SourceOrg,
                                        NewValue = SelectedComponent.SourceOrg,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedFunding.AgreementCode != SelectedComponent.AgreementCode)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectFundingProfile",
                                        AffectedColumn = "AgreementCode",
                                        OldValue = OldSelectedFunding.AgreementCode,
                                        NewValue = SelectedComponent.AgreementCode,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedFunding.Amount != SelectedComponent.Amount)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectFundingProfile",
                                        AffectedColumn = "Amount",
                                        OldValue = OldSelectedFunding.Amount.ToString(),
                                        NewValue = SelectedComponent.Amount.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedFunding.Percentage != SelectedComponent.Percentage)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectFundingProfile",
                                        AffectedColumn = "Percentage",
                                        OldValue = OldSelectedFunding.Percentage.ToString(),
                                        NewValue = SelectedComponent.Percentage.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (CanDelete && SelectedComponent.IsDeleted)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Delete",
                                        AffectedTable = "tRevisionProjectFundingProfile",
                                        AffectedColumn = "Row",
                                        OldValue = JsonConvert.SerializeObject(SelectedComponent),
                                        NewValue = string.Empty,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                            }
                        }
                    }
                }
                if (jsonRules.FundingProfileRules.CRUD.CanAdd)
                {
                    var NewFundingProfile = dto.FundingProfile.Where(x => x.Id == 0);
                    Logs.AddRange(NewFundingProfile.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = dto.TransactionId,
                        AffectedTable = "tRevisionProjectFundingProfile",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "FundingProfile",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    SaveNewFundingProfile.AddRange(NewFundingProfile.Select(x => new RevisionProjectFundingProfile
                    {
                        TransactionId = dto.TransactionId,
                        SourceOrg = x.SourceOrg,
                        AgreementCode = x.AgreementCode,
                        Amount = x.Amount,
                        Percentage = x.Percentage,
                        IsDeleted = false
                    }));
                }
                #endregion
                #region ComponentCosts
                var SaveNewComponentCost = new List<RevisionProjectComponentCost>();
                var ComponentCostRules = jsonRules.ComponentCostRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCost = dto.ComponentCosts.Where(x => x.Id != 0);
                if (ExistingComponent.Count > 0)
                {
                    bool CanDelete = jsonRules.ComponentCostRules.CRUD.CanDelete;
                    foreach (var component in UpdateComponentCost)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ExistingComponent.FirstOrDefault(x => x.Id == ComponentId);
                        if (SelectedComponent != null)
                        {
                            var OldSelectedComponent = new DBHelper.Models.Table.Revision.RevisionProjectComponentCost
                            {
                                TransactionId = SelectedComponent.TransactionId,
                                ComponentType = SelectedComponent.ComponentType,
                                ComponentId = SelectedComponent.ComponentId,
                                Description = SelectedComponent.Description,
                                Total = (decimal)SelectedComponent.Total!
                            };
                            if (ComponentCostRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = ComponentCostRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjectComponentCost", CurrentDate, component, SelectedComponent);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponent = UpdateAndGenerateLogs.Data;
                            }
                            if (OldSelectedComponent.ComponentType != SelectedComponent.ComponentType)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    AffectedColumn = "ComponentType",
                                    OldValue = OldSelectedComponent.ComponentType,
                                    NewValue = SelectedComponent.ComponentType,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponent.ComponentId != SelectedComponent.ComponentId)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    AffectedColumn = "ComponentId",
                                    OldValue = OldSelectedComponent.ComponentId,
                                    NewValue = SelectedComponent.ComponentId,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponent.Description != SelectedComponent.Description)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    AffectedColumn = "Description",
                                    OldValue = OldSelectedComponent.Description,
                                    NewValue = SelectedComponent.Description,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponent.Total != SelectedComponent.Total)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    AffectedColumn = "Total",
                                    OldValue = OldSelectedComponent.Total.ToString(),
                                    NewValue = SelectedComponent.Total.ToString(),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (CanDelete && SelectedComponent.IsDeleted)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Delete",
                                    AffectedTable = "tRevisionProjectComponentCost",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(SelectedComponent),
                                    NewValue = string.Empty,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }
                }
                if (jsonRules.ComponentCostRules.CRUD.CanAdd)
                {
                    var NewCost = dto.ComponentCosts.Where(x => x.Id == 0);
                    Logs.AddRange(NewCost.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = dto.TransactionId,
                        AffectedTable = "tRevisionProjectComponentCost",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "ComponentCost",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    SaveNewComponentCost.AddRange(NewCost.Select(x => new DBHelper.Models.Table.Revision.RevisionProjectComponentCost
                    {
                        TransactionId = dto.TransactionId,
                        ComponentId = x.ComponentId,
                        ComponentType = x.ComponentType,
                        Description = x.Description,
                        Total = x.Total,
                        IsDeleted = false
                    }));
                }
                #endregion
                #region ComponentCostPerYear
                var SaveNewComponentCostPerYear = new List<RevisionProjectComponentCostPerYear>();
                var ComponentCostPerYearRules = jsonRules.ComponentCostYearRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostYearRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCostPerYear = dto.ComponentCostPerYear.Where(x => x.Id != 0);
                if (ExistingComponentYear.Count > 0)
                {
                    bool CanDelete = jsonRules.ComponentCostYearRules.CRUD.CanDelete;
                    foreach (var component in UpdateComponentCostPerYear)
                    {
                        var ComponentCostYearId = component.Id;
                        var SelectedComponentCostYear = ExistingComponentYear.FirstOrDefault(x => x.Id == ComponentCostYearId);
                        if (SelectedComponentCostYear != null)
                        {
                            var OldSelectedComponentCostYear = new RevisionProjectComponentCostPerYear
                            {
                                Id = SelectedComponentCostYear.Id,
                                TransactionId = SelectedComponentCostYear.TransactionId,
                                ComponentId = SelectedComponentCostYear.ComponentId,
                                Amount = SelectedComponentCostYear.Amount,
                                Year = SelectedComponentCostYear.Year,
                                StartDate = SelectedComponentCostYear.StartDate,
                                EndDate = SelectedComponentCostYear.EndDate,
                                IsDeleted = SelectedComponentCostYear.IsDeleted
                            };
                            if (ComponentCostPerYearRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = ComponentCostPerYearRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjectComponentCostPerYear", CurrentDate, component, SelectedComponentCostYear);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                SelectedComponentCostYear = UpdateAndGenerateLogs.Data;
                            }
                            if (OldSelectedComponentCostYear.Amount != SelectedComponentCostYear.Amount)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCostPerYear",
                                    AffectedColumn = "Amount",
                                    OldValue = OldSelectedComponentCostYear.Amount.ToString(),
                                    NewValue = SelectedComponentCostYear.Amount.ToString(),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponentCostYear.Year != SelectedComponentCostYear.Year)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCostPerYear",
                                    AffectedColumn = "Year",
                                    OldValue = OldSelectedComponentCostYear.Year.ToString(),
                                    NewValue = SelectedComponentCostYear.Year.ToString(),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponentCostYear.StartDate != SelectedComponentCostYear.StartDate)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCostPerYear",
                                    AffectedColumn = "StartDate",
                                    OldValue = OldSelectedComponentCostYear.StartDate.ToString(),
                                    NewValue = SelectedComponentCostYear.StartDate.ToString(),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (OldSelectedComponentCostYear.EndDate != SelectedComponentCostYear.EndDate)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tRevisionProjectComponentCostPerYear",
                                    AffectedColumn = "EndDate",
                                    OldValue = OldSelectedComponentCostYear.EndDate.ToString(),
                                    NewValue = SelectedComponentCostYear.EndDate.ToString(),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                            if (CanDelete && SelectedComponentCostYear.IsDeleted)
                            {
                                Logs.Add(new RevisionTransactionLog
                                {
                                    TransactionId = RevisionTransactionId,
                                    ReferenceId = dto.TransactionId,
                                    TypeOfTransaction = "Delete",
                                    AffectedTable = "tRevisionProjectComponentCostPerYear",
                                    AffectedColumn = "Row",
                                    OldValue = JsonConvert.SerializeObject(SelectedComponentCostYear),
                                    NewValue = string.Empty,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                            }
                        }
                    }
                }
                if (jsonRules.ComponentCostRules.CRUD.CanAdd)
                {
                    var NewCost = dto.ComponentCostPerYear.Where(x => x.Id == 0);
                    Logs.AddRange(NewCost.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = dto.TransactionId,
                        AffectedTable = "tRevisionProjectComponentCostPerYear",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "ComponentCostPerYear",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    SaveNewComponentCostPerYear.AddRange(NewCost.Select(x => new RevisionProjectComponentCostPerYear
                    {
                        TransactionId = dto.TransactionId,
                        ComponentId = x.ComponentId,
                        Amount = (decimal)x.Amount!,
                        StartDate = (DateTime)x.StartDate,
                        EndDate = (DateTime)x.EndDate,
                        UACS = x.UACS,
                        DateOfApproval = x.DateOfApproval,
                        IsDeleted = false,
                    }));
                }

                #endregion
                #region MajorWorkItem
                var SaveNewMajorWorkItem = new List<RevisionProjectMajorWorkItem>();
                var MajorWorkItemRules = jsonRules.MajorItemOfWorkRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemOfWorkRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorItemOfWorks = dto.MajorItemOfWorks.Where(x => x.Id != 0);
                if (ExistingMajorWorkItem.Count > 0)
                {
                    bool CanDelete = jsonRules.MajorItemOfWorkRules.CRUD.CanDelete;
                    foreach (var item in UpdateMajorItemOfWorks)
                    {
                        var UpdateMajorWorkItem = ExistingMajorWorkItem.FirstOrDefault(x => x.Id == item.Id);
                        var OldSelectedComponent = new RevisionProjectMajorWorkItem
                        {
                            TransactionId = dto.TransactionId,
                            ComponentId = UpdateMajorWorkItem.ComponentId,
                            YearOfWork = UpdateMajorWorkItem.YearOfWork,
                            WorkTypeFK = UpdateMajorWorkItem.WorkTypeFK,
                            InfraTypeFK = UpdateMajorWorkItem.InfraTypeFK,
                            IsDeleted = false
                        };
                        if (UpdateMajorWorkItem != null)
                        {
                            if (MajorWorkItemRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = MajorWorkItemRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjectMajorWorkItem", CurrentDate, item, UpdateMajorWorkItem);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                UpdateMajorWorkItem = UpdateAndGenerateLogs.Data;
                                if (OldSelectedComponent.YearOfWork != UpdateMajorWorkItem.YearOfWork)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkItem",
                                        AffectedColumn = "YearOfWork",
                                        OldValue = OldSelectedComponent.YearOfWork.ToString(),
                                        NewValue = UpdateMajorWorkItem.YearOfWork.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.WorkTypeFK != UpdateMajorWorkItem.WorkTypeFK)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkItem",
                                        AffectedColumn = "WorkTypeFK",
                                        OldValue = OldSelectedComponent.ToString(),
                                        NewValue = UpdateMajorWorkItem.WorkTypeFK.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.InfraTypeFK != UpdateMajorWorkItem.InfraTypeFK)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkItem",
                                        AffectedColumn = "InfraTypeFK",
                                        OldValue = OldSelectedComponent.InfraTypeFK,
                                        NewValue = UpdateMajorWorkItem.InfraTypeFK,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (CanDelete && UpdateMajorWorkItem.IsDeleted)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkItem",
                                        AffectedColumn = "Row",
                                        OldValue = JsonConvert.SerializeObject(OldSelectedComponent),
                                        NewValue = string.Empty,
                                        CreatedBy = User,
                                        CreatedDate = CurrentDate
                                    });
                                }
                            }
                            //var Locations = ExistingMajorWorkLocations.Where(x => x.ParentId == UpdateMajorWorkItem.ReferenceId).ToList();
                            //UpdateMajorWorkItem.ReferenceId = UpdateMajorWorkItem.ProjectId + "-" + ("tCountSequence").GenerateCode();
                            //Locations.ForEach(x => x.ParentId = UpdateMajorWorkItem.ReferenceId);
                        }
                    }
                }
                if (jsonRules.MajorItemOfWorkRules.CRUD.CanAdd)
                {
                    var NewWorkItem = dto.MajorItemOfWorks.Where(x => x.Id == 0);
                    Logs.AddRange(NewWorkItem.Select(x => new RevisionTransactionLog
                    {
                        TransactionId = dto.TransactionId,
                        AffectedTable = "tRevisionProjectMajorWorkItem",
                        TypeOfTransaction = "Create",
                        AffectedColumn = "MajorWorkItem",
                        OldValue = string.Empty,
                        NewValue = JsonConvert.SerializeObject(x),
                        CreatedBy = User,
                        CreatedDate = CurrentDate
                    }));
                    SaveNewMajorWorkItem.AddRange(NewWorkItem.Select(x => new RevisionProjectMajorWorkItem
                    {
                        TransactionId = dto.TransactionId,
                        ComponentId = x.ComponentId,
                        YearOfWork = x.YearOfWork,
                        WorkTypeFK = x.WorkTypeFK,
                        InfraTypeFK = x.InfraTypeFK,
                        IsDeleted = false
                    }));
                }
                #endregion
                #region MajorWorkLocations
                var SaveNewMajorWorkLocations = new List<RevisionProjectMajorWorkLocations>();
                var MajorItemLocationsRules = jsonRules.MajorItemLocationRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemLocationRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorWorkLocations = dto.MajorItemLocations.Where(x => x.Id != 0);
                if (ExistingMajorWorkLocations.Count > 0)
                {
                    bool CanDelete = jsonRules.MajorItemLocationRules.CRUD.CanDelete;
                    foreach (var location in UpdateMajorWorkLocations)
                    {
                        var UpdateMajorWorkLocation = ExistingMajorWorkLocations.FirstOrDefault(x => x.Id == location.Id);
                        var OldSelectedComponent = new RevisionProjectMajorWorkLocations
                        {
                            TransactionId = dto.TransactionId,
                            ComponentId = UpdateMajorWorkLocation.ComponentId,
                            InfraId = UpdateMajorWorkLocation.InfraId,
                            DetailedScope = UpdateMajorWorkLocation.DetailedScope,
                            TargetUnitId = UpdateMajorWorkLocation.TargetUnitId,
                            TargetUnit = UpdateMajorWorkLocation.TargetUnit,
                            StartX = UpdateMajorWorkLocation.StartX,
                            StartY = UpdateMajorWorkLocation.StartY,
                            EndX = UpdateMajorWorkLocation.EndX,
                            EndY = UpdateMajorWorkLocation.EndY,
                            PhysicalTarget = UpdateMajorWorkLocation.PhysicalTarget,
                            StartStationLimit = UpdateMajorWorkLocation.StartStationLimit,
                            EndStationLimit = UpdateMajorWorkLocation.EndStationLimit,
                            EndChainage = UpdateMajorWorkLocation.EndChainage,
                            StartChainage = UpdateMajorWorkLocation.StartChainage,
                            Length = UpdateMajorWorkLocation.Length,
                            IsDeleted = (CanDelete) ? location.IsDeleted : false
                        };
                        if (UpdateMajorWorkLocation != null)
                        {
                            if (MajorWorkItemRules.Count > 0)
                            {
                                var UpdateAndGenerateLogs = MajorItemLocationsRules.UpdateRevisionData(User, dto.TransactionId, "tRevisionProjectMajorWorkLocations", CurrentDate, location, UpdateMajorWorkLocation);
                                Logs.AddRange(UpdateAndGenerateLogs.RevisionTransaction);
                                UpdateMajorWorkLocation = UpdateAndGenerateLogs.Data;
                                if (OldSelectedComponent.InfraId != UpdateMajorWorkLocation.InfraId)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "InfraId",
                                        OldValue = OldSelectedComponent.InfraId,
                                        NewValue = UpdateMajorWorkLocation.InfraId,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.DetailedScope != UpdateMajorWorkLocation.DetailedScope)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "DetailedScope",
                                        OldValue = OldSelectedComponent.DetailedScope,
                                        NewValue = UpdateMajorWorkLocation.DetailedScope,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.TargetUnitId != UpdateMajorWorkLocation.TargetUnitId)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "TargetUnitId",
                                        OldValue = OldSelectedComponent.TargetUnitId.ToString(),
                                        NewValue = UpdateMajorWorkLocation.TargetUnitId.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.TargetUnit != UpdateMajorWorkLocation.TargetUnit)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "TargetUnit",
                                        OldValue = OldSelectedComponent.TargetUnit,
                                        NewValue = UpdateMajorWorkLocation.TargetUnit,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.StartX != UpdateMajorWorkLocation.StartX)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "StartX",
                                        OldValue = OldSelectedComponent.StartX.ToString(),
                                        NewValue = UpdateMajorWorkLocation.StartX.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.StartY != UpdateMajorWorkLocation.StartY)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "StartY",
                                        OldValue = OldSelectedComponent.StartY.ToString(),
                                        NewValue = UpdateMajorWorkLocation.StartY.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.EndX != UpdateMajorWorkLocation.EndX)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "EndX",
                                        OldValue = OldSelectedComponent.EndX.ToString(),
                                        NewValue = UpdateMajorWorkLocation.EndX.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.EndY != UpdateMajorWorkLocation.EndY)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "EndY",
                                        OldValue = OldSelectedComponent.EndY.ToString(),
                                        NewValue = UpdateMajorWorkLocation.EndY.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.PhysicalTarget != UpdateMajorWorkLocation.PhysicalTarget)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "PhysicalTarget",
                                        OldValue = OldSelectedComponent.PhysicalTarget.ToString(),
                                        NewValue = UpdateMajorWorkLocation.PhysicalTarget.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.StartStationLimit != UpdateMajorWorkLocation.StartStationLimit)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "StartStationLimit",
                                        OldValue = OldSelectedComponent.StartStationLimit,
                                        NewValue = UpdateMajorWorkLocation.StartStationLimit,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.EndStationLimit != UpdateMajorWorkLocation.EndStationLimit)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "EndStationLimit",
                                        OldValue = OldSelectedComponent.EndStationLimit,
                                        NewValue = UpdateMajorWorkLocation.EndStationLimit,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.EndChainage != UpdateMajorWorkLocation.EndChainage)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "EndChainage",
                                        OldValue = OldSelectedComponent.EndChainage.ToString(),
                                        NewValue = UpdateMajorWorkLocation.EndChainage.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.StartChainage != UpdateMajorWorkLocation.StartChainage)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "StartChainage",
                                        OldValue = OldSelectedComponent.StartChainage.ToString(),
                                        NewValue = UpdateMajorWorkLocation.StartChainage.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (OldSelectedComponent.Length != UpdateMajorWorkLocation.Length)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "Length",
                                        OldValue = OldSelectedComponent.Length.ToString(),
                                        NewValue = UpdateMajorWorkLocation.Length.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                                if (CanDelete && UpdateMajorWorkLocation.IsDeleted)
                                {
                                    Logs.Add(new RevisionTransactionLog
                                    {
                                        TransactionId = RevisionTransactionId,
                                        ReferenceId = dto.TransactionId,
                                        TypeOfTransaction = "Delete",
                                        AffectedTable = "tRevisionProjectMajorWorkLocations",
                                        AffectedColumn = "Row",
                                        OldValue = JsonConvert.SerializeObject(OldSelectedComponent),
                                        NewValue = string.Empty,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                }
                            }
                        }
                    }
                }
                if (jsonRules.MajorItemLocationRules.CRUD.CanAdd)
                {
                    var NewMajorWorkLocationsToInsert = dto.MajorItemLocations.Where(x => x.Id == 0);
                    if (NewMajorWorkLocationsToInsert.Count() > 0)
                    {
                        Logs.AddRange(NewMajorWorkLocationsToInsert.Select(x => new RevisionTransactionLog
                        {
                            TransactionId = dto.TransactionId,
                            AffectedTable = "tRevisionProjectMajorWorkLocations",
                            TypeOfTransaction = "Create",
                            AffectedColumn = "MajorWorkLocations",
                            OldValue = string.Empty,
                            NewValue = JsonConvert.SerializeObject(x),
                            CreatedBy = User,
                            CreatedDate = CurrentDate
                        }));
                        SaveNewMajorWorkLocations.AddRange(NewMajorWorkLocationsToInsert.Select(x => new RevisionProjectMajorWorkLocations
                        {
                            TransactionId = dto.TransactionId,
                            ComponentId = x.ComponentId,
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
                            EndChainage = x.EndChainage,
                            StartChainage = x.StartChainage,
                            Length = x.Length,
                            IsDeleted = false
                        }));
                    }
                }
                #endregion
                ExistingRevision.RegionStatus = (ExistingRevision.RegionStatus == EnumRevisionStatus.ForCorrection) ? EnumRevisionStatus.Pending : ExistingRevision.RegionStatus;
                ExistingRevision.COStatus = (ExistingRevision.COStatus == EnumRevisionStatus.ForCorrection) ? EnumRevisionStatus.Pending : ExistingRevision.COStatus;
                _db.tRevisionDetails.Update(ExistingRevision);
                _db.tRevisionProjects.Update(ExistingRevisionProject);
                _db.tRevisionProjectFundingProfile.UpdateRange(ExistingFundingProfile);
                _db.tRevisionProjectComponentCost.UpdateRange(ExistingComponent);
                _db.tRevisionProjectComponentCostPerYear.UpdateRange(ExistingComponentYear);
                _db.tRevisionProjectMajorWorkItem.UpdateRange(ExistingMajorWorkItem);
                _db.tRevisionProjectMajorWorkLocations.UpdateRange(ExistingMajorWorkLocations);

                await _db.tRevisionProjectFundingProfile.AddRangeAsync(SaveNewFundingProfile);
                await _db.tRevisionProjectComponentCost.AddRangeAsync(SaveNewComponentCost);
                await _db.tRevisionProjectComponentCostPerYear.AddRangeAsync(SaveNewComponentCostPerYear);
                await _db.tRevisionProjectMajorWorkItem.AddRangeAsync(SaveNewMajorWorkItem);
                await _db.tRevisionProjectMajorWorkLocations.AddRangeAsync(SaveNewMajorWorkLocations);
                await _db.tRevisionTransactionLog.AddRangeAsync(Logs);


                string DocumentName = $"{dto.TransactionId}_{DocumentNaming.SecondSegmentName}_{CurrentDate.ToString("MM-dd-yyyy")}";
                var NewUploadedDocument = _db.tRevisionDocuments.Where(x => x.TransactionId == dto.TransactionId && DocumentName.Contains(x.DocumentName)).Count() + 1;
                string NewDocName = $"{DocumentName}-{NewUploadedDocument}.{dto.RevisionDetails.ApprovedDocument.Extension}";
                string FilePath = Path.Combine(Appsetting.Resources.Revision.ImplementingOffice, NewDocName);
                string ResourcePath = Path.Combine(Directory.GetCurrentDirectory(), FilePath);
                if (!dto.RevisionDetails.ApprovedDocument.UploadFile(ResourcePath))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted.", Title = "File Corrupted" });
                }
                await _db.tRevisionDocuments.AddAsync(new RevisionDocuments
                {
                    TransactionId = dto.TransactionId,
                    DocumentPath = FilePath,
                    DocumentName = NewDocName,
                    IsApprovedDocument = false
                });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(
                    new
                    {
                        Message = "Revision request submitted successfully.",
                        Title = "Success",
                        TransactionId = dto.TransactionId
                    }
                );
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
    }
}