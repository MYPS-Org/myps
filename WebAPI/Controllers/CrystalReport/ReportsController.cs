using DBHelper.Data;
using DBHelper.Models.Table;
using Hangfire;
using Hangfire.Hubs;
using Hangfire.Models;
using Hangfire.Services;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using System.Text.Json;

namespace WebAPI.Controllers.CrystalReport
{
    // 2026-09-11 fix: this controller inherits ControllerBase, not the app's CoreController,
    // so it never got the app's own [PermissionFilter] session/authorization gate -- it had
    // no authentication requirement of any kind. [Authorize] here relies on the standard
    // ASP.NET Core cookie-auth pipeline (UseAuthentication/UseAuthorization in Program.cs),
    // which every request already carries via the session cookie once logged in.
    [ApiController]
    [Route("api/reports")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IBackgroundJobClient _backgroundJobs;
        private readonly IHubContext<ReportHub> _hub;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ReportsController> _logger;
        private readonly MYPSDbContext _db;
        public DBHelper.Models.Views.Users _Session = new DBHelper.Models.Views.Users();

        public ReportsController(
            IHttpClientFactory httpClientFactory,
            IBackgroundJobClient backgroundJobs,
            IHubContext<ReportHub> hub,
            IWebHostEnvironment env,
            ILogger<ReportsController> logger,
            MYPSDbContext db)
        {
            _httpClientFactory = httpClientFactory;
            _backgroundJobs = backgroundJobs;
            _hub = hub;
            _env = env;
            _logger = logger;
            _db = db;
        }

        [HttpGet("options")]
        public async Task<IActionResult> GetOptionsAsync(CancellationToken ct)
        {
            var programYears = await _db.vProgramLatest
                .AsNoTracking()
                .Select(p => p.StartYear)
                .Distinct()
                .OrderByDescending(y => y)
                .ToListAsync(ct);

            var programStages = await _db.tOptionProgramStage
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.StageHierarchy)
                .ThenBy(s => s.Name)
                .Select(s => new ProgramStageOptionDTO
                {
                    Id = s.Id,
                    NameId = s.NameId,
                    Name = s.Name,
                    DisplayName = s.DisplayName
                })
                .ToListAsync(ct);

            var regionalOffices = await _db.tOptionAdminAreaRegion
                .AsNoTracking()
                .Where(r => !r.Deprecated)
                .OrderBy(r => r.Name)
                .Select(r => new RegionalOfficeOptionDTO
                {
                    Id = r.ParticipantId,
                    Name = r.Name,
                    Code = r.Code
                })
                .ToListAsync(ct);

            return Ok(new ReportOptionsDTO
            {
                ReportTypes = ReportCatalog.SupportedReports,
                ProgramYears = programYears,
                ProgramStages = programStages,
                RegionalOffices = regionalOffices
            });
        }

        [HttpGet("filter-programs")]
        public async Task<IActionResult> FilterProgramsAsync(
            [FromQuery] FilterProgramsDTO query,
            CancellationToken ct)
        {
            var programs = await _db.vProgramLatest
                .AsNoTracking()
                .Where(p => p.StartYear == query.YearStart
                         && p.StageName == query.ProgramStage)
                .OrderBy(p => p.Name)
                .Select(p => new FilterProgramItemDTO
                {
                    Id = p.ProgramId,
                    Name = p.Name
                })
                .ToListAsync(ct);

            return Ok(programs);
        }

