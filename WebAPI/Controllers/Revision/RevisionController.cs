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
using System.Reflection;
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
        public async Task<IActionResult> RevisionRequests([FromBody] ShowMyRevisionDTO dto)
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

                var baseQuery = _db.tRevisionDetails.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.TransactionId))
                    baseQuery = baseQuery.Where(e => e.TransactionId!.Contains(dto.Filters.TransactionId));

                if (dto.Filters?.ModificationCategory != null)
                    baseQuery = baseQuery.Where(e => e.ModificationCategory == dto.Filters.ModificationCategory);

                if (dto.Filters?.ModificationReason != null)
                    baseQuery = baseQuery.Where(e => e.ModificationReason == dto.Filters.ModificationReason);

                if (dto.Filters?.RegionApproveStatus != null)
                    baseQuery = baseQuery.Where(e => e.RegionApproveStatus == dto.Filters.RegionApproveStatus);

                if (dto.Filters?.COApproveStatus != null)
                    baseQuery = baseQuery.Where(e => e.COApproveStatus == dto.Filters.COApproveStatus);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Table.RevisionDetails> permissionLists = await sortedQuery
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

                #region Validate PCMA Status
                var SelectedRules = await _db.vRevisionRules.FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason && x.RevisionGroupId == dto.RevisionHeader);
                var ProjectComponentsStatus = await _db.vProjectComponentStatus.AsNoTracking().Where(x => x.ProjectId == dto.ProjectId).ToListAsync();
                if(ProjectComponentsStatus == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in PCMA", Title = "Project Not Found" });
                }
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
                SelectedReason = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == dto.RevisionReason);
                if (SelectedReason == null)
                {
                    return new BadRequestObjectResult(new { Message = "Revision Reason not found!", Title = "Invalid Revision Reason" });
                }
                #endregion

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
                int CurrentYear = (int)DateTime.UtcNow.Year;
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var SupportingDoc = await _db.tDropdownSupportingDocs.AsNoTracking().Where(x => x.ValidUntil >= CurrentYear || x.ValidUntil == 0).OrderBy(x => x.Name).ToListAsync();

                var ComponentType = await _db.tProjectComponentEnum.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var ComponentCostYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentCost.Select(a => a.ReferenceId).Contains(x.ParentId)).ToListAsync();

                var MajorItemOfWork = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                HashSet<string> ItemParents = MajorItemOfWork.Select(x => x.ReferenceId).ToHashSet();
                var MajorWorkLocation = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => ItemParents.Contains(x.ParentId)).ToListAsync();


                var Notes = await _db.tProjectNotes.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();
                var Funding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Project.StageName).ToListAsync();

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
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.TransactionId == dto.ProjectId).ToListAsync();


                return Ok(new
                {
                    Header = SelectedType,
                    Category = SelectedCategory,
                    Reason = SelectedReason,

                    //ProjectStatus = new
                    //{
                    //    Construction = (ProjectComponentsStatus.Where(x => x.ConstructionStatusName == "Not Yet Started"))
                    //},

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
        public async Task<IActionResult> RevisionDetails()
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