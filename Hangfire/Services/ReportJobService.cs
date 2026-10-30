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
using Hangfire.Importing;

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
                        var errorDetail = ReportServiceErrorText(await response.Content.ReadAsStringAsync());
                        response.Dispose();

                        await TrySaveTerminalStatusAsync(jobRecord, "Failed", errorDetail);
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

                var fileName = BuildReportFileName(payload, parameters, fileExtension, Functions.CurrentDate());
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

                await TrySaveTerminalStatusAsync(jobRecord, "Cancelled", "Report generation was cancelled.");
                await NotifyClient(payload.JobId, "Cancelled", "Report generation was cancelled.", null);
            }
            catch (ArgumentException ex)
            {
                // Missing/invalid parameters - bad request, not a bug. Same
                // handling as a CrystalReportService validation failure.
                _logger.LogWarning("Report job {JobId} had invalid parameters: {Message}", payload.JobId, ex.Message);

                await TrySaveTerminalStatusAsync(jobRecord, "Failed", ex.Message);
                await NotifyClient(payload.JobId, "Failed", ex.Message, null);
            }
            catch (Exception ex)
            {
                await TrySaveTerminalStatusAsync(jobRecord, "Failed", ex.Message);

                _ = _exceptionHandler.Handle(ex, payload, payload.RequestedBy);
                await NotifyClient(payload.JobId, "Failed", ex.Message, null);
                throw;
            }
        }

        // Same scheme as the import pipeline's files (ImportFileNaming): readable context segments,
        // then a sortable "when it ran" + short-JobId suffix -- e.g. "rbp_2024_20261024-201530-7104dcd2.pdf".
        // No program segment: several reports accept multiple programs. Reports without a
        // yearstart parameter (e.g. the extracts) simply omit the year segment.
        public static string BuildReportFileName(ReportJobPayload payload, IReadOnlyDictionary<string, string> parameters, string fileExtension, DateTime completedAt)
        {
            var safeReportName = ImportFileNaming.SanitizeForFileName(payload.ReportName);
            var yearSegment = parameters.TryGetValue("yearstart", out var year) && !string.IsNullOrWhiteSpace(year)
                ? $"_{ImportFileNaming.SanitizeForFileName(year.Trim())}"
                : string.Empty;

            return $"{safeReportName}{yearSegment}_{ImportFileNaming.BuildFileSuffix(payload.JobId, completedAt)}.{fileExtension}";
        }

        // CrystalReportService answers an error as Web API's {"Message": "..."} body. That JSON used
        // to reach the user verbatim, braces and all, in the toast and the Failed panel (seen on UAT,
        // S08-TC002-P001). The Message alone is what to show; any other body is shown as it came.
        public static string ReportServiceErrorText(string? body)
        {
            if (string.IsNullOrWhiteSpace(body)) return string.Empty;
            try
            {
                using var document = System.Text.Json.JsonDocument.Parse(body);
                if (document.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    foreach (var property in document.RootElement.EnumerateObject())
                    {
                        if (string.Equals(property.Name, "Message", StringComparison.OrdinalIgnoreCase)
                            && property.Value.ValueKind == System.Text.Json.JsonValueKind.String
                            && !string.IsNullOrWhiteSpace(property.Value.GetString()))
                        {
                            return property.Value.GetString()!;
                        }
                    }
                }
            }
            catch (System.Text.Json.JsonException)
            {
                // Not JSON (an IIS error page, plain text): shown as it came.
            }
            return body;
        }

        private static string TruncateMessage(string message)
        {
            const int maxLength = 500;
            return message.Length > maxLength ? message.Substring(0, maxLength) : message;
        }

        // Centralizes every terminal-status write (Failed via Crystal-service error/bad
        // parameters/unexpected exception, or Cancelled) behind one try/catch -- the save
        // itself can throw (transient DB issue), and letting that escape uncaught would leave
        // the job stuck at "Processing" forever with nothing ever having recorded why, exactly
        // the bug class this method exists to close off. Mirrors ImportProjectJobService's
        // same pattern for its own terminal-status writes.
        private async Task TrySaveTerminalStatusAsync(DBHelper.Models.Table.ReportJobResult jobRecord, string status, string message)
        {
            try
            {
                jobRecord.Status = status;
                jobRecord.Message = TruncateMessage(string.IsNullOrWhiteSpace(message) ? status : message);
                jobRecord.CompletedAt = Functions.CurrentDate();
                _db.tReportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();
            }
            catch (Exception saveEx)
            {
                _logger.LogError(saveEx, "Failed to save {Status} status for report job {JobId}", status, jobRecord.JobId);
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
