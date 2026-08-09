// =============================================================================================
// REFERENCE / PROPOSAL FILE — NOT wired into any .csproj, will not compile as part of the build.
//
// Refactor of WebAPI/Controllers/Projects/ProjectController.cs: AddProject and
// UpdateProjectDetails, restructured so independent tables/lookups are fetched concurrently.
//
// Why this shape and not a naive Task.WhenAll on `_db`:
//   EF Core's DbContext (and the ADO.NET connection/transaction underneath it) is NOT
//   thread-safe. You cannot run two queries or two SaveChangesAsync calls concurrently
//   against the same `_db` instance — it throws
//   "A second operation was started on this context before a previous operation completed."
//   True concurrent WRITES inside a single SQL transaction aren't achievable either, without
//   a distributed transaction (MSDTC), which is heavy infra most hosts disable. So:
//
//     - All WRITES (Add/Update/Remove + the transaction) still go through the single `_db`
//       instance, sequentially, exactly as before — that part cannot safely change.
//     - All independent READS (reference-table lookups, validation queries, "old value"
//       lookups for the audit log) are dispatched concurrently via short-lived,
//       throwaway DbContext instances from IDbContextFactory<MYPSDbContext>, using
//       Task.WhenAll. That is where the real latency was: dozens of small sequential
//       round trips to option/lookup tables.
//     - Several loops were doing one DB round trip PER ROW to resolve a display name from a
//       small, mostly-static reference table (component types, work types, infra types,
//       funding sources/agreements) — classic N+1. Those tables are now bulk-loaded once
//       (concurrently with everything else) into in-memory dictionaries, in the "Update X"
//       loops only (see below for why "New X" was left alone).
//
// Net effect for UpdateProjectDetails: the ~25-40 sequential small round trips for
// validation/lookups become a handful of concurrent read batches. The write side (Add/
// Update/Remove + SaveChangesAsync count) is UNCHANGED from the original — still up to 4
// SaveChangesAsync calls — see the "NOT changed" note below for why.
//
// NOT changed, on purpose: the "New Component Cost -> Cost Per Year / Major Work Item ->
// Work Location" block (and its two satellite "New Major Item of Works" / "New Major Work
// Locations" blocks further down) still does 2-3 mid-method SaveChangesAsync() calls to
// obtain generated IDs before inserting children. MYPSDbContext.OnModelCreating DOES
// configure these as proper EF relationships (HasMany/WithOne/HasForeignKey), so assigning
// through navigation collections (parent.CostsPerYear.Add(child)) would let EF wire the FK
// automatically on a single SaveChangesAsync and remove those round trips. It was tried and
// reverted: that block has pre-existing quirks — ComponentCostFK/WorkItemFK on some new
// rows are populated from the incoming DTO field rather than the newly generated parent Id,
// and the "New Major Item of Works"/"New Major Work Locations" sub-blocks are gated on
// `NewCostYears.Count() > 0` (a different collection) rather than their own collection's
// count — and a navigation-property rewrite would silently change that behavior as a side
// effect of removing the saves. That's a correctness fix, not a perf one, so it wasn't
// bundled in here. Worth a follow-up if you want it looked at.
//
// Known trade-off: independent read batches are fired before some in-memory-only validation
// (e.g. "amount must be > 0") has had a chance to short-circuit. On invalid input this means
// a few extra (cheap, read-only) queries run that the original would have skipped. On valid
// input — the common case — this is strictly faster. Behavior, error messages, and the order
// in which validation errors are surfaced are otherwise unchanged.
//
// To adopt: merge the constructor and the two methods below into the real
// WebAPI/Controllers/Projects/ProjectController.cs, keeping the rest of that file
// (ShowProjectDropdowns, ShowProjectStages, UploadSupportingDocs, etc.) as-is.
// Requires the IDbContextFactory<MYPSDbContext> registration added to
// Main/ServiceRegistration.cs (already applied).
// =============================================================================================

using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Project;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Data;
using static Helpers.ProjectHelper;

namespace WebAPI.Controllers.Projects
{
    public class ProjectController_AsyncRefactor : CoreController
    {
        private readonly IDbContextFactory<MYPSDbContext> _dbFactory;

        public ProjectController_AsyncRefactor(
            MYPSDbContext db,
            IHubContext<MicroService.SignalRHub> hub,
            PCMADbContext pcma,
            IDbContextFactory<MYPSDbContext> dbFactory) : base(db, hub, pcma)
        {
            _dbFactory = dbFactory;
        }

        /// <summary>
        /// Runs a read-only query against a short-lived, isolated DbContext so it can execute
        /// concurrently with other reads. Never use this for anything that must participate in
        /// the write transaction on `_db` — only for lookups that happen before/alongside it.
        /// </summary>
        private async Task<T> ReadIsolatedAsync<T>(Func<MYPSDbContext, Task<T>> query, CancellationToken cancellationToken)
        {
            await using var db = await _dbFactory.CreateDbContextAsync(cancellationToken);
            return await query(db);
        }

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

                #region Validate Program + Field Validation (independent — run concurrently)
                var pLookup = new ValidateProjectDetailsLookupsParams()
                {
                    _Session = _Session,
                    Tier = dto.Tier,
                    Category = dto.Category,
                    Region = dto.Region,
                    Province = dto.Province,
                    City = dto.City,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    DEO = dto.DEO,
                    ImplementingOffice = dto.ImplementingOffice,
                    OperatingUnit = dto.OperatingUnit,
                    Origin = dto.Origin,
                    Agency = dto.Agency,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    RowAvailable = dto.RowAvailable,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = dto.DetailedDesign,
                    DetailedDesignDate = dto.DetailedDesignDate,
                };

                // Neither validation depends on the other's result, so they no longer wait
                // in line behind each other.
                var validateProgramTask = ReadIsolatedAsync(
                    db => db.ValidateProgramId(new ProgramHelperParams
                    {
                        ProgramId = dto.ProgramId,
                        StageName = dto.StageName,
                        _Session = _Session
                    }, cancellationToken),
                    cancellationToken);

                var validateProjectLookupsTask = ReadIsolatedAsync(
                    db => db.ValidateProjectDetailsLookups(pLookup, cancellationToken),
                    cancellationToken);

                await Task.WhenAll(validateProgramTask, validateProjectLookupsTask);

                // Same priority as before: a bad ProgramId is reported before a bad field lookup.
                var ValidateProgram = validateProgramTask.Result;
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;

                var ValidateProjectLookUps = validateProjectLookupsTask.Result;
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
                string ProjectPK = await _db.GenerateProjectId(p, cancellationToken);
                #endregion
                string ProgramFK = ProgramParent.ProgramPK;
                string ProgramId = ProgramRevision.ProgramId;