        // ── Queue report generation and return JobId immediately ───────────
        [HttpPost("{reportName}")]
        public async Task<IActionResult> QueueReportGenerationJobAsync(
            string reportName,
            [FromBody] JsonElement body,
            CancellationToken ct)
        {
            if (!ReportCatalog.IsSupported(reportName))
            {
                return BadRequest(new
                {
                    Title = "Unsupported report",
                    Message = $"'{reportName}' is not a supported report type."
                });
            }

            if (!ReportRequestMapper.TryMap(reportName, body, out var legacyParams, out var mapError))
            {
                return BadRequest(new
                {
                    Title = "Validation failed",
                    Message = mapError ?? "Invalid report request."
                });
            }

            string User = _Session.UserId;

            var payload = new ReportJobPayload
            {
                ReportName = reportName,
                QueryString = JsonSerializer.Serialize(legacyParams),
                RequestedBy = User
            };

            // ── Save initial job record ────────────────────────────────────
            var jobRecord = new ReportJobResult
            {
                JobId = payload.JobId,
                Status = "Queued",
                Message = "Job queued and waiting to be processed.",
                RequestedBy = payload.RequestedBy,
                QueuedAt = Functions.CurrentDate()
            };
            _db.tReportJobResult.Add(jobRecord);
            await _db.SaveChangesAsync(ct);


            // ── Enqueue Hangfire job ───────────────────────────────────────
            var hangfireJobId = _backgroundJobs.Enqueue<ReportJobService>(
                x => x.GenerateReport(payload, JobCancellationToken.Null));


            // ── Store Hangfire job ID for tracking ─────────────────────────
            jobRecord.HangfireJobId = hangfireJobId;
            _db.tReportJobResult.Update(jobRecord);
            await _db.SaveChangesAsync(ct);


            // ── Notify group immediately (Queued status) ───────────────────
            await _hub.Clients.Group($"report-{payload.JobId}").SendAsync(
                "ReportStatusChanged",
                new
                {
                    payload.JobId,
                    Status = "Queued",
                    Message = $"{reportName} report is queued for generation."
                }, ct);

            return Ok(new
            {
                payload.JobId,
                HangfireJobId = hangfireJobId,
                Message = "Report generation queued. You will be notified when ready.",
                Title = "Report Queued"
            });
        }

        // ── Poll endpoint: catches jobs whose SignalR broadcast was missed ──
        // A Hangfire worker can pick up and finish a job (especially the
        // direct-to-Excel reports) before the browser's dedicated hub
        // connection finishes JoinJobGroup — that broadcast lands in an empty
        // group and is gone for good, since SignalR doesn't replay missed
        // group messages. This lets the client check for a terminal status
        // it may have missed instead of waiting on a notification that
        // already fired.
        [HttpGet("status/{jobId}")]
        public async Task<IActionResult> GetJobStatusAsync(string jobId, CancellationToken ct)
        {
            var job = await _db.tReportJobResult
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.JobId == jobId, ct);

            if (job == null)
                return NotFound(new { Message = "Report job not found." });

            return Ok(new
            {
                job.JobId,
                job.Status,
                job.Message,
                DownloadUrl = job.Status == "Completed" && !string.IsNullOrEmpty(job.FileName)
                    ? $"/api/reports/download?fileName={job.FileName}"
                    : null
            });
        }

        //// ── Download the generated PDF and delete it from temp ─────────────
        [HttpGet("download")]
        public async Task<IActionResult> Download(
            [FromQuery] string fileName,
            CancellationToken ct)
        {
            var safeName = Path.GetFileName(fileName);

            // 2026-09-11 fix: previously served/deleted purely by filename, with no check that
            // the requester was the one who generated this report -- any caller who obtained or
            // guessed a fileName could download and delete another user's report (IDOR). Same
            // not-found message for "doesn't exist" and "not yours" -- don't leak which case it is.
            var job = await _db.tReportJobResult.AsNoTracking().FirstOrDefaultAsync(x => x.FileName == safeName, ct);
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (job == null || job.RequestedBy != userId)
                return NotFound(new { Message = "Report file not found or already downloaded." });

            var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Reports");
            var filePath = Path.Combine(tempFolder, safeName);

            if (!System.IO.File.Exists(filePath))
                return NotFound(new { Message = "Report file not found or already downloaded." });

            var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath, ct);
            System.IO.File.Delete(filePath); // delete after download

            var contentType = Path.GetExtension(safeName).ToLowerInvariant() switch
            {
                ".pdf" => "application/pdf",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _ => "application/octet-stream"
            };

            return File(fileBytes, contentType, safeName);
        }

        //// ── Download the generated PDF and delete it from temp ─────────────
        //[HttpGet("download")]
        //public async Task<IActionResult> Download(
        //    [FromQuery] string fileName,
        //    CancellationToken ct)
        //{
        //    var safeName = Path.GetFileName(fileName);
        //    var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Reports");
        //    var filePath = Path.Combine(tempFolder, safeName);

        //    if (!System.IO.File.Exists(filePath))
        //        return NotFound(new { Message = "Report file not found or already downloaded." });

        //    var pdfBytes = await System.IO.File.ReadAllBytesAsync(filePath, ct);
        //    System.IO.File.Delete(filePath); // delete after download

        //    return File(pdfBytes, "application/pdf", safeName);
        //}

        //// ── Optional: direct/synchronous render (no Hangfire) ─────────────
        //// Keep this for cases where the caller needs the PDF immediately
        //// e.g. small reports, server-side PDF generation without waiting
        //[HttpGet("{reportName}/sync")]
        //public async Task<IActionResult> GetSync(
        //    string reportName,
        //    [FromQuery] Dictionary<string, string> query,
        //    CancellationToken ct)
        //{
        //    var client = _httpClientFactory.CreateClient("ReportService");

        //    var queryString = string.Join("&",
        //        query.Select(kv =>
        //            $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

        //    var requestUri = $"api/reports/{reportName}"
        //                   + (queryString.Length > 0 ? $"?{queryString}" : string.Empty);

        //    var response = await client.GetAsync(requestUri,
        //        HttpCompletionOption.ResponseHeadersRead, ct);

        //    if (!response.IsSuccessStatusCode)
        //    {
        //        var problemDetail = await response.Content.ReadAsStringAsync(ct);
        //        response.Dispose();
        //        return StatusCode((int)response.StatusCode, problemDetail);
        //    }

        //    var pdfBytes = await response.Content.ReadAsByteArrayAsync(ct);
        //    response.Dispose();

        //    return File(pdfBytes, "application/pdf", $"{reportName}.pdf");
        //}
    }
}

