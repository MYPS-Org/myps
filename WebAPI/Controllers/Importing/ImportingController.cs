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
                return new BadRequestObjectResult(new { Message = "File not found or already downloaded.", Title = "File Error." });

            var contentType = safeName.EndsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/plain";

            var bytes = await System.IO.File.ReadAllBytesAsync(filePath, cancellationToken);
            System.IO.File.Delete(filePath); // delete after download
            return File(bytes, contentType, safeName);
        }

        //[HttpPost]
        //public async Task<IActionResult> ImportProject([FromBody] ImportProjectDTO dto)
        //{
        //    var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        string User = _Session.UserId;
        //        DateTime CurrentDate = Functions.CurrentDate();
        //        var rows = await _db.Database.ExecuteSqlInterpolatedAsync($@"
        //        UPDATE dbo.tImportingStatus
        //        SET IsActive = 1,
        //            LastUserIdInUse = {User},
        //            LastUsedDate = {CurrentDate}
        //        WHERE ImportFunctionName = 'ImportProject'
        //          AND IsActive = 0;
        //        ");

        //        if (rows == 0)
        //        {
        //            var holder = await _db.tImportingStatus
        //                .AsNoTracking()
        //                .Where(x => x.ImportFunctionName == "ImportProject")
        //                .Select(x => x.LastUserIdInUse)
        //                .FirstOrDefaultAsync();

        //            return new BadRequestObjectResult(new
        //            {
        //                Title = "Import In Progress",
        //                Message = $"The project import is currently in use by {holder}. Please try again later."
        //            });
        //        }
        //        var FailedProjects = new List<GenerateProjecttResponse>();
        //        var FailedFunding = new List<GenerateFundingProfileResponse>();
        //        var FailedComponent = new List<GenerateComponentCostResponse>();
        //        var FailedComponentCostPerYear = new List<GenerateComponentCostPerYearResponse>();
        //        var FailedMajorItemOfWork = new List<GenerateMajorWorkItemResponse>();
        //        var FailedMajorWorkLocations = new List<GenerateMajorWorkLocationResponse>();
        //        #region Program Validation
        //        var IsValidProgram = _db.IsValidProgramId(dto.ProgramDetails.ProgramId, dto.ProgramDetails.StageName);
        //        if(!IsValidProgram.IsValid)
        //        {
        //            return new BadRequestObjectResult(new { Message = IsValidProgram.Message, Tile = "Validation Error." });
        //        }
        //        #endregion

        //        List<ImportProjectReference> ProjectReference = new List<ImportProjectReference>();
        //        #region Projects
        //        List<DBHelper.Models.Table.Projects> projects = new List<DBHelper.Models.Table.Projects>();
        //        //List<DBHelper.Models.Table.ProjectRevisions> projectrevisions = new List<DBHelper.Models.Table.ProjectRevisions>();
        //        List<DBHelper.Models.Table.ProjectStages> projectstages = new List<DBHelper.Models.Table.ProjectStages>();
        //        foreach (var Item in dto.ProjectDetails)
        //        {
        //            var Projects = _db.GenerateProject(IsValidProgram.ProgramDetails, Item, ProjectReference);
        //            if (!Projects.IsValid)
        //            {
        //                FailedProjects.Add(Projects);
        //                continue;
        //            }
        //            Projects.Project.CreatedBy = User;
        //            Projects.Project.CreatedDate = CurrentDate;

        //            Projects.ProjectRevision.CreatedBy = User;
        //            Projects.ProjectRevision.CreatedDate = CurrentDate;

        //            ProjectReference.Add(Projects.ImportReference);
        //            projects.Add(Projects.Project);

        //            _db.tProjectRevisions.Add(Projects.ProjectRevision);
        //            _db.SaveChanges();

        //            Projects.ProjectStage.RevisionId = Projects.ProjectRevision.Id;
        //            Projects.ProjectStage.CreatedBy = User;
        //            Projects.ProjectStage.CreatedDate = CurrentDate;

        //            projectstages.Add(Projects.ProjectStage);
        //        }
        //        await _db.tProjects.AddRangeAsync(projects);
        //        await _db.tProjectStages.AddRangeAsync(projectstages);
        //        #endregion

        //        #region Funding Profile
        //        List<DBHelper.Models.Table.ProjectFundingProfile> FundingProfile = new List<DBHelper.Models.Table.ProjectFundingProfile>();
        //        foreach (var Item in dto.FundingProfile)
        //        {
        //            var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
        //            if (Reference != null)
        //            {
        //                var Validate = _db.GenerateFundingProfile(Item, Reference);
        //                if(!Validate.IsValid)
        //                {
        //                    //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Funding Profile Validation Error." });
        //                    FailedFunding.Add(Validate);
        //                    continue;
        //                }
        //                Validate.FundingProfile.CreatedBy = User;
        //                Validate.FundingProfile.CreatedDate = CurrentDate;
        //                Validate.FundingProfile.StageName = IsValidProgram.ProgramDetails.StageName;
        //                FundingProfile.Add(Validate.FundingProfile);
        //            }
        //        }
        //        await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);
        //        #endregion

        //        #region Component Cost
        //        List<DBHelper.Models.Table.ProjectComponentCost> ComponentCost = new List<DBHelper.Models.Table.ProjectComponentCost>();
        //        foreach(var Item in dto.ComponentCosts)
        //        {
        //            var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
        //            if (Reference != null)
        //            {
        //                var Validate = _db.GenerateComponentCost(Item, Reference);
        //                if (!Validate.IsValid)
        //                {
        //                    //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Validation Error." });
        //                    FailedComponent.Add(Validate);
        //                    continue;
        //                }
        //                Validate.ComponentCost.CreatedBy = User;
        //                Validate.ComponentCost.CreatedDate = CurrentDate;
        //                Validate.ComponentCost.StageName = IsValidProgram.ProgramDetails.StageName;
        //                Validate.ComponentCost.CostId = $"{Validate.ComponentCost.ProjectId}-{Validate.ComponentCost.ComponentId}";
        //                ComponentCost.Add(Validate.ComponentCost);
        //            }
        //        }
        //        await _db.tProjectComponentCost.AddRangeAsync(ComponentCost);
        //        #endregion

        //        #region Component Cost Per Year
        //        List<DBHelper.Models.Table.ProjectComponentCostPerYear> ComponentCostPerYear = new List<DBHelper.Models.Table.ProjectComponentCostPerYear>();
        //        foreach (var Item in dto.ComponentCostPerYear)
        //        {
        //            var OldReference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ComponentCostId.Split("-")[0]);
        //            var Reference = ComponentCost.FirstOrDefault(x => x.ProjectId == OldReference.NewProjectId);
        //            if (Reference != null)
        //            {
        //                var Validate = _db.GenerateComponentCostPerYear(Item);
        //                if (!Validate.IsValid)
        //                {
        //                    //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Per Year Validation Error." });
        //                    FailedComponentCostPerYear.Add(Validate);
        //                    continue;
        //                }
        //                Validate.ComponentCostPerYear.CreatedBy = User;
        //                Validate.ComponentCostPerYear.CreatedDate = CurrentDate;
        //                Validate.ComponentCostPerYear.StageName = IsValidProgram.ProgramDetails.StageName;
        //                Validate.ComponentCostPerYear.ComponentCostId = $"{Reference.ProjectId}-{Reference.ComponentId}";
        //                ComponentCostPerYear.Add(Validate.ComponentCostPerYear);
        //            }
        //        }
        //        await _db.tProjectComponentCostPerYear.AddRangeAsync(ComponentCostPerYear);
        //        #endregion

        //        #region MajorItemOfWork
        //        List<DBHelper.Models.Table.ProjectMajorWorkItem> MajorItemOfWork = new List<DBHelper.Models.Table.ProjectMajorWorkItem>();
        //        foreach (var Item in dto.MajorItemOfWorks)
        //        {
        //            var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
        //            var ComponentReference = ComponentCost.FirstOrDefault(x => x.ComponentId == Item.ComponentId);
        //            if (Reference != null && ComponentReference != null)
        //            {
        //                var Validate = _db.GenerateMajorWorkItem(Item, Reference);
        //                if (!Validate.IsValid)
        //                {
        //                    //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Item Of Work Validation Error." });
        //                    FailedMajorItemOfWork.Add(Validate);
        //                    continue;
        //                }
        //                Validate.MajorWorkItem.CreatedBy = User;
        //                Validate.MajorWorkItem.CreatedDate = CurrentDate;
        //                Validate.MajorWorkItem.StageName = IsValidProgram.ProgramDetails.StageName;
        //                Validate.MajorWorkItem.ReferenceId = $"{Reference.NewProjectId}-{Validate.MajorWorkItem.ComponentId}";
        //                MajorItemOfWork.Add(Validate.MajorWorkItem);
        //            }
        //        }
        //        await _db.tProjectMajorWorkItem.AddRangeAsync(MajorItemOfWork);
        //        #endregion

        //        #region MajorWorkLocations
        //        List<DBHelper.Models.Table.ProjectMajorWorkLocations> MajorWorkLocations = new List<DBHelper.Models.Table.ProjectMajorWorkLocations>();
        //        foreach (var Item in dto.MajorItemLocations)
        //        {
        //            var OldReference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ParentId.Split("-")[0]);
        //            var Reference = MajorItemOfWork.FirstOrDefault(x => x.ProjectId == OldReference.NewProjectId);
        //            if (Reference != null)
        //            {
        //                var Validate = _db.GenerateMajorWorkLocation(Item);
        //                if (!Validate.IsValid)
        //                {
        //                    //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Work Locations Validation Error." });
        //                    FailedMajorWorkLocations.Add(Validate);
        //                    continue;
        //                }
        //                Validate.MajorWorkLocation.ParentId = $"{Reference.ProjectId}-{Reference.ComponentId}";
        //                Validate.MajorWorkLocation.CreatedBy = User;
        //                Validate.MajorWorkLocation.CreatedDate = CurrentDate;
        //                Validate.MajorWorkLocation.TargetUnitId = Reference.WorkTypeId;
        //                Validate.MajorWorkLocation.StageName = IsValidProgram.ProgramDetails.StageName;
        //                MajorWorkLocations.Add(Validate.MajorWorkLocation);
        //            }
        //        }
        //        await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);
        //        foreach (var entry in _db.ChangeTracker.Entries())
        //        {
        //            if (entry.State is not (EntityState.Added or EntityState.Modified))
        //                continue;

        //            var entityType = entry.Metadata;

        //            var tableName = entityType.GetTableName();
        //            var schema = entityType.GetSchema();

        //            var storeObject = StoreObjectIdentifier.Table(tableName!, schema);

        //            foreach (var prop in entry.Properties)
        //            {
        //                if (prop.CurrentValue is DateTime dt && dt < new DateTime(1753, 1, 1))
        //                {
        //                    var columnName = prop.Metadata.GetColumnName(storeObject);

        //                    throw new Exception(
        //                        $"Invalid datetime detected. " +
        //                        $"Table: {schema}.{tableName}, " +
        //                        $"Column: {columnName}, " +
        //                        $"Property: {prop.Metadata.Name}, " +
        //                        $"Value: {dt:O}"
        //                    );
        //                }
        //            }
        //        }
        //        #endregion


        //        var CheckStatus = await _db.tImportingStatus.FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
        //        CheckStatus.IsActive = false;
        //        _db.tImportingStatus.Update(CheckStatus);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();

        //        bool hasErrors = FailedProjects.Count > 0
        //            || FailedFunding.Count > 0
        //            || FailedComponent.Count > 0
        //            || FailedComponentCostPerYear.Count > 0
        //            || FailedMajorItemOfWork.Count > 0
        //            || FailedMajorWorkLocations.Count > 0;

        //        if (hasErrors)
        //        {
        //            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        //            using var package = new ExcelPackage();

        //            if (FailedProjects.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Project");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ProjectId";
        //                ws.Cells["C1"].Value = "Description";
        //                ws.Cells["D1"].Value = "Category";
        //                ws.Cells["E1"].Value = "City";
        //                ws.Cells["F1"].Value = "Province";
        //                for (int i = 0; i < FailedProjects.Count; i++)
        //                {
        //                    var item = FailedProjects[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.ProjectRevision.ProjectId;
        //                    ws.Cells[i + 2, 3].Value = item.ProjectRevision.Description;
        //                    ws.Cells[i + 2, 4].Value = item.ProjectRevision.Category;
        //                    ws.Cells[i + 2, 5].Value = item.ProjectRevision.City;
        //                    ws.Cells[i + 2, 6].Value = item.ProjectRevision.Province;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            if (FailedFunding.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Funding Profile");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ProjectId";
        //                ws.Cells["C1"].Value = "Source";
        //                ws.Cells["D1"].Value = "Agreement";
        //                ws.Cells["E1"].Value = "Amount";
        //                ws.Cells["F1"].Value = "Percentage";
        //                for (int i = 0; i < FailedFunding.Count; i++)
        //                {
        //                    var item = FailedFunding[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.FundingProfile.ProjectId;
        //                    ws.Cells[i + 2, 3].Value = item.FundingProfile.Source;
        //                    ws.Cells[i + 2, 4].Value = item.FundingProfile.Agreement;
        //                    ws.Cells[i + 2, 5].Value = item.FundingProfile.Amount;
        //                    ws.Cells[i + 2, 6].Value = item.FundingProfile.Percentage;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            if (FailedComponent.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Component");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ProjectId";
        //                ws.Cells["C1"].Value = "CostId";
        //                ws.Cells["D1"].Value = "ComponentType";
        //                ws.Cells["E1"].Value = "ComponentId";
        //                ws.Cells["F1"].Value = "Description";
        //                ws.Cells["G1"].Value = "Total";
        //                for (int i = 0; i < FailedComponent.Count; i++)
        //                {
        //                    var item = FailedComponent[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.ComponentCost.ProjectId;
        //                    ws.Cells[i + 2, 3].Value = item.ComponentCost.CostId;
        //                    ws.Cells[i + 2, 4].Value = item.ComponentCost.ComponentType;
        //                    ws.Cells[i + 2, 5].Value = item.ComponentCost.ComponentId;
        //                    ws.Cells[i + 2, 6].Value = item.ComponentCost.Description;
        //                    ws.Cells[i + 2, 7].Value = item.ComponentCost.Total;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            if (FailedComponentCostPerYear.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Component Per Cost");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ComponentCostId";
        //                ws.Cells["C1"].Value = "Amount";
        //                ws.Cells["D1"].Value = "Year";
        //                for (int i = 0; i < FailedComponentCostPerYear.Count; i++)
        //                {
        //                    var item = FailedComponentCostPerYear[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.ComponentCostPerYear.ComponentCostId;
        //                    ws.Cells[i + 2, 3].Value = item.ComponentCostPerYear.Amount;
        //                    ws.Cells[i + 2, 4].Value = item.ComponentCostPerYear.Year;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            if (FailedMajorItemOfWork.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Major Work Item");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ProjectId";
        //                ws.Cells["C1"].Value = "ReferenceId";
        //                ws.Cells["D1"].Value = "ComponentId";
        //                ws.Cells["E1"].Value = "YearOfWork";
        //                ws.Cells["F1"].Value = "WorkTypeId";
        //                ws.Cells["G1"].Value = "InfraType";
        //                for (int i = 0; i < FailedMajorItemOfWork.Count; i++)
        //                {
        //                    var item = FailedMajorItemOfWork[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.MajorWorkItem.ProjectId;
        //                    ws.Cells[i + 2, 3].Value = item.MajorWorkItem.ReferenceId;
        //                    ws.Cells[i + 2, 4].Value = item.MajorWorkItem.ComponentId;
        //                    ws.Cells[i + 2, 5].Value = item.MajorWorkItem.YearOfWork;
        //                    ws.Cells[i + 2, 6].Value = item.MajorWorkItem.WorkTypeId;
        //                    ws.Cells[i + 2, 7].Value = item.MajorWorkItem.InfraType;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            if (FailedMajorWorkLocations.Count > 0)
        //            {
        //                var ws = package.Workbook.Worksheets.Add("Major Work Location");
        //                ws.Cells["A1"].Value = "Message";
        //                ws.Cells["B1"].Value = "ParentId";
        //                ws.Cells["C1"].Value = "InfraId";
        //                ws.Cells["D1"].Value = "DetailedScope";
        //                ws.Cells["E1"].Value = "PhysicalTarget";
        //                ws.Cells["F1"].Value = "TargetUnit";
        //                ws.Cells["G1"].Value = "Length";
        //                for (int i = 0; i < FailedMajorWorkLocations.Count; i++)
        //                {
        //                    var item = FailedMajorWorkLocations[i];
        //                    ws.Cells[i + 2, 1].Value = item.Message;
        //                    ws.Cells[i + 2, 2].Value = item.MajorWorkLocation.ParentId;
        //                    ws.Cells[i + 2, 3].Value = item.MajorWorkLocation.InfraId;
        //                    ws.Cells[i + 2, 4].Value = item.MajorWorkLocation.DetailedScope;
        //                    ws.Cells[i + 2, 5].Value = item.MajorWorkLocation.PhysicalTarget;
        //                    ws.Cells[i + 2, 6].Value = item.MajorWorkLocation.TargetUnit;
        //                    ws.Cells[i + 2, 7].Value = item.MajorWorkLocation.Length;
        //                }
        //                ws.Cells[ws.Dimension.Address].AutoFitColumns();
        //            }

        //            var fileBytes = package.GetAsByteArray();
        //            var base64 = Convert.ToBase64String(fileBytes);

        //            return Ok(new
        //            {
        //                Message = $"Projects imported: {projects.Count}. Some records failed validation.",
        //                Title = "Project Imported with Errors",
        //                FileName = "FailedImportRecords.xlsx",
        //                FileContent = base64,
        //                ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        //            });
        //        }

        //        return Ok(new { Message = $"Projects imported: {projects.Count}.", Title = "Project Imported Successfully" });

        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
    }
}