                var SubmitProject = new DBHelper.Models.Table.Project.Projects()
                {
                    ProgramFK = ProgramFK,
                    ProjectPK = ProjectPK,
                    ProgramId = ProgramId,
                    ProjectType = dto.ProjectType!,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(SubmitProject);
                // tProjects and tProjectRevisions have no EF-modeled relationship (ProjectFK is a
                // plain string column, not a configured FK), so EF has no basis to guarantee
                // insert order if these are batched into one SaveChangesAsync. Left sequential
                // to avoid risking an FK violation under load — this pair is cheap either way.
                await _db.SaveChangesAsync();

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
                // ProjectStages.RevisionId needs the identity Id generated here, so this save
                // can't be folded into the next one.
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

        #region Update Project Details
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProjectDetails([FromBody] UpdateProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                bool HasCostUpdate = false;
                DateTime CurrentDate = Functions.CurrentDate();
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

                #region Independent pre-flight reads — dispatched together, none depends on another
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

                HashSet<string> fundingSources = dto.FundingProfile.Select(x => x.SourceOrg).ToHashSet();
                var requestedPairs = dto.FundingProfile
                    .Select(x => new { Source = x.SourceOrg, Agreement = x.AgreementCode })
                    .Distinct()
                    .ToList();

                var newComponentIds = dto.ComponentCosts.Where(x => x.Id == 0).Select(x => x.ComponentId).Distinct().ToList();

                var costPerYearItems = dto.ComponentCostPerYear.ToList();
                var existingCostPerYearComponentIds = costPerYearItems.Where(x => x.ComponentCostFK > 0).Select(x => x.ComponentCostFK).Distinct().ToList();

                var workItems = dto.MajorItemOfWorks.ToList();
                var workTypeIds = workItems.Select(x => x.WorkTypeFK).Distinct().ToList();
                var infraTypeIds = workItems.Select(x => x.InfraTypeFK).Distinct().ToList();
                var existingComponentCostIdsForWorkItems = workItems.Where(x => x.ComponentCostFK > 0).Select(x => x.ComponentCostFK).Distinct().ToList();

                var existingLocationWorkItemIds = dto.MajorItemLocations.Where(x => x.WorkItemFK > 0).Select(x => x.WorkItemFK).Distinct().ToList();

                // Fired together: this replaces what used to be ~15 sequential round trips
                // with a single concurrent batch. Queries are cheap/empty-safe when their
                // input id list is empty, so no need to gate them behind `.Any()` here — the
                // original `.Any()` guards are preserved below, at the point the results are used.
                var currentProgramVersionTask = ReadIsolatedAsync(
                    db => db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramFK, cancellationToken), cancellationToken);
                var sameDescriptionTask = ReadIsolatedAsync(
                    db => db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramFK == ProjectParent.ProgramFK && x.Description == dto.ProjectDetails.Description && x.ProjectFK != ProjectParent.ProjectPK, cancellationToken), cancellationToken);
                var validateProjectLookupsTask = ReadIsolatedAsync(
                    db => db.ValidateProjectDetailsLookups(pLookup, cancellationToken), cancellationToken);
                var validFundingSourcesTask = ReadIsolatedAsync(
                    db => db.tOptionFundingSource.Where(x => fundingSources.Contains(x.Organization)).Select(x => x.Organization).ToListAsync(cancellationToken), cancellationToken);
                var validAgreementPairsTask = ReadIsolatedAsync(
                    db => db.tOptionFundingAgreement.Where(x => requestedPairs.Select(p => p.Agreement).Contains(x.Code)).Select(x => new { Source = x.SourceOrg, Agreement = x.Code }).ToListAsync(cancellationToken), cancellationToken);
                var newComponentTypesTask = ReadIsolatedAsync(
                    db => db.tOptionProjectComponentType.AsNoTracking().Where(x => x.IsActive && newComponentIds.Contains(x.ComponentId)).ToListAsync(cancellationToken), cancellationToken);
                var existingComponentTask = ReadIsolatedAsync(
                    db => db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevision.Id && !x.IsDeleted && newComponentIds.Contains(x.ComponentId)).ToListAsync(cancellationToken), cancellationToken);
                var existingCostPerYearTask = ReadIsolatedAsync(
                    db => db.tProjectComponentCostPerYear.AsNoTracking().Where(x => !x.IsDeleted && existingCostPerYearComponentIds.Contains(x.ComponentCostFK)).ToListAsync(cancellationToken), cancellationToken);
                var validWorkTypesTask = ReadIsolatedAsync(
                    db => db.tOptionScopeOfWork.AsNoTracking().Where(x => x.IsActive && workTypeIds.Contains(x.Enum)).Select(x => x.Enum).ToListAsync(cancellationToken), cancellationToken);
                var validInfraTypesTask = ReadIsolatedAsync(
                    db => db.tOptionInfraType.AsNoTracking().Where(x => x.IsActive && infraTypeIds.Contains(x.InfraCode)).Select(x => x.InfraCode).ToListAsync(cancellationToken), cancellationToken);
                var existingWorkItemsTask = ReadIsolatedAsync(
                    db => db.tProjectMajorWorkItem.AsNoTracking().Where(x => !x.IsDeleted && existingComponentCostIdsForWorkItems.Contains(x.ComponentCostFK)).ToListAsync(cancellationToken), cancellationToken);
                var existingLocationsForNewCheckTask = ReadIsolatedAsync(
                    db => db.tProjectMajorWorkLocations.AsNoTracking().Where(x => !x.IsDeleted && existingLocationWorkItemIds.Contains(x.WorkItemFK)).ToListAsync(cancellationToken), cancellationToken);

