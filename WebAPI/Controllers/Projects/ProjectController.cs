using Castle.MicroKernel.Internal;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views.Program;
using DBHelper.Models.Views.Project;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Data;
using System.Linq;
using System.Text.RegularExpressions;
using static Helpers.ProjectHelper;

namespace WebAPI.Controllers.Projects
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectController : CoreController
    {
        public ProjectController(MYPSDbContext db, IHubContext<MicroService.SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        #region Others
        [HttpPost]
        public async Task<IActionResult> ShowProjectDropdowns(CancellationToken cancellationToken)
        {
            try
            {
                var userId = _Session.UserId;
                var regions = await _db.fUserVisibleRegions
                    .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleRegions({userId})")
                    .AsNoTracking().ToListAsync(cancellationToken);
                HashSet<string> RegionParticipantIds = regions.Select(x => x.ParticipantId).ToHashSet();

                var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking().Where(
                    x => RegionParticipantIds.Contains(x.RegionParticipantId) && !x.Deprecated).OrderBy(x => x.Name).ToListAsync(cancellationToken);

                HashSet<string> ProvinceCodes = provinces.Select(x => x.Code).ToHashSet();

                var cities = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().Where(
                    x => ProvinceCodes.Contains(x.ProvinceCode) && !x.Deprecated).OrderBy(x => x.Name).ToListAsync(cancellationToken);

                var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().Where(
                    x => ProvinceCodes.Contains(x.ProvinceCode) && !x.Deprecated).OrderBy(x => x.Name).ToListAsync(cancellationToken);

                var deos = await _db.vAdminDEO.AsNoTracking().Where(
                    x => RegionParticipantIds.Contains(
                        x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).OrderBy(x => x.Name).ToListAsync(cancellationToken);

                var implementingOffices = await _db.vAdminImplementingOffice.AsNoTracking().Where(
                    x => RegionParticipantIds.Contains(
                        x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).OrderBy(x => x.Name).ToListAsync(cancellationToken);
                
                var operatingUnits = await _db.vAdminOperatingUnit.AsNoTracking().Where(
                    x => RegionParticipantIds.Contains(
                        x.RegionParticipantId!) || string.IsNullOrEmpty(x.RegionParticipantId)).OrderBy(x => x.Name).ToListAsync(cancellationToken);


                int CurrentYear = (int)Functions.CurrentDate().Year;
                var categories = await _db.tOptionProjectCategory.AsNoTracking()
                    .Where(c => c.IsActive && (c.ValidUntil >= CurrentYear || c.ValidUntil == 0)).OrderBy(x => x.CategoryName).ToListAsync(cancellationToken);
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
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> ShowProjectComponentDropdowns(CancellationToken cancellationToken)
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

                var ComponentType = await _db.tOptionProjectComponentType
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

                var SupportingDoc = await _db.tOptionSupportingDocs
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
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        #endregion

        #region Project Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowProjects([FromBody] ShowProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();


                if (!string.IsNullOrEmpty(dto.Filters.ProgramId))
                    filters.Add(("v.ProgramId LIKE @programId", "@programId", $"%{dto.Filters.ProgramId}%"));

                if (!string.IsNullOrEmpty(dto.Filters.ProjectId))
                    filters.Add(("v.ProjectId LIKE @projectId", "@projectId", $"%{dto.Filters.ProjectId}%"));

                if (_Session.ApplyFilter)
                {
                    filters.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                        "@regCode", _Session.RegCode));
                }
                FilterDataResult<ProjectLatest> result =
                    await _db.FilterDataCursor<
                        ProjectLatest,
                        ShowProjectFilterDTO>(
                            tableName: "vProjectLatest",
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
        [AllowAnonymous]
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
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region Add Project
        [AllowAnonymous]
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
                    YearStart = ProgramParent.StartYear
                };
                string ProjectPK = await _db.GenerateProjectID(p, cancellationToken);//_db.GenerateProjectId(p, cancellationToken);
                #endregion
                string ProgramFK = ProgramParent.ProgramPK;
                string ProgramId = ProgramRevision.ProgramId;

                //string[] HasIslandCode = new string[] { "LZ", "VS", "MN" };
                //dto.ProjectType = !HasIslandCode.Contains(dto.IslandCode) ? dto.IslandCode! : "AIP";
                //var SelectedRegion = await _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.Region, cancellationToken);
                //dto.IslandCode = SelectedRegion?.IslandCode ?? dto.IslandCode;
                var SubmitProject = new DBHelper.Models.Table.Project.Projects()
                {
                    ProgramFK = ProgramFK,
                    ProjectPK = ProjectPK,
                    ProgramId = ProgramId,
                    MYId = dto.MYId,
                    ProjectType = dto.ProjectType!,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(SubmitProject);
                await _db.SaveChangesAsync(cancellationToken);

                var ProjectRevision = new ProjectRevisions()
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = ProgramFK,
                    ProgramId = ProgramId,
                    ProjectId = ProjectPK,
                    MYCAApprovalDate = dto.MYCAApprovalDate,
                    Description = dto.Description!,

                    AlternateId = dto.AlternateId,

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
                await _db.SaveChangesAsync(cancellationToken);

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
                await _db.SaveChangesAsync(cancellationToken);
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
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> SearchProgram([FromBody] SearchProgramDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if(dto.Filter.Length < 3)
                {
                    return new BadRequestObjectResult(new { Message = "Filter must be at least 3 characters long", Title = "Invalid Filter" });
                }
                var SearchedProgram = await _db.vProgramLatest.AsNoTracking().Where(x => 
                    x.Status != EnumProgramStatus.Approved.ToString()
                    && x.StageName != EnumProgramStage.GAAR.ToString()
                    && (x.Name.Contains(dto.Filter) || x.ProgramId.Contains(dto.Filter) || x.Type.Contains(dto.Filter)))
                .ToListAsync(cancellationToken);
                return Ok(new
                {
                    Programs = SearchedProgram
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region Project Details and Update Project
        [AllowAnonymous]
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

                string ProjectFK = ProjectParent.ProjectPK;
                string ProgramFK = ProjectParent.ProgramFK;
                EnumProgramStage StageId = ProjectStage.StageId;

                var CurrentProgramVersion = await _db.vProjectLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId && x.StageName == ProjectStage.StageName, cancellationToken);
                var Program = await _db.fProgramDetailsInProject.FromSqlInterpolated($"SELECT * FROM fProgramDetailsInProject({ProgramFK},{StageId})").AsNoTracking().FirstOrDefaultAsync(cancellationToken);
                var ProgramLatest = await _db.vProgramLatest.FirstOrDefaultAsync(x => x.ProgramPK == ProgramFK);
                if(ProgramLatest == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "The program record appears to be orphaned and its current data could not be resolved. " +
                            "Please contact the administrator to verify the program data.",
                        Title = "Orphaned Program Data"
                    });
                }
                #region Funding Profile
                var Funding = await _db.fProjectFundingProfile.FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({ProjectFK},{StageId})").AsNoTracking().ToListAsync(cancellationToken);
                #endregion

                #region Project Components

                var ComponentCost = await _db.fProjectComponentCost.FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({ProjectFK}, {StageId})").AsNoTracking().ToListAsync(cancellationToken);
                var ComponentCostYear = await _db.fProjectComponentCostPerYear.FromSqlInterpolated($"SELECT * FROM fProjectComponentCostPerYear({ProjectFK}, {StageId})").AsNoTracking().ToListAsync(cancellationToken);

                var MajorItemOfWork = await _db.fProjectMajorWorkItem.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({ProjectFK}, {StageId})").AsNoTracking().ToListAsync(cancellationToken);
                var MajorWorkLocation = await _db.fProjectMajorWorkLocations.FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkLocations({ProjectFK}, {StageId})").AsNoTracking().ToListAsync(cancellationToken);

                #endregion


                #region Supporting Documents
                var Doc = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisions.Id).ToListAsync(cancellationToken);
                #endregion

                #region Transaction Logs
                string ReferenceId = $"{dto.ProjectId}-{dto.StageName}";
                var Transactions = await _db.tTransactionLog.AsNoTracking().Where(x => x.ReferenceId == ReferenceId).ToListAsync(cancellationToken);
                #endregion


                return Ok(new
                {
                    IsActive = (CurrentProgramVersion == null) ? false : (ProgramLatest.Status == "Approved") ? false : true,
                    IsModify = (ProjectParent.IsPublished && ProgramLatest.Status == "Approved" && ProgramLatest.StageId == EnumProgramStage.GAAR) ? true : false,
                    ProgramDetails = Program,
                    ProjectDetails = ProjectRevisions,
                    FundingProfile = Funding,
                    //Components = ProjectComponents,
                    ComponentCosts = ComponentCost,
                    ComponentCostPerYear = ComponentCostYear,
                    MajorItemOfWorks = MajorItemOfWork,
                    MajorItemLocations = MajorWorkLocation,
                    //ProjectNotes = Notes,

                    Docs = Doc,
                    TransactionLogs = Transactions,
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProjectDetails([FromBody] UpdateProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = Functions.CurrentDate(); ;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                string StageName = dto.ProjectDetails.StageName;
                string UserId = _Session.UserId;
                string ProjectId = dto.ProjectDetails.ProjectId;

                #region Project
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
                var ProjectParent = ValidateProjectId.Data!.Project;
                var ProjectRevision = ValidateProjectId.Data.ProjectRevision;
                var ProjectStage = ValidateProjectId.Data.ProjectStage;
                #endregion

                string ProgramFK = ProjectParent.ProgramFK;
                int ProjectRevisionFK = ProjectRevision.Id;
                EnumProgramStage StageId = ProjectStage.StageId;

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramFK, cancellationToken);
                int ProgramRevisionId = CurrentProgramVersion.RevisionId;
                var ProgramRevision = await _db.tProgramRevisions.FirstOrDefaultAsync(x => x.Id == ProgramRevisionId, cancellationToken);
                if (ProgramRevision == null)
                {
                    return new BadRequestObjectResult(new { Message = "Program Revision not found.", Title = "Program Not Found" });
                }
                if (CurrentProgramVersion == null)
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
                #region Validations

                #region Project
                var pLookup = new ValidateProjectDetailsLookupsParams()
                {
                    _Session = _Session,
                    Tier = dto.ProjectDetails.Tier,
                    Category = dto.ProjectDetails.Category,
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
                if (BlankFunding.Any())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid amount(s). Please check and try again.", Title = "Invalid Funding Profile Amount" });
                }
                var blankFundingSource = dto.FundingProfile
                .Where(x => string.IsNullOrWhiteSpace(x.SourceOrg))
                .ToList();
                if (blankFundingSource.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Source",
                        Message = "One or more Funding Profile entries do not have a funding source selected. Please select a valid funding source and try again."
                    });
                }

                HashSet<string> fundingSources = dto.FundingProfile
                    .Select(x => x.SourceOrg)
                    .ToHashSet();

                var validFundingSources = await _db.tOptionFundingSource
                    .Where(x => fundingSources.Contains(x.Organization))
                    .Select(x => x.Organization)
                    .ToListAsync(cancellationToken);

                var invalidFundingSources = fundingSources
                    .Except(validFundingSources)
                    .ToList();

                if (invalidFundingSources.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Source",
                        Message = "One or more Funding Profile sources are no longer available or are invalid. Please review your selected funding sources and try again.",
                        InvalidSources = invalidFundingSources
                    });
                }
                var blankFundingAgreement = dto.FundingProfile
                .Where(x => string.IsNullOrWhiteSpace(x.AgreementCode))
                .ToList();

                if (blankFundingAgreement.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Agreement",
                        Message = "One or more Funding Profile entries do not have a funding agreement selected. Please select a valid funding agreement and try again."
                    });
                }

                var requestedPairs = dto.FundingProfile
                    .Select(x => new
                    {
                        Source = x.SourceOrg,
                        Agreement = x.AgreementCode
                    })
                    .Distinct()
                    .ToList();

                var validPairs = await _db.tOptionFundingAgreement
                    .Where(x => requestedPairs.Select(p => p.Agreement).Contains(x.Code))
                    .Select(x => new
                    {
                        Source = x.SourceOrg,
                        Agreement = x.Code
                    })
                    .ToListAsync(cancellationToken);

                var invalidPairs = requestedPairs
                    .Where(p => !validPairs.Any(v =>
                        v.Source == p.Source &&
                        v.Agreement == p.Agreement))
                    .ToList();

                if (invalidPairs.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Agreement",
                        Message = "One or more funding agreements do not belong to the selected funding source. Please review your Funding Profile and try again.",
                        InvalidEntries = invalidPairs
                    });
                }

                #endregion

                #region Component Cost and Cost Per Year
                // Validate Component Cost Amount
                if (dto.ComponentCosts.Any(x => x.Id == 0 && x.Total < 1))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Component Cost Amount",
                        Message = "One or more Component Costs contain an invalid amount. Please review your entries and try again."
                    });
                }

                // Collect new Component IDs
                var newComponentIds = dto.ComponentCosts
                    .Where(x => x.Id == 0)
                    .Select(x => x.ComponentId)
                    .Distinct()
                    .ToList();

                if (newComponentIds.Any())
                {
                    // Load active component types
                    var componentTypes = await _db.tOptionProjectComponentType
                        .AsNoTracking()
                        .Where(x =>
                            x.IsActive &&
                            newComponentIds.Contains(x.ComponentId))
                        .ToListAsync(cancellationToken);

                    // Check duplicate Component IDs in the request
                    var duplicateComponentIds = dto.ComponentCosts
                        .Where(x => x.Id == 0)
                        .GroupBy(x => x.ComponentId)
                        .Where(g => g.Count() > 1)
                        .Select(g => g.Key)
                        .ToList();

                    if (duplicateComponentIds.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Component Types",
                            Message = $"Duplicate component type(s) found: {string.Join(", ", duplicateComponentIds)}. Each component type may only be added once."
                        });
                    }

                    // Existing active components in the Project Revision
                    var ExistingComponent = await _db.tProjectComponentCost
                        .AsNoTracking()
                        .Where(x =>
                            x.ProjectRevisionFK == ProjectRevision.Id &&
                            !x.IsDeleted &&
                            newComponentIds.Contains(x.ComponentId))
                        .ToListAsync(cancellationToken);

                    HashSet<string> existingComponentIds = ExistingComponent
                        .Select(x => x.ComponentId)
                        .ToHashSet();

                    // Components being deleted in the same request
                    var deletedComponentIds = dto.ComponentCosts
                        .Where(x => x.Id != 0 && x.IsDeleted)
                        .Select(x => x.ComponentId)
                        .ToHashSet();

                    // Existing components that are not being deleted
                    var duplicateExistingComponentIds = existingComponentIds
                        .Where(id => !deletedComponentIds.Contains(id))
                        .ToList();

                    if (duplicateExistingComponentIds.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Component Types",
                            Message = $"The following component type(s) already exist in this Project Revision: {string.Join(", ", duplicateExistingComponentIds)}. Remove the existing component before adding it again."
                        });
                    }

                }
                #endregion

                #region Cost Per Year
                var costPerYearItems = dto.ComponentCostPerYear.ToList();

                if (costPerYearItems.Any())
                {
                    // Validate required fields
                    if (costPerYearItems.Any(x => x.Amount <= 0))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Cost Per Year Amount",
                            Message = "One or more Cost Per Year entries contain an invalid amount. Please review your entries and try again."
                        });
                    }

                    if (costPerYearItems.Any(x => x.Year <= 0))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Cost Per Year",
                            Message = "One or more Cost Per Year entries contain an invalid Year."
                        });
                    }

                    // Duplicate new entries in request (same component + year)
                    var duplicateCostPerYearRequest = costPerYearItems
                        .Where(x => x.Id == 0)
                        .GroupBy(x => new
                        {
                            x.ComponentId,
                            x.Year
                        })
                        .Where(g => g.Count() > 1)
                        .ToList();

                    if (duplicateCostPerYearRequest.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Cost Per Year",
                            Message = "Duplicate Cost Per Year entries were found for the same Year within a Component ID."
                        });
                    }

                    // Existing Component Cost IDs referenced by Cost Per Year entries
                    var existingCostPerYearComponentIds = costPerYearItems
                        .Where(x => x.ComponentCostFK > 0)
                        .Select(x => x.ComponentCostFK)
                        .Distinct()
                        .ToList();

                    if (existingCostPerYearComponentIds.Any())
                    {
                        var existingCostPerYearRecords = await _db.tProjectComponentCostPerYear
                            .AsNoTracking()
                            .Where(x =>
                                !x.IsDeleted &&
                                existingCostPerYearComponentIds.Contains(x.ComponentCostFK))
                            .ToListAsync(cancellationToken);

                        var deletedCostPerYearIds = costPerYearItems
                            .Where(x => x.Id > 0 && x.IsDeleted)
                            .Select(x => x.Id)
                            .ToHashSet();

                        var duplicateExistingCostPerYear = costPerYearItems
                            .Where(x => x.Id == 0 && x.ComponentCostFK > 0)
                            .Where(newItem =>
                                existingCostPerYearRecords.Any(existing =>
                                    existing.ComponentCostFK == newItem.ComponentCostFK &&
                                    existing.Year == newItem.Year &&
                                    !deletedCostPerYearIds.Contains(existing.Id)))
                            .ToList();

                        if (duplicateExistingCostPerYear.Any())
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Duplicate Cost Per Year",
                                Message = "One or more Cost Per Year entries already exist for the selected Component Cost and Year."
                            });
                        }
                    }
                }
                #endregion

                #region Major Work Item
                var workItems = dto.MajorItemOfWorks.ToList();

                if (workItems.Any())
                {
                    // Validate required fields
                    if (workItems.Any(x => x.YearOfWork <= 0))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Year of Work",
                            Message = "One or more Major Work Items contain an invalid Year of Work."
                        });
                    }

                    if (workItems.Any(x => x.WorkTypeFK <= 0))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Work Type",
                            Message = "One or more Major Work Items contain an invalid Work Type."
                        });
                    }

                    if (workItems.Any(x => string.IsNullOrWhiteSpace(x.InfraTypeFK)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Infrastructure Type",
                            Message = "One or more Major Work Items contain an invalid Infrastructure Type."
                        });
                    }

                    // Validate Work Type FK
                    var workTypeIds = workItems
                        .Select(x => x.WorkTypeFK)
                        .Distinct()
                        .ToList();

                    List<int> validWorkTypes = await _db.tOptionScopeOfWork
                    .AsNoTracking()
                    .Where(x => x.IsActive && workTypeIds.Contains(x.Enum))
                    .Select(x => x.Enum)
                    .ToListAsync(cancellationToken);



                    var invalidWorkTypes = workTypeIds
                        .Where(x => !validWorkTypes.Contains(x))
                        .ToList();

                    if (invalidWorkTypes.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Work Type",
                            Message = $"The following Work Type(s) are invalid or inactive: {string.Join(", ", invalidWorkTypes)}."
                        });
                    }

                    // Validate Infrastructure Types
                    var infraTypes = workItems
                        .Select(x => x.InfraTypeFK)
                        .Distinct()
                        .ToList();

                    var validInfraTypes = await _db.tOptionInfraType
                        .AsNoTracking()
                        .Where(x =>
                            x.IsActive &&
                            infraTypes.Contains(x.InfraCode))
                        .Select(x => x.InfraCode)
                        .ToListAsync(cancellationToken);

                    var invalidInfraTypes = infraTypes
                        .Where(x => !validInfraTypes.Contains(x))
                        .ToList();

                    if (invalidInfraTypes.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Infrastructure Type",
                            Message = $"The following Infrastructure Type(s) are invalid or inactive: {string.Join(", ", invalidInfraTypes)}."
                        });
                    }

                    // Duplicate new work items in request
                    var duplicateWorkItems = workItems
                        .Where(x => x.Id == 0)
                        .GroupBy(x => new
                        {
                            x.ComponentClientId,
                            x.YearOfWork,
                            x.WorkTypeFK,
                            x.InfraTypeFK
                        })
                        .Where(g => g.Count() > 1)
                        .ToList();

                    if (duplicateWorkItems.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Major Work Items",
                            Message = "Duplicate Major Work Items were found in the request."
                        });
                    }

                    // Existing Component Cost IDs
                    var existingComponentCostIds = workItems
                        .Where(x => x.ComponentCostFK > 0)
                        .Select(x => x.ComponentCostFK)
                        .Distinct()
                        .ToList();

                    if (existingComponentCostIds.Any())
                    {
                        var existingWorkItems = await _db.tProjectMajorWorkItem
                            .AsNoTracking()
                            .Where(x =>
                                !x.IsDeleted &&
                                existingComponentCostIds.Contains(x.ComponentCostFK))
                            .ToListAsync(cancellationToken);

                        var deletedIds = workItems
                            .Where(x => x.Id > 0 && x.IsDeleted)
                            .Select(x => x.Id)
                            .ToHashSet();

                        var duplicateExisting = workItems
                            .Where(x => x.Id == 0 && x.ComponentCostFK > 0)
                            .Where(newItem =>
                                existingWorkItems.Any(existing =>
                                    existing.ComponentCostFK == newItem.ComponentCostFK &&
                                    existing.YearOfWork == newItem.YearOfWork &&
                                    existing.WorkTypeFK == newItem.WorkTypeFK &&
                                    existing.InfraTypeFK == newItem.InfraTypeFK &&
                                    !deletedIds.Contains(existing.Id)))
                            .ToList();

                        if (duplicateExisting.Any())
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Duplicate Major Work Items",
                                Message = "One or more Major Work Items already exist for the selected Component Cost."
                            });
                        }
                    }
                }
                #endregion

                #region Major Work Location

                // Validate required fields
                if (dto.MajorItemLocations.Any(x => string.IsNullOrWhiteSpace(x.InfraId)))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Infrastructure Id",
                        Message = "One or more Major Work Locations do not have an Infrastructure Id selected."
                    });
                }

                if (dto.MajorItemLocations.Any(x => x.TargetUnitId <= 0))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Target Unit",
                        Message = "One or more Major Work Locations contain an invalid Target Unit."
                    });
                }

                if (dto.MajorItemLocations.Any(x => string.IsNullOrWhiteSpace(x.TargetUnit)))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Target Unit",
                        Message = "One or more Major Work Locations do not have a Target Unit selected."
                    });
                }

                if (dto.MajorItemLocations.Any(x => x.PhysicalTarget <= 0))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Physical Target",
                        Message = "One or more Major Work Locations contain an invalid Physical Target."
                    });
                }

                // Duplicate new locations in request
                var duplicates = dto.MajorItemLocations
                    .Where(x => !x.IsDeleted && !string.IsNullOrEmpty(x.StartStationLimit) && !string.IsNullOrEmpty(x.EndStationLimit) && x.Id == 0)
                    .Select((item, index) => new { Item = item, Index = index })
                    .GroupBy(x => new
                    {
                        DetailedScope = (x.Item.DetailedScope ?? string.Empty).Trim().ToUpperInvariant(),
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
                            WorkItemFK = x.Item.WorkItemFK,
                            WorkItemClientId = x.Item.WorkItemClientId,
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

                // Existing Major Work Item IDs referenced by locations
                var existingLocationWorkItemIds = dto.MajorItemLocations
                    .Where(x => x.WorkItemFK > 0)
                    .Select(x => x.WorkItemFK)
                    .Distinct()
                    .ToList();

                if (existingLocationWorkItemIds.Any())
                {
                    var existingLocations = await _db.tProjectMajorWorkLocations
                        .AsNoTracking()
                        .Where(x =>
                            !x.IsDeleted &&
                            existingLocationWorkItemIds.Contains(x.WorkItemFK))
                        .ToListAsync(cancellationToken);

                    var deletedLocationIds = dto.MajorItemLocations
                        .Where(x => x.Id > 0 && x.IsDeleted)
                        .Select(x => x.Id)
                        .ToHashSet();

                    var duplicateExistingLocations = dto.MajorItemLocations
                        .Where(x =>
                            x.Id == 0 &&
                            x.WorkItemFK > 0 &&
                            !string.IsNullOrEmpty(x.StartStationLimit) &&
                            !string.IsNullOrEmpty(x.EndStationLimit))
                        .Where(newItem =>
                            existingLocations.Any(existing =>
                                existing.WorkItemFK == newItem.WorkItemFK &&
                                string.Equals((existing.DetailedScope ?? string.Empty).Trim(), (newItem.DetailedScope ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase) &&
                                string.Equals((existing.StartStationLimit ?? string.Empty).Trim(), newItem.StartStationLimit!.Trim(), StringComparison.OrdinalIgnoreCase) &&
                                string.Equals((existing.EndStationLimit ?? string.Empty).Trim(), newItem.EndStationLimit!.Trim(), StringComparison.OrdinalIgnoreCase) &&
                                !deletedLocationIds.Contains(existing.Id)))
                        .ToList();

                    if (duplicateExistingLocations.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Major Work Locations",
                            Message = "One or more Major Work Locations already exist for the selected Major Work Item."
                        });
                    }
                }
                #endregion

                #endregion
                string TransactionReferenceId = $"{ProjectId}-{StageName}";
                
                #region Update Project Details
                var Project = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.Id == ProjectRevision.Id, cancellationToken) ?? new ProjectRevisions();


                if (ProjectRevision.MYId != dto.ProjectDetails?.MYId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "MYId",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.MYId!}",
                        OldValue = $"Stage: {StageName} Value: {ProjectRevision.MYId!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    ProjectRevision.MYId = dto.ProjectDetails!.MYId;
                }
                if (Project.AlternateId != dto.ProjectDetails?.AlternateId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "AlternateId",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.AlternateId!}",
                        OldValue = $"Stage: {StageName} Value: {Project.AlternateId!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.AlternateId = dto.ProjectDetails!.AlternateId;
                }
                if (Project.Tier != dto.ProjectDetails?.Tier)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Tier",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.Tier.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Tier.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Tier = dto.ProjectDetails!.Tier;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Category",
                        NewValue = $"Stage: {StageName} Value: {Category.CategoryName}",
                        OldValue = $"Stage: {StageName} Value: {OldCategory?.CategoryName}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Category = dto.ProjectDetails!.Category;
                }
                if (Project.Thrust != dto.ProjectDetails?.Thrust)
                {
                    var Thrust = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == dto.ProjectDetails!.Thrust);
                    if (Thrust == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Thrust '{dto.ProjectDetails!.Thrust}' is not valid.", Title = "Invalid Thrust" });
                    }
                    var OldThrust = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == Project.Thrust);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {StageName} Value: {Thrust.SubProgramName}",
                        OldValue = $"Stage: {StageName} Value: {OldThrust?.SubProgramName}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Thrust = dto.ProjectDetails!.Thrust;
                }
                if (Project.MYCAApprovalDate != dto.ProjectDetails?.MYCAApprovalDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "MYCAApprovalDate",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails!.MYCAApprovalDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project.MYCAApprovalDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.MYCAApprovalDate = dto.ProjectDetails!.MYCAApprovalDate;
                }
                if (Project.Description != dto.ProjectDetails?.Description)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Description",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails!.Description!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Description!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Description = dto.ProjectDetails!.Description;
                }
                if (Project.City != dto.ProjectDetails?.City)
                {
                    var City = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Code == dto.ProjectDetails!.City);
                    if (City == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected City '{dto.ProjectDetails!.City}' is not valid.", Title = "Invalid City" });
                    }
                    var OldCity = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Code == Project.City);
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "City",
                        NewValue = $"Stage: {StageName} Value: {City.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldCity?.Name}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.City = dto.ProjectDetails!.City;
                }
                if (Project.LegislativeDistrict != dto.ProjectDetails?.LegislativeDistrict)
                {
                    var LD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Code == dto.ProjectDetails!.LegislativeDistrict);
                    if (LD == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{dto.ProjectDetails!.LegislativeDistrict}' is not valid.", Title = "Invalid Legislative District" });
                    }
                    var OldLD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Code == Project.LegislativeDistrict);
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "LegislativeDistrict",
                        NewValue = $"Stage: {StageName} Value: {LD.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldLD?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.LegislativeDistrict = dto.ProjectDetails!.LegislativeDistrict;
                    hasUpdated = true;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementingOffice",
                        NewValue = $"Stage: {StageName} Value: {IO.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldIO?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementingOffice = dto.ProjectDetails!.ImplementingOffice;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "OperatingUnit",
                        NewValue = $"Stage: {StageName} Value: {OperatingUnit.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OperatingUnit?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.OperatingUnit = dto.ProjectDetails!.OperatingUnit;
                }
                if (Project.RegionWide != dto.ProjectDetails?.RegionWide)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RegionWide",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.RegionWide.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.RegionWide.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RegionWide = dto.ProjectDetails!.RegionWide;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {StageName} Value: {Origin.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldOrigin?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Origin = dto.ProjectDetails!.Origin;
                }
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Agency",
                        NewValue = $"Stage: {StageName} Value: {Agency.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldAgency?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Agency = dto.ProjectDetails!.Agency;
                }

                if (dto.ProjectDetails!.ImplementationMode == null || dto.ProjectDetails!.ImplementationMode == 0)
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementationMode",
                        NewValue = $"Stage: {StageName} Value: {ImplementationMode.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldImplementationMode?.Name!}",
                        CreatedBy = UserId,
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "EmergencyMode",
                        NewValue = $"Stage: {StageName} Value: {EmergencyMode.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldEmergencyMode?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.EmergencyMode = dto.ProjectDetails!.EmergencyMode;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RowAvailable",
                        NewValue = $"Stage: {StageName} Value: {RowAvailable.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldRowAvailable?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RowAvailable = dto.ProjectDetails!.RowAvailable;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Feasibility",
                        NewValue = $"Stage: {StageName} Value: {Feasib.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldFeasibility?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Feasibility = dto.ProjectDetails!.Feasibility;
                    Project.FeasibilityDate = (Project.Feasibility != 1) ? null : dto.ProjectDetails!.FeasibilityDate;
                }
                if (Project.FeasibilityDate != dto.ProjectDetails?.FeasibilityDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "FeasibilityDate",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project?.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.FeasibilityDate = (Project.Feasibility != 1) ? null : dto.ProjectDetails!.FeasibilityDate;
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
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesign",
                        NewValue = $"Stage: {StageName} Value: {DetailedDesign.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldDetailedDesign?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesign = dto.ProjectDetails!.DetailedDesign;
                    Project.DetailedDesignDate = (Project.DetailedDesign != 1) ? null : dto.ProjectDetails!.DetailedDesignDate;
                }
                if (Project.DetailedDesignDate != dto.ProjectDetails?.DetailedDesignDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesignDate",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project?.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesignDate = (Project.DetailedDesign != 1) ? null : dto.ProjectDetails!.DetailedDesignDate;
                }

                if (Project.Rank != dto.ProjectDetails?.Rank)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Rank",
                        NewValue = $"Stage: {StageName} Value: {dto.ProjectDetails?.Rank.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Rank.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Rank = dto.ProjectDetails!.Rank;
                }
                if (hasUpdated)
                {
                    _db.tProjectRevisions.Update(Project);
                }
                #endregion

                // ============================================================================
                // LOCAL HELPERS
                // ============================================================================

                void AddUpdateLog(
                    string table,
                    string column,
                    object? oldValue,
                    object? newValue)
                {
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = table,
                        AffectedColumn = column,
                        OldValue = oldValue?.ToString() ?? "",
                        NewValue = newValue?.ToString() ?? "",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                }


                // ============================================================================
                // SAFE SERIALIZATION FOR AUDIT / DELETE LOG
                // ============================================================================

                string SerializeEntityForAudit(object? entity)
                {
                    if (entity == null)
                        return "{}";

                    try
                    {
                        /*
                         * Serialize ONLY mapped EF scalar properties.
                         *
                         * This intentionally excludes navigation properties such as:
                         *
                         * ProjectComponentCostPerYear
                         *      -> ComponentCost
                         *          -> CostsPerYear
                         *              -> ProjectComponentCostPerYear
                         *
                         * which caused:
                         *
                         * Self referencing loop detected...
                         * Path 'ComponentCost.CostsPerYear'
                         */

                        var entry = _db.Entry(entity);

                        var values = entry.Properties
                            .ToDictionary(
                                property => property.Metadata.Name,
                                property => property.CurrentValue
                            );

                        return JsonConvert.SerializeObject(values);
                    }
                    catch
                    {
                        /*
                         * Defensive fallback in case the supplied object
                         * isn't recognized as an EF entity.
                         */
                        return JsonConvert.SerializeObject(
                            entity,
                            new JsonSerializerSettings
                            {
                                ReferenceLoopHandling =
                                    ReferenceLoopHandling.Ignore
                            });
                    }
                }


                // ============================================================================
                // DELETE LOG
                // ============================================================================

                void AddDeleteLog(
                    string table,
                    object existingEntity)
                {
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = TransactionReferenceId,
                        TransactionType = EnumTransactionType.Delete.ToString(),
                        AffectedTable = table,
                        AffectedColumn = "Row",
                        NewValue = "",

                        // IMPORTANT:
                        // Do NOT directly serialize existingEntity.
                        OldValue = SerializeEntityForAudit(existingEntity),

                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                }


                // ============================================================================
                // COMPONENT COST
                // ============================================================================

                var ComponentCost = await _db.tProjectComponentCost
                    .Where(x =>
                        x.ProjectRevisionFK == ProjectRevision.Id &&
                        !x.IsDeleted)
                    .ToListAsync(cancellationToken);


                var ExistingComponentCostIds = ComponentCost
                    .Select(x => x.Id)
                    .ToHashSet();


                // ============================================================================
                // UPDATE EXISTING COMPONENT COST
                // ============================================================================

                #region Update Component Cost

                var UpdateComponentCost = dto.ComponentCosts
                    .Where(x =>
                        x.Id > 0 &&
                        ExistingComponentCostIds.Contains(x.Id))
                    .ToList();


                foreach (var item in UpdateComponentCost)
                {
                    var ExistingItem = ComponentCost
                        .FirstOrDefault(x => x.Id == item.Id);


                    if (ExistingItem == null)
                        continue;


                    bool ComponentUpdate = false;


                    // ------------------------------------------------------------------------
                    // Component Type
                    // ------------------------------------------------------------------------

                    if (ExistingItem.ComponentType != item.ComponentType)
                    {
                        var Component = await _db.tOptionProjectComponentType
                            .AsNoTracking()
                            .FirstOrDefaultAsync(
                                x => x.ComponentName == item.ComponentType,
                                cancellationToken);


                        if (Component == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Component '{item.ComponentType}' is not valid.",

                                Title =
                                    "Invalid Component"
                            });
                        }


                        AddUpdateLog(
                            "tProjectComponentCost",
                            "ComponentType",
                            ExistingItem.ComponentType,
                            Component.ComponentName);


                        ExistingItem.ComponentType =
                            Component.ComponentName;


                        ComponentUpdate = true;
                    }


                    // ------------------------------------------------------------------------
                    // Component ID
                    // ------------------------------------------------------------------------

                    if (ExistingItem.ComponentId != item.ComponentId)
                    {
                        AddUpdateLog(
                            "tProjectComponentCost",
                            "ComponentId",
                            ExistingItem.ComponentId,
                            item.ComponentId);


                        ExistingItem.ComponentId =
                            item.ComponentId;


                        ComponentUpdate = true;
                    }


                    // ------------------------------------------------------------------------
                    // Description
                    // ------------------------------------------------------------------------

                    if (ExistingItem.Description != item.Description)
                    {
                        AddUpdateLog(
                            "tProjectComponentCost",
                            "Description",
                            ExistingItem.Description,
                            item.Description);


                        ExistingItem.Description =
                            item.Description ?? "";


                        ComponentUpdate = true;
                    }


                    // ------------------------------------------------------------------------
                    // Total
                    // ------------------------------------------------------------------------

                    if (ExistingItem.Total != item.Total)
                    {
                        AddUpdateLog(
                            "tProjectComponentCost",
                            "Total",
                            ExistingItem.Total,
                            item.Total);


                        ExistingItem.Total =
                            item.Total;


                        ComponentUpdate = true;
                    }


                    // ------------------------------------------------------------------------
                    // Delete
                    // ------------------------------------------------------------------------

                    if (!ExistingItem.IsDeleted &&
                        item.IsDeleted)
                    {
                        AddDeleteLog(
                            "tProjectComponentCost",
                            ExistingItem);


                        ExistingItem.IsDeleted =
                            true;


                        ComponentUpdate = true;
                    }


                    if (ComponentUpdate)
                    {
                        HasCostUpdate =
                            true;


                        ExistingItem.UpdatedBy =
                            UserId;


                        ExistingItem.UpdatedDate =
                            CurrentDate;
                    }
                }

                #endregion


                // ============================================================================
                // NEW COMPONENT COST
                // ============================================================================

                #region New Component Cost

                var NewComponentCostData = dto.ComponentCosts
                    .Where(x =>
                        x.Id == 0 &&
                        !x.IsDeleted)
                    .ToList();


                var NewCostToAdd =
                    new List<ProjectComponentCost>();


                foreach (var item in NewComponentCostData)
                {
                    if (string.IsNullOrWhiteSpace(item.ComponentId))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                "Component ID is required.",

                            Title =
                                "Invalid Component"
                        });
                    }


                    var ComponentType = await _db.tOptionProjectComponentType
                        .AsNoTracking()
                        .FirstOrDefaultAsync(
                            x => x.ComponentName == item.ComponentType,
                            cancellationToken);


                    if (ComponentType == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Selected Component '{item.ComponentType}' is not valid.",

                            Title =
                                "Invalid Component"
                        });
                    }


                    var NewComponent =
                        new ProjectComponentCost
                        {
                            ProjectRevisionFK =
                                ProjectRevision.Id,

                            ComponentId =
                                item.ComponentId,

                            ComponentType =
                                ComponentType.ComponentName,

                            Description =
                                item.Description,

                            Total =
                                item.Total,

                            CreatedBy =
                                UserId,

                            CreatedDate =
                                CurrentDate,

                            IsDeleted =
                                false
                        };


                    NewCostToAdd.Add(
                        NewComponent);
                }


                if (NewCostToAdd.Count > 0)
                {
                    HasCostUpdate =
                        true;


                    await _db.tProjectComponentCost
                        .AddRangeAsync(
                            NewCostToAdd,
                            cancellationToken);


                    // ------------------------------------------------------------------------
                    // Required:
                    //
                    // Cost Per Year and Major Work Item need the generated ComponentCost.Id.
                    // ------------------------------------------------------------------------

                    await _db.SaveChangesAsync(
                        cancellationToken);
                }

                #endregion


                // ============================================================================
                // ALL COMPONENTS
                // ============================================================================

                var AllComponents = ComponentCost
                    .Concat(NewCostToAdd)
                    .ToList();


                var ActiveComponents = AllComponents
                    .Where(x => !x.IsDeleted)
                    .ToList();


                var ActiveComponentCostIds = ActiveComponents
                    .Select(x => x.Id)
                    .ToHashSet();


                // ============================================================================
                // VALIDATE COMPONENT IDS
                // ============================================================================

                if (ActiveComponents.Any(
                    x => string.IsNullOrWhiteSpace(x.ComponentId)))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "One or more Components do not have a valid Component ID.",

                        Title =
                            "Invalid Component"
                    });
                }


                var DuplicateComponentIds = ActiveComponents
                    .GroupBy(
                        x => x.ComponentId,
                        StringComparer.OrdinalIgnoreCase)
                    .Where(x => x.Count() > 1)
                    .Select(x => x.Key)
                    .ToList();


                if (DuplicateComponentIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            $"Duplicate Component ID(s) found: " +
                            $"{string.Join(", ", DuplicateComponentIds)}.",

                        Title =
                            "Duplicate Component"
                    });
                }


                var ComponentById = ActiveComponents
                    .ToDictionary(
                        x => x.ComponentId,
                        x => x,
                        StringComparer.OrdinalIgnoreCase);


                // ============================================================================
                // COMPONENT COST PER YEAR - EXISTING
                // ============================================================================

                #region Update Component Cost Per Year

                /*
                 * Load using ORIGINAL component IDs so records underneath a Component
                 * being deleted in this same request can still be processed correctly.
                 */

                var ComponentCostYear =
                    await _db.tProjectComponentCostPerYear
                        .Where(x =>
                            ExistingComponentCostIds.Contains(x.ComponentCostFK) &&
                            !x.IsDeleted)
                        .ToListAsync(cancellationToken);


                var ExistingComponentCostYearIds = ComponentCostYear
                    .Select(x => x.Id)
                    .ToHashSet();


                // ============================================================================
                // VALIDATE COST PER YEAR OWNERSHIP
                // ============================================================================

                var InvalidCostYearIds = dto.ComponentCostPerYear
                    .Where(x =>
                        x.Id > 0 &&
                        !ExistingComponentCostYearIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToList();


                if (InvalidCostYearIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "One or more Component Cost Per Year records " +
                            "do not belong to the selected Project.",

                        Title =
                            "Invalid Component Cost Per Year"
                    });
                }


                // ============================================================================
                // UPDATE COST PER YEAR
                // ============================================================================

                foreach (var Year in ComponentCostYear)
                {
                    var CostYearToBeUpdated =
                        dto.ComponentCostPerYear
                            .FirstOrDefault(x => x.Id == Year.Id);


                    if (CostYearToBeUpdated == null)
                        continue;


                    bool ComponentYearUpdate =
                        false;


                    // ------------------------------------------------------------------------
                    // Sync ComponentId with parent
                    // ------------------------------------------------------------------------

                    var ParentComponent = AllComponents
                        .FirstOrDefault(x =>
                            x.Id == Year.ComponentCostFK);


                    if (ParentComponent != null &&
                        Year.ComponentId != ParentComponent.ComponentId)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "ComponentId",
                            Year.ComponentId,
                            ParentComponent.ComponentId);


                        Year.ComponentId =
                            ParentComponent.ComponentId;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Amount
                    // ------------------------------------------------------------------------

                    if (Year.Amount != CostYearToBeUpdated.Amount)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "Amount",
                            Year.Amount,
                            CostYearToBeUpdated.Amount);


                        Year.Amount =
                            CostYearToBeUpdated.Amount;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Year
                    // ------------------------------------------------------------------------

                    if (Year.Year != CostYearToBeUpdated.Year)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "Year",
                            Year.Year,
                            CostYearToBeUpdated.Year);


                        Year.Year =
                            CostYearToBeUpdated.Year;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // UACS
                    // ------------------------------------------------------------------------

                    if (Year.UACS != CostYearToBeUpdated.UACS)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "UACS",
                            Year.UACS,
                            CostYearToBeUpdated.UACS);


                        Year.UACS =
                            CostYearToBeUpdated.UACS;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Start Date
                    // ------------------------------------------------------------------------

                    if (Year.StartDate !=
                        CostYearToBeUpdated.StartDate)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "StartDate",

                            Year.StartDate?
                                .ToString("MM/dd/yyyy"),

                            CostYearToBeUpdated.StartDate?
                                .ToString("MM/dd/yyyy"));


                        Year.StartDate =
                            CostYearToBeUpdated.StartDate;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // End Date
                    // ------------------------------------------------------------------------

                    if (Year.EndDate !=
                        CostYearToBeUpdated.EndDate)
                    {
                        AddUpdateLog(
                            "tProjectComponentCostPerYear",
                            "EndDate",

                            Year.EndDate?
                                .ToString("MM/dd/yyyy"),

                            CostYearToBeUpdated.EndDate?
                                .ToString("MM/dd/yyyy"));


                        Year.EndDate =
                            CostYearToBeUpdated.EndDate;


                        ComponentYearUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Delete
                    // ------------------------------------------------------------------------

                    if (Year.IsDeleted !=
                        CostYearToBeUpdated.IsDeleted)
                    {
                        if (CostYearToBeUpdated.IsDeleted)
                        {
                            /*
                             * This now safely logs scalar properties only.
                             *
                             * ComponentCost navigation property is NOT serialized,
                             * therefore ComponentCost.CostsPerYear cannot create
                             * a self-referencing loop.
                             */

                            AddDeleteLog(
                                "tProjectComponentCostPerYear",
                                Year);
                        }


                        Year.IsDeleted =
                            CostYearToBeUpdated.IsDeleted;


                        ComponentYearUpdate =
                            true;
                    }


                    if (ComponentYearUpdate)
                    {
                        HasCostUpdate =
                            true;


                        Year.UpdatedBy =
                            UserId;


                        Year.UpdatedDate =
                            CurrentDate;
                    }
                }

                #endregion


                // ============================================================================
                // NEW COMPONENT COST PER YEAR
                // ============================================================================

                #region New Component Cost Per Year

                var NewComponentCostYearData =
                    dto.ComponentCostPerYear
                        .Where(x =>
                            x.Id == 0 &&
                            !x.IsDeleted)
                        .ToList();


                var NewCostYearToAdd =
                    new List<ProjectComponentCostPerYear>();


                foreach (var year in NewComponentCostYearData)
                {
                    ProjectComponentCost? ParentComponent =
                        null;


                    // ------------------------------------------------------------------------
                    // Existing component: use real FK first.
                    // ------------------------------------------------------------------------

                    if (year.ComponentCostFK > 0)
                    {
                        ParentComponent = ActiveComponents
                            .FirstOrDefault(x =>
                                x.Id == year.ComponentCostFK);
                    }


                    // ------------------------------------------------------------------------
                    // Newly-created component: resolve using ComponentId.
                    // ------------------------------------------------------------------------

                    if (ParentComponent == null &&
                        !string.IsNullOrWhiteSpace(year.ComponentId))
                    {
                        ComponentById.TryGetValue(
                            year.ComponentId,
                            out ParentComponent);
                    }


                    if (ParentComponent == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Unable to locate Component " +
                                $"'{year.ComponentId}' for Cost Per Year.",

                            Title =
                                "Invalid Component"
                        });
                    }


                    NewCostYearToAdd.Add(
                        new ProjectComponentCostPerYear
                        {
                            ComponentCostFK =
                                ParentComponent.Id,

                            ComponentId =
                                ParentComponent.ComponentId,

                            Amount =
                                year.Amount,

                            Year =
                                year.Year,

                            UACS =
                                year.UACS,

                            StartDate =
                                year.StartDate,

                            EndDate =
                                year.EndDate,

                            CreatedBy =
                                UserId,

                            CreatedDate =
                                CurrentDate,

                            IsDeleted =
                                false
                        });
                }


                if (NewCostYearToAdd.Count > 0)
                {
                    HasCostUpdate =
                        true;


                    await _db.tProjectComponentCostPerYear
                        .AddRangeAsync(
                            NewCostYearToAdd,
                            cancellationToken);
                }

                #endregion


                // ============================================================================
                // MAJOR ITEM OF WORKS - EXISTING
                // ============================================================================

                var MajorItemOfWorks =
                    await _db.tProjectMajorWorkItem
                        .Where(x =>
                            ExistingComponentCostIds.Contains(x.ComponentCostFK) &&
                            !x.IsDeleted)
                        .ToListAsync(cancellationToken);


                var ExistingWorkItemIds = MajorItemOfWorks
                    .Select(x => x.Id)
                    .ToHashSet();


                // ============================================================================
                // VALIDATE EXISTING WORK ITEM OWNERSHIP
                // ============================================================================

                var InvalidWorkItemIds = dto.MajorItemOfWorks
                    .Where(x =>
                        x.Id > 0 &&
                        !ExistingWorkItemIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToList();


                if (InvalidWorkItemIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "One or more Major Item of Works do not belong " +
                            "to the selected Project.",

                        Title =
                            "Invalid Major Item of Work"
                    });
                }


                // ============================================================================
                // UPDATE MAJOR ITEM OF WORKS
                // ============================================================================

                #region Update Major Item of Works

                var UpdateMajorItems = dto.MajorItemOfWorks
                    .Where(x =>
                        x.Id > 0 &&
                        ExistingWorkItemIds.Contains(x.Id))
                    .ToList();


                foreach (var item in UpdateMajorItems)
                {
                    var ExistingItem = MajorItemOfWorks
                        .FirstOrDefault(x =>
                            x.Id == item.Id);


                    if (ExistingItem == null)
                        continue;


                    bool hasUpdate =
                        false;


                    // ------------------------------------------------------------------------
                    // Synchronize ComponentId with actual Component parent
                    // ------------------------------------------------------------------------

                    var ParentComponent = AllComponents
                        .FirstOrDefault(x =>
                            x.Id == ExistingItem.ComponentCostFK);


                    if (ParentComponent != null &&
                        ExistingItem.ComponentId !=
                        ParentComponent.ComponentId)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkItem",
                            "ComponentId",
                            ExistingItem.ComponentId,
                            ParentComponent.ComponentId);


                        ExistingItem.ComponentId =
                            ParentComponent.ComponentId;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Year of Work
                    // ------------------------------------------------------------------------

                    if (ExistingItem.YearOfWork !=
                        item.YearOfWork)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkItem",
                            "YearOfWork",
                            ExistingItem.YearOfWork,
                            item.YearOfWork);


                        ExistingItem.YearOfWork =
                            item.YearOfWork;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Work Type
                    // ------------------------------------------------------------------------

                    if (ExistingItem.WorkTypeFK !=
                        item.WorkTypeFK)
                    {
                        var NewWorkType =
                            await _db.tOptionScopeOfWork
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Enum == item.WorkTypeFK,
                                    cancellationToken);


                        if (NewWorkType == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Work Type '{item.WorkTypeFK}' is not valid.",

                                Title =
                                    "Invalid Work Type"
                            });
                        }


                        var OldWorkType =
                            await _db.tOptionScopeOfWork
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Enum == ExistingItem.WorkTypeFK,
                                    cancellationToken);


                        AddUpdateLog(
                            "tProjectMajorWorkItem",
                            "WorkTypeFK",

                            OldWorkType?.Description ??
                            ExistingItem.WorkTypeFK.ToString(),

                            NewWorkType.Description);


                        ExistingItem.WorkTypeFK =
                            item.WorkTypeFK;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Infrastructure Type
                    // ------------------------------------------------------------------------

                    if (ExistingItem.InfraTypeFK !=
                        item.InfraTypeFK)
                    {
                        var Infra =
                            await _db.tOptionInfraType
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.InfraCode == item.InfraTypeFK,
                                    cancellationToken);


                        if (Infra == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Infrastructure Type " +
                                    $"'{item.InfraTypeFK}' is not valid.",

                                Title =
                                    "Invalid Infrastructure Type"
                            });
                        }


                        AddUpdateLog(
                            "tProjectMajorWorkItem",
                            "InfraTypeFK",
                            ExistingItem.InfraTypeFK,
                            Infra.InfraName);


                        ExistingItem.InfraTypeFK =
                            item.InfraTypeFK;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Delete
                    // ------------------------------------------------------------------------

                    if (!ExistingItem.IsDeleted &&
                        item.IsDeleted)
                    {
                        AddDeleteLog(
                            "tProjectMajorWorkItem",
                            ExistingItem);


                        ExistingItem.IsDeleted =
                            true;


                        hasUpdate =
                            true;
                    }


                    if (hasUpdate)
                    {
                        ExistingItem.UpdatedBy =
                            UserId;


                        ExistingItem.UpdatedDate =
                            CurrentDate;
                    }
                }

                #endregion


                // ============================================================================
                // NEW MAJOR ITEM OF WORKS
                //
                // Handles:
                // - new work items under existing Components
                // - new work items under newly-created Components
                // ============================================================================

                #region New Major Item of Works

                var NewMajorItemData = dto.MajorItemOfWorks
                    .Where(x =>
                        x.Id == 0 &&
                        !x.IsDeleted)
                    .ToList();


                // ============================================================================
                // IMPORTANT NO-CLIENT-ID VALIDATION
                // ============================================================================

                var NewLocationComponentIdsWithoutWorkItemFK =
                    dto.MajorItemLocations
                        .Where(x =>
                            x.Id == 0 &&
                            !x.IsDeleted &&
                            x.WorkItemFK == 0)
                        .Select(x => x.ComponentId)
                        .ToHashSet();


                var AmbiguousNewWorkItems =
                    NewMajorItemData
                        .GroupBy(x => x.ComponentId)
                        .Where(x =>
                            x.Count() > 1 &&
                            NewLocationComponentIdsWithoutWorkItemFK.Contains(x.Key))
                        .Select(x => x.Key)
                        .ToList();


                if (AmbiguousNewWorkItems.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            $"Unable to determine the Major Item of Work for new " +
                            $"Location(s). Multiple new Work Items exist for Component(s): " +
                            $"{string.Join(", ", AmbiguousNewWorkItems)}.",

                        Title =
                            "Ambiguous Major Item of Work"
                    });
                }


                var NewMajorWorkItems =
                    new List<ProjectMajorWorkItem>();


                foreach (var item in NewMajorItemData)
                {
                    if (string.IsNullOrWhiteSpace(item.ComponentId))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                "Component ID is required for a new Major Item of Work.",

                            Title =
                                "Invalid Major Item of Work"
                        });
                    }


                    if (!ComponentById.TryGetValue(
                        item.ComponentId,
                        out var ParentComponent))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Unable to locate Component '{item.ComponentId}' " +
                                $"for the new Major Item of Work.",

                            Title =
                                "Invalid Component"
                        });
                    }


                    // ------------------------------------------------------------------------
                    // Validate Work Type
                    // ------------------------------------------------------------------------

                    var WorkType =
                        await _db.tOptionScopeOfWork
                            .AsNoTracking()
                            .FirstOrDefaultAsync(
                                x => x.Enum == item.WorkTypeFK,
                                cancellationToken);


                    if (WorkType == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Selected Work Type '{item.WorkTypeFK}' is not valid.",

                            Title =
                                "Invalid Work Type"
                        });
                    }


                    // ------------------------------------------------------------------------
                    // Validate Infrastructure Type
                    // ------------------------------------------------------------------------

                    var Infra =
                        await _db.tOptionInfraType
                            .AsNoTracking()
                            .FirstOrDefaultAsync(
                                x => x.InfraCode == item.InfraTypeFK,
                                cancellationToken);


                    if (Infra == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Selected Infrastructure Type " +
                                $"'{item.InfraTypeFK}' is not valid.",

                            Title =
                                "Invalid Infrastructure Type"
                        });
                    }


                    NewMajorWorkItems.Add(
                        new ProjectMajorWorkItem
                        {
                            ComponentCostFK =
                                ParentComponent.Id,

                            ComponentId =
                                ParentComponent.ComponentId,

                            YearOfWork =
                                item.YearOfWork,

                            WorkTypeFK =
                                item.WorkTypeFK,

                            InfraTypeFK =
                                item.InfraTypeFK,

                            CreatedBy =
                                UserId,

                            CreatedDate =
                                CurrentDate,

                            IsDeleted =
                                false
                        });
                }


                if (NewMajorWorkItems.Count > 0)
                {
                    await _db.tProjectMajorWorkItem
                        .AddRangeAsync(
                            NewMajorWorkItems,
                            cancellationToken);


                    // Locations need generated ProjectMajorWorkItem.Id.
                    await _db.SaveChangesAsync(
                        cancellationToken);
                }

                #endregion


                // ============================================================================
                // ACTIVE WORK ITEMS
                // ============================================================================

                var ActiveExistingWorkItems =
                    MajorItemOfWorks
                        .Where(x => !x.IsDeleted)
                        .ToList();


                var AllActiveWorkItems =
                    ActiveExistingWorkItems
                        .Concat(NewMajorWorkItems)
                        .ToList();


                var ActiveWorkItemIds =
                    AllActiveWorkItems
                        .Select(x => x.Id)
                        .ToHashSet();


                var ActiveWorkItemById =
                    AllActiveWorkItems
                        .ToDictionary(
                            x => x.Id,
                            x => x);


                // ============================================================================
                // NEW WORK ITEM LOOKUP BY COMPONENT ID
                // ============================================================================

                var NewWorkItemByComponentId =
                    NewMajorWorkItems
                        .GroupBy(x => x.ComponentId)
                        .Where(x => x.Count() == 1)
                        .ToDictionary(
                            x => x.Key,
                            x => x.Single(),
                            StringComparer.OrdinalIgnoreCase);


                // ============================================================================
                // EXISTING MAJOR WORK LOCATIONS
                // ============================================================================

                var MajorWorkLocations =
                    await _db.tProjectMajorWorkLocations
                        .Where(x =>
                            ExistingWorkItemIds.Contains(x.WorkItemFK) &&
                            !x.IsDeleted)
                        .ToListAsync(cancellationToken);


                var ExistingLocationIds =
                    MajorWorkLocations
                        .Select(x => x.Id)
                        .ToHashSet();


                // ============================================================================
                // VALIDATE EXISTING LOCATION OWNERSHIP
                // ============================================================================

                var InvalidLocationIds =
                    dto.MajorItemLocations
                        .Where(x =>
                            x.Id > 0 &&
                            !ExistingLocationIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToList();


                if (InvalidLocationIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "One or more Major Work Locations do not belong " +
                            "to the selected Project.",

                        Title =
                            "Invalid Major Work Location"
                    });
                }


                // ============================================================================
                // UPDATE MAJOR WORK LOCATIONS
                // ============================================================================

                #region Update Major Work Locations

                var UpdateMajorLocations =
                    dto.MajorItemLocations
                        .Where(x =>
                            x.Id > 0 &&
                            ExistingLocationIds.Contains(x.Id))
                        .ToList();


                foreach (var item in UpdateMajorLocations)
                {
                    var ExistingItem =
                        MajorWorkLocations
                            .FirstOrDefault(x =>
                                x.Id == item.Id);


                    if (ExistingItem == null)
                        continue;


                    bool hasUpdate =
                        false;


                    // ------------------------------------------------------------------------
                    // Sync ComponentId from WorkItem
                    // ------------------------------------------------------------------------

                    var ParentWorkItem =
                        MajorItemOfWorks
                            .FirstOrDefault(x =>
                                x.Id == ExistingItem.WorkItemFK);


                    if (ParentWorkItem != null &&
                        ExistingItem.ComponentId !=
                        ParentWorkItem.ComponentId)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "ComponentId",
                            ExistingItem.ComponentId,
                            ParentWorkItem.ComponentId);


                        ExistingItem.ComponentId =
                            ParentWorkItem.ComponentId;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // InfraId
                    // ------------------------------------------------------------------------

                    if (ExistingItem.InfraId != item.InfraId)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "InfraId",
                            ExistingItem.InfraId,
                            item.InfraId);


                        ExistingItem.InfraId =
                            item.InfraId;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // DetailedScope
                    // ------------------------------------------------------------------------

                    if (ExistingItem.DetailedScope != item.DetailedScope)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "DetailedScope",
                            ExistingItem.DetailedScope,
                            item.DetailedScope);


                        ExistingItem.DetailedScope =
                            item.DetailedScope;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // TargetUnitId
                    // ------------------------------------------------------------------------

                    if (ExistingItem.TargetUnitId != item.TargetUnitId)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "TargetUnitId",
                            ExistingItem.TargetUnitId,
                            item.TargetUnitId);


                        ExistingItem.TargetUnitId =
                            item.TargetUnitId;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // TargetUnit
                    // ------------------------------------------------------------------------

                    if (ExistingItem.TargetUnit != item.TargetUnit)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "TargetUnit",
                            ExistingItem.TargetUnit,
                            item.TargetUnit);


                        ExistingItem.TargetUnit =
                            item.TargetUnit;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // StartX
                    // ------------------------------------------------------------------------

                    if (ExistingItem.StartX != item.StartX)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "StartX",
                            ExistingItem.StartX,
                            item.StartX);


                        ExistingItem.StartX =
                            item.StartX;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // StartY
                    // ------------------------------------------------------------------------

                    if (ExistingItem.StartY != item.StartY)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "StartY",
                            ExistingItem.StartY,
                            item.StartY);


                        ExistingItem.StartY =
                            item.StartY;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // EndX
                    // ------------------------------------------------------------------------

                    if (ExistingItem.EndX != item.EndX)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "EndX",
                            ExistingItem.EndX,
                            item.EndX);


                        ExistingItem.EndX =
                            item.EndX;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // EndY
                    // ------------------------------------------------------------------------

                    if (ExistingItem.EndY != item.EndY)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "EndY",
                            ExistingItem.EndY,
                            item.EndY);


                        ExistingItem.EndY =
                            item.EndY;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // PhysicalTarget
                    // ------------------------------------------------------------------------

                    if (ExistingItem.PhysicalTarget != item.PhysicalTarget)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "PhysicalTarget",
                            ExistingItem.PhysicalTarget,
                            item.PhysicalTarget);


                        ExistingItem.PhysicalTarget =
                            item.PhysicalTarget;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // StartStationLimit
                    // ------------------------------------------------------------------------

                    if (ExistingItem.StartStationLimit !=
                        item.StartStationLimit)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "StartStationLimit",
                            ExistingItem.StartStationLimit,
                            item.StartStationLimit);


                        ExistingItem.StartStationLimit =
                            item.StartStationLimit;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // EndStationLimit
                    // ------------------------------------------------------------------------

                    if (ExistingItem.EndStationLimit !=
                        item.EndStationLimit)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "EndStationLimit",
                            ExistingItem.EndStationLimit,
                            item.EndStationLimit);


                        ExistingItem.EndStationLimit =
                            item.EndStationLimit;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // StartChainage
                    // ------------------------------------------------------------------------

                    if (ExistingItem.StartChainage != item.StartChainage)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "StartChainage",
                            ExistingItem.StartChainage,
                            item.StartChainage);


                        ExistingItem.StartChainage =
                            item.StartChainage;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // EndChainage
                    // ------------------------------------------------------------------------

                    if (ExistingItem.EndChainage != item.EndChainage)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "EndChainage",
                            ExistingItem.EndChainage,
                            item.EndChainage);


                        ExistingItem.EndChainage =
                            item.EndChainage;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Length
                    // ------------------------------------------------------------------------

                    if (ExistingItem.Length != item.Length)
                    {
                        AddUpdateLog(
                            "tProjectMajorWorkLocations",
                            "Length",
                            ExistingItem.Length,
                            item.Length);


                        ExistingItem.Length =
                            item.Length;


                        hasUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Delete
                    // ------------------------------------------------------------------------

                    if (ExistingItem.IsDeleted != item.IsDeleted)
                    {
                        if (item.IsDeleted)
                        {
                            AddDeleteLog(
                                "tProjectMajorWorkLocations",
                                ExistingItem);
                        }


                        ExistingItem.IsDeleted =
                            item.IsDeleted;


                        hasUpdate =
                            true;
                    }


                    if (hasUpdate)
                    {
                        ExistingItem.UpdatedBy =
                            UserId;


                        ExistingItem.UpdatedDate =
                            CurrentDate;
                    }
                }

                #endregion


                // ============================================================================
                // NEW MAJOR WORK LOCATIONS
                // ============================================================================

                #region New Major Work Locations

                var NewMajorWorkLocationData =
                    dto.MajorItemLocations
                        .Where(x =>
                            x.Id == 0 &&
                            !x.IsDeleted)
                        .ToList();


                var NewMajorWorkLocations =
                    new List<ProjectMajorWorkLocations>();


                foreach (var item in NewMajorWorkLocationData)
                {
                    ProjectMajorWorkItem? ParentWorkItem =
                        null;


                    // ------------------------------------------------------------------------
                    // Existing Work Item
                    // ------------------------------------------------------------------------

                    if (item.WorkItemFK > 0)
                    {
                        ActiveWorkItemById.TryGetValue(
                            item.WorkItemFK,
                            out ParentWorkItem);
                    }


                    // ------------------------------------------------------------------------
                    // New Work Item
                    // ------------------------------------------------------------------------

                    if (ParentWorkItem == null &&
                        item.WorkItemFK == 0 &&
                        !string.IsNullOrWhiteSpace(item.ComponentId))
                    {
                        NewWorkItemByComponentId.TryGetValue(
                            item.ComponentId,
                            out ParentWorkItem);
                    }


                    if (ParentWorkItem == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message =
                                $"Unable to determine the Major Item of Work " +
                                $"for Location under Component '{item.ComponentId}'.",

                            Title =
                                "Invalid Major Work Location"
                        });
                    }


                    NewMajorWorkLocations.Add(
                        new ProjectMajorWorkLocations
                        {
                            WorkItemFK =
                                ParentWorkItem.Id,

                            ComponentId =
                                ParentWorkItem.ComponentId,

                            InfraId =
                                item.InfraId,

                            DetailedScope =
                                item.DetailedScope,

                            TargetUnitId =
                                item.TargetUnitId,

                            TargetUnit =
                                item.TargetUnit,

                            StartX =
                                item.StartX,

                            StartY =
                                item.StartY,

                            EndX =
                                item.EndX,

                            EndY =
                                item.EndY,

                            PhysicalTarget =
                                item.PhysicalTarget,

                            StartStationLimit =
                                item.StartStationLimit,

                            EndStationLimit =
                                item.EndStationLimit,

                            StartChainage =
                                item.StartChainage,

                            EndChainage =
                                item.EndChainage,

                            Length =
                                item.Length,

                            CreatedBy =
                                UserId,

                            CreatedDate =
                                CurrentDate,

                            IsDeleted =
                                false
                        });
                }


                if (NewMajorWorkLocations.Count > 0)
                {
                    await _db.tProjectMajorWorkLocations
                        .AddRangeAsync(
                            NewMajorWorkLocations,
                            cancellationToken);
                }

                #endregion


                // ============================================================================
                // FUNDING PROFILE
                // ============================================================================

                #region Update / Delete / New Funding Profile

                var CurrentFunding =
                    await _db.tProjectFundingProfile
                        .Where(x =>
                            x.ProjectRevisionFK == ProjectRevision.Id &&
                            !x.IsDeleted)
                        .ToListAsync(cancellationToken);


                var CurrentFundingIds =
                    CurrentFunding
                        .Select(x => x.Id)
                        .ToHashSet();


                var SubmittedExistingFundingIds =
                    dto.FundingProfile
                        .Where(x => x.Id > 0)
                        .Select(x => x.Id)
                        .ToHashSet();


                // ============================================================================
                // VALIDATE FUNDING OWNERSHIP
                // ============================================================================

                var InvalidFundingIds =
                    SubmittedExistingFundingIds
                        .Where(x =>
                            !CurrentFundingIds.Contains(x))
                        .ToList();


                if (InvalidFundingIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "One or more Funding Profile records do not belong " +
                            "to the selected Project.",

                        Title =
                            "Invalid Funding Profile"
                    });
                }


                // ============================================================================
                // FUNDING REMOVED FROM DTO
                // ============================================================================

                var FundingRemovedFromRequest =
                    CurrentFunding
                        .Where(x =>
                            !SubmittedExistingFundingIds.Contains(x.Id))
                        .ToList();


                foreach (var ExistingItem in FundingRemovedFromRequest)
                {
                    AddDeleteLog(
                        "tProjectFundingProfile",
                        ExistingItem);


                    ExistingItem.IsDeleted =
                        true;


                    ExistingItem.UpdatedBy =
                        UserId;


                    ExistingItem.UpdatedDate =
                        CurrentDate;


                    HasCostUpdate =
                        true;
                }


                // ============================================================================
                // UPDATE EXISTING FUNDING
                // ============================================================================

                var UpdateFunding =
                    dto.FundingProfile
                        .Where(x =>
                            x.Id > 0 &&
                            CurrentFundingIds.Contains(x.Id))
                        .ToList();


                foreach (var item in UpdateFunding)
                {
                    var ExistingItem =
                        CurrentFunding
                            .FirstOrDefault(x =>
                                x.Id == item.Id);


                    if (ExistingItem == null)
                        continue;


                    bool FundingUpdate =
                        false;


                    // ------------------------------------------------------------------------
                    // Funding Source
                    // ------------------------------------------------------------------------

                    if (ExistingItem.SourceOrg != item.SourceOrg)
                    {
                        var CurrentSource =
                            await _db.tOptionFundingSource
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Organization == ExistingItem.SourceOrg,
                                    cancellationToken);


                        var NewSource =
                            await _db.tOptionFundingSource
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Organization == item.SourceOrg,
                                    cancellationToken);


                        if (NewSource == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Funding Source '{item.SourceOrg}' is not valid.",

                                Title =
                                    "Invalid Funding Source"
                            });
                        }


                        AddUpdateLog(
                            "tProjectFundingProfile",
                            "Source",
                            CurrentSource?.Name ?? ExistingItem.SourceOrg,
                            NewSource.Name);


                        ExistingItem.SourceOrg =
                            item.SourceOrg;


                        FundingUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Agreement
                    // ------------------------------------------------------------------------

                    if (ExistingItem.AgreementCode !=
                        item.AgreementCode)
                    {
                        var CurrentAgreement =
                            await _db.tOptionFundingAgreement
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Code == ExistingItem.AgreementCode,
                                    cancellationToken);


                        var NewAgreement =
                            await _db.tOptionFundingAgreement
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Code == item.AgreementCode,
                                    cancellationToken);


                        if (NewAgreement == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Funding Agreement " +
                                    $"'{item.AgreementCode}' is not valid.",

                                Title =
                                    "Invalid Funding Agreement"
                            });
                        }


                        AddUpdateLog(
                            "tProjectFundingProfile",
                            "Agreement",
                            CurrentAgreement?.Name ?? ExistingItem.AgreementCode,
                            NewAgreement.Name);


                        ExistingItem.AgreementCode =
                            item.AgreementCode;


                        FundingUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Amount
                    // ------------------------------------------------------------------------

                    if (ExistingItem.Amount != item.Amount)
                    {
                        AddUpdateLog(
                            "tProjectFundingProfile",
                            "Amount",
                            ExistingItem.Amount,
                            item.Amount);


                        ExistingItem.Amount =
                            item.Amount;


                        FundingUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Percentage
                    // ------------------------------------------------------------------------

                    if (ExistingItem.Percentage != item.Percentage)
                    {
                        AddUpdateLog(
                            "tProjectFundingProfile",
                            "Percentage",
                            ExistingItem.Percentage,
                            item.Percentage);


                        ExistingItem.Percentage =
                            item.Percentage;


                        FundingUpdate =
                            true;
                    }


                    // ------------------------------------------------------------------------
                    // Explicit Delete
                    // ------------------------------------------------------------------------

                    if (!ExistingItem.IsDeleted &&
                        item.IsDeleted)
                    {
                        AddDeleteLog(
                            "tProjectFundingProfile",
                            ExistingItem);


                        ExistingItem.IsDeleted =
                            true;


                        FundingUpdate =
                            true;
                    }


                    if (FundingUpdate)
                    {
                        HasCostUpdate =
                            true;


                        ExistingItem.UpdatedBy =
                            UserId;


                        ExistingItem.UpdatedDate =
                            CurrentDate;
                    }
                }


                // ============================================================================
                // NEW FUNDING PROFILE
                // ============================================================================

                var NewFunding =
                    dto.FundingProfile
                        .Where(x =>
                            x.Id == 0 &&
                            !x.IsDeleted)
                        .ToList();


                if (NewFunding.Count > 0)
                {
                    var FundingToAdd =
                        new List<ProjectFundingProfile>();


                    foreach (var item in NewFunding)
                    {
                        // --------------------------------------------------------------------
                        // Validate Funding Source
                        // --------------------------------------------------------------------

                        var FundingSource =
                            await _db.tOptionFundingSource
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Organization == item.SourceOrg,
                                    cancellationToken);


                        if (FundingSource == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Funding Source '{item.SourceOrg}' is not valid.",

                                Title =
                                    "Invalid Funding Source"
                            });
                        }


                        // --------------------------------------------------------------------
                        // Validate Funding Agreement
                        // --------------------------------------------------------------------

                        var FundingAgreement =
                            await _db.tOptionFundingAgreement
                                .AsNoTracking()
                                .FirstOrDefaultAsync(
                                    x => x.Code == item.AgreementCode,
                                    cancellationToken);


                        if (FundingAgreement == null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message =
                                    $"Selected Funding Agreement " +
                                    $"'{item.AgreementCode}' is not valid.",

                                Title =
                                    "Invalid Funding Agreement"
                            });
                        }


                        FundingToAdd.Add(
                            new ProjectFundingProfile
                            {
                                ProjectRevisionFK =
                                    ProjectRevision.Id,

                                SourceOrg =
                                    item.SourceOrg,

                                AgreementCode =
                                    item.AgreementCode,

                                Amount =
                                    item.Amount,

                                Percentage =
                                    item.Percentage,

                                IsWalletDraw =
                                    false,

                                CreatedBy =
                                    UserId,

                                CreatedDate =
                                    CurrentDate,

                                IsDeleted =
                                    false
                            });
                    }


                    if (FundingToAdd.Count > 0)
                    {
                        HasCostUpdate =
                            true;


                        await _db.tProjectFundingProfile
                            .AddRangeAsync(
                                FundingToAdd,
                                cancellationToken);
                    }
                }

                #endregion


                // ============================================================================
                // TRANSACTION LOG
                // ============================================================================

                if (transactionLogs.Count > 0)
                {
                    await _db.tTransactionLog
                        .AddRangeAsync(
                            transactionLogs,
                            cancellationToken);
                }


                // ============================================================================
                // SAVE ALL PROJECT DETAIL CHANGES
                // ============================================================================

                Console.WriteLine(
                    ">>> Call to UpdateProjectDetails > SaveChangesAsync");


                await _db.SaveChangesAsync(
                    cancellationToken);


                Console.WriteLine(
                    ">>>! Finished UpdateProjectDetails > SaveChangesAsync");


                // ============================================================================
                // RECOMPUTE PROGRAM COST
                // ============================================================================

                if (HasCostUpdate)
                {
                    var ComputedCostResults =
                        await _db.pRecomputeProgramCost
                            .FromSqlInterpolated(
                                $"EXEC dbo.pRecomputeProgramCost @ProgramPK={ProgramFK}")
                            .AsNoTracking()
                            .ToListAsync(cancellationToken);


                    var ComputedCost =
                        ComputedCostResults.FirstOrDefault();


                    ProgramRevision.Cost =
                        ComputedCost?.NewCost ?? 0;


                    await _db.SaveChangesAsync(
                        cancellationToken);
                }


                // ============================================================================
                // COMMIT TRANSACTION
                // ============================================================================

                Console.WriteLine(
                    ">>> Call to UpdateProjectDetails > CommitAsync");


                await transaction.CommitAsync(
                    cancellationToken);


                Console.WriteLine(
                    ">>>! Finished UpdateProjectDetails > CommitAsync");


                // ============================================================================
                // RESPONSE
                // ============================================================================

                return Ok(new
                {
                    Message =
                        $"Project {dto.ProjectDetails!.ProjectId} updated successfully.",

                    Title =
                        "Update Complete"
                });

            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UploadSupportingDocs([FromBody] AddSupportingDocsDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate(); ;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                string StageName = dto.StageName;
                string UserId = _Session.UserId;

                #region Project
                var ValidateProjectId = await _db.ValidateProjectId(new ValidateProjectIdParams
                {
                    ProjectId = dto.ProjectId,
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
                var ProjectRevision = ValidateProjectId.Data.ProjectRevision;
                #endregion

                int ProjectRevisionFK = ProjectRevision.Id;
                if (dto.File == null)
                {
                    return new BadRequestObjectResult(new { Message = "No file uploaded.", Title = "File Upload Error" });
                }
                string FilePath = Path.Combine(Appsetting.Resources.SupportingDocs, ProjectRevision.ProjectId!, dto.File.Name);
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
                    DocTypeFK = docType,
                    ProjectRevisionFK = ProjectRevisionFK,
                    FileName = dto.File.Name,
                    FileExtension = dto.File.Extension,
                    FilePath = FilePath,
                    Description = Regex.Replace(dto.Description, @"\s+", " "),
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjectSupportingDocs.AddAsync(AddSupporting);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Docs added successfully.", Title = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> DeleteSupportingDocs([FromBody] DeleteSupportingDocsDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate(); ;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                string StageName = dto.StageName;
                string UserId = _Session.UserId;

                #region Project
                var ValidateProjectId = await _db.ValidateProjectId(new ValidateProjectIdParams
                {
                    ProjectId = dto.ProjectId,
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
                var ProjectRevision = ValidateProjectId.Data.ProjectRevision;
                #endregion

                int ProjectRevisionFK = ProjectRevision.Id;
                string ProjectId = ProjectRevision.ProjectId;
                var Note = await _db.tProjectSupportingDocs.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if(Note == null)
                {
                    return new BadRequestObjectResult(new { Message = "Supporting Doc not found.", Title = "Project Not Found" });
                }
                if (System.IO.File.Exists(Note.FilePath))
                {
                    System.IO.File.Delete(Note.FilePath);
                }
                string TransactionReferenceId = $"{ProjectId}-{StageName}";
                await _db.tTransactionLog.AddAsync(new TransactionLog
                {
                    ReferenceId = TransactionReferenceId,
                    TransactionType = EnumTransactionType.Delete.ToString(),
                    AffectedTable = "tProjectSupportingDocs",
                    AffectedColumn = "Row",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(Note),
                    CreatedBy = _Session.UserId,
                    CreatedDate = Functions.CurrentDate()
                });
                _db.tProjectSupportingDocs.Remove(Note);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new { Message = "Supporting Document deleted successfully.", Title = "Delete Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
    }
}