//using Confluent.Kafka;
//using Dapper;
//using DBHelper.Data;
//using DBHelper.Models.Enums;
//using DBHelper.Models.Table.Project;
//using DBHelper.Models.Views;
//using Helpers;
//using JetBrains.Annotations;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Components.Endpoints;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.EntityFrameworkCore;
//using Microsoft.EntityFrameworkCore.Metadata;
//using Microsoft.EntityFrameworkCore.Metadata.Internal;
//using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
//using Microsoft.Extensions.DependencyInjection;
//using Newtonsoft.Json;
//using OfficeOpenXml;
//using System.Data.SqlClient;
//using System.Linq;
//using System.Reflection;
//using System.Text.RegularExpressions;
//using System.Xml;
//using WebAPI.Controllers.Projects;
//using static System.Net.WebRequestMethods;
//using static WebAPI.Controllers.Importing.ImportingHelper;
//namespace WebAPI.Controllers.Importing
//{
//    [ApiController]
//    [Route("api/[controller]/[action]")]
//    public class ImportingController : CoreController
//    {
//        public ImportingController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma) : base(db, hub, pcma) { }

//        [HttpPost]
//        public async Task<IActionResult> ImportProject([FromBody] ImportProjectDTO dto, CancellationToken cancellationToken)
//        {
//            var transaction = await _db.Database.BeginTransactionAsync();
//            try
//            {
//                string User = _Session.UserId;
//                DateTime CurrentDate = Functions.CurrentDate();
//                var rows = await _db.Database.ExecuteSqlInterpolatedAsync($@"
//                UPDATE dbo.tImportingStatus
//                SET IsActive = 1,
//                    LastUserIdInUse = {User},
//                    LastUsedDate = {CurrentDate}
//                WHERE ImportFunctionName = 'ImportProject'
//                  AND IsActive = 0;
//                ");

