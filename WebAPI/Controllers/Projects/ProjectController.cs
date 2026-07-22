using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views;
using DBHelper.Models.Views.Program;
using DBHelper.Models.Views.Project;
using Helpers;
using JetBrains.Annotations;
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
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Timers;
using System.Xml;
using WebAPI.Controllers.Programs;
using static Helpers.ProjectHelper;
namespace WebAPI.Controllers.Projects
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectController : CoreController
    {
        public ProjectController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma) : base(db, producer, pcma) { }

        #region Others
        [HttpPost]
        public async Task<IActionResult> ShowProjectDropdowns([FromBody] ProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var userId = _Session.UserId;   // must match tUsers.UserId — confirm this exists on _Session
                // Region + DEO: no "if (_Session.ApplyFilter)" wrapper needed here — unlike ShowProgramStages/
                // ShowProjectStages (a single yes/no visibility check), this is a LIST endpoint. The functions
                // already self-scope via the live vUsers.ApplyFilter internally (bypass returns everything),
                // so calling them unconditionally avoids any drift between _Session's cached flag and the DB.
                var regions = await _db.fUserVisibleRegions
                    .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleRegions({userId})")
                    .AsNoTracking().ToListAsync(cancellationToken);
                HashSet<string> RegionParticipantIds = regions.Select(x => x.ParticipantId).ToHashSet();

                var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking().Where(x => RegionParticipantIds.Contains(x.RegionParticipantId) && !x.Deprecated).ToListAsync(cancellationToken);
                HashSet<int> ProvinceIds = provinces.Select(x => x.Id).ToHashSet();

                var cities = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().Where(x => ProvinceIds.Contains(x.ProvinceId) && !x.Deprecated).ToListAsync(cancellationToken);

                var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().Where(x => ProvinceIds.Contains(x.ProvinceId) && !x.Deprecated).ToListAsync(cancellationToken);

                var deos = await _db.vAdminDEO.AsNoTracking().Where(x => RegionParticipantIds.Contains(x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).ToListAsync(cancellationToken);

                var implementingOffices = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => RegionParticipantIds.Contains(x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).ToListAsync(cancellationToken);
                var operatingUnits = await _db.vAdminOperatingUnit.AsNoTracking().Where(x => RegionParticipantIds.Contains(x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).ToListAsync(cancellationToken);


                int CurrentYear = (int)Functions.CurrentDate().Year;
                var categories = await _db.tOptionProjectCategory.AsNoTracking()
                    .Where(c => c.IsActive || (c.ValidUntil >= CurrentYear || c.ValidUntil == 0)).OrderBy(x => x.CategoryName).ToListAsync(cancellationToken);
                var thrusts = await _db.tOptionProjectThrustList.AsNoTracking()
                    .Where(t => t.IsActive).OrderBy(x => x.ThrustDescription).ToListAsync(cancellationToken);
                var origins = await _db.tOptionProjectOrigin.AsNoTracking()
                    .Where(o => o.IsActive).OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var agencies = await _db.tOptionProjectAgency.AsNoTracking()
                    .Where(a => a.IsActive).OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var implementationModes = await _db.tOptionProjectImplementationMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var emergencyModes = await _db.tOptionProjectEmergencyMode.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var feasibilities = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var detailedDesigns = await _db.tOptionProjectDetailedDesign.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var rowAvailables = await _db.tOptionProjectRowAvailable.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var tiers = await _db.tOptionProjectTier.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var regionWides = await _db.tOptionRegionWide.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

                return Ok(new
                {
                    Tiers = tiers,

                    Categories = categories,
                    Thrusts = thrusts,

                    Provinces = provinces,
                    Cities = cities,
                    LegislativeDistricts = districts,

                    DEOs = deos,
                    Regions = regions,

                    ImplementingOffices = implementingOffices,
                    OperatingUnits = operatingUnits,

                    RegionWides = regionWides,

                    Origins = origins,
                    Agencies = agencies,

                    ImplementationModes = implementationModes,
                    EmergencyModes = emergencyModes,
                    RowAvailables = rowAvailables,

                    Feasibilities = feasibilities,

                    DetailedDesigns = detailedDesigns,
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> ShowProjectComponentDropdowns([FromBody] ProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var Agreement = await _db.tOptionFundingAgreement
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);
                var Source = await _db.tOptionFundingSource
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);

                var ComponentType = await _db.tOptionProjectComponent
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.ComponentName)
                    .ToListAsync(cancellationToken);

                var ScopeOfWork = await _db.tOptionScopeOfWork
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Description)
                    .ToListAsync(cancellationToken);
                var InfraTypes = await _db.tOptionInfraType
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.InfraName)
                    .ToListAsync(cancellationToken);

                var SupportingDoc = await _db.tOptionFundingSource
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);

                var ReasonHeader = await _db.tOptionRevisionHeader
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.RevisionName)
                    .ToListAsync(cancellationToken);

                var ReasonCategory = await _db.tOptionRevisionCategory
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.CategoryName)
                    .ToListAsync(cancellationToken);

                var ReasonReason = await _db.tOptionRevisionReasons
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Reason)
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    //Funding Profile
                    Agreements = Agreement,
                    Sources = Source,

                    //Component Cost
                    ComponentTypes = ComponentType,

                    //Major Item Of Work
                    ScopeOfWorks = ScopeOfWork,
                    InfraTypes = InfraTypes,

                    //SupportingDocs
                    SupportingDocs = SupportingDoc,

                    //Revision
                    Revisions = new
                    {
                        Headers = ReasonHeader,
                        Categories = ReasonCategory,
                        Reasons = ReasonReason
                    }
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region Project Lists
        [HttpPost]
        public async Task<IActionResult> ShowProjects([FromBody] ShowProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }

                // Validate pagination parameters
                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;

                var filterDefs = new List<(string Clause, string ParamName, object Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.ProgramId))
                    filterDefs.Add(("v.ProgramId LIKE @programId", "@programId", $"%{dto.Filters.ProgramId}%"));

                if (!string.IsNullOrEmpty(dto.Filters.ProjectId))
                    filterDefs.Add(("v.ProjectId = @projectId", "@projectId", dto.Filters.ProjectId));

                if (_Session.ApplyFilter)
                {
                    filterDefs.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                        "@regCode", _Session.RegCode));
                }

                string filterWhere = filterDefs.Count > 0
                    ? " WHERE " + string.Join(" AND ", filterDefs.Select(f => f.Clause))
                    : "";

                SqlParameter[] BuildParams(params SqlParameter[] extra) =>
                    filterDefs.Select(f => new SqlParameter(f.ParamName, f.Value))
                              .Concat(extra)
                              .ToArray();

                long? pageStartId = null;
                if (dto.page > 1)
                {
                    string pageIndexSql = $@"
                        SELECT ((rn - 1) / @limit) + 1 AS PageNumber, Id AS PageStartId
                        FROM (
                            SELECT v.Id, ROW_NUMBER() OVER (ORDER BY v.Id DESC) AS rn
                            FROM dbo.vProjectLatest v{filterWhere}
                        ) x
                        WHERE (rn - 1) % @limit = 0 AND ((rn - 1) / @limit) + 1 = @page";

                    var pageParams = BuildParams(
                        new SqlParameter("@limit", dto.limit),
                        new SqlParameter("@page", dto.page));

                    var pageRow = await _db.Set<PaginationPages>()
                        .FromSqlRaw(pageIndexSql, pageParams)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(cancellationToken);

                    if (pageRow == null)
                    {
                        var emptyCountParams = BuildParams();
                        var emptyCount = await _db.Set<PaginationCount>()
                            .FromSqlRaw($"SELECT COUNT_BIG(*) AS TotalCount FROM dbo.vProjectLatest v{filterWhere}", emptyCountParams)
                            .AsNoTracking()
                            .FirstOrDefaultAsync(cancellationToken);

                        long total = emptyCount?.TotalCount ?? 0;
                        return Ok(new FilteredResult<ProgramLatest>
                        {
                            lists = new List<ProgramLatest>(),
                            totalPages = (int)Math.Ceiling((double)total / dto.limit),
                            page = dto.page,
                            limit = dto.limit,
                            total = total
                        });
                    }

                    pageStartId = pageRow.PageStartId;
                }

                string fetchWhere = filterWhere;
                var fetchExtraParams = new List<SqlParameter> { new SqlParameter("@limit", dto.limit) };

                if (pageStartId.HasValue)
                {
                    fetchWhere += (filterWhere.Length > 0 ? " AND" : " WHERE") + " v.Id <= @pageStartId";
                    fetchExtraParams.Add(new SqlParameter("@pageStartId", pageStartId.Value));
                }

                string fetchSql = $@"
                    SELECT TOP (@limit) *
                    FROM dbo.vProjectLatest v{fetchWhere}
                    ORDER BY v.Id DESC";

                var projects = await _db.vProjectLatest
                    .FromSqlRaw(fetchSql, BuildParams(fetchExtraParams.ToArray()))
                    .AsNoTracking()
                    .ToListAsync();

                string countSql = $"SELECT COUNT_BIG(*) AS TotalCount FROM dbo.vProjectLatest v{filterWhere}";
                var countParams = BuildParams();

                var records = await _db.Set<PaginationCount>()
                    .FromSqlRaw(countSql, countParams)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cancellationToken) ?? new PaginationCount { TotalCount = 0 };

                var totalPages = (int)Math.Ceiling((double)records.TotalCount / dto.limit);

                return Ok(new FilteredResult<ProjectLatest>
                {
                    lists = projects,
                    totalPages = totalPages,
                    page = dto.page,
                    limit = dto.limit,
                    total = records.TotalCount
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        
        [HttpPost]
        public async Task<IActionResult> ShowProjectStages([FromBody] ShowProjectStagesDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (_Session.ApplyFilter)
                {
                    var isVisible = await _db.fUserVisibleProjects
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({_Session.UserId})")
                        .AnyAsync(x => x.ProjectPK == dto.ProjectId, cancellationToken);

                    if (!isVisible)
                    {
                        return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Project Not Found" });
                    }
                }

                var Stages = await _db.fProjectStages
                    .FromSqlInterpolated($"SELECT * FROM dbo.fProjectStages({dto.ProjectId})")
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    Stages = Stages
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region Add Project
        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] AddProjectDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                #region Validate Program
                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;
                #endregion

                #region Field Validation
                var pLookup = new ValidateProjectDetailsLookupsParams()
                {
                    _Session = _Session,
                    Tier = dto.Tier,
                    Category = dto.Category,
                    Thrust  = dto.Thrust,
                    Region  = dto.Region,
                    Province  = dto.Province,
                    City  = dto.City,
                    LegislativeDistrict  = dto.LegislativeDistrict,
                    DEO  = dto.DEO,
                    ImplementingOffice  = dto.ImplementingOffice,
                    OperatingUnit  = dto.OperatingUnit,
                    Origin  = dto.Origin,
                    Agency  = dto.Agency,
                    ImplementationMode  = dto.ImplementationMode,
                    EmergencyMode  = dto.EmergencyMode,
                    RowAvailable  = dto.RowAvailable,
                    Feasibility  = dto.Feasibility,
                    FeasibilityDate  = dto.FeasibilityDate,
                    DetailedDesign  = dto.DetailedDesign,
                    DetailedDesignDate  = dto.DetailedDesignDate,
                };
                var ValidateProjectLookUps = await _db.ValidateProjectDetailsLookups(pLookup, cancellationToken);
                if (!ValidateProjectLookUps.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProjectLookUps.Title,
                        Message = ValidateProjectLookUps.Message
                    });
                }
                #endregion

                #region Generate ProjectId
                string FourthSegment = !string.IsNullOrEmpty(dto.IslandCode) ? dto.IslandCode : ValidateProjectLookUps.Data!;
                GenerateProjectIDParams p = new GenerateProjectIDParams()
                {
                    CategoryId = dto.Category,
                    StageName = dto.StageName,
                    IslandCode = FourthSegment,
                    YearStart = ProgramParent.YearStart
                };
                string ProjectPK = await _db.GenerateProjectId(p, cancellationToken);
                #endregion
                string ProgramFK = ProgramParent.ProgramPK;
                string ProgramId = ProgramParent.ProgramId;
                var SubmitProject = new DBHelper.Models.Table.Project.Projects()
                {
                    ProgramFK = ProgramFK,
                    ProjectPK = ProjectPK,
                    ProgramId = ProgramId,
                    ProjectType = dto.ProjectType,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(SubmitProject);
                var ProjectRevision = new ProjectRevisions()
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = ProgramFK,
                    ProgramId = ProgramId,
                    ProjectId = ProjectPK,
                    MYCAApprovalDate = dto.MYCAApprovalDate,
                    Description = dto.Description!,

                    Region = dto.Region!,
                    Province = dto.Province,
                    City = dto.City,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    DEO = dto.DEO,
                    OperatingUnit = dto.OperatingUnit!,
                    ImplementingOffice = dto.ImplementingOffice!,
                    IslandCode = FourthSegment,

                    Category = dto.Category,
                    Thrust = dto.Thrust,
                    Origin = dto.Origin,
                    Agency = (int)dto.Agency!,

                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = (int)dto.EmergencyMode!,
                    RegionWide = dto.RegionWide,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = (int)dto.DetailedDesign!,
                    DetailedDesignDate = dto.DetailedDesignDate,
                    RowAvailable = (int)dto.RowAvailable!,
                    Tier = dto.Tier,
                    Rank = dto.Rank,

                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjectRevisions.AddAsync(ProjectRevision);
                await _db.SaveChangesAsync();

                var ProjectStage = new ProjectStages()
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = ProgramFK,
                    ProgramId = ProgramId,
                    RevisionId = ProjectRevision.Id,
                    StageId = ProgramStage.StageId,
                    StageName = ProgramStage.StageName,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjectStages.AddAsync(ProjectStage);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    ProjectId = ProjectPK,
                    StageName = ProgramStage.StageName,
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

        #region Project Details and Update Project
        [HttpPost]
        public async Task<IActionResult> ShowProjectDetails([FromBody] ProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                #region Project
                var ValidateProjectId = await _db.ValidateProjectId(new ValidateProjectIdParams
                {
                    ProjectId = dto.ProjectId,
                    StageName = dto.StageName,
                    _Session = _Session,
                    ViewOldStage = true
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

                string ProgramFK = ProjectParent.ProgramFK;
                EnumProgramStage StageId = ProjectStage.StageId;

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramFK, cancellationToken);
                var Program = await _db.fProgramDetailsInProject.FromSqlInterpolated($"SELECT * FROM fProgramDetailsInProject({ProgramFK},{StageId})").AsNoTracking().FirstOrDefaultAsync(cancellationToken);

                #region Funding Profile
                var Funding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisions.Id && !x.IsDeleted).ToListAsync(cancellationToken);
                #endregion

                #region Project Components
                //var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectRevisionFK == Project.Id && !x.IsDeleted).ToListAsync(cancellationToken);
                var ProjectComponents = await _db.tProjectComponentCost
                    .AsNoTracking()
                    .Where(component =>
                        component.ProjectRevisionFK == ProjectRevisions.Id &&
                        !component.IsDeleted)

                    // Component Cost → Cost Per Year
                    .Include(component =>
                        component.CostsPerYear.Where(year => !year.IsDeleted))

                    // Component Cost → Work Items → Work Locations
                    .Include(component =>
                        component.WorkItem.Where(item => !item.IsDeleted))
                    .ThenInclude(item =>
                        item.WorkLocations.Where(location => !location.IsDeleted))

                    // Recommended because multiple collection Includes are loaded
                    .AsSplitQuery()
                    .ToListAsync(cancellationToken);

                #endregion


                #region Supporting Documents
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisions.Id).ToListAsync(cancellationToken);
                #endregion

                #region Transaction Logs
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.TransactionId == dto.ProjectId).ToListAsync(cancellationToken);
                #endregion


                return Ok(new
                {
                    IsActive = (CurrentProgramVersion!.StageId == ProjectStage.StageId) ? true : false,
                    ProgramDetails = Program,
                    ProjectDetails = ProjectRevisions,
                    FundingProfile = Funding,
                    Components = ProjectComponents,
                    //ComponentCosts = ComponentCost,
                    //ComponentCostPerYear = ComponentCostYear,
                    //MajorItemOfWorks = MajorItemOfWork,
                    //MajorItemLocations = MajorWorkLocation,
                    //ProjectNotes = Notes,

                    Docs = Doc,
                    TransactionLogs = Transactions,
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateProjectDetails([FromBody] UpdateProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = Functions.CurrentDate();;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();

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

                string ProgramFK = ProjectParent.ProgramFK;
                EnumProgramStage StageId = ProjectStage.StageId;

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramFK, cancellationToken);
                if(CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "You are viewing an old stage of this project. Please go back to the Project List and open the project again to view the latest stage.",
                        Title = "Outdated Project Stage"
                    });
                }
                if (CurrentProgramVersion.StageName == "RBP" && CurrentProgramVersion.Status == "1")
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Project details cannot be updated. The project is already locked",
                        Title = "Program Status Approved"
                    });
                }
                var GetSameDescription = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.ProgramFK == ProjectParent.ProgramFK && x.Description == dto.ProjectDetails.Description && x.ProjectFK != ProjectParent.ProjectPK, cancellationToken);
                if (GetSameDescription != null && !dto.IsAllowedToProceed)
                {
                    return Ok(new { Message = $"Description: {dto.ProjectDetails.Description} already exist in {GetSameDescription.ProjectId}! Do you still want to proceed?", Title = "Description Exists", Type = "Prompt" });
                }
                bool HasCostUpdate = false;

                #region Field Validations
                #region Project
                var pLookup = new ValidateProjectDetailsLookupsParams()
                {
                    _Session = _Session,
                    Tier = dto.ProjectDetails.Tier,
                    Category = dto.ProjectDetails.Category,
                    Thrust = dto.ProjectDetails.Thrust,
                    Region = dto.ProjectDetails.Region,
                    Province = dto.ProjectDetails.Province,
                    City = dto.ProjectDetails.City,
                    LegislativeDistrict = dto.ProjectDetails.LegislativeDistrict,
                    DEO = dto.ProjectDetails.DEO,
                    ImplementingOffice = dto.ProjectDetails.ImplementingOffice,
                    OperatingUnit = dto.ProjectDetails.OperatingUnit,
                    Origin = dto.ProjectDetails.Origin,
                    Agency = dto.ProjectDetails.Agency,
                    ImplementationMode = dto.ProjectDetails.ImplementationMode,
                    EmergencyMode = dto.ProjectDetails.EmergencyMode,
                    RowAvailable = dto.ProjectDetails.RowAvailable,
                    Feasibility = dto.ProjectDetails.Feasibility,
                    FeasibilityDate = dto.ProjectDetails.FeasibilityDate,
                    DetailedDesign = dto.ProjectDetails.DetailedDesign,
                    DetailedDesignDate = dto.ProjectDetails.DetailedDesignDate,
                };
                var ValidateProjectLookUps = await _db.ValidateProjectDetailsLookups(pLookup, cancellationToken);
                if (!ValidateProjectLookUps.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProjectLookUps.Title,
                        Message = ValidateProjectLookUps.Message
                    });
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
                var ExistingComponentCosts = _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectId == dto.ProjectDetails.ProjectId && x.StageName == dto.ProjectDetails.StageName && x.IsDeleted == false).ToList();
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
                var ExistingMajorItemComponentIds = _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == dto.ProjectDetails.ProjectId && x.StageName == dto.ProjectDetails.StageName && x.IsDeleted == false).Select(x => x.ComponentId).ToList();
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
                            ParentId = x.Item.ParentId,
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
                    var Category = await _db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentDate.Year || x.ValidUntil == 0).FirstOrDefaultAsync(x => x.CategoryId == dto.ProjectDetails!.Category);
                    if (Category == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Category '{dto.ProjectDetails!.Category}' is not valid.", Title = "Invalid Category" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.ProjectDetails!.Thrust}' is not valid.", Title = "Invalid Thrust" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Origin '{dto.ProjectDetails!.Origin}' is not valid.", Title = "Invalid Origin" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected City '{dto.ProjectDetails!.City}' is not valid.", Title = "Invalid City" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.ProjectDetails!.LegislativeDistrict}' is not valid.", Title = "Invalid Legislative District" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{dto.ProjectDetails!.OperatingUnit}' is not valid.", Title = "Invalid Operating Unit" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{dto.ProjectDetails!.ImplementingOffice}' is not valid.", Title = "Invalid Implementing Office" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Agency '{dto.ProjectDetails!.Agency}' is not valid.", Title = "Invalid Agency" });
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
                    return new BadRequestObjectResult(new { Message = $"Implementation Mode is required.", Title = "Implementation Mode Required" });
                }
                if (Project.ImplementationMode != dto.ProjectDetails?.ImplementationMode)
                {
                    var ImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.ImplementationMode);
                    if (ImplementationMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{dto.ProjectDetails!.ImplementationMode}' is not valid.", Title = "Invalid Implementation Mode" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{dto.ProjectDetails!.EmergencyMode}' is not valid.", Title = "Invalid Emergency Mode" });
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
                    return new BadRequestObjectResult(new { Message = $"Feasibility is required.", Title = "Feasibility Required" });
                }
                if (Project.Feasibility != dto.ProjectDetails?.Feasibility)
                {
                    var Feasib = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == dto.ProjectDetails!.Feasibility);
                    if (Feasib == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{dto.ProjectDetails!.Feasibility}' is not valid.", Title = "Invalid Feasibility" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{dto.ProjectDetails!.DetailedDesign}' is not valid.", Title = "Invalid Detailed Design" });
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
                        return new BadRequestObjectResult(new { Message = $"Selected Row Available '{dto.ProjectDetails!.EmergencyMode}' is not valid.", Title = "Invalid Row Available" });
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
                if (Project.Rank != dto.ProjectDetails?.Rank)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = Project.ProjectId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Rank",
                        NewValue = $"Stage: {Program.StageName} Value: {dto.ProjectDetails?.Rank.ToString()!}",
                        OldValue = $"Stage: {Program.StageName} Value: {Project.Rank.ToString()!}",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Rank = dto.ProjectDetails!.Rank;
                }
                if (hasUpdated)
                {
                    var LatestRevision = await _db.tProjectRevisions.AsNoTracking()
                        .Where(x => x.Id == Project.RevisionId)
                        .FirstOrDefaultAsync();
                    var NewRevision = new ProjectRevisions()
                    {
                        ProgramId = Project.ProgramId,
                        ReferenceId = Project.ReferenceId,
                        ProjectId = Project.ProjectId!,
                        AlternateId = Project.AlternateId,
                        ExternalId = Project.ExternalId,
                        MYId = Project.MYId,
                        UACS = Project.UACS,
                        MYCAApprovalDate = Project.MYCAApprovalDate,
                        RevisionNumber = LatestRevision!.RevisionNumber + 1,
                        Description = Project!.Description!,
                        Category = Project!.Category,
                        Thrust = Project!.Thrust,
                        Origin = Project!.Origin,
                        City = Project!.City,
                        Province = Project.Province!,
                        LegislativeDistrict = Project!.LegislativeDistrict,
                        OperatingUnit = Project!.OperatingUnit!,
                        ImplementingOffice = Project!.ImplementingOffice!,
                        DEO = Project.DEO!,
                        Region = Project.Region!,
                        Agency = (int)Project.Agency!,
                        ImplementationMode = Project.ImplementationMode,
                        EmergencyMode = (int)Project.EmergencyMode!,
                        IslandCode = Project.IslandCode!,
                        Feasibility = Project.Feasibility,
                        FeasibilityDate = Project.FeasibilityDate,
                        DetailedDesign = (int)Project.DetailedDesign!,
                        RowAvailable = (int)Project.RowAvailable!,
                        RegionWide = Project.RegionWide,
                        Tier = Project.Tier,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                        IsPublishable = Project.IsPublishable
                    };
                    await _db.tProjectRevisions.AddAsync(NewRevision);
                    await _db.SaveChangesAsync();
                    var newStage = new ProjectStages()
                    {
                        ProgramId = Program.ProgramId!,
                        ReferenceId = Project.ReferenceId,
                        RevisionId = NewRevision.Id,
                        StageId = Program.StageId,
                        StageName = Program.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
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
                    List<ProjectComponentCost> NewCostToAdd = new List<ProjectComponentCost>();
                    List<ProjectComponentCostPerYear> NewComponentCostYear = new List<ProjectComponentCostPerYear>();
                    foreach (var CostId in NewComponentIds)
                    {
                        var NewComponentCost = NewComponentCostData.FirstOrDefault(x => x.ComponentId == CostId);
                        if (NewComponentCost != null)
                        {
                            NewCostToAdd.Add(new ProjectComponentCost
                            {
                                ProgramUniqueId = Project.ProgramUniqueId!,
                                StageName = Project.StageName!,
                                CostId = $"{NewComponentCost.ComponentId}_{Project.ProgramUniqueId}",
                                ProjectId = Project.ProjectId!,
                                ComponentId = NewComponentCost.ComponentId,
                                ComponentType = NewComponentCost.ComponentType,
                                Description = NewComponentCost.Description,
                                Total = NewComponentCost.Total,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            });
                            NewComponentCostYear.AddRange(dto.ComponentCostPerYear.Where(x => x.Id == 0 && CostId.Contains(x.ComponentCostId)).Select(x => new ProjectComponentCostPerYear
                            {
                                ProgramUniqueId = $"{NewComponentCost.ComponentId}_{Project.ProgramUniqueId}",
                                ComponentCostId = x.ComponentCostId!,
                                Amount = x.Amount,
                                Year = x.Year,
                                StartDate = x.StartDate!,
                                EndDate = x.EndDate,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            }));
                        }
                    }
                    await _db.tProjectComponentCost.AddRangeAsync(NewCostToAdd);
                    await _db.tProjectComponentCostPerYear.AddRangeAsync(NewComponentCostYear);
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
                                        return new BadRequestObjectResult(new { Message = $"Selected Component '{item.ComponentType}' is not valid.", Title = "Invalid Component" });
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
                                if (ExistingItem.Total != item.Total)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        TransactionId = Project.ProjectId!,
                                        TypeOfTransaction = "Update",
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Total",
                                        NewValue = item.Total.ToString(),
                                        OldValue = ExistingItem.Total.ToString(),
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Total = item.Total;
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
                #region Update Component Cost Per Year
                var ComponentCostYear = await _db.tProjectComponentCostPerYear.AsNoTracking().Where(x => ComponentCost.Select(a => a.CostId).Contains(x.ComponentCostId) && !x.IsDeleted).ToListAsync();
                if(ComponentCostYear.Count() > 0)
                {
                    #region Update Component Cost Per Year
                    HasCostUpdate = true;
                    bool ComponentYearUpdate = false;
                    foreach (var Year in ComponentCostYear)
                    {
                        var CostYearToBeUpdated = dto.ComponentCostPerYear.FirstOrDefault(x => x.Id == Year.Id);
                        if (CostYearToBeUpdated != null)
                        {
                            if (Year.Amount != CostYearToBeUpdated.Amount)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    TransactionId = Project.ProjectId!,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "Amount",
                                    NewValue = CostYearToBeUpdated.Amount.ToString()!,
                                    OldValue = Year.Amount.ToString()!,
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.Amount = CostYearToBeUpdated.Amount;
                            }
                            if(Year.StartDate != CostYearToBeUpdated.StartDate)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    TransactionId = Project.ProjectId!,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "StartDate",
                                    NewValue = CostYearToBeUpdated.StartDate?.ToString("mm/dd/yyyy") ?? "",
                                    OldValue = Year.StartDate?.ToString("mm/dd/yyyy") ?? "",
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.StartDate = CostYearToBeUpdated.StartDate;
                            }
                            if (Year.EndDate != CostYearToBeUpdated.EndDate)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    TransactionId = Project.ProjectId!,
                                    TypeOfTransaction = "Update",
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "EndDate",
                                    NewValue = CostYearToBeUpdated.EndDate?.ToString("mm/dd/yyyy") ?? "",
                                    OldValue = Year.EndDate?.ToString("mm/dd/yyyy") ?? "",
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.EndDate = CostYearToBeUpdated.EndDate;
                            }
                            if(Year.IsDeleted != CostYearToBeUpdated.IsDeleted)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    TransactionId = Project.ProjectId!,
                                    TypeOfTransaction = "Delete",
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "Row",
                                    NewValue = "",
                                    OldValue = JsonConvert.SerializeObject(Year),
                                    CreatedBy = _Session.UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.IsDeleted = CostYearToBeUpdated.IsDeleted;
                            }
                            if (ComponentYearUpdate)
                            {
                                Year.UpdatedBy = _Session.UserId;
                                Year.UpdatedDate = CurrentDate;
                                _db.tProjectComponentCostPerYear.Update(Year);
                            }
                        }
                    }
                    #endregion
                }
                #region New Component Cost Per Year
                var NewComponentCostYearData = dto.ComponentCostPerYear.Where(x => x.Id == 0 && !x.IsDeleted);
                if (NewComponentCostYearData.Count() > 0)
                {
                    var NewCostYearToAdd = NewComponentCostYearData.Select(x => new DBHelper.Models.Table.ProjectComponentCostPerYear
                    {
                        ProgramUniqueId = Project.ProgramUniqueId!,
                        ComponentCostId = x.ComponentCostId!,
                        Amount = x.Amount,
                        Year = x.Year,
                        StartDate = x.StartDate!,
                        EndDate = x.EndDate,
                        StageName = Program.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    }).ToList();
                    await _db.tProjectComponentCostPerYear.AddRangeAsync(NewCostYearToAdd);
                }
                #endregion
                #endregion
                #region Update Major Item of Works
                var MajorItemOfWorks = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => x.ProjectId == Project.ProjectId && x.StageName == Program.StageName && !x.IsDeleted).ToListAsync();
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
                                if (ExistingItem.InfraType != item.InfraType)
                                {
                                    var Infra = await _db.tInfraType.FirstOrDefaultAsync(x => x.InfraCode == item.InfraType);
                                    if (Infra == null)
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Infrastructure Type '{item.InfraType}' is not valid.", Title = "Invalid Infrastructure Type" });
                                    }
                                }
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
                                if (ExistingItem.WorkTypeId != item.WorkTypeId)
                                {
                                    hasUpdate = true;
                                    var WorkTypeEnum = await _db.tOptionScopeOfWork.FirstOrDefaultAsync(x => x.Enum == item.WorkTypeId);
                                    if (WorkTypeEnum == null)
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Work Type '{item.WorkTypeId}' is not valid.", Title = "Invalid Work Type" });
                                    }
                                    var oldWorkType = await _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == ExistingItem.WorkTypeId);
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
                        var CurrentLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => UpdatedWorkItemIds.Contains(x.ParentId) && !x.IsDeleted && x.StageName == Program.StageName).ToListAsync();
                        HashSet<int> CurrentLocationIds = CurrentLocations.Select(x => x.Id).ToHashSet();
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
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "InfraId",
                                            NewValue = loc.InfraId,
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
                                            NewValue = loc.StartX.ToString() ?? "",
                                            OldValue = ExistingLoc.StartX.ToString() ?? "",
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
                                            NewValue = loc.StartY.ToString() ?? "",
                                            OldValue = ExistingLoc.StartY.ToString() ?? "",
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
                                            NewValue = loc.EndX.ToString() ?? "",
                                            OldValue = ExistingLoc.EndX.ToString() ?? "",
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
                                            NewValue = loc.EndY.ToString() ?? "",
                                            OldValue = ExistingLoc.EndY.ToString() ?? "",
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
                                    if(ExistingLoc.Length != loc.Length)
                                    {
                                        hasLocUpdate = true;
                                        transactionLogs.Add(new TransactionLog
                                        {
                                            TransactionId = Project.ProjectId!,
                                            TypeOfTransaction = "Update",
                                            AffectedTable = "tProjectMajorWorkLocations",
                                            AffectedColumn = "Length",
                                            NewValue = loc.Length.ToString() ?? "",
                                            OldValue = ExistingLoc.Length.ToString() ?? "",
                                            CreatedBy = _Session.UserId,
                                            CreatedDate = CurrentDate
                                        });
                                        ExistingLoc.Length = loc.Length;
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

                                        // Detach any conflicting tracked instance
                                        var trackedEntry = _db.ChangeTracker.Entries<ProjectMajorWorkLocations>()
                                            .FirstOrDefault(e => e.Entity.Id == ExistingLoc.Id);
                                        if (trackedEntry != null)
                                            trackedEntry.State = EntityState.Detached;

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
                                ProgramUniqueId = Program.ProgramUniqueId!,
                                ParentId = item.ParentId,
                                StageName = item.StageName,
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
                                Length = item.Length,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            }));
                        }
                        #endregion 
                    }
                    #endregion
                }
                #region New Major Item of Works
                if (NewMajorItemComponentIds.Count > 0)
                {
                    List<ProjectMajorWorkItem> NewWorkItems = new List<ProjectMajorWorkItem>();
                    List<ProjectMajorWorkLocations> NewWorkLocations = new List<ProjectMajorWorkLocations>();
                    foreach (var WorkComponentId in NewMajorItemComponentIds)
                    {
                        var WorkItem = dto.MajorItemOfWorks.Where(x => x.ComponentId == WorkComponentId && x.Id == 0);
                        if (WorkItem != null)
                        {
                            NewWorkItems.AddRange(WorkItem.Select(x => new ProjectMajorWorkItem
                            {
                                ProgramUniqueId = Project.ProgramUniqueId!,
                                StageName = Program.StageName,
                                ProjectId = Project.ProjectId!,
                                ReferenceId = $"{WorkComponentId}_{Project.ProgramUniqueId}",
                                ComponentId = x.ComponentId,
                                YearOfWork = x.YearOfWork,
                                WorkTypeId = x.WorkTypeId,
                                InfraType = x.InfraType,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            }));
                            string WorkItemId = WorkItem.FirstOrDefault()!.ReferenceId;
                            if (!string.IsNullOrEmpty(WorkItemId))
                            {
                                var WorkLocations = dto.MajorItemLocations.Where(x => x.ParentId == WorkItemId);
                                if (WorkLocations != null)
                                {
                                    NewWorkLocations.AddRange(WorkLocations.Select(item => new ProjectMajorWorkLocations
                                    {
                                        ProgramUniqueId = Project.ProgramUniqueId!,
                                        StageName = Program.StageName,
                                        ParentId = $"{WorkComponentId}_{Project.ProgramUniqueId}",
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
                                        Length = item.Length,
                                        CreatedBy = _Session.UserId,
                                        CreatedDate = CurrentDate
                                    }));
                                }
                            }
                        }
                    }
                    await _db.tProjectMajorWorkItem.AddRangeAsync(NewWorkItems);
                    await _db.tProjectMajorWorkLocations.AddRangeAsync(NewWorkLocations);
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
                        ProgramUniqueId = Project.ProgramUniqueId!,
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
                    HashSet<string> ProjectIds = _db.fProjectsPerStage.FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({Program.ProgramId}) fp WHERE fp.StageName = {Program.StageName}").AsNoTracking().Select(x => x.ProjectId!).ToHashSet();
                    double ProgramAmount = _db.tProjectComponentCost.AsNoTracking().Where(x => ProjectIds.Contains(x.ProjectId) && x.IsDeleted == false && x.StageName == Program.StageName && !CostToBeDeleted.Contains(x.Id)).Sum(x => x.Total);
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
                        return new BadRequestObjectResult(new { Message = "Program not found for this project.", Title = "Program Not Found" });
                    }
                    CurrentVersion.Cost = ProgramAmount;
                    _db.tProgramRevisions.Update(CurrentVersion);
                    await _db.SaveChangesAsync();
                }
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = $"Project {dto.ProjectDetails!.ProjectId} updated successfully.",
                    Title = "Update Complete"
                });

            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> UploadNotes([FromBody] AddNotesDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var Project = await _db.fProjectDetails
                .FromSqlInterpolated($@"
                    SELECT * FROM fProjectDetails({dto.ProjectId}) fp 
                    WHERE fp.StageName = {dto.StageName} 
                    AND fp.ProjectId = {dto.ProjectId}
                    AND ({regionCode} IS NULL OR fp.Region = {regionCode})")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Project Not Found" });
                }
                if(_Session.ApplyFilter && Project.Region != _Session.RegCode)
                {
                    return new BadRequestObjectResult(new { Message = "You don't have access to add notes for this project.", Title = "Access Denied" });
                }
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded.", Title = "File Upload Error" });
                }
                string FilePath = Path.Combine(Appsetting.Resources.ProjectNotes, Project.ProjectId!, dto.File.Name);
                if (!dto.File.UploadFile(FilePath))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted.", Title = "File Corrupted" });
                }
                var AddNotes = new ProjectNotes()
                {
                    ProjectId = dto.ProjectId,
                    FileName = dto.File.Name,
                    FileExtension = dto.File.Extension,
                    FilePath = FilePath,
                    Description = Regex.Replace(dto.Description, @"\s+", " "),
                    CreatedBy = _Session.UserId,
                    CreatedDate = Functions.CurrentDate()
                };
                await _db.tProjectNotes.AddAsync(AddNotes);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Notes added successfully.", Title = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> DeleteNotes([FromBody] DeleteNotesDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var Project = await _db.fProjectDetails
                .FromSqlInterpolated($@"
                    SELECT * FROM fProjectDetails({dto.ProjectId}) fp 
                    WHERE fp.StageName = {dto.StageName} 
                    AND fp.ProjectId = {dto.ProjectId}
                    AND ({regionCode} IS NULL OR fp.Region = {regionCode})")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Project Not Found" });
                }
                if(_Session.ApplyFilter && Project.Region != _Session.RegCode)
                {
                    return new BadRequestObjectResult(new { Message = "You don't have access to delete notes for this project.", Title = "Access Denied" });
                }
                var Note = await _db.tProjectNotes.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (Note == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project note not found.", Title = "Project Not Found" });
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
                    CreatedDate = Functions.CurrentDate()
                });
                _db.tProjectNotes.Remove(Note);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Notes deleted successfully.", Title = "Delete Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> UploadSupportingDocs([FromBody] AddSupportingDocsDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var Project = await _db.fProjectDetails
                .FromSqlInterpolated($@"
                    SELECT * FROM fProjectDetails({dto.ProjectId}) fp 
                    WHERE fp.StageName = {dto.StageName} 
                    AND fp.ProjectId = {dto.ProjectId}
                    AND ({regionCode} IS NULL OR fp.Region = {regionCode})")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if(Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Project Not Found" });
                }
                if(_Session.ApplyFilter && Project.Region != _Session.RegCode)
                {
                    return new BadRequestObjectResult(new { Message = "You don't have access to add supporting documents for this project.", Title = "Access Denied" });
                }
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded.", Title = "File Upload Error" });
                }
                string FilePath = Path.Combine(Appsetting.Resources.SupportingDocs, Project.ProjectId!, dto.File.Name);
                if (!dto.File.ValidateFileSize(50))
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file exceeds the maximum allowed size of 50 MB.", Title = "File Size Exceeded" });
                }
                if (dto.File.IsPdfCorrupted())
                {
                    return new BadRequestObjectResult(new { Message = "Uploaded file is corrupted or not valid.", Title = "File Corrupted" });
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
                    CreatedDate = Functions.CurrentDate()
                };
                await _db.tProjectSupportingDocs.AddAsync(AddSupporting);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Docs added successfully.", Title = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> DeleteSupportingDocs([FromBody] DeleteSupportingDocsDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var Project = await _db.fProjectDetails
                .FromSqlInterpolated($@"
                    SELECT * FROM fProjectDetails({dto.ProjectId}) fp 
                    WHERE fp.StageName = {dto.StageName} 
                    AND fp.ProjectId = {dto.ProjectId}
                    AND ({regionCode} IS NULL OR fp.Region = {regionCode})")
                .AsNoTracking()
                .FirstOrDefaultAsync();
                if (Project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Project Not Found" });
                }
                if(_Session.ApplyFilter && Project.Region != _Session.RegCode)
                {
                    return new BadRequestObjectResult(new { Message = "You don't have access to delete supporting documents for this project.", Title = "Access Denied" });
                }
                var Note = await _db.tProjectSupportingDocs.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if(Note == null)
                {
                    return new BadRequestObjectResult(new { Message = "Supporting Doc not found.", Title = "Project Not Found" });
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
                    CreatedDate = Functions.CurrentDate()
                });
                _db.tProjectSupportingDocs.Remove(Note);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Document deleted successfully.", Title = "Delete Success." });
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