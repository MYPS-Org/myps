using DBHelper.Data;
using DBHelper.Models.Table;
using Hangfire;
using Hangfire.Hubs;
using Hangfire.Models;
using Hangfire.Services;
using Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace WebAPI.Controllers.CrystalReport
{
    [ApiController]
    [Route("api/reports")]
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

        // ── Queue report generation and return JobId immediately ───────────
        [HttpGet("{reportName}")]
        public async Task<IActionResult> Get(
            string reportName,
            [FromQuery] Dictionary<string, string> query,
            CancellationToken ct)
        {
            string User = _Session.UserId;

            var queryString = string.Join("&",
                query.Select(kv =>
                    $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

            var payload = new ReportJobPayload
            {
                ReportName = reportName,
                QueryString = queryString,
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

        // ── Download the generated PDF and delete it from temp ─────────────
        [HttpGet("download")]
        public async Task<IActionResult> Download(
            [FromQuery] string fileName,
            CancellationToken ct)
        {
            var safeName = Path.GetFileName(fileName);
            var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Reports");
            var filePath = Path.Combine(tempFolder, safeName);

            if (!System.IO.File.Exists(filePath))
                return NotFound(new { Message = "Report file not found or already downloaded." });

            var pdfBytes = await System.IO.File.ReadAllBytesAsync(filePath, ct);
            System.IO.File.Delete(filePath); // delete after download

            return File(pdfBytes, "application/pdf", safeName);
        }

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