//                if (rows == 0)
//                {
//                    var holder = await _db.tImportingStatus
//                        .AsNoTracking()
//                        .Where(x => x.ImportFunctionName == "ImportProject")
//                        .Select(x => x.LastUserIdInUse)
//                        .FirstOrDefaultAsync();

//                    return new BadRequestObjectResult(new
//                    {
//                        Title = "Import In Progress",
//                        Message = $"The project import is currently in use by {holder}. Please try again later."
//                    });
//                }
//                var FailedProjects = new List<GenerateProjecttResponse>();
//                var FailedFunding = new List<GenerateFundingProfileResponse>();
//                var FailedComponent = new List<GenerateComponentCostResponse>();
//                var FailedComponentCostPerYear = new List<GenerateComponentCostPerYearResponse>();
//                var FailedMajorItemOfWork = new List<GenerateMajorWorkItemResponse>();
//                var FailedMajorWorkLocations = new List<GenerateMajorWorkLocationResponse>();
//                #region Program Validation
//                var IsValidProgram = _db.IsValidProgramId(dto.ProgramDetails.ProgramId, dto.ProgramDetails.StageName);
//                if(!IsValidProgram.IsValid)
//                {
//                    return new BadRequestObjectResult(new { Message = IsValidProgram.Message, Tile = "Validation Error." });
//                }
//                #endregion

