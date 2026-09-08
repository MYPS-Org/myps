using DBHelper.Data;
using Hangfire.Models;
using Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Hangfire.Hubs;

namespace Hangfire.Services
{
    public class ReportJobService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IExcelReportGenerator _excelReportGenerator;
        private readonly IHubContext<ReportHub> _hub;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ReportJobService> _logger;
        private readonly MYPSDbContext _db;
        private readonly IMYPSExceptionHandler _exceptionHandler;

        public ReportJobService(
            IHttpClientFactory httpClientFactory,
            IExcelReportGenerator excelReportGenerator,
            IHubContext<ReportHub> hub,
            IWebHostEnvironment env,
            ILogger<ReportJobService> logger,
            MYPSDbContext db,
            IMYPSExceptionHandler exceptionHandler)
        {
            _httpClientFactory = httpClientFactory;
            _excelReportGenerator = excelReportGenerator;
            _hub = hub;
            _env = env;
            _logger = logger;
            _db = db;
            _exceptionHandler = exceptionHandler;
        }

        [AutomaticRetry(Attempts = 0)]
        public async Task GenerateReport(ReportJobPayload payload, IJobCancellationToken ct)
        {
            _logger.LogInformation("Generating report {ReportName} for job {JobId}",
                payload.ReportName, payload.JobId);

            var jobRecord = await _db.tReportJobResult
                .FirstOrDefaultAsync(x => x.JobId == payload.JobId);

            if (jobRecord == null) return;

            jobRecord.Status = "Processing";
            jobRecord.StartedAt = Functions.CurrentDate();
            _db.tReportJobResult.Update(jobRecord);
            await _db.SaveChangesAsync();

            // ── Notify: started ────────────────────────────────────────────
            await NotifyClient(payload.JobId, "Processing",
                $"Generating {payload.ReportName} report...", null);

            try
            {
                ct.ThrowIfCancellationRequested();

                byte[] fileBytes;
                string fileExtension;

                var parameters = ReportParameterBag.Parse(payload.QueryString);
                var queryString = ReportParameterBag.ToQueryString(parameters);

                if (_excelReportGenerator.CanHandle(payload.ReportName))
                {
                    // Raw data extracts (wide/tall row dumps) go straight to
                    // Excel - Crystal's page-based PDF rendering truncates
                    // them. Skips the CrystalReportService HTTP round-trip
                    // entirely for these reports.
                    fileBytes = await _excelReportGenerator.GenerateAsync(
                        payload.ReportName, parameters, ct.ShutdownToken);
                    fileExtension = "xlsx";
                }
                else
                {
                    // ── Call Crystal Report Service ────────────────────────
                    var client = _httpClientFactory.CreateClient("ReportService");
                    var requestUri = $"api/reports/{payload.ReportName}"
                                   + (string.IsNullOrEmpty(queryString)
                                       ? string.Empty
                                       : $"?{queryString}");

                    var response = await client.GetAsync(requestUri,
                        HttpCompletionOption.ResponseHeadersRead, ct.ShutdownToken);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorDetail = await response.Content.ReadAsStringAsync();
                        response.Dispose();

                        jobRecord.Status = "Failed";
                        jobRecord.Message = "Failed";
                        jobRecord.CompletedAt = Functions.CurrentDate();
                        _db.tReportJobResult.Update(jobRecord);
                        await _db.SaveChangesAsync();

                        await NotifyClient(payload.JobId, "Failed", errorDetail, null);
                        return;
                    }

                    ct.ThrowIfCancellationRequested();

                    fileBytes = await response.Content.ReadAsByteArrayAsync(ct.ShutdownToken);
                    response.Dispose();
                    fileExtension = "pdf";
                }

                // ── Save file to temp folder ───────────────────────────────
                var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Reports");
                Directory.CreateDirectory(tempFolder);

                var fileName = $"{payload.ReportName}_{payload.JobId}.{fileExtension}";
                var filePath = Path.Combine(tempFolder, fileName);

                await File.WriteAllBytesAsync(filePath, fileBytes, ct.ShutdownToken);

                _logger.LogInformation("Report {ReportName} saved to {FilePath}",
                    payload.ReportName, filePath);

                // ── Update job result ──────────────────────────────────────
                jobRecord.Status = "Completed";
                jobRecord.Message = "Completed";
                jobRecord.FileName = fileName;
                jobRecord.FilePath = filePath;
                jobRecord.CompletedAt = Functions.CurrentDate();
                _db.tReportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                // ── Notify: completed with download URL ────────────────────
                await NotifyClient(payload.JobId, "Completed",
                    $"{payload.ReportName} report is ready.",
                    $"/api/reports/download?fileName={fileName}");
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Report job {JobId} was cancelled", payload.JobId);
                await NotifyClient(payload.JobId, "Cancelled", "Report generation was cancelled.", null);
            }
            catch (ArgumentException ex)
            {
                // Missing/invalid parameters - bad request, not a bug. Same
                // handling as a CrystalReportService validation failure.
                _logger.LogWarning("Report job {JobId} had invalid parameters: {Message}", payload.JobId, ex.Message);

                jobRecord.Status = "Failed";
                jobRecord.Message = ex.Message;
                jobRecord.CompletedAt = Functions.CurrentDate();
                _db.tReportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                await NotifyClient(payload.JobId, "Failed", ex.Message, null);
            }
            catch (Exception ex)
            {
                _ = _exceptionHandler.Handle(ex, payload, payload.RequestedBy);
                await NotifyClient(payload.JobId, "Failed", ex.Message, null);
                throw;
            }
        }

        // ── SignalR notification helper ────────────────────────────────────
        private async Task NotifyClient(string jobId, string status, string message, string? downloadUrl)
        {
            try
            {
                await _hub.Clients.Group($"report-{jobId}").SendAsync("ReportStatusChanged", new
                {
                    JobId = jobId,
                    Status = status,
                    Message = message,
                    DownloadUrl = downloadUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SignalR notification failed for report job {JobId}", jobId);
            }
        }
    }
}

