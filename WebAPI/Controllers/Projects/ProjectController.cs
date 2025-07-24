using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using System.Data.SqlClient;
using System.Reflection;
using System.Xml;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectController : CoreController
    {
        public ProjectController(AppDbContext db) : base(db) { }
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

                var baseQuery = _db.vProjects.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.ProgramId))
                    baseQuery = baseQuery.Where(e => e.ProgramId!.Contains(dto.Filters.ProgramId));

                if (!string.IsNullOrEmpty(dto.Filters?.ReferenceId))
                    baseQuery = baseQuery.Where(e => e.ReferenceId!.Contains(dto.Filters.ReferenceId));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                 List<DBHelper.Models.Views.Projects> permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages
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
        public async Task<IActionResult> InitAddProject()
        {
            try
            {
                var AvailablePrograms = await _db.vPrograms.Where(x => x.IsPublished != true).ToListAsync();
                var Category = await _db.tProjectCategoryEnum.ToListAsync();
                var Thrust = await _db.tProjectThrustLists.ToListAsync();
                var Origin = await _db.tProjectOriginEnum.ToListAsync();
                var City = await _db.tProjectCityEnum.ToListAsync();
                var LD = await _db.tProjectLegislativeDistrictEnum.ToListAsync();
                var OperatingUnit = await _db.tProjectOperatingUnitEnum.ToListAsync();
                var IO = await _db.tProjectImplementingOfficeEnum.ToListAsync();
                var DEO = await _db.tProjectRODEOEnum.ToListAsync();
                var Feasib = await _db.tProjectLongFeasibilityEnum.ToListAsync();
                var Agency = await _db.tProjectAgencyLists.ToListAsync();
                var ImplementationMode = await _db.tProjectImplementModeEnum.ToListAsync();
                var EmergencyMode = await _db.tProjectEmergencyModeEnum.ToListAsync();
                return Ok(new
                {
                    Programs = AvailablePrograms,
                    Categories = Category,
                    Thrusts = Thrust,
                    Origins = Origin,
                    Cities = City,
                    LDs = LD,
                    OperatingUnits = OperatingUnit,
                    IOs = IO,
                    DEOs = DEO,
                    Feasibility = Feasib,
                    Agencies = Agency,
                    ImplementationModes = ImplementationMode,
                    EmergencyModes = EmergencyMode,
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] AddProjectDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var ProgramDetails = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProgramId);
                if (ProgramDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Selected Program not found!", Title = "Program Not Found" });
                }
                if(ProgramDetails.IsPublished == true)
                {
                    return new BadRequestObjectResult(new { Message = "Selected Program is already published!", Title = "Program Already Published" });
                }
                var SelectedDeo = await _db.tProjectRODEOEnum.FirstOrDefaultAsync(x => x.DeoCode == dto.DEO);
                if( SelectedDeo == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected DEO '{dto.DEO}' is not valid!", Title = "Invalid DEO" });
                }
                var Category = await _db.tProjectCategoryEnum.FirstOrDefaultAsync(x => x.Enum == dto.Category);
                if(Category == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Category '{dto.Category}' is not valid!", Title = "Invalid Category" });
                }
                var Thrust = await _db.tProjectThrustLists.FirstOrDefaultAsync(x => x.PAPKey == dto.Thrust);
                if(Thrust == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.Thrust}' is not valid!", Title = "Invalid Thrust" });
                }
                var Origin = await _db.tProjectOriginEnum.FirstOrDefaultAsync(x => x.Enum == dto.Origin);
                if(Origin == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Origin '{dto.Origin}' is not valid!", Title = "Invalid Origin" });
                }
                var City = await _db.tProjectCityEnum.FirstOrDefaultAsync(x => x.Enum == dto.City);
                if(City == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected City '{dto.City}' is not valid!", Title = "Invalid City" });
                }
                var LD = await _db.tProjectLegislativeDistrictEnum.FirstOrDefaultAsync(x => x.Enum == dto.LegislativeDistrict);
                if(LD == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.LegislativeDistrict}' is not valid!", Title = "Invalid Legislative District" });
                }
                var OperatingUnit = await _db.tProjectOperatingUnitEnum.FirstOrDefaultAsync(x => x.ParticipantId == dto.OperatingUnit);
                if(OperatingUnit == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.OperatingUnit}' is not valid!", Title = "Invalid Operating Unit" });
                }
                var IO = await _db.tProjectImplementingOfficeEnum.FirstOrDefaultAsync(x => x.ParticipantId == dto.ImplementingOffice);
                if(IO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{dto.ImplementingOffice}' is not valid!", Title = "Invalid Implementing Office" });
                }
                var DEO = await _db.tProjectRODEOEnum.FirstOrDefaultAsync(x => x.DeoCode == dto.DEO);
                if(DEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected DEO '{dto.DEO}' is not valid!", Title = "Invalid DEO" });
                }
                var Feasib = await _db.tProjectLongFeasibilityEnum.FirstOrDefaultAsync(x => x.Enum == dto.Feasibility);
                if(Feasib == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.Feasibility}' is not valid!", Title = "Invalid Feasibility" });
                }
                var Agency = await _db.tProjectAgencyLists.FirstOrDefaultAsync(x => x.Id == dto.Agency);
                if(Agency == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.Agency}' is not valid!", Title = "Invalid Agency" });
                }
                var ImplementationMode = await _db.tProjectImplementModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.ImplementationMode);
                if(ImplementationMode == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ImplementationMode}' is not valid!", Title = "Invalid Implementation Mode" });
                }
                var EmergencyMode = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.EmergencyMode);
                if(EmergencyMode == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.EmergencyMode}' is not valid!", Title = "Invalid Emergency Mode" });
                }
                string UID = Sql.NormalQuery<string>(Appsetting.ConnectionString,
                        "EXEC pGenerateUID")
                    .FirstOrDefault() ?? string.Empty;
                string ReferenceId = $"{ProgramDetails.StageName}{Functions.GenerateProjec2ndSegment(ProgramDetails.YearEnd)}{UID}";
                DateTime CurrentDate = DateTime.UtcNow;
                var SubmitProject = new DBHelper.Models.Table.Projects()
                {
                    ProgramId = ProgramDetails.ReferenceId,
                    ReferenceId = ReferenceId,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(SubmitProject);
                var ProjectRevision = new ProjectRevisions()
                {
                    ReferenceId = ReferenceId,
                    RevisionNumber = 1,
                    Description = dto.Description!,
                    Category = dto.Category,
                    Thrust = dto.Thrust,
                    Origin = dto.Origin,
                    City = dto.City,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    OperatingUnit = dto.OperatingUnit!,
                    ImplementingOffice = dto.ImplementingOffice!,
                    DEO = SelectedDeo.DeoCode,
                    Region = dto.Region!,
                    Agency = dto.Agency,
                    ProjectCode = dto.ProjectCode,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = CurrentDate
                };
                await _db.tProjectRevisions.AddAsync(ProjectRevision);
                await _db.SaveChangesAsync();
                var ProjectStage = new ProjectStages()
                {
                    RevisionId = ProjectRevision.Id,
                    StageId = ProgramDetails.StageId,
                    StageName = ProgramDetails.StageName,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = CurrentDate,
                    IsPublished = false
                };
                await _db.tProjectStages.AddAsync(ProjectStage);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    ProjectId = ReferenceId,
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
        #region Project Details
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ProjectDetails([FromBody] ProjectDetailsDTO dto)
        {
            try
            {
                var Project = await _db.vProjectDetails.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProjectId);
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var Program = await _db.vPrograms.FirstOrDefaultAsync(x => x.ProgramId == Project.ProgramId);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                var ComponentType = await _db.tProjectComponentEnum.ToListAsync();
                var ComponentCost = await _db.tProjectComponentCost.Where(x => x.ProjectId == Project.ReferenceId).ToListAsync();
                var ComponentCostYear = await _db.tProjectComponentCostYear.Where(x => ComponentCost.Select(a => a.Id).Contains(x.ParentId)).ToListAsync();
                var MajorItemOfWork = await _db.tProjectMajorItemOfWorks.Where(x => x.ProjectId == Project.ReferenceId).ToListAsync();
                var Notes = await _db.tProjectNotes.Where(x => x.ProjectId == Project.ReferenceId).ToListAsync();
                var Funding = await _db.tProjectFundingProfile.Where(x => x.ProjectId == Project.ReferenceId).ToListAsync();


                var Category = await _db.tProjectCategoryEnum.ToListAsync();
                var Thrust = await _db.tProjectThrustLists.ToListAsync();
                var Origin = await _db.tProjectOriginEnum.ToListAsync();
                var City = await _db.tProjectCityEnum.ToListAsync();
                var LD = await _db.tProjectLegislativeDistrictEnum.ToListAsync();
                var OperatingUnit = await _db.tProjectOperatingUnitEnum.ToListAsync();
                var IO = await _db.tProjectImplementingOfficeEnum.ToListAsync();
                var DEO = await _db.tProjectRODEOEnum.ToListAsync();
                var Feasib = await _db.tProjectLongFeasibilityEnum.ToListAsync();
                var Agency = await _db.tProjectAgencyLists.ToListAsync();
                var ImplementationMode = await _db.tProjectImplementModeEnum.ToListAsync();
                var EmergencyMode = await _db.tProjectEmergencyModeEnum.ToListAsync();

                var Agreement = await _db.tProjectFundingAgreementLists.ToListAsync();
                var Source = await _db.tProjectFundingSource.ToListAsync();

                var ScopeOfWork = await _db.tProjectScopeOfWorkEnum.ToListAsync();
                var Transactions = await _db.tTransactionLog.Where(x => x.TransactionId == dto.ProjectId).ToListAsync();
                return Ok(new
                {
                    ProgramDetails = Program,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    ProjectNotes = Notes,
                    FundingProfile = Funding,
                    TransactionLogs = Transactions,
                    Dropdowns = new
                    {
                        //Project Details
                        Categories = Category,
                        Thrusts = Thrust,
                        Origins = Origin,
                        Cities = City,
                        LDs = LD,
                        OperatingUnits = OperatingUnit,
                        IOs = IO,
                        DEOs = DEO,
                        Feasibility = Feasib,
                        Agencies = Agency,
                        ImplementationModes = ImplementationMode,
                        EmergencyModes = EmergencyMode,

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
        public async Task<IActionResult> UpdateProjectDetails([FromBody] UpdateProjectDetailsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = DateTime.UtcNow;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                var Project = await _db.vProjectDetails.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProjectDetails.ReferenceId);
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                var Program = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.ReferenceId == Project.ProgramId);
                if (Program == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program not found for this project!", Title = "Program Not Found" });
                }
                #region Update Project Details
                if (Project.Description != dto.ProjectDetails?.Description)
                {
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.ProjectDetails!.Description!,
                        OldValue = Project.Description ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Description = dto.ProjectDetails!.Description;
                }
                if (Project.Category != dto.ProjectDetails?.Category) 
                {
                    var Category = await _db.tProjectCategoryEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.Category);
                    if(Category == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Category '{dto.ProjectDetails!.Category}' is not valid!", Title = "Invalid Category" });
                    }
                    var OldCategory = await _db.tProjectCategoryEnum.FirstOrDefaultAsync(x => x.Enum == Project.Category);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Category",
                        NewValue = Category.Name,
                        OldValue = OldCategory?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Category = dto.ProjectDetails!.Category;
                }
                if (Project.Thrust != dto.ProjectDetails?.Thrust)
                {
                    var Thrust = await _db.tProjectThrustLists.FirstOrDefaultAsync(x => x.PAPKey == dto.ProjectDetails!.Thrust);
                    if (Thrust == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.ProjectDetails!.Thrust}' is not valid!", Title = "Invalid Thrust" });
                    }
                    var OldThrust = await _db.tProjectThrustLists.FirstOrDefaultAsync(x => x.PAPKey == Project.Thrust);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = Thrust.SubProgramName,
                        OldValue = OldThrust?.SubProgramName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Thrust = dto.ProjectDetails!.Thrust;
                }
                if (Project.Origin != dto.ProjectDetails?.Origin)
                {
                    var Origin = await _db.tProjectOriginEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.Origin);
                    if (Origin == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Origin '{dto.ProjectDetails!.Origin}' is not valid!", Title = "Invalid Origin" });
                    }
                    var OldOrigin = await _db.tProjectOriginEnum.FirstOrDefaultAsync(x => x.Enum == Project.Origin);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = Origin.Name,
                        OldValue = OldOrigin?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Origin = dto.ProjectDetails!.Origin;
                }
                if (Project.City != dto.ProjectDetails?.City)
                {
                    var City = await _db.tProjectCityEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.City);
                    if (City == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected City '{dto.ProjectDetails!.City}' is not valid!", Title = "Invalid City" });
                    }
                    var OldCity = await _db.tProjectCityEnum.FirstOrDefaultAsync(x => x.Enum == Project.City);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "City",
                        NewValue = City.Name,
                        OldValue = OldCity?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.City = dto.ProjectDetails!.City;
                }
                if (Project.LegislativeDistrict != dto.ProjectDetails?.LegislativeDistrict)
                {
                    var LD = await _db.tProjectLegislativeDistrictEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.LegislativeDistrict);
                    if (LD == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.ProjectDetails!.LegislativeDistrict}' is not valid!", Title = "Invalid Legislative District" });
                    }
                    var OldLD = await _db.tProjectLegislativeDistrictEnum.FirstOrDefaultAsync(x => x.Enum == Project.LegislativeDistrict);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "LegislativeDistrict",
                        NewValue = LD.Name,
                        OldValue = OldLD?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.LegislativeDistrict = dto.ProjectDetails!.LegislativeDistrict;
                }
                if (Project.OperatingUnit != dto.ProjectDetails?.OperatingUnit)
                {
                    var OperatingUnit = await _db.tProjectOperatingUnitEnum.FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.OperatingUnit);
                    if (OperatingUnit == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.ProjectDetails!.OperatingUnit}' is not valid!", Title = "Invalid Operating Unit" });
                    }
                    var OldOperatingUnit = await _db.tProjectOperatingUnitEnum.FirstOrDefaultAsync(x => x.ParticipantId == Project.OperatingUnit);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "OperatingUnit",
                        NewValue = OperatingUnit.OrgName,
                        OldValue = OldOperatingUnit?.OrgName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.OperatingUnit = dto.ProjectDetails!.OperatingUnit;
                }
                if (Project.ImplementingOffice != dto.ProjectDetails?.ImplementingOffice)
                {
                    var IO = await _db.tProjectImplementingOfficeEnum.FirstOrDefaultAsync(x => x.ParticipantId == dto.ProjectDetails!.ImplementingOffice);
                    if (IO == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{dto.ProjectDetails!.ImplementingOffice}' is not valid!", Title = "Invalid Implementing Office" });
                    }
                    var OldIO = await _db.tProjectImplementingOfficeEnum.FirstOrDefaultAsync(x => x.ParticipantId == Project.ImplementingOffice);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementingOffice",
                        NewValue = IO.OrgName,
                        OldValue = OldIO?.OrgName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementingOffice = dto.ProjectDetails!.ImplementingOffice;
                }
                if (Project.DEO != dto.ProjectDetails?.DEO)
                {
                    var SelectedDeo = await _db.tProjectRODEOEnum.FirstOrDefaultAsync(x => x.DeoCode == dto.ProjectDetails!.DEO);
                    if (SelectedDeo == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected DEO '{dto.ProjectDetails!.DEO}' is not valid!", Title = "Invalid DEO" });
                    }
                    var OldDeo = await _db.tProjectRODEOEnum.FirstOrDefaultAsync(x => x.DeoCode == Project.DEO);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DEO",
                        NewValue = SelectedDeo.DeoName,
                        OldValue = OldDeo?.DeoName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DEO = SelectedDeo.DeoCode;
                }
                if (Project.Region != dto.ProjectDetails?.Region)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Region",
                        NewValue = dto.ProjectDetails!.Region ?? "",
                        OldValue = Project.Region ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Region = dto.ProjectDetails!.Region;
                }
                if (Project.Agency != dto.ProjectDetails?.Agency)
                {
                    var Agency = await _db.tProjectAgencyLists.FirstOrDefaultAsync(x => x.Id == dto.ProjectDetails!.Agency);
                    if (Agency == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.ProjectDetails!.Agency}' is not valid!", Title = "Invalid Agency" });
                    }
                    var OldAgency = await _db.tProjectAgencyLists.FirstOrDefaultAsync(x => x.Id == Project.Agency);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Agency",
                        NewValue = Agency.AgencyName,
                        OldValue = OldAgency?.AgencyName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Agency = dto.ProjectDetails!.Agency;
                }
                if (Project.ProjectCode != dto.ProjectDetails?.ProjectCode)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ProjectCode",
                        NewValue = dto.ProjectDetails!.ProjectCode ?? "",
                        OldValue = Project.ProjectCode ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ProjectCode = dto.ProjectDetails!.ProjectCode;
                }
                if (Project.ImplementationMode != dto.ProjectDetails?.ImplementationMode)
                {
                    var ImplementationMode = await _db.tProjectImplementModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.ImplementationMode);
                    if (ImplementationMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ProjectDetails!.ImplementationMode}' is not valid!", Title = "Invalid Implementation Mode" });
                    }
                    var OldImplementationMode = await _db.tProjectImplementModeEnum.FirstOrDefaultAsync(x => x.Enum == Project.ImplementationMode);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementationMode",
                        NewValue = ImplementationMode.Name,
                        OldValue = OldImplementationMode?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementationMode = dto.ProjectDetails!.ImplementationMode;
                }
                if (Project.EmergencyMode != dto.ProjectDetails?.EmergencyMode)
                {
                    var EmergencyMode = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.EmergencyMode);
                    if (EmergencyMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Emergency Mode" });
                    }
                    var OldEmergencyMode = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == Project.EmergencyMode);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "EmergencyMode",
                        NewValue = EmergencyMode.Name,
                        OldValue = OldEmergencyMode?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.EmergencyMode = dto.ProjectDetails!.EmergencyMode;
                }
                if (Project.Feasibility != dto.ProjectDetails?.Feasibility)
                {
                    var Feasib = await _db.tProjectLongFeasibilityEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.Feasibility);
                    if (Feasib == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.ProjectDetails!.Feasibility}' is not valid!", Title = "Invalid Feasibility" });
                    }
                    var OldFeasibility = await _db.tProjectLongFeasibilityEnum.FirstOrDefaultAsync(x => x.Enum == Project.Feasibility);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Feasibility",
                        NewValue = Feasib.Name,
                        OldValue = OldFeasibility?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Feasibility = dto.ProjectDetails!.Feasibility;
                }
                if(Project.DetailedDesign != dto.ProjectDetails?.DetailedDesign)
                {
                    var DetailedDesign = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.DetailedDesign);
                    if (DetailedDesign == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{dto.ProjectDetails!.DetailedDesign}' is not valid!", Title = "Invalid Detailed Design" });
                    }
                    var OldDetailedDesign = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == Project.DetailedDesign);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesign",
                        NewValue = DetailedDesign.Name ?? "",
                        OldValue = OldDetailedDesign?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesign = dto.ProjectDetails!.DetailedDesign;
                }
                if (Project.RowAvailable != dto.ProjectDetails?.RowAvailable)
                {
                    var RowAvailable = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == dto.ProjectDetails!.EmergencyMode);
                    if (RowAvailable == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Row Available '{dto.ProjectDetails!.EmergencyMode}' is not valid!", Title = "Invalid Row Available" });
                    }
                    var OldRowAvailable = await _db.tProjectEmergencyModeEnum.FirstOrDefaultAsync(x => x.Enum == Project.RowAvailable);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ReferenceId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RowAvailable",
                        NewValue = RowAvailable.Name,
                        OldValue = OldRowAvailable?.Name ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RowAvailable = dto.ProjectDetails!.RowAvailable;
                }
                if (hasUpdated)
                {
                    var NewRevision = new ProjectRevisions()
                    {
                        ReferenceId = Project.ReferenceId!,
                        RevisionNumber = (int)Project.RevisionNumber! + 1,
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
                        Agency = Project.Agency,
                        ProjectCode = Project.ProjectCode,
                        ImplementationMode = Project.ImplementationMode,
                        EmergencyMode = Project.EmergencyMode,
                        Feasibility = Project.Feasibility,
                        DetailedDesign = Project.DetailedDesign,
                        RowAvailable = Project.RowAvailable,
                        CreatedBy = _Session.UserId ?? "TESTING",
                        CreatedDate = CurrentDate
                    };
                    await _db.tProjectRevisions.AddAsync(NewRevision);
                }
                #endregion
                #region Update Component Cost
                var ComponentCost = await _db.tProjectComponentCost.Where(x => x.ProjectId == Project.ReferenceId).ToListAsync();
                if (ComponentCost.Count > 0)
                {
                    var CurrentComponentCost = ComponentCost.Select(x => x.Id).ToList();
                    var NewComponentCostData = dto.ComponentCosts.Where(x => !CurrentComponentCost.Contains(x.Id)).ToList();
                    var NewComponentCost = NewComponentCostData.Select(x => x.Id).ToList();
                    var DeletedComponentCost = CurrentComponentCost.Except(NewComponentCost).ToList();
                    #region Delete Component Cost and Year
                    if (DeletedComponentCost.Count > 0)
                    {
                        var DeletedItems = await _db.tProjectComponentCost.Where(x => DeletedComponentCost.Contains(x.Id)).ToListAsync();
                        var DeleteCostPerYear = await _db.tProjectComponentCostYear.Where(x => DeletedComponentCost.Contains(x.ParentId)).ToListAsync();
                        _db.tProjectComponentCost.RemoveRange(DeletedItems);
                        _db.tProjectComponentCostYear.RemoveRange(DeleteCostPerYear);
                        transactionLogs.AddRange(DeletedItems.Select(item => new TransactionLog
                        {
                            TransactionId = Project.ReferenceId!,
                            TypeOfTransaction = "Delete",
                            AffectedTable = "tProjectComponentCost",
                            AffectedColumn = "Row",
                            NewValue = "",
                            OldValue = JsonConvert.SerializeObject(item),
                            CreatedBy = _Session.UserId ?? "TESTING",
                            CreatedDate = CurrentDate
                        }));
                        transactionLogs.AddRange(DeleteCostPerYear.Select(item => new TransactionLog
                        {
                            TransactionId = Project.ReferenceId!,
                            TypeOfTransaction = "Delete",
                            AffectedTable = "tProjectComponentCostYear",
                            AffectedColumn = "Row",
                            NewValue = "",
                            OldValue = JsonConvert.SerializeObject(item),
                            CreatedBy = _Session.UserId ?? "TESTING",
                            CreatedDate = CurrentDate
                        }));
                    }
                    #endregion
                    #region New Component Cost and Year
                    if (NewComponentCost.Count > 0)
                    {
                        await _db.tProjectComponentCost.AddRangeAsync(NewComponentCostData.Select(item => new ProjectComponentCost
                        {
                            ProjectId = Project.ReferenceId!,
                            ComponentId = item.ComponentId,
                            ComponentType = item.ComponentType,
                            Description = item.Description,
                            Total = item.Total,
                            CreatedBy = _Session.UserId ?? "TESTING",
                            CreatedDate = CurrentDate
                        }).ToList());
                        var CostPerId = dto.ComponentCostYear.Where(x => NewComponentCost.Contains(x.ParentId));
                        await _db.tProjectComponentCostYear.AddRangeAsync(CostPerId.Select(item => new ProjectComponentCostYear
                        {
                            ParentId = item.ParentId,
                            CostYear = item.CostYear,
                            Cost = item.Cost,
                            ApprovalDate = item.ApprovalDate,
                            PAPCode = item.PAPCode,
                            StartDate = item.StartDate,
                            EndDate = item.EndDate
                        }).ToList());
                    }
                    #endregion
                    #region Update Component Cost and Year
                    var UpdateComponentCost = dto.ComponentCosts.Where(x => CurrentComponentCost.Contains(x.Id)).ToList();
                    if (UpdateComponentCost.Count > 0)
                    {
                        foreach (var item in UpdateComponentCost)
                        {
                            var ExistingItem = ComponentCost.FirstOrDefault(x => x.Id == item.Id);
                            bool ComponentUpdate = false;
                            if (ExistingItem != null)
                            {
                                if (ExistingItem.ComponentType != item.ComponentType)
                                {
                                    ComponentUpdate = true;
                                    var Component = await _db.tProjectComponentEnum.FirstOrDefaultAsync(x => x.Description == item.ComponentType);
                                    if (Component == null)
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Component '{item.ComponentType}' is not valid!", Title = "Invalid Component" });
                                    }
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ReferenceId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "ComponentType",
                                        NewValue = Component.Name,
                                        OldValue = ExistingItem.ComponentType,
                                        CreatedBy = _Session.UserId ?? "TESTING",
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.ComponentId = item.ComponentId;
                                    ExistingItem.ComponentType = Component.Description;
                                }
                                if (ExistingItem.Description != item.Description)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ReferenceId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Description",
                                        NewValue = item.Description ?? "",
                                        OldValue = ExistingItem.Description ?? "",
                                        CreatedBy = _Session.UserId ?? "TESTING",
                                    });
                                    ExistingItem.Description = item.Description ?? "";
                                }
                                if (ExistingItem.Total != item.Total)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ReferenceId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Total",
                                        NewValue = item.Total.ToString(),
                                        OldValue = ExistingItem.Total.ToString(),
                                        CreatedBy = _Session.UserId ?? "TESTING",
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Total = item.Total;
                                }
                                var ComponentCostYear = await _db.tProjectComponentCostYear.Where(x => x.ParentId == item.Id).ToListAsync();

                                HashSet<int> currentCostIds = new HashSet<int>(ComponentCostYear.Select(x => x.Id));
                                HashSet<int> incomingCostIds = new HashSet<int>(dto.ComponentCostYear.Select(x => x.Id));

                                var NewComponentCostYear = dto.ComponentCostYear.Where(x => !currentCostIds.Contains(x.Id)).ToList();

                                var deletedComponentCostYearIds = currentCostIds.Except(incomingCostIds).ToList();
                                var UpdateCostYearIds = currentCostIds.Intersect(incomingCostIds).ToHashSet();

                                var UpdateCostYear = ComponentCostYear
                                    .Where(x => UpdateCostYearIds.Contains(x.Id))
                                    .ToList();
                                bool hasYearUpdate = false;
                                foreach (var yearItem in UpdateCostYear)
                                {
                                    var SelectedYear = dto.ComponentCostYear.FirstOrDefault(x => x.Id == yearItem.Id);
                                    if (SelectedYear == null) { break; }
                                    if (yearItem.Cost != SelectedYear.Cost)
                                    {
                                        hasYearUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ReferenceId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectComponentCostYear",
                                            AffectedColumn = "Cost",
                                            NewValue = SelectedYear.Cost.ToString(),
                                            OldValue = yearItem.Cost.ToString(),
                                            CreatedBy = _Session.UserId ?? "TESTING",
                                            CreatedDate = CurrentDate
                                        });
                                        yearItem.Cost = SelectedYear.Cost;
                                    }
                                    if (yearItem.ApprovalDate != SelectedYear.ApprovalDate)
                                    {
                                        hasYearUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ReferenceId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectComponentCostYear",
                                            AffectedColumn = "ApprovalDate",
                                            NewValue = SelectedYear.ApprovalDate?.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            OldValue = yearItem.ApprovalDate?.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            CreatedBy = _Session.UserId ?? "TESTING",
                                            CreatedDate = CurrentDate
                                        });
                                        yearItem.ApprovalDate = SelectedYear.ApprovalDate;
                                    }
                                    if (yearItem.PAPCode != SelectedYear.PAPCode)
                                    {
                                        hasYearUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ReferenceId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectComponentCostYear",
                                            AffectedColumn = "PAPCode",
                                            NewValue = SelectedYear.PAPCode ?? "",
                                            OldValue = yearItem.PAPCode ?? "",
                                            CreatedBy = _Session.UserId ?? "TESTING",
                                            CreatedDate = CurrentDate
                                        });
                                        yearItem.PAPCode = SelectedYear.PAPCode ?? "";
                                    }
                                    if (yearItem.StartDate != SelectedYear.StartDate)
                                    {
                                        hasYearUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ReferenceId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectComponentCostYear",
                                            AffectedColumn = "StartDate",
                                            NewValue = SelectedYear.StartDate.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            OldValue = yearItem.StartDate.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            CreatedBy = _Session.UserId ?? "TESTING",
                                            CreatedDate = CurrentDate
                                        });
                                        yearItem.StartDate = SelectedYear.StartDate;
                                    }
                                    if (yearItem.EndDate != SelectedYear.EndDate)
                                    {
                                        hasYearUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ReferenceId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectComponentCostYear",
                                            AffectedColumn = "EndDate",
                                            NewValue = SelectedYear.EndDate.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            OldValue = yearItem.EndDate.ToString("MM/dd/yyyy mm:ss t") ?? "",
                                            CreatedBy = _Session.UserId ?? "TESTING",
                                            CreatedDate = CurrentDate
                                        });
                                        yearItem.EndDate = SelectedYear.EndDate;
                                    }
                                }
                                if (hasYearUpdate)
                                {
                                    _db.tProjectComponentCostYear.UpdateRange(UpdateCostYear);
                                }
                                if (ComponentUpdate)
                                {
                                    ExistingItem.UpdatedBy = _Session.UserId ?? "TESTING";
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectComponentCost.Update(ExistingItem);
                                }
                            }
                        }
                    }
                    #endregion
                }
                #endregion
                await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Project Update wala pa lods",
                    Title = "Under Maintenance"
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
                var Project = await _db.vProjectDetails.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProjectId);
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Project Not Found" });
                }
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded!", Title = "File Upload Error" });
                }
                if (dto.File.IsFileCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted!", Title = "File Corrupted" });
                }
                string FileName = dto.File.Name;
                string Extension = Path.GetExtension(FileName);
                string PathDir = Path.Combine(Appsetting.Resources.ProjectNotes, Project.ReferenceId!);
                if (!Directory.Exists(PathDir))
                {
                    Directory.CreateDirectory(PathDir);
                }
                string FilePath = $"{PathDir}/{FileName}";

                string base64Data = dto.File.DataUrl.Contains(",")
                    ? dto.File.DataUrl.Split(',')[1]
                    : dto.File.DataUrl;
                byte[] fileBytes = Convert.FromBase64String(base64Data);
                if (fileBytes.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is empty!", Title = "File Empty" });
                }
                await System.IO.File.WriteAllBytesAsync(Path.Combine(Appsetting.RootPath, FilePath), fileBytes);
                var AddNotes = new ProjectNotes()
                {
                    ProjectId = dto.ProjectId,
                    FileName = FileName,
                    FileExtension = Extension,
                    FilePath = FilePath,
                    Description = dto.Description,
                    CreatedBy = _Session.UserId ?? "TESTING",
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
                var Note = await _db.tProjectNotes.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if(Note == null)
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
                    CreatedBy = _Session.UserId ?? "TESTING",
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
        #endregion
    }
}