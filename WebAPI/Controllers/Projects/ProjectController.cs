using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using OfficeOpenXml;
using System.Data.SqlClient;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
namespace WebAPI.Controllers.Projects
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectController : CoreController
    {
        public ProjectController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region Project Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowProjects([FromBody] ShowProjectDTO dto)
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

                var baseQuery = _db.vProjectLatestStage.AsNoTracking();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.ProgramId))
                    baseQuery = baseQuery.Where(e => e.ProgramId!.Contains(dto.Filters.ProgramId));

                if (!string.IsNullOrEmpty(dto.Filters?.ProjectId))
                    baseQuery = baseQuery.Where(e => e.ProjectId!.Contains(dto.Filters.ProjectId));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                IOrderedQueryable<DBHelper.Models.Views.ProjectLatestStage> sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.ProjectLatestStage> permissionLists = await sortedQuery
                   .Skip((dto.page - 1) * dto.limit)
                   .Take(dto.limit)
                   .ToListAsync();


                //var pageRows = await ordered.Take(dto.limit).ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);
                //var lastRow = pageRows.Count > 0 ? pageRows[^1] : null;

                var response = new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages,
                    //nextCursor = lastRow == null ? null : new
                    //{
                    //    lastSortValue = EF.Property<object>(lastRow, dto.SortField),
                    //    lastId = lastRow.Id
                    //}
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
        public async Task<IActionResult> ShowProjectStages([FromBody] ShowProjectStagesDTO dto)
        {
            try
            {
                //var Stage = await _db.vProjectDetails
                //.FromSqlInterpolated($"SELECT * FROM ProjectPerStages({dto.ProjectId}) fp WHERE fp.ReferenceId = {dto.ProjectId}")
                //.AsNoTracking().Select(x => new ProjectPerStage()
                //{
                //    Id = x.Id,
                //    ProgramId = x.ProgramId,
                //    ProgramName = x.ProgramName,
                //    StageId = x.StageId,
                //    StageName = x.StageName,
                //    ReferenceId = x.ReferenceId,
                //    ProjectId = x.ProjectId,
                //    Description = x.Description,
                //    Thrust = _db.tProjectThrustLists.FirstOrDefault(a => a.PAPKey == x.Thrust)!.ThrustDescription ?? x.Thrust.ToString(),
                //    Category = _db.tOptionProjectCategory.FirstOrDefault(a => a.CategoryId == x.Category)!.CategoryName ?? x.Category.ToString(),
                //    City = _db.tOptionAdminAreaCityMunicipality.FirstOrDefault(a => a.Code == x.City)!.Name ?? x.City.ToString(),
                //    LegislativeDistrict = _db.tOptionAdminAreaCongressionalDistrict.FirstOrDefault(a => a.Code == x.LegislativeDistrict)!.Name ?? x.LegislativeDistrict.ToString(),
                //    Cost = _db.tProjectComponentCost.Where(a => a.ProjectId == x.ReferenceId && a.StageName == x.StageName).Sum(a => a.Amount),
                //    CreatedBy = x.CreatedBy,
                //    CreatedDate = x.CreatedDate,

                //}).ToListAsync();
                string ProjectId = (dto.ProjectId.Contains("B") ? dto.ProjectId : $"B{dto.ProjectId}");
                var Stage = await _db.vProjectPerStages.AsNoTracking().Where(x => x.ReferenceId == ProjectId || x.ReferenceId == dto.ProjectId).ToListAsync();
                return Ok(new
                {
                    Stages = Stage
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Add Project
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitAddProject()
        {
            try
            {
                var AvailablePrograms = await _db.vProgramDetails.AsNoTracking().Where(x => x.IsPublished != true).ToListAsync();
                int CurrentYear = (int)DateTime.UtcNow.Year;
                var Category = await _db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.CategoryName).ToListAsync();
                var Thrust = await _db.tProjectThrustLists.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tOptionProjectOrigin.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tOptionProjectAgency.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var RowAvailables = await _db.tOptionProjectRowAvailable.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Design = await _db.tOptionProjectDetailedDesign.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                return Ok(new
                {
                    Programs = AvailablePrograms,
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
                    RowsAvailable = RowAvailables,
                    DetailedDesign = Design
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] AddProjectDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = DateTime.UtcNow;
                #region Field Validation
                if (dto.Feasibility == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Feasibility is required!", Title = "Invalid Feasibility" });
                }
                if (dto.ImplementationMode == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Implementation Mode is required!", Title = "Invalid Implementation Mode" });
                }
                var ValidateDescription = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.Description == dto.Description);
                if (ValidateDescription != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Description: {dto.Description} already exist in {ValidateDescription.ProjectId}", Title = "Description Exists" });
                }
                #endregion
                var Program = await _db.vPrograms.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Selected Program not found!", Title = "Program Not Found" });
                }
                var ProgramDetails = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.StageName == Program.StageName);
                if(ProgramDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Selected Program details not found!", Title = "Program Details Not Found" });
                }
                if (ProgramDetails.IsPublished == true)
                {
                    return new BadRequestObjectResult(new { Message = "Selected Program is already published!", Title = "Program Already Published" });
                }
                var Category = await _db.tOptionProjectCategory.FirstOrDefaultAsync(x => x.CategoryId == dto.Category && (x.ValidUntil == 0 || x.ValidUntil >= CurrentDate.Year));
                if(Category == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Category '{dto.Category}' is not valid!", Title = "Invalid Category" });
                }
                var Thrust = await _db.tProjectThrustLists.FirstOrDefaultAsync(x => x.PAPKey == dto.Thrust);
                if(Thrust == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.Thrust}' is not valid!", Title = "Invalid Thrust" });
                }
                var Origin = await _db.tOptionProjectOrigin.FirstOrDefaultAsync(x => x.NameId == dto.Origin);
                if(Origin == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Origin '{dto.Origin}' is not valid!", Title = "Invalid Origin" });
                }
                var City = await _db.tOptionAdminAreaCityMunicipality.FirstOrDefaultAsync(x => x.GdbId == dto.City);
                if(City == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected City '{dto.City}' is not valid!", Title = "Invalid City" });
                }
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.FirstOrDefaultAsync(x => x.GdbId.ToString() == dto.LegislativeDistrict);
                if(LD == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.LegislativeDistrict}' is not valid!", Title = "Invalid Legislative District" });
                }
                var SelectedDeo = await _db.tOptionAdminAreaDistrictEngineeringOffice.FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (SelectedDeo == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected DEO '{dto.DEO}' is not valid!", Title = "Invalid DEO" });
                }
                var SelectedRegion = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => x.ParticipantId == SelectedDeo.RegionParticipantId);
                if (SelectedRegion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Region '{dto.Region}' is not valid!", Title = "Invalid Region" });
                }
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.OperatingUnit);
                if(OperatingUnit == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.OperatingUnit}' is not valid!", Title = "Invalid Operating Unit" });
                }
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.ImplementingOffice);
                if(IO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{dto.ImplementingOffice}' is not valid!", Title = "Invalid Implementing Office" });
                }
                var Feasib = await _db.tOptionProjectFeasibilityStudy.FirstOrDefaultAsync(x => x.NameId == dto.Feasibility);
                if(Feasib == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.Feasibility}' is not valid!", Title = "Invalid Feasibility" });
                }
                var Agency = await _db.tOptionProjectAgency.FirstOrDefaultAsync(x => x.NameId == dto.Agency);
                if(Agency == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.Agency}' is not valid!", Title = "Invalid Agency" });
                }
                var ImplementationMode = await _db.tOptionProjectImplementationMode.FirstOrDefaultAsync(x => x.NameId == dto.ImplementationMode);
                if(ImplementationMode == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ImplementationMode}' is not valid!", Title = "Invalid Implementation Mode" });
                }
                var EmergencyMode = await _db.tOptionProjectEmergencyMode.FirstOrDefaultAsync(x => x.NameId == dto.EmergencyMode);
                if(EmergencyMode == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.EmergencyMode}' is not valid!", Title = "Invalid Emergency Mode" });
                }
                var RowAvailable = await _db.tOptionProjectRowAvailable.FirstOrDefaultAsync(x => x.NameId == dto.EmergencyMode);
                if(RowAvailable == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Row Available '{dto.EmergencyMode}' is not valid!", Title = "Invalid Row Available" });
                }
                var DetailedDesign = await _db.tOptionProjectDetailedDesign.FirstOrDefaultAsync(x => x.NameId == dto.EmergencyMode);
                if(DetailedDesign == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{dto.EmergencyMode}' is not valid!", Title = "Invalid Detailed Design" });
                }
                string FirstSegment = ProgramDetails.StageName.GenerateProjec1stSegment();
                string SecondSegment = ProgramDetails.YearStart.GenerateProjec2ndSegment();
                Random rand = new Random();
                string ThirdSegment = Category.Minimum.ToString("D5");
                string FourthSegment = !string.IsNullOrEmpty(dto.IslandCode) ? dto.IslandCode : SelectedRegion.IslandCode;
                var CheckExistingVersion = await _db.vGetProjectCategoryVersions.AsNoTracking().Where(x => x.Category == dto.Category
                    && x.ProjectSuffix == FirstSegment
                    && x.IslandCode == FourthSegment
                    && x.YearStart == ProgramDetails.YearStart)
                .OrderByDescending(x => x.MaxId)
                .FirstOrDefaultAsync();
                ThirdSegment = CheckExistingVersion != null ? (int.Parse(CheckExistingVersion.MaxId!) + 1).ToString("D5") : ThirdSegment;
                string ReferenceId = $"{FirstSegment}{SecondSegment}{ThirdSegment}{FourthSegment}";
                var SubmitProject = new DBHelper.Models.Table.Projects()
                {
                    ProgramId = ProgramDetails.ProgramId,
                    ReferenceId = ReferenceId,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(SubmitProject);
                var ProjectRevision = new ProjectRevisions()
                {
                    ReferenceId = ReferenceId,
                    ProjectId = ReferenceId,
                    AlternateId = dto.AlternateId,
                    ExternalId = dto.ExternalId,
                    MYId = dto.MYId,
                    UACS = dto.UACS,
                    MYCAApprovalDate = dto.MYCAApprovalDate,
                    RevisionNumber = 1,
                    Description = dto.Description!,
                    Category = dto.Category,
                    Thrust = dto.Thrust,
                    Origin = dto.Origin,
                    City = dto.City,
                    Province = dto.Province,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    OperatingUnit = dto.OperatingUnit!,
                    ImplementingOffice = dto.ImplementingOffice!,
                    DEO = SelectedDeo.ParticipantId,
                    Region = dto.Region!,
                    Agency = (int)dto.Agency!,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = (int)dto.EmergencyMode!,
                    IslandCode = SelectedRegion.IslandCode ?? dto.IslandCode!,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = (int)dto.DetailedDesign!,
                    DetailedDesignDate = dto.DetailedDesignDate,
                    RowAvailable = (int)dto.RowAvailable!,
                    RegionWide = dto.RegionWide,
                    Tier = dto.Tier,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjectRevisions.AddAsync(ProjectRevision);
                await _db.SaveChangesAsync();
                var ProjectStage = new ProjectStages()
                {
                    ProgramId = ProgramDetails.ProgramId,
                    ReferenceId = ProjectRevision.ReferenceId,
                    RevisionId = ProjectRevision.Id,
                    StageId = ProgramDetails.StageId,
                    StageName = ProgramDetails.StageName,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate,
                    IsPublished = false
                };
                await _db.tProjectStages.AddAsync(ProjectStage);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    ProjectId = ReferenceId,
                    StageName = ProgramDetails.StageName,
                    Message = "Project added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Project Details
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ProjectDetails([FromBody] ProjectDetailsDTO dto)
        {
            try
            {
                //var Project = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.)
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.StageName = {dto.StageName} AND fp.ProjectId = {dto.ProjectId}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                //var Project = await _db.vProjectDetails.AsNoTracking().Where(x => x.ReferenceId == dto.ProjectId).OrderByDescending(x => x.RevisionNumber).FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var CurrentProgramVersion = await _db.vPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"No program is associated with the Project ID {dto.ProjectId}. Please contact administrator!", Title = "Program Not Associated" });
                }
                var Program = await _db.vProgramDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId && x.StageName == dto.StageName);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                int CurrentYear = (int)DateTime.UtcNow.Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var SupportingDoc = await _db.tDropdownSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                var ComponentType = await _db.tOptionProjectComponent.AsNoTracking().OrderBy(x => x.ComponentName).ToListAsync();
                //var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && x.IsDeleted == false).ToListAsync();
                var ComponentCost = await _db.tProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({Project.ProjectId}) fp WHERE fp.StageName = {Project.StageName}").AsNoTracking().ToListAsync();
                //var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(a => a.ReferenceId).Contains(x.ParentId)).ToListAsync();

                var MajorItemOfWork = await _db.tProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({Project.ProjectId}) fp WHERE fp.StageName = {Project.StageName}").AsNoTracking().ToListAsync();
                HashSet<string> ItemParents = MajorItemOfWork.Select(x => x.ReferenceId).ToHashSet();
                var MajorWorkLocation = await _db.tProjectMajorWorkLocations.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkLocations({Project.ProjectId})").AsNoTracking().Where(x => ItemParents.Contains(x.ParentId) && x.IsDeleted == false).ToListAsync();

                var RowAvailables = await _db.tOptionProjectRowAvailable.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                //var Funding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && x.RevisedNumber == Project.RevisedNumber && x.IsDeleted == false).ToListAsync();
                var Funding = await _db.tProjectFundingProfile.FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({Project.ProjectId}) fp WHERE fp.StageName = {Project.StageName}").AsNoTracking().ToListAsync();

                var Category = await _db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.CategoryName).ToListAsync();
                var Thrust = await _db.tProjectThrustLists.AsNoTracking().OrderBy(x => x.ThrustDescription).ToListAsync();
                var Origin = await _db.tOptionProjectOrigin.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var IO = await _db.vAdminImplementingOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var DEO = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Region = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Agency = await _db.tOptionProjectAgency.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var EmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Design = await _db.tOptionProjectDetailedDesign.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                var Agreement = await _db.tOptionFundingAgreement.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var Source = await _db.tOptionFundingSource.AsNoTracking().Where(x => Agreement.Select(a => a.SourceOrg).Distinct().Contains(x.Organization)).OrderBy(x => x.Organization == "GOP" ? 0 : 1).ThenBy(x => x.Name).ToListAsync();

                var ScopeOfWork = await _db.tProjectScopeOfWorkEnum.AsNoTracking().OrderBy(x => x.WorkCategory).ToListAsync();
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.TransactionId == dto.ProjectId).ToListAsync();
                List<OptionRevisionHeader> ReasonHeader = new List<OptionRevisionHeader>();
                List<OptionRevisionCategory> ReasonCategory = new List<OptionRevisionCategory>();
                List<OptionRevisionReasons> ReasonReason = new List<OptionRevisionReasons>();
                if (Project.StageName == "GAA-R")
                {
                    ReasonHeader = await _db.tOptionRevisionHeader.AsNoTracking().OrderBy(x => x.RevisionName).ToListAsync();
                    ReasonCategory = await _db.tOptionRevisionCategory.AsNoTracking().OrderBy(x => x.CategoryName).ToListAsync();
                    ReasonReason = await _db.tOptionRevisionReasons.AsNoTracking().OrderBy(x => x.Reason).ToListAsync();
                }
                return Ok(new
                {
                    IsActive = (CurrentProgramVersion.StageName == Project.StageName) ? true : false,
                    ProgramDetails = Program,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    //ComponentCostPerYear = ComponentCostYear,
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
                        RowsAvailable = RowAvailables,
                        DetailedDesign = Design,

                        //SupportingDocs
                        SupportingDocs = SupportingDoc,

                        //Component Cost
                        ComponentTypes = ComponentType,

                        //Major Item Of Work
                        ScopeOfWorks = ScopeOfWork,

                        //Funding Profile
                        Agreements = Agreement,
                        Sources = Source,

                        Revisions = new
                        {
                            Headers = ReasonHeader,
                            Categories = ReasonCategory,
                            Reasons = ReasonReason
                        }
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
        public async Task<IActionResult> UpdateProjectDetails([FromBody] UpdateProjectDetailsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = DateTime.UtcNow;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();

                var ValidateDescription = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.Description == dto.ProjectDetails.Description && x.ReferenceId != dto.ProjectDetails
                .ReferenceId);
                if (ValidateDescription != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Description: {dto.ProjectDetails.Description} already exist in {ValidateDescription.ProjectId}", Title = "Description Exists" });
                }
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectDetails.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectDetails.ProjectId} AND fp.StageName = {dto.ProjectDetails.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                //var Project = await _db.vProjectDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectDetails.ProjectId);
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var Program = await _db.vProgramDetails.AsNoTracking().OrderByDescending(x => x.RevisionNumber).FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId && x.StageName == dto.ProjectDetails.StageName);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                bool HasCostUpdate = false;

                #region Field Validations
                #region Project
                if (string.IsNullOrEmpty(dto.ProjectDetails.Province))
                {
                    return new BadRequestObjectResult(new { Message = "Please select valid Province", Title = "Province is required!" });
                }
                #endregion
                #region Funding Profile
                var BlankFunding = dto.FundingProfile.Where(x => x.Amount <= 0).ToList();
                if(!BlankFunding.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid amount(s). Please check and try again.", Title = "Invalid Funding Profile Amount" });
                }
                var BlankFundingSource = dto.FundingProfile.Where(x => string.IsNullOrEmpty(x.Source)).ToList();
                if (!BlankFundingSource.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid source(s). Please check and try again.", Title = "Invalid Funding Profile Source" });
                }
                var BlankFundingAgreement = dto.FundingProfile.Where(x => string.IsNullOrEmpty(x.Agreement)).ToList();
                if (!BlankFundingAgreement.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid agreement(s). Please check and try again.", Title = "Invalid Funding Profile Agreement" });
                }
                #endregion
                #region Component Cost
                var BlankComponentCost = dto.ComponentCosts.Where(x => x.Amount <= 0 && x.Id == 0).ToList();
                if (!BlankComponentCost.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Component Cost contains invalid amount(s). Please check and try again.", Title = "Invalid Component Cost Amount" });
                }
                var BlankComponentType = dto.ComponentCosts.Where(x => string.IsNullOrEmpty(x.ComponentType)).ToList();
                if (!BlankComponentType.IsNullOrEmpty())
                {
                    return new BadRequestObjectResult(new { Message = "Component Cost contains invalid component type(s). Please check and try again.", Title = "Invalid Component Cost Type" });
                }
                #endregion
                #region Major Work Item
                #endregion
                #region Major Work Location
                #endregion
                #endregion

                #region Update Project Details
                if (Project.MYId != dto.ProjectDetails?.MYId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "MYId",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.MYId!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.MYId!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.MYId = dto.ProjectDetails!.MYId;
                }
                if (Project.AlternateId != dto.ProjectDetails?.AlternateId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "AlternateId",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.AlternateId!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.AlternateId!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.AlternateId = dto.ProjectDetails!.AlternateId;
                }
                if (Project.ExternalId != dto.ProjectDetails?.ExternalId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ExternalId",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.ExternalId!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.ExternalId!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ExternalId = dto.ProjectDetails!.ExternalId;
                }
                if (Project.UACS != dto.ProjectDetails?.UACS)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "UACS",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.UACS!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.UACS!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.UACS = dto.ProjectDetails!.UACS;
                }
                if (Project.Tier != dto.ProjectDetails?.Tier)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Tier",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.Tier.ToString()}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.Tier.ToString()}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Tier = dto.ProjectDetails!.Tier;
                }
                if (Project.Description != dto.ProjectDetails?.Description)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Description",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails!.Description!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.Description!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Description = dto.ProjectDetails!.Description;
                }
                if (Project.Category != dto.ProjectDetails?.Category)
                {
                    var Category = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == dto.ProjectDetails!.Category);
                    if (Category == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Category '{dto.ProjectDetails!.Category}' is not valid!", Title = "Invalid Category" });
                    }
                    var OldCategory = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == Project.Category);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Category",
                        NewValue = $"Stage: {Program.StageName} Value: {Category.CategoryName}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldCategory?.CategoryName}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Category = dto.ProjectDetails!.Category;
                }
                if (Project.Thrust != dto.ProjectDetails?.Thrust)
                {
                    var Thrust = await _db.tProjectThrustLists.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == dto.ProjectDetails!.Thrust);
                    if (Thrust == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.ProjectDetails!.Thrust}' is not valid!", Title = "Invalid Thrust" });
                    }
                    var OldThrust = await _db.tProjectThrustLists.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == Project.Thrust);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {Program.StageName} Value: {Thrust.SubProgramName}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldThrust?.SubProgramName}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Thrust = dto.ProjectDetails!.Thrust;
                }
                if (Project.Origin != dto.ProjectDetails?.Origin)
                {
                    var Origin = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.Origin);
                    if (Origin == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Origin '{dto.ProjectDetails!.Origin}' is not valid!", Title = "Invalid Origin" });
                    }
                    var OldOrigin = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Origin);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {Program.StageName} Value: {Origin.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldOrigin?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Origin = dto.ProjectDetails!.Origin;
                }
                if (Project.City != dto.ProjectDetails?.City)
                {
                    var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.GdbId == dto.ProjectDetails!.City);
                    if (City == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected City '{dto.ProjectDetails!.City}' is not valid!", Title = "Invalid City" });
                    }
                    var OldCity = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.GdbId == Project.City);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "City",
                        NewValue = $"Stage: {Program.StageName} Value: {City.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldCity?.Name}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.City = dto.ProjectDetails!.City;
                }
                //if (Project.Province != dto.ProjectDetails?.Province)
                //{
                //    var Province = await _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefaultAsync(x => x.Code == dto.ProjectDetails!.Province);
                //    if (Province == null)
                //    {
                //        return new BadRequestObjectResult(new { Message = $"Selected Province '{dto.ProjectDetails!.Province}' is not valid!", Title = "Invalid Province" });
                //    }
                //    var OldProvince = await _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefaultAsync(x => x.Code == Project.Province);
                //    hasUpdated = true;
                //    transactionLogs.Add(new TransactionLog
                //    {
                //        TransactionId = Project.ProjectId!,
                //        TypeOfTransaction = "Update",
                //        AffectedTable = "tProjectRevisions",
                //        AffectedColumn = "Province",
                //        NewValue = Province.Name,
                //        OldValue = OldProvince?.Name ?? "",
                //        CreatedBy = _Session.UserId,
                //        CreatedDate = CurrentDate
                //    });
                //    Project.Province = dto.ProjectDetails!.Province;
                //}
                if (Project.LegislativeDistrict != dto.ProjectDetails?.LegislativeDistrict)
                {
                    var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.GdbId == dto.ProjectDetails!.LegislativeDistrict);
                    if (LD == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.ProjectDetails!.LegislativeDistrict}' is not valid!", Title = "Invalid Legislative District" });
                    }
                    var OldLD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.GdbId == Project.LegislativeDistrict);
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "LegislativeDistrict",
                        NewValue = $"Stage: {Program.StageName} Value: {LD.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldLD?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.LegislativeDistrict = dto.ProjectDetails!.LegislativeDistrict;
                    hasUpdated = true;
                }
                if (Project.OperatingUnit != dto.ProjectDetails?.OperatingUnit)
                {
                    HashSet<string> OUList = new HashSet<string>() { "C", "DO" };
                    var OperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.OperatingUnit);
                    if (OperatingUnit == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.ProjectDetails!.OperatingUnit}' is not valid!", Title = "Invalid Operating Unit" });
                    }
                    var OldOperatingUnit = await _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.OperatingUnit);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "OperatingUnit",
                        NewValue = $"Stage: {Program.StageName} Value: {OperatingUnit.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OperatingUnit?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
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
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementingOffice",
                        NewValue = $"Stage: {Program.StageName} Value: {IO.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldIO?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementingOffice = dto.ProjectDetails!.ImplementingOffice;
                }
                //if (Project.DEO != dto.ProjectDetails?.DEO)
                //{
                //    var SelectedDeo = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.DEO);
                //    if (SelectedDeo == null)
                //    {
                //        return new BadRequestObjectResult(new { Message = $"Selected DEO '{dto.ProjectDetails!.DEO}' is not valid!", Title = "Invalid DEO" });
                //    }
                //    var OldDeo = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.DEO);
                //    hasUpdated = true;
                //    transactionLogs.Add(new TransactionLog
                //    {
                //        TransactionId = Project.ProjectId!,
                //        TypeOfTransaction = "Update",
                //        AffectedTable = "tProjectRevisions",
                //        AffectedColumn = "DEO",
                //        NewValue = SelectedDeo.Name,
                //        OldValue = OldDeo?.Name ?? "",
                //        CreatedBy = _Session.UserId,
                //        CreatedDate = CurrentDate
                //    });
                //    Project.DEO = SelectedDeo.ParticipantId;
                //}
                //if (Project.Region != dto.ProjectDetails?.Region)
                //{
                //    hasUpdated = true;
                //    transactionLogs.Add(new TransactionLog
                //    {
                //        TransactionId = Project.ProjectId!,
                //        TypeOfTransaction = "Update",
                //        AffectedTable = "tProjectRevisions",
                //        AffectedColumn = "Region",
                //        NewValue = dto.ProjectDetails!.Region ?? "",
                //        OldValue = Project.Region ?? "",
                //        CreatedBy = _Session.UserId,
                //        CreatedDate = CurrentDate
                //    });
                //    Project.Region = dto.ProjectDetails!.Region;
                //}
                if (Project.Agency != dto.ProjectDetails?.Agency)
                {
                    var Agency = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.Agency);
                    if (Agency == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.ProjectDetails!.Agency}' is not valid!", Title = "Invalid Agency" });
                    }
                    var OldAgency = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Agency);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Agency",
                        NewValue = $"Stage: {Program.StageName} Value: {Agency.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldAgency?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Agency = dto.ProjectDetails!.Agency;
                }
                if(dto.ProjectDetails!.ImplementationMode == null || dto.ProjectDetails!.ImplementationMode == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Implementation Mode is required!", Title = "Implementation Mode Required" });
                }
                if (Project.ImplementationMode != dto.ProjectDetails?.ImplementationMode)
                {
                    var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.ImplementationMode);
                    if (ImplementationMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ProjectDetails!.ImplementationMode}' is not valid!", Title = "Invalid Implementation Mode" });
                    }
                    var OldImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.ImplementationMode);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementationMode",
                        NewValue = $"Stage: {Program.StageName} Value: {ImplementationMode.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldImplementationMode?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementationMode = dto.ProjectDetails!.ImplementationMode;
                }
                if (Project.EmergencyMode != dto.ProjectDetails?.EmergencyMode)
                {
                    var EmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.EmergencyMode);
                    if (EmergencyMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Emergency Mode" });
                    }
                    var OldEmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.EmergencyMode);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "EmergencyMode",
                        NewValue = $"Stage: {Program.StageName} Value: {EmergencyMode.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldEmergencyMode?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.EmergencyMode = dto.ProjectDetails!.EmergencyMode;
                }
                if (dto.ProjectDetails!.Feasibility == null || dto.ProjectDetails!.Feasibility == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Feasibility is required!", Title = "Feasibility Required" });
                }
                if (Project.Feasibility != dto.ProjectDetails?.Feasibility)
                {
                    var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.Feasibility);
                    if (Feasib == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.ProjectDetails!.Feasibility}' is not valid!", Title = "Invalid Feasibility" });
                    }
                    var OldFeasibility = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Feasibility);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Feasibility",
                        NewValue = $"Stage: {Program.StageName} Value: {Feasib.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldFeasibility?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Feasibility = dto.ProjectDetails!.Feasibility;
                }
                if (Project.FeasibilityDate != dto.ProjectDetails?.FeasibilityDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "FeasibilityDate",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails?.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project?.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.FeasibilityDate = dto.ProjectDetails?.FeasibilityDate;
                }
                if (Project.DetailedDesign != dto.ProjectDetails?.DetailedDesign)
                {
                    var DetailedDesign = await _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.DetailedDesign);
                    if (DetailedDesign == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{dto.ProjectDetails!.DetailedDesign}' is not valid!", Title = "Invalid Detailed Design" });
                    }
                    var OldDetailedDesign = await _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.DetailedDesign);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesign",
                        NewValue = $"Stage: {Program.StageName} Value: {DetailedDesign.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldDetailedDesign?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesign = dto.ProjectDetails!.DetailedDesign;
                }
                if (Project.DetailedDesignDate != dto.ProjectDetails?.DetailedDesignDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesignDate",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails?.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project?.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesignDate = dto.ProjectDetails?.DetailedDesignDate;
                }
                if (Project.RowAvailable != dto.ProjectDetails?.RowAvailable)
                {
                    var RowAvailable = await _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.RowAvailable);
                    if (RowAvailable == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Row Available '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Row Available" });
                    }
                    var OldRowAvailable = await _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.RowAvailable);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RowAvailable",
                        NewValue = $"Stage: {Program.StageName} Value: {RowAvailable.Name!}",
                        OldValue = $"Stage: {Program.StageName} Value: {OldRowAvailable?.Name!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RowAvailable = dto.ProjectDetails!.RowAvailable;
                }
                if (Project.RegionWide != dto.ProjectDetails?.RegionWide)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RegionWide",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails?.RegionWide.ToString()!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.RegionWide.ToString()!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RegionWide = dto.ProjectDetails!.RegionWide;
                }
                if (Project.Tier != dto.ProjectDetails?.Tier)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Tier",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails?.Tier.ToString()!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.Tier.ToString()!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Tier = dto.ProjectDetails!.Tier;
                }
                if (hasUpdated)
                {
                    var LatestRevision = await _db.tProjectRevisions.AsNoTracking()
                        .Where(x => x.ProjectId == Project.ProjectId)
                        .OrderByDescending(x => x.RevisionNumber)
                        .FirstOrDefaultAsync();
                    var NewRevision = new ProjectRevisions()
                    {
                        ReferenceId = Project.ReferenceId,
                        ProjectId = Project.ProjectId!,
                        AlternateId = Project.AlternateId,
                        ExternalId = Project.ExternalId,
                        MYId = Project.MYId,
                        UACS = Project.UACS,
                        MYCAApprovalDate = Project.MYCAApprovalDate,
                        IslandCode = Project.IslandCode!,
                        RevisionNumber = LatestRevision!.RevisionNumber! + 1,
                        Description = Project!.Description!,
                        Category = Project!.Category,
                        Thrust = Project!.Thrust,
                        Origin = Project!.Origin,
                        City = Project!.City,
                        LegislativeDistrict = Project!.LegislativeDistrict,
                        OperatingUnit = Project!.OperatingUnit!,
                        ImplementingOffice = Project!.ImplementingOffice!,
                        DEO = Project.DEO!,
                        Region = Project.Region!,
                        Agency = (int)Project.Agency!,
                        ImplementationMode = Project.ImplementationMode,
                        EmergencyMode = (int)Project.EmergencyMode!,
                        Feasibility = Project.Feasibility,
                        DetailedDesign = (int)Project.DetailedDesign!,
                        RowAvailable = (int)Project.RowAvailable!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    };
                    await _db.tProjectRevisions.AddAsync(NewRevision);
                    await _db.SaveChangesAsync();
                    var newStage = new ProjectStages()
                    {
                        ProgramId = Program.ProgramId!,
                        RevisionId = NewRevision.Id,
                        StageId = Program.StageId,
                        StageName = Program.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                        IsPublished = false
                    };
                    await _db.tProjectStages.AddAsync(newStage);
                }
                #endregion
                #region Update Component Cost
                var CostToBeDeleted = dto.ComponentCosts.Where(x => x.IsDeleted == true && x.Id > 0).Select(x => x.Id).ToHashSet<int>();
                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName && !x.IsDeleted).ToListAsync();
                var NewComponentCostData = dto.ComponentCosts.Where(x => x.Id == 0 && !x.IsDeleted);
                #region New Component Cost
                if (NewComponentCostData.Count() > 0)
                {
                    HasCostUpdate = true;
                    var NewCostToAdd = NewComponentCostData.Select((item, index) => new DBHelper.Models.Table.ProjectComponentCost
                    {
                        StageName = Project.StageName!,
                        ProjectId = Project.ProjectId!,
                        ComponentId = item.ComponentId,
                        ComponentType = item.ComponentType,
                        Description = item.Description,
                        Amount = item.Amount,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }).ToList();
                    await _db.tProjectComponentCost.AddRangeAsync(NewCostToAdd);
                }
                #endregion
                #region Update Component Cost
                if (ComponentCost.Count > 0)
                {
                    var UpdateComponentCost = dto.ComponentCosts.Where(x => ComponentCost.Select(a => a.Id).Contains(x.Id)).ToList();
                    if (UpdateComponentCost.Count > 0)
                    {
                        HasCostUpdate = true;
                        foreach (var item in UpdateComponentCost)
                        {
                            var ExistingItem = ComponentCost.FirstOrDefault(x => x.Id == item.Id);
                            bool ComponentUpdate = false;
                            if (ExistingItem != null)
                            {
                                if (ExistingItem.ComponentType != item.ComponentType)
                                {
                                    ComponentUpdate = true;
                                    var Component = await _db.tOptionProjectComponent.FirstOrDefaultAsync(x => x.ComponentName == item.ComponentType);
                                    if (Component == null)
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Component '{item.ComponentType}' is not valid!", Title = "Invalid Component" });
                                    }
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "ComponentType",
                                        NewValue = Component.ComponentName,
                                        OldValue = ExistingItem.ComponentType,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.ComponentId = item.ComponentId;
                                    ExistingItem.ComponentType = Component.ComponentName;
                                }
                                if (ExistingItem.Description != item.Description)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Description",
                                        NewValue = item.Description ?? "",
                                        OldValue = ExistingItem.Description ?? "",
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Description = item.Description ?? "";
                                }
                                if (ExistingItem.Amount != item.Amount)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Amount",
                                        NewValue = item.Amount.ToString(),
                                        OldValue = ExistingItem.Amount.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Amount = item.Amount;
                                }
                                if(item.IsDeleted == true)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Delete",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (ComponentUpdate)
                                {
                                    ExistingItem.UpdatedBy = _Session.UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectComponentCost.Update(ExistingItem);
                                }
                            }
                        }
                    }
                }
                #endregion
                #endregion
                #region Update Major Item of Works
                var MajorItemOfWorks = await _db.tProjectMajorWorkItem.Where(x => x.ProjectId == Project.ProjectId).ToListAsync();
                if (MajorItemOfWorks.Count > 0)
                {
                    var currentMajorItemIds = new HashSet<int>(MajorItemOfWorks.Select(x => x.Id));
                    #region Update Major Item of Works
                    var UpdateMajorItems = dto.MajorItemOfWorks.Where(x => currentMajorItemIds.Contains(x.Id)).ToList();
                    if (UpdateMajorItems.Count > 0)
                    {
                        var UpdatedWorkItemIds = UpdateMajorItems.Select(x => x.ReferenceId).ToHashSet();
                        var UpdatedWorkLocations = dto.MajorItemLocations.Where(x => UpdatedWorkItemIds.Contains(x.ParentId)).ToHashSet();
                        var LocationsToBeDeleted = new List<int>();
                        foreach (var item in UpdateMajorItems)
                        {
                            var ExistingItem = MajorItemOfWorks.FirstOrDefault(x => x.Id == item.Id);
                            if (ExistingItem != null)
                            {
                                bool hasUpdate = false;
                                if (ExistingItem.ComponentId != item.ComponentId)
                                {
                                    hasUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectMajorItemOfWorks",
                                        AffectedColumn = "ComponentId",
                                        NewValue = item.ComponentId,
                                        OldValue = ExistingItem.ComponentId,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.ComponentId = item.ComponentId;
                                }
                                if (ExistingItem.YearOfWork != item.YearOfWork)
                                {
                                    hasUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectMajorItemOfWorks",
                                        AffectedColumn = "YearOfWork",
                                        NewValue = item.YearOfWork.ToString(),
                                        OldValue = ExistingItem.YearOfWork.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.YearOfWork = item.YearOfWork;
                                }
                                var WorkType = new ProjectScopeOfWorkEnum();
                                if (ExistingItem.WorkTypeId != item.WorkTypeId)
                                {
                                    hasUpdate = true;
                                    var WorkTypeEnum = await _db.tProjectScopeOfWorkEnum.FirstOrDefaultAsync(x => x.Enum == item.WorkTypeId);
                                    if (WorkTypeEnum == null)
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Work Type '{WorkTypeEnum.Description}' is not valid!", Title = "Invalid Work Type" });
                                    }
                                    var oldWorkType = await _db.tProjectScopeOfWorkEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == ExistingItem.WorkTypeId);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectMajorItemOfWorks",
                                        AffectedColumn = "WorkTypeId",
                                        NewValue = WorkTypeEnum.Description,
                                        OldValue = oldWorkType?.Description ?? "",
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.WorkTypeId = item.WorkTypeId;
                                }
                                if (item.IsDeleted == true)
                                {
                                    hasUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Delete",
                                        AffectedTable = "tProjectMajorItemOfWorks",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (hasUpdate)
                                {
                                    ExistingItem.UpdatedBy = _Session.UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectMajorWorkItem.Update(ExistingItem);
                                    var ToBeDeleted = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => UpdatedWorkItemIds.Contains(x.ParentId) && !x.IsDeleted && !LocationsToBeDeleted.Contains(x.Id)).ToListAsync();
                                    ToBeDeleted.Select(x =>
                                    {
                                        x.IsDeleted = true;
                                        return x;
                                    });
                                    LocationsToBeDeleted.AddRange(ToBeDeleted.Select(x => x.Id));
                                    _db.tProjectMajorWorkLocations.UpdateRange(ToBeDeleted);
                                }
                            }
                        }
                        #region Update Locations for Updated Major Items
                        var CurrentLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => UpdatedWorkItemIds.Contains(x.ParentId) && !x.IsDeleted && !LocationsToBeDeleted.Contains(x.Id)).ToListAsync();
                        var CurrentLocationIds = CurrentLocations.Select(x => x.Id).ToHashSet();
                        var UpdateLocations = UpdatedWorkLocations.Where(x => CurrentLocationIds.Contains(x.Id)).ToList();
                        if (UpdateLocations.Count > 0)
                        {
                            foreach (var loc in UpdateLocations)
                            {
                                var ExistingLoc = CurrentLocations.FirstOrDefault(x => x.Id == loc.Id);
                                if (ExistingLoc != null)
                                {
                                    bool hasLocUpdate = false;
                                    if (ExistingLoc.InfraId != loc.InfraId)
                                    {
                                        hasLocUpdate = true;
                                        //itutuloy pa
                                        var Infra = await _db.tInfraType.FirstOrDefaultAsync(x => x.InfraCode == loc.InfraId);
                                        if (Infra == null)
                                        {
                                            return new BadRequestObjectResult(new { Message = $"Selected Infrastructure Type '{loc.InfraId}' is not valid!", Title = "Invalid Infrastructure Type" });
                                        }
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "InfraId",
                                            NewValue = Infra.InfraCode,
                                            OldValue = ExistingLoc.InfraId.ToString(),
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.InfraId = loc.InfraId;
                                    }
                                    if (ExistingLoc.DetailedScope != loc.DetailedScope)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "DetailedScope",
                                            NewValue = loc.DetailedScope ?? "",
                                            OldValue = ExistingLoc.DetailedScope ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.DetailedScope = loc.DetailedScope;
                                    }
                                    if (ExistingLoc.TargetUnit != loc.TargetUnit)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "TargetUnit",
                                            NewValue = loc.TargetUnit ?? "",
                                            OldValue = ExistingLoc.TargetUnit ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.TargetUnit = loc.TargetUnit;
                                    }
                                    if (ExistingLoc.TargetUnitId != loc.TargetUnitId)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "TargetUnitId",
                                            NewValue = loc.TargetUnitId.ToString(),
                                            OldValue = ExistingLoc.TargetUnitId.ToString(),
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.TargetUnitId = loc.TargetUnitId;
                                    }
                                    if (ExistingLoc.StartX != loc.StartX)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "StartX",
                                            NewValue = loc.StartX ?? "",
                                            OldValue = ExistingLoc.StartX ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.StartX = loc.StartX;
                                    }
                                    if (ExistingLoc.StartY != loc.StartY)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "StartY",
                                            NewValue = loc.StartY ?? "",
                                            OldValue = ExistingLoc.StartY ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.StartY = loc.StartY;
                                    }
                                    if (ExistingLoc.EndX != loc.EndX)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "EndX",
                                            NewValue = loc.EndX ?? "",
                                            OldValue = ExistingLoc.EndX ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.EndX = loc.EndX;
                                    }
                                    if (ExistingLoc.EndY != loc.EndY)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "EndY",
                                            NewValue = loc.EndY ?? "",
                                            OldValue = ExistingLoc.EndY ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.EndY = loc.EndY;
                                    }
                                    if (ExistingLoc.PhysicalTarget != loc.PhysicalTarget)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "PhysicalTarget",
                                            NewValue = loc.PhysicalTarget.ToString(),
                                            OldValue = ExistingLoc.PhysicalTarget.ToString(),
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.PhysicalTarget = loc.PhysicalTarget;
                                    }
                                    if (ExistingLoc.StartStationLimit != loc.StartStationLimit)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "StartStationLimit",
                                            NewValue = loc.StartStationLimit ?? "",
                                            OldValue = ExistingLoc.StartStationLimit ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.StartStationLimit = loc.StartStationLimit;
                                    }
                                    if (ExistingLoc.EndStationLimit != loc.EndStationLimit)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "EndStationLimit",
                                            NewValue = loc.EndStationLimit ?? "",
                                            OldValue = ExistingLoc.EndStationLimit ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.EndStationLimit = loc.EndStationLimit;
                                    }
                                    if (ExistingLoc.EndChainage != loc.EndChainage)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "EndChainage",
                                            NewValue = loc.EndChainage.ToString() ?? "",
                                            OldValue = ExistingLoc.EndChainage.ToString() ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.EndChainage = loc.EndChainage;
                                    }
                                    if (ExistingLoc.StartChainage != loc.StartChainage)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "StartChainage",
                                            NewValue = loc.StartChainage.ToString() ?? "",
                                            OldValue = ExistingLoc.StartChainage.ToString() ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.StartChainage = loc.StartChainage;
                                    }
                                    if (loc.IsDeleted == true)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Delete",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "Row",
                                            NewValue = "",
                                            OldValue = JsonConvert.SerializeObject(ExistingLoc),
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.IsDeleted = loc.IsDeleted;
                                    }
                                    if (hasLocUpdate)
                                    {
                                        ExistingLoc.UpdatedBy = _Session.UserId;
                                        ExistingLoc.UpdatedDate = CurrentDate;
                                        _db.tProjectMajorWorkLocations.Update(ExistingLoc);
                                    }
                                }
                                #region New Locations for Updated Major Items
                                var NewLocations = UpdatedWorkLocations.Where(x => x.Id == 0).Select(item => new ProjectMajorWorkLocations
                                {
                                    ParentId = item.ParentId,
                                    InfraId = item.InfraId,
                                    DetailedScope = item.DetailedScope,
                                    TargetUnitId = item.TargetUnitId,
                                    TargetUnit = item.TargetUnit,
                                    StartX = item.StartX,
                                    StartY = item.StartY,
                                    EndX = item.EndX,
                                    EndY = item.EndY,
                                    PhysicalTarget = item.PhysicalTarget,
                                    StartStationLimit = item.StartStationLimit,
                                    EndStationLimit = item.EndStationLimit,
                                    EndChainage = item.EndChainage,
                                    StartChainage = item.StartChainage,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                }).ToList();
                                #endregion
                            }
                        }
                        #endregion
                        #region New Location for Updated Major Items
                        var NewLocationsForUpdatedItems = UpdatedWorkLocations.Where(x => x.Id == 0).ToList();
                        if (NewLocationsForUpdatedItems.Count > 0)
                        {
                            await _db.tProjectMajorWorkLocations.AddRangeAsync(NewLocationsForUpdatedItems.Select(item => new ProjectMajorWorkLocations
                            {
                                ParentId = item.ParentId,
                                InfraId = item.InfraId,
                                DetailedScope = item.DetailedScope,
                                TargetUnitId = item.TargetUnitId,
                                TargetUnit = item.TargetUnit,
                                StartX = item.StartX,
                                StartY = item.StartY,
                                EndX = item.EndX,
                                EndY = item.EndY,
                                PhysicalTarget = item.PhysicalTarget,
                                StartStationLimit = item.StartStationLimit,
                                EndStationLimit = item.EndStationLimit,
                                EndChainage = item.EndChainage,
                                StartChainage = item.StartChainage,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            }));
                        }
                        #endregion 
                    }
                    #endregion
                }
                #region New Major Item of Works
                var newMajorItems = dto.MajorItemOfWorks.Where(x => x.Id == 0).ToList();
                if (newMajorItems.Count > 0)
                {
                    var NewWorkItemIds = newMajorItems.Select(x => x.ReferenceId).ToHashSet();
                    var NewWorkLocations = dto.MajorItemLocations.Where(x => NewWorkItemIds.Contains(x.ParentId)).ToHashSet();
                    var locationLookup = NewWorkLocations
                    .GroupBy(x => x.ParentId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                    foreach (var location in newMajorItems)
                    {
                        string oldId = location.ReferenceId;
                        location.ReferenceId = Project.ProjectId + "-" + location.ComponentId;
                        if (locationLookup.TryGetValue(oldId, out var children))
                        {
                            children.ForEach(x => x.ParentId = location.ReferenceId);
                        }
                    }
                    await _db.tProjectMajorWorkItem.AddRangeAsync(newMajorItems.Select(item => new ProjectMajorWorkItem
                    {
                        StageName = Project.StageName,
                        ProjectId = Project.ProjectId!,
                        ReferenceId = item.ReferenceId,
                        ComponentId = item.ComponentId,
                        YearOfWork = item.YearOfWork,
                        WorkTypeId = item.WorkTypeId,
                        InfraType = item.InfraType,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }));
                    await _db.tProjectMajorWorkLocations.AddRangeAsync(NewWorkLocations.Select(item => new ProjectMajorWorkLocations
                    {
                        ParentId = item.ParentId,
                        InfraId = item.InfraId,
                        DetailedScope = item.DetailedScope,
                        TargetUnitId = item.TargetUnitId,
                        TargetUnit = item.TargetUnit,
                        StartX = item.StartX,
                        StartY = item.StartY,
                        EndX = item.EndX,
                        EndY = item.EndY,
                        PhysicalTarget = item.PhysicalTarget,
                        StartStationLimit = item.StartStationLimit,
                        EndStationLimit = item.EndStationLimit,
                        EndChainage = item.EndChainage,
                        StartChainage = item.StartChainage,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }));
                }
                #endregion
                #endregion
                #region Update Funding Profile
                var CurrentFunding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == dto.ProjectDetails!.ProjectId).ToListAsync();
                if(CurrentFunding.Count > 0)
                {
                    var CurrentIds = dto.FundingProfile.Where(x => x.Id != 0).Select(x => x.Id).ToHashSet();
                    var DeleteFunding = CurrentFunding
                        .Where(x => !CurrentIds.Contains(x.Id))
                        .ToList();
                    if (DeleteFunding.Count > 0)
                    {
                        _db.tProjectFundingProfile.RemoveRange(DeleteFunding);
                    }
                    var UpdateFunding = dto.FundingProfile.Where(x => x.Id != 0).ToList();
                    if (UpdateFunding.Count > 0)
                    {
                        foreach (var item in UpdateFunding)
                        {
                            var ExistingItem = CurrentFunding.FirstOrDefault(x => x.Id == item.Id);
                            if (ExistingItem != null)
                            {
                                bool FundingUpdate = false;
                                if (ExistingItem.Source != item.Source)
                                {
                                    FundingUpdate = true;
                                    var CurrentSource = await _db.tOptionFundingSource.FirstOrDefaultAsync(x => x.Organization == ExistingItem.Source);
                                    var NewSource = await _db.tOptionFundingSource.FirstOrDefaultAsync(x => x.Organization == item.Source);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = dto.ProjectDetails!.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Source",
                                        NewValue = NewSource!.Name,
                                        OldValue = CurrentSource!.Name,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Source = item.Source;
                                }
                                if (ExistingItem.Agreement != item.Agreement)
                                {
                                    FundingUpdate = true;
                                    var CurrentAgreement = await _db.tOptionFundingAgreement.FirstOrDefaultAsync(x => x.Code == ExistingItem.Agreement);
                                    var NewAgreement = await _db.tOptionFundingAgreement.FirstOrDefaultAsync(x => x.Code == item.Agreement);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = dto.ProjectDetails!.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Agreement",
                                        NewValue = NewAgreement!.Name,
                                        OldValue = CurrentAgreement!.Name,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Agreement = item.Agreement;
                                }
                                if (ExistingItem.Amount != item.Amount)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = dto.ProjectDetails!.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Amount",
                                        NewValue = item.Amount.ToString(),
                                        OldValue = ExistingItem.Amount.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Amount = item.Amount;
                                }
                                if (ExistingItem.Percentage != item.Percentage)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = dto.ProjectDetails!.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Percentage",
                                        NewValue = item.Percentage.ToString(),
                                        OldValue = ExistingItem.Percentage.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Percentage = item.Percentage;
                                }
                                if (item.IsDeleted == true)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Delete",
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (FundingUpdate)
                                {
                                    ExistingItem.UpdatedBy = _Session.UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectFundingProfile.Update(ExistingItem);
                                }
                            }
                        }
                    }
                }
                var NewFunding = dto.FundingProfile.Where(x => x.Id == 0).ToList();
                if(NewFunding.Count > 0)
                {
                    var addFunding = dto.FundingProfile.Select(x => new ProjectFundingProfile
                    {
                        StageName = Project.StageName,
                        ProjectId = dto.ProjectDetails!.ProjectId!,
                        Source = x.Source,
                        Agreement = x.Agreement,
                        Amount = x.Amount,
                        Percentage = x.Percentage,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    await _db.tProjectFundingProfile.AddRangeAsync(addFunding);
                }
                #endregion
                await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                await _db.SaveChangesAsync();
                if (HasCostUpdate)
                {
                    var Projects = await _db.vProjectDetails.FromSqlInterpolated($"SELECT * FROM fProjectDetails({Program.ProgramId}) fp WHERE fp.StageName = {Program.StageName}").AsNoTracking().ToListAsync();
                    HashSet<string> ProjectIds = Projects.Select(x => x.ProjectId!).ToHashSet();
                    double ProgramAmount = _db.tProjectComponentCost.AsNoTracking().Where(x => ProjectIds.Contains(x.ProjectId) && x.IsDeleted == false && x.StageName == Program.StageName && !CostToBeDeleted.Contains(x.Id)).Sum(x => x.Amount);
                    //var param = new Dictionary<string, object> { { "@ProgramId", Program.ProgramId },{ "@StageName", Program.StageName } };
                    //double? Totals = Sql.NormalQuery<double?>(
                    //    Appsetting.ConnectionString,
                    //    "EXEC pUpdateProgramCost @ProgramId = @ProgramId, @StageName = @StageName", param
                    //).FirstOrDefault();
                    //double? Totals = 0;
                    //using (var conn = new SqlConnection(Appsetting.ConnectionString))
                    //{
                    //    conn.Open();
                    //    Totals = conn.QueryFirstOrDefault<double?>(
                    //        "pUpdateProgramCost",
                    //        new { ProgramId = "PR20260110462", StageName = "BP" },
                    //        commandType: System.Data.CommandType.StoredProcedure);
                    //}
                    var CurrentVersion = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == Program.Id);
                    if (CurrentVersion == null)
                    {
                        return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                    }
                    CurrentVersion.Cost = ProgramAmount;
                    _db.tProgramRevisions.Update(CurrentVersion);
                    await _db.SaveChangesAsync();
                }
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = $"Project {dto.ProjectDetails!.ProjectId} updated successfully!",
                    Title = "Update Complete"
                });

            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UploadNotes([FromBody] AddNotesDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectId}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                //var Project = await _db.vProjectDetails.FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded!", Title = "File Upload Error" });
                }
                string FilePath = Path.Combine(Appsetting.Resources.ProjectNotes, Project.ProjectId!, dto.File.Name);
                if (!dto.File.UploadFile(FilePath))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted!", Title = "File Corrupted" });
                }
                var AddNotes = new ProjectNotes()
                {
                    ProjectId = dto.ProjectId,
                    FileName = dto.File.Name,
                    FileExtension = dto.File.Extension,
                    FilePath = FilePath,
                    Description = Regex.Replace(dto.Description, @"\s+", " "),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                };
                await _db.tProjectNotes.AddAsync(AddNotes);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Notes added successfully!", Tile = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> DeleteNotes([FromBody] DeleteNotesDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectId} AND fp.StageName = {dto.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var Note = await _db.tProjectNotes.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (Note == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project note not found!", Title = "Project Not Found" });
                }
                if (System.IO.File.Exists(Note.FilePath))
                {
                    System.IO.File.Delete(Note.FilePath);
                }
                await _db.tTransactionLog.AddAsync(new TransactionLog
                {
                    TransactionId = Note.ProjectId!,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tProjectNotes",
                    AffectedColumn = "Row",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(Note),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                });
                _db.tProjectNotes.Remove(Note);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Notes deleted successfully!", Tile = "Delete Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UploadSupportingDocs([FromBody] AddSupportingDocsDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectId} AND fp.StageName = {dto.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                //var Project = await _db.vProjectDetails.FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded!", Title = "File Upload Error" });
                }
                string FilePath = Path.Combine(Appsetting.Resources.SupportingDocs, Project.ProjectId!, dto.File.Name);
                if (!dto.File.ValidateFileSize(50))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file exceeds the maximum allowed size of 50 MB!", Title = "File Size Exceeded" });
                }
                if (dto.File.IsPdfCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted or not valid!", Title = "File Corrupted" });
                }
                var type = dto.DocumentType.Split(":");
                string docType = type[0];
                string DocName = type[1].Replace("/", " or ");
                var AddSupporting = new ProjectSupportingDocs()
                {
                    StageName = dto.StageName,
                    DocumentType = docType,
                    ProjectId = dto.ProjectId,
                    FileName = dto.File.Name,
                    FileExtension = dto.File.Extension,
                    FilePath = FilePath,
                    Description = Regex.Replace(dto.Description, @"\s+", " "),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                };
                await _db.tProjectSupportingDocs.AddAsync(AddSupporting);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Docs added successfully!", Tile = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> DeleteSupportingDocs([FromBody] DeleteSupportingDocsDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var Project = await _db.vProjectDetails
                .FromSqlInterpolated($"SELECT * FROM fProjectDetails({dto.ProjectId}) fp WHERE fp.ProjectId = {dto.ProjectId} AND fp.StageName = {dto.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var Note = await _db.tProjectSupportingDocs.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if(Note == null)
                {
                    return new BadRequestObjectResult(new { Message = "Supporting Doc not found!", Title = "Project Not Found" });
                }
                if (System.IO.File.Exists(Note.FilePath))
                {
                    System.IO.File.Delete(Note.FilePath);
                }
                await _db.tTransactionLog.AddAsync(new TransactionLog
                {
                    TransactionId = Note.ProjectId!,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tProjectSupportingDocs",
                    AffectedColumn = "Row",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(Note),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                });
                _db.tProjectSupportingDocs.Remove(Note);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Document deleted successfully!", Tile = "Delete Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}