//                List<ImportProjectReference> ProjectReference = new List<ImportProjectReference>();
//                #region Projects
//                List<DBHelper.Models.Table.Project.Projects> projects = new List<DBHelper.Models.Table.Project.Projects>();
//                //List<DBHelper.Models.Table.ProjectRevisions> projectrevisions = new List<DBHelper.Models.Table.ProjectRevisions>();
//                List<ProjectStages> projectstages = new List<ProjectStages>();
//                foreach (var Item in dto.ProjectDetails)
//                {
//                    var Projects = _db.GenerateProject(IsValidProgram.ProgramDetails, Item, ProjectReference);
//                    if (!Projects.IsValid)
//                    {
//                        FailedProjects.Add(Projects);
//                        continue;
//                    }
//                    Projects.Project.CreatedBy = User;
//                    Projects.Project.CreatedDate = CurrentDate;

//                    Projects.ProjectRevision.CreatedBy = User;
//                    Projects.ProjectRevision.CreatedDate = CurrentDate;

//                    ProjectReference.Add(Projects.ImportReference);
//                    projects.Add(Projects.Project);

//                    _db.tProjectRevisions.Add(Projects.ProjectRevision);
//                    _db.SaveChanges();

//                    Projects.ProjectStage.RevisionId = Projects.ProjectRevision.Id;
//                    Projects.ProjectStage.CreatedBy = User;
//                    Projects.ProjectStage.CreatedDate = CurrentDate;

