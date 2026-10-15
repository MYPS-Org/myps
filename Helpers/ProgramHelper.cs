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
                response.Message = $"The program with ID '{dto.ProgramId}' does not exist in the system.";
                return response;
            }
            var CheckProgramStage = await _db.fProgramStages
                .FromSqlInterpolated($"SELECT * FROM fProgramStages({GetProgramPK.ProgramFK}) WHERE StageName = {dto.StageName}")
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
            if (CheckProgramStage == null)
            {
                response.Title = "Stage Not Found";
                response.Message = $"The stage '{dto.StageName}' does not exist for the program with ID '{dto.ProgramId}'.";
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
                response.Message = $"The program with ID '{dto.ProgramId}' does not exist in the system.";
                return response;
            }
            if (dto._Session.ApplyFilter)
            {
                if (!ProgramParent.DataSecurityGroup.Contains(dto._Session.RegCode))
                {
                    response.Title = "Access Denied";
                    response.Message = $"You do not have permission to update the program with ID '{dto.ProgramId}'. Please contact your administrator.";
                    return response;
                }
            }
            response.IsValid = true;
            response.Data.Program = ProgramParent;
            var GetProgramRevision = await _db.fProgramDetails.FromSqlInterpolated($"SELECT * FROM fProgramDetails({ProgramParent.ProgramPK}, {CheckProgramStage.StageId})").AsNoTracking().FirstOrDefaultAsync(cancellationToken);
            if(GetProgramRevision == null)
            {
                response.Title = "Program Revision Not Found";
                response.Message = $"The program revision for program ID '{dto.ProgramId}' does not exist in the system.";
                return response;
            }
            var GetProgramStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == CheckProgramStage.Id, cancellationToken);
            if (GetProgramStage == null)
            {
                response.Title = "Program Stage Not Found";
                response.Message = $"The program stage for program ID '{dto.ProgramId}' does not exist in the system.";
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
        // POLICY (see the script's own header for the full rationale): replaces the
        // old hardcoded StagesToCheck/AllowedStages lists in ProgramController.DeleteProgram
        // (RISK-112's root cause) with one rule uniform across all 12 EnumProgramStage
        // values: StageCount(ProgramFK) <= 1 -> Eligible, else Blocked. There is no
        // soft-delete at the program level. This check does NOT check any child
        // project's IsPublished flag -- that is a separate, independent check performed in
        // ExecuteProgramDeletionAsync's own PASS 2 (per GetProjectDeletionTier.sql), not here.
        public class ProgramDeletionEligibilityResult
        {
            public string ProgramFK { get; set; } = string.Empty;
            public int StageCount { get; set; }
            /// <summary>The program's current status code (1 = Approved, 3 = Working), resolved as vProgramLatest resolves the badge.</summary>
            public int? CurrentStatus { get; set; }
            public string Eligibility { get; set; } = string.Empty;
            /// <summary>Why it is Blocked ("program is approved", "progressed beyond its initial stage"); empty when Eligible.</summary>
            public string Reason { get; set; } = string.Empty;
        }

        private const string GetProgramDeletionEligibilityScript = "Functions/GetProgramDeletionEligibility.sql";
        private const string ExecuteProgramDeletionScript = "Stored Procedures/ExecuteProgramDeletion.sql";

        /// <summary>
        /// Runs Functions/GetProgramDeletionEligibility.sql for one program. Returns null when
        /// the program does not exist (the script returns zero rows in that case -- mirrors
        /// GetProjectDeletionTier.sql's own contract) -- it does NOT fall back to a false
        /// 'Eligible' result, so callers must check for null. Read-only; runs on its own
        /// connection, no transaction needed.
        /// </summary>
        public static async Task<ProgramDeletionEligibilityResult?> DetermineProgramDeletionEligibilityAsync(
            this ISqlExecutor sql, string programFK, CancellationToken cancellationToken = default)
        {
            var rows = await sql.ExecuteScriptFileInTransactionAsync<ProgramDeletionEligibilityResult>(
                GetProgramDeletionEligibilityScript,
                new { ProgramFK = programFK },
                ct: cancellationToken);
            return rows.FirstOrDefault();
        }

        /// <summary>
        /// Deletes one Program and every one of its child projects, running the passes
        /// directly from the .sql files under Main/Resources/Internal/SQLObjects/ --
        /// PASS 1 (program eligibility) and PASS 2 (every child's tier) are read-only, run
        /// BEFORE any transaction opens, and refuse early with every blocking child named.
        /// Then, inside ONE ISqlExecutor-managed transaction,
        /// <see cref="DeleteProgramInTransactionAsync"/> locks the program's rows, re-decides
        /// eligibility and every child's tier on the locked state, and runs PASS 3 (hard-delete
        /// every child), PASS 3.5 (postcondition: no project may survive under this ProgramFK)
        /// and PASS 4 (the program's own rows). Any exception rolls back every child delete
        /// and the program delete together; nothing commits.
        ///
        /// Throws <see cref="ProjectHelper.DeletionRefusedException"/> when the program is not
        /// found, has progressed beyond its initial stage, or has a published/non-Hard child
        /// project -- callers translate this straight to a user-facing refusal, same contract
        /// as before. Returns the list of every project that was deleted, for audit-trail
        /// logging (mirrors the existing TransactionLog pattern in ProgramController.cs).
        /// </summary>
        public static async Task<IEnumerable<string>> ExecuteProgramDeletionAsync(
            this ISqlExecutor sql, string programFK, string userId, DateTime currentDate,
            CancellationToken cancellationToken = default)
        {
            // PASS 1 -- Program eligibility. Read-only, no transaction yet.
            var eligibility = await sql.DetermineProgramDeletionEligibilityAsync(programFK, cancellationToken);
            if (eligibility == null)
            {
                throw new ProjectHelper.DeletionRefusedException($"Program {programFK} was not found.");
            }
            if (eligibility.Eligibility == "Blocked")
            {
                throw new ProjectHelper.DeletionRefusedException($"Program {programFK} cannot be deleted: {eligibility.Reason}.");
            }

            // PASS 2 -- every child project's tier, still read-only, no transaction yet. A
            // program is hard-deleted only when EVERY child is 'Hard'. A published child
            // ('Blocked') or one that has progressed past its first stage ('Soft') refuses
            // the whole request, with zero writes to anything. Collects EVERY non-Hard child
            // before refusing (matching the former stored procedure's STRING_AGG behavior) so
            // one refusal names every blocking project at once, not just the first found.
            var childProjectFKs = await sql.QueryAsync<string>(
                "SELECT ProjectPK FROM dbo.tProjects WHERE ProgramFK = @ProgramFK",
                new { ProgramFK = programFK }, ct: cancellationToken);

            var blocked = new List<string>();
            foreach (var projectFK in childProjectFKs)
            {
                var tierRows = await sql.ExecuteScriptFileInTransactionAsync<ProjectHelper.ProjectDeletionTierResult>(
                    ProjectHelper.GetProjectDeletionTierScript,
                    new { ProjectRef = projectFK, ProgramFK = programFK },
                    ct: cancellationToken);
                var row = tierRows.FirstOrDefault(x => x.ProjectFK == projectFK);
                if (row == null)
                {
                    blocked.Add($"{projectFK} (could not be evaluated for deletion)");
                    continue;
                }
                if (row.Tier != ProjectHelper.ProjectDeletionTiers.Hard)
                {
                    blocked.Add($"{projectFK} ({row.Reason})");
                }
            }

            if (blocked.Count > 0)
            {
                throw new ProjectHelper.DeletionRefusedException(
                    $"Program {programFK} cannot be deleted because some of its projects cannot be permanently deleted: {string.Join(", ", blocked)}");
            }

            // PASS 1 and 2 above are the fast refusal that names every blocking child; they hold
            // no locks, so their answer may be stale by now. The transaction re-decides.
            return await sql.ExecuteTransactionAsync(
                (connection, transaction) => sql.DeleteProgramInTransactionAsync(
                    programFK, userId, currentDate, connection, transaction, cancellationToken),
                ct: cancellationToken);
        }

        /*  Taken first inside the delete transaction. It decides nothing: it only holds the rows
            the decision reads until commit, so nothing can change them between the re-check and
            the delete -- an approval or status change (tProgramRevisions), a stage advance
            (tProgramStages / tProjectStages), a publish or a new child (tProjects). HOLDLOCK makes
            the locks range locks, so an INSERT for this program waits too. A concurrent writer
            that already holds one of these rows makes this wait, or SQL Server picks a deadlock
            victim; either way the delete runs on facts that cannot move under it. */
        private const string LockProgramForDeletionSql = """
            DECLARE @Rows INT;
            SELECT @Rows = COUNT(*) FROM dbo.tPrograms         WITH (UPDLOCK, HOLDLOCK) WHERE ProgramPK = @ProgramFK;
            SELECT @Rows = COUNT(*) FROM dbo.tProgramRevisions WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Rows = COUNT(*) FROM dbo.tProgramStages    WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Rows = COUNT(*) FROM dbo.tProjects         WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            SELECT @Rows = COUNT(*) FROM dbo.tProjectStages    WITH (UPDLOCK, HOLDLOCK) WHERE ProgramFK = @ProgramFK;
            """;

        /// <summary>
        /// The in-transaction part of <see cref="ExecuteProgramDeletionAsync"/>: locks the program's
        /// rows, then re-decides everything on the locked state before deleting -- program
        /// eligibility (Functions/GetProgramDeletionEligibility.sql), the child list, and each
        /// child's tier, through <see cref="ProjectHelper.ExecuteProjectDeletionAsync(ISqlExecutor, string, string, string, DateTime, IDbTransaction?, CancellationToken)"/>,
        /// which re-runs Functions/GetProjectDeletionTier.sql in this transaction and refuses
        /// anything but 'Hard'. Then PASS 3.5 (no project may survive under the program) and
        /// PASS 4 (the program's own rows). Any refusal throws
        /// <see cref="ProjectHelper.DeletionRefusedException"/>; the caller's transaction must be
        /// rolled back, and <see cref="ISqlExecutor.ExecuteTransactionAsync{T}"/> does that.
        /// Public so the database tests can run it after changing a child, without racing.
        /// </summary>
        public static async Task<IEnumerable<string>> DeleteProgramInTransactionAsync(
            this ISqlExecutor sql, string programFK, string userId, DateTime currentDate,
            IDbConnection connection, IDbTransaction transaction, CancellationToken cancellationToken = default)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                LockProgramForDeletionSql, new { ProgramFK = programFK }, transaction, cancellationToken: cancellationToken));

            var eligibility = (await sql.ExecuteScriptFileInTransactionAsync<ProgramDeletionEligibilityResult>(
                GetProgramDeletionEligibilityScript, new { ProgramFK = programFK }, transaction, ct: cancellationToken))
                .FirstOrDefault();
            if (eligibility == null)
            {
                throw new ProjectHelper.DeletionRefusedException($"Program {programFK} was not found.");
            }
            if (eligibility.Eligibility == "Blocked")
            {
                throw new ProjectHelper.DeletionRefusedException($"Program {programFK} cannot be deleted: {eligibility.Reason}.");
            }

            var childProjectFKs = await connection.QueryAsync<string>(new CommandDefinition(
                "SELECT ProjectPK FROM dbo.tProjects WHERE ProgramFK = @ProgramFK",
                new { ProgramFK = programFK }, transaction, cancellationToken: cancellationToken));

            // PASS 3 -- each child's tier is re-derived here, in this transaction, and anything
            // but 'Hard' refuses the whole delete.
            var deletedProjectIds = new List<string>();
            foreach (var projectFK in childProjectFKs)
            {
                await sql.ExecuteProjectDeletionAsync(projectFK, programFK, userId, currentDate, transaction, cancellationToken);
                deletedProjectIds.Add(projectFK);
            }

            // PASS 3.5 -- postcondition: no project row may survive under this ProgramFK (the
            // multi-year guard in ExecuteProjectDeletion.sql keeps a row another program still
            // has history for). A survivor refuses the delete and everything above rolls back.
            var survivorCount = await connection.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM dbo.tProjects WHERE ProgramFK = @ProgramFK",
                    new { ProgramFK = programFK }, transaction, cancellationToken: cancellationToken));
            if (survivorCount > 0)
            {
                throw new ProjectHelper.DeletionRefusedException(
                    $"Program {programFK} cannot be deleted: {survivorCount} of its project(s) still have history in another program.");
            }

            // PASS 4 -- only reached if PASS 3.5 raised nothing.
            await sql.ExecuteScriptFileNonQueryInTransactionAsync(
                ExecuteProgramDeletionScript,
                new
                {
                    ProgramFK = programFK,
                    UserId = userId,
                    CurrentDate = currentDate,
                    ProjectsDeleted = deletedProjectIds.Count
                },
                transaction, ct: cancellationToken);

            return deletedProjectIds;
        }
        #endregion
    }
}