//using CrystalReportService.Services;
//using Microsoft.AspNetCore.Mvc;

//namespace WebAPI.Controllers.CrystalReport
//{
//    [ApiController]
//    //[Route("api/[controller]/[action]")]
//    [Route("api/reports")]
//    public class ReportsController : ControllerBase
//    {
//        private readonly IHttpClientFactory _httpClientFactory;

//        public ReportsController(IHttpClientFactory httpClientFactory)
//        {
//            _httpClientFactory = httpClientFactory;
//        }

//        /// <summary>
//        /// GET api/reports/{reportName}?param1=x&amp;param2=y
//        /// Proxies to the internal .NET Framework 4.8 Crystal Reports service
//        /// (a completely separate project/deployment) and streams the
//        /// resulting PDF straight back to the caller. This controller does
//        /// NOT touch Crystal Reports itself - net8.0 can't run that engine.
//        /// </summary>
//        [HttpGet("{reportName}")]
//        public async Task<IActionResult> Get(string reportName, [FromQuery] Dictionary<string, string> query)
//        {
//            var client = _httpClientFactory.CreateClient("ReportService");

//            var queryString = string.Join("&",
//                query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

//            var requestUri = $"api/reports/{reportName}"
//                           + (queryString.Length > 0 ? $"?{queryString}" : string.Empty);

//            // ── Don't use 'using' here — let the response stay alive until
//            //    we've fully read the bytes out of it ──────────────────────
//            var response = await client.GetAsync(requestUri, HttpCompletionOption.ResponseHeadersRead);

//            if (!response.IsSuccessStatusCode)
//            {
//                var problemDetail = await response.Content.ReadAsStringAsync();

//                // Dispose manually since we're not using 'using'
//                response.Dispose();

//                return StatusCode((int)response.StatusCode, problemDetail);
//            }

//            // ── Read ALL bytes into memory before the response can be disposed ──
//            var pdfBytes = await response.Content.ReadAsByteArrayAsync();
//            response.Dispose();

//            // ── Return as a downloadable / inline PDF ──────────────────────────
//            return File(pdfBytes, "application/pdf", $"{reportName}.pdf");

//            //var client = _httpClientFactory.CreateClient("ReportService");

//            //var queryString = string.Join("&",
//            //    query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
//            //var requestUri = $"api/reports/{reportName}" + (queryString.Length > 0 ? $"?{queryString}" : string.Empty);

//            //using var response = await client.GetAsync(requestUri, HttpCompletionOption.ResponseHeadersRead);

//            //if (!response.IsSuccessStatusCode)
//            //{
//            //    var problemDetail = await response.Content.ReadAsStringAsync();
//            //    return StatusCode((int)response.StatusCode, problemDetail);
//            //}

//            //var pdfStream = await response.Content.ReadAsStreamAsync();
//            //return File(pdfStream, "application/pdf", $"{reportName}.pdf");
//        }
//    }
//}