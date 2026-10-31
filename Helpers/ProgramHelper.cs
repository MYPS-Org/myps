using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Drawing;
using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using static Dapper.SqlMapper;

namespace Helpers
{
    public class ProgramHelperResponse
    {
        public bool IsValid { get; set; } = false;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public ProgramHelperDataResult Data { get; set; } = new ProgramHelperDataResult();
    }
    public class ProgramHelperDataResult
    {
        public DBHelper.Models.Table.Program.Programs Program { get; set; } = new DBHelper.Models.Table.Program.Programs();
        public DBHelper.Models.Functions.Program.ProgramDetails ProgramRevision { get; set; } = new DBHelper.Models.Functions.Program.ProgramDetails();
        public DBHelper.Models.Table.Program.ProgramStages ProgramStage { get; set; } = new DBHelper.Models.Table.Program.ProgramStages();
    }
    public class ProgramHelperParams
    {
        public string ProgramId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public DBHelper.Models.Views.Users _Session { get; set; } = new DBHelper.Models.Views.Users();
        public bool ViewOldStage { get; set; } = false;
    }
    public static class ProgramHelper
    {
        // 2026-10-25, UAT S01-TC008-P001: prompts name the program, never its ProgramId/ProgramPK.
        // Users don't know those codes, and the ProgramId changes on every stage advance, so the one
        // in a prompt rarely matched the one in the page URL.
        public const string ProgramNotFoundMessage =
            "This program could not be found. It may have been deleted. Reload the Program List and open it again.";

        /// <summary>
        /// True when a vProgramLatest.Status is Approved. The view returns the status NAME
        /// ("Approved" / "Working"), never the number, so compare names, not "1".
        /// </summary>
        public static bool IsApprovedStatus(string? status) =>
            string.Equals(status?.Trim(), EnumProgramStatus.Approved.ToString(), StringComparison.OrdinalIgnoreCase);

        /// <summary>"program 'HGAB 2025 SSP'", or "this program" when the name is blank.</summary>
        public static string ProgramLabel(string? name) =>
            string.IsNullOrWhiteSpace(name) ? "this program" : $"program '{name.Trim()}'";

        public static string Capitalize(string label) => char.ToUpperInvariant(label[0]) + label[1..];

        /// <summary>
        /// The program's current name for a message (a lookup may have matched an older stage's
        /// revision, with an older name), falling back to <paramref name="fallbackName"/>.
        /// </summary>
        public static async Task<string> CurrentProgramLabelAsync(this MYPSDbContext _db, string programPK, string? fallbackName, CancellationToken cancellationToken)
        {
            var name = await _db.vProgramLatest.AsNoTracking()
                .Where(x => x.ProgramPK == programPK)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
            return ProgramLabel(string.IsNullOrWhiteSpace(name) ? fallbackName : name);
        }

        /// <summary>
        /// Why a batch action's program lookup missed. The batch actions find the program by its
        /// CURRENT ProgramId (vProgramLatest), which changes on every stage advance, so a miss is
        /// almost always the page sending the ProgramId of an older stage the user is viewing, not
        /// a missing program. Says so by name and current stage instead of echoing the id.
        /// </summary>
        public static async Task<(string Title, string Message)> DescribeProgramNotCurrentAsync(this MYPSDbContext _db, string programId, CancellationToken cancellationToken)
        {
            var revision = await _db.tProgramRevisions.AsNoTracking()
                .Where(x => x.ProgramId == programId)
                .Select(x => new { x.ProgramFK, x.Name })
                .FirstOrDefaultAsync(cancellationToken);
            var latest = revision == null ? null : await _db.vProgramLatest.AsNoTracking()
                .Where(x => x.ProgramPK == revision.ProgramFK)
                .Select(x => new { x.Name, x.StageName })
                .FirstOrDefaultAsync(cancellationToken);
            if (latest == null)
            {
                return ("Program Not Found", ProgramNotFoundMessage);
            }
            var label = ProgramLabel(string.IsNullOrWhiteSpace(latest.Name) ? revision!.Name : latest.Name);
            return ("Not the Current Stage",
                $"{Capitalize(label)} has moved on to the {latest.StageName} stage. Batch actions only work on a program's current stage: open it at {latest.StageName} and try again.");
        }

