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
    }
}
