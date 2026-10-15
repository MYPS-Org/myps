using DBHelper.Models.Table.Project;
using Hangfire.Importing;
using Helpers;
using static Helpers.ProjectHelper;
using static Hangfire.Importing.ImportingHelper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore.Storage;
using OfficeOpenXml;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// The itemization import — a whole workbook of itemized projects created
    /// under one Lump Sum Project in a single transaction.
    ///
    /// IN V2 THIS IS THE ONLY ITEMIZATION PATH A USER CAN REACH. Mode 2 (pick an
    /// existing project) is cut from the frontend, so the workbook pipeline is
    /// not one option among several — it is the feature.
    ///
    /// THE WORKBOOK IS THE REQUEST. The file that arrives is the one Download
    /// Template hands out, filled in — the same file the Program-level import
    /// takes — and it is read, gated and validated by the Importing module's own
    /// code (ImportWorkbookReader, ImportingHelper's four validators,
    /// ImportStructuralRules), never by a copy. A rejection comes back as the
    /// same annotated .xlsm the Program import produces, served by the same
    /// DownloadImportFile endpoint. See LumpsumController.Import.Validation.cs
    /// for the little policy that sits around those shared rules.
    ///
    /// WHY NOT ROWS PARSED IN THE BROWSER. That was the earlier design, and it
    /// discarded Target Unit, per-row Infrastructure/Work Type and the cells'
    /// own text before the server saw them, so a third of the rules could only
    /// be fed fabricated values. An adapter for it was built once and reverted.
    ///
    /// NAMES, NOT CODES. The location columns must carry the names the template's
    /// dropdowns emit. Earlier resolvers here accepted participant ids and PSGC
    /// codes as well; that acceptance is gone by decision (2026-09-05), and a
    /// code-filled workbook is refused by the validators as an unrecognised
    /// name. Do not reintroduce it as a "fix".
    ///
    /// Every accepted row becomes a real tProjects row with its revision, stage,
    /// funding profile, component costs, per-year rows and major items of work;
    /// each child's cost is deducted from the parent's 'LS' component, which is
    /// what makes Remaining fall. Nothing is written unless the whole workbook
    /// passes, and all of it rolls back whole on any failure after that.
    /// </summary>
    public partial class LumpsumController
    {
        /*  A filled template is well under 5 MB even with its macros; the cap only
            exists so an unrelated upload cannot tie the request thread up. */
        private const long ImportWorkbookMaxBytes = 10L * 1024 * 1024;

        [HttpPost]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(ImportWorkbookMaxBytes)]
        public async Task<IActionResult> ImportItemizedProjects([FromForm] ImportItemizedProjectsFormDTO dto, CancellationToken cancellationToken)
        {
            IDbContextTransaction? transaction = null;
            bool Stamped = false;
            /*  Declared out here for the same reason as the two above: the
                ProjectIdRangeExhausted catch names the category that blocked the
                batch and counts the rows in it, and a local scoped to the try is
                not visible from a catch. */
            LumpSumImportVerdict? Verdict = null;
            /*  Hoisted with it (review, 2026-09-10): the annotated error workbook is
                written BEFORE the write loop, so a refusal raised inside the loop has
                to hand back the file that already exists on disk, as every other
                batch-level refusal in this method does. */
            string? ErrorFileName = null;
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                if (dto.File == null || dto.File.Length == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "No workbook was supplied to import.",
                        Title = "Nothing to Import"
                    });
                }

                /*  THE PARENT IS A LUMP SUM PROJECT, not a wallet row. */
                var LSProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.ParentLumpSumId, cancellationToken);

                if (LSProject == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.ParentLumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                var ImportDenied = await AssertLumpSumVisibleAsync(dto.ParentLumpSumId, cancellationToken);
                if (ImportDenied != null) return ImportDenied;

                /*  NO PROGRAM-APPROVAL GATE HERE (rule revised 2026-09-09). Itemizing
                    an Approved GAA-R program is the work that stage exists for, so
                    approval does not reach this action — only CreateLumpSum
                    (AssertProgramNotApprovedAsync) and DeleteLumpSum (the deletion
                    rule's own Approved refusal). */

                if (!RevisionStages.Contains(LSProject.StageName ?? string.Empty))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Itemization is only available at {string.Join(" or ", RevisionStages)}. This Lump Sum Project is at '{LSProject.StageName}'.",
                        Title = "Stage Not Reached"
                    });
                }

                /*  THE PARENT IS LOCKED FROM HERE TO THE END (2026-09-06).

                    Everything above was a cheap gate on a snapshot. From this point
                    the import depends on the parent's state — its Remaining for the
                    overdraw check, its UACS for every child — so the parent is held
                    for the rest of the request. Two layers (see .Locking.cs):

                    1. The visible stamp, written in autocommit BEFORE the transaction
                       so other users' screens can see it while the workbook is being
                       parsed and validated. A fresh stamp left by someone else is
                       refused here, cheaply, before the file is even opened.

                    2. The application lock, owned by the transaction, which is the
                       actual guarantee. The transaction is opened here rather than at
                       the write step so that the lock covers the READ of Remaining
                       below; under READ COMMITTED the validation that follows holds no
                       row locks, so opening it early costs nothing but the applock
                       itself — which is the point.

                    LSProject is then RE-READ under the lock: the snapshot above may be
                    seconds stale by the time a concurrent save released the lock. */
                var OtherStamp = await ReadFreshStampAsync(dto.ParentLumpSumId, cancellationToken);
                if (OtherStamp != null)
                {
                    return BusyResult(
                        $"{LSProject.ProjectId} is being itemized by {OtherStamp.LockedBy} since {OtherStamp.LockedDate:HH:mm}. Try again shortly.");
                }

                await StampLumpSumAsync(dto.ParentLumpSumId, UserId, CurrentDate, cancellationToken);
                Stamped = true;

                transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                var Busy = await AcquireLumpSumLockAsync(dto.ParentLumpSumId, cancellationToken);
                if (Busy != null) return Busy;

                LSProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.ParentLumpSumId, cancellationToken)
                    ?? LSProject;

                /*  Same EAO refusal ItemizeProject made - see EAOComponentSuffix
                    for why the spec's EAO branch is deliberately not built. */
                bool ImportParentHasEAO = await _db.tProjectComponentCost
                    .AnyAsync(x => x.ProjectRevisionFK == LSProject.RevisionId
                                && !x.IsDeleted
                                && x.ComponentId.EndsWith(EAOComponentSuffix), cancellationToken);

                if (ImportParentHasEAO)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"{LSProject.ProjectId} carries an EAO component, which a Lump Sum Project should not have. Remove it before itemizing.",
                        Title = "Malformed Lump Sum Project"
                    });
                }

                var Program = await _db.tPrograms
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProgramPK == LSProject.ProgramFK && !x.IsDeleted, cancellationToken);

                if (Program == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Program '{LSProject.ProgramFK}' was not found.",
                        Title = "Not Found"
                    });
                }

                /*  THE PARENT'S stage, not the program's newest one. An
                    itemized child has to land at the same stage its allocation
                    lives at; taking whichever stage row happened to have the
                    highest Id could attach the batch to a stage the Lump Sum
                    Project is not at. This is also why the Program importer's
                    IsValidProgramId gate is not applied: it insists on the latest. */
                var ProgramStage = await _db.tProgramStages
                    .AsNoTracking()
                    .Where(x => x.ProgramFK == Program.ProgramPK && x.StageName == LSProject.StageName)
                    .OrderByDescending(x => x.Id)
                    .FirstOrDefaultAsync(cancellationToken);

                if (ProgramStage == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The parent program has no '{LSProject.StageName}' stage row to attach these projects to.",
                        Title = "No Program Stage"
                    });
                }

                /*  ProgramId is inherited from the parent; the caller's copy is a
                    cross-check, so a batch posted against the wrong parent is refused
                    rather than silently re-homed. */
                if (!string.Equals(dto.ProgramId, Program.ProgramPK, StringComparison.OrdinalIgnoreCase))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"ProgramId '{dto.ProgramId}' does not match the parent's program '{Program.ProgramPK}'.",
                        Title = "Program Mismatch"
                    });
                }

                // ── The file gates, in the Program importer's order and words ──────────
                using var stream = new MemoryStream();
                await dto.File.CopyToAsync(stream, cancellationToken);
                stream.Position = 0;
                using var package = new ExcelPackage(stream);

                if (!ImportWorkbookReader.HasSystemMarker(package))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = ImportWorkbookReader.MissingMarkerMessage,
                        Title = "Not an Import Workbook"
                    });
                }

                var MissingSheets = ImportWorkbookReader.MissingSheets(package);
                if (MissingSheets.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Missing sheets: {string.Join(", ", MissingSheets)}",
                        Title = "Missing Sheets"
                    });
                }

                var HeaderMismatches = ImportWorkbookReader.ValidateAllHeaders(package);
                if (HeaderMismatches.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The uploaded file's column layout does not match the expected import template. Please use the downloaded template without reordering, inserting, or deleting columns. Details: {string.Join("; ", HeaderMismatches)}",
                        Title = "Unexpected Column Layout"
                    });
                }

                var Rows = ImportWorkbookReader.ReadAll(package);

                if (Rows.ProjectDetails.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The PROJECT DETAILS sheet has no rows to import.",
                        Title = "Nothing to Import"
                    });
                }

                // ── Validate everything, then decide ───────────────────────────────────
                var Cache = await ImportLookupCache.LoadAsync(_db);
                Verdict = await ValidateImportedWorkbookAsync(Rows, Cache, Program.ProgramPK, Program.StartYear, cancellationToken);

                /*  PER-PROJECT ATOMICITY (2026-09-06). A project that failed — on any sheet,
                    the cascade having pulled its other rows after it — is written to the
                    error workbook and left out. The projects that passed are imported. The
                    request is refused outright only when nothing passed: then the
                    workbook is the problem, and the old all-or-nothing answer is the
                    honest one. */
                ErrorFileName = Verdict.HasErrors
                    ? await WriteImportErrorWorkbookAsync(Cache, Verdict, LSProject.ProjectId, Program.StartYear, CurrentDate, cancellationToken)
                    : null;

                if (Verdict.AcceptedProjectCount == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"{Verdict.ErrorRowCount} row(s) failed validation, so nothing was imported. Download the annotated workbook, correct the marked cells, and upload it again.",
                        Title = "Import Rejected",
                        Errors = Verdict.Errors,
                        ErrorFileName
                    });
                }

                /*  THE CEILING, on COMPONENT COST rather than funding.

                    2.6.8 reduces the allocation "by the total amount of the
                    Projects imported", and what a project costs is its component
                    cost. Summed from the rows that are going to be WRITTEN — the
                    accepted projects only; a refused project draws nothing — and
                    from the validated values: the validator rewrote each Cost as a
                    parsed decimal's string, which is what Save* parses back.

                    The accepted set is still one batch: "If the LS Components do not
                    have sufficient remaining allocation to perform the deduction, the
                    Import shall be cancelled with an appropriate warning." Both
                    refusals carry the error workbook, if one was written, so a user
                    whose upload was stopped here still sees why the other projects
                    would not have gone in either. */
                decimal Available = LSProject.Remaining;
                decimal BatchTotal = Verdict.ComponentDetails.Sum(c => decimal.Parse(c.Cost));

                if (BatchTotal <= 0m)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "None of the accepted projects in this import has a component cost, so there is nothing to itemize.",
                        Title = "Nothing to Itemize",
                        Errors = Verdict.Errors,
                        ErrorFileName
                    });
                }

                if (BatchTotal > Available)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The {Verdict.AcceptedProjectCount} accepted project(s) total {BatchTotal:N2} but only {Available:N2} remains on {LSProject.ProjectId}.",
                        Title = "Insufficient Balance",
                        Errors = Verdict.Errors,
                        ErrorFileName
                    });
                }

                // ── Write ──────────────────────────────────────────────────────────────
                /*  The transaction was opened, and the parent locked, before the
                    parent was read — see the lock block above. Nothing to open here. */
                var CreatedIds = new List<string>();
                var CreatedByPlaceholder = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                foreach (var Details in Verdict.ProjectDetails)
                {
                    /*  THE CHILD'S ISLAND CODE COMES FROM ITS REGION, NOT FROM THE
                        PARENT. Only the Lump Sum Project itself ends in 'LS'; an
                        itemized child is an ordinary project with a geographic ID.
                        ValidateProjectDetails has already refused a row with no
                        resolvable Region, so RegionIslandCode is set here. */
                    string ProjectPK = await _db.GenerateProjectID(new GenerateProjectIDParams
                    {
                        CategoryId = (int)Details.CategoryCategoryId!,
                        StageName = ProgramStage.StageName,
                        IslandCode = Details.RegionIslandCode!,
                        YearStart = Program.StartYear
                    }, cancellationToken);

                    // Fully qualified: WebAPI.Controllers.Projects (the sibling
                    // controller namespace) shadows the entity type name here.
                    var Project = new DBHelper.Models.Table.Project.Projects
                    {
                        ProgramFK = Program.ProgramPK,
                        ProjectPK = ProjectPK,
                        ProgramId = ProgramStage.ProgramId,
                        /*  The child has ordinary project details and a geographic
                            ID. ProjectType plus ParentProjectId — not an ID suffix —
                            identify its Lump Sum membership. */
                        ProjectType = "LS",
                        ParentProjectId = LSProject.ProjectId,
                        ItemizationType = ItemizationTypeItemized,
                        ProjectStatus = ProjectStatusPotential,
                        MYId = Details.MYId,
                        ExternalId = Details.ExternalId,
                        IsPublished = false,
                        IsRevised = false,
                        IsPublishable = true,
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    };
                    await _db.tProjects.AddAsync(Project, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);

                    /*  Resolved codes, stamped by ValidateProjectDetails. The same
                        fields, the same casts, as ImportingHelper.SaveProjectDetails
                        writes for a Program import — only the Lump Sum identity
                        columns differ. */
                    var Revision = new ProjectRevisions
                    {
                        ProjectFK = ProjectPK,
                        ProgramFK = Program.ProgramPK,
                        ProgramId = ProgramStage.ProgramId,
                        ProjectId = ProjectPK,
                        /*  THE PARENT'S PROJECT ID, by business rule (2026-09-05): an itemized
                            child's Alternate ID names the Lump Sum Project it was carved from,
                            so the link reads on the revision as well as on
                            tProjects.ParentProjectId. The workbook's placeholder Project ID is
                            NOT kept — it was only ever the key that tied the four sheets
                            together, and the validators have already used it for that.

                            Known consequence: the Program importer resolves identity through
                            AlternateId (ProjectIdentityResolver), so every child of one parent
                            now shares an AlternateId and that value resolves as AMBIGUOUS there.
                            Intended — a Program import must not be able to match, retain or
                            update an itemized child by posting the parent's ID as a row. */
                        AlternateId = LSProject.ProjectId,
                        MYCAApprovalDate = string.IsNullOrWhiteSpace(Details.MYCAApprovalDate) ? null : DateTime.TryParse(Details.MYCAApprovalDate, out _) ? Details.MYCAApprovalDate.StringToDate() : null,
                        Description = Details.Description,
                        Category = (int)Details.CategoryCategoryId!,
                        Thrust = Details.ThrustPAPKey,
                        Origin = (int)Details.OriginNameId!,
                        City = Details.CityCode!,
                        Province = Details.ProvinceCode!,
                        LegislativeDistrict = Details.LDCode!,
                        OperatingUnit = Details.OperatingUnitParticipantId!,
                        ImplementingOffice = Details.ImplementingOfficeParticipantId!,
                        DEO = Details.DeoParticipantId!,
                        Region = Details.RegionParticipantId!,
                        Agency = (int)Details.AgencyNameId!,
                        ImplementationMode = Details.ImplementationModeNameId,
                        EmergencyMode = Details.EmergencyModeNameId,
                        IslandCode = Details.RegionIslandCode!,
                        Feasibility = Details.FeasibilityNameId,
                        FeasibilityDate = string.IsNullOrWhiteSpace(Details.FeasibilityDate) ? null : DateTime.TryParse(Details.FeasibilityDate, out _) ? Details.FeasibilityDate.StringToDate() : null,
                        DetailedDesign = Details.DetailedDesignNameId,
                        DetailedDesignDate = string.IsNullOrWhiteSpace(Details.DetailedDesignDate) ? null : DateTime.TryParse(Details.DetailedDesignDate, out _) ? Details.DetailedDesignDate.StringToDate() : null,
                        RowAvailable = Details.RowAvailableNameId,
                        RegionWide = (int)Details.RegionWideNameId!,
                        Tier = (int)Details.TierNameId!,
                        Rank = string.IsNullOrWhiteSpace(Details.Rank) ? null : double.TryParse(Details.Rank, out var rank) ? rank : null,
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate,
                        IsDeleted = false
                    };
                    await _db.tProjectRevisions.AddAsync(Revision, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);

                    await _db.tProjectStages.AddAsync(new ProjectStages
                    {
                        ProjectFK = ProjectPK,
                        ProgramFK = Program.ProgramPK,
                        ProgramId = ProgramStage.ProgramId,
                        RevisionId = Revision.Id,
                        StageId = ProgramStage.StageId,
                        StageName = ProgramStage.StageName,
                        CreatedBy = UserId,
                        CreatedDate = CurrentDate
                    }, cancellationToken);

                    /*  UACS IS INHERITED, NOT CHECKED. 2.6.8: "The UACS code for the
                        itemized Project shall be the same as the UACS code for Lump
                        Sum Project." The parent's UACS is copied onto every child's
                        per-year rows, which makes them equal by construction; the
                        workbook's own UACS column is accepted and ignored. */
                    var Reference = new ImportProjectReference
                    {
                        OldProjectFK = Details.ProjectId,
                        NewProjectFK = ProjectPK,
                        NewProjectId = Revision.Id,
                        UACS = LSProject.UACS
                    };

                    WriteDrawLines(Verdict.FundingProfile.Where(x => x.ProjectId == Details.ProjectId).ToList(), Reference, UserId, CurrentDate);
                    var ComponentReferences = WriteComponentCosts(Verdict.ComponentDetails.Where(x => x.ProjectId == Details.ProjectId).ToList(), Reference, Cache, UserId, CurrentDate);
                    WriteMajorItems(Verdict.MajorItemsOfWork.Where(x => x.ProjectId == Details.ProjectId).ToList(), ComponentReferences, UserId, CurrentDate);

                    await _db.SaveChangesAsync(cancellationToken);
                    CreatedIds.Add(ProjectPK);

                    /*  The workbook's placeholder id against the real one. Only the warning
                        report uses it: its whole purpose is "go and fix this project", and a
                        placeholder ("TMPWARN1") names a row in a file the user may no longer
                        have, while the generated id is what the Projects module answers to. */
                    CreatedByPlaceholder[Details.ProjectId ?? string.Empty] = ProjectPK;
                }

                /*  THE DEDUCTION. 2.6.8: "reduce the cost of the allocation in the
                    Lump Sum Project by the total amount of the Projects imported",
                    then "add a note to the LS project saying 'Cost reduced due to
                    itemizations'".

                    Deducted once, for the batch, from the same component
                    ItemizeProject drew on — and read back from the DB rather than
                    trusting BatchTotal, so what leaves the allocation is what was
                    actually written. */
                decimal ImportedTotal = await _db.tProjectComponentCost
                    .Where(cc => _db.tProjectRevisions
                                    .Where(pr => CreatedIds.Contains(pr.ProjectFK) && !pr.IsDeleted)
                                    .Select(pr => pr.Id)
                                    .Contains(cc.ProjectRevisionFK)
                             && !cc.IsDeleted)
                    .SumAsync(cc => (decimal?)cc.Total, cancellationToken) ?? 0m;

                if (ImportedTotal > 0m)
                {
                    var ImportLSComponent = await _db.FindLSComponentAsync(LSProject.RevisionId, cancellationToken);

                    if (ImportLSComponent == null)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{LSProject.ProjectId} has no Lump Sum component to draw from.",
                            Title = "No Allocation"
                        });
                    }

                    /*  Re-checked against what was WRITTEN, not against the batch
                        total validated on the way in. 2.6.8 is explicit that an
                        import which cannot be covered is cancelled outright, and
                        between the two checks the stored costs are the authority. */
                    if (ImportedTotal > LSProject.Remaining)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The imported projects cost {ImportedTotal:N2}, more than the {LSProject.Remaining:N2} remaining on {LSProject.ProjectId}.",
                            Title = "Insufficient Balance"
                        });
                    }

                    /*  BALANCE ONLY. The children drew from what is LEFT; the allocation the
                        parent was given does not change. See LumpsumHelper's model note. */
                    await _db.MoveLSBalanceAsync(ImportLSComponent, -ImportedTotal, UserId, CurrentDate, cancellationToken);

                    await AddProjectNoteAsync(LSProject.RevisionId,
                        "Cost reduced due to itemizations", UserId, CurrentDate, cancellationToken);

                    await _db.SaveChangesAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);

                var Created = await _db.vLumpSumChildSet
                    .AsNoTracking()
                    .Where(x => CreatedIds.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                /*  THE WARNING REPORT IS WRITTEN AFTER THE COMMIT, deliberately: a rolled-back
                    import must not leave a report describing rows that do not exist. It is the
                    durable half of the warning channel — Warnings[] below is shown once, in the
                    dialog, and is gone on the next refresh, while some of these warnings mean a
                    value was dropped to NULL and only the report will still say so tomorrow. */
                string? ReportFileName = Verdict.WarningRowCount > 0
                    ? await WriteImportWarningReportAsync(Verdict, LSProject.ProjectId, LSProject.ProgramId, CreatedIds.Count, CreatedByPlaceholder, CurrentDate, cancellationToken)
                    : null;

                /*  ONE BODY, BOTH HALVES — the Program importer's shape. Refused projects
                    travel with their error workbook, warned rows with their report, and
                    the counts say how the workbook split. A 200 with Errors[] is not a
                    contradiction: the errors are about projects that were left out, the
                    200 is about the ones that went in. */
                int Refused = Verdict.RefusedProjectCount;
                var MessageParts = new List<string>
                {
                    $"{CreatedIds.Count} itemized project(s) imported, {ImportedTotal:N2} drawn from {LSProject.ProjectId}."
                };
                if (Refused > 0)
                    MessageParts.Add($"{Refused} project(s) refused and left out — see the error workbook.");
                if (Verdict.WarningRowCount > 0)
                    MessageParts.Add($"{Verdict.WarningRowCount} row(s) imported with warnings — see the report.");

                return Ok(new
                {
                    Projects = Created,
                    Count = CreatedIds.Count,
                    Itemized = ImportedTotal,
                    Notices = Verdict.Notices,
                    Warnings = Verdict.Warnings,
                    WarningCount = Verdict.WarningRowCount,
                    ReportFileName,
                    Errors = Verdict.Errors,
                    ErrorFileName,
                    RefusedCount = Refused,
                    Message = string.Join(" ", MessageParts),
                    Title = Refused > 0 ? "Imported with Exceptions" : "Import Complete"
                });
            }
            /*  THE BATCH IS REFUSED WHOLE WHEN THE IDs RUN OUT (2026-09-10).

                A category's Project ID range being used up is an ADMINISTRATIVE
                condition, not a row error: the workbook is correct, and no cell in it
                can be corrected to get past this. So it is not written to the error
                workbook as a refused row the way a validation failure is — the whole
                batch rolls back, and the same file is imported again once an
                administrator has widened the range.

                Rolling back is also what keeps the allocator honest. It advances the
                sequence and THEN raises, so a path that committed the projects around
                the failure would leave the counter past its own maximum, once per
                refused row. (The Program importer disregards such rows instead — it is
                an asynchronous job spanning many programs, where refusing everything
                would be the worse trade. This is one synchronous batch against one
                parent.)

                It sits above the generic handler below, which C# also insists on
                (CS0160), so the ordering cannot silently rot. The parent's stamp is
                cleared by the finally, as on every path. */
            catch (ProjectIdRangeExhaustedException ex)
            {
                if (transaction != null) await SafeRollbackAsync(transaction, cancellationToken);

                /*  The canonical name, not the cell text (review, 2026-09-10): the
                    validator matched the sheet's category by name case-insensitively
                    and never wrote the stored spelling back, so echoing the cell would
                    echo whatever the user typed. One keyed read, on the refusal path.

                    And the honest scope: the allocator keeps one sequence per
                    (category, stage, island, year), so what ran out is ONE of this
                    category's sequences — the exception carries only the category,
                    so the count below is the accepted rows in that category, which is
                    an upper bound on the rows that would have been blocked. */
                string CategoryName = await _db.tOptionProjectCategory
                    .AsNoTracking()
                    .Where(c => c.CategoryId == ex.CategoryId)
                    .Select(c => c.CategoryName)
                    .FirstOrDefaultAsync(cancellationToken)
                    ?? $"#{ex.CategoryId}";

                int InCategory = Verdict?.ProjectDetails.Count(x => x.CategoryCategoryId == ex.CategoryId) ?? 0;
                int Accepted = Verdict?.AcceptedProjectCount ?? 0;

                _logger.LogWarning(
                    "Project ID range exhausted on ImportItemizedProjects: category {CategoryId} ({CategoryName}), parent {ParentLumpSumId}, "
                    + "{InCategory} of {Accepted} accepted row(s) in that category, user {UserId}. {Detail}",
                    ex.CategoryId, CategoryName, dto.ParentLumpSumId, InCategory, Accepted, _Session.UserId, ex.Message);

                return new BadRequestObjectResult(new
                {
                    Message = $"Nothing was imported. Category {CategoryName} ({ex.CategoryId}) has run out of Project IDs "
                            + "for at least one of its ID ranges (a range is kept per category, stage, island and year), "
                            + $"and {InCategory} of the {Accepted} accepted project(s) belong to that category. Ask an "
                            + "administrator to widen the range, then import the same workbook again.",
                    Title = "Project ID Range Exhausted",
                    /*  The same two members every batch-level refusal in this method
                        carries, so the Errors tab opens on the rows that failed
                        validation and the annotated workbook written before the loop
                        is reachable rather than orphaned on disk. */
                    Errors = Verdict?.Errors ?? new List<string>(),
                    ErrorFileName
                });
            }
            catch (Exception ex)
            {
                /*  SAFE ROLLBACK, the same as every other Lump Sum mutator. Work runs
                    AFTER CommitAsync inside this try — the created-children read-back,
                    the warning report, the response — so a failure there arrives here
                    with the transaction already committed. A bare RollbackAsync then
                    throws "This SqlTransaction has completed" FROM THE CATCH, which
                    masks the real exception and turns an import that actually
                    committed into an unhandled 500. SafeRollbackAsync rolls back only
                    while the transaction still has a connection. */
                if (transaction != null) await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, new { dto.ParentLumpSumId, dto.ProgramId, FileName = dto.File?.FileName }, _Session.UserId.ToString());
            }
            finally
            {
                /*  Declared outside the try so the catch can roll it back, which is why it
                    is not a `using`; disposed here on every path — committed, rolled back,
                    or never opened. Disposing also releases the application lock. */
                if (transaction != null) await transaction.DisposeAsync();

                /*  The visible stamp goes AFTER the transaction is gone, through a
                    tracker-free UPDATE (see .Locking.cs for why not SaveChanges), and
                    only if this request set it — a refusal for someone else's fresh
                    stamp must not wipe theirs. */
                if (Stamped) await ClearLumpSumStampAsync(dto.ParentLumpSumId, _Session.UserId);
            }
        }

        /// <summary>
        /// The annotated workbook for a rejected import — the Importing module's own
        /// builder, written where its DownloadImportFile already serves from.
        /// </summary>
        private async Task<string> WriteImportErrorWorkbookAsync(
            ImportLookupCache cache,
            LumpSumImportVerdict verdict,
            string parentProjectId,
            int programStartYear,
            DateTime now,
            CancellationToken cancellationToken)
        {
            var bytes = ImportErrorWorkbookBuilder.Build(
                cache,
                verdict.ErrorProjectDetails, verdict.ErrorFundingProfile,
                verdict.ErrorComponentDetails, verdict.ErrorMajorItemsOfWork,
                programStartYear);

            var folder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
            Directory.CreateDirectory(folder);

            var fileName = $"LumpSumImportErrors_{ImportFileNaming.SanitizeForFileName(parentProjectId)}_{ImportFileNaming.BuildFileSuffix(Guid.NewGuid().ToString("N"), now)}.xlsm";
            // System.IO.File, spelled out: ControllerBase.File(...) shadows it inside a controller.
            await System.IO.File.WriteAllBytesAsync(Path.Combine(folder, fileName), bytes, cancellationToken);
            return fileName;
        }

        /// <summary>
        /// The record of what was imported with a warning — a plain text file beside the error
        /// workbook, served by the same DownloadImportFile endpoint.
        ///
        /// WHY A FILE AND NOT JUST THE RESPONSE. A warned row is IMPORTED, and several of the
        /// warnings mean the value was dropped: an unparseable date, Rank, coordinate, chainage
        /// or length is stored NULL, and the project then looks merely incomplete rather than
        /// mis-typed. Warnings[] answers "what just happened"; this answers "what happened last
        /// Tuesday", which is when someone usually asks.
        ///
        /// The layout follows ImportProjectJobService.GenerateTextReport so the two importers'
        /// reports read alike.
        /// </summary>
        private async Task<string> WriteImportWarningReportAsync(
            LumpSumImportVerdict verdict,
            string parentProjectId,
            string programId,
            int importedCount,
            IReadOnlyDictionary<string, string> createdByPlaceholder,
            DateTime now,
            CancellationToken cancellationToken)
        {
            /*  Every row names the project it BECAME, not the workbook placeholder it was.
                The placeholder ties the four sheets together during validation and is then
                discarded (a child's AlternateId is its parent's Project ID), so it is no
                use to someone opening Projects to correct the value. */
            string Named(string? placeholder) =>
                placeholder != null && createdByPlaceholder.TryGetValue(placeholder, out var created)
                    ? created
                    : placeholder ?? string.Empty;

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("=== LUMP SUM ITEMIZATION — IMPORT WARNINGS ===");
            sb.AppendLine($"Generated:            {now:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine($"Lump Sum Project:     {parentProjectId}");
            sb.AppendLine($"Program:              {programId}");
            sb.AppendLine($"Imported by:          {_Session.UserId}");
            sb.AppendLine($"Projects imported:    {importedCount}");
            if (verdict.RefusedProjectCount > 0)
                sb.AppendLine($"Projects refused:     {verdict.RefusedProjectCount}  (see the error workbook written alongside this report)");
            sb.AppendLine();
            sb.AppendLine("These rows WERE imported. Each carries a value the validator could not");
            sb.AppendLine("accept: an unreadable one is stored blank, a wrong one is stored as typed.");
            sb.AppendLine("Correct them on the project itself, in the Projects module.");
            sb.AppendLine();

            sb.AppendLine("--- WARNING RECORDS ---");
            sb.AppendLine($"Project Details:      {verdict.WarningProjectDetails.Count}");
            sb.AppendLine($"Funding Profile:      {verdict.WarningFundingProfile.Count}");
            sb.AppendLine($"Component Details:    {verdict.WarningComponentDetails.Count}");
            sb.AppendLine($"Major Items of Work:  {verdict.WarningMajorItemsOfWork.Count}");
            sb.AppendLine();

            void WriteSection<T>(List<T> list, string header, Func<T, string> line)
            {
                if (list.Count == 0) return;
                sb.AppendLine(header);
                list.ForEach(x => sb.AppendLine($"  {line(x)}"));
                sb.AppendLine();
            }

            WriteSection(verdict.WarningProjectDetails, "--- WARNING: PROJECT DETAILS ---",
                x => $"Project ID: {Named(x.ProjectId)} | Warning: {x.ErrorMessage}");
            WriteSection(verdict.WarningFundingProfile, "--- WARNING: FUNDING PROFILE ---",
                x => $"Project ID: {Named(x.ProjectId)} | Warning: {x.ErrorMessage}");
            WriteSection(verdict.WarningComponentDetails, "--- WARNING: COMPONENT DETAILS ---",
                x => $"Project ID: {Named(x.ProjectId)} | Component ID: {x.ComponentId} | Warning: {x.ErrorMessage}");
            WriteSection(verdict.WarningMajorItemsOfWork, "--- WARNING: MAJOR ITEMS OF WORK ---",
                x => $"Project ID: {Named(x.ProjectId)} | Infrastructure ID: {x.InfrastructureId} | Warning: {x.ErrorMessage}");

            var folder = Path.Combine(_env.ContentRootPath, "Resources", "Imports");
            Directory.CreateDirectory(folder);

            var fileName = $"LumpSumImportWarnings_{ImportFileNaming.SanitizeForFileName(parentProjectId)}_{ImportFileNaming.BuildFileSuffix(Guid.NewGuid().ToString("N"), now)}.txt";
            await System.IO.File.WriteAllBytesAsync(
                Path.Combine(folder, fileName),
                System.Text.Encoding.UTF8.GetBytes(sb.ToString()),
                cancellationToken);
            return fileName;
        }

        /// <summary>
        /// The child's funding lines, flagged IsWalletDraw so the views count them against
        /// the parent. SourceOrg and AgreementCode are the CODES ValidateFundingProfile
        /// stamped, not the sheet's display names. Percentage is the line's share of the
        /// project's total, as the Lump Sum module has always computed it.
        /// </summary>
        private void WriteDrawLines(List<ImportFundingProfileExcel> lines, ImportProjectReference reference, string userId, DateTime currentDate)
        {
            decimal Total = lines.Sum(x => decimal.Parse(x.Amount));

            foreach (var Line in lines)
            {
                var Saved = _db.SaveFundingProfile(Line, reference).FundingProfile;
                Saved.Percentage = Total == 0m ? 0d : (double)(Saved.Amount / Total) * 100d;
                // The flag the views filter on to decide what draws down the parent.
                Saved.IsWalletDraw = true;
                Saved.CreatedBy = userId;
                Saved.CreatedDate = currentDate;
                _db.tProjectFundingProfile.Add(Saved);
            }
        }

        /// <summary>
        /// Component costs and their per-year rows, consolidated exactly as the Program
        /// importer does it: the first row for a (ProjectId, ComponentId) creates the cost,
        /// every row — first included — adds a per-year row, and later rows roll their
        /// amount into the cost's Total. ComponentType is stored as the lookup's canonical
        /// NAME, which is what the rest of this module reads (GetLSComponentAsync).
        /// </summary>
        private List<ImportComponentReference> WriteComponentCosts(
            List<ImportComponentDetailsExcel> rows, ImportProjectReference reference, ImportLookupCache cache, string userId, DateTime currentDate)
        {
            var References = new List<ImportComponentReference>();
            var Costs = new List<ProjectComponentCost>();

            foreach (var Item in rows)
            {
                var ReferenceComponent = References.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);

                if (ReferenceComponent == null)
                {
                    var Cost = _db.SaveComponentCost(Item, reference).ComponentCost;
                    Cost.ComponentType = cache.Components.First(x => NamesMatch(x.ComponentName, Item.ComponentType)).ComponentName;
                    Cost.CreatedBy = userId;
                    Cost.CreatedDate = currentDate;
                    Costs.Add(Cost);
                    _db.tProjectComponentCost.Add(Cost);
                    _db.SaveChanges(); // need to save for tProjectComponentCostPerYear.ComponentCostFK

                    ReferenceComponent = new ImportComponentReference
                    {
                        OldProjectFK = Item.ProjectId,
                        ComponentId = Item.ComponentId,
                        NewComponentId = Cost.Id,
                        WorkTypeFK = Item.ScopeOfWorkEnum,
                        InfraTypeFK = Item.InfraTypeInfraCode
                    };
                    References.Add(ReferenceComponent);

                    var PerYear = _db.SaveComponentCostPerYear(Item, ReferenceComponent, reference.UACS).ComponentCostPerYear;
                    PerYear.CreatedBy = userId;
                    PerYear.CreatedDate = currentDate;
                    _db.tProjectComponentCostPerYear.Add(PerYear);
                }
                else
                {
                    // Already have a cost record for this ProjectId + ComponentId -> add another year, roll up the total
                    var PerYear = _db.SaveComponentCostPerYear(Item, ReferenceComponent, reference.UACS).ComponentCostPerYear;
                    PerYear.CreatedBy = userId;
                    PerYear.CreatedDate = currentDate;
                    _db.tProjectComponentCostPerYear.Add(PerYear);

                    var ExistingCost = Costs.First(x => x.Id == ReferenceComponent.NewComponentId);
                    ExistingCost.Total += PerYear.Amount;
                }
            }

            return References;
        }

        /// <summary>
        /// Major items of work and their locations, one work item per (ProjectId,
        /// ComponentId) and one location per sheet row — the Program importer's grouping.
        /// </summary>
        private void WriteMajorItems(
            List<ImportMajorItemsOfWorkExcel> rows, List<ImportComponentReference> componentReferences, string userId, DateTime currentDate)
        {
            var WorkItemReferences = new List<ImportMajorWorkItemReference>();

            foreach (var Item in rows)
            {
                var ReferenceComponent = componentReferences.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);
                if (ReferenceComponent == null) continue;

                var ReferenceWorkItem = WorkItemReferences.FirstOrDefault(x => x.OldProjectFK == Item.ProjectId && x.ComponentId == Item.ComponentId);

                if (ReferenceWorkItem == null)
                {
                    var WorkItem = _db.SaveMajorItemsOfWork(Item, ReferenceComponent).MajorWorkItem;
                    WorkItem.CreatedBy = userId;
                    WorkItem.CreatedDate = currentDate;
                    _db.tProjectMajorWorkItem.Add(WorkItem);
                    _db.SaveChanges(); // need to save for tProjectMajorWorkLocations.WorkItemFK

                    ReferenceWorkItem = new ImportMajorWorkItemReference
                    {
                        OldProjectFK = Item.ProjectId,
                        ComponentId = Item.ComponentId,
                        NewWorkItem = WorkItem.Id
                    };
                    WorkItemReferences.Add(ReferenceWorkItem);
                }

                var Location = _db.SaveMajorWorkLocation(Item, ReferenceWorkItem).MajorWorkLocation;
                Location.CreatedBy = userId;
                Location.CreatedDate = currentDate;
                _db.tProjectMajorWorkLocations.Add(Location);
            }
        }
    }
}