        /// <summary>
        /// 2026-10-30: the program data-security rule, in one place. An Apply Filter user may use a program
        /// only when their region (RegCode) is in its Data Security Group; everyone else may use any.
        /// ValidateProgramId checks one program with it, <see cref="GetAccessibleProgramPKsAsync"/> a batch.
        /// </summary>
        public static bool CanAccessProgram(this DBHelper.Models.Views.Users session, string[] dataSecurityGroup) =>
            !session.ApplyFilter || dataSecurityGroup.Contains(session.RegCode);

        /// <summary>
        /// 2026-10-30: ValidateProgramId's data-security check for many programs at once, for the searches
        /// that list programs (Global Search, Project > SearchProgram). Null: no restriction for this user.
        /// Otherwise the ProgramPKs of <paramref name="programPKs"/> the user may use.
        /// </summary>
        public static async Task<HashSet<string>?> GetAccessibleProgramPKsAsync(this MYPSDbContext _db, DBHelper.Models.Views.Users session, IReadOnlyCollection<string> programPKs, CancellationToken cancellationToken)
        {
            if (!session.ApplyFilter)
                return null;
            var programs = await _db.tPrograms.AsNoTracking()
                .Where(x => programPKs.Contains(x.ProgramPK))
                .Select(x => new { x.ProgramPK, x.DataSecurityGroup })
                .ToListAsync(cancellationToken);
            return programs
                .Where(x => session.CanAccessProgram(x.DataSecurityGroup))
                .Select(x => x.ProgramPK)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        public static async Task<ProgramHelperResponse> ValidateProgramId(this MYPSDbContext _db, ProgramHelperParams dto, CancellationToken cancellationToken)
        {
            var response = new ProgramHelperResponse();
            if (string.IsNullOrWhiteSpace(dto.ProgramId))
            {
                response.Message = "Program ID cannot be null or empty.";
                response.Title = "Invalid Program ID";
                return response;
            }
            if (!Enum.TryParse<EnumProgramStage>(dto.StageName.Replace("-",""), out var SelectedStage))
            {
                response.Title = "Invalid Stage";
                response.Message = $"'{dto.StageName}' is not a valid program stage.";
                return response;
            }
            // 2026-09-10 fix: every real caller of this method (Program List's View/View Details
            // buttons, ProgramDetail.tsx's own re-fetch, Global Search) sends the program's stable
            // ProgramPK in this field, not a per-revision ProgramId -- confirmed by tracing every
            // FE call site, including an explicit prior-developer comment in ProgramDetail.tsx
            // naming the URL segment "programPK". ProgramId and ProgramPK are only equal by
            // coincidence for a program's very first revision (ProgramController.cs's AddProgram
            // sets them equal at creation; every stage-advance mints a fresh ProgramId while
            // ProgramPK stays fixed) -- so this lookup only succeeded for single-revision programs
            // (23/29 live) and threw "Program Not Found" for every other program's View button
            // (6/29 live, 21%), not just via Global Search. GetProgramPK is used only for its
            // ProgramFK below, so accepting either shape here is safe -- it resolves to the same
            // value either way.
            var GetProgramPK = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId || x.ProgramFK == dto.ProgramId, cancellationToken);
            if (GetProgramPK == null)
            {
                response.Title = "Program Not Found";
                response.Message = ProgramNotFoundMessage;
                return response;
            }
            var CheckProgramStage = await _db.fProgramStages
                .FromSqlInterpolated($"SELECT * FROM fProgramStages({GetProgramPK.ProgramFK}) WHERE StageName = {dto.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
            if (CheckProgramStage == null)
            {
                response.Title = "Stage Not Found";
                response.Message = $"The {dto.StageName} stage does not exist for {await _db.CurrentProgramLabelAsync(GetProgramPK.ProgramFK, GetProgramPK.Name, cancellationToken)}.";
                return response;
            }
            if (!dto.ViewOldStage)
            {
                // 2026-09-10 fix: was `x.ProgramId == dto.ProgramId`, same ambiguity as the lookup
                // above -- dto.ProgramId is a ProgramPK in real traffic, and vProgramLatest.ProgramId
                // is a per-revision value, so this always failed for any ProgramPK-shaped caller
                // (not just here: it would ALSO have been true for ANY valid ProgramPK regardless of
                // which stage was requested, if simply OR'd in, since vProgramLatest has exactly one
                // row per program -- silently defeating the outdated-stage check entirely). Comparing
                // the already-resolved (Program, Stage) pair instead is correct for both input shapes
                // and is a more precise statement of "is this actually the current stage" than
                // matching on ProgramId ever was.
                var currentVersion = await _db.vProgramLatest.FirstOrDefaultAsync(x => x.ProgramPK == GetProgramPK.ProgramFK && x.StageId == CheckProgramStage.StageId, cancellationToken);
                if (currentVersion == null)
                {
                    response.Title = "Outdated Program Stage";
                    response.Message = "You are viewing an old stage of this program. Please go back to the Program List and open the program again to view the latest stage.";
                    return response;
                }
            }
            var ProgramParent = await _db.tPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == CheckProgramStage.ProgramPK, cancellationToken);
            if (ProgramParent == null)
            {
                response.Title = "Program Not Found";
                response.Message = ProgramNotFoundMessage;
                return response;
            }
            if (!dto._Session.CanAccessProgram(ProgramParent.DataSecurityGroup))
            {
                response.Title = "Access Denied";
                response.Message = $"You do not have permission to update {await _db.CurrentProgramLabelAsync(GetProgramPK.ProgramFK, GetProgramPK.Name, cancellationToken)}. Please contact your administrator.";
                return response;
            }
            response.IsValid = true;
            response.Data.Program = ProgramParent;
            var GetProgramRevision = await _db.fProgramDetails.FromSqlInterpolated($"SELECT * FROM fProgramDetails({ProgramParent.ProgramPK}, {CheckProgramStage.StageId})").AsNoTracking().FirstOrDefaultAsync(cancellationToken);
            if(GetProgramRevision == null)
            {
                response.Title = "Program Revision Not Found";
                response.Message = $"The {dto.StageName} details of {await _db.CurrentProgramLabelAsync(GetProgramPK.ProgramFK, GetProgramPK.Name, cancellationToken)} could not be found.";
                return response;
            }
            var GetProgramStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == CheckProgramStage.Id, cancellationToken);
            if (GetProgramStage == null)
            {
                response.Title = "Program Stage Not Found";
                response.Message = $"The {dto.StageName} stage of {await _db.CurrentProgramLabelAsync(GetProgramPK.ProgramFK, GetProgramPK.Name, cancellationToken)} could not be found.";
                return response;
            }
            response.Data.ProgramRevision = GetProgramRevision;
            response.Data.ProgramStage = GetProgramStage;
            return response;
        }

