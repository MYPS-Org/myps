using DBHelper.Data;
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
        private readonly IWebHostEnvironment _env;
        private readonly IHubContext<ImportHub> _hub;
        private readonly ILogger<ImportProjectJobService> _logger;

        public ImportProjectJobService(
            MYPSDbContext db,
            IWebHostEnvironment env,
            IHubContext<ImportHub> hub,
            ILogger<ImportProjectJobService> logger)
        {
            _db = db;
            _env = env;
            _hub = hub;
            _logger = logger;
        }

        //[AutomaticRetry(Attempts = 0)]
        //public async Task ProcessImport(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken)
        //{
        //    var jobRecord = await _db.tImportJobResult
        //        .FirstOrDefaultAsync(x => x.JobId == payload.JobId);

        //    if (jobRecord == null) return;

        //    jobRecord.Status = "Processing";
        //    jobRecord.StartedAt = Functions.CurrentDate();
        //    _db.tImportJobResult.Update(jobRecord);
        //    await _db.SaveChangesAsync(cancellationToken);

        //    // ── Notify: processing ────────────────────────────────────────────
        //    await NotifyClient(payload.JobId, "Processing", "Import job has started processing.");

        //    // ── Track whether the transaction was already finalized ────────────
        //    bool transactionFinalized = false;
        //    var transaction = await _db.Database.BeginTransactionAsync();

        //    try
        //    {
        //        jobCancellationToken.ThrowIfCancellationRequested();
        //        // ── Program validation ─────────────────────────────────────────
        //        var IsValidProgram = _db.IsValidProgramId(payload.ProgramId, payload.StageName);
        //        if (!IsValidProgram.IsValid)
        //        {
        //            await FailJob(jobRecord, IsValidProgram.Message, transaction, payload.JobId);
        //            return;

        //            //await ReleaseLock();

        //            //transactionFinalized = true;
        //            //await transaction.CommitAsync();

        //            //jobRecord.Status = "Failed";
        //            //jobRecord.Message = IsValidProgram.Message;
        //            //jobRecord.CompletedAt = Functions.CurrentDate();
        //            //_db.tImportJobResult.Update(jobRecord);
        //            //await _db.SaveChangesAsync(cancellationToken);
        //            //return;
        //        }

        //        jobCancellationToken.ThrowIfCancellationRequested();
        //        // ── Read Excel ─────────────────────────────────────────────────
        //        ExcelPackage package;

        //        if (!payload.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        //        {
        //            var fileInfo = new FileInfo(payload.FileUrl);
        //            if (!fileInfo.Exists)
        //            {
        //                await FailJob(jobRecord, $"File not found: {payload.FileUrl}", transaction, payload.JobId);
        //                return;
        //            }
        //            package = new ExcelPackage(fileInfo);
        //        }
        //        else
        //        {
        //            //using var httpClient = new HttpClient();
        //            //var fileBytes = await httpClient.GetByteArrayAsync(payload.FileUrl);
        //            //package = new ExcelPackage(new MemoryStream(fileBytes));

        //            using var httpClient = new HttpClient();
        //            byte[] fileBytes;
        //            try
        //            {
        //                fileBytes = await httpClient.GetByteArrayAsync(payload.FileUrl, jobCancellationToken.ShutdownToken);
        //            }
        //            catch (OperationCanceledException)
        //            {
        //                throw;
        //            }
        //            catch
        //            {
        //                await FailJob(jobRecord, $"Unable to download file: {payload.FileUrl}", transaction, payload.JobId);
        //                return;
        //            }
        //            package = new ExcelPackage(new MemoryStream(fileBytes));
        //        }

        //        using (package)
        //        {
        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Validate sheets ────────────────────────────────────────
        //            var requiredSheets = new[]
        //            {
        //                "PROJECT DETAILS", "FUNDING PROFILE",
        //                "COMPONENT DETAILS", "MAJOR ITEMS OF WORK"
        //            };
        //            var missingSheets = requiredSheets
        //                .Where(s => package.Workbook.Worksheets[s] == null)
        //                .ToList();

        //            if (missingSheets.Any())
        //            {
        //                await FailJob(jobRecord, $"Missing sheets: {string.Join(", ", missingSheets)}", transaction, payload.JobId);
        //                return;
        //            }

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Read from Excel ────────────────────────────────────
        //            var importDto = new ImportProjectDTOExcel
        //            {
        //                ProjectDetails = ReadProjectDetails(package),
        //                FundingProfile = ReadFundingProfile(package),
        //                ComponentDetails = ReadComponentDetails(package),
        //                MajorItemsOfWork = ReadMajorItemsOfWork(package)
        //            };

        //            // ── Validate and group ─────────────────────────────────
        //            var ValidProjectDetails = new List<ImportProjectDetailsExcel>();
        //            var ValidFundingProfile = new List<ImportFundingProfileExcel>();
        //            var ValidComponentDetails = new List<ImportComponentDetailsExcel>();
        //            var ValidMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();
        //            var ErrorProjectDetails = new List<ImportProjectDetailsExcel>();
        //            var ErrorFundingProfile = new List<ImportFundingProfileExcel>();
        //            var ErrorComponentDetails = new List<ImportComponentDetailsExcel>();
        //            var ErrorMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();
        //            var WarningProjectDetails = new List<ImportProjectDetailsExcel>();
        //            var WarningFundingProfile = new List<ImportFundingProfileExcel>();
        //            var WarningComponentDetails = new List<ImportComponentDetailsExcel>();
        //            var WarningMajorItemsOfWork = new List<ImportMajorItemsOfWorkExcel>();

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Load ALL lookup data ONCE — single DB round-trip ──────────
        //            var cache = await ImportLookupCache.LoadAsync(_db);

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            foreach (var item in importDto.ProjectDetails)
        //            {
        //                var r = _db.ValidateProjectDetails(item, cache);
        //                if (!r.IsValid) ErrorProjectDetails.Add(item);
        //                else if (r.IsWarning) WarningProjectDetails.Add(item);
        //                else ValidProjectDetails.Add(item);
        //            }

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            foreach (var item in importDto.FundingProfile)
        //            {
        //                var r = _db.ValidateFundingProfile(item, cache);
        //                if (!r.IsValid) ErrorFundingProfile.Add(item);
        //                else if (r.IsWarning) WarningFundingProfile.Add(item);
        //                else ValidFundingProfile.Add(item);
        //            }

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            foreach (var item in importDto.ComponentDetails)
        //            {
        //                var r = _db.ValidateComponentDetails(item, importDto.ComponentDetails, cache);
        //                if (!r.IsValid) ErrorComponentDetails.Add(item);
        //                else if (r.IsWarning) WarningComponentDetails.Add(item);
        //                else ValidComponentDetails.Add(item);
        //            }

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            foreach (var item in importDto.MajorItemsOfWork)
        //            {
        //                var r = _db.ValidateMajorItemsOfWork(item, importDto.ComponentDetails, cache);
        //                if (!r.IsValid) ErrorMajorItemsOfWork.Add(item);
        //                else if (r.IsWarning) WarningMajorItemsOfWork.Add(item);
        //                else ValidMajorItemsOfWork.Add(item);
        //            }

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Finalize Error List ────────────────────────────────
        //            FinalizeErrors(
        //                ValidProjectDetails, ValidFundingProfile, ValidComponentDetails, ValidMajorItemsOfWork,
        //                WarningProjectDetails, WarningFundingProfile, WarningComponentDetails, WarningMajorItemsOfWork,
        //                ErrorProjectDetails, ErrorFundingProfile, ErrorComponentDetails, ErrorMajorItemsOfWork);

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Sorting ────────────────────────────────────────────
        //            ErrorProjectDetails.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
        //            ErrorFundingProfile.Sort((a, b) => string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase));
        //            ErrorComponentDetails.Sort((a, b) =>
        //            {
        //                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
        //                c = string.Compare(a.ComponentType, b.ComponentType, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
        //                return string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase);
        //            });
        //            ErrorMajorItemsOfWork.Sort((a, b) =>
        //            {
        //                int c = string.Compare(a.ProjectId, b.ProjectId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
        //                c = string.Compare(a.ComponentId, b.ComponentId, StringComparison.OrdinalIgnoreCase); if (c != 0) return c;
        //                return string.Compare(a.InfrastructureId, b.InfrastructureId, StringComparison.OrdinalIgnoreCase);
        //            });

        //            //// ── Saving to Database ──────────────────────────────────────────────
        //            //jobCancellationToken.ThrowIfCancellationRequested();
        //            //// ── Projects ────────────────────────────────────────────────────────
        //            //var ProjectReference = new List<ImportProjectReference>();
        //            //var projects = new List<DBHelper.Models.Table.Projects>();
        //            //var projectstages = new List<DBHelper.Models.Table.ProjectStages>();

        //            //foreach (var Item in ValidProjectDetails.Concat(WarningProjectDetails))
        //            //{
        //            //    var Projects = _db.SaveProjectDetails(IsValidProgram.ProgramDetails, Item, ProjectReference, cache);

        //            //    Projects.Project.CreatedBy = jobRecord.RequestedBy;
        //            //    Projects.Project.CreatedDate = Functions.CurrentDate();

        //            //    Projects.ProjectRevision.CreatedBy = jobRecord.RequestedBy;
        //            //    Projects.ProjectRevision.CreatedDate = Functions.CurrentDate();

        //            //    ProjectReference.Add(Projects.ImportReference);
        //            //    projects.Add(Projects.Project);

        //            //    _db.tProjectRevisions.Add(Projects.ProjectRevision);
        //            //    _db.SaveChanges();

        //            //    Projects.ProjectStage.RevisionId = Projects.ProjectRevision.Id;
        //            //    Projects.ProjectStage.CreatedBy = jobRecord.RequestedBy;
        //            //    Projects.ProjectStage.CreatedDate = Functions.CurrentDate();

        //            //    projectstages.Add(Projects.ProjectStage);
        //            //}
        //            //await _db.tProjects.AddRangeAsync(projects);
        //            //await _db.tProjectStages.AddRangeAsync(projectstages);

        //            //jobCancellationToken.ThrowIfCancellationRequested();
        //            //// ── Funding Profile ────────────────────────────────────────
        //            //var FundingProfile = new List<DBHelper.Models.Table.ProjectFundingProfile>();

        //            //foreach (var Item in ValidFundingProfile.Concat(WarningFundingProfile))
        //            //{
        //            //    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);

        //            //    if (Reference == null) continue;

        //            //    var Validate = _db.SaveFundingProfile(Item, Reference);

        //            //    Validate.FundingProfile.CreatedBy = jobRecord.RequestedBy;
        //            //    Validate.FundingProfile.CreatedDate = Functions.CurrentDate();
        //            //    Validate.FundingProfile.StageName = IsValidProgram.ProgramDetails.StageName;
        //            //    FundingProfile.Add(Validate.FundingProfile);
        //            //}
        //            //await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);

        //            //jobCancellationToken.ThrowIfCancellationRequested();
        //            //// ── Component Details ──────────────────────────────────────
        //            //var ComponentCost = new List<DBHelper.Models.Table.ProjectComponentCost>();
        //            //var ComponentCostPerYear = new List<DBHelper.Models.Table.ProjectComponentCostPerYear>();

        //            //foreach (var Item in ValidComponentDetails.Concat(WarningComponentDetails))
        //            //{
        //            //    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
        //            //    if (Reference == null) continue;

        //            //    var Validate = _db.SaveComponentCost(Item, Reference);

        //            //    Validate.ComponentCost.CreatedBy = jobRecord.RequestedBy;
        //            //    Validate.ComponentCost.CreatedDate = Functions.CurrentDate();
        //            //    Validate.ComponentCost.StageName = IsValidProgram.ProgramDetails.StageName;
        //            //    Validate.ComponentCost.CostId = $"{Validate.ComponentCost.ProjectId}-{Validate.ComponentCost.ComponentId}";
        //            //    ComponentCost.Add(Validate.ComponentCost);

        //            //    Validate.ComponentCostPerYear.CreatedBy = jobRecord.RequestedBy;
        //            //    Validate.ComponentCostPerYear.CreatedDate = Functions.CurrentDate();
        //            //    Validate.ComponentCostPerYear.StageName = IsValidProgram.ProgramDetails.StageName;
        //            //    Validate.ComponentCostPerYear.ComponentCostId = $"{Validate.ComponentCost.ProjectId}-{Validate.ComponentCost.ComponentId}";
        //            //    ComponentCostPerYear.Add(Validate.ComponentCostPerYear);
        //            //}
        //            //await _db.tProjectComponentCost.AddRangeAsync(ComponentCost);
        //            //await _db.tProjectComponentCostPerYear.AddRangeAsync(ComponentCostPerYear);

        //            //jobCancellationToken.ThrowIfCancellationRequested();
        //            //// ── Major Items Of Work ────────────────────────────────────────
        //            //var MajorItemOfWork = new List<DBHelper.Models.Table.ProjectMajorWorkItem>();
        //            //var MajorWorkLocations = new List<DBHelper.Models.Table.ProjectMajorWorkLocations>();

        //            //foreach (var Item in ValidMajorItemsOfWork.Concat(WarningMajorItemsOfWork))
        //            //{
        //            //    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
        //            //    var ComponentReference = ComponentCost.FirstOrDefault(x => x.ComponentId == Item.ComponentId);

        //            //    if (Reference == null || ComponentReference == null) continue;

        //            //    //var componentDetails = new ImportComponentDetailsExcel();

        //            //    //var queryValidComp = ValidComponentDetails.FirstOrDefault(x => x.ProjectId == Item.ProjectId && x.ComponentId == Item.ComponentId);

        //            //    //if (queryValidComp != null)
        //            //    //{
        //            //    //    componentDetails = queryValidComp;
        //            //    //}
        //            //    //else
        //            //    //{
        //            //    //    componentDetails = WarningComponentDetails.FirstOrDefault(x => x.ProjectId == Item.ProjectId && x.ComponentId == Item.ComponentId);
        //            //    //}

        //            //    var componentDetails = ValidComponentDetails.FirstOrDefault(x => x.ProjectId == Item.ProjectId && x.ComponentId == Item.ComponentId) ?? WarningComponentDetails.FirstOrDefault(x => x.ProjectId == Item.ProjectId && x.ComponentId == Item.ComponentId);

        //            //    if (componentDetails == null) continue;

        //            //    var Validate = _db.SaveMajorItemsOfWork(Item, Reference, componentDetails);

        //            //    Validate.MajorWorkItem.CreatedBy = jobRecord.RequestedBy;
        //            //    Validate.MajorWorkItem.CreatedDate = Functions.CurrentDate();
        //            //    Validate.MajorWorkItem.StageName = IsValidProgram.ProgramDetails.StageName;
        //            //    Validate.MajorWorkItem.ReferenceId = $"{Reference.NewProjectId}-{Validate.MajorWorkItem.ComponentId}";
        //            //    MajorItemOfWork.Add(Validate.MajorWorkItem);

        //            //    Validate.MajorWorkLocation.ParentId = $"{Reference.NewProjectId}-{Validate.MajorWorkItem.ComponentId}";
        //            //    Validate.MajorWorkLocation.CreatedBy = jobRecord.RequestedBy;
        //            //    Validate.MajorWorkLocation.CreatedDate = Functions.CurrentDate();
        //            //    //Validate.MajorWorkLocation.TargetUnitId = Reference.WorkTypeId;
        //            //    Validate.MajorWorkLocation.StageName = IsValidProgram.ProgramDetails.StageName;
        //            //    MajorWorkLocations.Add(Validate.MajorWorkLocation);
        //            //}
        //            //await _db.tProjectMajorWorkItem.AddRangeAsync(MajorItemOfWork);
        //            //await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);

        //            jobCancellationToken.ThrowIfCancellationRequested();
        //            // ── Generate output files ──────────────────────────────
        //            bool hasErrors = ErrorProjectDetails.Any() || ErrorFundingProfile.Any()
        //                          || ErrorComponentDetails.Any() || ErrorMajorItemsOfWork.Any();

        //            //var tempFolder = Path.Combine(_env.WebRootPath, "temp", "imports");
        //            var tempFolder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
        //            Directory.CreateDirectory(tempFolder);

        //            var textFileName = $"ImportReport_{payload.JobId}.txt";
        //            var excelFileName = $"ImportErrors_{payload.JobId}.xlsx";

        //            // Text file
        //            var textBytes = GenerateTextReport(
        //                ValidProjectDetails, ValidFundingProfile, ValidComponentDetails, ValidMajorItemsOfWork,
        //                WarningProjectDetails, WarningFundingProfile, WarningComponentDetails, WarningMajorItemsOfWork);

        //            await File.WriteAllBytesAsync(Path.Combine(tempFolder, textFileName), textBytes, jobCancellationToken.ShutdownToken);

        //            // Excel file (only if errors)
        //            if (hasErrors)
        //            {
        //                var excelBytes = GenerateExcelReport(
        //                    ErrorProjectDetails, ErrorFundingProfile,
        //                    ErrorComponentDetails, ErrorMajorItemsOfWork);

        //                await File.WriteAllBytesAsync(Path.Combine(tempFolder, excelFileName), excelBytes, jobCancellationToken.ShutdownToken);
        //            }

        //            // ── Release lock and commit ────────────────────────────────
        //            await ReleaseLock();
        //            transactionFinalized = true;
        //            await transaction.CommitAsync(jobCancellationToken.ShutdownToken);
        //            //await transaction.CommitAsync();

        //            // ── Update job result AFTER commit ─────────────────────────
        //            jobRecord.Status = hasErrors ? "CompletedWithErrors" : "Completed";
        //            jobRecord.Message = $"Projects imported: {ValidProjectDetails.Count + WarningProjectDetails.Count}.";
        //            jobRecord.ValidCount = ValidProjectDetails.Count + WarningProjectDetails.Count;
        //            jobRecord.WarningCount = WarningProjectDetails.Count;
        //            jobRecord.ErrorCount = ErrorProjectDetails.Count;
        //            jobRecord.TextFileName = textFileName;
        //            jobRecord.ExcelFileName = hasErrors ? excelFileName : string.Empty;
        //            jobRecord.CompletedAt = Functions.CurrentDate();
        //            _db.tImportJobResult.Update(jobRecord);
        //            await _db.SaveChangesAsync(cancellationToken);

        //            // ── Notify: completed ──────────────────────────────────
        //            await _hub.Clients.Group($"import-{payload.JobId}").SendAsync("ImportStatusChanged", new
        //            {
        //                jobRecord.JobId,
        //                jobRecord.Status,
        //                jobRecord.Message,
        //                jobRecord.ValidCount,
        //                jobRecord.WarningCount,
        //                jobRecord.ErrorCount,
        //                jobRecord.CompletedAt,
        //                TextFileUrl = $"/api/Importing/DownloadImportFile?fileName={textFileName}",
        //                ExcelFileUrl = hasErrors ? $"/api/Importing/DownloadImportFile?fileName={excelFileName}" : string.Empty
        //            });
        //        }
        //    }
        //    catch (OperationCanceledException)
        //    {
        //        // ── Hangfire cancelled the job (server shutdown or manual delete) ──
        //        _logger.LogWarning("Import job {JobId} was cancelled", payload.JobId);

        //        if (!transactionFinalized)
        //        {
        //            try { await transaction.RollbackAsync(cancellationToken); }
        //            catch (Exception rbEx) { _logger.LogWarning(rbEx, "Rollback failed for cancelled job {JobId}", payload.JobId); }
        //        }

        //        try
        //        {
        //            jobRecord.Status = "Cancelled";
        //            jobRecord.Message = "Import job was cancelled.";
        //            jobRecord.CompletedAt = Functions.CurrentDate();
        //            _db.tImportJobResult.Update(jobRecord);
        //            await _db.SaveChangesAsync(cancellationToken);

        //            await NotifyClient(payload.JobId, "Cancelled", "Import job was cancelled.");
        //        }
        //        catch (Exception saveEx) { _logger.LogError(saveEx, "Failed to save cancelled status for job {JobId}", payload.JobId); }

        //        await TryReleaseLock();
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Import job {JobId} failed", payload.JobId);

        //        // ── Only rollback if the transaction wasn't already finalized ──
        //        if (!transactionFinalized)
        //        {
        //            try
        //            {
        //                await transaction.RollbackAsync(cancellationToken);
        //            }
        //            catch (Exception rollbackEx)
        //            {
        //                // Transaction may have already been closed by the DB
        //                _logger.LogWarning(rollbackEx, "Rollback failed for job {JobId} — transaction may already be closed", payload.JobId);
        //            }
        //        }

        //        // ── Save failure status outside the dead transaction ───────────
        //        try
        //        {
        //            jobRecord.Status = "Failed";
        //            jobRecord.Message = ex.Message;
        //            jobRecord.CompletedAt = Functions.CurrentDate();
        //            _db.tImportJobResult.Update(jobRecord);
        //            await _db.SaveChangesAsync(cancellationToken);
        //        }
        //        catch (Exception saveEx)
        //        {
        //            _logger.LogError(saveEx, "Failed to save error status for job {JobId}", payload.JobId);
        //        }

        //        await TryReleaseLock();
        //        throw;
        //    }
        //    finally
        //    {
        //        await transaction.DisposeAsync();
        //    }

        //    async Task ReleaseLock()
        //    {
        //        var lockRecord = await _db.tImportingStatus
        //            .FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
        //        if (lockRecord == null) return;
        //        lockRecord.IsActive = false;
        //        _db.tImportingStatus.Update(lockRecord);
        //        await _db.SaveChangesAsync(cancellationToken);
        //    }

        //    // ── Safe version for catch blocks — won't throw ────────────────────
        //    async Task TryReleaseLock()
        //    {
        //        try { await ReleaseLock(); }
        //        catch (Exception ex) { _logger.LogWarning(ex, "Failed to release import lock for job {JobId}", payload.JobId); }
        //    }

        //    async Task FailJob(ImportJobResult record, string message, IDbContextTransaction tx, string jobId)
        //    {
        //        await TryReleaseLock();
        //        //finalized = true;
        //        transactionFinalized = true;
        //        await tx.CommitAsync();

        //        record.Status = "Failed";
        //        record.Message = message;
        //        record.CompletedAt = Functions.CurrentDate();
        //        _db.tImportJobResult.Update(record);
        //        await _db.SaveChangesAsync(cancellationToken);

        //        await NotifyClient(jobId, "Failed", message);
        //    }
        //}

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

        // ── Extract: Finalize Error List logic ────────────────────────────────
        private void FinalizeErrors(
            List<ImportProjectDetailsExcel> validP, List<ImportFundingProfileExcel> validF, List<ImportComponentDetailsExcel> validC, List<ImportMajorItemsOfWorkExcel> validM,
            List<ImportProjectDetailsExcel> warnP, List<ImportFundingProfileExcel> warnF, List<ImportComponentDetailsExcel> warnC, List<ImportMajorItemsOfWorkExcel> warnM,
            List<ImportProjectDetailsExcel> errP, List<ImportFundingProfileExcel> errF, List<ImportComponentDetailsExcel> errC, List<ImportMajorItemsOfWorkExcel> errM)
        {
            void AppendMessage<T>(T item, string message)
            {
                if (message == null) return;
                var prop = item.GetType().GetProperty("ErrorMessage");
                if (prop == null) return;
                var existing = prop.GetValue(item)?.ToString();
                var newMessage = string.IsNullOrWhiteSpace(existing) ? message : $"{existing.TrimEnd('.')}; {message}";
                prop.SetValue(item, newMessage);
            }

            void PropagateErrors<T>(HashSet<string> ids, List<T> err, List<T> valid, List<T> warn, Func<T, string> getId, string msg = null)
            {
                var fv = valid.Where(x => ids.Contains(getId(x))).ToList();
                fv.ForEach(x => AppendMessage(x, msg)); err.AddRange(fv); valid.RemoveAll(x => ids.Contains(getId(x)));
                var fw = warn.Where(x => ids.Contains(getId(x))).ToList();
                fw.ForEach(x => AppendMessage(x, msg)); err.AddRange(fw); warn.RemoveAll(x => ids.Contains(getId(x)));
            }

            void RunCascadeLoop()
            {
                var processedIds = new HashSet<string>();
                bool hasNewErrors = true;
                while (hasNewErrors)
                {
                    var fromP = new HashSet<string>(errP.Select(x => x.ProjectId));
                    var fromF = new HashSet<string>(errF.Select(x => x.ProjectId));
                    var fromC = new HashSet<string>(errC.Select(x => x.ProjectId));
                    var fromM = new HashSet<string>(errM.Select(x => x.ProjectId));
                    var newIds = new HashSet<string>(fromP.Concat(fromF).Concat(fromC).Concat(fromM).Except(processedIds));
                    hasNewErrors = newIds.Count > 0;
                    if (!hasNewErrors) break;

                    void CascadeBySource(HashSet<string> ids, string sheet)
                    {
                        if (!ids.Any()) return;
                        var msg = $"Cascaded error: A related record in [{sheet}] has errors.";
                        PropagateErrors(ids, errP, validP, warnP, x => x.ProjectId, msg);
                        PropagateErrors(ids, errF, validF, warnF, x => x.ProjectId, msg);
                        PropagateErrors(ids, errC, validC, warnC, x => x.ProjectId, msg);
                        PropagateErrors(ids, errM, validM, warnM, x => x.ProjectId, msg);
                    }

                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromP)), "PROJECT DETAILS");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromF)), "FUNDING PROFILE");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromC)), "COMPONENT DETAILS");
                    CascadeBySource(new HashSet<string>(newIds.Intersect(fromM)), "MAJOR ITEMS OF WORK");
                    processedIds.UnionWith(newIds);
                }
            }

            // Step 1 — Initial cascade
            RunCascadeLoop();

            // Step 2 — Detect floating ProjectDetails
            var allChildIds = new HashSet<string>(
                validF.Select(x => x.ProjectId).Concat(warnF.Select(x => x.ProjectId)).Concat(errF.Select(x => x.ProjectId))
                .Concat(validC.Select(x => x.ProjectId)).Concat(warnC.Select(x => x.ProjectId)).Concat(errC.Select(x => x.ProjectId))
                .Concat(validM.Select(x => x.ProjectId)).Concat(warnM.Select(x => x.ProjectId)).Concat(errM.Select(x => x.ProjectId))
            );
            var floatP = new HashSet<string>(validP.Where(x => !allChildIds.Contains(x.ProjectId)).Select(x => x.ProjectId)
                .Concat(warnP.Where(x => !allChildIds.Contains(x.ProjectId)).Select(x => x.ProjectId)));

            // Step 3 — Detect floating child records
            var allValidPIds = new HashSet<string>(validP.Select(x => x.ProjectId).Concat(warnP.Select(x => x.ProjectId)));
            var floatF = new HashSet<string>(validF.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)
                .Concat(warnF.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)));
            var floatC = new HashSet<string>(validC.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)
                .Concat(warnC.Where(x => !allValidPIds.Contains(x.ProjectId)).Select(x => x.ProjectId)));
            var allCompKeys = new HashSet<string>(
                validC.Where(x => allValidPIds.Contains(x.ProjectId)).Select(x => $"{x.ProjectId}|{x.ComponentId}")
                .Concat(warnC.Where(x => allValidPIds.Contains(x.ProjectId)).Select(x => $"{x.ProjectId}|{x.ComponentId}")));
            var floatM = new HashSet<string>(
                validM.Where(x => !allValidPIds.Contains(x.ProjectId) || !allCompKeys.Contains($"{x.ProjectId}|{x.ComponentId}")).Select(x => x.ProjectId)
                .Concat(warnM.Where(x => !allValidPIds.Contains(x.ProjectId) || !allCompKeys.Contains($"{x.ProjectId}|{x.ComponentId}")).Select(x => x.ProjectId)));

            // Step 4 — Move floating to Error
            PropagateErrors(floatP, errP, validP, warnP, x => x.ProjectId, "Floating record: No children found in Funding Profile, Component Details, or Major Items of Work.");
            PropagateErrors(floatF, errF, validF, warnF, x => x.ProjectId, "Floating record: No matching parent found in Project Details.");
            PropagateErrors(floatC, errC, validC, warnC, x => x.ProjectId, "Floating record: No matching parent found in Project Details.");
            PropagateErrors(floatM, errM, validM, warnM, x => x.ProjectId, "Floating record: No matching parent found in Project Details or Component Details.");

            // Step 5 — Final cascade
            RunCascadeLoop();
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

            WriteSection(validP, "--- VALID: PROJECT DETAILS ---", x => $"ProjectId: {x.ProjectId}");
            WriteSection(validF, "--- VALID: FUNDING PROFILE ---", x => $"ProjectId: {x.ProjectId}");
            WriteSection(validC, "--- VALID: COMPONENT DETAILS ---", x => $"ProjectId: {x.ProjectId} | ComponentId: {x.ComponentId}");
            WriteSection(validM, "--- VALID: MAJOR ITEMS OF WORK ---", x => $"ProjectId: {x.ProjectId} | InfrastructureId: {x.InfrastructureId}");

            sb.AppendLine("--- WARNING RECORDS ---");
            sb.AppendLine($"Project Details:      {warnP.Count}");
            sb.AppendLine($"Funding Profile:      {warnF.Count}");
            sb.AppendLine($"Component Details:    {warnC.Count}");
            sb.AppendLine($"Major Items of Work:  {warnM.Count}");
            sb.AppendLine();

            WriteSection(warnP, "--- WARNING: PROJECT DETAILS ---", x => $"ProjectId: {x.ProjectId} | Warning: {x.ErrorMessage}");
            WriteSection(warnF, "--- WARNING: FUNDING PROFILE ---", x => $"ProjectId: {x.ProjectId} | Warning: {x.ErrorMessage}");
            WriteSection(warnC, "--- WARNING: COMPONENT DETAILS ---", x => $"ProjectId: {x.ProjectId} | ComponentId: {x.ComponentId} | Warning: {x.ErrorMessage}");
            WriteSection(warnM, "--- WARNING: MAJOR ITEMS OF WORK ---", x => $"ProjectId: {x.ProjectId} | InfrastructureId: {x.InfrastructureId} | Warning: {x.ErrorMessage}");

            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        // ── Generate Excel report bytes ────────────────────────────────────────
        private byte[] GenerateExcelReport(
            List<ImportProjectDetailsExcel> ErrorProjectDetails,
            List<ImportFundingProfileExcel> ErrorFundingProfile,
            List<ImportComponentDetailsExcel> ErrorComponentDetails,
            List<ImportMajorItemsOfWorkExcel> ErrorMajorItemsOfWork)
        {
            ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
            using var pkg = new ExcelPackage();

            void StyleHeaders(ExcelWorksheet ws, string range, string[] red, string[] blue)
            {
                foreach (var c in red) 
                { 
                    ws.Cells[c].Style.Fill.PatternType = ExcelFillStyle.Solid; 
                    ws.Cells[c].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.Red); 
                }
                foreach (var c in blue) 
                { 
                    ws.Cells[c].Style.Fill.PatternType = ExcelFillStyle.Solid; 
                    ws.Cells[c].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.SkyBlue); 
                }
                ws.Cells[range].Style.Font.Bold = true;
                ws.Cells[range].Style.Font.Color.SetColor(System.Drawing.Color.White);
            }

            // PROJECT DETAILS
            var ws1 = pkg.Workbook.Worksheets.Add("PROJECT DETAILS");
            ws1.Cells["A1"].Value = "Project ID";
            ws1.Cells["B1"].Value = "Multi Year ID";
            ws1.Cells["C1"].Value = "External ID";
            ws1.Cells["D1"].Value = "OA Project Code (UACS)";
            ws1.Cells["E1"].Value = "*Tier";
            ws1.Cells["F1"].Value = "*Category";
            ws1.Cells["G1"].Value = "*Sub-Category";
            ws1.Cells["H1"].Value = "MYCA Approval Date";
            ws1.Cells["I1"].Value = "Description";
            ws1.Cells["J1"].Value = "*Province";
            ws1.Cells["K1"].Value = "*City Municipality";
            ws1.Cells["L1"].Value = "*Legislative District:";
            ws1.Cells["M1"].Value = "*Region";
            ws1.Cells["N1"].Value = "*District Engineering Office";
            ws1.Cells["O1"].Value = "*Implementing Office";
            ws1.Cells["P1"].Value = "Operation Unit";
            ws1.Cells["Q1"].Value = "Region Wide";
            ws1.Cells["R1"].Value = "Origin";
            ws1.Cells["S1"].Value = "Originating Agency";
            ws1.Cells["T1"].Value = "Implementation Mode";
            ws1.Cells["U1"].Value = "Emergency Mode";
            ws1.Cells["V1"].Value = "ROW Available";
            ws1.Cells["W1"].Value = "Feasibility Study";
            ws1.Cells["X1"].Value = "Feasibility Date";
            ws1.Cells["Y1"].Value = "Detailed Design";
            ws1.Cells["Z1"].Value = "Detailed Design Date";
            ws1.Cells["AA1"].Value = "Rank";
            ws1.Cells["AB1"].Value = "Error Msgs";

            StyleHeaders(ws1, "A1:AB1",
                red: ["A1", "E1", "F1", "G1", "I1", "J1", "K1", "L1", "M1", "N1", "O1", "P1", "Q1", "R1", "S1", "T1", "U1", "V1", "W1", "Y1"],
                blue: ["B1", "C1", "D1", "H1", "X1", "Z1", "AA1"]);

            for (int i = 0; i < ErrorProjectDetails.Count; i++)
            {
                ws1.Cells[i + 2, 1].Value = ErrorProjectDetails[i].ProjectId;
                ws1.Cells[i + 2, 2].Value = ErrorProjectDetails[i].MYId;
                ws1.Cells[i + 2, 3].Value = ErrorProjectDetails[i].ExternalId;
                ws1.Cells[i + 2, 4].Value = ErrorProjectDetails[i].UACS;
                ws1.Cells[i + 2, 5].Value = ErrorProjectDetails[i].Tier;
                ws1.Cells[i + 2, 6].Value = ErrorProjectDetails[i].Category;
                ws1.Cells[i + 2, 7].Value = ErrorProjectDetails[i].Thrust;
                ws1.Cells[i + 2, 8].Value = ErrorProjectDetails[i].MYCAApprovalDate;
                ws1.Cells[i + 2, 9].Value = ErrorProjectDetails[i].Description;
                ws1.Cells[i + 2, 10].Value = ErrorProjectDetails[i].Province;
                ws1.Cells[i + 2, 11].Value = ErrorProjectDetails[i].City;
                ws1.Cells[i + 2, 12].Value = ErrorProjectDetails[i].LegislativeDistrict;
                ws1.Cells[i + 2, 13].Value = ErrorProjectDetails[i].Region;
                ws1.Cells[i + 2, 14].Value = ErrorProjectDetails[i].DEO;
                ws1.Cells[i + 2, 15].Value = ErrorProjectDetails[i].ImplementingOffice;
                ws1.Cells[i + 2, 16].Value = ErrorProjectDetails[i].OperatingUnit;
                ws1.Cells[i + 2, 17].Value = ErrorProjectDetails[i].RegionWide;
                ws1.Cells[i + 2, 18].Value = ErrorProjectDetails[i].Origin;
                ws1.Cells[i + 2, 19].Value = ErrorProjectDetails[i].Agency;
                ws1.Cells[i + 2, 20].Value = ErrorProjectDetails[i].ImplementationMode;
                ws1.Cells[i + 2, 21].Value = ErrorProjectDetails[i].EmergencyMode;
                ws1.Cells[i + 2, 22].Value = ErrorProjectDetails[i].RowAvailable;
                ws1.Cells[i + 2, 23].Value = ErrorProjectDetails[i].Feasibility;
                ws1.Cells[i + 2, 24].Value = ErrorProjectDetails[i].FeasibilityDate;
                ws1.Cells[i + 2, 25].Value = ErrorProjectDetails[i].DetailedDesign;
                ws1.Cells[i + 2, 26].Value = ErrorProjectDetails[i].DetailedDesignDate;
                ws1.Cells[i + 2, 27].Value = ErrorProjectDetails[i].Rank;
                ws1.Cells[i + 2, 28].Value = ErrorProjectDetails[i].ErrorMessage;
            }
            ws1.Cells[ws1.Dimension.Address].AutoFitColumns();

            // FUNDING PROFILE
            var ws2 = pkg.Workbook.Worksheets.Add("FUNDING PROFILE");
            ws2.Cells["A1"].Value = "Project ID";
            ws2.Cells["B1"].Value = "Source(s)";
            ws2.Cells["C1"].Value = "Agreement(s)";
            ws2.Cells["D1"].Value = "Amount";
            ws2.Cells["E1"].Value = "Error Msgs";

            StyleHeaders(ws2, "A1:E1",
                red: ["A1", "B1", "C1", "D1"],
                blue: Array.Empty<string>());

            for (int i = 0; i < ErrorFundingProfile.Count; i++)
            {
                ws2.Cells[i + 2, 1].Value = ErrorFundingProfile[i].ProjectId;
                ws2.Cells[i + 2, 2].Value = ErrorFundingProfile[i].Source;
                ws2.Cells[i + 2, 3].Value = ErrorFundingProfile[i].Agreement;
                ws2.Cells[i + 2, 4].Value = ErrorFundingProfile[i].Amount;
                ws2.Cells[i + 2, 5].Value = ErrorFundingProfile[i].ErrorMessage;
            }
            ws2.Cells[ws2.Dimension.Address].AutoFitColumns();

            // COMPONENT DETAILS
            var ws3 = pkg.Workbook.Worksheets.Add("COMPONENT DETAILS");
            ws3.Cells["A1"].Value = "Project ID";
            ws3.Cells["B1"].Value = "Component Type";
            ws3.Cells["C1"].Value = "Component ID";
            ws3.Cells["D1"].Value = "Description";
            ws3.Cells["E1"].Value = "Cost";
            ws3.Cells["F1"].Value = "Planned Start Date";
            ws3.Cells["G1"].Value = "Planned End Date";
            ws3.Cells["H1"].Value = "Infrastructure Type";
            ws3.Cells["I1"].Value = "Type of Work";
            ws3.Cells["J1"].Value = "Activity Year";
            ws3.Cells["K1"].Value = "Error Msgs";

            StyleHeaders(ws3, "A1:K1",
                red: ["A1", "B1", "C1", "E1", "H1", "I1", "J1"],
                blue: ["D1", "F1", "G1"]);

            for (int i = 0; i < ErrorComponentDetails.Count; i++)
            {
                ws3.Cells[i + 2, 1].Value = ErrorComponentDetails[i].ProjectId;
                ws3.Cells[i + 2, 2].Value = ErrorComponentDetails[i].ComponentType;
                ws3.Cells[i + 2, 3].Value = ErrorComponentDetails[i].ComponentId;
                ws3.Cells[i + 2, 4].Value = ErrorComponentDetails[i].Description;
                ws3.Cells[i + 2, 5].Value = ErrorComponentDetails[i].Cost;
                ws3.Cells[i + 2, 6].Value = ErrorComponentDetails[i].StartDate;
                ws3.Cells[i + 2, 7].Value = ErrorComponentDetails[i].EndDate;
                ws3.Cells[i + 2, 8].Value = ErrorComponentDetails[i].InfraType;
                ws3.Cells[i + 2, 9].Value = ErrorComponentDetails[i].WorkTypeId;
                ws3.Cells[i + 2, 10].Value = ErrorComponentDetails[i].ActiveYear;
                ws3.Cells[i + 2, 11].Value = ErrorComponentDetails[i].ErrorMessage;
            }
            ws3.Cells[ws3.Dimension.Address].AutoFitColumns();

            // MAJOR ITEMS OF WORK
            var ws4 = pkg.Workbook.Worksheets.Add("MAJOR ITEMS OF WORK");
            ws4.Cells["A1"].Value = "Project ID";
            ws4.Cells["B1"].Value = "Component ID";
            ws4.Cells["C1"].Value = "Reference ID";
            ws4.Cells["D1"].Value = "Infrastructure ID";
            ws4.Cells["E1"].Value = "Detailed Scope";
            ws4.Cells["F1"].Value = "Target Unit";
            ws4.Cells["G1"].Value = "Start X";
            ws4.Cells["H1"].Value = "Start Y";
            ws4.Cells["I1"].Value = "End X";
            ws4.Cells["J1"].Value = "End Y";
            ws4.Cells["K1"].Value = "Physical Target";
            ws4.Cells["L1"].Value = "Start Station";
            ws4.Cells["M1"].Value = "End Station";
            ws4.Cells["N1"].Value = "Start Chainage (m)";
            ws4.Cells["O1"].Value = "End Chainage (m)";
            ws4.Cells["P1"].Value = "Length (meters)";
            ws4.Cells["Q1"].Value = "Activity Year";
            ws4.Cells["R1"].Value = "Error Msgs";

            StyleHeaders(ws4, "A1:R1",
                red: ["A1", "B1", "C1", "D1", "F1", "G1", "H1", "I1", "J1", "K1"],
                blue: ["E1", "L1", "M1", "N1", "O1", "P1", "Q1"]);

            for (int i = 0; i < ErrorMajorItemsOfWork.Count; i++)
            {
                ws4.Cells[i + 2, 1].Value = ErrorMajorItemsOfWork[i].ProjectId;
                ws4.Cells[i + 2, 2].Value = ErrorMajorItemsOfWork[i].ComponentId;
                ws4.Cells[i + 2, 3].Value = ErrorMajorItemsOfWork[i].ReferenceId;
                ws4.Cells[i + 2, 4].Value = ErrorMajorItemsOfWork[i].InfrastructureId;
                ws4.Cells[i + 2, 5].Value = ErrorMajorItemsOfWork[i].DetailsScope;
                ws4.Cells[i + 2, 6].Value = ErrorMajorItemsOfWork[i].TargetUnit;
                ws4.Cells[i + 2, 7].Value = ErrorMajorItemsOfWork[i].StartX;
                ws4.Cells[i + 2, 8].Value = ErrorMajorItemsOfWork[i].StartY;
                ws4.Cells[i + 2, 9].Value = ErrorMajorItemsOfWork[i].EndX;
                ws4.Cells[i + 2, 10].Value = ErrorMajorItemsOfWork[i].EndY;
                ws4.Cells[i + 2, 11].Value = ErrorMajorItemsOfWork[i].PhysicalTarget;
                ws4.Cells[i + 2, 12].Value = ErrorMajorItemsOfWork[i].StartStation;
                ws4.Cells[i + 2, 13].Value = ErrorMajorItemsOfWork[i].EndStation;
                ws4.Cells[i + 2, 14].Value = ErrorMajorItemsOfWork[i].StartChainage;
                ws4.Cells[i + 2, 15].Value = ErrorMajorItemsOfWork[i].EndChainage;
                ws4.Cells[i + 2, 16].Value = ErrorMajorItemsOfWork[i].Length;
                ws4.Cells[i + 2, 17].Value = ErrorMajorItemsOfWork[i].ActivityYear;
                ws4.Cells[i + 2, 18].Value = ErrorMajorItemsOfWork[i].ErrorMessage;
            }
            ws4.Cells[ws4.Dimension.Address].AutoFitColumns();

            return pkg.GetAsByteArray();
        }

        // ── Read helpers ─────────────────────────────────────────────────────
        private List<ImportProjectDetailsExcel> ReadProjectDetails(ExcelPackage package)
        {
            var result = new List<ImportProjectDetailsExcel>();
            // Sheet name must match exactly what your Excel file uses
            var ws = package.Workbook.Worksheets["PROJECT DETAILS"];
            if (ws == null || ws.Dimension == null) return result;

            // Row 1 = headers, data starts at row 2
            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                // Skip completely empty rows
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text))
                    continue;
                string? mYId = string.IsNullOrWhiteSpace(ws.Cells[row, 2].Text) ? null : ws.Cells[row, 2].Text.Trim();
                string? externalId = string.IsNullOrWhiteSpace(ws.Cells[row, 3].Text) ? null : ws.Cells[row, 3].Text.Trim();
                string? uACS = string.IsNullOrWhiteSpace(ws.Cells[row, 4].Text) ? null : ws.Cells[row, 4].Text.Trim();
                string? mYCAApprovalDate = string.IsNullOrWhiteSpace(ws.Cells[row, 8].Text) ? null : ws.Cells[row, 8].Text.Trim();
                //string? description = string.IsNullOrWhiteSpace(ws.Cells[row, 9].Text) ? null : ws.Cells[row, 9].Text.Trim();
                string? feasibilityDate = string.IsNullOrWhiteSpace(ws.Cells[row, 24].Text) ? null : ws.Cells[row, 24].Text.Trim();
                string? detailedDesignDate = string.IsNullOrWhiteSpace(ws.Cells[row, 26].Text) ? null : ws.Cells[row, 26].Text.Trim();
                string? rank = string.IsNullOrWhiteSpace(ws.Cells[row, 27].Text) ? null : ws.Cells[row, 27].Text.Trim();

                result.Add(new ImportProjectDetailsExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    MYId = mYId, //ws.Cells[row, 2].Text.Trim(),
                    ExternalId = externalId, //ws.Cells[row, 3].Text.Trim(),
                    UACS = uACS, //ws.Cells[row, 4].Text.Trim(),
                    Tier = ws.Cells[row, 5].Text.Trim(),
                    Category = ws.Cells[row, 6].Text.Trim(),
                    Thrust = ws.Cells[row, 7].Text.Trim(),
                    MYCAApprovalDate = mYCAApprovalDate, //ws.Cells[row, 8].Text.Trim(),
                    Description = ws.Cells[row, 9].Text.Trim(),
                    Province = ws.Cells[row, 10].Text.Trim(),
                    City = ws.Cells[row, 11].Text.Trim(),
                    LegislativeDistrict = ws.Cells[row, 12].Text.Trim(),
                    Region = ws.Cells[row, 13].Text.Trim(),
                    DEO = ws.Cells[row, 14].Text.Trim(),
                    ImplementingOffice = ws.Cells[row, 15].Text.Trim(),
                    OperatingUnit = ws.Cells[row, 16].Text.Trim(),
                    RegionWide = ws.Cells[row, 17].Text.Trim(),
                    Origin = ws.Cells[row, 18].Text.Trim(),
                    Agency = ws.Cells[row, 19].Text.Trim(),
                    ImplementationMode = ws.Cells[row, 20].Text.Trim(),
                    EmergencyMode = ws.Cells[row, 21].Text.Trim(),
                    RowAvailable = ws.Cells[row, 22].Text.Trim(),
                    Feasibility = ws.Cells[row, 23].Text.Trim(),
                    FeasibilityDate = feasibilityDate, //ws.Cells[row, 24].Text.Trim(),
                    DetailedDesign = ws.Cells[row, 25].Text.Trim(),
                    DetailedDesignDate = detailedDesignDate, //ws.Cells[row, 26].Text.Trim(),
                    Rank = rank //ws.Cells[row, 27].Text.Trim()
                });
            }
            return result;
        }
        private List<ImportFundingProfileExcel> ReadFundingProfile(ExcelPackage package)
        {
            var result = new List<ImportFundingProfileExcel>();
            var ws = package.Workbook.Worksheets["FUNDING PROFILE"];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;

                result.Add(new ImportFundingProfileExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    Source = ws.Cells[row, 2].Text.Trim(),
                    Agreement = ws.Cells[row, 3].Text.Trim(),
                    Amount = ws.Cells[row, 4].Text.Trim(),
                    Percentage = 0
                });
            }
            return result;
        }
        private List<ImportComponentDetailsExcel> ReadComponentDetails(ExcelPackage package)
        {
            var result = new List<ImportComponentDetailsExcel>();
            var ws = package.Workbook.Worksheets["COMPONENT DETAILS"];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;
                string? startDate = string.IsNullOrWhiteSpace(ws.Cells[row, 6].Text) ? null : ws.Cells[row, 6].Text.Trim();
                string? endDate = string.IsNullOrWhiteSpace(ws.Cells[row, 7].Text) ? null : ws.Cells[row, 7].Text.Trim();
                string? description = string.IsNullOrEmpty(ws.Cells[row, 4].Text) ? null : ws.Cells[row, 4].Text.Trim();

                result.Add(new ImportComponentDetailsExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    ComponentType = ws.Cells[row, 2].Text.Trim(),
                    ComponentId = ws.Cells[row, 3].Text.Trim(),
                    Description = description,
                    Cost = ws.Cells[row, 5].Text.Trim(),
                    StartDate = startDate, //ws.Cells[row, 6].Text.Trim(),
                    EndDate = endDate, //ws.Cells[row, 7].Text.Trim(),
                    InfraType = ws.Cells[row, 8].Text.Trim(),
                    WorkTypeId = ws.Cells[row, 9].Text.Trim(),
                    ActiveYear = ws.Cells[row, 10].Text.Trim()
                });
            }
            return result;
        }
        private List<ImportMajorItemsOfWorkExcel> ReadMajorItemsOfWork(ExcelPackage package)
        {
            var result = new List<ImportMajorItemsOfWorkExcel>();
            var ws = package.Workbook.Worksheets["MAJOR ITEMS OF WORK"];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;
                string? detailsScope = string.IsNullOrWhiteSpace(ws.Cells[row, 5].Text) ? null : ws.Cells[row, 5].Text.Trim();
                string? startX = string.IsNullOrWhiteSpace(ws.Cells[row, 7].Text) ? null : ws.Cells[row, 7].Text.Trim();
                string? startY = string.IsNullOrWhiteSpace(ws.Cells[row, 8].Text) ? null : ws.Cells[row, 8].Text.Trim();
                string? endX = string.IsNullOrWhiteSpace(ws.Cells[row, 9].Text) ? null : ws.Cells[row, 9].Text.Trim();
                string? endY = string.IsNullOrWhiteSpace(ws.Cells[row, 10].Text) ? null : ws.Cells[row, 10].Text.Trim();
                string? startStation = string.IsNullOrWhiteSpace(ws.Cells[row, 12].Text) ? null : ws.Cells[row, 12].Text.Trim();
                string? endStation = string.IsNullOrWhiteSpace(ws.Cells[row, 13].Text) ? null : ws.Cells[row, 13].Text.Trim();
                string? startChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 14].Text) ? null : ws.Cells[row, 14].Text.Trim();
                string? endChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 15].Text) ? null : ws.Cells[row, 15].Text.Trim();
                string? length = string.IsNullOrWhiteSpace(ws.Cells[row, 16].Text) ? null : ws.Cells[row, 16].Text.Trim();
                string? activityYear = string.IsNullOrWhiteSpace(ws.Cells[row, 17].Text) ? null : ws.Cells[row, 17].Text.Trim();
                result.Add(new ImportMajorItemsOfWorkExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    ComponentId = ws.Cells[row, 2].Text.Trim(),
                    ReferenceId = ws.Cells[row, 3].Text.Trim(),
                    InfrastructureId = ws.Cells[row, 4].Text.Trim(),
                    DetailsScope = detailsScope, //ws.Cells[row, 5].Text.Trim(),
                    TargetUnit = ws.Cells[row, 6].Text.Trim(),
                    StartX = startX,
                    StartY = startY,
                    EndX = endX,
                    EndY = endY,
                    PhysicalTarget = ws.Cells[row, 11].Text.Trim(),
                    StartStation = startStation, //ws.Cells[row, 12].Text.Trim(),
                    EndStation = endStation, //ws.Cells[row, 13].Text.Trim(),
                    StartChainage = startChainage,
                    EndChainage = endChainage,
                    Length = length,
                    ActivityYear = activityYear //int.TryParse(ws.Cells[row, 17].Text, out var year) ? year : 0
                });
            }
            return result;
        }
    }
}
