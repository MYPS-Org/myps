using Castle.Components.DictionaryAdapter.Xml;
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
using Newtonsoft.Json;
using System.Linq;
using System.Reflection;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Revision : CoreController
    {
        public Revision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RevisionRequests([FromBody] RevisionRequestsDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.Projects)
                        .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                        .Any(p => string.Equals(p.Name, dto.SortField, StringComparison.OrdinalIgnoreCase));
                    if (!isValid)
                    {
                        return new BadRequestObjectResult(new { Message = $"Invalid Column: {dto.SortField} to sort!", Title = "Parameter Error" });
                    }
                }
                dto.sortDirection = string.IsNullOrEmpty(dto.sortDirection.ToString()) ? sortDirectionList.DESC : dto.sortDirection;

                bool isValidDirection = Enum.IsDefined(typeof(sortDirectionList), dto.sortDirection!);
                if (!isValidDirection)
                {
                    return new BadRequestObjectResult(new { Message = $"Sorting Direction: {dto.sortDirection} not allowed!", Title = "Invalid sort option" });
                }
                // Validate pagination parameters
                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;

                var AllowedStatusForCO = await _db.tOptionRevisionStatus
                    .AsNoTracking()
                    .Where(x => x.Enum == EnumRevisionStatus.Pending || x.Enum == EnumRevisionStatus.Approved)
                    .Select(x => (EnumRevisionStatus?)x.Enum)
                    .ToListAsync();
                bool isCentralOffice = _Session.UserGroups.Contains("AUC");
                var baseQuery = _db.vRevisionLists.AsNoTracking();
                if (isCentralOffice)
                {
                    baseQuery = _db.vRevisionLists.AsNoTracking().Where(x => x.COStatus != null && AllowedStatusForCO.Contains(x.COStatus));
                }

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.TransactionId))
                    baseQuery = baseQuery.Where(e => e.TransactionId!.Contains(dto.Filters.TransactionId));

                if (dto.Filters?.RevisionGroupId != null)
                    baseQuery = baseQuery.Where(e => e.RevisionGroupId == dto.Filters.RevisionGroupId);

                if (dto.Filters?.CategoryId != null)
                    baseQuery = baseQuery.Where(e => e.CategoryId == dto.Filters.CategoryId);

                if (dto.Filters?.ReasonId != null)
                    baseQuery = baseQuery.Where(e => e.ReasonId == dto.Filters.ReasonId);

                if (dto.Filters?.RegionStatus != null)
                    baseQuery = baseQuery.Where(e => e.RegionStatus == dto.Filters.RegionStatus);

                if (dto.Filters?.COStatus != null)
                    baseQuery = baseQuery.Where(e => e.COStatus == dto.Filters.COStatus);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.RevisionLists> permissionLists = await sortedQuery
                   .Skip((dto.page - 1) * dto.limit)
                   .Take(dto.limit)
                   .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var RevisionStatus = await _db.tOptionRevisionStatus.ToListAsync();
                var response = new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages,
                    Status = RevisionStatus
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ViewReviseProject([FromBody] ViewReviseProjectDTO dto)
        {
            try
            {
                var RevisionTransation = dto.TransactionId.Split('-');
                string ProjectId = RevisionTransation[0];
                int RevisedNumber = int.Parse(RevisionTransation[1]);
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectsPerStage({ProjectId}) fp WHERE fp.StageName = 'GAA-R' AND fp.ProjectId = {ProjectId}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found or not in GAA-R stage!", Title = "Invalid Project" });
                }
                var RevisionDetails = await _db.vRevisionLists.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId);
                if(RevisionDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision details not found!", Title = "Invalid Revision" });
                }
                #region Validate PCMA Status
                var SelectedRules = await _db.vRevisionRules.FirstOrDefaultAsync(x => x.ReasonId == RevisionDetails.ReasonId && x.RevisionGroupId == RevisionDetails.RevisionGroupId);
                var ProjectComponentsStatus = await _db.vProjectComponentStatus.AsNoTracking().Where(x => x.ProjectId == ProjectId).ToListAsync();
                if (ProjectComponentsStatus == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
                #region Project Construction Status Validation
                string ConStatus = "On-Going";
                var HasOnGoing = ProjectComponentsStatus.FirstOrDefault(x => x.ConstructionStatusName == ConStatus);
                if (HasOnGoing == null)
                {
                    #region Has Completed
                    string[] CompletedCondition = { "Terminated", "Not Yet Started" };
                    var HasCompleted = ProjectComponentsStatus.Where(x => x.ConstructionStatusName == "Completed");
                    HasOnGoing = HasCompleted.FirstOrDefault(x => CompletedCondition.Contains(x.ConstructionStatusName));
                    if (HasOnGoing == null) ConStatus = "Completed";
                    #endregion

                    #region Has Not Yet Started
                    string[] NYSCondition = { "Completed", "Terminated" };
                    var HasNYS = ProjectComponentsStatus.Where(x => x.ConstructionStatusName == "Not Yet Started");
                    HasOnGoing = HasNYS.FirstOrDefault(x => NYSCondition.Contains(x.ConstructionStatusName));
                    if (HasOnGoing == null) ConStatus = "Not Yet Started";
                    #endregion
                }
                #endregion
                #region Project Packaged Status Validation
                string PackedStatus =
                    (ProjectComponentsStatus.FirstOrDefault(x => x.PackedStatusName == "Not Packaged") != null) ?
                    "Not Packaged" :
                    "Packaged";
                #endregion
                #endregion

                #region Validate Selected Revision Details
                var SelectedType = new DBHelper.Models.Table.OptionRevisionHeader();
                var SelectedCategory = new DBHelper.Models.Table.OptionRevisionCategory();
                var SelectedReason = new DBHelper.Models.Table.OptionRevisionReasons();
                SelectedType = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionDetails.RevisionGroupId);
                if (SelectedType == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Type not found!", Title = "Invalid Revision Type" });
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
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found!", Title = "Invalid Revision Reason" });
                }
                var RevisionDoc = await _db.tRevisionDocuments.AsNoTracking().Where(x => x.TransactionId == dto.TransactionId).ToListAsync();
                #endregion

                #region Program Validation
                var CurrentProgramVersion = await _db.vPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"No program is associated with the Project ID {ProjectId}. Please contact administrator!", Title = "Program Not Associated" });
                }
                var Program = await _db.vProgramDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId && x.StageName == Project.StageName);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                #endregion

                #region Full Project Details
                int CurrentYear = (int)DateTime.UtcNow.Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var SupportingDoc = await _db.tDropdownSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && x.RevisedNumber == RevisedNumber).ToListAsync();
                var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(a => a.ReferenceId).Contains(x.ParentId)).ToListAsync();

                var MajorItemOfWork = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && x.RevisedNumber == RevisedNumber).ToListAsync();
                HashSet<string> ItemParents = MajorItemOfWork.Select(x => x.ReferenceId).ToHashSet();
                var MajorWorkLocation = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => ItemParents.Contains(x.ParentId)).ToListAsync();


                var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Funding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && x.RevisedNumber == RevisedNumber).ToListAsync();
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.TransactionId == ProjectId).ToListAsync();
                #endregion

                #region Dropdowns
                var ComponentType = await _db.tProjectComponentEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Category = await _db.tProjectCategoryEnum.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();
                var Thrust = await _db.tProjectThrustLists.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tProjectOriginEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tProjectLongFeasibilityEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tProjectAgencyLists.AsNoTracking().OrderBy(x => x.AgencyName).ToListAsync();
                var ImplementationMode = await _db.tProjectImplementModeEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tProjectEmergencyModeEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                var Agreement = await _db.tOptionFundingAgreement.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Source = await _db.tOptionFundingSource.AsNoTracking().OrderBy(x => x.Organization == "GOP" ? 0 : 1).ThenBy(x => x.Name).ToListAsync();

                var ScopeOfWork = await _db.tProjectScopeOfWorkEnum.AsNoTracking().OrderBy(x => x.WorkCategory).ToListAsync();
                #endregion

                return Ok(new
                {
                    Header = SelectedType,
                    Category = SelectedCategory,
                    Reason = SelectedReason,
                    
                    RevisionDetails = RevisionDetails,
                    RevisionDocs = RevisionDoc,
                    ProjectStatus = new
                    {
                        ConstructionStatus = ConStatus,
                        PackageStatus = PackedStatus
                    },

                    Rules = SelectedRules,
                    ComponentsStatus = ProjectComponentsStatus,

                    IsActive = (CurrentProgramVersion.StageName == Project.StageName) ? true : false,
                    ProgramDetails = Program,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    MajorItemLocations = MajorWorkLocation,
                    ProjectNotes = Notes,

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

                        //Funding Profile
                        Agreements = Agreement,
                        Sources = Source,
                    }
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ReviseProject([FromBody] ReviseProjectDTO dto)
        {
            try
            {
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectsPerStage({dto.ProjectId}) fp WHERE fp.StageName = 'GAA-R' AND fp.ProjectId = {dto.ProjectId}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found or not in GAA-R stage!", Title = "Invalid Project" });
                }

                var HasPendingModification = await _db.vRevisionLists.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.TransactionId.Contains(dto.ProjectId) && x.COStatus != EnumRevisionStatus.Approved);
                if (HasPendingModification != null && (HasPendingModification.COStatus == EnumRevisionStatus.Pending || HasPendingModification.RegionStatus == EnumRevisionStatus.Pending))
                {
                    return new BadRequestObjectResult(new { Message = $"There is a pending {HasPendingModification.RevisionName} request for this project. Please wait for the current request to be processed before submitting a new one.", Title = "Pending Modification Request" });
                }
                #region Validate PCMA Status
                var ProjectComponentsStatus = await _db.vProjectComponentStatus.AsNoTracking().Where(x => x.ProjectId == dto.ProjectId).ToListAsync();
                if(ProjectComponentsStatus == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
                #region Project Construction Status Validation
                string ConStatus = "On-Going";
                var HasOnGoing = ProjectComponentsStatus.FirstOrDefault(x => x.ConstructionStatusName == ConStatus);
                if(HasOnGoing == null)
                {
                    #region Has Completed
                    string[] CompletedCondition = { "Terminated", "Not Yet Started" };
                    var HasCompleted = ProjectComponentsStatus.Where(x => x.ConstructionStatusName == "Completed");
                    HasOnGoing = HasCompleted.FirstOrDefault(x => CompletedCondition.Contains(x.ConstructionStatusName));
                    if (HasOnGoing == null) ConStatus = "Completed";
                    #endregion

                    #region Has Not Yet Started
                    string[] NYSCondition = { "Completed", "Terminated" };
                    var HasNYS = ProjectComponentsStatus.Where(x => x.ConstructionStatusName == "Not Yet Started");
                    HasOnGoing = HasNYS.FirstOrDefault(x => NYSCondition.Contains(x.ConstructionStatusName));
                    if (HasOnGoing == null) ConStatus = "Not Yet Started";
                    #endregion
                }
                #endregion
                #region Project Packaged Status Validation
                string PackedStatus =
                    (ProjectComponentsStatus.FirstOrDefault(x => x.PackedStatusName == "Not Packaged") != null) ?
                    "Not Packaged" :
                    "Packaged";
                #endregion

                var SelectedRules = await _db.vRevisionRules.FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason && x.RevisionGroupId == dto.RevisionHeader && x.PCMA_Status == ConStatus && x.Package_Status == PackedStatus);
                #endregion

                #region Validate Selected Revision Details
                var SelectedType = new DBHelper.Models.Table.OptionRevisionHeader();
                var SelectedCategory  = new DBHelper.Models.Table.OptionRevisionCategory();
                var SelectedReason = new DBHelper.Models.Table.OptionRevisionReasons();
                SelectedType = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == dto.RevisionHeader);
                if(SelectedType == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Type not found!", Title = "Invalid Revision Type" });
                }
                if(dto.RevisionCategory != null)
                {
                    SelectedCategory = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == dto.RevisionCategory);
                    if (SelectedCategory == null)
                    {
                        return new BadRequestObjectResult(new { Message = "Revision Category not found!", Title = "Invalid Revision Category" });
                    }
                }
                SelectedReason = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason && x.RevisionGroupId == dto.RevisionHeader);
                if (SelectedReason == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found!", Title = "Invalid Revision Reason" });
                }
                #endregion

                #region Program Validation
                var CurrentProgramVersion = await _db.vPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"No program is associated with the Project ID {dto.ProjectId}. Please contact administrator!", Title = "Program Not Associated" });
                }
                var Program = await _db.vProgramDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId && x.StageName == Project.StageName);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                #endregion

                #region Full Project Details
                int CurrentYear = (int)DateTime.UtcNow.Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var SupportingDoc = await _db.tDropdownSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(a => a.ReferenceId).Contains(x.ParentId)).ToListAsync();

                var MajorItemOfWork = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                HashSet<string> ItemParents = MajorItemOfWork.Select(x => x.ReferenceId).ToHashSet();
                var MajorWorkLocation = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => ItemParents.Contains(x.ParentId)).ToListAsync();


                var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Funding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.TransactionId == dto.ProjectId).ToListAsync();
                #endregion

                #region Dropdowns
                var ComponentType = await _db.tProjectComponentEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Category = await _db.tProjectCategoryEnum.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();
                var Thrust = await _db.tProjectThrustLists.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tProjectOriginEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tProjectLongFeasibilityEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tProjectAgencyLists.AsNoTracking().OrderBy(x => x.AgencyName).ToListAsync();
                var ImplementationMode = await _db.tProjectImplementModeEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tProjectEmergencyModeEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                var Agreement = await _db.tOptionFundingAgreement.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Source = await _db.tOptionFundingSource.AsNoTracking().OrderBy(x => x.Organization == "GOP" ? 0 : 1).ThenBy(x => x.Name).ToListAsync();

                var ScopeOfWork = await _db.tProjectScopeOfWorkEnum.AsNoTracking().OrderBy(x => x.WorkCategory).ToListAsync();
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
                    ComponentsStatus = ProjectComponentsStatus,

                    IsActive = (CurrentProgramVersion.StageName == Project.StageName) ? true : false,
                    ProgramDetails = Program,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    MajorItemLocations = MajorWorkLocation,
                    ProjectNotes = Notes,

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

                        //Funding Profile
                        Agreements = Agreement,
                        Sources = Source,
                    }
                });
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
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (string.IsNullOrEmpty(_Session.UserGroups))
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to submit Revision. Please contact administrator!", Title = "User Groups Missing" });
                }
                if(dto.RevisionDetails.ApprovedDocument == null)
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document is required!", Title = "Missing Approved Document" });
                }
                if (dto.RevisionDetails.ApprovedDocument.IsPdfCorrupted()) { 
                    return new BadRequestObjectResult(new { Message = "Approved Document file is corrupted or not a valid PDF!", Title = "Invalid File" });
                }
                if (!dto.RevisionDetails.ApprovedDocument.ValidateFileSize(50))
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file size exceeds the maximum limit of 50 MB!", Title = "File Size Exceeded" });
                }

                string TransactionId = string.Empty;
                bool hasUpdated = false;
                DateTime CurrentDate = DateTime.UtcNow;
                var NewFundingProfile = new List<ProjectFundingProfile>();
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
                if (ProjectStage == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Stage not found!", Title = "Invalid Project Stage" });
                }

                if (dto.RevisionDetails.ApprovedDocument.IsFileCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Approved Document file is corrupted!", Title = "Invalid File" });
                }

                var RevisionRules = await _db.vRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionDetails.ReasonId && x.PCMA_Status == dto.RevisionDetails.ConstructionStatus && x.Package_Status == dto.RevisionDetails.PackageStatus);
                if (RevisionRules == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision type does not exist in PCMA_Status: {dto.RevisionDetails.ConstructionStatus} Package_Status: {dto.RevisionDetails.PackageStatus}!", Title = "Invalid Revision Type" });
                }
                var RevisionCategory = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == RevisionRules.RevisionGroupId);
                if (RevisionCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision category does not match with the selected revision reason!", Title = "Invalid Revision Category" });
                }
                var DocumentNaming = await _db.tRevisionDocumentsNaming.AsNoTracking().FirstOrDefaultAsync(x => (x.CategoryId != null && x.CategoryId == dto.RevisionDetails.CategoryId) || x.RevisionGroupId == RevisionCategory.RevisionGroupId);
                if (DocumentNaming == null)
                {
                    await transaction.RollbackAsync();
                    return new BadRequestObjectResult(new { Message = "Document naming convention not found for the selected revision reason! Please contact Administrator", Title = "Missing Document Naming" });
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
                    return new BadRequestObjectResult(new { Message = $"Rules does not exist in {RevisionRules.Reason}! Please contact admin", Title = "No Rules Exists" });
                }
                Project.isRevised = true;
                Project.RevisedNumber = (Project.RevisedNumber ?? 0) + 1;
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
                    hasUpdated = true;
                    Project = ProjectDetailsRules.UpdateRevisionData(NewProjectRevision, Project);
                    Project.Id = 0;
                    Project.RevisionNumber = Project.RevisionNumber + 1;
                }
                #endregion
                #region FundingProfile
                var FundingProfile = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                var FundingProfileRules = jsonRules.FundingProfileRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.FundingProfileRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateFundingProfile = dto.FundingProfile;
                if (FundingProfile.Count > 0)
                {
                    foreach (var component in UpdateFundingProfile)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = FundingProfile.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            hasUpdated = true;
                            if (FundingProfileRules.Count > 0)
                            {
                                SelectedComponent = FundingProfileRules.UpdateRevisionData(component, SelectedComponent);
                            }
                            SelectedComponent.RevisedNumber = 1;
                            SelectedComponent.Id = 0;
                        }
                    }
                }
                if (jsonRules.FundingProfileRules.CRUD.CanAdd)
                {
                    var NewFundingToInsert = UpdateFundingProfile.Where(x => x.Id == 0);
                    if (NewFundingToInsert.Count() > 0)
                    {
                        NewFundingProfile.AddRange(NewFundingToInsert.Select(x => new ProjectFundingProfile
                        {
                            ProjectId = Project.ProjectId,
                            Source = x.Source,
                            Agreement = x.Agreement,
                            Amount = x.Amount,
                            Percentage = x.Percentage,
                            StageName = ProjectStage.StageName,
                            RevisedNumber = 1,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        }));
                    }
                }
                if(jsonRules.FundingProfileRules.CRUD.CanDelete)
                {
                    var DeletedFundings = UpdateFundingProfile.Where(x => x.IsDeleted && x.Id != 0).ToList();
                    if (DeletedFundings.Count > 0)
                    {
                        var DeletedFundingIds = DeletedFundings.Select(x => x.Id).ToList();
                        FundingProfile = FundingProfile.Where(x => !DeletedFundingIds.Contains(x.Id)).ToList();
                    }
                }
                #endregion
                #region ComponentCosts
                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(c => c.ReferenceId).Contains(x.ParentId)).ToListAsync();
                var ComponentCostRules = jsonRules.ComponentCostRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCost = dto.ComponentCosts;
                if (ComponentCost.Count > 0)
                {
                    foreach (var component in UpdateComponentCost)
                    {
                        var ComponentId = component.Id;
                        var SelectedComponent = ComponentCost.FirstOrDefault(x => x.Id == ComponentId);

                        if (SelectedComponent != null)
                        {
                            hasUpdated = true;
                            if (ComponentCostRules.Count > 0)
                            {
                                SelectedComponent = ComponentCostRules.UpdateRevisionData(component, SelectedComponent);
                            }
                            SelectedComponent.RevisedNumber = 1;
                            SelectedComponent.Id = 0;
                            var Component = ComponentCostYear.Where(x => x.ParentId == SelectedComponent.ReferenceId).ToList();
                            SelectedComponent.ReferenceId = SelectedComponent.ProjectId + "-" + ("tCountSequence").GenerateCode();
                            Component.ForEach(x => x.ParentId = SelectedComponent.ReferenceId);
                        }
                    }
                }
                var NewComponentToInsert = UpdateComponentCost.Where(x => x.Id == 0);
                if (jsonRules.ComponentCostRules.CRUD.CanAdd)
                {
                    if (NewComponentToInsert.Count() > 0)
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
                }
                if(jsonRules.ComponentCostRules.CRUD.CanDelete)
                {
                    var DeletedComponents = UpdateComponentCost.Where(x => x.IsDeleted && x.Id != 0).ToList();
                    if(DeletedComponents.Count > 0)
                    {
                        var DeletedComponentIds = DeletedComponents.Select(x => x.Id).ToList();
                        ComponentCost = ComponentCost.Where(x => !DeletedComponentIds.Contains(x.Id)).ToList();
                        var DeletedComponentReferenceIds = DeletedComponents.Select(x => x.ReferenceId).ToList();
                        ComponentCostYear = ComponentCostYear.Where(x => !DeletedComponentReferenceIds.Contains(x.ParentId)).ToList();
                    }
                }
                #endregion
                #region ComponentCostYear
                var ComponentCostYearRules = jsonRules.ComponentCostYearRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.ComponentCostYearRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateComponentCostYear = dto.ComponentCostYear;
                if (ComponentCostYear.Count > 0)
                {
                    foreach (var year in UpdateComponentCostYear)
                    {
                        var UpdateCostYear = ComponentCostYear.FirstOrDefault(x => x.Id == year.Id);
                        if (UpdateCostYear != null)
                        {
                            hasUpdated = true;
                            if (ComponentCostYearRules.Count > 0)
                            {
                                UpdateCostYear = ComponentCostYearRules.UpdateRevisionData(year, UpdateCostYear);
                            }
                            UpdateCostYear.Id = 0;
                        }
                    }
                }
                if (jsonRules.ComponentCostYearRules.CRUD.CanAdd)
                {
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
                }
                if(jsonRules.ComponentCostYearRules.CRUD.CanDelete)
                {
                    var DeletedComponentYears = UpdateComponentCostYear.Where(x => x.IsDeleted && x.Id != 0).ToList();
                    if (DeletedComponentYears.Count > 0)
                    {
                        var DeletedComponentYearIds = DeletedComponentYears.Select(x => x.Id).ToList();
                        ComponentCostYear = ComponentCostYear.Where(x => !DeletedComponentYearIds.Contains(x.Id)).ToList();
                    }
                }
                #endregion
                #region MajorWorkItem
                var MajorWorkItem = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                var MajorWorkLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorWorkItem.Select(c => c.ReferenceId).Contains(x.ParentId)).ToListAsync();
                var MajorWorkItemRules = jsonRules.MajorItemOfWorkRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemOfWorkRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorItemOfWorks = dto.MajorItemOfWorks;
                if (MajorWorkItem.Count > 0)
                {
                    foreach (var item in UpdateMajorItemOfWorks)
                    {
                        var UpdateMajorWorkItem = MajorWorkItem.FirstOrDefault(x => x.Id == item.Id);
                        if (UpdateMajorWorkItem != null)
                        {
                            hasUpdated = true;
                            if (MajorWorkItemRules.Count > 0)
                            {
                                UpdateMajorWorkItem = MajorWorkItemRules.UpdateRevisionData(item, UpdateMajorWorkItem);
                            }
                            UpdateMajorWorkItem.RevisedNumber = 1;
                            UpdateMajorWorkItem.Id = 0;
                            var Locations = MajorWorkLocations.Where(x => x.ParentId == UpdateMajorWorkItem.ReferenceId).ToList();
                            UpdateMajorWorkItem.ReferenceId = UpdateMajorWorkItem.ProjectId + "-" + ("tCountSequence").GenerateCode();
                            Locations.ForEach(x => x.ParentId = UpdateMajorWorkItem.ReferenceId);
                        }
                    }
                }
                var NewMajorItemOfWorksToInsert = UpdateMajorItemOfWorks.Where(x => x.Id == 0);
                if (jsonRules.MajorItemOfWorkRules.CRUD.CanAdd)
                {
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
                }
                if(jsonRules.MajorItemOfWorkRules.CRUD.CanDelete)
                {
                    var DeletedMajorItems = UpdateMajorItemOfWorks.Where(x => x.IsDeleted && x.Id != 0).ToList();
                    if (DeletedMajorItems.Count > 0)
                    {
                        var DeletedMajorItemIds = DeletedMajorItems.Select(x => x.Id).ToList();
                        MajorWorkItem = MajorWorkItem.Where(x => !DeletedMajorItemIds.Contains(x.Id)).ToList();
                        var DeletedMajorItemReferenceIds = DeletedMajorItems.Select(x => x.ReferenceId).ToList();
                        MajorWorkLocations = MajorWorkLocations.Where(x => !DeletedMajorItemReferenceIds.Contains(x.ParentId)).ToList();
                    }
                }
                #endregion
                #region MajorWorkLocations
                var MajorItemLocationsRules = jsonRules.MajorItemLocationRules.Fields.GetType()
                .GetProperties()
                .Where(p => p.PropertyType == typeof(bool) || p.PropertyType == typeof(bool?))
                .Where(p => (bool?)p.GetValue(jsonRules.MajorItemLocationRules.Fields) == true)
                .Select(p => p.Name)
                .ToList();
                var UpdateMajorWorkLocations = dto.MajorItemLocations;
                if (MajorWorkLocations.Count > 0)
                {
                    foreach (var location in UpdateMajorWorkLocations)
                    {
                        var UpdateMajorWorkLocation = MajorWorkLocations.FirstOrDefault(x => x.Id == location.Id);
                        if (UpdateMajorWorkLocation != null)
                        {
                            if (MajorWorkItemRules.Count > 0)
                            {
                                UpdateMajorWorkLocation = MajorItemLocationsRules.UpdateRevisionData(location, UpdateMajorWorkLocation);
                            }
                            hasUpdated = true;
                            UpdateMajorWorkLocation.Id = 0;
                        }
                    }
                }
                if (jsonRules.MajorItemLocationRules.CRUD.CanAdd)
                {
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
                            EndChainage = x.EndChainage,
                            StartChainage = x.StartChainage,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        }));
                    }
                }
                if(jsonRules.MajorItemLocationRules.CRUD.CanDelete)
                {
                    var DeletedMajorWorkLocations = UpdateMajorWorkLocations.Where(x => x.IsDeleted && x.Id != 0).ToList();
                    if (DeletedMajorWorkLocations.Count > 0)
                    {
                        var DeletedMajorWorkLocationIds = DeletedMajorWorkLocations.Select(x => x.Id).ToList();
                        MajorWorkLocations = MajorWorkLocations.Where(x => !DeletedMajorWorkLocationIds.Contains(x.Id)).ToList();
                    }
                }
                #endregion
                if (hasUpdated)
                {
                    if (NewFundingProfile.Count > 0 && jsonRules.FundingProfileRules.CRUD.CanAdd)
                    {
                        FundingProfile.AddRange(NewFundingProfile);
                    }
                    if (NewComponent.Count > 0 && jsonRules.ComponentCostRules.CRUD.CanAdd)
                    {
                        ComponentCost.AddRange(NewComponent);
                    }
                    if (NewComponentYear.Count > 0 && jsonRules.ComponentCostYearRules.CRUD.CanAdd)
                    {
                        ComponentCostYear.AddRange(NewComponentYear);
                    }
                    if (NewMajorWorkItem.Count > 0 && jsonRules.MajorItemOfWorkRules.CRUD.CanAdd)
                    {
                        MajorWorkItem.AddRange(NewMajorWorkItem);
                    }
                    if (NewMajorWorkLocations.Count > 0 && jsonRules.MajorItemLocationRules.CRUD.CanAdd)
                    {
                        MajorWorkLocations.AddRange(NewMajorWorkLocations);
                    }


                    await _db.tProjectRevisions.AddAsync(Project);
                    await _db.SaveChangesAsync();
                    var NewProjectStage = new ProjectStages()
                    {
                        ProgramId = ProjectStage.ProgramId,
                        RevisionId = Project.Id,
                        StageId = ProjectStage.StageId,
                        StageName = ProjectStage.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                        IsPublished = true
                    };
                    await _db.tProjectStages.AddAsync(NewProjectStage);
                    await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);
                    await _db.tProjectComponentCost.AddRangeAsync(ComponentCost);
                    await _db.tProjectComponentCostYear.AddRangeAsync(ComponentCostYear);
                    await _db.tProjectMajorWorkItem.AddRangeAsync(MajorWorkItem);
                    await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);

                    bool isROUser = _Session.UserGroups.Contains("RPC");
                    TransactionId = Project.ProjectId + "-" + Project.RevisedNumber;
                    await _db.tRevisionDetails.AddAsync(new RevisionDetails
                    {
                        TransactionId = TransactionId,
                        RevisionGroupId = RevisionCategory.RevisionGroupId,
                        CategoryId = dto.RevisionDetails.CategoryId,
                        ReasonId = RevisionRules.ReasonId,
                        RegionStatus = isROUser ? EnumRevisionStatus.Approved : EnumRevisionStatus.Pending,
                        RegionApprover = isROUser ? _Session.UserId : null,
                        RegionApprovedDate = isROUser ? CurrentDate : null,
                        COStatus = EnumRevisionStatus.Pending,
                        COApprover = null,
                        COApprovedDate = null,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    string DocumentName = $"{TransactionId}_{DocumentNaming.SecondSegmentName}_{CurrentDate.ToString("MM-dd-yyyy")}";
                    //projectid_typengreason_m-d-yyyy
                    await _db.tRevisionDocuments.AddAsync(new RevisionDocuments
                    {
                        TransactionId = TransactionId,
                        DocumentName = DocumentName,
                        IsApprovedDocument = false
                    });
                    string FilePath = Path.Combine(Appsetting.Resources.Revision.ImplementingOffice, DocumentName);
                    if (!dto.RevisionDetails.ApprovedDocument.UploadFile(FilePath))
                    {
                        await transaction.RollbackAsync();
                        return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted!", Title = "File Corrupted" });
                    }
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
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
                //EmailConfig.SendEmail();
                return Ok(
                    new
                    {
                        Message = "Revision request submitted successfully.",
                        Title = "Success",
                        TransactionId = TransactionId
                    }
                );
            }
            catch (DbUpdateException ex)
            {
                var sqlEx = ex.GetBaseException(); // usually SqlException
                return BadRequest(new
                {
                    Message = "Save failed",
                    Error = sqlEx.Message,
                    Details = ex.InnerException?.Message,
                    Stack = ex.StackTrace
                });
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateRevisionStatus([FromBody] UpdateRevisionStatusDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = DateTime.UtcNow;
                var RevisionDetails = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId && (x.RegionStatus != EnumRevisionStatus.Rejected || x.COStatus != EnumRevisionStatus.Rejected));
                if(RevisionDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Revision Transaction ID {dto.TransactionId} does not exist in revision requests", Title = "Transaction ID not found" });
                }
                if (string.IsNullOrEmpty(_Session.UserGroups))
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to submit Revision. Please contact administrator!", Title = "User Groups Missing" });
                }
                bool isROUser = _Session.UserGroups.Contains("RPC");
                bool isCOUser = _Session.UserGroups.Contains("AUC");
                if(!isCOUser && !isROUser)
                {
                    return new BadRequestObjectResult(new { Message = "Account usergroup is not allowed to update Revision. Please contact administrator!", Title = "Invalid User Group" });
                }
                if (dto.Status == EnumRevisionStatus.ForCorrection)
                {
                    var existingCorrections = await _db.tRevisionForCorrectionDetails.AsNoTracking()
                        .Where(x => x.TransactionId == dto.TransactionId
                        && string.IsNullOrEmpty(x.ROComment)
                        && !string.IsNullOrEmpty(x.COComment))
                        .OrderByDescending(x => x.Id)
                        .FirstOrDefaultAsync();
                    if (existingCorrections != null)
                    {
                        if(isCOUser)
                        {
                            existingCorrections.COComment = dto.Remarks;
                            existingCorrections.COForCorrectionDate = CurrentDate;
                        }
                        else
                        {
                            existingCorrections.ROComment = dto.Remarks;
                            existingCorrections.ROForCorrectionDate = CurrentDate;
                        }
                        _db.tRevisionForCorrectionDetails.Update(existingCorrections);
                    }
                    else
                    {
                        await _db.tRevisionForCorrectionDetails.AddAsync(new RevisionForCorrectionDetails
                        {
                            TransactionId = dto.TransactionId,
                            ROComment = dto.Remarks,
                            ROForCorrectionDate = CurrentDate
                        });
                    }
                }
                RevisionDetails.RegionStatus = (isROUser ? dto.Status : RevisionDetails.RegionStatus);
                RevisionDetails.RegionApprover = (isROUser ? _Session.UserId : RevisionDetails.RegionApprover);
                RevisionDetails.RegionApprovedDate = (isROUser ? CurrentDate : RevisionDetails.RegionApprovedDate);
                if(isCOUser)
                {
                    if (RevisionDetails.RegionStatus != EnumRevisionStatus.Approved)
                    {
                        return new BadRequestObjectResult(new { Message = "Revision is not yet approved by Regional Office", Title = "Pending For Approval" });
                    }
                    if (dto.Status == EnumRevisionStatus.Approved)
                    {
                        if(dto.Document == null)
                        {
                            return new BadRequestObjectResult(new { Message = "Approved document needs to be attached before approving!", Title = "Signed Document Required" });
                        }
                        var RevisionDocument = await _db.tRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.TransactionId == dto.TransactionId && x.IsApprovedDocument == false);
                        if (RevisionDocument == null)
                        {
                            return new BadRequestObjectResult(new { Message = "Request document from IO is missing. Please contact Administrator!", Title = "Missing Document" });
                        }
                        if (RevisionDocument != null)
                        {
                            string FilePath = Path.Combine(Appsetting.Resources.Revision.CentralOffice, dto.TransactionId, dto.Document.Name);
                            if (!dto.Document.UploadFile(FilePath))
                            {
                                return new BadRequestObjectResult(new { Message = "Uploaded document is corrupted!", Title = "File Corrupted" });
                            }
                            RevisionDocument.IsApprovedDocument = true;
                            _db.tRevisionDocuments.Update(RevisionDocument);
                        }
                    }
                    RevisionDetails.COStatus = dto.Status;
                    RevisionDetails.COApprover = _Session.UserId;
                    RevisionDetails.COApprovedDate = CurrentDate;
                }
                _db.tRevisionDetails.Update(RevisionDetails);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = $"Revision Updated by {_Session.UserGroups}", Title = "Updated Successfully" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
    }
}