        #region ProgramDeletionEligibility (file-based SQL via ISqlExecutor)
        // Added 2026-10-14, operator-directed deep-protocol engagement; converted 2026-10-16
        // to run the deletion rule DIRECTLY from the .sql files under Main/Resources/Internal/
        // SQLObjects/ via ISqlExecutor.ExecuteScriptFile*InTransactionAsync -- no
        // compiled DB function/procedure is used for this feature any longer. Global, usable
        // anywhere ISqlExecutor is injected, for "can this Program be deleted right now?". Do
        // not re-implement the eligibility rule here in C# -- the rule lives in
        // GetProgramDeletionEligibility.sql; this only runs it and maps the result.
        //
        // POLICY (see the script's own header for the full rationale): Blocked when the program
        // is Approved, has progressed past its first stage, sits at a stage other than BP or RBP
        // (2026-10-29: permanent deletes happen only there), or (2026-10-16, NO CASCADE) still has
        // a live project -- its projects must be deleted first, by a user allowed to (Batch
        // Delete, or the Lump Sum module). There is no soft-delete at the program level.
        public class ProgramDeletionEligibilityResult
        {
            public string ProgramFK { get; set; } = string.Empty;
            public int StageCount { get; set; }
            /// <summary>The program's current status code (1 = Approved, 3 = Working), resolved as vProgramLatest resolves the badge.</summary>
            public int? CurrentStatus { get; set; }
            /// <summary>Projects Batch Delete can still act on (a live revision at the program's current
            /// stage). Any refuses the delete. Counted only when the program is neither Approved nor progressed.</summary>
            public int LiveProjects { get; set; }
            /// <summary>Leftovers of deleted projects that Delete Program could never remove; any refuses
            /// the delete ('an administrator must clean them up'). Counted only when there is no live project.</summary>
            public int StuckLeftovers { get; set; }
            /// <summary>One of the stuck leftovers, for the message.</summary>
            public string? StuckExample { get; set; }
            /// <summary>Which rule refused: "Approved", "Progressed", "NotBP" (its one stage is not BP or RBP,
            /// 2026-10-29), "LiveProjects" or "StuckLeftovers"; null when Eligible.</summary>
            public string? BlockedBy { get; set; }
            public string Eligibility { get; set; } = string.Empty;
            /// <summary>Why it is Blocked, in the user's words; empty when Eligible.</summary>
            public string Reason { get; set; } = string.Empty;