                // Bulk-load the small reference tables used repeatedly further down (component
                // type names, work type descriptions, infra names, funding source/agreement
                // names) ONCE instead of once per changed row inside the update loops below —
                // eliminates an N+1 query pattern.
                var componentTypeLookupTask = ReadIsolatedAsync(
                    db => db.tOptionProjectComponentType.AsNoTracking().ToDictionaryAsync(x => x.ComponentName, x => x, cancellationToken), cancellationToken);
                var scopeOfWorkLookupTask = ReadIsolatedAsync(
                    db => db.tOptionScopeOfWork.AsNoTracking().ToDictionaryAsync(x => x.Enum, x => x, cancellationToken), cancellationToken);
                var infraTypeLookupTask = ReadIsolatedAsync(
                    db => db.tOptionInfraType.AsNoTracking().ToDictionaryAsync(x => x.InfraCode, x => x, cancellationToken), cancellationToken);
                var fundingSourceLookupTask = ReadIsolatedAsync(
                    db => db.tOptionFundingSource.AsNoTracking().ToDictionaryAsync(x => x.Organization, x => x, cancellationToken), cancellationToken);
                var fundingAgreementLookupTask = ReadIsolatedAsync(
                    db => db.tOptionFundingAgreement.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x, cancellationToken), cancellationToken);

                await Task.WhenAll(
                    currentProgramVersionTask, sameDescriptionTask, validateProjectLookupsTask,
                    validFundingSourcesTask, validAgreementPairsTask,
                    newComponentTypesTask, existingComponentTask, existingCostPerYearTask,
                    validWorkTypesTask, validInfraTypesTask, existingWorkItemsTask, existingLocationsForNewCheckTask,
                    componentTypeLookupTask, scopeOfWorkLookupTask, infraTypeLookupTask,
                    fundingSourceLookupTask, fundingAgreementLookupTask);
                #endregion

                var CurrentProgramVersion = currentProgramVersionTask.Result;
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
                var GetSameDescription = sameDescriptionTask.Result;
                if (GetSameDescription != null && !dto.IsAllowedToProceed)
                {
                    return Ok(new { Message = $"Description: {dto.ProjectDetails.Description} already exist in {GetSameDescription.ProjectId}! Do you still want to proceed?", Title = "Description Exists", Type = "Prompt" });
                }

                #region Validations

                var ValidateProjectLookUps = validateProjectLookupsTask.Result;
                if (!ValidateProjectLookUps.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProjectLookUps.Title,
                        Message = ValidateProjectLookUps.Message
                    });
                }

                #region Funding Profile
                var BlankFunding = dto.FundingProfile.Where(x => x.Amount <= 0).ToList();
                if (BlankFunding.Any())
                {
                    return new BadRequestObjectResult(new { Message = "Funding Profile contains invalid amount(s). Please check and try again.", Title = "Invalid Funding Profile Amount" });
                }
                var blankFundingSource = dto.FundingProfile.Where(x => string.IsNullOrWhiteSpace(x.SourceOrg)).ToList();
                if (blankFundingSource.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Source",
                        Message = "One or more Funding Profile entries do not have a funding source selected. Please select a valid funding source and try again."
                    });
                }

                var validFundingSources = validFundingSourcesTask.Result;
                var invalidFundingSources = fundingSources.Except(validFundingSources).ToList();
                if (invalidFundingSources.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Source",
                        Message = "One or more Funding Profile sources are no longer available or are invalid. Please review your selected funding sources and try again.",
                        InvalidSources = invalidFundingSources
                    });
                }
                var blankFundingAgreement = dto.FundingProfile.Where(x => string.IsNullOrWhiteSpace(x.AgreementCode)).ToList();
                if (blankFundingAgreement.Any())
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Funding Profile Agreement",
                        Message = "One or more Funding Profile entries do not have a funding agreement selected. Please select a valid funding agreement and try again."
                    });
                }

                var validPairs = validAgreementPairsTask.Result;
                var invalidPairs = requestedPairs
                    .Where(p => !validPairs.Any(v => v.Source == p.Source && v.Agreement == p.Agreement))
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
                if (dto.ComponentCosts.Any(x => x.Id == 0 && x.Total < 1))
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Component Cost Amount",
                        Message = "One or more Component Costs contain an invalid amount. Please review your entries and try again."
                    });
                }

                if (newComponentIds.Any())
                {
                    var componentTypes = newComponentTypesTask.Result;

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

                    var ExistingComponent = existingComponentTask.Result;
                    HashSet<string> existingComponentIds = ExistingComponent.Select(x => x.ComponentId).ToHashSet();

                    var deletedComponentIds = dto.ComponentCosts
                        .Where(x => x.Id != 0 && x.IsDeleted)
                        .Select(x => x.ComponentId)
                        .ToHashSet();

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
                if (costPerYearItems.Any())
                {
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

                    var duplicateCostPerYearRequest = costPerYearItems
                        .Where(x => x.Id == 0)
                        .GroupBy(x => new { x.ComponentClientId, x.ComponentCostFK, x.Year })
                        .Where(g => g.Count() > 1)
                        .ToList();
                    if (duplicateCostPerYearRequest.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Duplicate Cost Per Year",
                            Message = "Duplicate Cost Per Year entries were found for the same Year within a Component Cost."
                        });
                    }

                    if (existingCostPerYearComponentIds.Any())
                    {
                        var existingCostPerYearRecords = existingCostPerYearTask.Result;
                        var deletedCostPerYearIds = costPerYearItems.Where(x => x.Id > 0 && x.IsDeleted).Select(x => x.Id).ToHashSet();
                        var duplicateExistingCostPerYear = costPerYearItems
                            .Where(x => x.Id == 0 && x.ComponentCostFK > 0)
                            .Where(newItem => existingCostPerYearRecords.Any(existing =>
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
                if (workItems.Any())
                {
                    if (workItems.Any(x => x.YearOfWork <= 0))
                    {
                        return new BadRequestObjectResult(new { Title = "Invalid Year of Work", Message = "One or more Major Work Items contain an invalid Year of Work." });
                    }
                    if (workItems.Any(x => x.WorkTypeFK <= 0))
                    {
                        return new BadRequestObjectResult(new { Title = "Invalid Work Type", Message = "One or more Major Work Items contain an invalid Work Type." });
                    }
                    if (workItems.Any(x => string.IsNullOrWhiteSpace(x.InfraTypeFK)))
                    {
                        return new BadRequestObjectResult(new { Title = "Invalid Infrastructure Type", Message = "One or more Major Work Items contain an invalid Infrastructure Type." });
                    }

                    var validWorkTypes = validWorkTypesTask.Result;
                    var invalidWorkTypes = workTypeIds.Where(x => !validWorkTypes.Contains(x)).ToList();
                    if (invalidWorkTypes.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Work Type",
                            Message = $"The following Work Type(s) are invalid or inactive: {string.Join(", ", invalidWorkTypes)}."
                        });
                    }

                    var validInfraTypes = validInfraTypesTask.Result;
                    var invalidInfraTypes = infraTypeIds.Where(x => !validInfraTypes.Contains(x)).ToList();
                    if (invalidInfraTypes.Any())
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Infrastructure Type",
                            Message = $"The following Infrastructure Type(s) are invalid or inactive: {string.Join(", ", invalidInfraTypes)}."
                        });
                    }

                    var duplicateWorkItems = workItems
                        .Where(x => x.Id == 0)
                        .GroupBy(x => new { x.ComponentClientId, x.YearOfWork, x.WorkTypeFK, x.InfraTypeFK })
                        .Where(g => g.Count() > 1)
                        .ToList();
                    if (duplicateWorkItems.Any())
                    {
                        return new BadRequestObjectResult(new { Title = "Duplicate Major Work Items", Message = "Duplicate Major Work Items were found in the request." });
                    }

                    if (existingComponentCostIdsForWorkItems.Any())
                    {
                        var existingWorkItemsForCheck = existingWorkItemsTask.Result;
                        var deletedIds = workItems.Where(x => x.Id > 0 && x.IsDeleted).Select(x => x.Id).ToHashSet();
                        var duplicateExisting = workItems
                            .Where(x => x.Id == 0 && x.ComponentCostFK > 0)
                            .Where(newItem => existingWorkItemsForCheck.Any(existing =>
                                existing.ComponentCostFK == newItem.ComponentCostFK &&
                                existing.YearOfWork == newItem.YearOfWork &&
                                existing.WorkTypeFK == newItem.WorkTypeFK &&
                                existing.InfraTypeFK == newItem.InfraTypeFK &&
                                !deletedIds.Contains(existing.Id)))
                            .ToList();
                        if (duplicateExisting.Any())
                        {
                            return new BadRequestObjectResult(new { Title = "Duplicate Major Work Items", Message = "One or more Major Work Items already exist for the selected Component Cost." });
                        }
                    }
                }
                #endregion

                #region Major Work Location
                if (dto.MajorItemLocations.Any(x => string.IsNullOrWhiteSpace(x.InfraId)))
                {
                    return new BadRequestObjectResult(new { Title = "Invalid Infrastructure Id", Message = "One or more Major Work Locations do not have an Infrastructure Id selected." });
                }
                if (dto.MajorItemLocations.Any(x => x.TargetUnitId <= 0))
                {
                    return new BadRequestObjectResult(new { Title = "Invalid Target Unit", Message = "One or more Major Work Locations contain an invalid Target Unit." });
                }
                if (dto.MajorItemLocations.Any(x => string.IsNullOrWhiteSpace(x.TargetUnit)))
                {
                    return new BadRequestObjectResult(new { Title = "Invalid Target Unit", Message = "One or more Major Work Locations do not have a Target Unit selected." });
                }
                if (dto.MajorItemLocations.Any(x => x.PhysicalTarget <= 0))
                {
                    return new BadRequestObjectResult(new { Title = "Invalid Physical Target", Message = "One or more Major Work Locations contain an invalid Physical Target." });
                }

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

                if (existingLocationWorkItemIds.Any())
                {
                    var existingLocations = existingLocationsForNewCheckTask.Result;
                    var deletedLocationIds = dto.MajorItemLocations.Where(x => x.Id > 0 && x.IsDeleted).Select(x => x.Id).ToHashSet();
                    var duplicateExistingLocations = dto.MajorItemLocations
                        .Where(x => x.Id == 0 && x.WorkItemFK > 0 && !string.IsNullOrEmpty(x.StartStationLimit) && !string.IsNullOrEmpty(x.EndStationLimit))
                        .Where(newItem => existingLocations.Any(existing =>
                            existing.WorkItemFK == newItem.WorkItemFK &&
                            string.Equals((existing.DetailedScope ?? string.Empty).Trim(), (newItem.DetailedScope ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase) &&
                            string.Equals((existing.StartStationLimit ?? string.Empty).Trim(), newItem.StartStationLimit!.Trim(), StringComparison.OrdinalIgnoreCase) &&
                            string.Equals((existing.EndStationLimit ?? string.Empty).Trim(), newItem.EndStationLimit!.Trim(), StringComparison.OrdinalIgnoreCase) &&
                            !deletedLocationIds.Contains(existing.Id)))
                        .ToList();
                    if (duplicateExistingLocations.Any())
                    {
                        return new BadRequestObjectResult(new { Title = "Duplicate Major Work Locations", Message = "One or more Major Work Locations already exist for the selected Major Work Item." });
                    }
                }
                #endregion

                #endregion

                #region Update Project Details (diff against tracked entity; all reference lookups pre-fetched above / batched below)
                var Project = await _db.tProjectRevisions.FirstOrDefaultAsync(x => x.Id == ProjectRevision.Id, cancellationToken) ?? new ProjectRevisions();
                var details = dto.ProjectDetails!;

                // Every "old vs new" pair below is an independent lookup against a small
                // option table. Only fields that actually changed fire a fetch, and every
                // fetch that does fire runs concurrently with the others (one isolated
                // context per field, so the 2 reads within a field — new + old — still run
                // in sequence, but the ~10 fields run in parallel with each other).
                var categoryTask = Project.Category != details.Category
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectCategory.AsNoTracking().Where(x => x.ValidUntil >= CurrentDate.Year || x.ValidUntil == 0).FirstOrDefaultAsync(x => x.CategoryId == details.Category, cancellationToken),
                        Old: await db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == Project.Category, cancellationToken)), cancellationToken)
                    : null;
                var thrustTask = Project.Thrust != details.Thrust
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == details.Thrust, cancellationToken),
                        Old: await db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == Project.Thrust, cancellationToken)), cancellationToken)
                    : null;
                var cityTask = Project.City != details.City
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Code == details.City, cancellationToken),
                        Old: await db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Code == Project.City, cancellationToken)), cancellationToken)
                    : null;
                var ldTask = Project.LegislativeDistrict != details.LegislativeDistrict
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Code == details.LegislativeDistrict, cancellationToken),
                        Old: await db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Code == Project.LegislativeDistrict, cancellationToken)), cancellationToken)
                    : null;
                var ioTask = Project.ImplementingOffice != details.ImplementingOffice
                    ? ReadIsolatedAsync(async db => (
                        New: await db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == details.ImplementingOffice, cancellationToken),
                        Old: await db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.ImplementingOffice, cancellationToken)), cancellationToken)
                    : null;
                var ouTask = Project.OperatingUnit != details.OperatingUnit
                    ? ReadIsolatedAsync(async db => (
                        New: await db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == details.OperatingUnit, cancellationToken),
                        Old: await db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == Project.OperatingUnit, cancellationToken)), cancellationToken)
                    : null;
                var originTask = Project.Origin != details.Origin
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.Origin, cancellationToken),
                        Old: await db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Origin, cancellationToken)), cancellationToken)
                    : null;
                var agencyTask = Project.Agency != details.Agency
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.Agency, cancellationToken),
                        Old: await db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Agency, cancellationToken)), cancellationToken)
                    : null;
                var implModeTask = Project.ImplementationMode != details.ImplementationMode
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.ImplementationMode, cancellationToken),
                        Old: await db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.ImplementationMode, cancellationToken)), cancellationToken)
                    : null;
                var emergModeTask = Project.EmergencyMode != details.EmergencyMode
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.EmergencyMode, cancellationToken),
                        Old: await db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.EmergencyMode, cancellationToken)), cancellationToken)
                    : null;
                var rowAvailTask = Project.RowAvailable != details.RowAvailable
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.RowAvailable, cancellationToken),
                        Old: await db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.RowAvailable, cancellationToken)), cancellationToken)
                    : null;
                var feasibilityTask = Project.Feasibility != details.Feasibility
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.Feasibility, cancellationToken),
                        Old: await db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.Feasibility, cancellationToken)), cancellationToken)
                    : null;
                var detailedDesignTask = Project.DetailedDesign != details.DetailedDesign
                    ? ReadIsolatedAsync(async db => (
                        New: await db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == details.DetailedDesign, cancellationToken),
                        Old: await db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == Project.DetailedDesign, cancellationToken)), cancellationToken)
                    : null;

                // Each field's task has a different (named-tuple) generic type, so the only
                // type they share is the non-generic Task base — fine for WhenAll, since the
                // typed *Task variables below are what actually get read via .Result.
                await Task.WhenAll(new Task?[] { categoryTask, thrustTask, cityTask, ldTask, ioTask, ouTask, originTask, agencyTask, implModeTask, emergModeTask, rowAvailTask, feasibilityTask, detailedDesignTask }
                    .OfType<Task>());

                if (Project.AlternateId != details.AlternateId)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "AlternateId",
                        NewValue = $"Stage: {StageName} Value: {details.AlternateId!}",
                        OldValue = $"Stage: {StageName} Value: {Project.AlternateId!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.AlternateId = details.AlternateId;
                }
                if (Project.Tier != details.Tier)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Tier",
                        NewValue = $"Stage: {StageName} Value: {details.Tier.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Tier.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Tier = details.Tier;
                }
                if (categoryTask != null)
                {
                    var (Category, OldCategory) = categoryTask.Result;
                    if (Category == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Category '{details.Category}' is not valid.", Title = "Invalid Category" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Category",
                        NewValue = $"Stage: {StageName} Value: {Category.CategoryName}",
                        OldValue = $"Stage: {StageName} Value: {OldCategory?.CategoryName}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Category = details.Category;
                }
                if (thrustTask != null)
                {
                    var (Thrust, OldThrust) = thrustTask.Result;
                    if (Thrust == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Thrust '{details.Thrust}' is not valid.", Title = "Invalid Thrust" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {StageName} Value: {Thrust.SubProgramName}",
                        OldValue = $"Stage: {StageName} Value: {OldThrust?.SubProgramName}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Thrust = details.Thrust;
                }
                if (Project.MYCAApprovalDate != details.MYCAApprovalDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "MYCAApprovalDate",
                        NewValue = $"Stage: {StageName} Value: {details.MYCAApprovalDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project.MYCAApprovalDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.MYCAApprovalDate = details.MYCAApprovalDate;
                }
                if (Project.Description != details.Description)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Description",
                        NewValue = $"Stage: {StageName} Value: {details.Description!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Description!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Description = details.Description;
                }
                if (cityTask != null)
                {
                    var (City, OldCity) = cityTask.Result;
                    if (City == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected City '{details.City}' is not valid.", Title = "Invalid City" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "City",
                        NewValue = $"Stage: {StageName} Value: {City.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldCity?.Name}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.City = details.City;
                }
                if (ldTask != null)
                {
                    var (LD, OldLD) = ldTask.Result;
                    if (LD == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Legislative District '{details.LegislativeDistrict}' is not valid.", Title = "Invalid Legislative District" });
                    }
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "LegislativeDistrict",
                        NewValue = $"Stage: {StageName} Value: {LD.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldLD?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.LegislativeDistrict = details.LegislativeDistrict;
                    hasUpdated = true;
                }
                if (ioTask != null)
                {
                    var (IO, OldIO) = ioTask.Result;
                    if (IO == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementing Office '{details.ImplementingOffice}' is not valid.", Title = "Invalid Implementing Office" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementingOffice",
                        NewValue = $"Stage: {StageName} Value: {IO.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldIO?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementingOffice = details.ImplementingOffice;
                }
                if (ouTask != null)
                {
                    var (OperatingUnit, OldOperatingUnit) = ouTask.Result;
                    if (OperatingUnit == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Operating Unit '{details.OperatingUnit}' is not valid.", Title = "Invalid Operating Unit" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "OperatingUnit",
                        NewValue = $"Stage: {StageName} Value: {OperatingUnit.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldOperatingUnit?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.OperatingUnit = details.OperatingUnit;
                }
                if (Project.RegionWide != details.RegionWide)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RegionWide",
                        NewValue = $"Stage: {StageName} Value: {details.RegionWide.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.RegionWide.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RegionWide = details.RegionWide;
                }
                if (originTask != null)
                {
                    var (Origin, OldOrigin) = originTask.Result;
                    if (Origin == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Origin '{details.Origin}' is not valid.", Title = "Invalid Origin" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Thrust",
                        NewValue = $"Stage: {StageName} Value: {Origin.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldOrigin?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Origin = details.Origin;
                }
                if (agencyTask != null)
                {
                    var (Agency, OldAgency) = agencyTask.Result;
                    if (Agency == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Agency '{details.Agency}' is not valid.", Title = "Invalid Agency" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Agency",
                        NewValue = $"Stage: {StageName} Value: {Agency.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldAgency?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Agency = details.Agency;
                }

                if (details.ImplementationMode == null || details.ImplementationMode == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Implementation Mode is required.", Title = "Implementation Mode Required" });
                }
                if (implModeTask != null)
                {
                    var (ImplementationMode, OldImplementationMode) = implModeTask.Result;
                    if (ImplementationMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Implementation Mode '{details.ImplementationMode}' is not valid.", Title = "Invalid Implementation Mode" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "ImplementationMode",
                        NewValue = $"Stage: {StageName} Value: {ImplementationMode.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldImplementationMode?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.ImplementationMode = details.ImplementationMode;
                }
                if (emergModeTask != null)
                {
                    var (EmergencyMode, OldEmergencyMode) = emergModeTask.Result;
                    if (EmergencyMode == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Emergency Mode '{details.EmergencyMode}' is not valid.", Title = "Invalid Emergency Mode" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "EmergencyMode",
                        NewValue = $"Stage: {StageName} Value: {EmergencyMode.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldEmergencyMode?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.EmergencyMode = details.EmergencyMode;
                }
                if (rowAvailTask != null)
                {
                    var (RowAvailable, OldRowAvailable) = rowAvailTask.Result;
                    if (RowAvailable == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Row Available '{details.EmergencyMode}' is not valid.", Title = "Invalid Row Available" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "RowAvailable",
                        NewValue = $"Stage: {StageName} Value: {RowAvailable.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldRowAvailable?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.RowAvailable = details.RowAvailable;
                }

                if (details.Feasibility == null || details.Feasibility == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Feasibility is required.", Title = "Feasibility Required" });
                }
                if (feasibilityTask != null)
                {
                    var (Feasib, OldFeasibility) = feasibilityTask.Result;
                    if (Feasib == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Feasibility '{details.Feasibility}' is not valid.", Title = "Invalid Feasibility" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Feasibility",
                        NewValue = $"Stage: {StageName} Value: {Feasib.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldFeasibility?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Feasibility = details.Feasibility;
                }
                if (Project.FeasibilityDate != details.FeasibilityDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "FeasibilityDate",
                        NewValue = $"Stage: {StageName} Value: {details.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project?.FeasibilityDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project!.FeasibilityDate = details.FeasibilityDate;
                }
                if (detailedDesignTask != null)
                {
                    var (DetailedDesign, OldDetailedDesign) = detailedDesignTask.Result;
                    if (DetailedDesign == null)
                    {
                        return new BadRequestObjectResult(new { Message = $"Selected Detailed Design '{details.DetailedDesign}' is not valid.", Title = "Invalid Detailed Design" });
                    }
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesign",
                        NewValue = $"Stage: {StageName} Value: {DetailedDesign.Name!}",
                        OldValue = $"Stage: {StageName} Value: {OldDetailedDesign?.Name!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.DetailedDesign = details.DetailedDesign;
                }
                if (Project.DetailedDesignDate != details.DetailedDesignDate)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "DetailedDesignDate",
                        NewValue = $"Stage: {StageName} Value: {details.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        OldValue = $"Stage: {StageName} Value: {Project?.DetailedDesignDate?.ToString("mm/dd/yyyy")}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project!.DetailedDesignDate = details.DetailedDesignDate;
                }

                if (Project.Rank != details.Rank)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProjectId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectRevisions",
                        AffectedColumn = "Rank",
                        NewValue = $"Stage: {StageName} Value: {details.Rank.ToString()!}",
                        OldValue = $"Stage: {StageName} Value: {Project.Rank.ToString()!}",
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    Project.Rank = details.Rank;
                }
                if (hasUpdated)
                {
                    _db.tProjectRevisions.Update(Project);
                }
                #endregion

                // Bulk in-memory reference lookups — replaces one DB round trip per changed
                // row inside the loops below with dictionary access against tables already
                // fetched in the concurrent batch above.
                var componentTypeLookup = componentTypeLookupTask.Result;
                var scopeOfWorkLookup = scopeOfWorkLookupTask.Result;
                var infraTypeLookup = infraTypeLookupTask.Result;
                var fundingSourceLookup = fundingSourceLookupTask.Result;
                var fundingAgreementLookup = fundingAgreementLookupTask.Result;

                #region New Component Cost with components relations
                // NOTE — left byte-for-byte identical to the original here, including its
                // 2 mid-method SaveChangesAsync calls. This block has pre-existing quirks
                // (ComponentCostFK/WorkItemFK populated from the incoming DTO field rather
                // than from the newly generated parent Id; the NewWorkItem/NewWorkLocation
                // sub-blocks are gated on `NewCostYears.Count() > 0` rather than their own
                // collection's count) that a navigation-property rewrite would silently
                // "fix" as a side effect of removing the saves. That's a correctness change,
                // not a perf one, so it's out of scope here — flagged separately instead of
                // folded into this refactor. See the flagged-issues note at the end of this
                // file.
                var CostToBeDeleted = dto.ComponentCosts.Where(x => x.IsDeleted == true && x.Id > 0).Select(x => x.Id).ToHashSet<int>();
                var ComponentCost = await _db.tProjectComponentCost.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevision.Id && !x.IsDeleted).ToListAsync(cancellationToken);
                HashSet<int> ComponentCostIds = ComponentCost.Select(x => x.Id).ToHashSet();
                HashSet<string> ComponentCostTypeIds = ComponentCost.Select(x => x.ComponentId).ToHashSet();
                var NewComponentCostData = dto.ComponentCosts.Where(x => x.Id == 0 && !x.IsDeleted).ToList();
                List<ProjectComponentCost> NewCostToAdd = new List<ProjectComponentCost>();
                if (NewComponentCostData.Count > 0)
                {
                    HasCostUpdate = true;
                    var NewComponentCost = NewComponentCostData.Select(x => new ProjectComponentCost
                    {
                        ProjectRevisionFK = ProjectRevision.Id,
                        ComponentId = x.ComponentId,
                        ComponentType = x.ComponentType,
                        Description = x.Description,
                        Total = x.Total,
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    }).ToList();
                    NewCostToAdd.AddRange(NewComponentCost);
                    await _db.tProjectComponentCost.AddRangeAsync(NewCostToAdd, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);

                    HashSet<string> ComponentIds = NewComponentCostData.Select(x => x.ComponentId).ToHashSet();

                    var NewCostYears = dto.ComponentCostPerYear.Where(x => x.Id == 0 && ComponentIds.Contains(x.ComponentId));
                    if (NewCostYears.Count() > 0)
                    {
                        var NewComponentCostPerYear = NewCostToAdd
                            .SelectMany(a =>
                                NewCostYears
                                .Where(x => x.ComponentId == a.ComponentId)
                                .Select(x => new ProjectComponentCostPerYear
                                {
                                    ComponentCostFK = a.Id,
                                    ComponentId = x.ComponentId,
                                    Amount = x.Amount,
                                    Year = x.Year,
                                    UACS = x.UACS,
                                    StartDate = x.StartDate,
                                    EndDate = x.EndDate,
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                }))
                            .ToList();
                        await _db.tProjectComponentCostPerYear.AddRangeAsync(NewComponentCostPerYear, cancellationToken);
                    }

                    var NewWorkItem = dto.MajorItemOfWorks.Where(x => x.Id == 0 && ComponentIds.Contains(x.ComponentId));
                    if (NewCostYears.Count() > 0)
                    {
                        var NewMajorWorkItem = NewCostToAdd
                            .SelectMany(a =>
                                NewWorkItem
                                .Where(x => x.ComponentId == a.ComponentId)
                                .Select(item => new ProjectMajorWorkItem
                                {
                                    ComponentCostFK = item.ComponentCostFK,
                                    ComponentId = item.ComponentId,
                                    YearOfWork = item.YearOfWork,
                                    WorkTypeFK = item.WorkTypeFK,
                                    InfraTypeFK = item.InfraTypeFK,
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                }))
                            .ToList();
                        await _db.tProjectMajorWorkItem.AddRangeAsync(NewMajorWorkItem, cancellationToken);
                        await _db.SaveChangesAsync(cancellationToken);
                    }

                    var NewWorkLocation = dto.MajorItemLocations.Where(x => x.Id == 0 && ComponentIds.Contains(x.ComponentId));
                    if (NewCostYears.Count() > 0)
                    {
                        var NewMajorWorkLocations = NewWorkItem
                            .SelectMany(a =>
                                NewWorkLocation
                                .Where(x => x.ComponentId == a.ComponentId)
                                .Select(loc => new ProjectMajorWorkLocations
                                {
                                    WorkItemFK = loc.WorkItemFK,
                                    ComponentId = loc.ComponentId,
                                    InfraId = loc.InfraId,
                                    DetailedScope = loc.DetailedScope,
                                    TargetUnitId = loc.TargetUnitId,
                                    TargetUnit = loc.TargetUnit,
                                    StartX = loc.StartX,
                                    StartY = loc.StartY,
                                    EndX = loc.EndX,
                                    EndY = loc.EndY,
                                    PhysicalTarget = loc.PhysicalTarget,
                                    StartStationLimit = loc.StartStationLimit,
                                    EndStationLimit = loc.EndStationLimit,
                                    StartChainage = loc.StartChainage,
                                    EndChainage = loc.EndChainage,
                                    Length = loc.Length,
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                }))
                            .ToList();
                        await _db.tProjectMajorWorkLocations.AddRangeAsync(NewMajorWorkLocations, cancellationToken);
                    }
                }
                #endregion

                #region Update Component Cost
                if (ComponentCost.Count > 0)
                {
                    var UpdateComponentCost = dto.ComponentCosts.Where(x => ComponentCostIds.Contains(x.Id)).ToList();
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
                                    if (!componentTypeLookup.TryGetValue(item.ComponentType, out var Component))
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Component '{item.ComponentType}' is not valid.", Title = "Invalid Component" });
                                    }
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "ComponentType",
                                        NewValue = Component.ComponentName,
                                        OldValue = ExistingItem.ComponentType,
                                        CreatedBy = UserId,
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
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Description",
                                        NewValue = item.Description ?? "",
                                        OldValue = ExistingItem.Description ?? "",
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Description = item.Description ?? "";
                                }
                                if (ExistingItem.Total != item.Total)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Total",
                                        NewValue = item.Total.ToString(),
                                        OldValue = ExistingItem.Total.ToString(),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Total = item.Total;
                                }
                                if (item.IsDeleted == true)
                                {
                                    ComponentUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Delete.ToString(),
                                        AffectedTable = "tProjectComponentCost",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (ComponentUpdate)
                                {
                                    ExistingItem.UpdatedBy = UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectComponentCost.Update(ExistingItem);
                                }
                            }
                        }
                    }
                }
                #endregion

                #region Update Component Cost Per Year
                var ComponentCostYear = await _db.tProjectComponentCostPerYear.AsNoTracking().Where(x => ComponentCostIds.Contains(x.ComponentCostFK) && !x.IsDeleted).ToListAsync(cancellationToken);
                if (ComponentCostYear.Count() > 0)
                {
                    HasCostUpdate = true;
                    foreach (var Year in ComponentCostYear)
                    {
                        var CostYearToBeUpdated = dto.ComponentCostPerYear.FirstOrDefault(x => x.Id == Year.Id);
                        if (CostYearToBeUpdated != null)
                        {
                            bool ComponentYearUpdate = false;
                            if (Year.Amount != CostYearToBeUpdated.Amount)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    ReferenceId = ProjectId,
                                    TransactionType = EnumTransactionType.Update.ToString(),
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "Amount",
                                    NewValue = CostYearToBeUpdated.Amount.ToString()!,
                                    OldValue = Year.Amount.ToString()!,
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.Amount = CostYearToBeUpdated.Amount;
                            }
                            if (Year.StartDate != CostYearToBeUpdated.StartDate)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    ReferenceId = ProjectId,
                                    TransactionType = EnumTransactionType.Update.ToString(),
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "StartDate",
                                    NewValue = CostYearToBeUpdated.StartDate?.ToString("mm/dd/yyyy") ?? "",
                                    OldValue = Year.StartDate?.ToString("mm/dd/yyyy") ?? "",
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.StartDate = CostYearToBeUpdated.StartDate;
                            }
                            if (Year.EndDate != CostYearToBeUpdated.EndDate)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    ReferenceId = ProjectId,
                                    TransactionType = EnumTransactionType.Update.ToString(),
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "EndDate",
                                    NewValue = CostYearToBeUpdated.EndDate?.ToString("mm/dd/yyyy") ?? "",
                                    OldValue = Year.EndDate?.ToString("mm/dd/yyyy") ?? "",
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.EndDate = CostYearToBeUpdated.EndDate;
                            }
                            if (Year.IsDeleted != CostYearToBeUpdated.IsDeleted)
                            {
                                ComponentYearUpdate = true;
                                transactionLogs.Add(new TransactionLog
                                {
                                    ReferenceId = ProjectId,
                                    TransactionType = EnumTransactionType.Delete.ToString(),
                                    AffectedTable = "tProjectComponentCostPerYear",
                                    AffectedColumn = "Row",
                                    NewValue = "",
                                    OldValue = JsonConvert.SerializeObject(Year),
                                    CreatedBy = UserId,
                                    CreatedDate = CurrentDate
                                });
                                Year.IsDeleted = CostYearToBeUpdated.IsDeleted;
                            }
                            if (ComponentYearUpdate)
                            {
                                Year.UpdatedBy = UserId;
                                Year.UpdatedDate = CurrentDate;
                                _db.tProjectComponentCostPerYear.Update(Year);
                            }
                        }
                    }
                }
                #endregion

                #region New Component Cost Per Year
                // Preserved exactly as in the original: joined against NewCostToAdd (the
                // components added earlier in this same request), not against the existing
                // ComponentCost list. Not changed here — that's a pre-existing behavior of
                // the method, out of scope for an async/perf refactor.
                var NewComponentCostYearData = dto.ComponentCostPerYear.Where(x => x.Id == 0 && !x.IsDeleted && ComponentCostTypeIds.Contains(x.ComponentId)).ToList();
                if (NewComponentCostYearData.Count > 0)
                {
                    var NewCostYearToAdd = NewCostToAdd
                        .SelectMany(a =>
                            NewComponentCostYearData
                            .Where(x => x.ComponentId == a.ComponentId)
                            .Select(year => new ProjectComponentCostPerYear
                            {
                                ComponentCostFK = a.Id,
                                ComponentId = year.ComponentId,
                                Amount = year.Amount,
                                Year = year.Year,
                                UACS = year.UACS,
                                StartDate = year.StartDate,
                                EndDate = year.EndDate,
                                CreatedBy = UserId,
                                CreatedDate = CurrentDate
                            }))
                        .ToList();
                    await _db.tProjectComponentCostPerYear.AddRangeAsync(NewCostYearToAdd, cancellationToken);
                }
                #endregion

                #region Update Major Item of Works
                var MajorItemOfWorks = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => ComponentCostIds.Contains(x.ComponentCostFK) && !x.IsDeleted).ToListAsync(cancellationToken);
                if (MajorItemOfWorks.Count > 0)
                {
                    var currentMajorItemIds = new HashSet<int>(MajorItemOfWorks.Select(x => x.Id));
                    var UpdateMajorItems = dto.MajorItemOfWorks.Where(x => currentMajorItemIds.Contains(x.Id)).ToList();
                    if (UpdateMajorItems.Count > 0)
                    {
                        var UpdatedWorkItemIds = UpdateMajorItems.Select(x => x.Id).ToHashSet();
                        var UpdatedWorkLocations = dto.MajorItemLocations.Where(x => UpdatedWorkItemIds.Contains(x.WorkItemFK)).ToList();
                        foreach (var item in UpdateMajorItems)
                        {
                            var ExistingItem = MajorItemOfWorks.FirstOrDefault(x => x.Id == item.Id);
                            if (ExistingItem != null)
                            {
                                bool hasUpdate = false;
                                if (ExistingItem.YearOfWork != item.YearOfWork)
                                {
                                    hasUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectMajorWorkItem",
                                        AffectedColumn = "YearOfWork",
                                        NewValue = item.YearOfWork.ToString(),
                                        OldValue = ExistingItem.YearOfWork.ToString(),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.YearOfWork = item.YearOfWork;
                                }
                                if (ExistingItem.WorkTypeFK != item.WorkTypeFK)
                                {
                                    hasUpdate = true;
                                    if (!scopeOfWorkLookup.TryGetValue(item.WorkTypeFK, out var WorkTypeEnum))
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Work Type '{item.WorkTypeFK}' is not valid.", Title = "Invalid Work Type" });
                                    }
                                    scopeOfWorkLookup.TryGetValue(ExistingItem.WorkTypeFK, out var oldWorkType);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectMajorWorkItem",
                                        AffectedColumn = "WorkTypeFK",
                                        NewValue = WorkTypeEnum.Description,
                                        OldValue = oldWorkType?.Description ?? "",
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.WorkTypeFK = item.WorkTypeFK;
                                }
                                if (ExistingItem.InfraTypeFK != item.InfraTypeFK)
                                {
                                    hasUpdate = true;
                                    if (!infraTypeLookup.TryGetValue(item.InfraTypeFK, out var Infra))
                                    {
                                        return new BadRequestObjectResult(new { Message = $"Selected Infrastructure Type '{item.InfraTypeFK}' is not valid.", Title = "Invalid Infrastructure Type" });
                                    }
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectMajorWorkItem",
                                        AffectedColumn = "InfraTypeFK",
                                        NewValue = Infra.InfraName,
                                        OldValue = ExistingItem.InfraTypeFK,
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.InfraTypeFK = item.InfraTypeFK;
                                }
                                if (item.IsDeleted == true)
                                {
                                    hasUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Delete.ToString(),
                                        AffectedTable = "tProjectMajorWorkItem",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (hasUpdate)
                                {
                                    ExistingItem.UpdatedBy = UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectMajorWorkItem.Update(ExistingItem);
                                }
                            }
                        }
                        #region Update Locations for Updated Major Items
                        var CurrentLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => UpdatedWorkItemIds.Contains(x.WorkItemFK) && !x.IsDeleted).ToListAsync(cancellationToken);
                        HashSet<int> CurrentLocationIds = CurrentLocations.Select(x => x.Id).ToHashSet();
                        var UpdateLocations = UpdatedWorkLocations.Where(x => x.Id > 0 && CurrentLocationIds.Contains(x.Id)).ToList();
                        if (UpdateLocations.Count > 0)
                        {
                            foreach (var loc in UpdateLocations)
                            {
                                var ExistingLoc = CurrentLocations.FirstOrDefault(x => x.Id == loc.Id);
                                if (ExistingLoc != null)
                                {
                                    bool hasLocUpdate = false;
                                    if (ExistingLoc.InfraId != loc.InfraId) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "InfraId", NewValue = loc.InfraId, OldValue = ExistingLoc.InfraId, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.InfraId = loc.InfraId; }
                                    if (ExistingLoc.DetailedScope != loc.DetailedScope) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "DetailedScope", NewValue = loc.DetailedScope ?? "", OldValue = ExistingLoc.DetailedScope ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.DetailedScope = loc.DetailedScope; }
                                    if (ExistingLoc.TargetUnit != loc.TargetUnit) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "TargetUnit", NewValue = loc.TargetUnit ?? "", OldValue = ExistingLoc.TargetUnit ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.TargetUnit = loc.TargetUnit; }
                                    if (ExistingLoc.TargetUnitId != loc.TargetUnitId) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "TargetUnitId", NewValue = loc.TargetUnitId.ToString(), OldValue = ExistingLoc.TargetUnitId.ToString(), CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.TargetUnitId = loc.TargetUnitId; }
                                    if (ExistingLoc.StartX != loc.StartX) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartX", NewValue = loc.StartX.ToString() ?? "", OldValue = ExistingLoc.StartX.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.StartX = loc.StartX; }
                                    if (ExistingLoc.StartY != loc.StartY) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartY", NewValue = loc.StartY.ToString() ?? "", OldValue = ExistingLoc.StartY.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.StartY = loc.StartY; }
                                    if (ExistingLoc.EndX != loc.EndX) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndX", NewValue = loc.EndX.ToString() ?? "", OldValue = ExistingLoc.EndX.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.EndX = loc.EndX; }
                                    if (ExistingLoc.EndY != loc.EndY) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndY", NewValue = loc.EndY.ToString() ?? "", OldValue = ExistingLoc.EndY.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.EndY = loc.EndY; }
                                    if (ExistingLoc.PhysicalTarget != loc.PhysicalTarget) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "PhysicalTarget", NewValue = loc.PhysicalTarget.ToString(), OldValue = ExistingLoc.PhysicalTarget.ToString(), CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.PhysicalTarget = loc.PhysicalTarget; }
                                    if (ExistingLoc.StartStationLimit != loc.StartStationLimit) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartStationLimit", NewValue = loc.StartStationLimit ?? "", OldValue = ExistingLoc.StartStationLimit ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.StartStationLimit = loc.StartStationLimit; }
                                    if (ExistingLoc.EndStationLimit != loc.EndStationLimit) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndStationLimit", NewValue = loc.EndStationLimit ?? "", OldValue = ExistingLoc.EndStationLimit ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.EndStationLimit = loc.EndStationLimit; }
                                    if (ExistingLoc.EndChainage != loc.EndChainage) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndChainage", NewValue = loc.EndChainage.ToString() ?? "", OldValue = ExistingLoc.EndChainage.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.EndChainage = loc.EndChainage; }
                                    if (ExistingLoc.StartChainage != loc.StartChainage) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartChainage", NewValue = loc.StartChainage.ToString() ?? "", OldValue = ExistingLoc.StartChainage.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.StartChainage = loc.StartChainage; }
                                    if (ExistingLoc.Length != loc.Length) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "Length", NewValue = loc.Length.ToString() ?? "", OldValue = ExistingLoc.Length.ToString() ?? "", CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.Length = loc.Length; }
                                    if (loc.IsDeleted == true) { hasLocUpdate = true; transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Delete.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "Row", NewValue = "", OldValue = JsonConvert.SerializeObject(ExistingLoc), CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingLoc.IsDeleted = loc.IsDeleted; }
                                    if (hasLocUpdate)
                                    {
                                        ExistingLoc.UpdatedBy = UserId;
                                        ExistingLoc.UpdatedDate = CurrentDate;
                                        _db.tProjectMajorWorkLocations.Update(ExistingLoc);
                                    }
                                }
                            }
                        }
                        #endregion
                        #region New Locations for Updated Major Items
                        var NewLocationsForUpdatedItems = UpdatedWorkLocations.Where(x => x.Id == 0 && x.WorkItemFK > 0).ToList();
                        if (NewLocationsForUpdatedItems.Count > 0)
                        {
                            await _db.tProjectMajorWorkLocations.AddRangeAsync(NewLocationsForUpdatedItems.Select(item => new ProjectMajorWorkLocations
                            {
                                WorkItemFK = item.WorkItemFK,
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
                                StartChainage = item.StartChainage,
                                EndChainage = item.EndChainage,
                                Length = item.Length,
                                CreatedBy = UserId,
                                CreatedDate = CurrentDate
                            }), cancellationToken);
                        }
                        #endregion
                    }
                }
                #endregion

                #region New Major Item of Works
                // NOTE — join source (NewCostToAdd) and SaveChangesAsync preserved exactly
                // as original; see the note on "New Component Cost with components relations"
                // above.
                List<ProjectMajorWorkItem> NewWorkItems = new List<ProjectMajorWorkItem>();
                var newMajorItems = dto.MajorItemOfWorks.Where(x => x.Id == 0 && !x.IsDeleted && ComponentCostTypeIds.Contains(x.ComponentId)).ToList();
                if (newMajorItems.Count > 0)
                {
                    var selectedWorkItemsToAdd = NewCostToAdd
                        .SelectMany(a =>
                            newMajorItems
                            .Where(x => x.ComponentId == a.ComponentId)
                            .Select(item => new ProjectMajorWorkItem
                            {
                                ComponentCostFK = a.Id,
                                ComponentId = item.ComponentId,
                                YearOfWork = item.YearOfWork,
                                WorkTypeFK = item.WorkTypeFK,
                                InfraTypeFK = item.InfraTypeFK,
                                CreatedBy = UserId,
                                CreatedDate = CurrentDate
                            }))
                        .ToList();
                    NewWorkItems.AddRange(selectedWorkItemsToAdd);
                    await _db.tProjectMajorWorkItem.AddRangeAsync(NewWorkItems, cancellationToken);
                    await _db.SaveChangesAsync();
                }
                #endregion

                #region Update Major Work Locations
                HashSet<int> WorkItemIds = MajorItemOfWorks.Select(x => x.Id).ToHashSet();
                var MajorWorkLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => WorkItemIds.Contains(x.WorkItemFK) && !x.IsDeleted).ToListAsync(cancellationToken);
                if (MajorWorkLocations.Count > 0)
                {
                    HashSet<int> currentMajorItemIds = MajorWorkLocations.Select(x => x.Id).ToHashSet();
                    var UpdateMajorItems = dto.MajorItemLocations.Where(x => currentMajorItemIds.Contains(x.Id)).ToList();
                    foreach (var item in UpdateMajorItems)
                    {
                        var ExistingItem = MajorWorkLocations.FirstOrDefault(x => x.Id == item.Id);
                        if (ExistingItem != null)
                        {
                            if (ExistingItem.InfraId != item.InfraId) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "InfraId", NewValue = item.InfraId, OldValue = ExistingItem.InfraId, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.InfraId = item.InfraId; }
                            if (ExistingItem.DetailedScope != item.DetailedScope) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "DetailedScope", NewValue = item.DetailedScope, OldValue = ExistingItem.DetailedScope, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.DetailedScope = item.DetailedScope; }
                            if (ExistingItem.TargetUnitId != item.TargetUnitId) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "TargetUnitId", NewValue = item.TargetUnitId.ToString()!, OldValue = ExistingItem.TargetUnitId.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.TargetUnitId = item.TargetUnitId; }
                            if (ExistingItem.TargetUnit != item.TargetUnit) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "TargetUnit", NewValue = item.TargetUnit, OldValue = ExistingItem.TargetUnit, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.TargetUnit = item.TargetUnit; }
                            if (ExistingItem.StartX != item.StartX) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartX", NewValue = item.StartX?.ToString()!, OldValue = ExistingItem.StartX?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.StartX = item.StartX; }
                            if (ExistingItem.StartY != item.StartY) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndX", NewValue = item.EndX?.ToString()!, OldValue = ExistingItem.EndX?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.EndX = item.EndX; }
                            if (ExistingItem.EndX != item.EndX) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndX", NewValue = item.EndX?.ToString()!, OldValue = ExistingItem.EndX?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.EndX = item.EndX; }
                            if (ExistingItem.EndY != item.EndY) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndY", NewValue = item.EndY?.ToString()!, OldValue = ExistingItem.EndY?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.EndY = item.EndY; }
                            if (ExistingItem.PhysicalTarget != item.PhysicalTarget) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "PhysicalTarget", NewValue = item.PhysicalTarget.ToString()!, OldValue = ExistingItem.PhysicalTarget?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.PhysicalTarget = item.PhysicalTarget; }
                            if (ExistingItem.StartStationLimit != item.StartStationLimit) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartStationLimit", NewValue = item.StartStationLimit?.ToString()!, OldValue = ExistingItem.StartStationLimit?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.StartStationLimit = item.StartStationLimit; }
                            if (ExistingItem.EndStationLimit != item.EndStationLimit) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndStationLimit", NewValue = item.EndStationLimit?.ToString()!, OldValue = ExistingItem.EndStationLimit?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.EndStationLimit = item.EndStationLimit; }
                            if (ExistingItem.StartChainage != item.StartChainage) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "StartChainage", NewValue = item.StartChainage?.ToString()!, OldValue = ExistingItem.StartChainage?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.StartChainage = item.StartChainage; }
                            if (ExistingItem.EndChainage != item.EndChainage) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "EndChainage", NewValue = item.EndChainage?.ToString()!, OldValue = ExistingItem.EndChainage?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.EndChainage = item.EndChainage; }
                            if (ExistingItem.Length != item.Length) { transactionLogs.Add(new TransactionLog { ReferenceId = ProjectId, TransactionType = EnumTransactionType.Update.ToString(), AffectedTable = "tProjectMajorWorkLocations", AffectedColumn = "Length", NewValue = item.Length?.ToString()!, OldValue = ExistingItem.Length?.ToString()!, CreatedBy = UserId, CreatedDate = CurrentDate }); ExistingItem.Length = item.Length; }
                        }
                    }
                }
                #endregion

                #region New Major Work Locations
                // NOTE — preserved exactly as original: WorkItemFK is taken from the DTO's
                // own WorkItemFK field, not from the just-generated NewWorkItems entity Id.
                // See the note on "New Component Cost with components relations" above.
                var NewWorkLocations = dto.MajorItemLocations.Where(x => x.Id == 0 && !x.IsDeleted && ComponentCostTypeIds.Contains(x.ComponentId)).ToList();
                if (NewWorkLocations.Count > 0)
                {
                    var selectedWorkLocationsToAdd = NewWorkItems
                        .SelectMany(a =>
                            NewWorkLocations
                            .Where(x => x.ComponentId == a.ComponentId)
                            .Select(item => new ProjectMajorWorkLocations
                            {
                                WorkItemFK = item.WorkItemFK,
                                ComponentId = item.ComponentId,
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
                                StartChainage = item.StartChainage,
                                EndChainage = item.EndChainage,
                                Length = item.Length,
                                CreatedBy = UserId,
                                CreatedDate = CurrentDate
                            }))
                        .ToList();
                    await _db.tProjectMajorWorkLocations.AddRangeAsync(selectedWorkLocationsToAdd, cancellationToken);
                }
                #endregion

                #region Update Funding Profile
                var CurrentFunding = await _db.tProjectFundingProfile.AsNoTracking().Where(x => x.ProjectRevisionFK == ProjectRevisionFK).ToListAsync(cancellationToken);
                if (CurrentFunding.Count > 0)
                {
                    var CurrentIds = dto.FundingProfile.Where(x => x.Id != 0).Select(x => x.Id).ToHashSet();
                    var DeleteFunding = CurrentFunding.Where(x => !CurrentIds.Contains(x.Id)).ToList();
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
                                if (ExistingItem.SourceOrg != item.SourceOrg)
                                {
                                    FundingUpdate = true;
                                    fundingSourceLookup.TryGetValue(ExistingItem.SourceOrg, out var CurrentSource);
                                    fundingSourceLookup.TryGetValue(item.SourceOrg, out var NewSource);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Source",
                                        NewValue = NewSource!.Name,
                                        OldValue = CurrentSource!.Name,
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.SourceOrg = item.SourceOrg;
                                }
                                if (ExistingItem.AgreementCode != item.AgreementCode)
                                {
                                    FundingUpdate = true;
                                    fundingAgreementLookup.TryGetValue(ExistingItem.AgreementCode, out var CurrentAgreement);
                                    fundingAgreementLookup.TryGetValue(item.AgreementCode, out var NewAgreement);
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Agreement",
                                        NewValue = NewAgreement!.Name,
                                        OldValue = CurrentAgreement!.Name,
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.AgreementCode = item.AgreementCode;
                                }
                                if (ExistingItem.Amount != item.Amount)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Amount",
                                        NewValue = item.Amount.ToString(),
                                        OldValue = ExistingItem.Amount.ToString(),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Amount = item.Amount;
                                }
                                if (ExistingItem.Percentage != item.Percentage)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Update.ToString(),
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Percentage",
                                        NewValue = item.Percentage.ToString(),
                                        OldValue = ExistingItem.Percentage.ToString(),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.Percentage = item.Percentage;
                                }
                                if (item.IsDeleted == true)
                                {
                                    FundingUpdate = true;
                                    transactionLogs.Add(new TransactionLog
                                    {
                                        ReferenceId = ProjectId,
                                        TransactionType = EnumTransactionType.Delete.ToString(),
                                        AffectedTable = "tProjectFundingProfile",
                                        AffectedColumn = "Row",
                                        NewValue = "",
                                        OldValue = JsonConvert.SerializeObject(ExistingItem),
                                        CreatedBy = UserId,
                                        CreatedDate = CurrentDate
                                    });
                                    ExistingItem.IsDeleted = item.IsDeleted;
                                }
                                if (FundingUpdate)
                                {
                                    ExistingItem.UpdatedBy = UserId;
                                    ExistingItem.UpdatedDate = CurrentDate;
                                    _db.tProjectFundingProfile.Update(ExistingItem);
                                }
                            }
                        }
                    }
                }
                var NewFunding = dto.FundingProfile.Where(x => x.Id == 0).ToList();
                if (NewFunding.Count > 0)
                {
                    var addFunding = dto.FundingProfile.Select(x => new ProjectFundingProfile
                    {
                        ProjectRevisionFK = ProjectRevisionFK!,
                        SourceOrg = x.SourceOrg,
                        AgreementCode = x.AgreementCode,
                        Amount = x.Amount,
                        Percentage = x.Percentage,
                        IsWalletDraw = false,
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    });
                    await _db.tProjectFundingProfile.AddRangeAsync(addFunding, cancellationToken);
                }
                #endregion

                await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);

                // Same final flush as the original (the mid-method saves earlier in this
                // method — for New Component Cost / New Major Item of Works — are unchanged;
                // see the file header for why).
                await _db.SaveChangesAsync(cancellationToken);

                if (HasCostUpdate)
                {
                    var parameters = new DynamicParameters();
                    parameters.Add("ProgramPK", ProgramFK);

                    var employees = await Sql.QueryAsync<dynamic>(
                        Appsetting.DbConnections.MYPSDb,
                        "pRecomputeProgramCost",
                        parameters,
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: cancellationToken);

                    int totalCount = parameters.Get<int>("TotalCount");
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
        #endregion
    }
}