//using DBHelper.Data;
//using Hangfire.Models;
//using Helpers;
//using Microsoft.AspNetCore.Hosting;
//using Microsoft.AspNetCore.SignalR;
//using Microsoft.EntityFrameworkCore;
//using Microsoft.Extensions.Logging;
//using System;
//using System.Collections.Generic;
//using System.Linq;
//using System.Text;
//using System.Threading.Tasks;
//using Hangfire.Hubs;

//namespace Hangfire.Services
//{
//    public class ReportJobService
//    {
//        private readonly IHttpClientFactory _httpClientFactory;
//        private readonly IHubContext<ReportHub> _hub;
//        private readonly IWebHostEnvironment _env;
//        private readonly ILogger<ReportJobService> _logger;
//        private readonly MYPSDbContext _db;

//        public ReportJobService(
//            IHttpClientFactory httpClientFactory,
//            IHubContext<ReportHub> hub,
//            IWebHostEnvironment env,
//            ILogger<ReportJobService> logger,
//            MYPSDbContext db)
//        {
//            _httpClientFactory = httpClientFactory;
//            _hub = hub;
//            _env = env;
//            _logger = logger;
//            _db = db;
//        }

//        [AutomaticRetry(Attempts = 0)]
//        public async Task GenerateReport(ReportJobPayload payload, IJobCancellationToken ct)
//        {
//            _logger.LogInformation("Generating report {ReportName} for job {JobId}",
//                payload.ReportName, payload.JobId);

//            var jobRecord = await _db.tReportJobResult
//                .FirstOrDefaultAsync(x => x.JobId == payload.JobId);

//            if (jobRecord == null) return;

//            jobRecord.Status = "Processing";
//            jobRecord.StartedAt = Functions.CurrentDate();
//            _db.tReportJobResult.Update(jobRecord);
//            await _db.SaveChangesAsync();


//            // ── Notify: started ────────────────────────────────────────────
//            await NotifyClient(payload.JobId, "Processing",
//                $"Generating {payload.ReportName} report...", null);

//            try
//            {
//                ct.ThrowIfCancellationRequested();

//                // ── Call Crystal Report Service ────────────────────────────
//                var client = _httpClientFactory.CreateClient("ReportService");
//                var requestUri = $"api/reports/{payload.ReportName}"
//                               + (string.IsNullOrEmpty(payload.QueryString)
//                                   ? string.Empty
//                                   : $"?{payload.QueryString}");

//                var response = await client.GetAsync(requestUri,
//                    HttpCompletionOption.ResponseHeadersRead, ct.ShutdownToken);

//                if (!response.IsSuccessStatusCode)
//                {
//                    var errorDetail = await response.Content.ReadAsStringAsync();
//                    response.Dispose();

//                    jobRecord.Status = "Failed";
//                    jobRecord.Message = "Failed"; //IsValidProgram.Message;
//                    jobRecord.CompletedAt = Functions.CurrentDate();
//                    _db.tReportJobResult.Update(jobRecord);
//                    await _db.SaveChangesAsync();

//                    await NotifyClient(payload.JobId, "Failed", errorDetail, null);
//                    return;
//                }

//                ct.ThrowIfCancellationRequested();

//                // ── Save PDF to temp folder ────────────────────────────────
//                var pdfBytes = await response.Content.ReadAsByteArrayAsync(ct.ShutdownToken);
//                response.Dispose();

//                var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Reports");
//                Directory.CreateDirectory(tempFolder);

//                var fileName = $"{payload.ReportName}_{payload.JobId}.pdf";
//                var filePath = Path.Combine(tempFolder, fileName);

//                await File.WriteAllBytesAsync(filePath, pdfBytes, ct.ShutdownToken);

//                _logger.LogInformation("Report {ReportName} saved to {FilePath}",
//                    payload.ReportName, filePath);

//                // ── Update job result AFTER commit ─────────────────────────
//                jobRecord.Status = "Completed";
//                jobRecord.Message = "Completed";
//                jobRecord.FileName = fileName;
//                jobRecord.FilePath = filePath;
//                jobRecord.CompletedAt = Functions.CurrentDate();
//                _db.tReportJobResult.Update(jobRecord);
//                await _db.SaveChangesAsync();

//                // ── Notify: completed with download URL ────────────────────
//                await NotifyClient(payload.JobId, "Completed",
//                    $"{payload.ReportName} report is ready.",
//                    $"/api/reports/download?fileName={fileName}");
//            }
//            catch (OperationCanceledException)
//            {
//                _logger.LogWarning("Report job {JobId} was cancelled", payload.JobId);
//                await NotifyClient(payload.JobId, "Cancelled", "Report generation was cancelled.", null);
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Report job {JobId} failed", payload.JobId);
//                await NotifyClient(payload.JobId, "Failed", ex.Message, null);
//                throw;
//            }
//        }

//        // ── SignalR notification helper ────────────────────────────────────
//        private async Task NotifyClient(string jobId, string status, string message, string downloadUrl)
//        {
//            try
//            {
//                await _hub.Clients.Group($"report-{jobId}").SendAsync("ReportStatusChanged", new
//                {
//                    JobId = jobId,
//                    Status = status,
//                    Message = message,
//                    DownloadUrl = downloadUrl
//                });
//            }
//            catch (Exception ex)
//            {
//                _logger.LogWarning(ex, "SignalR notification failed for report job {JobId}", jobId);
//            }
//        }
//    }
//}