//                    projectstages.Add(Projects.ProjectStage);
//                }
//                await _db.tProjects.AddRangeAsync(projects);
//                await _db.tProjectStages.AddRangeAsync(projectstages);
//                #endregion

//                #region Funding Profile
//                List<ProjectFundingProfile> FundingProfile = new List<ProjectFundingProfile>();
//                foreach (var Item in dto.FundingProfile)
//                {
//                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
//                    if (Reference != null)
//                    {
//                        var Validate = _db.GenerateFundingProfile(Item, Reference);
//                        if(!Validate.IsValid)
//                        {
//                            //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Funding Profile Validation Error." });
//                            FailedFunding.Add(Validate);
//                            continue;
//                        }
//                        Validate.FundingProfile.CreatedBy = User;
//                        Validate.FundingProfile.CreatedDate = CurrentDate;
//                        Validate.FundingProfile.StageName = IsValidProgram.ProgramDetails.StageName;
//                        FundingProfile.Add(Validate.FundingProfile);
//                    }
//                }
//                await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);
//                #endregion

//                #region Component Cost
//                List<ProjectComponentCost> ComponentCost = new List<ProjectComponentCost>();
//                foreach(var Item in dto.ComponentCosts)
//                {
//                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
//                    if (Reference != null)
//                    {
//                        var Validate = _db.GenerateComponentCost(Item, Reference);
//                        if (!Validate.IsValid)
//                        {
//                            //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Validation Error." });
//                            FailedComponent.Add(Validate);
//                            continue;
//                        }
//                        Validate.ComponentCost.CreatedBy = User;
//                        Validate.ComponentCost.CreatedDate = CurrentDate;
//                        Validate.ComponentCost.StageName = IsValidProgram.ProgramDetails.StageName;
//                        Validate.ComponentCost.CostId = $"{Validate.ComponentCost.ProjectId}-{Validate.ComponentCost.ComponentId}";
//                        ComponentCost.Add(Validate.ComponentCost);
//                    }
//                }
//                await _db.tProjectComponentCost.AddRangeAsync(ComponentCost);
//                #endregion