            /// <summary>The refusal a user sees: the reason, plus where to go when it is projects.</summary>
            public string RefusalMessage => BlockedBy == "LiveProjects"
                ? $"This program cannot be deleted: {Reason}. Delete them first (Batch Delete in Program Details; Lump Sum projects from the Lump Sum module)."
                : $"This program cannot be deleted: {Reason}.";
        }

        private const string GetProgramDeletionEligibilityScript = "Functions/GetProgramDeletionEligibility.sql";
        private const string ExecuteProgramDeletionScript = "Stored Procedures/ExecuteProgramDeletion.sql";
        private const int DeletionCommandTimeoutSeconds = 120;

        private static object EligibilityParameters(IEnumerable<string> programFKs) =>
            new { ProgramFKs = System.Text.Json.JsonSerializer.Serialize(programFKs.Distinct().ToArray()) };

        /// <summary>
        /// Runs Functions/GetProgramDeletionEligibility.sql for one program. Returns null when
        /// the program does not exist (the script returns zero rows in that case -- mirrors
        /// GetProjectDeletionTier.sql's own contract) -- it does NOT fall back to a false
        /// 'Eligible' result, so callers must check for null. Read-only.
        /// </summary>
        public static async Task<ProgramDeletionEligibilityResult?> DetermineProgramDeletionEligibilityAsync(
            this ISqlExecutor sql, string programFK, CancellationToken cancellationToken = default)
            => (await sql.DetermineProgramDeletionEligibilitiesAsync(new[] { programFK }, cancellationToken))
                .Values.FirstOrDefault();

        /// <summary>
        /// The same rule for many programs in ONE query (a Program list page), keyed by ProgramPK.
        /// A ProgramPK that does not exist has no entry. Read-only.
        /// </summary>
        public static async Task<Dictionary<string, ProgramDeletionEligibilityResult>> DetermineProgramDeletionEligibilitiesAsync(
            this ISqlExecutor sql, IEnumerable<string> programFKs, CancellationToken cancellationToken = default)
        {
            var keys = programFKs.Where(x => !string.IsNullOrEmpty(x)).ToList();
            if (keys.Count == 0)
            {
                return new Dictionary<string, ProgramDeletionEligibilityResult>(StringComparer.OrdinalIgnoreCase);
            }
            var rows = await sql.ExecuteScriptFileInTransactionAsync<ProgramDeletionEligibilityResult>(
                GetProgramDeletionEligibilityScript, EligibilityParameters(keys), ct: cancellationToken);
            return rows.ToDictionary(x => x.ProgramFK, StringComparer.OrdinalIgnoreCase);
        }

