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

        #region Project view gate (DPC / RPC / AUC / DPD Admin)
        /*  2026-10-18 -- documents/plans/project-visibility-by-deo-region.md. VIEWING ONLY: the project
            lists (ShowProjects, ShowProjectsInProgram) and the project-details reads. Saves, revisions,
            programs, Lump Sum, Dashboard and Reports keep their current behaviour; a later change takes
            those on. Self-contained on purpose -- it changes neither tGroups.ApplyFilter nor any SQL object
            (v1 did, and the side effects reached every module). 2026-10-30: Project Groups and Global
            Search use it too (GetViewableStagesByProjectAsync), so they cannot list other regions' projects.

            The rule, per STAGE: a stage is visible when its DEO is in the user's scope, where a stage's DEO
            is that stage revision's latest fully approved modification snapshot DEO, else the stage
            revision's own tProjectRevisions.DEO (StageDeoSql). A project is listed when ANY of its stages
            is visible. Scope by group:
              AUC or DPD Admin   everything (wins over DPC/RPC)
              DPC                the DEO in tUsers.PlantillaOffice
              RPC                every DEO whose parent region is tUsers.PlantillaOffice
              none of the four   unchanged: today's ApplyFilter behaviour ("Legacy")
            A DPC/RPC user whose PlantillaOffice does not fit the group sees nothing (fail closed). Lump Sum
            parents are never visible to a DPC/RPC user; itemized children follow the DEO rule. The group
            names are matched by NAME -- renaming one in User Management silently breaks this. The frontend
            mirrors the same set in FE/src/contexts/AuthContext.tsx. */

        private const string ScopeGroupDPC = "DPC";
        private const string ScopeGroupRPC = "RPC";
        private static readonly string[] ScopeSeeAllGroups = { "AUC", "DPD Admin" };

        public const string NoProjectAccessTitle = "No Project Access";
        public const string NoProjectAccessMessage = "Your plantilla office is not set up for project access for your user group. Please contact your administrator.";

        private enum ProjectViewScopeKind { Legacy, All, Deos }

        private sealed class ProjectViewScope
        {
            public ProjectViewScopeKind Kind { get; init; }
            public List<string> Deos { get; init; } = new();
        }

        private static async Task<ProjectViewScope> ResolveProjectViewScopeAsync(MYPSDbContext _db, DBHelper.Models.Views.Users session, CancellationToken cancellationToken)
        {
            var groups = session.UserGroupNames ?? Array.Empty<string>();
            if (groups.Any(g => ScopeSeeAllGroups.Contains(g)))
                return new ProjectViewScope { Kind = ProjectViewScopeKind.All };

            bool isDpc = groups.Contains(ScopeGroupDPC);
            bool isRpc = groups.Contains(ScopeGroupRPC);
            if (!isDpc && !isRpc)
                return new ProjectViewScope { Kind = ProjectViewScopeKind.Legacy };

            // OFFICE SOURCE: the ONLY place this gate reads the user's office. If the office moves to
            // another column, change this one line.
            string? office = (await _db.tUsers.AsNoTracking()
                .Where(u => u.UserId == session.UserId)
                .Select(u => u.PlantillaOffice)
                .FirstOrDefaultAsync(cancellationToken))?.Trim();

            var deos = new HashSet<string>();
            if (!string.IsNullOrEmpty(office))
            {
                if (isDpc && await _db.vAdminDEO.AsNoTracking().AnyAsync(d => d.ParticipantId == office, cancellationToken))
                    deos.Add(office);
                if (isRpc && await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.ParticipantId == office, cancellationToken))
                    deos.UnionWith(await _db.vAdminDEO.AsNoTracking()
                        .Where(d => d.RegionParticipantId == office)
                        .Select(d => d.ParticipantId)
                        .ToListAsync(cancellationToken));
            }
            return new ProjectViewScope { Kind = ProjectViewScopeKind.Deos, Deos = deos.ToList() };
        }

        /// <summary>
        /// The one SQL definition of a stage's DEO, for the stage revision id in
        /// <paramref name="stageRevisionIdExpr"/>: the latest fully approved modification's snapshot DEO for
        /// that revision (same approval test as fProjectEffectiveRevision), else the revision's own DEO.
        /// </summary>
        private static string StageDeoSql(string stageRevisionIdExpr) =>
            "COALESCE(" +
            "(SELECT TOP 1 s.DEO FROM dbo.tRevisionDetails rd" +
            " JOIN dbo.tRevisionProjectSnapshot s ON s.RevisionDetailFK = rd.Id AND s.IsDeleted = 0" +
            " CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) a" +
            $" WHERE rd.ProjectRevisionFK = {stageRevisionIdExpr} AND a.IsFullyApproved = 1 ORDER BY rd.Id DESC)," +
            $" (SELECT pr.DEO FROM dbo.tProjectRevisions pr WHERE pr.Id = {stageRevisionIdExpr} AND pr.IsDeleted = 0))";

        private const string IsLumpSumParentSql =
            "EXISTS (SELECT 1 FROM dbo.tProjects lp WHERE lp.ProjectPK = {0} AND lp.ProjectType = 'LS' AND lp.ParentProjectId IS NULL)";

        /// <summary>
        /// Adds the view gate to a FilterDataCursor clause list over a source aliased <c>v</c> that exposes
        /// <c>ProjectPK</c>. Pass <paramref name="stageRevisionColumn"/> when each row IS one stage
        /// (ShowProjectsInProgram: <c>"v.RevisionId"</c>); leave it null when each row is a project
        /// (ShowProjects), which is then listed if any of its stages is visible. Returns false when the user
        /// has no office scope at all -- the caller answers 403 with <see cref="NoProjectAccessMessage"/>.
        /// </summary>
        public static async Task<bool> AddProjectListVisibilityAsync(
            this List<(string Clause, string ParamName, object? Value)> filters,
            MYPSDbContext _db,
            DBHelper.Models.Views.Users session,
            string? stageRevisionColumn,
            CancellationToken cancellationToken)
        {
            var scope = await ResolveProjectViewScopeAsync(_db, session, cancellationToken);
            switch (scope.Kind)
            {
                case ProjectViewScopeKind.Legacy:
                    // Today's filter, moved here unchanged from ShowProjects / ShowProjectsInProgram.
                    if (session.ApplyFilter)
                        filters.Add((
                            "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                            "@regCode", session.RegCode));
                    return true;
                case ProjectViewScopeKind.All:
                    return true;
            }
            if (scope.Deos.Count == 0)
                return false;

            string deosJson = System.Text.Json.JsonSerializer.Serialize(scope.Deos);
            const string InScope = " IN (SELECT [value] FROM OPENJSON(@scopeDeos))";

            if (stageRevisionColumn != null)
            {
                // One row per stage, already narrowed to one program by the caller's source: check
                // the row's own stage inline.
                filters.Add((
                    $"({StageDeoSql(stageRevisionColumn)}{InScope} AND NOT {string.Format(IsLumpSumParentSql, "v.ProjectPK")})",
                    "@scopeDeos", deosJson));
                return true;
            }

            // One row per project: listed when ANY of its stages is visible.
            // PERFORMANCE (2026-10-18, localhost, 172k projects): any selective filter on vProjectLatest
            // costs ~10 s per list call (count + page) against ~4 s unfiltered -- the view, not the
            // rule: the same filter on the base revision DEO alone is no faster. Pre-resolving the
            // visible ProjectPKs into an OPENJSON list was tried and is far worse (nested loops over the
            // view, 90 s timeouts). A real fix needs an indexed DEO on the view or a new SQL object,
            // both out of this change's scope.
            filters.Add((
                "(EXISTS (SELECT 1 FROM dbo.tProjectStages ps WHERE ps.ProjectFK = v.ProjectPK AND " + StageDeoSql("ps.RevisionId") + InScope + ")" +
                $" AND NOT {string.Format(IsLumpSumParentSql, "v.ProjectPK")})",
                "@scopeDeos", deosJson));
            return true;
        }

        /// <summary>
        /// The project URL check. Null: no restriction for this user. Otherwise the project's stages the user
        /// may view (RevisionId = tProjectStages.RevisionId); empty means none -- answer "Project Not Found".
        /// </summary>
        public static async Task<List<(int RevisionId, string StageName)>?> GetViewableStagesAsync(
            this MYPSDbContext _db,
            DBHelper.Models.Views.Users session,
            string projectPK,
            CancellationToken cancellationToken)
        {
            var scope = await ResolveProjectViewScopeAsync(_db, session, cancellationToken);
            switch (scope.Kind)
            {
                case ProjectViewScopeKind.Legacy:
                    // Today's check, unchanged.
                    if (!session.ApplyFilter)
                        return null;
                    bool visible = await _db.fUserVisibleProjects
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({session.UserId})")
                        .AnyAsync(x => x.ProjectPK == projectPK, cancellationToken);
                    return visible ? null : new List<(int, string)>();
                case ProjectViewScopeKind.All:
                    return null;
            }
            if (scope.Deos.Count == 0)
                return new List<(int, string)>();

            var stages = await _db.tProjectStages
                .FromSqlRaw(
                    "SELECT ps.* FROM dbo.tProjectStages ps WHERE ps.ProjectFK = @projectPK" +
                    $" AND NOT {string.Format(IsLumpSumParentSql, "ps.ProjectFK")}" +
                    $" AND {StageDeoSql("ps.RevisionId")} IN (SELECT [value] FROM OPENJSON(@scopeDeos))",
                    new SqlParameter("@projectPK", projectPK),
                    new SqlParameter("@scopeDeos", System.Text.Json.JsonSerializer.Serialize(scope.Deos)))
                .AsNoTracking()
                .Select(x => new { x.RevisionId, x.StageName })
                .ToListAsync(cancellationToken);
            return stages.Select(x => (x.RevisionId, x.StageName)).ToList();
        }

        /// <summary>
        /// 2026-10-30: <see cref="GetViewableStagesAsync"/> for many projects in one query, for the endpoints
        /// that read or change a batch of projects by Id (Project Groups, Global Search) -- same rule, so an
        /// Apply Filter or DPC/RPC user cannot reach other regions' projects through them. Null: no
        /// restriction for this user. Otherwise each project's stages the user may view (RevisionId =
        /// tProjectStages.RevisionId); a project with none is missing from the lookup -- answer it as not found.
        /// </summary>
        public static async Task<ILookup<string, (int RevisionId, string StageName)>?> GetViewableStagesByProjectAsync(
            this MYPSDbContext _db,
            DBHelper.Models.Views.Users session,
            IReadOnlyCollection<string> projectPKs,
            CancellationToken cancellationToken)
        {
            static ILookup<string, (int RevisionId, string StageName)> AsLookup(IEnumerable<(string ProjectFK, int RevisionId, string StageName)> rows) =>
                rows.ToLookup(x => x.ProjectFK, x => (x.RevisionId, x.StageName), StringComparer.OrdinalIgnoreCase);

            var scope = await ResolveProjectViewScopeAsync(_db, session, cancellationToken);
            switch (scope.Kind)
            {
                case ProjectViewScopeKind.Legacy:
                    if (!session.ApplyFilter)
                        return null;
                    if (projectPKs.Count == 0)
                        return AsLookup(Array.Empty<(string, int, string)>());
                    // Today's per-project check (fUserVisibleProjects): a visible project shows every stage.
                    var visibleProjects = _db.fUserVisibleProjects
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({session.UserId})");
                    var legacyStages = await _db.tProjectStages.AsNoTracking()
                        .Where(ps => projectPKs.Contains(ps.ProjectFK) && visibleProjects.Any(v => v.ProjectPK == ps.ProjectFK))
                        .Select(ps => new { ps.ProjectFK, ps.RevisionId, ps.StageName })
                        .ToListAsync(cancellationToken);
                    return AsLookup(legacyStages.Select(x => (x.ProjectFK, x.RevisionId, x.StageName)));
                case ProjectViewScopeKind.All:
                    return null;
            }
            if (scope.Deos.Count == 0 || projectPKs.Count == 0)
                return AsLookup(Array.Empty<(string, int, string)>());

            var stages = await _db.tProjectStages
                .FromSqlRaw(
                    "SELECT ps.* FROM dbo.tProjectStages ps" +
                    " WHERE ps.ProjectFK IN (SELECT [value] FROM OPENJSON(@projectPKs) WITH ([value] nvarchar(200) '$'))" +
                    $" AND NOT {string.Format(IsLumpSumParentSql, "ps.ProjectFK")}" +
                    $" AND {StageDeoSql("ps.RevisionId")} IN (SELECT [value] FROM OPENJSON(@scopeDeos))",
                    new SqlParameter("@projectPKs", System.Text.Json.JsonSerializer.Serialize(projectPKs)),
                    new SqlParameter("@scopeDeos", System.Text.Json.JsonSerializer.Serialize(scope.Deos)))
                .AsNoTracking()
                .Select(x => new { x.ProjectFK, x.RevisionId, x.StageName })
                .ToListAsync(cancellationToken);
            return AsLookup(stages.Select(x => (x.ProjectFK, x.RevisionId, x.StageName)));
        }
        #endregion

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
            /// <summary>
            /// Skips the ApplyFilter visibility check below. Only for a READ caller that applies the
            /// project view gate itself (ShowProjectDetails → <see cref="GetViewableStagesAsync"/>);
            /// every update and revision caller leaves it false and keeps today's check.
            /// </summary>
            public bool SkipVisibilityCheck { get; set; } = false;
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
            if (p._Session.ApplyFilter && !p.SkipVisibilityCheck)
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

            // RISK-072 fix (2026-09-19): check BOTH tables, not just tProjects.ProjectPK.
            // ProgramController's stage-advance swap rewrites tProjectRevisions.ProjectId to
            // the P-prefixed form but never updates tProjects.ProjectPK, so a swapped value is
            // invisible to a tProjects-only check -- letting a later unrelated AddProject mint
            // a real duplicate. Mirrors the two-table shape ProgramController's own swap
            // collision check already uses.
            // includeDeleted: a released id must not be carried even by a soft-deleted revision (a
            // soft-deleted project keeps its id reserved); a fresh counter value keeps the old check.
            //
            // 2026-10-30 (S07-TC007-P002): a NUMBER is in use when any of its BP / P / MY forms is.
            // The stage-advance swap turns BP01100016LZ into P01100016LZ (MY01100016LZ on a DIP
            // stage) with the same digits, while each prefix keeps its own counter, so the P counter
            // never hears of the numbers its BP twin handed out. A P id minted on a number a BP
            // project still holds would also stop that program's next stage advance ("ProjectId
            // Collision Detected"), so a new id of any prefix avoids every form of the number.
            string[] FormsOf(int sequence) =>
                SharedNumberPrefixes.Select(prefix => $"{prefix}{SecondSegment}{sequence:D5}{request.IslandCode}").ToArray();

            async Task<bool> InUseAsync(int sequence, bool includeDeleted = false)
            {
                string[] forms = FormsOf(sequence);
                return await _db.tProjects
                        .AsNoTracking()
                        .AnyAsync(x => forms.Contains(x.ProjectPK), cancellationToken)
                    || await _db.tProjectRevisions
                        .AsNoTracking()
                        .AnyAsync(x => forms.Contains(x.ProjectId) && (includeDeleted || !x.IsDeleted), cancellationToken);
            }

            // 2026-10-29 (delete-rules-projects-programs-stages.md): a BP/P id freed by a permanent
            // delete (dbo.tProjectIdReleased, filled by ExecuteProjectDeletion.sql and
            // ExecuteProgramStageDeletion.sql) is handed out again, lowest first, before the counter
            // advances. Claimed on the same dedicated connection as the counter, so the claim is just
            // as durable: an operation that fails after it loses that id, as it would a counter value.
            // A released id something has taken since is skipped (claimed and dropped). MY ids are
            // never released, so never claimed.
            if (FirstSegment is "BP" or "P")
            {
                const int maxReuseClaims = 5;
                for (int claim = 1; claim <= maxReuseClaims; claim++)
                {
                    int? releasedSequence = await reservationConnection.ExecuteScalarAsync<int?>(new CommandDefinition(
                        ClaimReleasedProjectIdSql,
                        new { request.CategoryId, Suffix = FirstSegment, IslandCode = request.IslandCode ?? string.Empty, request.YearStart },
                        commandTimeout: 120,
                        cancellationToken: cancellationToken));
                    if (releasedSequence is null)
                    {
                        break;
                    }

                    string reusedProjectId = $"{FirstSegment}{SecondSegment}{releasedSequence.Value:D5}{request.IslandCode}";
                    if (!await InUseAsync(releasedSequence.Value, includeDeleted: true))
                    {
                        return reusedProjectId;
                    }
                }
            }

            // RISK-072 fix (2026-09-19): retry past a collision instead of failing outright.
            // Each pReserveProjectIdBlock call durably advances the counter (see the
            // dedicated-connection note above), so a retry always evaluates a genuinely new value.
            //
            // 2026-10-30 (S07-TC007-P002): a retry JUMPS past the whole run of taken numbers. The
            // retry used to move the counter by 1, three times, on the belief that more than one
            // collision meant live contention. It does not: a program whose projects advanced past
            // BP holds a run of P numbers the P counter never issued (see FormsOf above), and
            // category ranges do overlap (1 and 16 share 1-20000). On UAT and locally every
            // itemized import into such a program failed with "still colliding after 3 attempts".
            // So after a collision the lowest number above it with no form in use is looked up, and
            // the next reservation takes the block up to it in one step. The cap now only bounds
            // real contention, where another caller takes that number in between. Range exhaustion
            // is NOT caught here -- it propagates, so the category's real Maximum stays the
            // terminal condition (a jump past it raises like any other reservation).
            const int maxAttempts = 3;
            string collidedProjectId = string.Empty;
            int reserveCount = 1;

            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                var parameters = new DynamicParameters();
                parameters.Add("@CategoryId", request.CategoryId, DbType.Int32, ParameterDirection.Input);
                parameters.Add("@Suffix", FirstSegment, DbType.String, ParameterDirection.Input);
                parameters.Add("@IslandCode", request.IslandCode ?? string.Empty, DbType.String, ParameterDirection.Input);
                parameters.Add("@YearStart", request.YearStart, DbType.Int32, ParameterDirection.Input);
                parameters.Add("@Count", reserveCount, DbType.Int32, ParameterDirection.Input);
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

                // The block's LAST number: after a jump the block ends on the free number that was
                // looked up, and the numbers before it are taken (an unused gap is harmless).
                string ThirdSegment = rangeEnd.ToString("D5");
                string ProjectId = $"{FirstSegment}{SecondSegment}{ThirdSegment}{request.IslandCode}";

                if (!await InUseAsync(rangeEnd))
                {
                    return ProjectId;
                }

                collidedProjectId = ProjectId;

                // On the CALLER's connection and transaction, like InUseAsync, not the reservation
                // connection: the Lump Sum import calls this inside its transaction after inserting
                // the previous child, and a read from another connection would wait on those
                // uncommitted rows while the transaction waits on this call.
                int? nextFree = await _db.Database.GetDbConnection().ExecuteScalarAsync<int?>(new CommandDefinition(
                    NextFreeSequenceSql,
                    new { Year = SecondSegment, IslandCode = request.IslandCode ?? string.Empty, After = rangeEnd },
                    transaction: _db.Database.CurrentTransaction?.GetDbTransaction(),
                    commandTimeout: 120,
                    cancellationToken: cancellationToken));
                reserveCount = Math.Max(1, (nextFree ?? rangeEnd + 1) - rangeEnd);
            }

            throw new ProjectIdCollisionException(
                collidedProjectId,
                $"Project ID generation failed: still colliding after {maxAttempts} attempts (last tried '{collidedProjectId}'). The allocator counter is likely out of sync with existing data -- verify dbo.tProjectIdSequence against dbo.tProjects/dbo.tProjectRevisions for this category, suffix, island and year before retrying.");
        }

        /// <summary>The prefixes that share one number per year and island: the stage-advance swap
        /// rewrites BP into P or MY and keeps the digits (ProgramController, ReplaceFirst("BP", ...)).</summary>
        private static readonly string[] SharedNumberPrefixes = { "BP", "P", "MY" };

        /// <summary>The lowest number above @After that no BP / P / MY id of this year and island
        /// carries, in tProjects or in a live revision -- the same test as InUseAsync. @After itself
        /// has just collided, so it counts as taken whatever the tables say now.</summary>
        private const string NextFreeSequenceSql = """
            WITH Ids AS (
                SELECT ProjectPK AS Id FROM dbo.tProjects
                WHERE ProjectPK LIKE N'BP' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode
                   OR ProjectPK LIKE N'P' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode
                   OR ProjectPK LIKE N'MY' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode
                UNION
                SELECT ProjectId FROM dbo.tProjectRevisions
                WHERE IsDeleted = 0
                  AND (ProjectId LIKE N'BP' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode
                    OR ProjectId LIKE N'P' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode
                    OR ProjectId LIKE N'MY' + @Year + N'[0-9][0-9][0-9][0-9][0-9]' + @IslandCode)
            ),
            Taken AS (
                SELECT TRY_CAST(SUBSTRING(Id, LEN(Id) - LEN(@IslandCode) - 4, 5) AS INT) AS Sequence FROM Ids
                UNION
                SELECT @After
            )
            SELECT MIN(t.Sequence + 1)
            FROM Taken t
            WHERE t.Sequence >= @After
              AND NOT EXISTS (SELECT 1 FROM Taken n WHERE n.Sequence = t.Sequence + 1);
            """;

        /// <summary>Takes the lowest released sequence of one counter bucket out of dbo.tProjectIdReleased
        /// (READPAST: two concurrent generators never get the same one). NULL when there is none, or
        /// while the table does not exist (before Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql).</summary>
        private const string ClaimReleasedProjectIdSql = """
            IF OBJECT_ID(N'dbo.tProjectIdReleased', N'U') IS NULL
                SELECT CAST(NULL AS INT);
            ELSE
            BEGIN
                WITH NextReleased AS (
                    SELECT TOP (1) Sequence
                    FROM dbo.tProjectIdReleased WITH (UPDLOCK, READPAST, ROWLOCK)
                    WHERE CategoryId = @CategoryId AND Suffix = @Suffix AND IslandCode = @IslandCode AND YearStart = @YearStart
                    ORDER BY Sequence)
                DELETE FROM NextReleased
                OUTPUT DELETED.Sequence;
            END
            """;

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
            // #481: the project's stored Tier / Origin / Agency / Implementation Mode / Emergency Mode /
            // ROW Available / Feasibility / Detailed Design, so a value retired (set Inactive) after the
            // project chose it is kept, while changing TO a retired value is refused -- the same gate
            // as PreviousThrust. Left null by AddProject and CreateLumpSum (everything is new);
            // UpdateProjectDetails and UpdateLumpSum supply it from the stored record.
            public ProjectDetailsLookupValues? Previous { get; set; }
            // #488: the StartYear of the project's program. Category / Sub-Category validity is
            // judged for the year the project belongs to, not for today (ReferenceYear: 0 = today).
            public int ProgramYear { get; set; }
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
            // #482: the documented rule (Active OR still valid -- FE/UserManual.md 5.7.6) applies to a
            // new or changed Category only. An unchanged one always saves, even once it is fully
            // retired (Inactive AND expired): the form posts the whole project on every save, so
            // checking it locked such a project out of saving for any reason. Same gate as Thrust.
            var ValidateCategory = await _db.ValidateCategoryAsync(p.Category, p.PreviousCategory, p.ProgramYear, cancellationToken);
            if (!ValidateCategory.IsValid)
                return ValidateCategory;

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
                p.Category, p.Thrust, p.PreviousCategory, p.PreviousThrust, p.ProgramYear, cancellationToken);
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


            var ValidateOrigin = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Origin, cancellationToken);
            if (ValidateOrigin == null)
            {
                response.Message = $"Selected Origin '{p.Origin}' is not valid."; response.Title = "Invalid Origin";
                return response;
            }
            var ValidateOriginatingAgency = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Agency, cancellationToken);
            if (ValidateOriginatingAgency == null)
            {
                response.Message = $"Selected Originating Agency '{p.Agency}' is not valid."; response.Title = "Invalid Originating Agency";
                return response;
            }
            var ValidateImplementationMode = await _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.ImplementationMode, cancellationToken);
            if (ValidateImplementationMode == null)
            {
                response.Message = $"Selected Implementation Mode '{p.ImplementationMode}' is not valid."; response.Title = "Invalid Implementation Mode";
                return response;
            }
            var ValidateEmergencyMode = await _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.EmergencyMode, cancellationToken);
            if (ValidateEmergencyMode == null)
            {
                response.Message = $"Selected Emergency Mode '{p.EmergencyMode}' is not valid."; response.Title = "Invalid Emergency Mode";
                return response;
            }
            var ValidateRowAvailable = await _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.RowAvailable, cancellationToken);
            if (ValidateRowAvailable == null)
            {
                response.Message = $"Selected ROW Available '{p.RowAvailable}' is not valid."; response.Title = "Invalid ROW Available";
                return response;
            }
            var ValidateFeasibility = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.Feasibility, cancellationToken);
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
            var ValidateDetailedDesign = await _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == p.DetailedDesign, cancellationToken);
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
            // Retired (Inactive) values: refused only when new or changed against p.Previous (#481).
            var ValidateActive = await _db.ValidateProjectDetailsActiveAsync(
                new ProjectDetailsLookupValues(p.Tier, p.Origin, p.Agency, p.ImplementationMode, p.EmergencyMode, p.RowAvailable, p.Feasibility, p.DetailedDesign),
                p.Previous,
                cancellationToken);
            if (!ValidateActive.IsValid)
                return ValidateActive;
            response.IsValid = true;
            response.Data = p.Region;//ValidateRegion.IslandCode;
            return response;
        }

        /// <summary>A Category is held to the selectable rule only when it is new or changed (#482).</summary>
        public static bool CategoryNeedsValidityCheck(int category, int? previousCategory) =>
            previousCategory == null || category != previousCategory;

        /// <summary>
        /// The documented Category rule (FE/UserManual.md 5.7.6): selectable while Active OR still
        /// valid (Valid Until 0 = no expiry); only a row both Inactive and expired is fully retired.
        /// </summary>
        public static bool CategoryIsSelectable(bool isActive, int validUntil, int year) =>
            isActive || validUntil == 0 || validUntil >= year;

        /// <summary>
        /// The Sub-Category (Thrust) rule (#488): selectable while Active OR when the year falls in
        /// its validity window, both ends included (Valid From / Valid To 0 = open on that side).
        /// </summary>
        public static bool ThrustIsSelectable(bool isActive, int validFrom, int validTo, int year) =>
            isActive || ((validFrom == 0 || validFrom <= year) && (validTo == 0 || validTo >= year));

        /// <summary>
        /// The year Category / Sub-Category validity is judged for (#488): the project's program
        /// StartYear, as the importer has always used; today's year when it is not known (0).
        /// </summary>
        public static int ReferenceYear(int programStartYear) =>
            programStartYear > 0 ? programStartYear : Functions.CurrentDate().Year;

        /// <summary>
        /// The one Category check (#482): the Category must exist, and a new or changed one must be
        /// selectable (CategoryIsSelectable). Unchanged against <paramref name="previousCategory"/> --
        /// or against <paramref name="alsoKept"/>, a resubmitted request's earlier Category -- it is
        /// kept even once fully retired. Used by ValidateProjectDetailsLookups, CreateLumpSum and
        /// RequestRevision / ResubmitRevision.
        /// </summary>
        public static async Task<ProjectHelperResponse<string>> ValidateCategoryAsync(this MYPSDbContext _db, int category, int? previousCategory, int programYear, CancellationToken cancellationToken, int? alsoKept = null)
        {
            var response = new ProjectHelperResponse<string>();
            var Row = await _db.tOptionProjectCategory.AsNoTracking()
                .Where(x => x.CategoryId == category)
                .Select(x => new { x.IsActive, x.ValidUntil })
                .FirstOrDefaultAsync(cancellationToken);
            bool Kept = !CategoryNeedsValidityCheck(category, previousCategory) || category == alsoKept;
            if (Row == null || (!Kept && !CategoryIsSelectable(Row.IsActive, Row.ValidUntil, ReferenceYear(programYear))))
            {
                response.Message = $"Selected Category '{category}' is not valid."; response.Title = "Invalid Category";
                return response;
            }
            response.IsValid = true;
            return response;
        }

        /// <summary>The single-value Project Details lookups that can be retired (#481).</summary>
        public sealed record ProjectDetailsLookupValues(int? Tier, int? Origin, int? Agency, int? ImplementationMode, int? EmergencyMode, int? RowAvailable, int? Feasibility, int? DetailedDesign);

        /// <summary>
        /// The lookups that must still be active: every set value of a new record
        /// (<paramref name="previous"/> null), otherwise only the values that differ from it -- and,
        /// when given, also from <paramref name="alsoKept"/> (a resubmitted modification request may
        /// keep what the project holds or what the request already held).
        /// </summary>
        public static List<(string Lookup, int Value)> ChangedProjectDetailsLookups(ProjectDetailsLookupValues current, ProjectDetailsLookupValues? previous, ProjectDetailsLookupValues? alsoKept = null)
        {
            var changed = new List<(string Lookup, int Value)>();
            void Add(string lookup, Func<ProjectDetailsLookupValues, int?> field)
            {
                if (field(current) is int v && (previous == null || (v != field(previous) && (alsoKept == null || v != field(alsoKept)))))
                    changed.Add((lookup, v));
            }
            Add("Tier", x => x.Tier);
            Add("Origin", x => x.Origin);
            Add("Originating Agency", x => x.Agency);
            Add("Implementation Mode", x => x.ImplementationMode);
            Add("Emergency Mode", x => x.EmergencyMode);
            Add("ROW Available", x => x.RowAvailable);
            Add("Feasibility Study", x => x.Feasibility);
            Add("Detailed Design", x => x.DetailedDesign);
            return changed;
        }

        /// <summary>
        /// Refuses a Project Details lookup value that is unknown or retired (Inactive), but only
        /// on values that are new or changed against <paramref name="previous"/>
        /// (ChangedProjectDetailsLookups): a project keeps a value retired after it was chosen (#481).
        /// Shared by ValidateProjectDetailsLookups, the Lump Sum details check and the Revision saves.
        /// </summary>
        public static async Task<ProjectHelperResponse<string>> ValidateProjectDetailsActiveAsync(this MYPSDbContext _db, ProjectDetailsLookupValues current, ProjectDetailsLookupValues? previous, CancellationToken cancellationToken, ProjectDetailsLookupValues? alsoKept = null)
        {
            var response = new ProjectHelperResponse<string>();
            foreach (var (Lookup, Value) in ChangedProjectDetailsLookups(current, previous, alsoKept))
            {
                var Row = Lookup switch
                {
                    "Tier" => await _db.tOptionProjectTier.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, IsActive = x.IsActive != false }).FirstOrDefaultAsync(cancellationToken),
                    "Origin" => await _db.tOptionProjectOrigin.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "Originating Agency" => await _db.tOptionProjectAgency.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "Implementation Mode" => await _db.tOptionProjectImplementationMode.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "Emergency Mode" => await _db.tOptionProjectEmergencyMode.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "ROW Available" => await _db.tOptionProjectRowAvailable.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "Feasibility Study" => await _db.tOptionProjectFeasibilityStudy.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    "Detailed Design" => await _db.tOptionProjectDetailedDesign.AsNoTracking().Where(x => x.NameId == Value).Select(x => new { x.Name, x.IsActive }).FirstOrDefaultAsync(cancellationToken),
                    _ => throw new InvalidOperationException($"No lookup table for '{Lookup}'."),
                };
                if (Row == null || !Row.IsActive)
                {
                    response.Title = $"Invalid {Lookup}";
                    response.Message = Row == null
                        ? $"Selected {Lookup} '{Value}' is not valid."
                        : $"Selected {Lookup} '{Row.Name}' is inactive and cannot be chosen.";
                    return response;
                }
            }
            response.IsValid = true;
            return response;
        }

        /// <summary>A Major Item row as far as the retired-lookup check needs it (#479).</summary>
        public sealed record MajorItemLookupRow(int Id, bool IsDeleted, int WorkTypeFK, string InfraTypeFK);

        /// <summary>
        /// Rejects a Major Item Work Type / Infrastructure Type that is not active, on rows that are
        /// new or changed against <paramref name="stored"/> (RetiredLookupRule.RowsRequiringActiveCheck).
        /// A row that already holds a since-retired value keeps it, and can be deleted (#479). Shared by
        /// UpdateProjectDetails and the RequestRevision / ResubmitRevision saves.
        /// </summary>
        /// <param name="stored">The rows as currently saved, matched to <paramref name="posted"/> by Id.</param>
        public static async Task<ProjectHelperResponse<string>> ValidateMajorItemLookupsAsync(this MYPSDbContext _db, IEnumerable<MajorItemLookupRow> posted, IEnumerable<MajorItemLookupRow> stored, CancellationToken cancellationToken)
        {
            var response = new ProjectHelperResponse<string>();
            // Each field is checked on its own (as #480 does for funding lines): a row is checked for
            // the Work Type it changed, and for the Infra Type it changed. With one key for both, a
            // revision that picked another Type of Work under the row's own, since-retired Infra Type
            // (the Modification form allows that when the revision rule opens Type of Work) was
            // refused with "Invalid Infrastructure Type", a field the user never touched (2026-10-29).
            // Infra codes compared the way SQL Server does (case-insensitive, trailing blanks ignored).
            static string InfraKey(MajorItemLookupRow x) => (x.InfraTypeFK ?? string.Empty).Trim().ToUpperInvariant();
            var storedRows = stored.DistinctBy(x => x.Id).ToList();
            var postedRows = posted.ToList();
            var workTypeRows = RetiredLookupRule.RowsRequiringActiveCheck(
                postedRows, x => x.Id, x => x.IsDeleted, x => x.WorkTypeFK,
                storedRows.ToDictionary(x => x.Id, x => x.WorkTypeFK));
            var infraTypeRows = RetiredLookupRule.RowsRequiringActiveCheck(
                postedRows, x => x.Id, x => x.IsDeleted, InfraKey,
                storedRows.ToDictionary(x => x.Id, InfraKey));

            var workTypeIds = workTypeRows.Select(x => x.WorkTypeFK).Distinct().ToList();
            if (workTypeIds.Count > 0)
            {
                var validWorkTypes = await _db.tOptionScopeOfWork.AsNoTracking()
                    .Where(x => x.IsActive && workTypeIds.Contains(x.Enum))
                    .Select(x => x.Enum)
                    .ToListAsync(cancellationToken);
                var invalidWorkTypes = workTypeIds.Where(x => !validWorkTypes.Contains(x)).ToList();
                if (invalidWorkTypes.Any())
                {
                    response.Title = "Invalid Work Type";
                    response.Message = $"The following Work Type(s) are invalid or inactive: {string.Join(", ", invalidWorkTypes)}.";
                    return response;
                }
            }

            var infraTypeCodes = infraTypeRows.Select(x => x.InfraTypeFK).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (infraTypeCodes.Count > 0)
            {
                var validInfraTypes = (await _db.tOptionInfraType.AsNoTracking()
                    .Where(x => x.IsActive && infraTypeCodes.Contains(x.InfraCode))
                    .Select(x => x.InfraCode)
                    .ToListAsync(cancellationToken))
                    .Select(x => x.Trim())
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                var invalidInfraTypes = infraTypeCodes.Where(x => !validInfraTypes.Contains((x ?? string.Empty).Trim())).ToList();
                if (invalidInfraTypes.Any())
                {
                    response.Title = "Invalid Infrastructure Type";
                    response.Message = $"The following Infrastructure Type(s) are invalid or inactive: {string.Join(", ", invalidInfraTypes)}.";
                    return response;
                }
            }
            response.IsValid = true;
            return response;
        }

        /// <summary>A funding line as far as the retired-lookup check needs it (#480).</summary>
        public sealed record FundingLookupRow(int Id, bool IsDeleted, string SourceOrg, string AgreementCode);

        /// <summary>A Source / Agreement code compared the way SQL Server does: case-insensitive, trimmed.</summary>
        public static string FundingLookupCode(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

        /// <summary>
        /// Rejects an inactive Funding Source / Funding Agreement on funding lines that are new, or
        /// whose Source (resp. Agreement) changed against <paramref name="stored"/>
        /// (RetiredLookupRule.RowsRequiringActiveCheck). Each field is judged on its own: a line keeps
        /// a since-retired Source while its Agreement changes under it -- the form keeps showing that
        /// Source -- and the other way round (#480). Unknown codes fail too ("invalid or inactive"):
        /// the Revision saves have no separate existence check. Shared by UpdateProjectDetails,
        /// RequestRevision / ResubmitRevision and the Lump Sum writes (new lines only).
        /// </summary>
        /// <param name="stored">The lines as currently saved, matched to <paramref name="posted"/> by Id.</param>
        public static async Task<ProjectHelperResponse<string>> ValidateFundingLookupsAsync(this MYPSDbContext _db, IEnumerable<FundingLookupRow> posted, IEnumerable<FundingLookupRow> stored, CancellationToken cancellationToken)
        {
            var response = new ProjectHelperResponse<string>();
            var postedRows = posted.ToList();
            var storedRows = stored.DistinctBy(x => x.Id).ToList();

            List<string> Changed(Func<FundingLookupRow, string> field) =>
                RetiredLookupRule.RowsRequiringActiveCheck(
                        postedRows, x => x.Id, x => x.IsDeleted, x => FundingLookupCode(field(x)),
                        storedRows.ToDictionary(x => x.Id, x => FundingLookupCode(field(x))))
                    .Select(x => (field(x) ?? string.Empty).Trim())
                    .Where(x => x.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

            static async Task<List<string>> NotActive(List<string> codes, Func<List<string>, Task<List<string>>> loadActive)
            {
                if (codes.Count == 0) return new List<string>();
                var active = (await loadActive(codes)).Select(x => x.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                return codes.Where(x => !active.Contains(x)).ToList();
            }

            var inactiveSources = await NotActive(Changed(x => x.SourceOrg), codes => _db.tOptionFundingSource.AsNoTracking()
                .Where(x => x.IsActive && codes.Contains(x.Organization)).Select(x => x.Organization).ToListAsync(cancellationToken));
            if (inactiveSources.Any())
            {
                response.Title = "Invalid Funding Profile Source";
                response.Message = $"The following Funding Source(s) are invalid or inactive and cannot be used on a new or changed funding line: {string.Join(", ", inactiveSources)}.";
                return response;
            }

            var inactiveAgreements = await NotActive(Changed(x => x.AgreementCode), codes => _db.tOptionFundingAgreement.AsNoTracking()
                .Where(x => x.IsActive && codes.Contains(x.Code)).Select(x => x.Code).ToListAsync(cancellationToken));
            if (inactiveAgreements.Any())
            {
                response.Title = "Invalid Funding Profile Agreement";
                response.Message = $"The following Funding Agreement(s) are invalid or inactive and cannot be used on a new or changed funding line: {string.Join(", ", inactiveAgreements)}.";
                return response;
            }
            response.IsValid = true;
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
            int? previousCategory, int? previousThrust, int programYear, CancellationToken cancellationToken)
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

            // #488: valid for the program's year (inclusive window), not today's.
            var ValidateThrust = await _db.tOptionProjectThrustList.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PAPKey == thrust.Value, cancellationToken);
            if (ValidateThrust == null
                || !ThrustIsSelectable(ValidateThrust.IsActive, ValidateThrust.ValidFromDate, ValidateThrust.ValidToDate, ReferenceYear(programYear)))
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

        #region ProjectDeletionTier — the single project-deletion rule (file-based SQL)
        // Converted 2026-10-16: runs the deletion rule DIRECTLY from the .sql files under
        // Main/Resources/Internal/SQLObjects/ via ISqlExecutor.ExecuteScriptFile*
        // InTransactionAsync — no compiled DB function/procedure is used for this feature any
        // longer. The script IS the rule — hard only on a project's first stage entry, soft
        // once it has progressed, Lump Sum itemized projects always hard, published never,
        // independent of the BP/P prefix — and every delete path asks it: Batch Delete,
        // Delete Program, Delete Lump Sum, Delete Itemized Project. Never re-state the rule
        // in C#; read Tier.
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

        internal const string GetProjectDeletionTierScript = "Functions/GetProjectDeletionTier.sql";
        internal const string ExecuteProjectDeletionScript = "Stored Procedures/ExecuteProjectDeletion.sql";

        /// <summary>One row of Functions/GetProjectDeletionTier.sql. <see cref="Ref"/> is the reference as given
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
        /// A delete the single deletion rule refused, carrying the plain-language reason
        /// (e.g. "Project X cannot be permanently deleted: program is approved."). Controllers
        /// turn it into a 400 whose Message is <see cref="Reason"/>; ExceptionHandler would
        /// otherwise reduce it to a generic database error. Same pattern as
        /// <see cref="ProjectIdRangeExhaustedException"/>. Kept as a plain application
        /// exception now (no SQL RAISERROR token to parse) — the refusal is raised directly
        /// in C# wherever the tier check fails, before any script runs.
        /// </summary>
        public sealed class DeletionRefusedException : Exception
        {
            public const string Token = "DELETE_REFUSED:";
            public string Reason { get; }

            public DeletionRefusedException(string reason, Exception? inner = null) : base(reason, inner) => Reason = reason;

            /// <summary>Kept for compatibility with any remaining caller that still catches a raw
            /// SqlException carrying the legacy token (e.g. a not-yet-converted raw-SQL path).</summary>
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
        /// Stored Procedures/ExecuteProjectDeletion.sql itself.
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

        /// <summary>Opens <paramref name="db"/>'s underlying ADO.NET connection if it is not already open
        /// (required before running a script against it directly, bypassing EF's own command pipeline).</summary>
        private static async Task EnsureConnectionOpenAsync(MYPSDbContext db, CancellationToken cancellationToken)
        {
            if (db.Database.GetDbConnection().State != ConnectionState.Open)
            {
                await db.Database.OpenConnectionAsync(cancellationToken);
            }
        }

        /// <summary>Parameters for Functions/GetProjectDeletionTier.sql: the references as a JSON array, so a
        /// whole batch is answered by ONE query (2026-10-16).</summary>
        internal static object TierParameters(IEnumerable<string> projectRefs, string programFK) => new
        {
            ProjectRefs = System.Text.Json.JsonSerializer.Serialize(projectRefs.Distinct(StringComparer.OrdinalIgnoreCase).ToArray()),
            ProgramFK = programFK
        };

        /// <summary>An executor on the same database as <paramref name="db"/>, never the static default
        /// connection string (a DbContext can point elsewhere, e.g. in a test host).</summary>
        private static SqlExecutor ExecutorFor(MYPSDbContext db) => new SqlExecutor(db.Database.GetConnectionString());

        /// <summary>
        /// The tier of every reference in <paramref name="projectRefs"/>, in ONE call of
        /// Functions/GetProjectDeletionTier.sql (it takes a JSON array). Runs inside the transaction
        /// <paramref name="db"/> currently has open, if any, so it sees uncommitted writes already
        /// made on it; otherwise on its own connection to the same database. A reference that
        /// resolves to nothing has no row; one that matches more than one project has several and
        /// must be refused as ambiguous (see the script header).
        /// </summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTiersAsync(
            this MYPSDbContext db, IEnumerable<string> projectRefs, string programFK, CancellationToken cancellationToken = default)
        {
            var refs = projectRefs.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (refs.Count == 0)
            {
                return new List<ProjectDeletionTierResult>();
            }

            var sql = ExecutorFor(db);
            var efTx = db.Database.CurrentTransaction?.GetDbTransaction();
            IEnumerable<ProjectDeletionTierResult> rows;
            if (efTx != null)
            {
                await EnsureConnectionOpenAsync(db, cancellationToken);
                rows = await sql.ExecuteScriptFileInTransactionAsync<ProjectDeletionTierResult>(
                    GetProjectDeletionTierScript, TierParameters(refs, programFK), efTx, ct: cancellationToken);
            }
            else
            {
                rows = await sql.ExecuteScriptFileInTransactionAsync<ProjectDeletionTierResult>(
                    GetProjectDeletionTierScript, TierParameters(refs, programFK), ct: cancellationToken);
            }
            return rows.ToList();
        }

        /// <summary>Single-reference form of <see cref="DetermineProjectDeletionTiersAsync"/>.</summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTierAsync(
            this MYPSDbContext db, string projectRef, string programFK, CancellationToken cancellationToken = default)
            => await db.DetermineProjectDeletionTiersAsync(new[] { projectRef }, programFK, cancellationToken);

        /// <summary>
        /// The tier row of the project whose ProjectPK is <paramref name="projectPK"/> -- that row and no
        /// other. The tier script also matches a reference against revision ProjectIds, and BP/P numbers
        /// share digits (the BP->P swap), so one string can be one project's PK and another project's
        /// revision id. A delete that holds a PK must never fall back to that other project: when the PK's
        /// own row is not there (e.g. a concurrent delete already removed it), the delete is refused as
        /// not found, never redirected to a project nobody asked for and whose rows were never locked
        /// (2026-10-17). Resolving what a user typed, BP- or P-form, belongs to the caller before this
        /// (Batch Delete's plan, restore), which refuses an ambiguous string.
        /// </summary>
        private static ProjectDeletionTierResult RequireOwnTierRow(List<ProjectDeletionTierResult> tierRows, string projectPK)
            => tierRows.FirstOrDefault(x => string.Equals(x.ProjectFK, projectPK, StringComparison.OrdinalIgnoreCase))
               ?? throw new DeletionRefusedException($"Project {projectPK} was not found in this program.");

        /*  Taken before a delete decides. It decides nothing: it holds every row
            Functions/GetProjectDeletionTier.sql reads for one project until the transaction ends --
            the program's current status and stages (an approval or stage advance), the project's own
            row (a publish), and its stage rows under the program -- so the tier cannot change between
            the decision and the delete. Reading the columns (not COUNT(*)) makes SQL Server lock the
            rows themselves, not only the index keys; HOLDLOCK makes inserts wait too. The database
            reads row versions (READ_COMMITTED_SNAPSHOT), so a plain read would not wait for a
            concurrent publish -- the lock is what makes the decision current. Project rows FIRST, then
            program rows: the order every other project writer uses (a project or revision save locks its
            rows, then RecomputeProgramCostAsync updates tProgramRevisions), so a delete and a save queue
            instead of deadlocking. (Delete Program, the one path that goes the other way, never runs
            alongside a project delete: the per-program delete lock.) FORCESEEK on tProjects (ProjectPK is
            always unique-indexed) keeps that lock to the named projects' own rows; tProjectStages is left
            to the optimizer, because a FORCESEEK with no usable index is an error, not a slow plan (a
            database without IX_tProjectStages_ProjectFK would fail every delete). Takes a JSON array, so a
            whole Batch Delete locks in one round trip. */
        internal const string LockProjectsForDeletionSql = """
            DECLARE @Int INT, @Text NVARCHAR(400);
            SELECT @Int = MAX(CAST(p.IsPublished AS INT) + CAST(p.IsRevised AS INT)), @Text = MAX(CONCAT(p.ProjectType, p.ParentProjectId))
              FROM OPENJSON(@ProjectFKs) WITH (ProjectFK NVARCHAR(200) '$') j
              JOIN dbo.tProjects p WITH (UPDLOCK, HOLDLOCK, FORCESEEK) ON p.ProjectPK = j.ProjectFK COLLATE DATABASE_DEFAULT;
            SELECT @Int = MAX(s.RevisionId + s.StageId)
              FROM OPENJSON(@ProjectFKs) WITH (ProjectFK NVARCHAR(200) '$') j
              JOIN dbo.tProjectStages s WITH (UPDLOCK, HOLDLOCK) ON s.ProjectFK = j.ProjectFK COLLATE DATABASE_DEFAULT
              WHERE s.ProgramFK = @ProgramFK;
            SELECT @Int = MAX(Status) FROM dbo.tProgramRevisions WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Int = MAX(RevisionId + StageId) FROM dbo.tProgramStages WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            """;

        /// <summary>
        /// THE decision for deleting projects, on locked rows, for a whole batch in two round trips:
        /// locks what the tier depends on (<see cref="LockProjectsForDeletionSql"/>), then reads
        /// Functions/GetProjectDeletionTier.sql once for all of them, inside <paramref name="tx"/>.
        /// Every hard and soft delete decides here. <paramref name="projectFKs"/> must be ProjectPKs: a
        /// BP- or P-form reference is resolved by the caller (Batch Delete's plan) before this point, and
        /// each key gets its own project's row only (<see cref="RequireOwnTierRow"/>). Returns each one's
        /// row; throws <see cref="DeletionRefusedException"/> when one is not found.
        /// </summary>
        public static async Task<Dictionary<string, ProjectDeletionTierResult>> DecideProjectDeletionsUnderLockAsync(
            this ISqlExecutor sql, IEnumerable<string> projectFKs, string programFK, IDbTransaction tx, CancellationToken cancellationToken = default)
        {
            var keys = projectFKs.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var decided = new Dictionary<string, ProjectDeletionTierResult>(StringComparer.OrdinalIgnoreCase);
            if (keys.Count == 0)
            {
                return decided;
            }
            await tx.Connection!.ExecuteAsync(new CommandDefinition(
                LockProjectsForDeletionSql,
                new { ProjectFKs = System.Text.Json.JsonSerializer.Serialize(keys), ProgramFK = programFK },
                tx, 120, cancellationToken: cancellationToken));
            var rows = (await sql.ExecuteScriptFileInTransactionAsync<ProjectDeletionTierResult>(
                GetProjectDeletionTierScript, TierParameters(keys, programFK), tx, ct: cancellationToken)).ToList();
            foreach (var key in keys)
            {
                decided[key] = RequireOwnTierRow(rows.Where(x => string.Equals(x.Ref, key, StringComparison.OrdinalIgnoreCase)).ToList(), key);
            }
            return decided;
        }

        /// <summary>EF form of <see cref="DecideProjectDeletionsUnderLockAsync(ISqlExecutor, IEnumerable{string}, string, IDbTransaction, CancellationToken)"/>,
        /// on the transaction <paramref name="db"/> has open (required).</summary>
        public static async Task<Dictionary<string, ProjectDeletionTierResult>> DecideProjectDeletionsUnderLockAsync(
            this MYPSDbContext db, IEnumerable<string> projectFKs, string programFK, CancellationToken cancellationToken = default)
        {
            var efTx = RequireTransaction(db, nameof(DecideProjectDeletionsUnderLockAsync));
            await EnsureConnectionOpenAsync(db, cancellationToken);
            return await ExecutorFor(db).DecideProjectDeletionsUnderLockAsync(projectFKs, programFK, efTx, cancellationToken);
        }

        /// <summary>
        /// THE decision for deleting one project, on locked rows: locks what the tier depends on
        /// (<see cref="LockProjectsForDeletionSql"/>), then reads Functions/GetProjectDeletionTier.sql
        /// inside <paramref name="tx"/>. Every hard and soft delete of a single project decides here.
        /// <paramref name="projectFK"/> must be the ProjectPK. Throws
        /// <see cref="DeletionRefusedException"/> when that project is not found (never another one).
        /// </summary>
        public static async Task<ProjectDeletionTierResult> DecideProjectDeletionUnderLockAsync(
            this ISqlExecutor sql, string projectFK, string programFK, IDbTransaction tx, CancellationToken cancellationToken = default)
            => (await sql.DecideProjectDeletionsUnderLockAsync(new[] { projectFK }, programFK, tx, cancellationToken))[projectFK];

        /// <summary>EF form of <see cref="DecideProjectDeletionUnderLockAsync(ISqlExecutor, string, string, IDbTransaction, CancellationToken)"/>,
        /// on the transaction <paramref name="db"/> has open (required).</summary>
        public static async Task<ProjectDeletionTierResult> DecideProjectDeletionUnderLockAsync(
            this MYPSDbContext db, string projectFK, string programFK, CancellationToken cancellationToken = default)
        {
            var efTx = RequireTransaction(db, nameof(DecideProjectDeletionUnderLockAsync));
            await EnsureConnectionOpenAsync(db, cancellationToken);
            return await ExecutorFor(db).DecideProjectDeletionUnderLockAsync(projectFK, programFK, efTx, cancellationToken);
        }

        private static IDbTransaction RequireTransaction(MYPSDbContext db, string caller) =>
            db.Database.CurrentTransaction?.GetDbTransaction()
            ?? throw new InvalidOperationException(
                $"{caller} requires an open EF transaction (db.Database.BeginTransactionAsync) " +
                "so the delete commits or rolls back together with the rest of the caller's action.");

        /// <summary>
        /// Runs Stored Procedures/ExecuteProjectDeletion.sql for a project whose tier was ALREADY
        /// decided 'Hard' on rows this transaction holds locked (by
        /// <see cref="DecideProjectDeletionUnderLockAsync(ISqlExecutor, string, string, IDbTransaction, CancellationToken)"/>
        /// or ProgramHelper's program-wide lock). Refuses anything but 'Hard'. The script removes the
        /// project's rows under <paramref name="programFK"/> only, and writes its tTransactionLog row.
        /// </summary>
        public static Task<int> DeleteDecidedProjectAsync(
            this ISqlExecutor sql, ProjectDeletionTierResult tier, string programFK, string userId, DateTime currentDate,
            IDbTransaction tx, CancellationToken cancellationToken = default)
        {
            if (tier.Tier != ProjectDeletionTiers.Hard)
            {
                throw new DeletionRefusedException($"Project {tier.ProjectFK} cannot be permanently deleted: {tier.Reason}.");
            }
            return sql.ExecuteScriptFileNonQueryInTransactionAsync(
                ExecuteProjectDeletionScript,
                new
                {
                    ProjectFK = tier.ProjectFK,
                    ProgramFK = programFK,
                    UserId = userId,
                    CurrentDate = currentDate,
                    Kind = tier.Kind,
                    StageCount = tier.StageCount,
                    Reason = tier.Reason
                },
                tx, ct: cancellationToken);
        }

        /// <summary>EF form of <see cref="DeleteDecidedProjectAsync(ISqlExecutor, ProjectDeletionTierResult, string, string, DateTime, IDbTransaction, CancellationToken)"/>:
        /// only for a tier decided by <see cref="DecideProjectDeletionsUnderLockAsync(MYPSDbContext, IEnumerable{string}, string, CancellationToken)"/>
        /// in this same transaction (its rows are still locked).</summary>
        public static async Task<int> DeleteDecidedProjectAsync(
            this MYPSDbContext db, ProjectDeletionTierResult tier, string programFK, string userId, DateTime currentDate,
            CancellationToken cancellationToken = default)
        {
            var efTx = RequireTransaction(db, nameof(DeleteDecidedProjectAsync));
            await EnsureConnectionOpenAsync(db, cancellationToken);
            return await ExecutorFor(db).DeleteDecidedProjectAsync(tier, programFK, userId, currentDate, efTx, cancellationToken);
        }

        /// <summary>
        /// Hard-deletes one project under one program, inside the transaction <paramref name="db"/>
        /// has open (REQUIRED, so the cascade commits or rolls back with the rest of the caller's
        /// action). Decides on locked rows first (<see cref="DecideProjectDeletionUnderLockAsync(MYPSDbContext, string, string, CancellationToken)"/>)
        /// and refuses with <see cref="DeletionRefusedException"/> for anything but 'Hard'.
        /// </summary>
        public static async Task<int> ExecuteProjectDeletionAsync(
            this MYPSDbContext db, string projectFK, string programFK, string userId, DateTime currentDate, CancellationToken cancellationToken = default)
        {
            var efTx = RequireTransaction(db, nameof(ExecuteProjectDeletionAsync));
            await EnsureConnectionOpenAsync(db, cancellationToken);
            var sql = ExecutorFor(db);
            var tier = await sql.DecideProjectDeletionUnderLockAsync(projectFK, programFK, efTx, cancellationToken);
            return await sql.DeleteDecidedProjectAsync(tier, programFK, userId, currentDate, efTx, cancellationToken);
        }

        /// <summary>File-based form of <see cref="DetermineProjectDeletionTierAsync(MYPSDbContext, string, string, CancellationToken)"/>
        /// for callers holding an <see cref="ISqlExecutor"/> rather than a DbContext. Read-only, no lock.</summary>
        public static async Task<List<ProjectDeletionTierResult>> DetermineProjectDeletionTierAsync(
            this ISqlExecutor sql, string projectRef, string programFK, CancellationToken cancellationToken = default)
        {
            var rows = await sql.ExecuteScriptFileInTransactionAsync<ProjectDeletionTierResult>(
                GetProjectDeletionTierScript, TierParameters(new[] { projectRef }, programFK), ct: cancellationToken);
            return rows.ToList();
        }

        /// <summary>
        /// ISqlExecutor form of the hard delete. With <paramref name="tx"/> it joins that transaction;
        /// without, it runs in its own. Either way it decides on locked rows first and refuses with
        /// <see cref="DeletionRefusedException"/> when the project <paramref name="projectFK"/> (a
        /// ProjectPK; a revision id is not resolved here) is not found, or its tier is not Hard.
        /// </summary>
        public static async Task ExecuteProjectDeletionAsync(
            this ISqlExecutor sql, string projectFK, string programFK, string userId, DateTime currentDate,
            IDbTransaction? tx = null, CancellationToken cancellationToken = default)
        {
            if (tx != null)
            {
                var tier = await sql.DecideProjectDeletionUnderLockAsync(projectFK, programFK, tx, cancellationToken);
                await sql.DeleteDecidedProjectAsync(tier, programFK, userId, currentDate, tx, cancellationToken);
                return;
            }
            await sql.ExecuteTransactionAsync(async (_, transaction) =>
            {
                var tier = await sql.DecideProjectDeletionUnderLockAsync(projectFK, programFK, transaction, cancellationToken);
                return await sql.DeleteDecidedProjectAsync(tier, programFK, userId, currentDate, transaction, cancellationToken);
            }, ct: cancellationToken);
        }
        #endregion
    }
}