//                #region Component Cost Per Year
//                List<ProjectComponentCostPerYear> ComponentCostPerYear = new List<ProjectComponentCostPerYear>();
//                foreach (var Item in dto.ComponentCostPerYear)
//                {
//                    var OldReference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ComponentCostId.Split("-")[0]);
//                    var Reference = ComponentCost.FirstOrDefault(x => x.ProjectId == OldReference.NewProjectId);
//                    if (Reference != null)
//                    {
//                        var Validate = _db.GenerateComponentCostPerYear(Item);
//                        if (!Validate.IsValid)
//                        {
//                            //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Per Year Validation Error." });
//                            FailedComponentCostPerYear.Add(Validate);
//                            continue;
//                        }
//                        Validate.ComponentCostPerYear.CreatedBy = User;
//                        Validate.ComponentCostPerYear.CreatedDate = CurrentDate;
//                        Validate.ComponentCostPerYear.StageName = IsValidProgram.ProgramDetails.StageName;
//                        Validate.ComponentCostPerYear.ComponentCostId = $"{Reference.ProjectId}-{Reference.ComponentId}";
//                        ComponentCostPerYear.Add(Validate.ComponentCostPerYear);
//                    }
//                }
//                await _db.tProjectComponentCostPerYear.AddRangeAsync(ComponentCostPerYear);
//                #endregion

//                #region MajorItemOfWork
//                List<ProjectMajorWorkItem> MajorItemOfWork = new List<ProjectMajorWorkItem>();
//                foreach (var Item in dto.MajorItemOfWorks)
//                {
//                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
//                    var ComponentReference = ComponentCost.FirstOrDefault(x => x.ComponentId == Item.ComponentId);
//                    if (Reference != null && ComponentReference != null)
//                    {
//                        var Validate = _db.GenerateMajorWorkItem(Item, Reference);
//                        if (!Validate.IsValid)
//                        {
//                            //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Item Of Work Validation Error." });
//                            FailedMajorItemOfWork.Add(Validate);
//                            continue;
//                        }
//                        Validate.MajorWorkItem.CreatedBy = User;
//                        Validate.MajorWorkItem.CreatedDate = CurrentDate;
//                        Validate.MajorWorkItem.StageName = IsValidProgram.ProgramDetails.StageName;
//                        Validate.MajorWorkItem.ReferenceId = $"{Reference.NewProjectId}-{Validate.MajorWorkItem.ComponentId}";
//                        MajorItemOfWork.Add(Validate.MajorWorkItem);
//                    }
//                }
//                await _db.tProjectMajorWorkItem.AddRangeAsync(MajorItemOfWork);
//                #endregion