        /*  ONE application lock per program, taken EXCLUSIVELY and FIRST by every delete path --
            Delete Program, Batch Delete, Batch Restore, DeleteLumpSum, DeleteItemizedProject -- before
            any row lock (2026-10-16). Deletes in one program therefore queue, one at a time, instead of
            meeting on row locks: Delete Program locks program rows then project rows while a project
            delete goes project rows then program rows, and two project deletes on adjacent ids meet on
            HOLDLOCK key-range locks (one holds the next key of the other's stage row while waiting for
            tProgramRevisions) -- both deadlocked when the project deletes took this lock Shared. They
            gained no parallelism from Shared anyway: each takes UPDLOCK on the program's
            tProgramRevisions / tProgramStages rows. Deletes in OTHER programs are unaffected.
            Transaction-owned: released at commit or rollback. Writers outside the delete feature (a
            project save, an approval) do not take it; a deadlock with one of those is answered 409
            "try again" (IsDeadlock). */
        public const string ProgramDeletionLockPrefix = "MYPS_ProgramDelete:";
        private const int ProgramDeletionLockTimeoutMs = 30000;

        /// <summary>Takes the per-program delete lock on <paramref name="transaction"/>. Throws
        /// <see cref="ProjectHelper.DeletionRefusedException"/> when it cannot be had in time.</summary>
        public static async Task AcquireProgramDeletionLockAsync(
            this IDbConnection connection, IDbTransaction transaction, string programFK,
            CancellationToken cancellationToken = default, int timeoutMs = ProgramDeletionLockTimeoutMs)
        {
            int result = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
                "DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @Resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = @Timeout; SELECT @r;",
                new { Resource = ProgramDeletionLockPrefix + programFK, Timeout = timeoutMs },
                transaction, DeletionCommandTimeoutSeconds, cancellationToken: cancellationToken));
            if (result == -3)
            {
                throw new ProgramDeletionConflictException(); // chosen as deadlock victim while waiting: a retry
            }
            if (result < 0)
            {
                throw new ProjectHelper.DeletionRefusedException(result == -1
                    ? "Another delete in this program is in progress. Try again in a moment."
                    : $"The program could not be locked for deletion (sp_getapplock returned {result}). Try again in a moment.");
            }
        }

        /// <summary>The request lost a race for the program's delete lock (sp_getapplock -3, a deadlock
        /// victim). Like SQL error 1205 it is answered "try again".</summary>
        public sealed class ProgramDeletionConflictException : Exception
        {
            public ProgramDeletionConflictException() : base("Chosen as deadlock victim while waiting for the program's delete lock.") { }
        }

        /// <summary>EF form of <see cref="AcquireProgramDeletionLockAsync(IDbConnection, IDbTransaction, string, CancellationToken, int)"/>,
        /// on the transaction <paramref name="db"/> has open (required).</summary>
        public static async Task AcquireProgramDeletionLockAsync(
            this MYPSDbContext db, string programFK, CancellationToken cancellationToken = default)
        {
            var efTx = db.Database.CurrentTransaction?.GetDbTransaction()
                ?? throw new InvalidOperationException("AcquireProgramDeletionLockAsync requires an open EF transaction.");
            await efTx.Connection!.AcquireProgramDeletionLockAsync(efTx, programFK, cancellationToken);
        }

        /// <summary>True for SQL Server's deadlock-victim error (1205): the request lost a race with
        /// another change to the same rows and can simply be tried again.</summary>
        public static bool IsDeadlock(Exception ex) =>
            ex is ProgramDeletionConflictException
            || ex is Microsoft.Data.SqlClient.SqlException sqlEx && sqlEx.Number == 1205
            || ex.InnerException is Microsoft.Data.SqlClient.SqlException inner && inner.Number == 1205;

        /// <summary>
        /// Deletes one Program, in ONE ISqlExecutor-managed transaction
        /// (<see cref="DeleteProgramInTransactionAsync"/>). NO CASCADE (2026-10-16): a program that
        /// still has a live project is refused -- its projects are deleted first, by a user allowed
        /// to. What is removed with the program is only what users already deleted (soft-deleted
        /// projects' leftover rows, within this program). Any exception rolls everything back.
        ///
        /// Throws <see cref="ProjectHelper.DeletionRefusedException"/> when the program is not
        /// found, is Approved, has progressed beyond its initial stage, still has live projects,
        /// or has a leftover that cannot be removed -- callers translate this straight to a
        /// user-facing refusal. Returns the leftover projects that were removed, for audit logging.
        /// </summary>
        public static Task<IEnumerable<string>> ExecuteProgramDeletionAsync(
            this ISqlExecutor sql, string programFK, string userId, DateTime currentDate,
            CancellationToken cancellationToken = default)
            => sql.ExecuteTransactionAsync(
                (connection, transaction) => sql.DeleteProgramInTransactionAsync(
                    programFK, userId, currentDate, connection, transaction, cancellationToken),
                ct: cancellationToken);

        /*  Step 1 of Delete Program's row locks: the PROGRAM's own rows -- what the Approved and
            progressed rules read (tProgramRevisions.Status, tProgramStages). Small, and enough to
            refuse an Approved or progressed program without touching its (possibly 17,000+) project
            rows. Each statement READS the columns the decision depends on, not COUNT(*): a COUNT is
            answered from the nonclustered ProgramFK index alone, which locks only those index keys,
            and an UPDATE of Status then goes straight through (reproduced on localhost UAT
            2026-10-16). HOLDLOCK makes the locks range locks, so an INSERT for this program waits too. */
        private const string LockProgramRowsSql = """
            DECLARE @Int INT, @Text NVARCHAR(400);
            SELECT @Text = MAX(ProgramPK) FROM dbo.tPrograms WITH (UPDLOCK, HOLDLOCK) WHERE ProgramPK = @ProgramFK;
            SELECT @Int = MAX(Status) FROM dbo.tProgramRevisions WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Int = MAX(RevisionId + StageId) FROM dbo.tProgramStages WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            """;

        /*  Step 2, only once the program itself may be deleted: its PROJECT rows -- by then only
            leftovers of deleted projects, so few. Covers a restore (tProjectRevisions.IsDeleted), a new
            project or stage row (inserts, held off by HOLDLOCK), a publish (tProjects.IsPublished), and
            the project rows of projects carried in from another program (FORCESEEK on ProjectPK: one
            seek per project, never a serializable scan of the whole table). All six tables are indexed on
            ProgramFK / ProgramPK / ProjectPK (RELEASE_DELETE_POLICY.md step 2 checks the program ones). */
        private const string LockProgramProjectRowsSql = """
            DECLARE @Int INT, @Text NVARCHAR(400);
            SELECT @Int = MAX(CAST(IsDeleted AS INT)) FROM dbo.tProjectRevisions WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Int = MAX(RevisionId + StageId) FROM dbo.tProjectStages WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Int = MAX(CAST(IsPublished AS INT) + CAST(IsRevised AS INT)), @Text = MAX(CONCAT(ProjectType, ParentProjectId))
              FROM dbo.tProjects WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Int = MAX(CAST(p.IsPublished AS INT) + CAST(p.IsRevised AS INT)), @Text = MAX(CONCAT(p.ProjectType, p.ParentProjectId))
              FROM (SELECT r.ProjectFK FROM dbo.tProjectRevisions r WHERE r.ProgramFK = @ProgramFK
                    UNION
                    SELECT s.ProjectFK FROM dbo.tProjectStages s WHERE s.ProgramFK = @ProgramFK) linked
              JOIN dbo.tProjects p WITH (UPDLOCK, HOLDLOCK, FORCESEEK) ON p.ProjectPK = linked.ProjectFK;
            """;

        /*  The program's leftovers: every project linked to it -- created under it (tProjects.ProgramFK),
            or with history under it while belonging to another program -- with NO live revision under
            it. Read only after eligibility (re-checked under the project-row lock) found no live and no
            stuck project, so this filter should change nothing; it is the last guard that Delete
            Program never removes a project a user did not delete. */
        private const string ProgramLeftoversSql = """
            SELECT linked.ProjectFK
            FROM (
                SELECT ProjectPK AS ProjectFK FROM dbo.tProjects WHERE ProgramFK = @ProgramFK
                UNION
                SELECT ProjectFK FROM dbo.tProjectRevisions WHERE ProgramFK = @ProgramFK
                UNION
                SELECT ProjectFK FROM dbo.tProjectStages WHERE ProgramFK = @ProgramFK
            ) linked
            WHERE NOT EXISTS (SELECT 1 FROM dbo.tProjectRevisions r
                              WHERE r.ProjectFK = linked.ProjectFK AND r.ProgramFK = @ProgramFK AND r.IsDeleted = 0);
            """;

        private static async Task<ProgramDeletionEligibilityResult> RequireEligibleAsync(
            ISqlExecutor sql, string programFK, IDbTransaction transaction, CancellationToken cancellationToken)
        {
            var eligibility = (await sql.ExecuteScriptFileInTransactionAsync<ProgramDeletionEligibilityResult>(
                GetProgramDeletionEligibilityScript, EligibilityParameters(new[] { programFK }), transaction, ct: cancellationToken))
                .FirstOrDefault()
                ?? throw new ProjectHelper.DeletionRefusedException("The program was not found.");
            if (eligibility.Eligibility == "Blocked")
            {
                throw new ProjectHelper.DeletionRefusedException(eligibility.RefusalMessage);
            }
            return eligibility;
        }

        /// <summary>
        /// The transactional body of <see cref="ExecuteProgramDeletionAsync"/>, on a transaction the
        /// caller owns and rolls back on any exception (<see cref="ISqlExecutor.ExecuteTransactionAsync{T}"/>
        /// does). In order:
        ///   the per-program delete lock, then the program's own rows;
        ///   PASS 1   Functions/GetProgramDeletionEligibility.sql -- refuses an Approved or progressed
        ///            program, one that still has a live project (no cascade), or one whose leftovers
        ///            could never be removed -- without having locked a single project row;
        ///   only then the program's project rows, and PASS 1 again on that locked state (a project
        ///   added or restored in between refuses here);
        ///   PASS 2   every leftover's tier in ONE call of Functions/GetProjectDeletionTier.sql, on
        ///            locked rows -- one refusal names every one that cannot go;
        ///   PASS 3   each leftover removed by Stored Procedures/ExecuteProjectDeletion.sql, within THIS
        ///            program only (a project keeps its history in other programs);
        ///   PASS 3.5 nothing of any project may be left under the program;
        ///   PASS 4   the program's own rows.
        /// Public so the database tests can run it after changing the data, without racing.
        /// </summary>
        public static async Task<IEnumerable<string>> DeleteProgramInTransactionAsync(
            this ISqlExecutor sql, string programFK, string userId, DateTime currentDate,
            IDbConnection connection, IDbTransaction transaction, CancellationToken cancellationToken = default)
        {
            await connection.AcquireProgramDeletionLockAsync(transaction, programFK, cancellationToken);
            await connection.ExecuteAsync(new CommandDefinition(
                LockProgramRowsSql, new { ProgramFK = programFK }, transaction,
                DeletionCommandTimeoutSeconds, cancellationToken: cancellationToken));

            // PASS 1 -- the program, on its locked rows; project rows not touched yet.
            await RequireEligibleAsync(sql, programFK, transaction, cancellationToken);

            await connection.ExecuteAsync(new CommandDefinition(
                LockProgramProjectRowsSql, new { ProgramFK = programFK }, transaction,
                DeletionCommandTimeoutSeconds, cancellationToken: cancellationToken));
            await RequireEligibleAsync(sql, programFK, transaction, cancellationToken);

            // PASS 2 -- the leftovers, judged by the single project rule in one call.
            var leftoverProjectFKs = (await connection.QueryAsync<string>(new CommandDefinition(
                ProgramLeftoversSql, new { ProgramFK = programFK }, transaction,
                DeletionCommandTimeoutSeconds, cancellationToken: cancellationToken))).ToList();

            var decided = new List<ProjectHelper.ProjectDeletionTierResult>();
            var blocked = new List<string>();
            if (leftoverProjectFKs.Count > 0)
            {
                var tierRows = (await sql.ExecuteScriptFileInTransactionAsync<ProjectHelper.ProjectDeletionTierResult>(
                    ProjectHelper.GetProjectDeletionTierScript,
                    ProjectHelper.TierParameters(leftoverProjectFKs, programFK),
                    transaction, ct: cancellationToken)).ToList();
                foreach (var projectFK in leftoverProjectFKs)
                {
                    var row = tierRows.FirstOrDefault(x => x.Ref == projectFK && x.ProjectFK == projectFK);
                    if (row == null)
                    {
                        blocked.Add($"{projectFK} (could not be evaluated for deletion)");
                    }
                    else if (row.Tier != ProjectHelper.ProjectDeletionTiers.Hard)
                    {
                        blocked.Add($"{projectFK} ({row.Reason})");
                    }
                    else
                    {
                        decided.Add(row);
                    }
                }
            }
            if (blocked.Count > 0)
            {
                throw new ProjectHelper.DeletionRefusedException(
                    $"This program cannot be deleted because some of its deleted projects cannot be removed: {string.Join(", ", blocked)}");
            }

            // PASS 3 -- remove each leftover, within this program only; decided on rows still locked.
            foreach (var tier in decided)
            {
                await sql.DeleteDecidedProjectAsync(tier, programFK, userId, currentDate, transaction, cancellationToken);
            }

            // PASS 3.5 -- postcondition: nothing of any project may be left under this program
            // (the multi-year guard in ExecuteProjectDeletion.sql keeps a tProjects row that another
            // program still has history for, and that row would point at a deleted program).
            // Anything left refuses the delete; everything above rolls back.
            var survivorCount = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                SELECT (SELECT COUNT(*) FROM dbo.tProjects WHERE ProgramFK = @ProgramFK)
                     + (SELECT COUNT(*) FROM dbo.tProjectRevisions WHERE ProgramFK = @ProgramFK)
                     + (SELECT COUNT(*) FROM dbo.tProjectStages WHERE ProgramFK = @ProgramFK);
                """,
                new { ProgramFK = programFK }, transaction, DeletionCommandTimeoutSeconds, cancellationToken: cancellationToken));
            if (survivorCount > 0)
            {
                throw new ProjectHelper.DeletionRefusedException(
                    "This program cannot be deleted: some of its projects still have history in another program.");
            }

            // PASS 4 -- the program's own rows.
            await sql.ExecuteScriptFileNonQueryInTransactionAsync(
                ExecuteProgramDeletionScript,
                new
                {
                    ProgramFK = programFK,
                    UserId = userId,
                    CurrentDate = currentDate,
                    ProjectsDeleted = decided.Count
                },
                transaction, ct: cancellationToken);

            return decided.Select(x => x.ProjectFK).ToList();
        }
        #endregion
    }
}
