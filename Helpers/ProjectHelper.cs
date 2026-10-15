using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Table.Lookups;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;
using System.Text.RegularExpressions;
using static Helpers.ProjectHelper;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;

namespace Helpers
{
    public static class ProjectHelper
    {
        public class ProjectHelperResponse<T>
        {
            public bool IsValid { get; set; } = false;
            public string Title { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public T? Data { get; set; }
        }

        #region ValidateProjectId
        public class ValidateProjectIdDataResult
        {
            public DBHelper.Models.Table.Project.Projects Project { get; set; } = new DBHelper.Models.Table.Project.Projects();
            public DBHelper.Models.Functions.Project.ProjectDetails ProjectRevision { get; set; } = new DBHelper.Models.Functions.Project.ProjectDetails();
            public DBHelper.Models.Table.Project.ProjectStages ProjectStage { get; set; } = new DBHelper.Models.Table.Project.ProjectStages();
        }
        public class ValidateProjectIdParams
        {
            public string ProjectId { get; set; } = string.Empty;
            public string StageName { get; set; } = string.Empty;
            public DBHelper.Models.Views.Users _Session { get; set; } = new DBHelper.Models.Views.Users();
            public bool ViewOldStage { get; set; } = false;
        }
        public static async Task<ProjectHelperResponse<ValidateProjectIdDataResult>> ValidateProjectId(this MYPSDbContext _db, ValidateProjectIdParams p, CancellationToken cancellationToken)
        {
            var response = new ProjectHelperResponse<ValidateProjectIdDataResult>();
            if (string.IsNullOrWhiteSpace(p.ProjectId))
            {
                response.Message = "Project ID cannot be null or empty.";
                response.Title = "Invalid Project ID";
                return response;
            }
            if (!Enum.TryParse<EnumProgramStage>(p.StageName.Replace("-", ""), out var SelectedStage))
            {
                response.Title = "Invalid Stage";
                response.Message = $"'{p.StageName}' is not a valid program stage.";
                return response;
            }
            var GetProjectPK = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == p.ProjectId, cancellationToken);
            if (GetProjectPK == null)
            {
                response.Title = "Project Not Found";
                response.Message = $"The Project with ID '{p.ProjectId}' does not exist in the system.";
                return response;
            }
            if (p._Session.ApplyFilter)
            {
                var FilterProject = await _db.fUserVisibleProjects.FromSqlInterpolated($"SELECT * FROM fUserVisibleProjects({p._Session.UserId}) p WHERE p.ProjectPK = {GetProjectPK.ProjectFK}").FirstOrDefaultAsync(cancellationToken);
                if (FilterProject == null)
                {
                    response.Title = "Access Denied";
                    response.Message = $"You do not have permission to update the Project with ID '{p.ProjectId}'. Please contact your administrator.";
                    return response;
                }
            }
            var CheckProjectStage = await _db.fProjectStages
                .FromSqlInterpolated($"SELECT * FROM fProjectStages({GetProjectPK.ProjectFK}) WHERE StageName = {p.StageName} AND ProjectId = {p.ProjectId}")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
            if (CheckProjectStage == null)
            {
                response.Title = "Stage Not Found";
                response.Message = $"The stage '{p.StageName}' does not exist for the Project with ID '{p.ProjectId}'.";
                return response;
            }
            if (!p.ViewOldStage)
            {
                var currentVersion = await _db.vProjectLatest.FirstOrDefaultAsync(x => x.ProjectId == p.ProjectId, cancellationToken);
                if (currentVersion == null)
                {
                    response.Title = "Outdated Project Stage";
                    response.Message = "You are viewing an old stage of this Project. Please go back to the Project List and open the Project again to view the latest stage.";
                    return response;
                }
            }
            var ProjectParent = await _db.tProjects.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectPK == GetProjectPK.ProjectFK, cancellationToken);
            if (ProjectParent == null)
            {
                response.Title = "Project Not Found";
                response.Message = $"The Project with ID '{p.ProjectId}' does not exist in the system.";
                return response;
            }
            response.Data = new ValidateProjectIdDataResult();
            var GetProjectRevision = await _db.fProjectDetails.FromSqlInterpolated($"SELECT * FROM fProjectDetails({CheckProjectStage.ProjectPK}, {CheckProjectStage.StageId})").AsNoTracking().FirstOrDefaultAsync(cancellationToken);
            if(GetProjectRevision == null)
            {
                response.Title = "Project Revision Not Found";
                response.Message = $"The Project revision for Project ID '{p.ProjectId}' does not exist in the system.";
                return response;
            }
            var GetProjectStage = await _db.tProjectStages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == CheckProjectStage.Id, cancellationToken);
            if (GetProjectStage == null)
            {
                response.Title = "Project Stage Not Found";
                response.Message = $"The Project stage for Project ID '{p.ProjectId}' does not exist in the system.";
                return response;
            }
            response.IsValid = true;
            response.Data.Project = ProjectParent;
            response.Data.ProjectRevision = GetProjectRevision;
            response.Data.ProjectStage = GetProjectStage;
            return response;
        }
        #endregion

        #region GenerateProjectId
        public class GenerateProjectIDParams
        {
            public int CategoryId { get; set; }
            public string StageName { get; set; } = string.Empty;
            public string IslandCode { get; set; } = string.Empty;
            public int YearStart { get; set; }
            public int Count { get; set; } = 1;
        }

        // RISK-072 follow-up (2026-09-08): raised when dbo.pReserveProjectIdBlock's Maximum check
        // (added the same day) rejects a reservation because the category's ID range is fully used.
        public sealed class ProjectIdRangeExhaustedException : InvalidOperationException
        {
            public int CategoryId { get; }
            public ProjectIdRangeExhaustedException(int categoryId, string message) : base(message)
            {
                CategoryId = categoryId;
            }
        }

        // RISK-072 follow-up (2026-09-19): raised when the block dbo.pReserveProjectIdBlock
        // reserved produces a ProjectId that already exists in tProjects.ProjectPK -- the
        // allocator's counter is behind rows already present for that bucket. Distinct from
        // ProjectIdRangeExhaustedException (that one means the bucket is fully used up; this one
        // means the counter itself is desynced from real data).
        public sealed class ProjectIdCollisionException : InvalidOperationException
        {
            public string ProjectId { get; }
            public ProjectIdCollisionException(string projectId, string message) : base(message)
            {
                ProjectId = projectId;
            }
        }
        // RISK-105/RISK-111 fix (2026-08-31): rewired off dbo.pGenerateThirdSegment (unlocked
        // check-then-act loop, and its own post-generation duplicate check had been deleted by
        // commit 446d6318) onto dbo.pReserveProjectIdBlock (ADR-043's atomic hi-lo block
        // allocator, UPDLOCK/HOLDLOCK -- no check-then-act gap). Output format is byte-identical
        // to before ({Prefix}{YearOffset:3}{Sequence:5}{IslandCode}) -- only the allocation
        // mechanism changed, per the client URD's fixed segment format.
        public static async Task<string> GenerateProjectID(this MYPSDbContext _db, GenerateProjectIDParams request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(_db);
            ArgumentNullException.ThrowIfNull(request);

            string FirstSegment = request.StageName.GenerateProjec1stSegment();
            string SecondSegment = request.YearStart.GenerateProjec2ndSegment();

            if (request.CategoryId <= 0)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(request.CategoryId),
                    "Project ID generation failed: CategoryId must be greater than zero.");
            }

            bool categoryExists = await _db.tOptionProjectCategory
                .AsNoTracking()
                .AnyAsync(x => x.CategoryId == request.CategoryId, cancellationToken);

            if (!categoryExists)
            {
                throw new InvalidOperationException(
                    $"Project ID generation failed: CategoryId '{request.CategoryId}' does not exist in tOptionProjectCategory.");
            }

            // RISK-072 fix (2026-09-19): this reservation MUST NOT share the caller's ambient
            // transaction. dbo.pReserveProjectIdBlock has no BEGIN TRAN/COMMIT of its own, so
            // running it on _db's connection/transaction meant a later transaction.RollbackAsync()
            // in AddProject's catch block (e.g. triggered by the duplicate check below) silently
            // undid the counter's own increment -- re-issuing the identical already-used value on
            // every subsequent retry, forever. A hi-lo allocator's reservation must be durable
            // even when the surrounding business operation fails; a harmless gap from an unused
            // reservation is fine, re-issuing a consumed value is not. Use a dedicated connection
            // so this call commits independently, outside of _db's transaction entirely.
            await using var reservationConnection = new SqlConnection(_db.Database.GetConnectionString());
            await reservationConnection.OpenAsync(cancellationToken);

            // RISK-072 fix (2026-09-19): retry past a collision instead of failing outright.
            // Each pReserveProjectIdBlock call durably advances the counter by exactly 1 (see the
            // dedicated-connection note above), so a retry always evaluates a genuinely new value
            // -- e.g. a project whose stage-advance swap already took P01012345LZ no longer blocks
            // a new project, which simply advances to P01012346LZ. The cap is deliberately small:
            // once the counter is durable and category ranges don't overlap, needing more than one
            // retry means live concurrent contention, not stale data. Range exhaustion is NOT
            // caught here -- it propagates, so the category's real Maximum stays the terminal
            // condition and needs no separate logic.
            const int maxAttempts = 3;
            string collidedProjectId = string.Empty;

            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var parameters = new DynamicParameters();
                parameters.Add("@CategoryId", request.CategoryId, DbType.Int32, ParameterDirection.Input);
                parameters.Add("@Suffix", FirstSegment, DbType.String, ParameterDirection.Input);
                parameters.Add("@IslandCode", request.IslandCode ?? string.Empty, DbType.String, ParameterDirection.Input);
                parameters.Add("@YearStart", request.YearStart, DbType.Int32, ParameterDirection.Input);
                parameters.Add("@Count", 1, DbType.Int32, ParameterDirection.Input);
                parameters.Add("@RangeStart", dbType: DbType.Int32, direction: ParameterDirection.Output);
                parameters.Add("@RangeEnd", dbType: DbType.Int32, direction: ParameterDirection.Output);

                try
                {
                    var command = new CommandDefinition(
                        commandText: "dbo.pReserveProjectIdBlock",
                        parameters: parameters,
                        commandTimeout: 120,
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: cancellationToken);

                    await reservationConnection.ExecuteAsync(command);
                }
                catch (SqlException ex) when (ex.Message.Contains("PROJECTID_RANGE_EXHAUSTED:"))
                {
                    throw new ProjectIdRangeExhaustedException(
                        request.CategoryId,
                        $"Project ID generation failed: Category {request.CategoryId}'s ID range has been fully exhausted. Contact an administrator to expand the range.");
                }

                int rangeStart = parameters.Get<int>("@RangeStart");
                int rangeEnd = parameters.Get<int>("@RangeEnd");

                if (rangeStart <= 0 || rangeEnd < rangeStart)
                {
                    throw new InvalidOperationException(
                        "Project ID generation failed: dbo.pReserveProjectIdBlock returned an invalid range.");
                }

                string ThirdSegment = rangeStart.ToString("D5");
                string ProjectId = $"{FirstSegment}{SecondSegment}{ThirdSegment}{request.IslandCode}";

                // RISK-072 fix (2026-09-19): check BOTH tables, not just tProjects.ProjectPK.
                // ProgramController's stage-advance swap rewrites tProjectRevisions.ProjectId to
                // the P-prefixed form but never updates tProjects.ProjectPK, so a swapped value is
                // invisible to a tProjects-only check -- letting a later unrelated AddProject mint
                // a real duplicate. Mirrors the two-table shape ProgramController's own swap
                // collision check already uses.
                bool duplicateExists = await _db.tProjects
                    .AsNoTracking()
                    .AnyAsync(x => x.ProjectPK == ProjectId, cancellationToken)
                    || await _db.tProjectRevisions
                    .AsNoTracking()
                    .AnyAsync(x => x.ProjectId == ProjectId && !x.IsDeleted, cancellationToken);

                if (!duplicateExists)
                {
                    return ProjectId;
                }

                collidedProjectId = ProjectId;
            }

            throw new ProjectIdCollisionException(
                collidedProjectId,
                $"Project ID generation failed: still colliding after {maxAttempts} attempts (last tried '{collidedProjectId}'). The allocator counter is likely out of sync with existing data -- verify dbo.tProjectIdSequence against dbo.tProjects/dbo.tProjectRevisions for this category, suffix, island and year before retrying.");
        }
        public static string GenerateProjec1stSegment(this string StageName)
        {
            var stageGroups = new Dictionary<string, string[]>
            {
                { "BP", new[] { "BP", "RBP", "UPMO", "UBP" } },
                { "MY", new[] { "RDIP", "UDIP", "PIP" } },
                { "P",  new[] { "NEP", "HGAB", "GAA" } }
            };
            return stageGroups.FirstOrDefault(g => g.Value.Contains(StageName)).Key ?? "P";
        }
        public static string GenerateProjec2ndSegment(this int endYear)
        {
            int startYear = 2016;
            int count = endYear - startYear;
            return count.ToString("D3");
        }
        #endregion

        #region ValidateProjectDetailsLookups
        public class ValidateProjectDetailsLookupsParams
        {
            public DBHelper.Models.Views.Users _Session { get; set; } = new DBHelper.Models.Views.Users();
            public int Tier { get; set; }
            public int Category { get; set; }
            public string Region { get; set; } = string.Empty;
            public string Province { get; set; } = string.Empty;
            public string City { get; set; } = string.Empty;
            public string LegislativeDistrict { get; set; } = string.Empty;
            public string DEO { get; set; } = string.Empty;
            public string ImplementingOffice { get; set; } = string.Empty;
            public string OperatingUnit { get; set; } = string.Empty;
            public int Origin { get; set; }
            public int Agency { get; set; }
            public int? ImplementationMode { get; set; }
            public int? EmergencyMode { get; set; }
            public int? RowAvailable { get; set; }
            public int? Feasibility { get; set; }
            public DateTime? FeasibilityDate { get; set; }
            public int? DetailedDesign { get; set; }
            public DateTime? DetailedDesignDate { get; set; }
            public int? Thrust { get; set; }
            // RISK-072-adjacent fix (2026-09-11, Option A per
            // documents/docs/engineering/MYPS_PROJECT_THRUST_CATEGORY_VALIDATION_RCA_AND_DECISION.md
            // Section 9): the project's currently-stored Thrust, so the Category-mapping check below
            // can tell "resubmitted unchanged because the frontend posts the whole form every save"
            // apart from "the user is actually picking a new Thrust". Left null by AddProject (no
            // prior state -- new projects are always fully validated); UpdateProjectDetails supplies
            // it from the already-loaded ProjectRevision entity. Mirrors the diff-gate
            // RevisionController.ResubmitRevision already has for the same check (its
            // `if (ExistingRevisionProject.Thrust != RevisionProject.Thrust)` guard), just applied
            // here instead of being an accidental side effect of that method's own diff pattern.
            public int? PreviousThrust { get; set; }
            // 2026-09-12: the gate watches BOTH fields. A save skips the pair check only while the
            // stored Category AND the stored Sub-Category are untouched; changing either one is a
            // new choice and re-validates the pair, so an orphaned legacy Sub-Category cannot be
            // re-homed under a Category it does not fit. Supplied beside PreviousThrust by
            // UpdateProjectDetails; left null by AddProject.
            public int? PreviousCategory { get; set; }
        }
        public static async Task<ProjectHelperResponse<string>> ValidateProjectDetailsLookups(this MYPSDbContext _db, ValidateProjectDetailsLookupsParams p, CancellationToken cancellationToken)
        {
            var response = new ProjectHelperResponse<string>();
            response.Data = string.Empty;
            var ValidateTier = await _db.tOptionProjectTier.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Tier, cancellationToken);
            if (ValidateTier == null)
            {
                response.Message = $"Selected Tier '{p.Tier}' is not valid."; response.Title = "Invalid Tier";
                return response;
            }
            DateTime CurrentDate = Functions.CurrentDate();
            var ValidateCategory = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == p.Category && (x.IsActive || (x.ValidUntil == 0 || x.ValidUntil >= CurrentDate.Year)), cancellationToken);
            if (ValidateCategory == null)
            {
                response.Message = $"Selected Category '{p.Category}' is not valid."; response.Title = "Invalid Category";
                return response;
            }

            // Thrust existence + the Category<->Thrust mapping + the Option A grandfather gate.
            // ONE implementation, ValidateThrustForCategoryAsync (below), shared with the Lump Sum
            // save and ResubmitRevision. History, so nobody re-inlines it: the 2026-09-10 fix put
            // the rule here; 2026-09-11 extracted it; the Option A rebase re-inlined a copy that
            // (a) queried vProjectThrustByCategory, a view that exists on neither localhost
            // database and has no DDL in this repo -- every AddProject with a Sub-Category threw
            // "Invalid object name" -- and (b) read a -1 wildcard beside a specific row as a
            // RESTRICTION, the opposite of the operator's rule. Converged again 2026-09-12; the
            // shared method's header carries the rule and the gate.
            var ValidateThrustPair = await _db.ValidateThrustForCategoryAsync(
                p.Category, p.Thrust, p.PreviousCategory, p.PreviousThrust, cancellationToken);
            if (!ValidateThrustPair.IsValid)
                return ValidateThrustPair;
            string UserId = p._Session.UserId;
            var ValidateRegion = await _db.fUserVisibleRegions
                .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleRegions({UserId})")
                .AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == p.Region, cancellationToken);
            if (ValidateRegion == null)
            {
                response.Message = $"Selected Region '{p.Region}' is not valid."; response.Title = "Invalid Region";
                return response;
            }
            string RegionParticipantId = p.Region;//ValidateRegion.ParticipantId;

            var ValidateProvince = await _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefaultAsync(x => x.RegionParticipantId == RegionParticipantId && x.Code == p.Province && !x.Deprecated, cancellationToken);
            if (ValidateProvince == null)
            {
                response.Message = $"Selected Province '{p.Province}' is not valid."; response.Title = "Invalid Province";
                return response;
            }
            string ProvinceCode = ValidateProvince!.Code;

            var ValidateCity = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.ProvinceCode == ProvinceCode && x.Code == p.City && !x.Deprecated, cancellationToken);
            if (ValidateCity == null)
            {
                response.Message = $"Selected City/Municipality '{p.City}' is not valid."; response.Title = "Invalid City/Municipality";
                return response;
            }

            var ValidateLD = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => ProvinceCode == x.ProvinceCode && x.Code == p.LegislativeDistrict && !x.Deprecated, cancellationToken);
            if (ValidateLD == null)
            {
                response.Message = $"Selected Legislative District '{p.LegislativeDistrict}' is not valid."; response.Title = "Invalid Legislative District";
                return response;
            }

            // 2026-09-10 fix: these 3 checks used to require x.RegionParticipantId to exactly equal
            // the project's own Region -- but DEO/ImplementingOffice/OperatingUnit include org-wide
            // entities (Central Office and several central "Cluster"/Bureau-level Implementing
            // Offices) whose RegionParticipantId is NULL by design, since they aren't scoped to any
            // single region. A strict equality can never match NULL, so selecting one of these
            // always failed here -- confirmed live on myps_db_dev: 41,496 of 118,438 project
            // revisions (35%) already have OperatingUnit='Central Office' and could no longer be
            // saved through UpdateProjectDetails for ANY reason (this check runs unconditionally on
            // every save), plus 174 more via 6 org-wide Implementing Offices; AddProject was
            // blocked too, since it calls this same method. ShowProjectDropdowns
            // (WebAPI/Controllers/Projects/ProjectController.cs:48-51) already treats a null-region
            // row as valid for everyone (`|| string.IsNullOrEmpty(x.RegionParticipantId)`), and the
            // frontend's own OU filter (FE/src/pages/Project/filteringLocations/locationFilterUtils.ts)
            // already always allows OrgType 'CO' -- this brings the save-time check in line with
            // logic that was already correct on both other sides. DEO currently has zero
            // null-region rows in live data (unlike IO/OU), so this is currently a no-op for DEO,
            // fixed anyway for consistency across all 3 checks.
            var ValidateDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => (RegionParticipantId == x.RegionParticipantId! || string.IsNullOrEmpty(x.RegionParticipantId)) && x.ParticipantId == p.DEO, cancellationToken);
            if (ValidateDEO == null)
            {
                response.Message = $"Selected District Engineering Office '{p.DEO}' is not valid."; response.Title = "Invalid District Engineering Office";
                return response;
            }

            var ValidateIO = await _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => (RegionParticipantId == x.RegionParticipantId! || string.IsNullOrEmpty(x.RegionParticipantId)) && x.ParticipantId == p.ImplementingOffice, cancellationToken);
            if (ValidateIO == null)
            {
                response.Message = $"Selected Implementing Office '{p.ImplementingOffice}' is not valid."; response.Title = "Invalid Implementing Office";
                return response;
            }
            var ValidateOU = await _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefaultAsync(x => (RegionParticipantId == x.RegionParticipantId! || string.IsNullOrEmpty(x.RegionParticipantId)) && x.ParticipantId == p.OperatingUnit, cancellationToken);
            if (ValidateOU == null)
            {
                response.Message = $"Selected Operating Unit '{p.OperatingUnit}' is not valid."; response.Title = "Invalid Operating Unit";
                return response;
            }


            var ValidateOrigin = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Origin && x.IsActive, cancellationToken);
            if (ValidateOrigin == null)
            {
                response.Message = $"Selected Origin '{p.Origin}' is not valid."; response.Title = "Invalid Origin";
                return response;
            }
            var ValidateOriginatingAgency = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Agency && x.IsActive, cancellationToken);
            if (ValidateOriginatingAgency == null)
            {
                response.Message = $"Selected Originating Agency '{p.Agency}' is not valid."; response.Title = "Invalid Originating Agency";
                return response;
            }
            var ValidateImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.ImplementationMode && x.IsActive, cancellationToken);
            if (ValidateImplementationMode == null)
            {
                response.Message = $"Selected Implementation Mode '{p.ImplementationMode}' is not valid."; response.Title = "Invalid Implementation Mode";
                return response;
            }
            var ValidateEmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.EmergencyMode && x.IsActive, cancellationToken);
            if (ValidateEmergencyMode == null)
            {
                response.Message = $"Selected Emergency Mode '{p.EmergencyMode}' is not valid."; response.Title = "Invalid Emergency Mode";
                return response;
            }
            var ValidateRowAvailable = await _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.RowAvailable && x.IsActive, cancellationToken);
            if (ValidateRowAvailable == null)
            {
                response.Message = $"Selected ROW Available '{p.RowAvailable}' is not valid."; response.Title = "Invalid ROW Available";
                return response;
            }
            var ValidateFeasibility = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Feasibility && x.IsActive, cancellationToken);
            if (ValidateFeasibility == null)
            {
                response.Message = $"Selected Feasibility Study '{p.Feasibility}' is not valid."; response.Title = "Invalid Feasibility Study";
                return response;
            }
            if (p.Feasibility == 1 && p.FeasibilityDate == null)
            {
                response.Message = "The Feasibility Date is required when Feasibility Study is selected."; response.Title = "Feasibility Date Required";
                return response;
            }
            // 2026-09-11 fix: removed the "cannot be earlier than the current date" check --
            // it compared against today, never against the field's own previous value, so it
            // was really a "must always be today or later" rule that blocked entering a
            // genuinely past date (the normal case for a field recording when a feasibility
            // study actually happened). Live data confirmed this: 100% of the 37 live
            // Feasibility=1 revisions had a today-or-future date, zero had a past date.
            var ValidateDetailedDesign = await _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.DetailedDesign && x.IsActive, cancellationToken);
            if (ValidateDetailedDesign == null)
            {
                response.Message = $"Selected Detailed Design '{p.DetailedDesign}' is not valid."; response.Title = "Invalid Detailed Design";
                return response;
            }
            if (p.DetailedDesign == 1 && p.DetailedDesignDate == null)
            {
                response.Message = "The Detailed Design Date is required when Detailed Design is selected."; response.Title = "Detailed Design Date Required";
                return response;
            }
            // 2026-09-11 fix: same "must always be today or later" bug as FeasibilityDate above,
            // same function -- removed for consistency (0 live rows currently use
            // DetailedDesign=1, so no live blast-radius evidence, but identical shape).
            response.IsValid = true;
            response.Data = p.Region;//ValidateRegion.IslandCode;
            return response;
        }

        /// <summary>
        /// Thrust existence + the Category -> Sub-Category (PAPKey) mapping, in one place.
        /// </summary>
        /// <remarks>
        /// EXTRACTED 2026-09-11. The rule previously existed three times and agreed twice:
        ///
        ///   - ValidateProjectDetailsLookups (above)              -- existence + mapping
        ///   - RevisionController.ResubmitRevision (inline copy)   -- existence + mapping
        ///   - LumpsumController.Writes.ValidateSubCategoryAsync   -- existence ONLY, plus a
        ///     third, narrower validity window of its own
        ///
        /// So the Lump Sum form could store a (Category, Sub-Category) pair that the itemization
        /// import -- Hangfire/Importing/ImportingHelper.cs:248-265, the same rule a fourth time --
        /// then refused on the very next step. Measured on localhost 2026-09-10: 19 restricted
        /// categories x 96 offered sub-categories = 1,824 selectable pairs, 134 of them permitted;
        /// the Lump Sum save accepted all 1,690 invalid ones that AddProject rejected.
        ///
        /// THE RULE. A Category is UNRESTRICTED -- every valid Sub-Category qualifies -- when
        /// tOptionProjectCategoryToPAPMap holds no rows for it, when ANY of its rows is the
        /// PAPKey = -1 wildcard, or when none of its mapped PAPKeys resolves to a real thrust row.
        ///
        /// The wildcard WINS over specific rows beside it. The code this replaced asked instead
        /// whether the Category had "any row with PAPKey != -1", which reads a Category carrying a
        /// -1 wildcard AND a specific row as restricted -- the opposite of the intended meaning.
        /// No Category carries that mix today (checked on localhost 2026-09-11: the 3 wildcard
        /// categories, 20/24/31, have no specific rows), so the two agree on current data and the
        /// difference would first appear the day someone adds one.
        ///
        /// NOT the vProjectThrustByCategory view, deliberately (2026-09-11). The earlier code here
        /// used it for the pair lookup, but that view EXISTS ON NEITHER localhost database and no
        /// script in this repo creates it -- the same missing-DDL failure this repo has hit before
        /// (see Importing.Schema.sql's header). Any save carrying a Thrust therefore threw
        /// "Invalid object name" on a database built from this folder's scripts. The view is only
        /// an INNER JOIN of the map onto the thrust list, and the existence check immediately above
        /// has already proven the thrust row exists, so asking the 137-row map directly is
        /// equivalent, cheaper, and depends on nothing that might be absent.
        ///
        /// Thrust = 0 (not just null) is this schema's "none selected" convention -- confirmed
        /// live: 62 real projects carry it and PAPKey = 0 is not a real thrust row -- so treating 0
        /// as "must validate" would newly reject those projects on their next save even when
        /// Thrust was never touched.
        ///
        /// The window is Project's own "is this already-selected value still acceptable to KEEP"
        /// rule: IsActive OR ValidToDate = 0 OR ValidToDate >= current year. It is deliberately
        /// MORE permissive than the dropdown's IsCurrentlyValid ("valid for a NEW selection"), so
        /// a project can always re-save its own since-expired Sub-Category. Lump Sum used to be
        /// narrower than BOTH, which is why it refused options its own dropdown had just offered.
        /// </remarks>
        public static async Task<ProjectHelperResponse<string>> ValidateThrustForCategoryAsync(
            this MYPSDbContext _db, int category, int? thrust,
            int? previousCategory, int? previousThrust, CancellationToken cancellationToken)
        {
            var response = new ProjectHelperResponse<string> { Data = string.Empty };

            if (!thrust.HasValue || thrust.Value == 0)
            {
                response.IsValid = true;
                return response;
            }

            // THE GRANDFATHER GATE (RCA section 9, Option A; widened to both fields 2026-09-12).
            // Old data is exempt only while it is UNTOUCHED: when the caller supplies the stored
            // Category and Sub-Category and both equal the incoming values, the pair is not
            // re-checked. That is what lets the 556 legacy revisions whose stored pair predates the
            // mapping (and the Lump Sum rows in the same state) take an unrelated edit and save.
            // Changing EITHER field is a new choice and falls through to full validation -- an
            // orphaned legacy Sub-Category must not be re-homed under a Category it does not fit,
            // and mappings drift over time, so "it was valid once" proves nothing about the pair
            // the user is now asserting. A create supplies neither previous value and is always
            // validated in full. Both previous values must be present for the skip: a caller that
            // knows one but not the other has no prior state worth trusting.
            bool PairIsUntouched = previousCategory.HasValue && previousThrust.HasValue
                                && previousCategory.Value == category
                                && previousThrust.Value == thrust.Value;
            if (PairIsUntouched)
            {
                response.IsValid = true;
                return response;
            }

            int CurrentYear = Functions.CurrentDate().Year;

            var ValidateThrust = await _db.tOptionProjectThrustList.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PAPKey == thrust.Value
                                       && (x.IsActive || (x.ValidToDate == 0 || x.ValidToDate >= CurrentYear)), cancellationToken);
            if (ValidateThrust == null)
            {
                response.Message = $"Selected Sub-Category '{thrust}' is not valid."; response.Title = "Invalid Sub-Category";
                return response;
            }

            // This Category's whole mapping in ONE round-trip -- at most a handful of rows, each
            // carrying whether its PAPKey resolves to a real thrust row. The correlated EXISTS
            // stays server-side; nothing here passes a client-side collection back into a
            // predicate over a column, which is the shape whose SQL translation is not guaranteed.
            var CategoryMappings = await _db.tOptionProjectCategoryToPAPMap.AsNoTracking()
                .Where(x => x.CategoryId == category)
                .Select(x => new
                {
                    x.PAPKey,
                    Resolves = _db.tOptionProjectThrustList.Any(t => t.PAPKey == x.PAPKey)
                })
                .ToListAsync(cancellationToken);

            // A PAPKey = -1 row means EVERY valid Sub-Category qualifies for this Category, and it
            // WINS over any specific rows sitting beside it. Stated by the operator 2026-09-11 and
            // already how ImportingHelper.cs:261-263 reads it.
            //
            // The third clause is safe-by-default, as the import does: a mapping pointing only at
            // PAPKeys with no thrust row behind them cannot restrict anything -- honouring it would
            // lock the Category out of every Sub-Category instead. Zero such rows exist on
            // localhost today, so it is a guard, not a live path.
            bool Unrestricted = CategoryMappings.Count == 0
                             || CategoryMappings.Any(m => m.PAPKey == -1L)
                             || !CategoryMappings.Any(m => m.Resolves);

            if (!Unrestricted && !CategoryMappings.Any(m => m.PAPKey == (long)thrust.Value))
            {
                response.Message = $"Selected Sub-Category '{thrust}' is not valid for the selected Category."; response.Title = "Invalid Sub-Category";
                return response;
            }

            response.IsValid = true;
            return response;
        }
        #endregion

        #region ProjectDeletionTier — the single project-deletion rule
        // Thin wrappers around dbo.fProjectDeletionTier and dbo.pExecuteProjectDeletion
        // (Main/Resources/Internal/SQLObjects). The function IS the rule — hard only on a
        // project's first stage entry, soft once it has progressed, Lump Sum itemized
        // projects always hard, published never, independent of the BP/P prefix — and every
        // delete path asks it: Batch Delete, Delete Program, Delete Lump Sum, Delete Itemized
        // Project. Never re-state the rule in C#; read Tier.
        public static class ProjectDeletionTiers
        {
            public const string Hard = "Hard";
            public const string Soft = "Soft";
            public const string Blocked = "Blocked";
        }

        public static class ProjectDeletionKinds
        {
            public const string Ordinary = "Ordinary";
            public const string LSParent = "LSParent";
            public const string LSChild = "LSChild";
        }

        /// <summary>One row of dbo.fProjectDeletionTier. <see cref="Ref"/> is the reference as given
        /// (ProjectPK or any revision ProjectId, BP- or P-form); <see cref="ProjectFK"/> is what it resolved to.</summary>
        public class ProjectDeletionTierResult
        {
            public string Ref { get; set; } = string.Empty;
            public string ProjectFK { get; set; } = string.Empty;
            public string ProgramFK { get; set; } = string.Empty;
            public string MatchedBy { get; set; } = string.Empty;
            public string Kind { get; set; } = string.Empty;
            public bool IsPublished { get; set; }
            public bool IsRevised { get; set; }
            public int StageCount { get; set; }
            /// <summary>The program is Approved (current status as vProgramLatest shows it). An Approved
            /// program refuses every delete except a Lump Sum itemized child's.</summary>
            public bool ProgramApproved { get; set; }
            public string Tier { get; set; } = string.Empty;
            public string Reason { get; set; } = string.Empty;
        }

        /// <summary>
        /// A delete the single deletion rule refused, carrying the plain-language reason the
        /// procedures raise after their 'DELETE_REFUSED: ' token (e.g. "Project X cannot be
        /// permanently deleted: program is approved."). Controllers turn it into a 400 whose
        /// Message is <see cref="Reason"/>; ExceptionHandler would otherwise reduce it to a
        /// generic database error. Same pattern as <see cref="ProjectIdRangeExhaustedException"/>.
        /// </summary>
        public sealed class DeletionRefusedException : Exception
        {
            public const string Token = "DELETE_REFUSED:";
            public string Reason { get; }

            public DeletionRefusedException(string reason, Exception? inner = null) : base(reason, inner) => Reason = reason;

            public static bool Matches(SqlException ex) => ex.Message.Contains(Token, StringComparison.Ordinal);

            /// <summary>The refusal error's own text, without the token (an exception can carry several errors).</summary>
            public static DeletionRefusedException From(SqlException ex)
            {
                string message = ex.Errors.Cast<SqlError>()
                    .Select(e => e.Message)
                    .FirstOrDefault(m => m.Contains(Token, StringComparison.Ordinal)) ?? ex.Message;
                int at = message.IndexOf(Token, StringComparison.Ordinal);
                string reason = (at >= 0 ? message[(at + Token.Length)..] : message).Trim();
                return new DeletionRefusedException(reason, ex);
            }
        }

        /// <summary>
        /// Audit rows for a soft delete (or its restore): one tTransactionLog row per project,
        /// IsDeleted false -> true (or back), added to <paramref name="db"/>'s change tracker so
        /// they commit with the caller's transaction. Hard deletes are logged by
        /// dbo.pExecuteProjectDeletion itself.
        /// </summary>
        public static void AddSoftDeleteAuditRows(
            this MYPSDbContext db, IEnumerable<(string ProjectFK, int RevisionId, string? StageName)> revisions,
            bool deleted, string userId, DateTime createdDate)
        {
            foreach (var (projectFK, revisionId, stageName) in revisions)
            {
                db.tTransactionLog.Add(new DBHelper.Models.Table.TransactionLog
                {
                    ReferenceId = projectFK,
                    TransactionType = (deleted ? EnumTransactionType.Delete : EnumTransactionType.Update).ToString(),
                    AffectedTable = "tProjectRevisions",
                    AffectedColumn = "IsDeleted",
                    OldValue = System.Text.Json.JsonSerializer.Serialize(new { RevisionId = revisionId, StageName = stageName, IsDeleted = !deleted }),
                    NewValue = deleted ? "true" : "false",
                    CreatedBy = userId,
                    Hostname = Environment.MachineName,
                    CreatedDate = createdDate
                });
            }
        }

        /// <summary>
        /// The tier of every reference in <paramref name="projectRefs"/>, in one query, inside
        /// whatever transaction <paramref name="db"/> has open. A reference that resolves to
        /// nothing has no row; one that matches more than one project has several and must be
        /// refused as ambiguous (see the function header).
        /// </summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTiersAsync(
            this MYPSDbContext db, IEnumerable<string> projectRefs, string programFK, CancellationToken cancellationToken = default)
        {
            string refs = System.Text.Json.JsonSerializer.Serialize(projectRefs.Distinct(StringComparer.OrdinalIgnoreCase).ToArray());
            return await db.Database.SqlQuery<ProjectDeletionTierResult>($"""
                SELECT t.Ref, t.ProjectFK, t.ProgramFK, t.MatchedBy, t.Kind, t.IsPublished, t.IsRevised, t.StageCount, t.ProgramApproved, t.Tier, t.Reason
                FROM OPENJSON({refs}) WITH (Ref NVARCHAR(200) '$') j
                CROSS APPLY dbo.fProjectDeletionTier(j.Ref, {programFK}) t
                """).ToListAsync(cancellationToken);
        }

        /// <summary>Single-reference form of <see cref="DetermineProjectDeletionTiersAsync"/>.</summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTierAsync(
            this MYPSDbContext db, string projectRef, string programFK, CancellationToken cancellationToken = default)
            => await db.DetermineProjectDeletionTiersAsync(new[] { projectRef }, programFK, cancellationToken);

        /// <summary>
        /// Hard-deletes one project under one program through dbo.pExecuteProjectDeletion, inside
        /// the transaction <paramref name="db"/> has open (the procedure then neither commits nor
        /// rolls back; the caller does). The procedure re-checks the tier and refuses anything but
        /// 'Hard' with <see cref="DeletionRefusedException"/>, so call it only for a project whose
        /// tier is Hard. It also writes the project's tTransactionLog row.
        /// </summary>
        public static async Task<int> ExecuteProjectDeletionAsync(
            this MYPSDbContext db, string projectFK, string programFK, string userId, DateTime currentDate, CancellationToken cancellationToken = default)
        {
            try
            {
                return await db.Database.ExecuteSqlInterpolatedAsync(
                    $"EXEC dbo.pExecuteProjectDeletion @ProjectFK = {projectFK}, @ProgramFK = {programFK}, @UserId = {userId}, @CurrentDate = {currentDate}",
                    cancellationToken);
            }
            catch (SqlException ex) when (DeletionRefusedException.Matches(ex))
            {
                throw DeletionRefusedException.From(ex);
            }
        }

        /// <summary>Dapper form of <see cref="DetermineProjectDeletionTierAsync(MYPSDbContext, string, string, CancellationToken)"/>.</summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTierAsync(
            this ISqlExecutor sql, string projectRef, string programFK, CancellationToken cancellationToken = default)
        {
            var rows = await sql.QueryAsync<ProjectDeletionTierResult>(
                "SELECT * FROM dbo.fProjectDeletionTier(@ProjectRef, @ProgramFK)",
                new { ProjectRef = projectRef, ProgramFK = programFK },
                ct: cancellationToken);
            return rows.ToList();
        }

        /// <summary>
        /// Dapper form of the hard delete. Self-atomic when <paramref name="tx"/> is null; pass a
        /// transaction only to compose with other writes on it. Throws SqlException when the
        /// project is not found, the reference is ambiguous, or its tier is not Hard.
        /// </summary>
        public static async Task ExecuteProjectDeletionAsync(
            this ISqlExecutor sql, string projectFK, string programFK, string userId, DateTime currentDate,
            IDbTransaction? tx = null, CancellationToken cancellationToken = default)
        {
            var parameters = new DynamicParameters();
            parameters.Add("@ProjectFK", projectFK, DbType.String, ParameterDirection.Input);
            parameters.Add("@ProgramFK", programFK, DbType.String, ParameterDirection.Input);
            parameters.Add("@UserId", userId, DbType.String, ParameterDirection.Input);
            parameters.Add("@CurrentDate", currentDate, DbType.DateTime2, ParameterDirection.Input);

            try
            {
                await sql.ExecuteAsync(
                    "EXEC dbo.pExecuteProjectDeletion @ProjectFK = @ProjectFK, @ProgramFK = @ProgramFK, @UserId = @UserId, @CurrentDate = @CurrentDate",
                    parameters,
                    tx: tx,
                    ct: cancellationToken);
            }
            catch (SqlException ex) when (DeletionRefusedException.Matches(ex))
            {
                throw DeletionRefusedException.From(ex);
            }
        }
        #endregion
    }
}
