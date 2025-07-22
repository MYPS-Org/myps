using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        #region Program Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterProgram()
        {
            try
            {
                var AvailableStages = await _db.tProgramStageEnum.ToListAsync();
                var AvailableTypes = await _db.tProgramTypeEnum.ToListAsync();
                var AvailableStatuses = await _db.tProgramStatusEnum.ToListAsync();
                var AvailableGroups = await _db.tGroups.ToListAsync();
                var response = new
                {
                    Stages = AvailableStages,
                    Types = AvailableTypes,
                    Statuses = AvailableStatuses,
                    Groups = AvailableGroups
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
                    bool isValid = typeof(ProjectDetails)
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

                var baseQuery = _db.vProjectDetails.AsNoTracking();

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
                 List<ProjectDetails> permissionLists = await sortedQuery
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
                var SubmitProject = new Projects()
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
                    Description = dto.Description,
                    Category = dto.Category,
                    Thrust = dto.Thrust,
                    Origin = dto.Origin,
                    City = dto.City,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    OperatingUnit = dto.OperatingUnit,
                    ImplementingOffice = dto.ImplementingOffice,
                    DEO = SelectedDeo.DeoCode,
                    Region = dto.Region,
                    Agency = dto.Agency,
                    ProjectCode = dto.ProjectCode,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = CurrentDate
                };
                await _db.tProjectRevisions.AddAsync(ProjectRevision);
                await _db.SaveChangesAsync();
                var GetProjectRevision = await _db.tProjectRevisions.Where(x => x.ReferenceId == ReferenceId).FirstOrDefaultAsync();
                if(GetProjectRevision == null)
                {
                    return new BadRequestObjectResult(new { Message = "Failed to create project revision!", Title = "Project Revision Error" });
                }
                var ProjectStage = new ProjectStages()
                {
                    RevisionId = GetProjectRevision.Id,
                    StageId = ProgramDetails.StageId,
                    StageName = ProgramDetails.StageName,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = CurrentDate,
                    IsPublished = false
                };
                await _db.tProjectStages.AddAsync(ProjectStage);

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
                var Program = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.ReferenceId == Project.ProgramId);
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
                return Ok(new
                {
                    ProgramDetails = Program,
                    ProjectDetails = Project,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    ProjectNotes = Notes,
                    FundingProfile = Funding,
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
        public async Task<IActionResult> UpdateProjectDetails([FromBody] ProjectDetailsDTO dto)
        {
            try
            {
                return Ok(new
                {
                    Message = "Project Update wala pa lods",
                    Title = "Under Maintenance"
                });
            }
            catch (Exception ex)
            {
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
                if(dto.File.IsFileCorreupted())
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted!", Title = "File Corrupted" });
                }
                string FileName = dto.File.FileName;
                string Extension = Path.GetExtension(FileName);
                string PathDir = $"{Appsetting.RootPath}/Resources/Projects/Notes/{Project.ReferenceId}";
                if (!Directory.Exists(PathDir))
                {
                    Directory.CreateDirectory(PathDir);
                }
                string FilePath = $"{PathDir}/{FileName}"; 
                using (var stream = new FileStream(FilePath, FileMode.Create))
                {
                    await dto.File.CopyToAsync(stream);
                }
                var AddNotes = new ProjectNotes()
                {
                    ProjectId = dto.ProjectId,
                    FileName = FileName,
                    FileExtension = Extension,
                    FilePath = "",//File.SaveFileToProjectNotes(Project.ReferenceId),
                    Description = dto.Description,
                    CreatedBy = _Session.UserId ?? "TESTING",
                    CreatedDate = DateTime.UtcNow
                };
                await _db.tProjectNotes.AddAsync(AddNotes);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                });
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