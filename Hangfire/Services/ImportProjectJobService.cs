using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Hangfire.Hubs;
using Hangfire.Importing;
using Hangfire.Models;
using Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Hangfire.Services
{
    public class ImportProjectJobService
    {
        private readonly MYPSDbContext _db;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IWebHostEnvironment _env;
        private readonly IHubContext<ImportHub> _hub;
        private readonly ILogger<ImportProjectJobService> _logger;
        private readonly IMYPSExceptionHandler _exceptionHandler;

        public ImportProjectJobService(
            MYPSDbContext db,
            IServiceScopeFactory serviceScopeFactory,
            IWebHostEnvironment env,
            IHubContext<ImportHub> hub,
            ILogger<ImportProjectJobService> logger,
            IMYPSExceptionHandler exceptionHandler)
        {
            _db = db;
            _serviceScopeFactory = serviceScopeFactory;
            _env = env;
            _hub = hub;
            _logger = logger;
            _exceptionHandler = exceptionHandler;
        }

        // ── Expected header text per column, keyed by 1-based column index — mirrors the exact
        // strings ImportErrorWorkbookBuilder.cs writes to row 1 of each sheet. The Read* methods
        // below pull every field by fixed column index, not by header lookup, so a hand-edited or
        // stale-template upload with columns reordered/inserted/deleted would otherwise be
        // misread silently (e.g. Category data landing in the Tier field) instead of failing
        // cleanly. Only the columns each Read* method actually consumes are checked — the
        // trailing "Error(s) and Warning(s)" display column carries no imported data, so its
        // absence (e.g. someone deleted it from a downloaded template) isn't a correctness risk.
        private static readonly string[] ProjectDetailsHeaders =
        {
            "Project ID", "Multi Year ID", "External ID", "OA Project Code (UACS)", "*Tier", "*Category",
            "*Sub-Category", "MYCA Approval Date", "Description", "*Province", "*City Municipality",
            "*Legislative District:", "*Region", "*District Engineering Office", "*Implementing Office",
            "Operation Unit", "Region Wide", "Origin", "Originating Agency", "Implementation Mode",
            "Emergency Mode", "ROW Available", "Feasibility Study", "Feasibility Date", "Detailed Design",
            "Detailed Design Date", "Rank"
        };
        private static readonly string[] FundingProfileHeaders =
        {
            "Project ID", "Source(s)", "Agreement(s)", "Amount"
        };
        private static readonly string[] ComponentDetailsHeaders =
        {
            "Project ID", "Component Type", "Component ID", "Description", "Cost", "Planned Start Date",
            "Planned End Date", "Infrastructure Type", "Type of Work", "Activity Year"
        };
        private static readonly string[] MajorItemsOfWorkHeaders =
        {
            "Project ID", "Component ID", "Reference ID", "Infrastructure ID", "Detailed Scope", "Target Unit",
            "Start X", "Start Y", "End X", "End Y", "Physical Target", "Start Station", "End Station",
            "Start Chainage (m)", "End Chainage (m)", "Length (meters)", "Activity Year"
        };

        // Compares row 1 of the sheet against the expected header list column-by-column, returning
        // one description per mismatch (missing/blank column counts as a mismatch against what was
        // expected there). An empty return means the layout is trustworthy enough for the Read*
        // methods' fixed-column-index access to be safe.
        private static List<string> ValidateSheetHeaders(ExcelWorksheet ws, string sheetName, string[] expectedHeaders)
        {
            var mismatches = new List<string>();
            for (int col = 1; col <= expectedHeaders.Length; col++)
            {
                var actual = ws.Cells[1, col].Text?.Trim() ?? string.Empty;
                var expected = expectedHeaders[col - 1];
                if (!string.Equals(actual, expected, StringComparison.Ordinal))
                {
                    mismatches.Add($"{sheetName} column {ImportErrorWorkbookBuilder.ColumnLetter(col)}: expected \"{expected}\", found \"{actual}\"");
                }
            }
            return mismatches;
        }

        // Sanitizes a value for use as a filename component — same treatment every generated
        // file's Program/Stage segment gets, so a stray invalid character can't produce a
        // filename the filesystem rejects.
        private static string SanitizeForFileName(string value)
            => string.Join("_", value.Split(Path.GetInvalidFileNameChars()));

        // Compact, sortable, human-readable file suffix: a "when this ran" timestamp plus a
        // short slice of the job's GUID — not the full 32 characters, just enough to disambiguate
        // two jobs for the same Program+Stage that happen to complete within the same second
        // (seen in practice: concurrent Hangfire servers racing for the same job, see the
        // Hangfire Queue Collision write-up). Replaces the previous filename scheme, which used
        // the full raw JobId and, for the Import Report/Errors files, carried no Program/Stage
        // context at all.
        private static string BuildFileSuffix(string jobId, DateTime timestamp)
            => $"{timestamp:yyyyMMdd-HHmmss}-{jobId.Substring(0, Math.Min(8, jobId.Length))}";

        // ── Fresh import: inserts new projects for a Program+Stage, nothing existing is touched ──
        [AutomaticRetry(Attempts = 0)]
        public Task ProcessImport(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken)
            => RunImportAsync(payload, jobCancellationToken, isUpdate: false);

        // ── Update: soft-deletes the existing project set for this Program+Stage, then inserts the replacement set ──
        [AutomaticRetry(Attempts = 0)]
        public Task ProcessUpdate(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken)
            => RunImportAsync(payload, jobCancellationToken, isUpdate: true);

        // ── Export: read-only, so — unlike Import/Update above — this never opens a DB transaction
        // and never touches tImportingStatus's system-wide lock. It can run fully concurrently with
        // Import/Update and with other Export jobs; nothing it does can conflict with a write.
        [AutomaticRetry(Attempts = 0)]
        public async Task ProcessExport(ExportProjectsJobPayload payload, IJobCancellationToken jobCancellationToken)
        {
            // Nullable and assigned only inside the try below — same reasoning as RunImportAsync's
            // jobRecord: fetching the row and saving "Processing" can themselves throw (transient DB
            // issues), and that must not leave the job stuck at "Queued" forever with no catch block
            // ever running to mark it Failed.
            ImportJobResult? jobRecord = null;

            try
            {
                jobRecord = await _db.tImportJobResult.FirstOrDefaultAsync(x => x.JobId == payload.JobId);
                if (jobRecord == null) return;

                jobRecord.Status = "Processing";
                jobRecord.StartedAt = Functions.CurrentDate();
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                await NotifyClient(payload.JobId, "Processing", "Export job has started processing.");

                jobCancellationToken.ThrowIfCancellationRequested();

                // Re-validated here even though the controller already checked before enqueueing —
                // cheap, and closes the window where the Program/Stage is deleted between enqueue
                // and job start.
                var IsValidProgram = await _db.IsValidProgramId(payload.ProgramId, payload.StageName);
                if (!IsValidProgram.IsValid)
                {
                    await FailExportJob(IsValidProgram.Message);
                    return;
                }

                var stageName = payload.StageName.Replace("-", "");
                if (!Enum.TryParse<EnumProgramStage>(stageName, true, out var selectedStage))
                {
                    await FailExportJob($"Invalid program stage '{payload.StageName}'.");
                    return;
                }

                jobCancellationToken.ThrowIfCancellationRequested();
                var cache = await ImportLookupCache.LoadAsync(_db);

                var exportData = await ExportProjectsHelper.BuildExportData(
                    _db, _serviceScopeFactory, cache, payload.ProgramId, selectedStage, jobCancellationToken.ShutdownToken);

                if (exportData.ProjectDetails.Count == 0)
                {
                    await FailExportJob("No projects found for the given Program and Stage.");
                    return;
                }

                jobCancellationToken.ThrowIfCancellationRequested();
                var bytes = ImportErrorWorkbookBuilder.Build(
                    cache,
                    exportData.ProjectDetails,
                    exportData.FundingProfile,
                    exportData.ComponentDetails,
                    exportData.MajorItemsOfWork,
                    IsValidProgram.ProgramDetails.StartYear);

                var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
                Directory.CreateDirectory(tempFolder);

                var safeProgramId = ImportFileNaming.SanitizeForFileName(payload.ProgramId);
                var safeStageName = ImportFileNaming.SanitizeForFileName(payload.StageName);
                var completedAt = Functions.CurrentDate();
                var excelFileName = $"{safeProgramId}_{safeStageName}_Projects_{ImportFileNaming.BuildFileSuffix(payload.JobId, completedAt)}.xlsm";

                await File.WriteAllBytesAsync(Path.Combine(tempFolder, excelFileName), bytes, jobCancellationToken.ShutdownToken);

                jobRecord.Status = "Completed";
                jobRecord.Message = $"Projects exported: {exportData.ProjectDetails.Count}.";
                jobRecord.ValidCount = exportData.ProjectDetails.Count;
                jobRecord.ExcelFileName = excelFileName;
                jobRecord.CompletedAt = completedAt;
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                await _hub.Clients.Group($"import-{payload.JobId}").SendAsync("ImportStatusChanged", new
                {
                    jobRecord.JobId,
                    jobRecord.Status,
                    jobRecord.Message,
                    jobRecord.ValidCount,
                    jobRecord.CompletedAt,
                    ExcelFileUrl = $"/api/Importing/DownloadImportFile?fileName={excelFileName}"
                });
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Export job {JobId} was cancelled", payload.JobId);

                try
                {
                    _db.ChangeTracker.Clear();

                    // jobRecord can still be null here if the very first fetch is itself what threw —
                    // re-fetch by JobId so a startup-time failure still reaches a terminal status
                    // instead of leaving the row stuck at "Queued".
                    jobRecord ??= await _db.tImportJobResult.FirstOrDefaultAsync(x => x.JobId == payload.JobId);

                    if (jobRecord != null)
                    {
                        jobRecord.Status = "Cancelled";
                        jobRecord.Message = "Export job was cancelled.";
                        jobRecord.CompletedAt = Functions.CurrentDate();
                        _db.tImportJobResult.Update(jobRecord);
                        await _db.SaveChangesAsync();
                    }

                    await NotifyClient(payload.JobId, "Cancelled", "Export job was cancelled.");
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save cancelled status for export job {JobId}", payload.JobId);
                }
            }
            catch (Exception ex)
            {
                _ = _exceptionHandler.Handle(ex, payload, payload.RequestedBy);

                try
                {
                    _db.ChangeTracker.Clear();

                    // See the matching comment in the OperationCanceledException catch above.
                    jobRecord ??= await _db.tImportJobResult.FirstOrDefaultAsync(x => x.JobId == payload.JobId);

                    if (jobRecord != null)
                    {
                        jobRecord.Status = "Failed";
                        jobRecord.Message = ex.Message;
                        jobRecord.CompletedAt = Functions.CurrentDate();
                        _db.tImportJobResult.Update(jobRecord);
                        await _db.SaveChangesAsync();
                    }

                    await NotifyClient(payload.JobId, "Failed", ex.Message);
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save error status for export job {JobId}", payload.JobId);
                }
                // No throw — AutomaticRetry(Attempts = 0) means Hangfire won't retry this job anyway,
                // and every terminal branch above has already recorded and notified the failure.
            }

            // ── Local helper — marks the job Failed for an expected (non-exceptional) stop condition,
            // e.g. an invalid Program/Stage or zero projects found. Mirrors RunImportAsync's FailJob,
            // minus the lock-release/transaction-commit calls this read-only job never needed.
            async Task FailExportJob(string message)
            {
                _db.ChangeTracker.Clear();

                jobRecord!.Status = "Failed";
                jobRecord.Message = message;
                jobRecord.CompletedAt = Functions.CurrentDate();
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                await NotifyClient(payload.JobId, "Failed", message);
            }
        }

        // ── Shared core — both entry points funnel through here so fixes/behavior only live in one place ──
        private async Task RunImportAsync(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken, bool isUpdate)
        {
            // ── Track the uploaded file so we can clean it up regardless of outcome ──
            string? uploadedFilePath = payload.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? null : payload.FileUrl;

            // ── Track whether the transaction was already finalized ────────────
            bool transactionFinalized = false;

            // Both nullable and assigned INSIDE the try below (not before it): fetching the job
            // record, saving its "Processing" status, and opening the transaction can all
            // legitimately throw (transient DB issues), and previously ran before any try/catch
            // existed — an exception there left the job stuck at "Queued"/"Processing" forever
            // (no catch block ever ran to mark it Failed) and, worse, left tImportingStatus's
            // system-wide import lock permanently held, since every ReleaseLock/TryReleaseLock
            // call site lives inside this try/catch. Moving the setup inside closes that gap.
            ImportJobResult? jobRecord = null;
            IDbContextTransaction? transaction = null;

            try
            {
                jobRecord = await _db.tImportJobResult
                    .FirstOrDefaultAsync(x => x.JobId == payload.JobId);

                if (jobRecord == null) return;

                jobRecord.Status = "Processing";
                jobRecord.StartedAt = Functions.CurrentDate();
                _db.tImportJobResult.Update(jobRecord);
                await _db.SaveChangesAsync();

                // ── Notify: processing ────────────────────────────────────────────
                await NotifyClient(payload.JobId, "Processing", "Import job has started processing.");

                transaction = await _db.Database.BeginTransactionAsync();

                jobCancellationToken.ThrowIfCancellationRequested();
                // ── Program validation ─────────────────────────────────────────
                var IsValidProgram = await _db.IsValidProgramId(payload.ProgramId, payload.StageName);

                if (!IsValidProgram.IsValid)
                {
                    await FailJob(jobRecord, IsValidProgram.Message, transaction, payload.JobId);
                    return;
                }

                jobCancellationToken.ThrowIfCancellationRequested();
                // ── Read Excel ─────────────────────────────────────────────────
                ExcelPackage package;

                if (!payload.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    var fileInfo = new FileInfo(payload.FileUrl);
                    if (!fileInfo.Exists)
                    {
                        await FailJob(jobRecord, $"File not found: {payload.FileUrl}", transaction, payload.JobId);
                        return;
                    }
                    package = new ExcelPackage(fileInfo);
                }
                else
                {
                    using var httpClient = new HttpClient();
                    byte[] fileBytes;
                    try
                    {
                        fileBytes = await httpClient.GetByteArrayAsync(payload.FileUrl, jobCancellationToken.ShutdownToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch
                    {
                        await FailJob(jobRecord, $"Unable to download file: {payload.FileUrl}", transaction, payload.JobId);
                        return;
                    }
                    package = new ExcelPackage(new MemoryStream(fileBytes));
                }

                using (package)
                {
                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Verify system provenance marker ────────────────────────
                    // Every file this system generates (DownloadTemplate and the error-report
                    // workbook) carries a VeryHidden sheet with a fixed marker value — see
                    // ImportErrorWorkbookBuilder.AddSystemMarker. Its absence means the file
                    // wasn't produced by this system: most likely hand-built from scratch, or
                    // edited with a tool that stripped worksheet-level metadata. Checked before
                    // the sheet/header checks below since it's the most fundamental signal.
                    if (!ImportWorkbookReader.HasSystemMarker(package))
                    {
                        await FailJob(jobRecord, ImportWorkbookReader.MissingMarkerMessage, transaction, payload.JobId);
                        return;
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Validate sheets ────────────────────────────────────────
                    var missingSheets = ImportWorkbookReader.MissingSheets(package);

                    if (missingSheets.Any())
                    {
                        await FailJob(jobRecord, $"Missing sheets: {string.Join(", ", missingSheets)}", transaction, payload.JobId);
                        return;
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Validate headers ──────────────────────────────────────
                    // Sheet names alone don't guarantee the column layout the Read* methods below
                    // rely on (they index by fixed column position) — a stale template version or
                    // a manually reordered/edited file would otherwise be misread silently instead
                    // of failing cleanly.
                    var headerMismatches = ImportWorkbookReader.ValidateAllHeaders(package);

                    if (headerMismatches.Any())
                    {
                        await FailJob(jobRecord, $"The uploaded file's column layout does not match the expected import template. Please use the downloaded template without reordering, inserting, or deleting columns. Details: {string.Join("; ", headerMismatches)}", transaction, payload.JobId);
                        return;
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Read from Excel ────────────────────────────────────
                    var importDto = ImportWorkbookReader.ReadAll(package);

                    // ── Validate and group ─────────────────────────────────
                    var ValidProjectDetails = new List<ImportProjectDetailsExcel>();
                    var ValidFundingProfile = new List<ImportFundingProfileExcel>();
                    var ValidComponentDetails = new List<ImportComponentDetailsExcel>();
                    var ValidMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();
                    var ErrorProjectDetails = new List<ImportProjectDetailsExcel>();
                    var ErrorFundingProfile = new List<ImportFundingProfileExcel>();
                    var ErrorComponentDetails = new List<ImportComponentDetailsExcel>();
                    var ErrorMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();
                    var WarningProjectDetails = new List<ImportProjectDetailsExcel>();
                    var WarningFundingProfile = new List<ImportFundingProfileExcel>();
                    var WarningComponentDetails = new List<ImportComponentDetailsExcel>();
                    var WarningMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Load ALL lookup data ONCE — single DB round-trip ──────────
                    var cache = await ImportLookupCache.LoadAsync(_db);

                    // ── Existing Descriptions for this Program, loaded once — mirrors the main
                    // app's duplicate-Description check (ProjectController.cs's GetSameDescription)
                    // without an N+1 query per row. AlternateId is what the main app's own
                    // Program-scoped ProjectId matching already keys off (see the "Update mode"
                    // KnownProjectIds query below), so it's the right field to exclude "this same
                    // project" against, not the internal ProjectFK/ProjectPK.
                    var existingProjectDescriptions = await _db.tProjectRevisions
                        .Where(x => x.ProgramFK == IsValidProgram.ProgramDetails.ProgramPK)
                        .Select(x => new { x.Description, x.AlternateId })
                        .ToListAsync(jobCancellationToken.ShutdownToken);
                    // Also union in this batch's own rows, so two NEW projects in the same import
                    // sharing a Description get flagged too, not just a new row colliding with
                    // something already in the DB. ValidateProjectDetails already excludes the
                    // row's own ProjectId when matching, so a row is never flagged against itself.
                    var existingDescriptionPairs = existingProjectDescriptions
                        .Select(x => (x.Description ?? string.Empty, x.AlternateId ?? string.Empty))
                        .Concat(importDto.ProjectDetails.Select(x => (x.Description ?? string.Empty, x.ProjectId ?? string.Empty)))
                        .ToList();

                    jobCancellationToken.ThrowIfCancellationRequested();
                    foreach (var item in importDto.ProjectDetails)
                    {
                        var r = _db.ValidateProjectDetails(item, cache, existingDescriptionPairs, IsValidProgram.ProgramDetails.StartYear);
                        if (!r.IsValid) ErrorProjectDetails.Add(item);
                        else if (r.IsWarning) WarningProjectDetails.Add(item);
                        else ValidProjectDetails.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    foreach (var item in importDto.FundingProfile)
                    {
                        var r = _db.ValidateFundingProfile(item, cache);
                        if (!r.IsValid) ErrorFundingProfile.Add(item);
                        else if (r.IsWarning) WarningFundingProfile.Add(item);
                        else ValidFundingProfile.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // Precomputed once for the whole file, not per row — ValidateComponentDetails'
                    // group-cost-overflow check does a dictionary lookup instead of re-scanning and
                    // re-summing componentCosts for every row, and reuses the per-row core
                    // validation this also computes instead of re-running it a second time.
                    var ComponentCostGroupTotals = ImportingHelper.BuildComponentCostGroupTotals(importDto.ComponentDetails, cache, IsValidProgram.ProgramDetails.StartYear);
                    foreach (var item in importDto.ComponentDetails)
                    {
                        var r = _db.ValidateComponentDetails(item, importDto.ComponentDetails, cache, IsValidProgram.ProgramDetails.StartYear, ComponentCostGroupTotals);
                        if (!r.IsValid) ErrorComponentDetails.Add(item);
                        else if (r.IsWarning) WarningComponentDetails.Add(item);
                        else ValidComponentDetails.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    foreach (var item in importDto.MajorItemsOfWork)
                    {
                        var r = _db.ValidateMajorItemsOfWork(item, importDto.ComponentDetails, importDto.MajorItemsOfWork, cache, IsValidProgram.ProgramDetails.StartYear);
                        if (!r.IsValid) ErrorMajorItemsOfWork.Add(item);
                        else if (r.IsWarning) WarningMajorItemsOfWork.Add(item);
                        else ValidMajorItemsOfWork.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Finalize Error List — the cross-sheet rules, shared with the Lump Sum import ──
                    ImportStructuralRules.Apply(
                        ValidProjectDetails, ValidFundingProfile, ValidComponentDetails, ValidMajorItemsOfWork,
                        WarningProjectDetails, WarningFundingProfile, WarningComponentDetails, WarningMajorItemsOfWork,
                        ErrorProjectDetails, ErrorFundingProfile, ErrorComponentDetails, ErrorMajorItemsOfWork);

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Shared cascade: files the given ProjectIds' rows as errors (with a
                    // per-item message) across all four sheets and removes them from the
                    // Valid/Warning lists, so a disregarded ProjectId's Funding/Component/
                    // MajorItemsOfWork rows never end up pointing at a project that was never
                    // saved (or saved with different data than the file's row implied). Shared by
                    // both Import and Update mode below (previously Import re-implemented this
                    // same cascade inline just for its own "already exists" rejection).
                    void DisregardProjectRows(HashSet<string> ids, Func<ImportProjectDetailsExcel, string> messageFor, string childMessage = "Update: parent Project ID was disregarded.")
                    {
                        if (ids.Count == 0) return;

                        foreach (var item in ValidProjectDetails.Concat(WarningProjectDetails).Where(x => ids.Contains(x.ProjectId)))
                        {
                            item.ErrorMessage = messageFor(item);
                            ErrorProjectDetails.Add(item);
                        }
                        ValidProjectDetails.RemoveAll(x => ids.Contains(x.ProjectId));
                        WarningProjectDetails.RemoveAll(x => ids.Contains(x.ProjectId));

                        foreach (var item in ValidFundingProfile.Concat(WarningFundingProfile).Where(x => ids.Contains(x.ProjectId)))
                        {
                            item.ErrorMessage = childMessage;
                            ErrorFundingProfile.Add(item);
                        }
                        ValidFundingProfile.RemoveAll(x => ids.Contains(x.ProjectId));
                        WarningFundingProfile.RemoveAll(x => ids.Contains(x.ProjectId));

                        foreach (var item in ValidComponentDetails.Concat(WarningComponentDetails).Where(x => ids.Contains(x.ProjectId)))
                        {
                            item.ErrorMessage = childMessage;
                            ErrorComponentDetails.Add(item);
                        }
                        ValidComponentDetails.RemoveAll(x => ids.Contains(x.ProjectId));
                        WarningComponentDetails.RemoveAll(x => ids.Contains(x.ProjectId));

                        foreach (var item in ValidMajorItemsOfWork.Concat(WarningMajorItemsOfWork).Where(x => ids.Contains(x.ProjectId)))
                        {
                            item.ErrorMessage = childMessage;
                            ErrorMajorItemsOfWork.Add(item);
                        }
                        ValidMajorItemsOfWork.RemoveAll(x => ids.Contains(x.ProjectId));
                        WarningMajorItemsOfWork.RemoveAll(x => ids.Contains(x.ProjectId));
                    }

                    // ── Identity resolution, computed exactly once per run and shared by every
                    // consumer below (Update's pre-check, Import's pre-check, and — via `resolver`
                    // passed down — SaveProjectDetails/SoftDeleteProjectsByProgramStage in
                    // ImportingHelper.cs) instead of each one independently re-deriving the same
                    // AlternateId-or-ProjectFK-fallback rule and re-querying the DB. See
                    // ProjectIdentityResolver.cs for the full rationale.

                    // AlternateId -> ProjectFK (the immutable ProjectId string itself, e.g.
                    // "BP01000001LZ"). Nulls filtered out: a revision with no AlternateId was
                    // never created via Excel import, so it can never match an Excel row's
                    // ProjectId (already required non-blank by ValidateProjectDetails) — this
                    // filter exists only so Dictionary construction doesn't throw on a null key.
                    // An AlternateId matching more than one distinct ProjectFK under this Program
                    // (data predating SaveProjectDetails' own ambiguity guard) is deliberately
                    // excluded from the map rather than resolved by picking one arbitrarily —
                    // it's handled as its own disregard reason below instead.
                    var KnownProjectGroups = (await _db.tProjectRevisions
                            .Where(x => x.ProgramFK == IsValidProgram.ProgramDetails.ProgramPK && x.AlternateId != null)
                            .Select(x => new { x.AlternateId, x.ProjectFK })
                            .Distinct()
                            .ToListAsync(jobCancellationToken.ShutdownToken))
                        .GroupBy(x => x.AlternateId!, StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    var KnownProjectMap = KnownProjectGroups
                        .Where(g => g.Select(x => x.ProjectFK).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 1)
                        .ToDictionary(g => g.Key, g => g.First().ProjectFK, StringComparer.OrdinalIgnoreCase);

                    var AmbiguousProjectIds = new HashSet<string>(
                        KnownProjectGroups
                            .Where(g => g.Select(x => x.ProjectFK).Distinct(StringComparer.OrdinalIgnoreCase).Count() > 1)
                            .Select(g => g.Key),
                        StringComparer.OrdinalIgnoreCase);

                    // Fallback identity for a project that has no AlternateId yet: its own
                    // ProjectFK is also a valid match (self-mapped), so a re-exported file for
                    // such a project — whose Project ID column is that ProjectFK, since it has
                    // no AlternateId to show instead (ExportProjectsHelper.cs) — is recognized
                    // here instead of being disregarded as "does not exist". SaveProjectDetails
                    // (ImportingHelper.cs) recognizes the same fallback and sets AlternateId on
                    // first successful match, so this path is only ever needed once per project.
                    // "No AlternateId" is stored as an empty string on tProjectRevisions, not
                    // NULL — must check both, or every row here would be silently excluded.
                    var ProjectFKFallbackMap = (await _db.tProjectRevisions
                            .Where(x => x.ProgramFK == IsValidProgram.ProgramDetails.ProgramPK
                                     && (x.AlternateId == null || x.AlternateId == string.Empty))
                            .Select(x => x.ProjectFK)
                            .Distinct()
                            .ToListAsync(jobCancellationToken.ShutdownToken))
                        .ToDictionary(fk => fk, fk => fk, StringComparer.OrdinalIgnoreCase);

                    // Also ambiguous: a ProjectId whose text matches one project's real
                    // AlternateId AND a different project's ProjectFK fallback identity (e.g. a
                    // project was previously given a literal AlternateId equal to some other
                    // project's own permanent ID). Without this check, the resolver would silently
                    // pick the AlternateId match and never notice the collision.
                    foreach (var id in KnownProjectMap.Keys)
                    {
                        if (ProjectFKFallbackMap.TryGetValue(id, out var fallbackFK)
                            && !string.Equals(KnownProjectMap[id], fallbackFK, StringComparison.OrdinalIgnoreCase))
                        {
                            AmbiguousProjectIds.Add(id);
                        }
                    }

                    // Program + THIS specific target Stage — separate from the two Program-wide
                    // maps above. A project with no entry here (despite resolving via one of the
                    // maps above) has only ever existed at a *different* stage — the legitimate
                    // cross-stage-progression case SaveProjectDetails handles by reusing its
                    // ProjectFK under a brand-new revision, not by treating it as "already exists
                    // at this stage".
                    var CurrentStageRevisionRows = await (
                        from ps in _db.tProjectStages
                        join rev in _db.tProjectRevisions on ps.RevisionId equals rev.Id
                        where ps.ProgramFK == IsValidProgram.ProgramDetails.ProgramPK
                           && ps.StageName == payload.StageName
                        select new { Stage = ps, Revision = rev }
                    ).ToListAsync(jobCancellationToken.ShutdownToken);

                    var CurrentStageRevisionByProjectFK = CurrentStageRevisionRows
                        .ToDictionary(x => x.Revision.ProjectFK, x => (x.Stage, x.Revision), StringComparer.OrdinalIgnoreCase);

                    var resolver = new ProjectIdentityResolver(KnownProjectMap, ProjectFKFallbackMap, AmbiguousProjectIds, CurrentStageRevisionByProjectFK);

                    // ── Update mode: disregard any ProjectId that doesn't already exist ────
                    // UpdateProject only refreshes existing projects — a ProjectId with no
                    // prior tProjectRevisions match under this Program is dropped from the
                    // run entirely (never created), and matching rows for it in the other
                    // three sheets are dropped too so nothing ends up pointing at a project
                    // that was never saved. Each dropped row is surfaced as an error so it's
                    // visible in the job result rather than silently vanishing.
                    if (isUpdate)
                    {
                        var DisregardedIds = new HashSet<string>(
                            ValidProjectDetails.Concat(WarningProjectDetails)
                                .Select(x => x.ProjectId)
                                .Where(id => resolver.Resolve(id, out _) == MatchOutcome.NotFound),
                            StringComparer.OrdinalIgnoreCase);

                        DisregardProjectRows(DisregardedIds, _ => "Update: Project ID does not exist for this Program and was disregarded.");

                        // DisregardProjectRows already filters its `ids` set against the current
                        // Valid/Warning lists internally, so AmbiguousProjectIds (the raw DB-derived
                        // set) can be passed directly — no need to re-intersect it against the file
                        // first.
                        DisregardProjectRows(AmbiguousProjectIds, _ => "Update: Project ID is ambiguous under this Program (matches multiple existing projects) and was disregarded.");

                        // ── Island conflict: a project's Island is permanently encoded in the last
                        // characters of its ProjectId (GenerateProjectID, ProjectHelper.cs) and is
                        // never regenerated after creation. If the Excel file's Region resolves to a
                        // different Island than the one already baked into the existing ProjectId,
                        // applying it would silently desync the project's data from its own permanent
                        // identity — reject the row instead. Compared against ProjectFK itself, not
                        // the mutable IslandCode column, since an earlier version of this exact import
                        // path could already have corrupted that column on an older row. Only flagged
                        // when the existing ProjectFK actually ends with a recognized island code (the
                        // longest match, to avoid one code being a trailing substring of another) —
                        // a ProjectFK that doesn't follow the current ID scheme at all (e.g. legacy/
                        // pre-migration data) is left unchecked rather than falsely rejected.
                        var ValidIslandCodes = cache.Regions
                            .Select(x => x.IslandCode)
                            .Where(code => !string.IsNullOrEmpty(code))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderByDescending(code => code.Length)
                            .ToList();

                        // Continuation-fork projects (RevisionController.cs, RevisionGroupId==13/
                        // ReasonId==47, "Terminated project but balance of work to be continued as
                        // another project") use ProjectPK = "{OriginalProjectFK}-A" — a documented,
                        // operator-confirmed exception to the {Stage}{Year}{Sequence}{IslandCode}
                        // format ("cannot be parsed by code that assumes that format"). Strip any
                        // trailing "-A" suffix(es) before matching so a forked project's island is
                        // still resolved from its original ID instead of silently skipping the check.
                        string? ExistingIslandOf(string projectFK)
                        {
                            var idToMatch = projectFK;
                            while (idToMatch.EndsWith("-A", StringComparison.Ordinal))
                                idToMatch = idToMatch[..^2];
                            return ValidIslandCodes.FirstOrDefault(code => idToMatch.EndsWith(code, StringComparison.OrdinalIgnoreCase));
                        }

                        // Keyed by ProjectId -> the existing project's conflicting island. Built in
                        // a single pass (each row's island resolved via ExistingIslandOf exactly
                        // once) so the message callback below can look it up instead of re-deriving it.
                        var IslandConflicts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var item in ValidProjectDetails.Concat(WarningProjectDetails))
                        {
                            if (string.IsNullOrEmpty(item.RegionIslandCode)) continue;
                            if (resolver.Resolve(item.ProjectId, out var existingProjectFK) != MatchOutcome.Found) continue;
                            var existingIsland = ExistingIslandOf(existingProjectFK!);
                            if (existingIsland == null || existingIsland.Equals(item.RegionIslandCode, StringComparison.OrdinalIgnoreCase)) continue;
                            IslandConflicts[item.ProjectId] = existingIsland;
                        }

                        DisregardProjectRows(new HashSet<string>(IslandConflicts.Keys, StringComparer.OrdinalIgnoreCase), item =>
                            $"Update: Region resolves to Island '{item.RegionIslandCode}', which conflicts with the existing project's Island '{IslandConflicts[item.ProjectId]}' (from its Project ID). Changing a project's island via import is not supported.");
                    }
                    else
                    {
                        // ── Fresh import mode: reject any ProjectId that already exists under this
                        // exact Program+Stage — the mirror image of the Update-mode guard above.
                        // SaveProjectDetails (ImportingHelper.cs) resolves identity via the same
                        // shared resolver regardless of which mode called it: it always looks for an
                        // existing revision under this Program+Stage first and, if found, retains and
                        // updates it in place rather than creating anything new. Without this guard, a
                        // fresh Import run whose file happens to reuse an existing ProjectId would
                        // silently overwrite that project's data instead of erroring — indistinguishable
                        // from an Update. Scoped to Program+Stage via CurrentStageRevisionByProjectFK,
                        // so this catches exactly the rows that would otherwise silently retain-and-update
                        // — a match at a *different* stage (legitimate cross-stage progression) is not
                        // rejected here. An Ambiguous resolution is rejected too, with the same message —
                        // Import can't create a new project for an id that's already contested, and
                        // "already exists, use Update" is the correct actionable advice either way.
                        var CollidingIds = new HashSet<string>(
                            ValidProjectDetails.Concat(WarningProjectDetails)
                                .Select(x => x.ProjectId)
                                .Where(id =>
                                {
                                    var outcome = resolver.Resolve(id, out var fk);
                                    if (outcome == MatchOutcome.Ambiguous) return true;
                                    return outcome == MatchOutcome.Found && resolver.CurrentStageRevisionByProjectFK.ContainsKey(fk!);
                                }),
                            StringComparer.OrdinalIgnoreCase);

                        DisregardProjectRows(CollidingIds, _ => "Import: Project ID already exists for this Program and Stage. Use Update Function instead.",
                            childMessage: "Import: parent Project ID already exists and was disregarded.");
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Sorting ────────────────────────────────────────────
                    ErrorProjectDetails.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
                    ErrorFundingProfile.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
                    ErrorComponentDetails.Sort((a, b) =>
                    {
                        int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                        c = string.Compare(a.ComponentType, b.ComponentType, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                        return string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase);
                    });
                    ErrorMajorItemsOfWork.Sort((a, b) =>
                    {
                        int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                        c = string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
                        return string.Compare(a.InfrastructureId, b.InfrastructureId, StringComparison.OrdinalIgnoreCase);
                    });

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Update mode: soft-delete only the projects present in this file ──
                    // Scoped to the same ProjectIds that are about to be re-inserted below
                    // (Valid + Warning rows) — anything under this Program+Stage that isn't
                    // in the file is left untouched. Done here (post-validation, still inside
                    // the transaction) so a bad file never touches existing data, and any
                    // later failure rolls this back too.
                    if (isUpdate)
                    {
                        jobCancellationToken.ThrowIfCancellationRequested();
                        var UpdateProjectIds = ValidProjectDetails.Concat(WarningProjectDetails)
                            .Select(x => x.ProjectId)
                            .ToList();

                        await _db.SoftDeleteProjectsByProgramStage(
                            UpdateProjectIds,
                            resolver,
                            jobRecord.RequestedBy,
                            jobCancellationToken.ShutdownToken);
                    }

                    // ── Saving to Database ──────────────────────────────────────────────
                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Projects ────────────────────────────────────────────────────────
                    var ProjectReference = new List<ImportProjectReference>();
                    var projects = new List<DBHelper.Models.Table.Project.Projects>();
                    var projectstages = new List<DBHelper.Models.Table.Project.ProjectStages>();
                    // RISK-072 follow-up (2026-09-08): collected here, applied once via
                    // DisregardProjectRows AFTER the loop below completes -- calling it mid-loop
                    // would RemoveAll from the exact lists this foreach is still enumerating via
                    // .Concat(), throwing InvalidOperationException: Collection was modified.
                    // Dictionary (not a HashSet) because different rows can belong to different
                    // exhausted categories and need their own message.
                    var ExhaustedProjectIds = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                    foreach (var Item in ValidProjectDetails.Concat(WarningProjectDetails))
                    {
                        ImportingHelper.SaveProjectResponse Projects;
                        try
                        {
                            Projects = await _db.SaveProjectDetails(IsValidProgram.ProgramDetails, Item, ProjectReference, resolver, jobCancellationToken.ShutdownToken);
                        }
                        catch (ProjectHelper.ProjectIdRangeExhaustedException ex)
                        {
                            ExhaustedProjectIds[Item.ProjectId] = ex.Message;
                            continue;
                        }

                        // ── Reused project (found via AlternateId): entity is already tracked by EF,
                        // field updates made inside SaveProjectDetails persist on SaveChanges below —
                        // no Add(), and CreatedBy/CreatedDate must stay untouched (tProjects has no UpdatedBy).
                        if (Projects.IsNewProject)
                        {
                            Projects.Project.CreatedBy = jobRecord.RequestedBy;
                            Projects.Project.CreatedDate = Functions.CurrentDate();
                            _db.tProjects.Add(Projects.Project);
                        }
                        _db.SaveChanges();

                        // ── Retained revision (found for this exact Program+Stage+ProjectId): entity is
                        // already tracked by EF with its fields refreshed inside SaveProjectDetails — no
                        // Add(), just stamp UpdatedBy/UpdatedDate and let SaveChanges persist it in place.
                        if (Projects.IsNewRevision)
                        {
                            Projects.ProjectRevision.CreatedBy = jobRecord.RequestedBy;
                            Projects.ProjectRevision.CreatedDate = Functions.CurrentDate();
                            _db.tProjectRevisions.Add(Projects.ProjectRevision);
                        }
                        else
                        {
                            Projects.ProjectRevision.UpdatedBy = jobRecord.RequestedBy;
                            Projects.ProjectRevision.UpdatedDate = Functions.CurrentDate();
                        }
                        _db.SaveChanges();

                        Projects.ImportReference.NewProjectId = Projects.ProjectRevision.Id;
                        Projects.ImportReference.UACS = Item.UACS;

                        ProjectReference.Add(Projects.ImportReference);
                        projects.Add(Projects.Project);

                        // Only a brand-new revision needs its stage's RevisionId (re)pointed — a
                        // retained revision keeps the same Id, so its stage row is already correct.
                        if (Projects.IsNewRevision)
                        {
                            Projects.ProjectStage.RevisionId = Projects.ProjectRevision.Id;
                            Projects.ProjectStage.CreatedBy = jobRecord.RequestedBy;
                            Projects.ProjectStage.CreatedDate = Functions.CurrentDate();
                            _db.tProjectStages.Add(Projects.ProjectStage);
                        }

                        projectstages.Add(Projects.ProjectStage);
                        _db.SaveChanges();
                    }

                    // RISK-072 follow-up (2026-09-08): applied once, now that the loop above has
                    // fully finished enumerating ValidProjectDetails/WarningProjectDetails -- rows
                    // whose ProjectId range was exhausted are disregarded and reported the same way
                    // every other row-level validation failure in this file already is.
                    DisregardProjectRows(
                        new HashSet<string>(ExhaustedProjectIds.Keys, StringComparer.OrdinalIgnoreCase),
                        item => ExhaustedProjectIds.TryGetValue(item.ProjectId, out var msg) ? msg : "Import: Project ID's range was exhausted and the row was disregarded.");

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Funding Profile ────────────────────────────────────────
                    var FundingProfile = new List<DBHelper.Models.Table.Project.ProjectFundingProfile>();

                    foreach (var Item in ValidFundingProfile.Concat(WarningFundingProfile))
                    {
                        var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId);

                        if (Reference == null) continue;

                        var Validate = _db.SaveFundingProfile(Item, Reference);

                        Validate.FundingProfile.CreatedBy = jobRecord.RequestedBy;
                        Validate.FundingProfile.CreatedDate = Functions.CurrentDate();
                        FundingProfile.Add(Validate.FundingProfile);
                    }
                    await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Component Details ──────────────────────────────────────
                    var ComponentReference = new List<ImportComponentReference>();
                    var ComponentCost = new List<DBHelper.Models.Table.Project.ProjectComponentCost>();
                    var ComponentCostPerYear = new List<DBHelper.Models.Table.Project.ProjectComponentCostPerYear>();

                    foreach (var Item in ValidComponentDetails.Concat(WarningComponentDetails))
                    {
                        var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId);
                        if (Reference == null) continue;

                        var ReferenceComponent = ComponentReference.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);

                        if (ReferenceComponent == null)
                        {
                            // First time seeing this ProjectId + ComponentId -> create the cost record
                            var Validate = _db.SaveComponentCost(Item, Reference);
                            Validate.ComponentCost.CreatedBy = jobRecord.RequestedBy;
                            Validate.ComponentCost.CreatedDate = Functions.CurrentDate();
                            ComponentCost.Add(Validate.ComponentCost);
                            _db.tProjectComponentCost.Add(Validate.ComponentCost);
                            _db.SaveChanges(); // need to save for tProjectComponentCostPerYear.ComponentCostFK

                            ReferenceComponent = new ImportComponentReference
                            {
                                OldProjectFK = Item.ProjectId,
                                ComponentId = Item.ComponentId,
                                NewComponentId = Validate.ComponentCost.Id,
                                WorkTypeFK = Item.ScopeOfWorkEnum,
                                InfraTypeFK = Item.InfraTypeInfraCode
                            };
                            ComponentReference.Add(ReferenceComponent);

                            var ValidatePerYear = _db.SaveComponentCostPerYear(Item, ReferenceComponent, Reference.UACS);
                            ValidatePerYear.ComponentCostPerYear.CreatedBy = jobRecord.RequestedBy;
                            ValidatePerYear.ComponentCostPerYear.CreatedDate = Functions.CurrentDate();
                            ComponentCostPerYear.Add(ValidatePerYear.ComponentCostPerYear);
                        }
                        else
                        {
                            // Already have a cost record for this ProjectId + ComponentId -> add another year, roll up the total
                            var ValidatePerYear = _db.SaveComponentCostPerYear(Item, ReferenceComponent, Reference.UACS);
                            ValidatePerYear.ComponentCostPerYear.CreatedBy = jobRecord.RequestedBy;
                            ValidatePerYear.ComponentCostPerYear.CreatedDate = Functions.CurrentDate();
                            ComponentCostPerYear.Add(ValidatePerYear.ComponentCostPerYear);

                            var ExistingComponentCost = ComponentCost.First(x => x.Id == ReferenceComponent.NewComponentId);
                            ExistingComponentCost.Total += ValidatePerYear.ComponentCostPerYear.Amount;
                        }
                    }
                    await _db.tProjectComponentCostPerYear.AddRangeAsync(ComponentCostPerYear);

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Major Items Of Work ────────────────────────────────────────
                    var WorkItemtReference = new List<ImportMajorWorkItemReference>();
                    var MajorItemOfWork = new List<DBHelper.Models.Table.Project.ProjectMajorWorkItem>();
                    var MajorWorkLocations = new List<DBHelper.Models.Table.Project.ProjectMajorWorkLocations>();

                    foreach (var Item in ValidMajorItemsOfWork.Concat(WarningMajorItemsOfWork))
                    {
                        var ReferenceComponent = ComponentReference.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);

                        if (ReferenceComponent == null) continue;

                        var ReferenceWorkItem = WorkItemtReference.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);

                        if (ReferenceWorkItem == null)
                        {
                            // First time seeing this ProjectId + ComponentId -> create the work item record
                            var Validate = _db.SaveMajorItemsOfWork(Item, ReferenceComponent);

                            Validate.MajorWorkItem.CreatedBy = jobRecord.RequestedBy;
                            Validate.MajorWorkItem.CreatedDate = Functions.CurrentDate();
                            MajorItemOfWork.Add(Validate.MajorWorkItem);
                            _db.tProjectMajorWorkItem.Add(Validate.MajorWorkItem);
                            _db.SaveChanges(); // need to save for tProjectMajorWorkLocations.WorkItemFK

                            ReferenceWorkItem = new ImportMajorWorkItemReference
                            {
                                OldProjectFK = Item.ProjectId,
                                ComponentId = Item.ComponentId,
                                NewWorkItem = Validate.MajorWorkItem.Id
                            };
                            WorkItemtReference.Add(ReferenceWorkItem);

                            var ValidateWorkLocation = _db.SaveMajorWorkLocation(Item, ReferenceWorkItem);

                            ValidateWorkLocation.MajorWorkLocation.CreatedBy = jobRecord.RequestedBy;
                            ValidateWorkLocation.MajorWorkLocation.CreatedDate = Functions.CurrentDate();
                            MajorWorkLocations.Add(ValidateWorkLocation.MajorWorkLocation);
                        }
                        else
                        {
                            var ValidateWorkLocation = _db.SaveMajorWorkLocation(Item, ReferenceWorkItem);

                            ValidateWorkLocation.MajorWorkLocation.CreatedBy = jobRecord.RequestedBy;
                            ValidateWorkLocation.MajorWorkLocation.CreatedDate = Functions.CurrentDate();
                            MajorWorkLocations.Add(ValidateWorkLocation.MajorWorkLocation);
                        }
                    }
                    await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Generate output files ──────────────────────────────
                    bool hasErrors = ErrorProjectDetails.Any() || ErrorFundingProfile.Any()
                                  || ErrorComponentDetails.Any() || ErrorMajorItemsOfWork.Any();

                    var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
                    Directory.CreateDirectory(tempFolder);

                    var safeProgramId = ImportFileNaming.SanitizeForFileName(payload.ProgramId);
                    var safeStageName = ImportFileNaming.SanitizeForFileName(payload.StageName);
                    // Computed once here and reused as jobRecord.CompletedAt below (moved earlier
                    // than the post-commit point it was previously set at) so the filename and the
                    // job record agree on the same completion timestamp — same as ProcessExport.
                    var completedAt = Functions.CurrentDate();
                    var fileSuffix = ImportFileNaming.BuildFileSuffix(payload.JobId, completedAt);
                    var textFileName = $"ImportReport_{safeProgramId}_{safeStageName}_{fileSuffix}.txt";
                    var excelFileName = $"ImportErrors_{safeProgramId}_{safeStageName}_{fileSuffix}.xlsm";

                    // Text file
                    var textBytes = GenerateTextReport(
                        ValidProjectDetails, ValidFundingProfile, ValidComponentDetails, ValidMajorItemsOfWork,
                        WarningProjectDetails, WarningFundingProfile, WarningComponentDetails, WarningMajorItemsOfWork);

                    await File.WriteAllBytesAsync(Path.Combine(tempFolder, textFileName), textBytes, jobCancellationToken.ShutdownToken);

                    // Excel file (only if errors)
                    if (hasErrors)
                    {
                        var excelBytes = ImportErrorWorkbookBuilder.Build(
                            cache, ErrorProjectDetails, ErrorFundingProfile,
                            ErrorComponentDetails, ErrorMajorItemsOfWork,
                            IsValidProgram.ProgramDetails.StartYear);

                        await File.WriteAllBytesAsync(Path.Combine(tempFolder, excelFileName), excelBytes, jobCancellationToken.ShutdownToken);
                    }

                    // ── Release lock and commit ────────────────────────────────
                    await ReleaseLock();
                    transactionFinalized = true;
                    await transaction.CommitAsync(jobCancellationToken.ShutdownToken);

                    // ── Update job result AFTER commit ─────────────────────────
                    jobRecord.Status = hasErrors ? "CompletedWithErrors" : "Completed";
                    jobRecord.Message = $"Projects imported: {ValidProjectDetails.Count + WarningProjectDetails.Count}.";
                    jobRecord.ValidCount = ValidProjectDetails.Count + WarningProjectDetails.Count;
                    // Counted across all four sheets, not just Project Details — a row can end up
                    // in error/warning (e.g. a "floating record" demoted by FinalizeErrors) without
                    // its Project Details row itself carrying any warning/error, which previously
                    // left ErrorCount/WarningCount at 0 even when hasErrors (below) was true.
                    jobRecord.WarningCount = WarningProjectDetails.Count + WarningFundingProfile.Count + WarningComponentDetails.Count + WarningMajorItemsOfWork.Count;
                    jobRecord.ErrorCount = ErrorProjectDetails.Count + ErrorFundingProfile.Count + ErrorComponentDetails.Count + ErrorMajorItemsOfWork.Count;
                    jobRecord.TextFileName = textFileName;
                    jobRecord.ExcelFileName = hasErrors ? excelFileName : string.Empty;
                    jobRecord.CompletedAt = completedAt;
                    _db.tImportJobResult.Update(jobRecord);
                    await _db.SaveChangesAsync();

                    // ── Notify: completed ──────────────────────────────────
                    await _hub.Clients.Group($"import-{payload.JobId}").SendAsync("ImportStatusChanged", new
                    {
                        jobRecord.JobId,
                        jobRecord.Status,
                        jobRecord.Message,
                        jobRecord.ValidCount,
                        jobRecord.WarningCount,
                        jobRecord.ErrorCount,
                        jobRecord.CompletedAt,
                        TextFileUrl = $"/api/Importing/DownloadImportFile?fileName={textFileName}",
                        ExcelFileUrl = hasErrors ? $"/api/Importing/DownloadImportFile?fileName={excelFileName}" : string.Empty
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // ── Hangfire cancelled the job (server shutdown or manual delete) ──
                _logger.LogWarning("Import job {JobId} was cancelled", payload.JobId);

                if (transaction != null && !transactionFinalized)
                {
                    try { await transaction.RollbackAsync(); }
                    catch (Exception rbEx) { _logger.LogWarning(rbEx, "Rollback failed for cancelled job {JobId}", payload.JobId); }
                }

                try
                {
                    // Discard any entities still tracked from the failed save (e.g. an
                    // out-of-range value that never got here) so persisting the status
                    // below can't fail again on the same poisoned change tracker.
                    _db.ChangeTracker.Clear();

                    // jobRecord can still be null here if the very first fetch (now inside this
                    // try block) is itself what threw — re-fetch by JobId so a startup-time
                    // failure still reaches a terminal status instead of leaving the row stuck.
                    jobRecord ??= await _db.tImportJobResult.FirstOrDefaultAsync(x => x.JobId == payload.JobId);

                    if (jobRecord != null)
                    {
                        jobRecord.Status = "Cancelled";
                        jobRecord.Message = "Import job was cancelled.";
                        jobRecord.CompletedAt = Functions.CurrentDate();
                        _db.tImportJobResult.Update(jobRecord);
                        await _db.SaveChangesAsync();
                    }

                    await NotifyClient(payload.JobId, "Cancelled", "Import job was cancelled.");
                }
                catch (Exception saveEx) { _logger.LogError(saveEx, "Failed to save cancelled status for job {JobId}", payload.JobId); }

                // Releases tImportingStatus's system-wide import lock. Must run unconditionally
                // here (not just when jobRecord is known) — the controller acquires this lock
                // before the job even starts, so any failure in this method, including before
                // jobRecord was ever fetched, must still release it or every future Import/Update
                // request gets blocked with "Import is currently in use" until someone manually
                // clears the row in the DB.
                await TryReleaseLock();
            }
            catch (Exception ex)
            {
                _ = _exceptionHandler.Handle(ex, payload, payload.RequestedBy);

                // ── Only rollback if the transaction wasn't already finalized ──
                if (transaction != null && !transactionFinalized)
                {
                    try
                    {
                        await transaction.RollbackAsync();
                    }
                    catch (Exception rollbackEx)
                    {
                        // Transaction may have already been closed by the DB
                        _logger.LogWarning(rollbackEx, "Rollback failed for job {JobId} — transaction may already be closed", payload.JobId);
                    }
                }

                // ── Save failure status outside the dead transaction ───────────
                try
                {
                    // Discard whatever entity caused SaveChangesAsync to fail so it can't
                    // keep failing the same way when we try to persist "Failed" below.
                    _db.ChangeTracker.Clear();

                    // See the matching comment in the OperationCanceledException catch above.
                    jobRecord ??= await _db.tImportJobResult.FirstOrDefaultAsync(x => x.JobId == payload.JobId);

                    if (jobRecord != null)
                    {
                        jobRecord.Status = "Failed";
                        jobRecord.Message = ex.Message;
                        jobRecord.CompletedAt = Functions.CurrentDate();
                        _db.tImportJobResult.Update(jobRecord);
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save error status for job {JobId}", payload.JobId);
                }

                // See the matching comment in the OperationCanceledException catch above.
                await TryReleaseLock();
                throw;
            }
            finally
            {
                if (transaction != null)
                    await transaction.DisposeAsync();

                // ── Clean up the uploaded source file ───────────────────────────
                if (uploadedFilePath != null)
                {
                    try
                    {
                        if (File.Exists(uploadedFilePath))
                            File.Delete(uploadedFilePath);
                    }
                    catch (Exception delEx)
                    {
                        _logger.LogWarning(delEx, "Failed to delete uploaded import file {Path} for job {JobId}", uploadedFilePath, payload.JobId);
                    }
                }
            }

            async Task ReleaseLock()
            {
                var lockRecord = await _db.tImportingStatus
                    .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
                if (lockRecord == null) return;
                lockRecord.IsActive = false;
                _db.tImportingStatus.Update(lockRecord);
                await _db.SaveChangesAsync();
            }

            // ── Safe version for catch blocks — won't throw ────────────────────
            async Task TryReleaseLock()
            {
                try { await ReleaseLock(); }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed to release import lock for job {JobId}", payload.JobId); }
            }

            async Task FailJob(ImportJobResult record, string message, IDbContextTransaction tx, string jobId)
            {
                await TryReleaseLock();
                //finalized = true;
                transactionFinalized = true;
                await tx.CommitAsync();

                // Same as the two catch blocks below: discard any entities still tracked from a
                // failed save so persisting the status here can't fail again on the same poisoned
                // change tracker. Currently a no-op for every existing call site (all fire before
                // any tracked-entity work), but that's incidental to call-site ordering, not
                // structural — keep it so a future call site doesn't silently reintroduce the crash.
                _db.ChangeTracker.Clear();

                record.Status = "Failed";
                record.Message = message;
                record.CompletedAt = Functions.CurrentDate();
                _db.tImportJobResult.Update(record);
                await _db.SaveChangesAsync();

                await NotifyClient(jobId, "Failed", message);
            }
        }

        // ── SignalR notification helper ────────────────────────────────────────
        private async Task NotifyClient(string jobId, string status, string message)
        {
            try
            {
                await _hub.Clients.Group($"import-{jobId}").SendAsync("ImportStatusChanged", new
                {
                    JobId = jobId,
                    Status = status,
                    Message = message
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SignalR notification failed for job {JobId}", jobId);
            }
        }

        // ── Generate text report bytes ─────────────────────────────────────────
        private byte[] GenerateTextReport(
            List<ImportProjectDetailsExcel> validP, List<ImportFundingProfileExcel> validF, List<ImportComponentDetailsExcel> validC, List<ImportMajorItemsOfWorkExcel> validM,
            List<ImportProjectDetailsExcel> warnP, List<ImportFundingProfileExcel> warnF, List<ImportComponentDetailsExcel> warnC, List<ImportMajorItemsOfWorkExcel> warnM)
        {
            DateTime CurrentDate = Functions.CurrentDate();

            var sb = new StringBuilder();
            sb.AppendLine("=== IMPORT PROJECT REPORT ===");
            sb.AppendLine($"Generated: {CurrentDate:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine();

            sb.AppendLine("--- VALID RECORDS ---");
            sb.AppendLine($"Project Details:      {validP.Count}");
            sb.AppendLine($"Funding Profile:      {validF.Count}");
            sb.AppendLine($"Component Details:    {validC.Count}");
            sb.AppendLine($"Major Items of Work:  {validM.Count}");
            sb.AppendLine();

            void WriteSection<T>(List<T> list, string header, Func<T, string> line)
            {
                if (!list.Any()) return;
                sb.AppendLine(header);
                list.ForEach(x => sb.AppendLine($"  {line(x)}"));
                sb.AppendLine();
            }

            WriteSection(validP, "--- VALID: PROJECT DETAILS ---", x => $"Project ID: {x.ProjectId}");
            WriteSection(validF, "--- VALID: FUNDING PROFILE ---", x => $"Project ID: {x.ProjectId}");
            WriteSection(validC, "--- VALID: COMPONENT DETAILS ---", x => $"Project ID: {x.ProjectId} | Component ID: {x.ComponentId}");
            WriteSection(validM, "--- VALID: MAJOR ITEMS OF WORK ---", x => $"Project ID: {x.ProjectId} | Infrastructure ID: {x.InfrastructureId}");

            sb.AppendLine("--- WARNING RECORDS ---");
            sb.AppendLine($"Project Details:      {warnP.Count}");
            sb.AppendLine($"Funding Profile:      {warnF.Count}");
            sb.AppendLine($"Component Details:    {warnC.Count}");
            sb.AppendLine($"Major Items of Work:  {warnM.Count}");
            sb.AppendLine();

            WriteSection(warnP, "--- WARNING: PROJECT DETAILS ---", x => $"Project ID: {x.ProjectId} | Warning: {x.ErrorMessage}");
            WriteSection(warnF, "--- WARNING: FUNDING PROFILE ---", x => $"Project ID: {x.ProjectId} | Warning: {x.ErrorMessage}");
            WriteSection(warnC, "--- WARNING: COMPONENT DETAILS ---", x => $"Project ID: {x.ProjectId} | Component ID: {x.ComponentId} | Warning: {x.ErrorMessage}");
            WriteSection(warnM, "--- WARNING: MAJOR ITEMS OF WORK ---", x => $"Project ID: {x.ProjectId} | Infrastructure ID: {x.InfrastructureId} | Warning: {x.ErrorMessage}");

            return Encoding.UTF8.GetBytes(sb.ToString());
        }
    }
}