//                #region MajorWorkLocations
//                List<ProjectMajorWorkLocations> MajorWorkLocations = new List<ProjectMajorWorkLocations>();
//                foreach (var Item in dto.MajorItemLocations)
//                {
//                    var OldReference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ParentId.Split("-")[0]);
//                    var Reference = MajorItemOfWork.FirstOrDefault(x => x.ProjectId == OldReference.NewProjectId);
//                    if (Reference != null)
//                    {
//                        var Validate = _db.GenerateMajorWorkLocation(Item);
//                        if (!Validate.IsValid)
//                        {
//                            //return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Work Locations Validation Error." });
//                            FailedMajorWorkLocations.Add(Validate);
//                            continue;
//                        }
//                        Validate.MajorWorkLocation.ParentId = $"{Reference.ProjectId}-{Reference.ComponentId}";
//                        Validate.MajorWorkLocation.CreatedBy = User;
//                        Validate.MajorWorkLocation.CreatedDate = CurrentDate;
//                        Validate.MajorWorkLocation.TargetUnitId = Reference.WorkTypeId;
//                        Validate.MajorWorkLocation.StageName = IsValidProgram.ProgramDetails.StageName;
//                        MajorWorkLocations.Add(Validate.MajorWorkLocation);
//                    }
//                }
//                await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);
//                foreach (var entry in _db.ChangeTracker.Entries())
//                {
//                    if (entry.State is not (EntityState.Added or EntityState.Modified))
//                        continue;

//                    var entityType = entry.Metadata;

//                    var tableName = entityType.GetTableName();
//                    var schema = entityType.GetSchema();

//                    var storeObject = StoreObjectIdentifier.Table(tableName!, schema);

//                    foreach (var prop in entry.Properties)
//                    {
//                        if (prop.CurrentValue is DateTime dt && dt < new DateTime(1753, 1, 1))
//                        {
//                            var columnName = prop.Metadata.GetColumnName(storeObject);

//                            throw new Exception(
//                                $"Invalid datetime detected. " +
//                                $"Table: {schema}.{tableName}, " +
//                                $"Column: {columnName}, " +
//                                $"Property: {prop.Metadata.Name}, " +
//                                $"Value: {dt:O}"
//                            );
//                        }
//                    }
//                }
//                #endregion


//                var CheckStatus = await _db.tImportingStatus.FirstOrDefaultAsync(x => x.ImportFunctionName == "ImportProject");
//                CheckStatus.IsActive = false;
//                _db.tImportingStatus.Update(CheckStatus);
//                await _db.SaveChangesAsync(cancellationToken);
//                await transaction.CommitAsync();

//                bool hasErrors = FailedProjects.Count > 0
//                    || FailedFunding.Count > 0
//                    || FailedComponent.Count > 0
//                    || FailedComponentCostPerYear.Count > 0
//                    || FailedMajorItemOfWork.Count > 0
//                    || FailedMajorWorkLocations.Count > 0;

//                if (hasErrors)
//                {
//                    ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
//                    using var package = new ExcelPackage();

