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

            var parameters = new DynamicParameters();
            parameters.Add("@CategoryId", request.CategoryId, DbType.Int32, ParameterDirection.Input);
            parameters.Add("@Suffix", FirstSegment, DbType.String, ParameterDirection.Input);
            parameters.Add("@IslandCode", request.IslandCode ?? string.Empty, DbType.String, ParameterDirection.Input);
            parameters.Add("@YearStart", request.YearStart, DbType.Int32, ParameterDirection.Input);
            parameters.Add("@Count", 1, DbType.Int32, ParameterDirection.Input);
            parameters.Add("@RangeStart", dbType: DbType.Int32, direction: ParameterDirection.Output);
            parameters.Add("@RangeEnd", dbType: DbType.Int32, direction: ParameterDirection.Output);

            var connection = _db.Database.GetDbConnection();
            bool shouldCloseConnection = connection.State != ConnectionState.Open;
            try
            {
                if (shouldCloseConnection)
                {
                    await connection.OpenAsync(cancellationToken);
                }

                var transaction = _db.Database.CurrentTransaction?.GetDbTransaction();

                var command = new CommandDefinition(
                    commandText: "dbo.pReserveProjectIdBlock",
                    parameters: parameters,
                    transaction: transaction,
                    commandTimeout: 120,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: cancellationToken);

                await connection.ExecuteAsync(command);
            }
            catch (SqlException ex) when (ex.Message.Contains("PROJECTID_RANGE_EXHAUSTED:"))
            {
                throw new ProjectIdRangeExhaustedException(
                    request.CategoryId,
                    $"Project ID generation failed: Category {request.CategoryId}'s ID range has been fully exhausted. Contact an administrator to expand the range.");
            }
            finally
            {
                if (shouldCloseConnection)
                {
                    await connection.CloseAsync();
                }
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

            bool duplicateExists = await _db.tProjects
                .AsNoTracking()
                .AnyAsync(x => x.ProjectPK == ProjectId, cancellationToken);

            if (duplicateExists)
            {
                throw new InvalidOperationException(
                    $"Project ID generation failed: generated ProjectId '{ProjectId}' already exists in tProjects.ProjectPK. The allocator counter may be out of sync; verify dbo.pReserveProjectIdBlock and dbo.tProjectIdSequence before retrying.");
            }

            return ProjectId;
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

            // 2026-09-10 fix: was dead code -- referenced p.Thrust, a property that didn't exist
            // on this params class, so it couldn't have compiled if ever uncommented. Thrust had
            // ZERO server-side validation (AddProject relied solely on this now-real check;
            // UpdateProjectDetails has its own separate existence-only inline check,
            // ProjectController.cs:1459, kept for its audit-logging role -- becomes a harmless
            // redundant recheck now that this runs first).
            //
            // Mirrors Hangfire/Importing/ImportingHelper.cs:248-269's already-proven Category<->
            // Thrust rule (that pipeline validates imports; this validates normal Add/Update saves,
            // which never went through it) -- a Category is "unrestricted" (any active thrust
            // allowed) when tOptionProjectCategoryToPAPMap has no rows for it, or only a PAPKey=-1
            // wildcard row. Uses the new vProjectThrustByCategory view for the fast "is this exact
            // (Category, Thrust) pair explicitly allowed" check; the view's plain INNER JOIN can
            // never represent the wildcard/no-row "unrestricted" cases (no real thrust has
            // PAPKey=-1), so that fallback queries the raw map table directly, same as the import
            // pipeline does.
            // Thrust=0 (not just null) is this schema's existing "none selected" convention --
            // confirmed live: 62 real projects carry Thrust=0, and PAPKey=0 doesn't exist as a real
            // thrust row, so treating 0 as "must validate" would newly reject those projects on
            // their next save even if Thrust itself was never touched.
            if (p.Thrust.HasValue && p.Thrust.Value != 0)
            {
                var ValidateThrust = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == p.Thrust.Value && (x.IsActive || (x.ValidToDate == 0 || x.ValidToDate >= CurrentDate.Year)), cancellationToken);
                if (ValidateThrust == null)
                {
                    response.Message = $"Selected Sub-Category '{p.Thrust}' is not valid."; response.Title = "Invalid Sub-Category";
                    return response;
                }
                var ValidateThrustForCategory = await _db.vProjectThrustByCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == p.Category && x.PAPKey == p.Thrust.Value, cancellationToken);
                if (ValidateThrustForCategory == null)
                {
                    bool CategoryHasRestrictions = await _db.tOptionProjectCategoryToPAPMap.AsNoTracking().AnyAsync(x => x.CategoryId == p.Category && x.PAPKey != -1, cancellationToken);
                    if (CategoryHasRestrictions)
                    {
                        response.Message = $"Selected Sub-Category '{p.Thrust}' is not valid for the selected Category."; response.Title = "Invalid Sub-Category";
                        return response;
                    }
                }
            }
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
            if (p.Feasibility == 1 &&
                p.FeasibilityDate!.Value.Date < CurrentDate.Date)
            {
                response.Message = "The Feasibility Date cannot be earlier than the current date."; response.Title = "Invalid Feasibility Date";
                return response;
            }
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
            if (p.DetailedDesign == 1 &&
                p.DetailedDesignDate!.Value.Date < CurrentDate.Date)
            {
                response.Message = "The Detailed Design Date cannot be earlier than the current date."; response.Title = "Invalid Detailed Design Date";
                return response;
            }
            response.IsValid = true;
            response.Data = p.Region;//ValidateRegion.IslandCode;
            return response;
        }
        #endregion
    }
}
