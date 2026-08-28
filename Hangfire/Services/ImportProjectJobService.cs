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

        // ── Fresh import: inserts new projects for a Program+Stage, nothing existing is touched ──
        [AutomaticRetry(Attempts = 0)]
        public Task ProcessImport(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken)
            => RunImportAsync(payload, jobCancellationToken, isUpdate: false);

        // ── Update: soft-deletes the existing project set for this Program+Stage, then inserts the replacement set ──
        [AutomaticRetry(Attempts = 0)]
        public Task ProcessUpdate(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken)
            => RunImportAsync(payload, jobCancellationToken, isUpdate: true);

        // ── Shared core — both entry points funnel through here so fixes/behavior only live in one place ──
        private async Task RunImportAsync(ImportProjectJobPayload payload, IJobCancellationToken jobCancellationToken, bool isUpdate)
        {
            var jobRecord = await _db.tImportJobResult
                .FirstOrDefaultAsync(x => x.JobId == payload.JobId);

            if (jobRecord == null) return;

            // ── Track the uploaded file so we can clean it up regardless of outcome ──
            string? uploadedFilePath = payload.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? null : payload.FileUrl;

            jobRecord.Status = "Processing";
            jobRecord.StartedAt = Functions.CurrentDate();
            _db.tImportJobResult.Update(jobRecord);
            await _db.SaveChangesAsync();

            // ── Notify: processing ────────────────────────────────────────────
            await NotifyClient(payload.JobId, "Processing", "Import job has started processing.");

            // ── Track whether the transaction was already finalized ────────────
            bool transactionFinalized = false;
            var transaction = await _db.Database.BeginTransactionAsync();

            try
            {
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
                    // ── Validate sheets ────────────────────────────────────────
                    var requiredSheets = new[]
                    {
                        "PROJECT DETAILS", "FUNDING PROFILE",
                        "COMPONENT DETAILS", "MAJOR ITEMS OF WORK"
                    };
                    var missingSheets = requiredSheets
                        .Where(s => package.Workbook.Worksheets[s] == null)
                        .ToList();

                    if (missingSheets.Any())
                    {
                        await FailJob(jobRecord, $"Missing sheets: {string.Join(", ", missingSheets)}", transaction, payload.JobId);
                        return;
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Read from Excel ────────────────────────────────────
                    var importDto = new ImportProjectDTOExcel
                    {
                        ProjectDetails = ReadProjectDetails(package),
                        FundingProfile = ReadFundingProfile(package),
                        ComponentDetails = ReadComponentDetails(package),
                        MajorItemsOfWork = ReadMajorItemsOfWork(package)
                    };

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

                    jobCancellationToken.ThrowIfCancellationRequested();
                    foreach (var item in importDto.ProjectDetails)
                    {
                        var r = _db.ValidateProjectDetails(item, cache);
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
                    foreach (var item in importDto.ComponentDetails)
                    {
                        var r = _db.ValidateComponentDetails(item, importDto.ComponentDetails, cache);
                        if (!r.IsValid) ErrorComponentDetails.Add(item);
                        else if (r.IsWarning) WarningComponentDetails.Add(item);
                        else ValidComponentDetails.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    foreach (var item in importDto.MajorItemsOfWork)
                    {
                        var r = _db.ValidateMajorItemsOfWork(item, importDto.ComponentDetails, cache);
                        if (!r.IsValid) ErrorMajorItemsOfWork.Add(item);
                        else if (r.IsWarning) WarningMajorItemsOfWork.Add(item);
                        else ValidMajorItemsOfWork.Add(item);
                    }

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Finalize Error List ────────────────────────────────
                    FinalizeErrors(
                        ValidProjectDetails, ValidFundingProfile, ValidComponentDetails, ValidMajorItemsOfWork,
                        WarningProjectDetails, WarningFundingProfile, WarningComponentDetails, WarningMajorItemsOfWork,
                        ErrorProjectDetails, ErrorFundingProfile, ErrorComponentDetails, ErrorMajorItemsOfWork);

                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Update mode: disregard any ProjectId that doesn't already exist ────
                    // UpdateProject only refreshes existing projects — a ProjectId with no
                    // prior tProjectRevisions match under this Program is dropped from the
                    // run entirely (never created), and matching rows for it in the other
                    // three sheets are dropped too so nothing ends up pointing at a project
                    // that was never saved. Each dropped row is surfaced as an error so it's
                    // visible in the job result rather than silently vanishing.
                    if (isUpdate)
                    {
                        var KnownProjectIds = await _db.tProjectRevisions
                            .Where(x => x.ProgramFK == IsValidProgram.ProgramDetails.ProgramPK)
                            .Select(x => x.AlternateId)
                            .Distinct()
                            .ToListAsync(jobCancellationToken.ShutdownToken);

                        var KnownProjectIdSet = new HashSet<string>(KnownProjectIds, StringComparer.OrdinalIgnoreCase);

                        var DisregardedIds = new HashSet<string>(
                            ValidProjectDetails.Concat(WarningProjectDetails)
                                .Select(x => x.ProjectId)
                                .Where(id => !KnownProjectIdSet.Contains(id)),
                            StringComparer.OrdinalIgnoreCase);

                        if (DisregardedIds.Count > 0)
                        {
                            foreach (var item in ValidProjectDetails.Concat(WarningProjectDetails).Where(x => DisregardedIds.Contains(x.ProjectId)))
                            {
                                item.ErrorMessage = "Update: ProjectId does not exist for this Program and was disregarded.";
                                ErrorProjectDetails.Add(item);
                            }
                            ValidProjectDetails.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));
                            WarningProjectDetails.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));

                            foreach (var item in ValidFundingProfile.Concat(WarningFundingProfile).Where(x => DisregardedIds.Contains(x.ProjectId)))
                            {
                                item.ErrorMessage = "Update: parent ProjectId was disregarded.";
                                ErrorFundingProfile.Add(item);
                            }
                            ValidFundingProfile.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));
                            WarningFundingProfile.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));

                            foreach (var item in ValidComponentDetails.Concat(WarningComponentDetails).Where(x => DisregardedIds.Contains(x.ProjectId)))
                            {
                                item.ErrorMessage = "Update: parent ProjectId was disregarded.";
                                ErrorComponentDetails.Add(item);
                            }
                            ValidComponentDetails.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));
                            WarningComponentDetails.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));

                            foreach (var item in ValidMajorItemsOfWork.Concat(WarningMajorItemsOfWork).Where(x => DisregardedIds.Contains(x.ProjectId)))
                            {
                                item.ErrorMessage = "Update: parent ProjectId was disregarded.";
                                ErrorMajorItemsOfWork.Add(item);
                            }
                            ValidMajorItemsOfWork.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));
                            WarningMajorItemsOfWork.RemoveAll(x => DisregardedIds.Contains(x.ProjectId));
                        }
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
                    // ── Guard: duplicate ProjectId within this same file ────────────────
                    // SaveProjectDetails resolves identity by AlternateId, so two rows sharing
                    // the same ProjectId in one file would make the second row "reuse" the
                    // revision the first row just inserted moments earlier, leaving the first
                    // row's revision active and un-deleted (the scoped soft-delete above only
                    // covers PRIOR data, not duplicates created mid-run). Fail fast instead.
                    var DuplicateProjectIds = ValidProjectDetails.Concat(WarningProjectDetails)
                        .GroupBy(x => x.ProjectId, StringComparer.OrdinalIgnoreCase)
                        .Where(g => g.Count() > 1)
                        .Select(g => g.Key)
                        .ToList();

                    if (DuplicateProjectIds.Count > 0)
                    {
                        throw new InvalidOperationException(
                            $"Duplicate ProjectId(s) found within the import file: {string.Join(", ", DuplicateProjectIds)}. Each ProjectId must appear only once per file.");
                    }

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
                            IsValidProgram.ProgramDetails.ProgramPK,
                            payload.StageName,
                            UpdateProjectIds,
                            jobRecord.RequestedBy,
                            jobCancellationToken.ShutdownToken);
                    }

                    // ── Saving to Database ──────────────────────────────────────────────
                    jobCancellationToken.ThrowIfCancellationRequested();
                    // ── Projects ────────────────────────────────────────────────────────
                    var ProjectReference = new List<ImportProjectReference>();
                    var projects = new List<DBHelper.Models.Table.Project.Projects>();
                    var projectstages = new List<DBHelper.Models.Table.Project.ProjectStages>();

                    foreach (var Item in ValidProjectDetails.Concat(WarningProjectDetails))
                    {
                        var Projects = await _db.SaveProjectDetails(IsValidProgram.ProgramDetails, Item, ProjectReference, jobCancellationToken.ShutdownToken);

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
                                WorkTypeFK = (int)Item.ScopeOfWorkEnum!,
                                InfraTypeFK = Item.InfraTypeInfraCode!
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

                    var textFileName = $"ImportReport_{payload.JobId}.txt";
                    var excelFileName = $"ImportErrors_{payload.JobId}.xlsm";

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
                            ErrorComponentDetails, ErrorMajorItemsOfWork);

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
                    jobRecord.WarningCount = WarningProjectDetails.Count;
                    jobRecord.ErrorCount = ErrorProjectDetails.Count;
                    jobRecord.TextFileName = textFileName;
                    jobRecord.ExcelFileName = hasErrors ? excelFileName : string.Empty;
                    jobRecord.CompletedAt = Functions.CurrentDate();
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

                if (!transactionFinalized)
                {
                    try { await transaction.RollbackAsync(); }
                    catch (Exception rbEx) { _logger.LogWarning(rbEx, "Rollback failed for cancelled job {JobId}", payload.JobId); }
                }

                try
                {
                    jobRecord.Status = "Cancelled";
                    jobRecord.Message = "Import job was cancelled.";
                    jobRecord.CompletedAt = Functions.CurrentDate();
                    _db.tImportJobResult.Update(jobRecord);
                    await _db.SaveChangesAsync();

                    await NotifyClient(payload.JobId, "Cancelled", "Import job was cancelled.");
                }
                catch (Exception saveEx) { _logger.LogError(saveEx, "Failed to save cancelled status for job {JobId}", payload.JobId); }

                await TryReleaseLock();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Import job {JobId} failed", payload.JobId);

                // ── Only rollback if the transaction wasn't already finalized ──
                if (!transactionFinalized)
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
                    jobRecord.Status = "Failed";
                    jobRecord.Message = ex.Message;
                    jobRecord.CompletedAt = Functions.CurrentDate();
                    _db.tImportJobResult.Update(jobRecord);
                    await _db.SaveChangesAsync();
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save error status for job {JobId}", payload.JobId);
                }

                await TryReleaseLock();
                throw;
            }
            finally
            {
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
                    Percentage = 100
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
                string? physicalTarget = string.IsNullOrWhiteSpace(ws.Cells[row, 11].Text) ? null : ws.Cells[row, 11].Text.Trim();
                string? startStation = string.IsNullOrWhiteSpace(ws.Cells[row, 12].Text) ? null : ws.Cells[row, 12].Text.Trim();
                string? endStation = string.IsNullOrWhiteSpace(ws.Cells[row, 13].Text) ? null : ws.Cells[row, 13].Text.Trim();
                string? startChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 14].Text) ? null : ws.Cells[row, 14].Text.Trim();
                string? endChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 15].Text) ? null : ws.Cells[row, 15].Text.Trim();
                string? length = string.IsNullOrWhiteSpace(ws.Cells[row, 16].Text) ? null : ws.Cells[row, 16].Text.Trim();

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
                    PhysicalTarget = physicalTarget,
                    StartStation = startStation,
                    EndStation = endStation,
                    StartChainage = startChainage,
                    EndChainage = endChainage,
                    Length = length,
                    ActivityYear = ws.Cells[row, 17].Text.Trim() //activityYear
                });
            }
            return result;
        }
    }
}