//                    if (FailedProjects.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Project");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ProjectId";
//                        ws.Cells["C1"].Value = "Description";
//                        ws.Cells["D1"].Value = "Category";
//                        ws.Cells["E1"].Value = "City";
//                        ws.Cells["F1"].Value = "Province";
//                        for (int i = 0; i < FailedProjects.Count; i++)
//                        {
//                            var item = FailedProjects[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.ProjectRevision.ProjectId;
//                            ws.Cells[i + 2, 3].Value = item.ProjectRevision.Description;
//                            ws.Cells[i + 2, 4].Value = item.ProjectRevision.Category;
//                            ws.Cells[i + 2, 5].Value = item.ProjectRevision.City;
//                            ws.Cells[i + 2, 6].Value = item.ProjectRevision.Province;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    if (FailedFunding.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Funding Profile");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ProjectId";
//                        ws.Cells["C1"].Value = "Source";
//                        ws.Cells["D1"].Value = "Agreement";
//                        ws.Cells["E1"].Value = "Amount";
//                        ws.Cells["F1"].Value = "Percentage";
//                        for (int i = 0; i < FailedFunding.Count; i++)
//                        {
//                            var item = FailedFunding[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.FundingProfile.ProjectId;
//                            ws.Cells[i + 2, 3].Value = item.FundingProfile.Source;
//                            ws.Cells[i + 2, 4].Value = item.FundingProfile.Agreement;
//                            ws.Cells[i + 2, 5].Value = item.FundingProfile.Amount;
//                            ws.Cells[i + 2, 6].Value = item.FundingProfile.Percentage;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    if (FailedComponent.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Component");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ProjectId";
//                        ws.Cells["C1"].Value = "CostId";
//                        ws.Cells["D1"].Value = "ComponentType";
//                        ws.Cells["E1"].Value = "ComponentId";
//                        ws.Cells["F1"].Value = "Description";
//                        ws.Cells["G1"].Value = "Total";
//                        for (int i = 0; i < FailedComponent.Count; i++)
//                        {
//                            var item = FailedComponent[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.ComponentCost.ProjectId;
//                            ws.Cells[i + 2, 3].Value = item.ComponentCost.CostId;
//                            ws.Cells[i + 2, 4].Value = item.ComponentCost.ComponentType;
//                            ws.Cells[i + 2, 5].Value = item.ComponentCost.ComponentId;
//                            ws.Cells[i + 2, 6].Value = item.ComponentCost.Description;
//                            ws.Cells[i + 2, 7].Value = item.ComponentCost.Total;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    if (FailedComponentCostPerYear.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Component Per Cost");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ComponentCostId";
//                        ws.Cells["C1"].Value = "Amount";
//                        ws.Cells["D1"].Value = "Year";
//                        for (int i = 0; i < FailedComponentCostPerYear.Count; i++)
//                        {
//                            var item = FailedComponentCostPerYear[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.ComponentCostPerYear.ComponentCostId;
//                            ws.Cells[i + 2, 3].Value = item.ComponentCostPerYear.Amount;
//                            ws.Cells[i + 2, 4].Value = item.ComponentCostPerYear.Year;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    if (FailedMajorItemOfWork.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Major Work Item");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ProjectId";
//                        ws.Cells["C1"].Value = "ReferenceId";
//                        ws.Cells["D1"].Value = "ComponentId";
//                        ws.Cells["E1"].Value = "YearOfWork";
//                        ws.Cells["F1"].Value = "WorkTypeId";
//                        ws.Cells["G1"].Value = "InfraType";
//                        for (int i = 0; i < FailedMajorItemOfWork.Count; i++)
//                        {
//                            var item = FailedMajorItemOfWork[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.MajorWorkItem.ProjectId;
//                            ws.Cells[i + 2, 3].Value = item.MajorWorkItem.ReferenceId;
//                            ws.Cells[i + 2, 4].Value = item.MajorWorkItem.ComponentId;
//                            ws.Cells[i + 2, 5].Value = item.MajorWorkItem.YearOfWork;
//                            ws.Cells[i + 2, 6].Value = item.MajorWorkItem.WorkTypeId;
//                            ws.Cells[i + 2, 7].Value = item.MajorWorkItem.InfraType;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    if (FailedMajorWorkLocations.Count > 0)
//                    {
//                        var ws = package.Workbook.Worksheets.Add("Major Work Location");
//                        ws.Cells["A1"].Value = "Message";
//                        ws.Cells["B1"].Value = "ParentId";
//                        ws.Cells["C1"].Value = "InfraId";
//                        ws.Cells["D1"].Value = "DetailedScope";
//                        ws.Cells["E1"].Value = "PhysicalTarget";
//                        ws.Cells["F1"].Value = "TargetUnit";
//                        ws.Cells["G1"].Value = "Length";
//                        for (int i = 0; i < FailedMajorWorkLocations.Count; i++)
//                        {
//                            var item = FailedMajorWorkLocations[i];
//                            ws.Cells[i + 2, 1].Value = item.Message;
//                            ws.Cells[i + 2, 2].Value = item.MajorWorkLocation.ParentId;
//                            ws.Cells[i + 2, 3].Value = item.MajorWorkLocation.InfraId;
//                            ws.Cells[i + 2, 4].Value = item.MajorWorkLocation.DetailedScope;
//                            ws.Cells[i + 2, 5].Value = item.MajorWorkLocation.PhysicalTarget;
//                            ws.Cells[i + 2, 6].Value = item.MajorWorkLocation.TargetUnit;
//                            ws.Cells[i + 2, 7].Value = item.MajorWorkLocation.Length;
//                        }
//                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
//                    }

//                    var fileBytes = package.GetAsByteArray();
//                    var base64 = Convert.ToBase64String(fileBytes);

//                    return Ok(new
//                    {
//                        Message = $"Projects imported: {projects.Count}. Some records failed validation.",
//                        Title = "Project Imported with Errors",
//                        FileName = "FailedImportRecords.xlsx",
//                        FileContent = base64,
//                        ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//                    });
//                }

//                return Ok(new { Message = $"Projects imported: {projects.Count}.", Title = "Project Imported Successfully" });

//            }
//            catch (Exception ex)
//            {
//                await transaction.RollbackAsync(cancellationToken);
//                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
//            }
//        }
//    }
//}