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

        #region ProgramDeletionEligibility (Dapper / ISqlExecutor)
        // Added 2026-10-14, operator-directed deep-protocol engagement: global function,
        // usable anywhere ISqlExecutor is injected, for "can this Program be deleted right
        // now?" -- a thin wrapper around dbo.fProgramDeletionEligibility (Main/Resources/
        // Internal/SQLObjects/Functions/fProgramDeletionEligibility.sql), itself the
        // canonical decision logic. Do not re-implement the eligibility rule here in C# --
        // query the function.
        //
        // POLICY (see the SQL function's own header for the full rationale): replaces the
        // old hardcoded StagesToCheck/AllowedStages lists in ProgramController.DeleteProgram
        // (RISK-112's root cause) with one rule uniform across all 12 EnumProgramStage
        // values: StageCount(ProgramFK) <= 1 -> Eligible, else Blocked. There is no
        // soft-delete at the program level. This function does NOT check any child
        // project's IsPublished flag -- that is a separate, independent check performed by
        // dbo.pExecuteProgramDeletion's own Pass 2 (per fProjectDeletionTier), not by this
        // function or by ProgramHelper at all.
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

        /// <summary>
        /// Queries dbo.fProgramDeletionEligibility for one program. Returns null when the
        /// program does not exist -- the function returns zero rows in that case (mirrors
        /// fProjectDeletionTier's own contract), it does NOT fall back to a false
        /// 'Eligible' result, so callers must check for null.
        /// </summary>
        public static async Task<ProgramDeletionEligibilityResult?> DetermineProgramDeletionEligibilityAsync(
            this ISqlExecutor sql, string programFK, CancellationToken cancellationToken = default)
        {
            var rows = await sql.QueryAsync<ProgramDeletionEligibilityResult>(
                "SELECT * FROM dbo.fProgramDeletionEligibility(@ProgramFK)",
                new { ProgramFK = programFK },
                ct: cancellationToken);
            return rows.FirstOrDefault();
        }

        /// <summary>
        /// Executes dbo.pExecuteProgramDeletion for one program -- deletes every child
        /// project first (dbo.pExecuteProjectDeletion, looped), then the program's own
        /// tProgramStages/tProgramRevisions/tPrograms rows, all inside ONE transaction that
        /// the procedure itself opens and manages (self-atomic, per the 2026-10-14
        /// code-behavior-audit fix -- do NOT wrap this call in a caller-owned
        /// BeginTransactionAsync/EF transaction; the procedure commits or rolls back on its
        /// own). Throws SqlException (RAISERROR propagates as the exception's Message) when
        /// the program is not found, has progressed beyond its initial stage, or has a
        /// published child project -- callers must catch and translate to a user-facing
        /// refusal. Returns the list of every project that was deleted, for audit-trail
        /// logging (mirrors the existing TransactionLog pattern in ProgramController.cs).
        /// </summary>
        public static async Task<IEnumerable<string>> ExecuteProgramDeletionAsync(
            this ISqlExecutor sql, string programFK, string userId, DateTime currentDate,
            CancellationToken cancellationToken = default)
        {
            var parameters = new DynamicParameters();
            parameters.Add("@ProgramFK", programFK, DbType.String, ParameterDirection.Input);
            parameters.Add("@UserId", userId, DbType.String, ParameterDirection.Input);
            parameters.Add("@CurrentDate", currentDate, DbType.DateTime2, ParameterDirection.Input);

            // Explicit EXEC, matching the convention already used elsewhere in this codebase
            // (e.g. ProgramController.cs's "EXEC dbo.pRecomputeProjectPublishable @ProgramFK = ...").
            // No `tx` parameter is exposed here deliberately -- this call must never be
            // nested inside a caller-owned transaction (see summary above).
            try
            {
                var deletedProjectIds = await sql.QueryAsync<string>(
                    "EXEC dbo.pExecuteProgramDeletion @ProgramFK = @ProgramFK, @UserId = @UserId, @CurrentDate = @CurrentDate",
                    parameters,
                    ct: cancellationToken);
                return deletedProjectIds;
            }
            catch (Microsoft.Data.SqlClient.SqlException ex) when (ProjectHelper.DeletionRefusedException.Matches(ex))
            {
                throw ProjectHelper.DeletionRefusedException.From(ex);
            }
        }
        #endregion
    }
}
