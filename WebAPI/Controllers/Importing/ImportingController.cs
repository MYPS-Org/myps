//using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Eaf.BackgroundJobs;
using Hangfire;
using Hangfire.Models;
using Hangfire.Services;
using Hangfire.Importing;
using Helpers;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using ReportGeneration;
using Syncfusion.XlsIO;
using System.Data.SqlClient;
using System.IO.Compression;
using System.Linq;
using System.Net.Mime;
using System.Reflection;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using WebAPI.Controllers.Projects;
using static System.Net.WebRequestMethods;
using static System.Runtime.InteropServices.JavaScript.JSType;
//using static WebAPI.Controllers.Importing.ImportingHelper;
namespace WebAPI.Controllers.Importing
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ImportingController : CoreController
    {
        private readonly IWebHostEnvironment _env;
        private readonly IBackgroundJobClient _backgroundJobs;
        public ImportingController(MYPSDbContext db, PCMADbContext pcma, IWebHostEnvironment env, IBackgroundJobClient backgroundJobs) : base(db, pcma)
        //public ImportingController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma, IWebHostEnvironment env, IBackgroundJobClient backgroundJobs) : base(db, producer, pcma)
        {
            _env = env;
            _backgroundJobs = backgroundJobs;
        }

        [AllowAnonymous]
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ImportProject([FromForm] ImportProgramDetailsWithFile programDetails, CancellationToken cancellationToken)
        {
            try
            {
                string User = _Session.UserId;

                var rows = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                    UPDATE dbo.tImportingStatus
                    SET IsActive        = 1,
                        LastUserIdInUse = {User},
                        LastUsedDate    = {Functions.CurrentDate()}
                    WHERE ImportFunctionName = 'ImportProject'
                      AND IsActive = 0;", cancellationToken);

                if (rows == 0)
                {
                    var holder = await _db.tImportingStatus
                        .AsNoTracking()
                        .Where(x => x.ImportFunctionName == "ImportProject" && x.IsActive)
                        .Select(x => x.LastUserIdInUse)
                        .FirstOrDefaultAsync(cancellationToken);

                    return new BadRequestObjectResult(new
                    {
                        Title = "Import In Progress",
                        Message = $"Import is currently in use by {holder}. Please try again later."
                    });
                }

                //to commit
                // ── Save the uploaded blob to disk BEFORE enqueueing ───────────
                var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Upload");
                Directory.CreateDirectory(tempFolder);

                var safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(programDetails.File.FileName)}";
                var savedPath = Path.Combine(tempFolder, safeFileName);

                using (var stream = new FileStream(savedPath, FileMode.Create))
                {
                    await programDetails.File.CopyToAsync(stream, cancellationToken);
                }

                // ── Create job payload ─────────────────────────────────────────
                var payload = new ImportProjectJobPayload
                {
                    FileUrl = savedPath,
                    ProgramId = programDetails.ProgramId,
                    StageName = programDetails.StageName,
                    RequestedBy = _Session.UserId
                };

                // ── Save initial job record ────────────────────────────────────
                var jobRecord = new ImportJobResult
                {
                    JobId = payload.JobId,
                    Status = "Queued",
                    Message = "Job queued and waiting to be processed.",
                    RequestedBy = payload.RequestedBy,
                    QueuedAt = Functions.CurrentDate()
                };
                _db.tImportJobResult.Add(jobRecord);
                await _db.SaveChangesAsync(cancellationToken);

                // ── Enqueue Hangfire job ───────────────────────────────────────
                var hangfireJobId = _backgroundJobs.Enqueue<ImportProjectJobService>(
                    x => x.ProcessImport(payload, JobCancellationToken.Null));

                // ── Store Hangfire job ID for tracking ─────────────────────────
                jobRecord.HangfireJobId = hangfireJobId;
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync(cancellationToken);

                return Ok(new
                {
                    JobId = payload.JobId,
                    HangfireJobId = hangfireJobId,
                    Message = "Import job queued.",
                    Title = "Import Queued"
                });
            }
            catch (OperationCanceledException)
            {
                try
                {
                    var lockRecord = await _db.tImportingStatus
                        .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");

                    if (lockRecord != null && lockRecord.LastUserIdInUse == _Session.UserId)
                    {
                        lockRecord.IsActive = false;
                        _db.tImportingStatus.Update(lockRecord);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception lockEx) { }

                return StatusCode(499, new { Message = "Request cancelled by client.", Title = "Cancelled." });
            }
            catch (Exception ex)
            {
                try
                {
                    var lockRecord = await _db.tImportingStatus
                        .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
                    if (lockRecord != null && lockRecord.LastUserIdInUse == _Session.UserId)
                    {
                        lockRecord.IsActive = false;
                        _db.tImportingStatus.Update(lockRecord);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception lockEx) { }

                return _exceptionHandler.Handle(ex, programDetails, _Session.UserId.ToString());
            }
        }

        [AllowAnonymous]
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateProject([FromForm] ImportProgramDetailsWithFile programDetails, CancellationToken cancellationToken)
        {
            try
            {
                string User = _Session.UserId;

                var rows = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                    UPDATE dbo.tImportingStatus
                    SET IsActive        = 1,
                        LastUserIdInUse = {User},
                        LastUsedDate    = {Functions.CurrentDate()}
                    WHERE ImportFunctionName = 'ImportProject'
                      AND IsActive = 0;", cancellationToken);

                if (rows == 0)
                {
                    var holder = await _db.tImportingStatus
                        .AsNoTracking()
                        .Where(x => x.ImportFunctionName == "ImportProject" && x.IsActive)
                        .Select(x => x.LastUserIdInUse)
                        .FirstOrDefaultAsync(cancellationToken);

                    return new BadRequestObjectResult(new
                    {
                        Title = "Import In Progress",
                        Message = $"Import is currently in use by {holder}. Please try again later."
                    });
                }

                // ── Save the uploaded blob to disk BEFORE enqueueing ───────────
                var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Upload");
                Directory.CreateDirectory(tempFolder);

                var safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(programDetails.File.FileName)}";
                var savedPath = Path.Combine(tempFolder, safeFileName);

                using (var stream = new FileStream(savedPath, FileMode.Create))
                {
                    await programDetails.File.CopyToAsync(stream, cancellationToken);
                }

                // ── Create job payload ─────────────────────────────────────────
                var payload = new ImportProjectJobPayload
                {
                    FileUrl = savedPath,
                    ProgramId = programDetails.ProgramId,
                    StageName = programDetails.StageName,
                    RequestedBy = _Session.UserId
                };

                // ── Save initial job record ────────────────────────────────────
                var jobRecord = new ImportJobResult
                {
                    JobId = payload.JobId,
                    Status = "Queued",
                    Message = "Job queued and waiting to be processed.",
                    RequestedBy = payload.RequestedBy,
                    QueuedAt = Functions.CurrentDate()
                };
                _db.tImportJobResult.Add(jobRecord);
                await _db.SaveChangesAsync(cancellationToken);

                // ── Enqueue Hangfire job ───────────────────────────────────────
                var hangfireJobId = _backgroundJobs.Enqueue<ImportProjectJobService>(
                    x => x.ProcessUpdate(payload, JobCancellationToken.Null));

                // ── Store Hangfire job ID for tracking ─────────────────────────
                jobRecord.HangfireJobId = hangfireJobId;
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync(cancellationToken);

                return Ok(new
                {
                    JobId = payload.JobId,
                    HangfireJobId = hangfireJobId,
                    Message = "Update job queued.",
                    Title = "Update Queued"
                });
            }
            catch (OperationCanceledException)
            {
                try
                {
                    var lockRecord = await _db.tImportingStatus
                        .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");

                    if (lockRecord != null && lockRecord.LastUserIdInUse == _Session.UserId)
                    {
                        lockRecord.IsActive = false;
                        _db.tImportingStatus.Update(lockRecord);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception lockEx) { }

                return StatusCode(499, new { Message = "Request cancelled by client.", Title = "Cancelled." });
            }
            catch (Exception ex)
            {
                try
                {
                    var lockRecord = await _db.tImportingStatus
                        .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
                    if (lockRecord != null && lockRecord.LastUserIdInUse == _Session.UserId)
                    {
                        lockRecord.IsActive = false;
                        _db.tImportingStatus.Update(lockRecord);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception lockEx) { }

                return _exceptionHandler.Handle(ex, programDetails, _Session.UserId.ToString());
            }
        }


        // ── Poll endpoint ──────────────────────────────────────────────────────────
        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> GetImportStatus([FromQuery] string jobId, CancellationToken cancellationToken)
        {
            var job = await _db.tImportJobResult.AsNoTracking()
                .FirstOrDefaultAsync(x => x.JobId == jobId, cancellationToken);

            if (job == null)
                return new BadRequestObjectResult(new { Message = "Job not found.", Title = "Error." });

            return Ok(new
            {
                job.JobId,
                job.HangfireJobId,
                job.Status,
                job.Message,
                job.ValidCount,
                job.WarningCount,
                job.ErrorCount,
                job.QueuedAt,
                job.StartedAt,
                job.CompletedAt,
                TextFileUrl = job.TextFileName != null ? $"{Request.Scheme}://{Request.Host}/api/Importing/DownloadImportFile?fileName={job.TextFileName}" : null,
                ExcelFileUrl = job.ExcelFileName != null ? $"{Request.Scheme}://{Request.Host}/api/Importing/DownloadImportFile?fileName={job.ExcelFileName}" : null,
            });
        }

        // ── Download endpoint ──────────────────────────────────────────────────────
        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> DownloadImportFile([FromQuery] string fileName, CancellationToken cancellationToken)
        {
            var safeName = Path.GetFileName(fileName);
            //var tempFolder = Path.Combine(_env.WebRootPath, "temp", "imports");
            var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
            var filePath = Path.Combine(tempFolder, safeName);

            if (!System.IO.File.Exists(filePath))
                return new BadRequestObjectResult(new { Message = "File not found.", Title = "File Error." });

            var contentType = safeName.EndsWith(".xlsm")
                ? "application/vnd.ms-excel.sheet.macroEnabled.12"
                : safeName.EndsWith(".xlsx")
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : "text/plain";

            var bytes = await System.IO.File.ReadAllBytesAsync(filePath, cancellationToken);
            // Retained on disk (not deleted after download) so it can be re-downloaded later.
            return File(bytes, contentType, safeName);
        }

        // ── Export existing projects into the same template ────────────────────────
        // Same builder and template as Download Template / the error report, but pre-filled with
        // every project currently under this Program+Stage (via ExportProjectsHelper — the reverse
        // direction of SaveProjectDetails/SaveComponentCost/etc.), so the file can be reviewed and
        // re-uploaded via Update Project as-is. Runs as a Hangfire background job
        // (ImportProjectJobService.ProcessExport) with SignalR progress (ImportHub, same
        // "import-{jobId}" group Import/Update use) and is polled/downloaded via the same
        // GetImportStatus/DownloadImportFile endpoints — large Program+Stage exports no longer tie
        // up the request thread. Program/Stage validity is checked synchronously here first so an
        // unfixable request fails fast with a 400 instead of queueing a job that can only fail.
        // Deliberately does NOT take tImportingStatus's system-wide lock (confirmed with the user):
        // Export is read-only, so it must never block, or be blocked by, an in-progress Import/
        // Update or another concurrent Export. [AllowAnonymous] matches every other action in this
        // controller (ImportProject, UpdateProject, DownloadTemplate).
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ExportProjects([FromBody] ExportProjectsDTO dto, CancellationToken cancellationToken)
        {
            var IsValidProgram = await _db.IsValidProgramId(dto.ProgramId, dto.StageName);
            if (!IsValidProgram.IsValid)
            {
                return new BadRequestObjectResult(new
                {
                    Title = "Invalid Program or Stage",
                    Message = IsValidProgram.Message
                });
            }

            var stageName = dto.StageName.Replace("-", "");
            if (!Enum.TryParse<EnumProgramStage>(stageName, true, out _))
            {
                return new BadRequestObjectResult(new
                {
                    Message = $"Invalid program stage '{dto.StageName}'.",
                    Title = "Invalid Program Stage"
                });
            }

            var payload = new ExportProjectsJobPayload
            {
                ProgramId = dto.ProgramId,
                StageName = dto.StageName,
                RequestedBy = _Session.UserId
            };

            var jobRecord = new ImportJobResult
            {
                JobId = payload.JobId,
                Status = "Queued",
                Message = "Job queued and waiting to be processed.",
                RequestedBy = payload.RequestedBy,
                QueuedAt = Functions.CurrentDate()
            };
            _db.tImportJobResult.Add(jobRecord);
            await _db.SaveChangesAsync(cancellationToken);

            var hangfireJobId = _backgroundJobs.Enqueue<ImportProjectJobService>(
                x => x.ProcessExport(payload, JobCancellationToken.Null));

            jobRecord.HangfireJobId = hangfireJobId;
            _db.tImportJobResult.Update(jobRecord);
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                JobId = payload.JobId,
                HangfireJobId = hangfireJobId,
                Message = "Export job queued.",
                Title = "Export Queued"
            });
        }

        // ── Blank starter template ───────────────────────────────────────────────
        // Same builder as the error report, called with zero rows on every sheet — headers,
        // live DB-sourced dropdowns, and every macro (cascading dropdowns, auto-fill,
        // pre-save mandatory-field gate) are identical to what a generated error report gets,
        // just with nothing pre-filled. Runs inline (no Hangfire) since there's no uploaded
        // file to parse/validate here — just ~20 small lookup-table reads, so this completes
        // in well under a second.
        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> DownloadTemplate(CancellationToken cancellationToken)
        {
            var cache = await ImportLookupCache.LoadAsync(_db);

            // No Program context available here (anonymous, generic template downloaded before
            // any Program is chosen) — falls back to today's calendar year for the Category/Thrust
            // window filters, same as before this became Program-aware for the error-report path.
            var bytes = ImportErrorWorkbookBuilder.Build(
                cache,
                new List<ImportProjectDetailsExcel>(),
                new List<ImportFundingProfileExcel>(),
                new List<ImportComponentDetailsExcel>(),
                new List<ImportMajorItemsOfWorkExcel>(),
                Functions.CurrentDate().Year);

            return File(bytes, "application/vnd.ms-excel.sheet.macroEnabled.12", "ImportProjectTemplate.xlsm");
        }
    }
}