using Microsoft.Extensions.Logging;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views.Program;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Newtonsoft.Json;
using System.Security.Claims;
using WebAPI.MicroService;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProgramController : CoreController
    {
        private readonly ISqlExecutor _sql;
        private readonly ILogger<ProgramController>? _logger;
        public ProgramController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler, ISqlExecutor sql, ILogger<ProgramController>? logger = null) : base(db, hub, pcma, exceptionHandler) { _sql = sql; _logger = logger; }
        #region Program Lists

        [HttpPost]
        public async Task<IActionResult> InitFilterProgram(CancellationToken cancellationToken)
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RDIP, EnumProgramStage.PIP }.Select(stage => (int)stage).ToList();
                var SelectedStatus = new[] { EnumProgramStatus.Working, EnumProgramStatus.Approved }.Select(stage => (int)stage).ToList();

                var AvailableStages = await _db.tOptionProgramStage.Where(x => SelectedStage.Contains(x.Id)).ToListAsync(cancellationToken);
                var AvailableTypes = await _db.tOptionProgramType.ToListAsync(cancellationToken);

                var AvailableStatuses = await _db.tOptionProgramStatus.Where(x => SelectedStatus.Contains(x.NameId)).ToListAsync(cancellationToken);
                var AvailableGroups = await _db.tGroups.ToListAsync(cancellationToken);
                var response = new
                {
                    Stages = AvailableStages,
                    Types = AvailableTypes,
                    Statuses = AvailableStatuses,
                    Groups = AvailableGroups
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> ShowProgram([FromBody] ShowProgramDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();


                if (!string.IsNullOrWhiteSpace(
                        dto.Filters.Name))
                {
                    filters.Add((
                        "v.Name LIKE @Name",
                        "@Name",
                        $"%{dto.Filters.Name.Trim()}%"));

                    //Working
                    //filters.Add((
                    //    $"v.Name LIKE '%' + @Name + '%'",
                    //    "@Name",
                    //    dto.Filters.Name.Trim()));

                    //Working
                    //filters.Add((
                    //    $"v.Name LIKE '%{dto.Filters.Name.Trim()}%'",
                    //    "@Name",
                    //    $"%{dto.Filters.Name.Trim()}%"));

                    //filters.Add((
                    //    "v.Name = @Name",
                    //    "@Name",
                    //    $"%{dto.Filters.Name.Trim()}%"));

                }

                if (!string.IsNullOrWhiteSpace(dto.Filters.StageName))
                {
                    filters.Add((
                        "v.StageName = @StageName",
                        "@StageName",
                        dto.Filters.StageName));
                }

                if (dto.Filters.StartYear.HasValue)
                {
                    filters.Add((
                        "v.StartYear = @StartYear",
                        "@StartYear",
                        dto.Filters.StartYear.Value));
                }

                if (!string.IsNullOrWhiteSpace(dto.Filters.Type))
                {
                    filters.Add((
                        "v.Type = @Type",
                        "@Type",
                        dto.Filters.Type));
                }
                if (_Session.ApplyFilter)
                {
                    filters.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                        "@regCode", _Session.RegCode));
                }

                FilterDataResult<ProgramLatest> result =
                    await _db.FilterDataCursor<
                        ProgramLatest,
                        ShowProgramFilterDTO>(
                            tableName: "vProgramLatest",
                            dto: dto,
                            filter: filters,
                            keyColumn: "Id",
                            descending: true,
                            includeTotal: true,
                            ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(
                        new ErrorResult
                        {
                            Title = "Pagination error",
                            Message =
                                result.ErrorMessage ??
                                "Unable to retrieve the records."
                        });
                }

                // 2026-10-16: whether each listed program can be deleted, and why not, from the same
                // rule DeleteProgram enforces (Functions/GetProgramDeletionEligibility.sql) -- one
                // query for the page, so the Delete button never repeats the rule client-side.
                // Opt-in (only the Program list asks), and optional: if it fails (scripts missing,
                // see [RequiresDeletionObjects], or a database error) the list still loads with
                // CanDelete unset, the failure is logged, and DeleteProgram still decides.
                if (dto.IncludeDeleteEligibility)
                {
                    try
                    {
                        var eligibility = await _sql.DetermineProgramDeletionEligibilitiesAsync(
                            result.Data.lists.Select(x => x.ProgramPK), cancellationToken);
                        foreach (var program in result.Data.lists)
                        {
                            if (eligibility.TryGetValue(program.ProgramPK, out var row))
                            {
                                program.CanDelete = row.Eligibility != "Blocked";
                                program.DeleteBlockedReason = program.CanDelete == true ? null : row.RefusalMessage;
                            }
                        }
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger?.LogError(ex, "Program list: delete eligibility could not be read; Delete buttons fall back to the client default.");
                    }
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ShowProgramStages([FromBody] ShowProgramStagesDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (_Session.ApplyFilter)
                {
                    var isVisible = await _db.fUserVisiblePrograms
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisiblePrograms({_Session.UserId})")
                        .AnyAsync(x => x.ProgramPK == dto.ProgramId);

                    if (!isVisible)
                    {
                        return Ok(new { Stages = new List<DBHelper.Models.Functions.Program.ProgramStages>() });
                    }
                }

                var Stages = await _db.fProgramStages
                    .FromSqlInterpolated($"SELECT * FROM dbo.fProgramStages({dto.ProgramId})")
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    Stages = Stages
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> InitAddProgram(CancellationToken cancellationToken)
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RDIP, EnumProgramStage.PIP }.Select(stage => (int)stage).ToList();

                var Stage = await _db.tOptionProgramStage.AsNoTracking().Where(x => !SelectedStage.Contains(x.Id)).ToListAsync(cancellationToken);

                var Type = await _db.tOptionProgramType.AsNoTracking().ToListAsync(cancellationToken);
                var Group = await _db.tGroups.ToListAsync(cancellationToken);
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync(cancellationToken);
                return Ok(new
                {
                    Stages = Stage,
                    Types = Type,
                    Groups = Group,
                    DataSecurity = Security
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddProgram([FromBody] AddProgramDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (dto.Type == EnumProgramType.TrustFund)
                {
                    dto.Stage = EnumProgramStage.TF;
                }
                var checkProgram = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkProgram != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program name '{dto.Name}' already exists in the System.", Title = "Program Already Exists" });
                }
                var checkStageType = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if (checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid.", Title = "Invalid Stage" });
                }
                var checkType = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid.", Title = "Invalid Type" });
                }
                // 2026-09-05: [Required] on a non-nullable int is a no-op (a value type can never
                // be "missing"), so YearStart previously accepted 0, negative, or any arbitrary
                // year with no check at all.
                if (dto.YearStart < Functions.CurrentDate().Year)
                {
                    return new BadRequestObjectResult(new { Message = $"Year Start '{dto.YearStart}' cannot be earlier than the current year ({Functions.CurrentDate().Year}).", Title = "Invalid Year" });
                }
                // 2026-09-05: an empty array previously passed both checks below vacuously (an
                // empty .Where() always yields zero invalid items), silently saving a program
                // with no Data Security Group / UserGroup at all. A program saved with a blank
                // DataSecurityGroup becomes invisible in every filtered listing for every region
                // (ShowProgram/ShowProjectsInProgram's ApplyFilter EXISTS check against
                // vProgramDataSecurityGroups never matches), and a blank UserGroup was previously
                // never checked at all.
                if (dto.DataSecurityGroup == null || dto.DataSecurityGroup.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "At least one Data Security Group must be selected.", Title = "Data Security Group Required" });
                }
                if (dto.UserGroup == null || dto.UserGroup.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "At least one User Group must be selected.", Title = "User Group Required" });
                }
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).Select(x => x.ParticipantId).ToListAsync(cancellationToken);
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid.", Title = "Invalid Security Group" });
                }
                if (dto.IsSkipped == true && string.IsNullOrEmpty(dto.SkipReason))
                {
                    return new BadRequestObjectResult(new { Message = $"Please provide a reason for skipping stage of this program.", Title = "Skip Reason Required" });
                }
                string hostName = User.FindFirstValue(ClaimTypes.GivenName) ?? "Unknown";
                //string ReferenceId = "PR_" + hostName + "_" + ("tCountSequence").GenerateCode();
                DateTime CurrentDate = Functions.CurrentDate();
                string HostName = User.FindFirstValue("HostName")!;
                string Date = CurrentDate.ToString("MMddyyyy");
                string Time = CurrentDate.ToString("HHmmss");
                string NewProgramUniqueId = $"{HostName}_{Date}_{Time}";
                string UserId = _Session.UserId;
                var newProgram = new DBHelper.Models.Table.Program.Programs()
                {
                    ProgramPK = NewProgramUniqueId,
                    DataSecurityGroup = dto.DataSecurityGroup,
                    UserGroup = dto.UserGroup,
                    Type = dto.Type,
                    StartYear = dto.YearStart,
                    // Restored: a9ed4a66 dropped these while keeping the "reason required" check above.
                    IsSkipped = dto.IsSkipped,
                    SkipReason = dto.IsSkipped ? dto.SkipReason : null,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                };
                await _db.tPrograms.AddAsync(newProgram);
                await _db.SaveChangesAsync(cancellationToken);
                var newRevisions = new DBHelper.Models.Table.Program.ProgramRevisions()
                {
                    ProgramFK = NewProgramUniqueId,
                    ProgramId = NewProgramUniqueId,
                    Name = dto.Name,
                    Status = EnumProgramStatus.Working,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,

                };
                await _db.tProgramRevisions.AddAsync(newRevisions);
                await _db.SaveChangesAsync(cancellationToken);
                await _db.tProgramStages.AddAsync(new DBHelper.Models.Table.Program.ProgramStages()
                {
                    ProgramFK = NewProgramUniqueId,
                    ProgramId = NewProgramUniqueId,
                    RevisionId = newRevisions.Id,
                    StageId = dto.Stage,
                    // The lookup's Name ("GAA-R"), not the enum name ("GAAR"): FK_tProgramStages_Stage is
                    // composite on (StageId, StageName), and the enum cannot spell NEP-E/HGAB-I/GAA-R/TF-R.
                    StageName = checkStageType.Name,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Id = NewProgramUniqueId,
                    Stage = dto.Stage.ToString(),
                    Message = "Program added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
        #region Program Details
        [HttpPost]
        public async Task<IActionResult> ShowProjectsInProgram([FromBody] ShowProjectsInProgramDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.ProjectId))
                    filters.Add(("v.ProjectId = @projectId", "@projectId", dto.Filters.ProjectId));
                // Each row is one project at the requested stage, so the stage's own revision decides.
                if (!await filters.AddProjectListVisibilityAsync(_db, _Session, "v.RevisionId", cancellationToken))
                {
                    return new ObjectResult(new { Title = ProjectHelper.NoProjectAccessTitle, Message = ProjectHelper.NoProjectAccessMessage }) { StatusCode = 403 };
                }
                if (!Enum.TryParse<EnumProgramStage>(
                    dto.StageName.Replace("-", ""),
                    ignoreCase: true,
                    out var stage))
                {
                    return new BadRequestObjectResult(new ErrorResult
                    {
                        Title = "Invalid stage",
                        Message = $"Invalid StageName: '{dto.StageName}'."
                    });
                }
                var sourceParameters =
                new List<(string ParamName, object? Value)>
                {
                    ("@ProgramId", dto.ProgramId),
                    ("@StageId", (int)stage)
                };
                FilterDataResult<ProgramProjects> result =
                    await _db.FilterDataCursor<
                        ProgramProjects,
                        ShowProjectsInProgramFilterDTO>(
                            tableName: $"fProgramProjects",
                            sourceParameters: sourceParameters,
                            isTableValuedFunction: true,
                            dto: dto,
                            filter: filters,
                            keyColumn: "Id",
                            descending: true,
                            includeTotal: true,
                            // Heavy per-program TVF (16k+ rows on the largest program): compile each cursor
                            // fetch for its own value, as ShowProjects does (cursor plan sniffing).
                            recompileCursorQueries: true,
                            ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(
                        new ErrorResult
                        {
                            Title = "Pagination error",
                            Message =
                                result.ErrorMessage ??
                                "Unable to retrieve the records."
                        });
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ProgramDetails([FromBody] ProgramDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }
                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session,
                    ViewOldStage = true
                }, cancellationToken);
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;

                if (dto.ProgramId != ProgramParent.ProgramPK)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"Program ID '{dto.ProgramId}' does not match the Program associated with the selected stage. Expected Program ID: '{ProgramParent.ProgramPK}'.",
                        Message = "Program ID does not match the Expected Program ID, Please select a different stage.",
                        Title = "Program ID Mismatch"
                    });

                }

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramRevision.ProgramPK, cancellationToken);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"Program ID '{dto.ProgramId}' does not exist in the System.",
                        Message = "The specified program could not be found in the system.",
                        Title = "Program not found"
                    });
                }
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                //var AllowedStages = new[] { EnumProgramStage.BP, EnumProgramStage.NEP, EnumProgramStage.NEPE, EnumProgramStage.HGAB, EnumProgramStage.HGABI, EnumProgramStage.GAA, EnumProgramStage.GAAR, EnumProgramStage.TF, EnumProgramStage.TFR }.Select(stage => (int)stage).Select(x => x).ToList();
                //var AvailableStages = await _db.tOptionProgramStage.AsNoTracking().Where(x => AllowedStages.Contains(x.NameId)).ToListAsync(cancellationToken);
                var AvailableStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync(cancellationToken);
                var AvailableTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync(cancellationToken);
                var AvailableStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync(cancellationToken);
                var AvailableGroups = await _db.tGroups.AsNoTracking().ToListAsync(cancellationToken);
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync(cancellationToken);
                var Permissions = await _db.vUserActionPermission.FirstOrDefaultAsync(x => x.PermissionAction == "PublishProgram" && x.UserId == _Session.UserId && x.IsActive);
                var response = new
                {
                    IsActive = (CurrentProgramVersion.StageName == ProgramStage.StageName) ? true : false,
                    CanPublish = Permissions != null ? true : false,
                    Details = ProgramRevision,
                    //Projects = ProjectLists,
                    Dropdowns = new
                    {
                        Stages = AvailableStages,
                        Types = AvailableTypes,
                        Statuses = AvailableStatuses,
                        Groups = AvailableGroups,
                        DataSecurity = Security
                    }
                };
                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> DeleteProgram([FromBody] DeleteProgramDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }
                DateTime CurrentDate = Functions.CurrentDate();
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = ValidateProgramId.Message, Title = ValidateProgramId.Title, Message = ValidateProgramId.Message });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevision = ValidateProgramId.Data.ProgramRevision;
                string programDisplayName = ProgramHelper.Capitalize(ProgramHelper.ProgramLabel(ProgramRevision.Name));

                // The whole decision lives in ProgramHelper.ExecuteProgramDeletionAsync, inside the
                // delete transaction on locked rows: Blocked when the program is Approved, has
                // advanced past its first stage, or (2026-10-16, NO CASCADE) still has a live
                // project -- its projects are deleted first, by a user allowed to. Only leftovers of
                // projects users already deleted go with it. Any refusal is a
                // DeletionRefusedException, caught below, and nothing is written.
                var removedLeftovers = await ProgramHelper.ExecuteProgramDeletionAsync(
                    _sql, ProgramParent.ProgramPK, _Session.UserId, CurrentDate, cancellationToken);

                return Ok(new
                {
                    Message = $"{programDisplayName} has been deleted.",
                    Title = "Program Deleted",
                    DeletedProjects = removedLeftovers
                });
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                // A refusal from the deletion rule (Approved or progressed program, a published or
                // progressed child, a change that raced the delete) — its reason is the message,
                // not a generic database error.
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Delete Not Allowed" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                // Lost a race with another change to the same program (SQL Server error 1205). Nothing
                // was written; the same request will normally go through on a second try.
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateProgramDetails([FromBody] UpdateProgramDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                string ProgramId = dto.ProgramId;
                DateTime CurrentDate = Functions.CurrentDate();


                var currentVersion = await _db.vProgramLatest.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.ProgramPK == dto.ProgramPK, cancellationToken);
                if (currentVersion == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Program Stage Not Found",
                        Message = "The requested program stage could not be found. The program may no longer exist or you may be viewing an outdated stage. Please return to the Program List and open the program again to view the latest available stage."
                    });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = ValidateProgramId.Message, Title = ValidateProgramId.Title, Message = ValidateProgramId.Message });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramDetails = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                if (ProgramDetails.StageName != dto.StageName)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"Program '{dto.ProgramId}' is not in the '{dto.StageName}' stage.",
                        Message = "Program stage mismatch. Please ensure you are updating the correct stage.",
                        Title = "Update Failed"
                    });
                }
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                if (string.IsNullOrEmpty(dto.Name)) { return new BadRequestObjectResult(new { Message = $"Program name field cannot be empty.", Title = "Update Failed" }); }
                //var NewProgramVersion = new ProgramRevisions()
                //{
                //    ProgramFK = dto.ProgramId,
                //    ProgramId = getProgram.ProgramId,
                //    Name = dto.Name,
                //    Status = dto.Status,
                //    Cost = dto.Cost,
                //    CreatedBy = _Session.UserId,
                //    CreatedDate = CurrentDate
                //};
                var ProgramRevisions = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ProgramStage.RevisionId, cancellationToken);
                if (ProgramRevisions == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"The program revision for Program ID '{dto.ProgramId}' does not exist in the system.",
                        Message = "Program revision not found.",
                        Title = "Program Revision Not Found"
                    });
                }
                if (dto.Name != ProgramRevisions.Name && !string.IsNullOrEmpty(ProgramRevisions.Name))
                {
                    hasUpdated = true;
                    ProgramRevisions.Name = dto.Name;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.Name,
                        OldValue = ProgramRevisions.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                // 2026-09-05: an empty array previously satisfied every check below (a reference
                // `!=` compare is essentially always true for two distinct array instances, and
                // the "invalid items" query below yields zero items on an empty array), so a
                // blank UserGroup/DataSecurityGroup could unconditionally overwrite an existing,
                // valid value with nothing. A blank DataSecurityGroup makes the program invisible
                // in every filtered listing (ApplyFilter's EXISTS check against
                // vProgramDataSecurityGroups never matches an empty array).
                if (dto.DataSecurityGroup == null || dto.DataSecurityGroup.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "At least one Data Security Group must be selected.", Title = "Data Security Group Required" });
                }
                if (dto.UserGroup == null || dto.UserGroup.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "At least one User Group must be selected.", Title = "User Group Required" });
                }
                // 2026-09-05: was `!=`, which is reference equality on an array -- two distinct
                // array instances holding the exact same values were always "changed", so every
                // update wrote a transaction log entry and touched this column regardless of
                // whether the selection actually changed. Order-independent content comparison.
                if (!dto.UserGroup.OrderBy(x => x).SequenceEqual(ProgramParent.UserGroup.OrderBy(x => x)))
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "UserGroup",
                        NewValue = string.Join(", ", dto.UserGroup),
                        OldValue = string.Join(", ", ProgramParent.UserGroup),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    ProgramParent.UserGroup = dto.UserGroup;
                }
                // 2026-09-05: aligned with AddProgram's equivalent check (line ~240) -- this query
                // previously omitted the OrgType filter, so "valid" security groups accepted here
                // could include org types AddProgram would reject, a divergence between the two
                // write paths for the same field.
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync(cancellationToken);
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Select(x => x.ParticipantId).Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid.", Title = "Invalid Security Group" });
                }
                // 2026-09-05: was `!=` (reference equality) -- see UserGroup comment above, same fix.
                if (!dto.DataSecurityGroup.OrderBy(x => x).SequenceEqual(ProgramParent.DataSecurityGroup.OrderBy(x => x)))
                {
                    hasUpdated = true;
                    string CurrentSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => ProgramParent.DataSecurityGroup.Contains(sg)));
                    string OdSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => dto.DataSecurityGroup.Contains(sg)));
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "DataSecurityGroup",
                        NewValue = CurrentSecurityGroup!,
                        OldValue = OdSecurityGroup!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    ProgramParent.DataSecurityGroup = dto.DataSecurityGroup;
                }
                var Status = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)dto.Status);
                if (Status == null) { return new BadRequestObjectResult(new { Message = $"The selected Status is invalid. Please ensure the Status field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Status != ProgramRevisions.Status)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)ProgramRevisions.Status);
                    ProgramRevisions.Status = dto.Status;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Status",
                        NewValue = Status.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                //var Types = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                //if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                //if (dto.Type != ProgramParent.Type)
                //{
                //    hasUpdated = true;
                //    var Current = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)ProgramParent.Type);
                //    ProgramParent.Type = dto.Type;
                //    transactionLogs.Add(new TransactionLog
                //    {
                //        ReferenceId = ProgramId,
                //        TransactionType = EnumTransactionType.Update.ToString(),
                //        AffectedTable = "tProgramRevisions",
                //        AffectedColumn = "Type",
                //        NewValue = Types.Name!,
                //        OldValue = Current!.Name!,
                //        CreatedBy = _Session.UserId,
                //        CreatedDate = CurrentDate
                //    });
                //}
                //if (dto.YearStart != ProgramParent.StartYear)
                //{
                //    hasUpdated = true;
                //    ProgramParent.StartYear = dto.YearStart;
                //    transactionLogs.Add(new TransactionLog
                //    {
                //        ReferenceId = ProgramId,
                //        TransactionType = EnumTransactionType.Update.ToString(),
                //        AffectedTable = "tProgramRevisions",
                //        AffectedColumn = "StartYear",
                //        NewValue = dto.YearStart.ToString(),
                //        OldValue = ProgramParent.StartYear.ToString(),
                //        CreatedBy = _Session.UserId,
                //        CreatedDate = CurrentDate
                //    });
                //}
                if (hasUpdated)
                {
                    _db.tProgramRevisions.Update(ProgramRevisions);
                    _db.tPrograms.Update(ProgramParent);
                    //await _db.SaveChangesAsync(cancellationToken);
                    //await _db.tProgramStages.AddAsync(new DBHelper.Models.Table.Program.ProgramStages()
                    //{
                    //    ProgramFK = ProgramRevisions.ProgramFK,
                    //    ProgramId = ProgramRevisions.ProgramId,
                    //    RevisionId = ProgramRevisions.Id,
                    //    StageId = ProgramStage.StageId,
                    //    StageName = ProgramStage.StageName,
                    //    CreatedBy = _Session.UserId,
                    //    CreatedDate = CurrentDate,
                    //});
                    if (ProgramStage.StageId == EnumProgramStage.GAAR && dto.Status == EnumProgramStatus.Approved)
                    {
                        var syncPublishableProjects = (
                            await _db.Database
                                .SqlQuery<int>(
                                    $"EXEC dbo.pRecomputeProjectPublishable @ProgramFK = {ProgramParent.ProgramPK}"
                                )
                                .ToListAsync()
                        ).FirstOrDefault();
                    }
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Data = $"Program {dto.ProgramId} updated successfully.",
                    Message = "Program updated successfully.",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateProgramStage([FromBody] UpdateProgramStageDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var ValidateStage = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if (ValidateStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid.", Title = "Invalid Stage" });
                }

                string ProgramId = dto.ProgramId;
                DateTime CurrentDate = Functions.CurrentDate();

                var currentVersion = await _db.vProgramLatest.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.ProgramPK == dto.ProgramPK, cancellationToken);
                if (currentVersion == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Program Stage Not Found",
                        Message = "The requested program stage could not be found. The program may no longer exist or you may be viewing an outdated stage. Please return to the Program List and open the program again to view the latest available stage."
                    });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = currentVersion.StageName.ToString(),
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = ValidateProgramId.Message, Title = ValidateProgramId.Title, Message = ValidateProgramId.Message });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramDetails = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                if (ProgramStage.StageId == dto.Stage)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"Program {dto.ProgramId} is already in the '{dto.Stage}' stage.",
                        Message = "Program is already in the requested stage. Please select a different stage.",
                        Title = "Update Failed"
                    });
                }
                var ProgramRevision = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ProgramStage.RevisionId, cancellationToken);
                if (ProgramRevision == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = $"The program revision for Program ID '{dto.ProgramId}' does not exist in the system.",
                        Message = "Program revision not found.",
                        Title = "Program Revision Not Found"
                    });
                }

                // 2026-10-20: BatchDelete and the restore take this lock before they read or write a
                // program's projects. Without it a delete or restore that commits while this advance
                // runs is carried forward, or lost. Taken before anything below is read; it is held
                // until this transaction ends.
                await _db.AcquireProgramDeletionLockAsync(ProgramParent.ProgramPK, cancellationToken);

                var checkProjects = await _db.vProjectLatest
                .Where(x => x.ProgramFK == ProgramParent.ProgramPK)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

                // 2026-10-20: a project deleted at the stage being left is not advanced, now or at any
                // later advance. vProjectLatest returns a project's newest LIVE revision whatever its
                // stage, and a soft delete flags only the current-stage revision, so a project deleted
                // at NEP falls back to its still-live BP revision and would be carried forward under
                // its BP ProjectId. Active = a live revision at the stage being left (advancement
                // specification, section 10).
                // "No row at this stage" does not mean "legacy": a project dropped by an earlier
                // advance has none either, and must stay dropped (delete at NEP, advance to NEP-E,
                // advance again). Only a project with NO stage row anywhere in this program was never
                // staged (a legacy import), and that one is kept, as before.
                var LiveAtThisStage = (await (
                        from stage in _db.tProjectStages.AsNoTracking()
                        join revision in _db.tProjectRevisions.AsNoTracking() on stage.RevisionId equals revision.Id
                        where stage.ProgramFK == ProgramParent.ProgramPK && stage.StageId == ProgramStage.StageId && !revision.IsDeleted
                        select revision.ProjectFK)
                    .Distinct().ToListAsync(cancellationToken))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                var HasAnyStageRow = (await _db.tProjectStages.AsNoTracking()
                        .Where(x => x.ProgramFK == ProgramParent.ProgramPK)
                        .Select(x => x.ProjectFK).Distinct().ToListAsync(cancellationToken))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                bool HadProjects = checkProjects.Count > 0;
                checkProjects = checkProjects
                    .Where(x => LiveAtThisStage.Contains(x.ProjectPK) || !HasAnyStageRow.Contains(x.ProjectPK))
                    .ToList();

                string HostName = User.FindFirstValue("HostName")!;
                string Date = CurrentDate.ToString("MMddyyyy");
                string Time = CurrentDate.ToString("HHmmss");
                string NewProgramUniqueId = $"{HostName}_{Date}_{Time}";

                // The program-level writes: the new program revision and stage row. Shared by the
                // normal path (after the projects are copied) and by a program whose every project
                // was deleted at this stage, which advances with no projects (advancement
                // specification AT-STG-007).
                async Task<IActionResult> AdvanceProgramAsync()
                {
                    var NewProgramRevision = new DBHelper.Models.Table.Program.ProgramRevisions()
                    {
                        ProgramFK = ProgramParent.ProgramPK,
                        ProgramId = NewProgramUniqueId,
                        Name = dto.Name,
                        Status = EnumProgramStatus.Working,
                        Cost = ProgramRevision.Cost,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    };
                    await _db.tProgramRevisions.AddAsync(NewProgramRevision);
                    await _db.SaveChangesAsync(cancellationToken);
                    var newStage = new DBHelper.Models.Table.Program.ProgramStages()
                    {
                        ProgramFK = ProgramParent.ProgramPK,
                        ProgramId = NewProgramUniqueId,
                        RevisionId = NewProgramRevision.Id,
                        StageId = dto.Stage,
                        StageName = ValidateStage.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    };
                    await _db.tProgramStages.AddAsync(newStage);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                    return Ok(new
                    {
                        Message = "Program updated successfully.",
                        Title = "Update Stage Complete"
                    });
                }

                if (HadProjects && checkProjects.Count == 0)
                {
                    // Every project was deleted at this stage: nothing to copy, the program still advances.
                    return await AdvanceProgramAsync();
                }

                if (checkProjects.Count > 0)
                {
                    HashSet<int> ProjectRevisionFK = checkProjects.Select(x => x.RevisionId).ToHashSet();

                    var FundingProfiles = await _db.tProjectFundingProfile.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK) && !x.IsDeleted).ToListAsync(cancellationToken);

                    var Components = await _db.tProjectComponentCost.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK) && !x.IsDeleted)
                        .ToListAsync(cancellationToken);
                    HashSet<int> ComponentCostFK = Components.Select(pr => pr.Id).ToHashSet();
                    var ComponentsPerYear = await _db.tProjectComponentCostPerYear.AsNoTracking().Where(x => ComponentCostFK.Contains(x.ComponentCostFK) && !x.IsDeleted)
                        .ToListAsync(cancellationToken);

                    var MajorItems = await _db.tProjectMajorWorkItem.AsNoTracking()
                        .Where(x => ComponentCostFK.Contains(x.ComponentCostFK) && !x.IsDeleted)
                        .ToListAsync(cancellationToken);
                    HashSet<int> MajorWorkItemFK = MajorItems.Select(pr => pr.Id).ToHashSet();
                    var MajorLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorWorkItemFK.Contains(x.WorkItemFK) && !x.IsDeleted)
                        .ToListAsync(cancellationToken);

                    var SupportingDocuments = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK)).ToListAsync(cancellationToken);

                    var ProjectRevisions = await _db.tProjectRevisions.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.Id) && !x.IsDeleted).ToListAsync(cancellationToken);
                    List<ProjectRevisions> NewRevisions = new List<ProjectRevisions>();
                    if (ProjectRevisions.Count > 0)
                    {
                        string FirstSegment = ValidateStage.Name.GenerateProjec1stSegment();
                        bool HasNewProjectId = (ProgramStage.StageId == EnumProgramStage.BP) || false;
                        #region Project Level
                        #region Project Revisions
                        NewRevisions.AddRange(ProjectRevisions.Select(project => new ProjectRevisions()
                        {
                            ProjectFK = project.ProjectFK,
                            ProgramFK = project.ProgramFK,
                            ProgramId = NewProgramUniqueId,
                            ProjectId = HasNewProjectId ? project.ProjectId.ReplaceFirst("BP", FirstSegment) : project.ProjectId,
                            MYCAApprovalDate = project.MYCAApprovalDate,
                            Description = project.Description,
                            AlternateId = project.AlternateId,
                            Region = project.Region,
                            Province = project.Province,
                            City = project.City,
                            LegislativeDistrict = project.LegislativeDistrict,
                            DEO = project.DEO,
                            OperatingUnit = project.OperatingUnit,
                            ImplementingOffice = project.ImplementingOffice,
                            IslandCode = project.IslandCode,
                            Category = project.Category,
                            Thrust = project.Thrust,
                            Origin = project.Origin,
                            Agency = project.Agency,
                            ImplementationMode = project.ImplementationMode,
                            EmergencyMode = project.EmergencyMode,
                            RegionWide = project.RegionWide,
                            Feasibility = project.Feasibility,
                            FeasibilityDate = project.FeasibilityDate,
                            DetailedDesign = project.DetailedDesign,
                            DetailedDesignDate = project.DetailedDesignDate,
                            RowAvailable = project.RowAvailable,
                            Tier = project.Tier,
                            Rank = project.Rank,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsDeleted = project.IsDeleted
                        }));

                        // RISK-105/RISK-111 fix (2026-08-31): the BP-to-first-stage ProjectId swap
                        // above (ReplaceFirst("BP", ...)) reuses the project's existing digits with
                        // no allocator involved -- nothing previously checked whether the resulting
                        // value already belongs to a different real project (e.g. one imported or
                        // created directly at a P/MY-eligible stage). Fail closed rather than persist
                        // a silent cross-project ProjectId collision.
                        if (HasNewProjectId)
                        {
                            var SwappedProjectIds = NewRevisions.Select(x => x.ProjectId).ToHashSet();
                            var CollidingProjectPKs = await _db.tProjects.AsNoTracking()
                                .Where(x => SwappedProjectIds.Contains(x.ProjectPK))
                                .Select(x => x.ProjectPK)
                                .ToListAsync(cancellationToken);
                            var CollidingRevisionIds = await _db.tProjectRevisions.AsNoTracking()
                                .Where(x => !x.IsDeleted && SwappedProjectIds.Contains(x.ProjectId))
                                .Select(x => x.ProjectId)
                                .ToListAsync(cancellationToken);
                            var Colliding = CollidingProjectPKs.Concat(CollidingRevisionIds).Distinct().ToList();
                            if (Colliding.Count > 0)
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Message = $"Program stage advance failed: the generated ProjectId(s) [{string.Join(", ", Colliding)}] already belong to another existing project. The stage-advance was not applied. Contact an administrator before retrying.",
                                    Title = "ProjectId Collision Detected"
                                });
                            }
                        }

                        await _db.tProjectRevisions.AddRangeAsync(NewRevisions);
                        ProgramRevision.Status = EnumProgramStatus.Approved;
                        _db.tProgramRevisions.Update(ProgramRevision);
                        var transactionLog = new TransactionLog()
                        {
                            ReferenceId = ProgramId,
                            TransactionType = EnumTransactionType.Update.ToString(),
                            AffectedTable = "tProgramStages",
                            AffectedColumn = "StageName",
                            NewValue = ValidateStage.Name,
                            OldValue = ProgramStage.StageName,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        await _db.tTransactionLog.AddAsync(transactionLog);
                        await _db.SaveChangesAsync(cancellationToken);
                        #endregion
                        #region Project Stages
                        var newStages = NewRevisions.Select(pr => new DBHelper.Models.Table.Project.ProjectStages
                        {
                            ProjectFK = pr.ProjectFK,
                            ProgramFK = pr.ProgramFK,
                            ProgramId = NewProgramUniqueId,
                            RevisionId = pr.Id,
                            StageId = dto.Stage,
                            StageName = ValidateStage.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        await _db.tProjectStages.AddRangeAsync(newStages);
                        #endregion

                        #region Commented
                        #region Funding Profiles
                        if (FundingProfiles.Count() > 0)
                        {
                            var NewFundingProfiles =
                            (
                                from newRevision in NewRevisions
                                join oldRevision in ProjectRevisions
                                    on newRevision.ProjectFK equals oldRevision.ProjectFK
                                join fundingProfile in FundingProfiles
                                    on oldRevision.Id equals fundingProfile.ProjectRevisionFK
                                select new DBHelper.Models.Table.Project.ProjectFundingProfile
                                {
                                    ProjectRevisionFK = newRevision.Id,
                                    SourceOrg = fundingProfile.SourceOrg,
                                    AgreementCode = fundingProfile.AgreementCode,
                                    Amount = fundingProfile.Amount,
                                    Percentage = fundingProfile.Percentage,
                                    CreatedBy = fundingProfile.CreatedBy,
                                    CreatedDate = fundingProfile.CreatedDate,
                                    IsDeleted = fundingProfile.IsDeleted
                                }
                            )
                            .ToList();
                            await _db.tProjectFundingProfile.AddRangeAsync(NewFundingProfiles);
                        }
                        #endregion
                        #region Component Costs with Per Year, Major Work Items and Major Work Locations
                        if (Components.Count() > 0)
                        {
                            var componentYearsLookup = ComponentsPerYear.ToLookup(x => x.ComponentCostFK);

                            var majorItemsLookup = MajorItems
                                .ToLookup(x => x.ComponentCostFK);

                            var majorLocationsLookup = MajorLocations
                                .ToLookup(x => x.WorkItemFK);


                            // RelatedComponentCost needs one new property:
                            //     public int OldComponentCostId { get; set; }

                            #region ComponentCost
                            var NewComponentCost =
                            (
                                from newRevision in NewRevisions
                                join oldRevision in ProjectRevisions
                                    on newRevision.ProjectFK equals oldRevision.ProjectFK
                                join cc in Components
                                    on oldRevision.Id equals cc.ProjectRevisionFK
                                select new RelatedComponentCost
                                {
                                    OldProjectRevisionFK = oldRevision.Id,
                                    OldComponentCostId = cc.Id,          // ← the key the per-year join needs

                                    ProjectRevisionFK = newRevision.Id,

                                    ComponentType = cc.ComponentType,
                                    ComponentId = cc.ComponentId,
                                    Description = cc.Description,
                                    Total = cc.Total,

                                    CreatedBy = cc.CreatedBy,
                                    CreatedDate = cc.CreatedDate
                                }
                            )
                            .ToList();

                            var SaveComponentCost = NewComponentCost.Select(x => new DBHelper.Models.Table.Project.ProjectComponentCost
                            {
                                ProjectRevisionFK = x.ProjectRevisionFK,
                                ComponentType = x.ComponentType,
                                ComponentId = x.ComponentId,
                                Description = x.Description,
                                Total = x.Total,

                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = false
                            })
                            .ToList();                                     // ← must materialize, was lazy

                            await _db.tProjectComponentCost.AddRangeAsync(SaveComponentCost, cancellationToken);
                            await _db.SaveChangesAsync(cancellationToken);

                            // copy the generated identity values back onto the DTOs (1:1, same order)
                            for (int i = 0; i < NewComponentCost.Count; i++)
                                NewComponentCost[i].Id = SaveComponentCost[i].Id;
                            #endregion

                            #region Component Per Year
                            var NewComponentCostPerYear =
                            (
                                from newcc in NewComponentCost
                                join year in ComponentsPerYear
                                    on newcc.OldComponentCostId equals year.ComponentCostFK   // ← component, not revision
                                select new DBHelper.Models.Table.Project.ProjectComponentCostPerYear
                                {
                                    ComponentCostFK = newcc.Id,

                                    ComponentId = year.ComponentId,

                                    Amount = year.Amount,
                                    Year = year.Year,
                                    UACS = year.UACS,

                                    StartDate = year.StartDate,
                                    EndDate = year.EndDate,

                                    CreatedBy = year.CreatedBy,
                                    CreatedDate = year.CreatedDate,

                                    IsDeleted = false
                                }
                            )
                            .ToList();

                            await _db.tProjectComponentCostPerYear.AddRangeAsync(NewComponentCostPerYear, cancellationToken);
                            #endregion



                            #region ComponentCost
                            //var NewComponentCost =
                            //(
                            //    from newRevision in NewRevisions
                            //    join oldRevision in ProjectRevisions
                            //        on newRevision.ProjectFK equals oldRevision.ProjectFK
                            //    join cc in Components
                            //        on oldRevision.Id equals cc.ProjectRevisionFK
                            //    select new RelatedComponentCost
                            //    {
                            //        OldProjectRevisionFK = oldRevision.Id,

                            //        ProjectRevisionFK = newRevision.Id,

                            //        ComponentType = cc.ComponentType,
                            //        ComponentId = cc.ComponentId,
                            //        Description = cc.Description,
                            //        Total = cc.Total,

                            //        CreatedBy = cc.CreatedBy,
                            //        CreatedDate = cc.CreatedDate
                            //    }
                            //)
                            //.ToList();
                            //var SaveComponentCost = NewComponentCost.Select(x => new DBHelper.Models.Table.Project.ProjectComponentCost
                            //{
                            //    ProjectRevisionFK = x.ProjectRevisionFK,
                            //    ComponentType = x.ComponentType,
                            //    ComponentId = x.ComponentId,
                            //    Description = x.Description,
                            //    Total = x.Total,

                            //    CreatedBy = x.CreatedBy,
                            //    CreatedDate = x.CreatedDate,
                            //    IsDeleted = false
                            //});
                            //await _db.tProjectComponentCost.AddRangeAsync(SaveComponentCost);
                            //await _db.SaveChangesAsync();
                            #endregion

                            #region Component Per Year

                            //var NewComponentCostPerYear =
                            //(
                            //    from newcc in NewComponentCost
                            //    join oldcc in Components
                            //        on newcc.OldProjectRevisionFK equals oldcc.ProjectRevisionFK
                            //    join year in ComponentsPerYear
                            //        on oldcc.Id equals year.ComponentCostFK
                            //    select new DBHelper.Models.Table.Project.ProjectComponentCostPerYear
                            //    {
                            //        ComponentCostFK = newcc.Id,

                            //        ComponentId = year.ComponentId,

                            //        Amount = year.Amount,
                            //        Year = year.Year,
                            //        UACS = year.UACS,

                            //        StartDate = year.StartDate,
                            //        EndDate = year.EndDate,

                            //        CreatedBy = year.CreatedBy,
                            //        CreatedDate = year.CreatedDate,

                            //        IsDeleted = false
                            //    }
                            //)
                            //.ToList();

                            //await _db.tProjectComponentCostPerYear
                            //    .AddRangeAsync(NewComponentCostPerYear);
                            #endregion

                            // RelatedMajorWorkItem needs one new property:
                            //     public int OldWorkItemId { get; set; }

                            #region Major Work Items
                            var NewMajorWorkItems =
                            (
                                from newcc in NewComponentCost
                                join workItem in MajorItems
                                    on newcc.OldComponentCostId equals workItem.ComponentCostFK   // ← component, not revision
                                select new RelatedMajorWorkItem
                                {
                                    ComponentCostFK = newcc.Id,
                                    OldComponentCostFK = workItem.ComponentCostFK,
                                    OldWorkItemId = workItem.Id,          // ← the key the locations join needs

                                    ComponentId = workItem.ComponentId,

                                    YearOfWork = workItem.YearOfWork,
                                    WorkTypeFK = workItem.WorkTypeFK,
                                    InfraTypeFK = workItem.InfraTypeFK,

                                    CreatedBy = workItem.CreatedBy,
                                    CreatedDate = workItem.CreatedDate
                                }
                            )
                            .ToList();

                            var SaveNewMajorWorkItems = NewMajorWorkItems.Select(x => new DBHelper.Models.Table.Project.ProjectMajorWorkItem
                            {
                                ComponentCostFK = x.ComponentCostFK,
                                ComponentId = x.ComponentId,
                                YearOfWork = x.YearOfWork,
                                WorkTypeFK = x.WorkTypeFK,
                                InfraTypeFK = x.InfraTypeFK,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = false
                            })
                            .ToList();                                          // ← must materialize, was lazy

                            await _db.tProjectMajorWorkItem.AddRangeAsync(SaveNewMajorWorkItems, cancellationToken);
                            await _db.SaveChangesAsync(cancellationToken);

                            // copy the generated identity values back onto the DTOs (1:1, same order)
                            for (int i = 0; i < NewMajorWorkItems.Count; i++)
                                NewMajorWorkItems[i].Id = SaveNewMajorWorkItems[i].Id;
                            #endregion

                            #region Major Work Locations
                            var NewMajorWorkLocations =
                            (
                                from newworkitem in NewMajorWorkItems
                                join loc in MajorLocations
                                    on newworkitem.OldWorkItemId equals loc.WorkItemFK        // ← work item, not component
                                select new DBHelper.Models.Table.Project.ProjectMajorWorkLocations
                                {
                                    WorkItemFK = newworkitem.Id,

                                    ComponentId = loc.ComponentId,

                                    InfraId = loc.InfraId,
                                    DetailedScope = loc.DetailedScope,

                                    TargetUnitId = loc.TargetUnitId,
                                    TargetUnit = loc.TargetUnit,

                                    StartX = loc.StartX,
                                    StartY = loc.StartY,
                                    EndX = loc.EndX,
                                    EndY = loc.EndY,

                                    PhysicalTarget = loc.PhysicalTarget,

                                    StartStationLimit = loc.StartStationLimit,
                                    EndStationLimit = loc.EndStationLimit,

                                    StartChainage = loc.StartChainage,
                                    EndChainage = loc.EndChainage,

                                    Length = loc.Length,

                                    CreatedBy = loc.CreatedBy,
                                    CreatedDate = loc.CreatedDate,

                                    IsDeleted = false
                                }
                            )
                            .ToList();

                            await _db.tProjectMajorWorkLocations.AddRangeAsync(NewMajorWorkLocations, cancellationToken);
                            #endregion


                            #region Major Work Items


                            //var NewMajorWorkItems =
                            //(
                            //    from newcc in NewComponentCost
                            //    join oldcc in Components
                            //        on newcc.OldProjectRevisionFK equals oldcc.ProjectRevisionFK
                            //    join workItem in MajorItems
                            //        on oldcc.Id equals workItem.ComponentCostFK
                            //    select new RelatedMajorWorkItem
                            //    {
                            //        ComponentCostFK = newcc.Id,
                            //        OldComponentCostFK = workItem.ComponentCostFK,

                            //        ComponentId = workItem.ComponentId,

                            //        YearOfWork = workItem.YearOfWork,
                            //        WorkTypeFK = workItem.WorkTypeFK,
                            //        InfraTypeFK = workItem.InfraTypeFK,

                            //        CreatedBy = workItem.CreatedBy,
                            //        CreatedDate = workItem.CreatedDate
                            //    }
                            //)
                            //.ToList();
                            //var SaveNewMajorWorkItems = NewMajorWorkItems.Select(x => new DBHelper.Models.Table.Project.ProjectMajorWorkItem
                            //{
                            //    ComponentCostFK = x.ComponentCostFK,
                            //    ComponentId = x.ComponentId,
                            //    YearOfWork = x.YearOfWork,
                            //    WorkTypeFK = x.WorkTypeFK,
                            //    InfraTypeFK = x.InfraTypeFK,
                            //    CreatedBy = x.CreatedBy,
                            //    CreatedDate = x.CreatedDate,
                            //    IsDeleted = false
                            //});
                            //await _db.tProjectMajorWorkItem.AddRangeAsync(SaveNewMajorWorkItems);
                            //await _db.SaveChangesAsync();
                            #endregion

                            #region Major Work Locations


                            //var NewMajorWorkLocations =
                            //(
                            //    from newworkitem in NewMajorWorkItems
                            //    join oldworkitem in MajorItems
                            //        on newworkitem.OldComponentCostFK equals oldworkitem.ComponentCostFK
                            //    join loc in MajorLocations
                            //        on oldworkitem.Id equals loc.WorkItemFK
                            //    select new DBHelper.Models.Table.Project.ProjectMajorWorkLocations
                            //    {
                            //        WorkItemFK = newworkitem.Id,

                            //        ComponentId = loc.ComponentId,

                            //        InfraId = loc.InfraId,
                            //        DetailedScope = loc.DetailedScope,

                            //        TargetUnitId = loc.TargetUnitId,
                            //        TargetUnit = loc.TargetUnit,

                            //        StartX = loc.StartX,
                            //        StartY = loc.StartY,
                            //        EndX = loc.EndX,
                            //        EndY = loc.EndY,

                            //        PhysicalTarget = loc.PhysicalTarget,

                            //        StartStationLimit = loc.StartStationLimit,
                            //        EndStationLimit = loc.EndStationLimit,

                            //        StartChainage = loc.StartChainage,
                            //        EndChainage = loc.EndChainage,

                            //        Length = loc.Length,

                            //        CreatedBy = loc.CreatedBy,
                            //        CreatedDate = loc.CreatedDate,

                            //        IsDeleted = false
                            //    }
                            //)
                            //.ToList();
                            //await _db.tProjectMajorWorkLocations
                            //    .AddRangeAsync(NewMajorWorkLocations);
                            #endregion
                        }
                        #endregion
                        #region Supporting Documents
                        List<ProjectSupportingDocs> NewSupportingDocs = new List<ProjectSupportingDocs>();
                        if (SupportingDocuments.Count() > 0)
                        {
                            NewSupportingDocs =
                            (
                                from newRevision in NewRevisions
                                join oldRevision in ProjectRevisions
                                    on newRevision.ProjectFK equals oldRevision.ProjectFK
                                join sup in SupportingDocuments
                                    on oldRevision.Id equals sup.ProjectRevisionFK
                                select new ProjectSupportingDocs
                                {
                                    ProjectRevisionFK = newRevision.Id,
                                    DocTypeFK = sup.DocTypeFK,
                                    FileName = sup.FileName,
                                    FileExtension = sup.FileExtension,
                                    FilePath = sup.FilePath,
                                    Description = sup.Description,
                                    CreatedBy = sup.CreatedBy,
                                    CreatedDate = sup.CreatedDate
                                }
                            )
                            .ToList();
                            await _db.tProjectSupportingDocs.AddRangeAsync(NewSupportingDocs);
                        }
                        #endregion
                        #endregion

                        #endregion
                        return await AdvanceProgramAsync();
                    }
                }


                //var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                //{
                //    ProgramId = dto.ProgramId,
                //    StageName = dto.StageName,
                //    _Session = _Session,
                //    ViewOldStage = true
                //}, cancellationToken);
                //if (!ValidateProgram.IsValid)
                //{
                //    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                //}
                //ProgramParent = ValidateProgram.Data.Program;
                //ProgramRevision = ValidateProgram.Data.ProgramRevision;
                //ProgramStage = ValidateProgram.Data.ProgramStage;
                return new BadRequestObjectResult(new
                {
                    Message = "No projects are linked to this program.",
                    Title = "Project Link Missing"
                });
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                // The program's lock could not be had: a delete of this program is in progress.
                // Nothing was written.
                try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Update Failed" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> BatchRestrictPublish([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = "Program ID is required.",
                        Message = "Program ID cannot be empty or missing.",
                        Title = "Invalid Program"
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.ProjectIds))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "At least one project ID is required.",
                        Title = "No Projects Selected"
                    });
                }

                var programDetails = await _db.vProgramLatest
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.ProgramId == dto.ProgramId,
                        cancellationToken);

                if (programDetails == null)
                {
                    return await ProgramNotCurrentResultAsync(dto.ProgramId, cancellationToken);
                }

                var validationResult = await _db.ValidateProgramId(
                new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = programDetails.StageName,
                    _Session = _Session
                }, cancellationToken);

                if (!validationResult.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = validationResult.Message, Title = validationResult.Title, Message = validationResult.Message });
                }

                char[] delimiters =
                {
                    ';', ',', ' ', '\n', '\r', '\t'
                };

                var requestedProjectIds = dto.ProjectIds
                    .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (requestedProjectIds.Length == 0)
                {
                    return BadRequest(new
                    {
                        Message = "No valid project IDs were provided.",
                        Title = "No Projects Selected"
                    });
                }

                /*
                 * Correct SQL membership query.
                 * Do not serialize requestedProjectIds into JSON manually.
                 */
                var projectRevisions = await (
                    from revision in _db.vProjectLatest.AsNoTracking()

                    join project in _db.tProjects.AsNoTracking()
                        on revision.ProjectPK equals project.ProjectPK

                    where
                        revision.ProgramId == dto.ProgramId &&
                        revision.StageName == programDetails.StageName &&
                        revision.ProjectId != null &&
                        requestedProjectIds.Contains(revision.ProjectId)

                    select new
                    {
                        revision.ProjectId,
                        revision.ProjectPK,
                        project.IsPublished
                    })
                    .ToListAsync(cancellationToken);

                var existingProjectIds = projectRevisions
                    .Where(x => !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var missingProjectIds = requestedProjectIds
                    .Where(id => !existingProjectIds.Contains(id))
                    .ToArray();

                // 2026-10-05: once a project is published to PCMA, it is never published
                // again through this action -- re-publishing only happens through a
                // separate revision function/module, out of scope here. Skip already-
                // published projects rather than touching their IsPublishable flag, and
                // process the rest of the batch normally (operator-confirmed behavior).
                var alreadyPublishedProjectIds = projectRevisions
                    .Where(x => x.IsPublished && !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var projectPks = projectRevisions
                    .Where(x => !x.IsPublished && !string.IsNullOrWhiteSpace(x.ProjectPK))
                    .Select(x => x.ProjectPK!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (projectRevisions.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "None of the supplied project IDs were found.",
                        Title = "Projects Not Found",
                        MissingProjectIds = missingProjectIds,
                        SkippedAlreadyPublishedProjectIds = Array.Empty<string>()
                    });
                }

                // Mirrors BatchAllowPublish: matched-but-all-published is a neutral 200,
                // not an error -- the projects were found and skipped by design.
                if (projectPks.Length == 0)
                {
                    return Ok(new
                    {
                        Message =
                            "No changes were made. The matched project(s) are already " +
                            "published and are never restricted through this action.",
                        Title = "No Changes Required",
                        UpdatedCount = 0,
                        MissingProjectIds = missingProjectIds,
                        SkippedAlreadyPublishedProjectIds = alreadyPublishedProjectIds
                    });
                }

                // !IsPublished is repeated here (not just in the read above) so the guard
                // is atomic: a project published between the read and this write is left
                // untouched, and updatedCount only counts rows actually changed.
                var updatedCount = await _db.tProjects
                    .Where(x => projectPks.Contains(x.ProjectPK) && !x.IsPublished)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            project => project.IsPublishable,
                            false),
                        cancellationToken);

                if (updatedCount == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "Matching projects were found, but no project record was updated.",
                        Title = "No Projects Updated"
                    });
                }

                if (missingProjectIds.Length > 0 || alreadyPublishedProjectIds.Length > 0)
                {
                    var notes = new List<string>();
                    if (missingProjectIds.Length > 0)
                        notes.Add($"Not found: {string.Join(", ", missingProjectIds)}.");
                    if (alreadyPublishedProjectIds.Length > 0)
                        notes.Add($"Skipped (already published): {string.Join(", ", alreadyPublishedProjectIds)}.");

                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project(s) were excluded from automatic " +
                            $"publication to PCMA. {string.Join(" ", notes)}",
                        Title = "Restrict Publishing Partially Successful",
                        UpdatedCount = updatedCount,
                        MissingProjectIds = missingProjectIds,
                        SkippedAlreadyPublishedProjectIds = alreadyPublishedProjectIds
                    });
                }

                return Ok(new
                {
                    Message =
                        $"{updatedCount} project(s) were excluded from automatic publication to PCMA.",
                    Title = "Restrict Publishing Successful",
                    UpdatedCount = updatedCount,
                    MissingProjectIds = Array.Empty<string>(),
                    SkippedAlreadyPublishedProjectIds = Array.Empty<string>()
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> BatchAllowPublish([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                // ====================================================================
                // VALIDATE REQUEST
                // ====================================================================

                if (dto == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Request data is required.",
                        Title = "Invalid Request"
                    });
                }


                if (string.IsNullOrWhiteSpace(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = "Program ID is required.",
                        Message = "Program ID cannot be empty or missing.",
                        Title = "Invalid Program"
                    });
                }


                if (string.IsNullOrWhiteSpace(dto.ProjectIds))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "At least one project ID is required.",
                        Title = "No Projects Selected"
                    });
                }


                // ====================================================================
                // GET CURRENT PROGRAM
                // ====================================================================

                var programDetails = await _db.vProgramLatest
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.ProgramId == dto.ProgramId,
                        cancellationToken);


                if (programDetails == null)
                {
                    return await ProgramNotCurrentResultAsync(dto.ProgramId, cancellationToken);
                }


                // ====================================================================
                // VALIDATE PROGRAM / USER / STAGE
                // ====================================================================

                var validationResult = await _db.ValidateProgramId(
                    new ProgramHelperParams
                    {
                        ProgramId = dto.ProgramId,
                        StageName = programDetails.StageName,
                        _Session = _Session
                    },
                    cancellationToken);


                if (!validationResult.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = validationResult.Message, Title = validationResult.Title, Message = validationResult.Message });
                }


                // ====================================================================
                // PARSE PROJECT IDS
                // ====================================================================

                char[] delimiters =
                {
            ';',
            ',',
            ' ',
            '\n',
            '\r',
            '\t'
        };


                var requestedProjectIds = dto.ProjectIds
                    .Split(
                        delimiters,
                        StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                if (requestedProjectIds.Length == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "No valid project IDs were provided.",
                        Title = "No Projects Selected"
                    });
                }


                // ====================================================================
                // GET MATCHING PROJECTS
                //
                // IMPORTANT:
                //
                // We validate Program + current Stage HERE before passing ProjectIds
                // to pAllowProjectPublishing.
                //
                // This prevents a ProjectId supplied in the request from being sent to
                // the SP unless it belongs to the Program / Stage being processed.
                // ====================================================================

                var matchedProjects = await (
                    from revision in _db.vProjectLatest.AsNoTracking()

                    join project in _db.tProjects.AsNoTracking()
                        on revision.ProjectPK equals project.ProjectPK

                    where
                        revision.ProgramId == dto.ProgramId
                        && revision.StageName == programDetails.StageName
                        && revision.ProjectId != null
                        && requestedProjectIds.Contains(revision.ProjectId)

                    select new
                    {
                        ProjectId = revision.ProjectId,
                        ProjectPK = project.ProjectPK,
                        project.IsPublishable,
                        project.IsPublished
                    })
                    .ToListAsync(cancellationToken);


                // ====================================================================
                // PROJECT IDS THAT ACTUALLY EXIST
                // ====================================================================

                var existingProjectIds = matchedProjects
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);


                // ====================================================================
                // PROJECT IDS THAT WERE NOT FOUND
                // ====================================================================

                var missingProjectIds = requestedProjectIds
                    .Where(id =>
                        !existingProjectIds.Contains(id))
                    .ToArray();


                // ====================================================================
                // PROJECTS ALREADY PUBLISHED TO PCMA
                //
                // 2026-10-05: once a project is published, it is never published again
                // through this action -- re-publishing only happens through a separate
                // revision function/module, out of scope here. Skip them rather than
                // sending them to pAllowProjectPublishing, and process the rest of the
                // batch normally (operator-confirmed behavior).
                // ====================================================================

                var alreadyPublishedProjectIds = matchedProjects
                    .Where(x => x.IsPublished && !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                // ====================================================================
                // PROJECTS ALREADY PUBLISHABLE
                //
                // No need to send these to pAllowProjectPublishing.
                // ====================================================================

                var alreadyAllowedProjectIds = matchedProjects
                    .Where(x => x.IsPublishable && !x.IsPublished)
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                // ====================================================================
                // PROJECTS THAT ARE CURRENTLY RESTRICTED
                //
                // IMPORTANT:
                //
                // pAllowProjectPublishing accepts PROJECT IDS, not ProjectPK values.
                // Already-published projects are excluded here too (see above) so they
                // are never sent to the SP at all.
                // ====================================================================

                var restrictedProjectIds = matchedProjects
                    .Where(x =>
                        !x.IsPublishable
                        && !x.IsPublished
                        && !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                // ====================================================================
                // NOTHING MATCHED
                // ====================================================================

                if (matchedProjects.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "None of the supplied project IDs were found.",

                        Title =
                            "Projects Not Found",

                        UpdatedCount =
                            0,

                        MissingProjectIds =
                            missingProjectIds,

                        SkippedAlreadyPublishedProjectIds =
                            Array.Empty<string>()
                    });
                }


                // ====================================================================
                // EVERYTHING ALREADY ALLOWED, OR ONLY ALREADY-PUBLISHED PROJECTS MATCHED
                // ====================================================================

                if (restrictedProjectIds.Length == 0)
                {
                    return Ok(new
                    {
                        Message =
                            alreadyPublishedProjectIds.Length > 0 && alreadyAllowedProjectIds.Length == 0
                                ? "No changes were made. The matched project(s) are already " +
                                  "published and are never re-validated through this action."
                                : "No changes were required because all matching projects " +
                                  "are already allowed for automatic publication to PCMA.",

                        Title =
                            "No Changes Required",

                        UpdatedCount =
                            0,

                        MissingProjectIds =
                            missingProjectIds,

                        AlreadyAllowedProjectIds =
                            alreadyAllowedProjectIds,

                        SkippedAlreadyPublishedProjectIds =
                            alreadyPublishedProjectIds
                    });
                }


                // ====================================================================
                // REMEMBER WHICH PROJECTS WERE RESTRICTED BEFORE SP EXECUTION
                // ====================================================================

                var beforeStatuses = matchedProjects
                    .Where(x =>
                        !x.IsPublishable
                        && !x.IsPublished
                        && !string.IsNullOrWhiteSpace(x.ProjectId))
                    .ToDictionary(
                        x => x.ProjectPK,
                        x => x.ProjectId!,
                        StringComparer.OrdinalIgnoreCase);


                // ====================================================================
                // SERIALIZE PROJECT IDS TO JSON
                //
                // pAllowProjectPublishing expects:
                //
                // [
                //     "P00000123LZ",
                //     "P00000124LZ",
                //     "P00000125LZ"
                // ]
                //
                // Deliberately NOT pRecomputeProjectPublishable: that procedure
                // unconditionally recomputes IsPublishable from the 7 GAA-R rules for
                // every matched project, regardless of its current value -- it can
                // DEMOTE a project that is currently IsPublishable=true/IsPublished=false
                // (eligible, just not yet published) back to false if its data no longer
                // perfectly satisfies all 7 rules. pAllowProjectPublishing cannot do that
                // by construction: it only ever grants (never sets IsPublishable=0 for a
                // project that fails validation). Confirmed 2026-08-25 (operator).
                // ====================================================================

                var projectIdsJson =
                    JsonConvert.SerializeObject(
                        restrictedProjectIds);


                // ====================================================================
                // TRANSACTION
                // ====================================================================

                await using var transaction =
                    await _db.Database.BeginTransactionAsync(
                        cancellationToken);


                // ====================================================================
                // CALL pAllowProjectPublishing
                //
                // IMPORTANT:
                //
                // We do NOT use:
                //
                // SqlQuery<int>()
                //
                // because pAllowProjectPublishing returns multiple result sets:
                //
                // 1. Summary
                // 2. Detailed project validation
                //
                // For this endpoint we do not need to consume those result sets.
                // We re-query tProjects afterward to determine exactly which projects
                // became publishable.
                //
                // ExecuteSqlInterpolatedAsync also parameterizes projectIdsJson.
                // ====================================================================

                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $"""
            EXEC dbo.pAllowProjectPublishing
                @ProjectIds = {projectIdsJson}
            """,
                    cancellationToken);


                // ====================================================================
                // RE-QUERY AFTER SP
                //
                // AsNoTracking ensures we get the current database IsPublishable value.
                // ====================================================================

                var recomputedProjects = await (
                    from revision in _db.vProjectLatest.AsNoTracking()

                    join project in _db.tProjects.AsNoTracking()
                        on revision.ProjectPK equals project.ProjectPK

                    where
                        revision.ProgramId == dto.ProgramId
                        && revision.StageName == programDetails.StageName
                        && revision.ProjectId != null
                        && requestedProjectIds.Contains(revision.ProjectId)

                    select new
                    {
                        ProjectId = revision.ProjectId,
                        ProjectPK = project.ProjectPK,
                        project.IsPublishable
                    })
                    .ToListAsync(cancellationToken);


                // ====================================================================
                // COMMIT
                // ====================================================================

                await transaction.CommitAsync(
                    cancellationToken);


                // ====================================================================
                // PROJECTS SUCCESSFULLY RESTORED
                //
                // These were:
                //
                // BEFORE = IsPublishable false
                // AFTER  = IsPublishable true
                // ====================================================================

                var restoredProjectIds = recomputedProjects
                    .Where(x =>
                        beforeStatuses.ContainsKey(x.ProjectPK)
                        && x.IsPublishable)
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                // ====================================================================
                // PROJECTS THAT FAILED pAllowProjectPublishing VALIDATION
                //
                // These remain:
                //
                // IsPublishable = false
                // ====================================================================

                var notRestoredProjectIds = recomputedProjects
                    .Where(x =>
                        beforeStatuses.ContainsKey(x.ProjectPK)
                        && !x.IsPublishable)
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();


                var updatedCount =
                    restoredProjectIds.Length;


                // ====================================================================
                // NONE PASSED VALIDATION
                // ====================================================================

                if (updatedCount == 0)
                {
                    return Ok(new
                    {
                        Message =
                            "No selected project became publishable. " +
                            "Projects that still fail publishability validation " +
                            "remain excluded from automatic publication to PCMA.",

                        Title =
                            "No Projects Restored",

                        UpdatedCount =
                            0,

                        RestoredProjectIds =
                            restoredProjectIds,

                        NotRestoredProjectIds =
                            notRestoredProjectIds,

                        MissingProjectIds =
                            missingProjectIds,

                        AlreadyAllowedProjectIds =
                            alreadyAllowedProjectIds,

                        SkippedAlreadyPublishedProjectIds =
                            alreadyPublishedProjectIds
                    });
                }


                // ====================================================================
                // SOME REQUESTED IDS WERE NOT FOUND
                // ====================================================================

                if (missingProjectIds.Length > 0)
                {
                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project(s) were restored for automatic " +
                            "publication to PCMA. Some project IDs were not found.",

                        Title =
                            "Undo Restriction Partially Successful",

                        UpdatedCount =
                            updatedCount,

                        RestoredProjectIds =
                            restoredProjectIds,

                        NotRestoredProjectIds =
                            notRestoredProjectIds,

                        MissingProjectIds =
                            missingProjectIds,

                        AlreadyAllowedProjectIds =
                            alreadyAllowedProjectIds,

                        SkippedAlreadyPublishedProjectIds =
                            alreadyPublishedProjectIds
                    });
                }


                // ====================================================================
                // SOME PROJECTS EXISTED BUT FAILED VALIDATION
                // ====================================================================

                if (notRestoredProjectIds.Length > 0)
                {
                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project(s) were restored for automatic " +
                            "publication to PCMA. Some projects remain restricted " +
                            "because they failed publishability validation.",

                        Title =
                            "Undo Restriction Partially Successful",

                        UpdatedCount =
                            updatedCount,

                        RestoredProjectIds =
                            restoredProjectIds,

                        NotRestoredProjectIds =
                            notRestoredProjectIds,

                        MissingProjectIds =
                            missingProjectIds,

                        AlreadyAllowedProjectIds =
                            alreadyAllowedProjectIds,

                        SkippedAlreadyPublishedProjectIds =
                            alreadyPublishedProjectIds
                    });
                }


                // ====================================================================
                // SUCCESS
                // ====================================================================

                return Ok(new
                {
                    Message =
                        $"{updatedCount} project(s) were restored for automatic " +
                        "publication to PCMA.",

                    Title =
                        "Undo Restriction Successful",

                    UpdatedCount =
                        updatedCount,

                    RestoredProjectIds =
                        restoredProjectIds,

                    NotRestoredProjectIds =
                        Array.Empty<string>(),

                    MissingProjectIds =
                        Array.Empty<string>(),

                    AlreadyAllowedProjectIds =
                        alreadyAllowedProjectIds,

                    SkippedAlreadyPublishedProjectIds =
                        alreadyPublishedProjectIds
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(
                    ex,
                    dto,
                    _Session.UserId.ToString());
            }
        }

        /// <summary>A project id Batch Delete will not touch, and why.</summary>
        public sealed record BatchDeleteRefusal(string ProjectId, string Reason);

        /// <summary>What Batch Delete would do, resolved by the single deletion rule.</summary>
        private sealed class BatchDeletePlan
        {
            public string ProgramPK { get; init; } = string.Empty;
            public string StageName { get; init; } = string.Empty;
            public List<(string Ref, string ProjectFK)> Hard { get; } = new();
            public List<(string Ref, string ProjectFK, int RevisionId)> Soft { get; } = new();
            public List<BatchDeleteRefusal> Refused { get; } = new();
            public string[] Missing { get; set; } = Array.Empty<string>();
        }

        /// <summary>
        /// Validates a Batch Delete request and resolves every id through Functions/GetProjectDeletionTier.sql.
        /// Read-only. Shared by <see cref="BatchDelete"/> and <see cref="PreviewBatchDelete"/> so the
        /// preview a user confirms is exactly what the delete then does.
        /// </summary>
        /// <summary>
        /// The 400 for a batch action that found no program at the ProgramId sent. It names the
        /// program and its current stage, not the id (UAT S01-TC008-P001; see
        /// ProgramHelper.DescribeProgramNotCurrentAsync).
        /// </summary>
        private async Task<BadRequestObjectResult> ProgramNotCurrentResultAsync(string programId, CancellationToken cancellationToken)
        {
            var (title, message) = await _db.DescribeProgramNotCurrentAsync(programId, cancellationToken);
            return new BadRequestObjectResult(new { Data = message, Message = message, Title = title });
        }

        private async Task<(IActionResult? Error, BatchDeletePlan? Plan)> ResolveBatchDeleteAsync(
            BatchUnpublishTaggingDTO? dto, CancellationToken cancellationToken)
        {
            if (dto == null)
            {
                return (new BadRequestObjectResult(new { Message = "Request data is required.", Title = "Invalid Request" }), null);
            }

            if (string.IsNullOrWhiteSpace(dto.ProgramId))
            {
                return (new BadRequestObjectResult(new { Message = "Program ID is required.", Title = "Invalid Program" }), null);
            }

            if (string.IsNullOrWhiteSpace(dto.ProjectIds))
            {
                return (new BadRequestObjectResult(new { Message = "At least one project ID is required.", Title = "No Projects Selected" }), null);
            }

            var programDetails = await _db.vProgramLatest
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId, cancellationToken);

            if (programDetails == null)
            {
                return (await ProgramNotCurrentResultAsync(dto.ProgramId, cancellationToken), null);
            }

            var validationResult = await _db.ValidateProgramId(
            new ProgramHelperParams
            {
                ProgramId = dto.ProgramId,
                StageName = programDetails.StageName,
                _Session = _Session
            }, cancellationToken);

            if (!validationResult.IsValid)
            {
                return (new BadRequestObjectResult(new { Data = validationResult.Message, Title = validationResult.Title, Message = validationResult.Message }), null);
            }

            char[] delimiters = { ';', ',', ' ', '\n', '\r', '\t' };

            var requestedProjectIds = dto.ProjectIds
                .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (requestedProjectIds.Length == 0)
            {
                return (new BadRequestObjectResult(new { Message = "No valid project IDs were provided.", Title = "No Projects Selected" }), null);
            }

            /*
             * 2026-10-15: ONE DELETION RULE, PREFIX-AGNOSTIC
             * (documents/plans/project-deletion-single-rule.md).
             *
             * Every id is resolved and judged by Functions/GetProjectDeletionTier.sql, the same
             * script Delete Program and both Lump Sum deletes use. It accepts the
             * ProjectPK or any revision ProjectId of the project under this program, so
             * after BP->NEP both BP01000002LZ (the PK) and P01000002LZ (the revision id)
             * name the same project. Its tier decides what happens here:
             *   Hard  (first stage entry)     -> ExecuteProjectDeletion.sql (via ProjectHelper), rows removed;
             *   Soft  (progressed past it)    -> the current-stage revision is flagged, as before;
             *   Blocked (published, or the program is Approved) -> refused.
             * Lump Sum parents and itemized children are refused too: the Lump Sum module
             * owns them, and only it returns a child's allocation to its parent.
             *
             * Scoped by ProgramPK and the program's current StageId through tProjectStages,
             * not by vProjectLatest: the revision a soft delete flags is the project's live
             * revision AT THIS STAGE, never an earlier stage's revision a cross-stage
             * fallback might return.
             */
            var plan = new BatchDeletePlan
            {
                ProgramPK = validationResult.Data!.Program.ProgramPK,
                StageName = programDetails.StageName ?? string.Empty
            };
            var currentStageId = validationResult.Data.ProgramStage.StageId;

            var tiers = await _db.DetermineProjectDeletionTiersAsync(requestedProjectIds, plan.ProgramPK, cancellationToken);
            var tiersByRef = tiers
                .GroupBy(x => x.Ref, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

            var candidates = new List<(string Ref, ProjectHelper.ProjectDeletionTierResult Tier)>();
            var firstRefByProjectFK = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var id in requestedProjectIds)
            {
                if (!tiersByRef.TryGetValue(id, out var rows))
                {
                    continue; // reported in Missing below
                }
                if (rows.Count > 1)
                {
                    // One string, two projects (one's PK, another's revision id): never guess
                    // which one a user meant when the outcome may be a hard delete.
                    plan.Refused.Add(new BatchDeleteRefusal(id, "matches more than one project in this program"));
                    continue;
                }
                var row = rows[0];
                if (row.Tier == ProjectHelper.ProjectDeletionTiers.Blocked)
                {
                    plan.Refused.Add(new BatchDeleteRefusal(id, row.Reason));
                }
                else if (row.Kind != ProjectHelper.ProjectDeletionKinds.Ordinary)
                {
                    plan.Refused.Add(new BatchDeleteRefusal(id, "Lump Sum project; delete it from the Lump Sum module"));
                }
                else if (firstRefByProjectFK.TryGetValue(row.ProjectFK, out var firstRef))
                {
                    // The BP- and P-form of one project: deleted once, and the second form says so.
                    plan.Refused.Add(new BatchDeleteRefusal(id, $"same project as {firstRef}"));
                }
                else
                {
                    firstRefByProjectFK[row.ProjectFK] = id;
                    candidates.Add((id, row));
                }
            }

            var candidateFKs = candidates.Select(x => x.Tier.ProjectFK).ToArray();
            var programPK = plan.ProgramPK;
            var liveAtStage = await (
                    from stage in _db.tProjectStages
                    join revision in _db.tProjectRevisions on stage.RevisionId equals revision.Id
                    where stage.ProgramFK == programPK
                          && stage.StageId == currentStageId
                          && candidateFKs.Contains(stage.ProjectFK)
                          && !revision.IsDeleted
                    group revision by revision.ProjectFK into g
                    select new { ProjectFK = g.Key, RevisionId = g.Max(x => x.Id) })
                .ToDictionaryAsync(x => x.ProjectFK, x => x.RevisionId, StringComparer.OrdinalIgnoreCase, cancellationToken);

            var notLiveHere = new List<string>();
            foreach (var (projectRef, tier) in candidates)
            {
                if (!liveAtStage.TryGetValue(tier.ProjectFK, out var revisionId))
                {
                    notLiveHere.Add(projectRef); // not at this stage, or already deleted here
                }
                else if (tier.Tier == ProjectHelper.ProjectDeletionTiers.Hard)
                {
                    plan.Hard.Add((projectRef, tier.ProjectFK));
                }
                else
                {
                    plan.Soft.Add((projectRef, tier.ProjectFK, revisionId));
                }
            }

            plan.Missing = requestedProjectIds
                .Where(id => !tiersByRef.ContainsKey(id))
                .Concat(notLiveHere)
                .ToArray();

            return (null, plan);
        }

        /// <summary>
        /// What Batch Delete would do with these ids, without doing it: which projects would be
        /// permanently deleted (first stage entry), which deleted at the current stage
        /// (restorable), which refused and why, and which were not found. Writes nothing.
        /// </summary>
        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> PreviewBatchDelete([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (error, plan) = await ResolveBatchDeleteAsync(dto, cancellationToken);
                if (error != null) return error;

                return Ok(new
                {
                    Message =
                        $"{plan!.Hard.Count} project(s) would be permanently deleted, " +
                        $"{plan.Soft.Count} deleted at the current stage.",
                    Title = "Batch Delete Preview",
                    HardProjectIds = plan.Hard.Select(x => x.Ref).ToArray(),
                    SoftProjectIds = plan.Soft.Select(x => x.Ref).ToArray(),
                    RefusedProjects = plan.Refused,
                    MissingProjectIds = plan.Missing
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> BatchDelete([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            // 2026-09-21: the delete and the program cost recompute below must land together.
            // 2026-10-04: opened just before the first write rather than here. Everything above
            // that point is validation and read-only lookups, and a rejected request should not
            // pay for a transaction or hold those reads inside one.
            IDbContextTransaction? transaction = null;
            try
            {
                var (error, plan) = await ResolveBatchDeleteAsync(dto, cancellationToken);
                if (error != null) return error;

                if (plan!.Hard.Count == 0 && plan.Soft.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "None of the supplied project IDs can be deleted from the current program and stage.",
                        Title = "Projects Not Found",
                        MissingProjectIds = plan.Missing,
                        RefusedProjects = plan.Refused
                    });
                }

                transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                DateTime currentDate = Functions.CurrentDate();

                // 2026-10-16: the per-program delete lock first (every delete in a program queues behind
                // it, so two never deadlock), then every decision on locked rows.
                await _db.AcquireProgramDeletionLockAsync(plan.ProgramPK, cancellationToken);

                // The plan was read before the transaction: decide every project again, on locked rows,
                // in one pass, so an approval, publish or stage advance that landed in between refuses
                // the batch instead of slipping by.
                var decided = await _db.DecideProjectDeletionsUnderLockAsync(
                    plan.Hard.Select(x => x.ProjectFK).Concat(plan.Soft.Select(x => x.ProjectFK)), plan.ProgramPK, cancellationToken);
                foreach (var (softRef, softProjectFK, _) in plan.Soft)
                {
                    var tier = decided[softProjectFK];
                    if (tier.Tier != ProjectHelper.ProjectDeletionTiers.Soft)
                    {
                        throw new ProjectHelper.DeletionRefusedException($"Project {softRef} can no longer be deleted here: {tier.Reason}.");
                    }
                }

                // Hard: the script removes the rows and writes each project's audit row (it refuses
                // anything the locked decision did not rate Hard).
                foreach (var (_, projectFK) in plan.Hard)
                {
                    await _db.DeleteDecidedProjectAsync(decided[projectFK], plan.ProgramPK, _Session.UserId, currentDate, cancellationToken);
                }

                var softRevisionIds = plan.Soft.Select(x => x.RevisionId).ToArray();
                var softCount = softRevisionIds.Length == 0
                    ? 0
                    : await _db.tProjectRevisions
                        .Where(x => softRevisionIds.Contains(x.Id) && !x.IsDeleted)
                        .ExecuteUpdateAsync(
                            setters => setters.SetProperty(revision => revision.IsDeleted, true),
                            cancellationToken);

                // 2026-10-15: one audit row per soft-deleted project, in this transaction.
                _db.AddSoftDeleteAuditRows(
                    plan.Soft.Select(x => (x.ProjectFK, x.RevisionId, (string?)plan.StageName)),
                    deleted: true, _Session.UserId, currentDate);
                await _db.SaveChangesAsync(cancellationToken);

                // 2026-09-21: a deleted project no longer counts toward its program's Cost
                // (pRecomputeProgramCost counts ordinary projects on their latest live revision
                // at the current stage), and Program Details reads the STORED
                // tProgramRevisions.Cost -- so without this the header kept the pre-delete
                // figure until some other write recomputed it. Same helper every other
                // project-mutating action uses (Helpers/ProgramCostRecompute.cs).
                await _db.RecomputeProgramCostAsync(plan.ProgramPK, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                var updatedCount = plan.Hard.Count + softCount;
                bool partial = plan.Missing.Length > 0 || plan.Refused.Count > 0;
                return Ok(new
                {
                    Message =
                        $"{plan.Hard.Count} project(s) permanently deleted (first stage entry), " +
                        $"{softCount} project(s) deleted at the current stage." +
                        (partial ? " Some project IDs were not found or cannot be deleted here." : string.Empty),
                    Title = partial ? "Project Deletion Partially Successful" : "Project Deletion Successful",
                    UpdatedCount = updatedCount,
                    HardDeletedProjectIds = plan.Hard.Select(x => x.Ref).ToArray(),
                    SoftDeletedProjectIds = plan.Soft.Select(x => x.Ref).ToArray(),
                    MissingProjectIds = plan.Missing,
                    RefusedProjects = plan.Refused
                });
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                // The procedure re-checked a tier and refused (e.g. the program was approved
                // between the resolve and the delete). Nothing was committed.
                if (transaction != null)
                {
                    try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                }
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Delete Not Allowed" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                if (transaction != null)
                {
                    try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                }
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                if (transaction != null)
                {
                    // 2026-10-06: CancellationToken.None, not the request's token. When the
                    // request is cancelled mid-write, `ex` is that cancellation, and a rollback
                    // handed the same token throws again here, inside the catch, so the error
                    // never reached _exceptionHandler and went out as a raw 500, unlogged.
                    // A rollback that fails for any other reason must not mask `ex` either;
                    // DisposeAsync in the finally still rolls back an uncommitted transaction.
                    try
                    {
                        await transaction.RollbackAsync(CancellationToken.None);
                    }
                    catch
                    {
                    }
                }
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
            finally
            {
                if (transaction != null)
                {
                    await transaction.DisposeAsync();
                }
            }
        }

        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> BatchAddExistingProject([FromBody] BatchAddExistingProjectDTO dto, CancellationToken cancellationToken)
        {
            // 2026-10-24 (RS2, batch-add-existing-project-restore-fixes.md): opened just before the
            // first write, as BatchDelete does, not here. Everything up to the lock is validation
            // and read-only id resolution, and a rejected request should not pay for a transaction.
            IDbContextTransaction? transaction = null;
            try
            {
                // 2026-09-05: aligned with its 3 sibling Batch* actions (BatchRestrictPublish,
                // BatchAllowPublish, BatchDelete), which all have these same guards -- this one
                // previously had none, falling straight through to a DB lookup on a possibly-null
                // dto or a generic, less-helpful error on a blank/whitespace-only ProjectIds.
                if (dto == null)
                {
                    return new BadRequestObjectResult(new { Message = "Request data is required.", Title = "Invalid Request" });
                }
                if (string.IsNullOrWhiteSpace(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new {
                        Data = "Program ID is required.",
                        Message = "Program ID cannot be empty or missing.",
                        Title = "Invalid Program"
                    });
                }
                if (string.IsNullOrWhiteSpace(dto.ProjectIds))
                {
                    return new BadRequestObjectResult(new { Message = "At least one project ID is required.", Title = "No Projects Selected" });
                }
                DateTime CurrentDate = Functions.CurrentDate();
                var checkProgram = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return await ProgramNotCurrentResultAsync(dto.ProgramId, cancellationToken);
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = checkProgram.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new { Data = ValidateProgramId.Message, Title = ValidateProgramId.Title, Message = ValidateProgramId.Message });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                // 2026-09-05: was { ';', ',', '.', '&', ' ', '\n', '\r', '\t' } -- the extra '.'
                // and '&' were unique to this one action, a silent divergence from all 3 sibling
                // Batch* actions. Aligned to the same delimiter set as its siblings.
                char[] delimiters = { ';', ',', ' ', '\n', '\r', '\t' };
                var projectIds = dto.ProjectIds
                    .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                // Resolve the deleted revisions that belong to THIS program, across all of its
                // stages, so a project is restored regardless of which stage it was deleted on.
                //
                // 2026-10-04 (RISK: cross-program restore): the lookup below used to filter on
                // ProjectId and IsDeleted alone, so an id belonging to another program was
                // un-deleted there and reported as restored here. That was harmless only while
                // this action could never commit (see the 2026-09-21 note below); once it could,
                // the scope became load-bearing. ProgramFK rather than ProgramId: a revision
                // keeps the ProgramId of the stage it was written on, which differs from the
                // program's current one, while ProgramFK is the same on every stage.

                // 2026-09-21: materialized ONCE, before the update. This used to be a deferred
                // IQueryable that was re-evaluated three times synchronously -- and the two
                // evaluations AFTER the ExecuteUpdate below saw `IsDeleted = 0` rows, i.e. nothing:
                // restoredSet came back empty (every id reported "not found") and `.Count() > 0`
                // was false, so the action answered "No Projects Restored" and let the transaction
                // dispose without a commit, rolling its own restore back. It could never succeed.
                // 2026-10-15: ids are resolved by Functions/GetProjectDeletionTier.sql, the same resolver
                // Batch Delete uses, so the BP-form ProjectPK and the P-form revision ProjectId
                // both find the project (only its ProjectFK is used; restore is not a delete).
                // A hard-deleted project no longer exists and is reported as not found; an
                // ambiguous reference (one string, two projects) is not restored.
                // 2026-10-24: read here without a lock to refuse what can never be restored before a
                // transaction is opened (RS2); decided again on locked rows below before anything is
                // written, as Batch Delete does.
                var resolved = await _db.DetermineProjectDeletionTiersAsync(projectIds, ProgramParent.ProgramPK, cancellationToken);

                // 2026-10-25 (review R2): the tier resolver ignores IsDeleted, so it also finds live
                // projects. Only a project with a deleted revision in this program is a restore
                // candidate; any other is left out here and reported as "not found or not deleted",
                // not refused as "published" / "program is approved" as if it were deleted and blocked.
                var resolvedFKs = resolved.Select(x => x.ProjectFK).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                var deletedFKs = (await _db.tProjectRevisions.AsNoTracking()
                        .Where(r => r.ProgramFK == ProgramParent.ProgramPK && resolvedFKs.Contains(r.ProjectFK) && r.IsDeleted)
                        .Select(r => r.ProjectFK)
                        .Distinct()
                        .ToListAsync(cancellationToken))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var refused = new List<BatchDeleteRefusal>();
                var projectFKByRef = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var refGroup in resolved.GroupBy(x => x.Ref, StringComparer.OrdinalIgnoreCase))
                {
                    var rows = refGroup.ToList();
                    bool ambiguous = rows.Select(x => x.ProjectFK).Distinct(StringComparer.OrdinalIgnoreCase).Count() > 1;
                    if (!ambiguous && !deletedFKs.Contains(rows[0].ProjectFK))
                    {
                        continue;
                    }
                    string? reason = ambiguous
                        ? "matches more than one project in this program"
                        : RestoreRefusal(rows[0]);
                    if (reason != null)
                    {
                        refused.Add(new BatchDeleteRefusal(refGroup.Key, reason));
                    }
                    else
                    {
                        projectFKByRef[refGroup.Key] = rows[0].ProjectFK;
                    }
                }
                var refusedRefs = refused.Select(x => x.ProjectId).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var projectFKs = projectFKByRef.Values.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

                if (projectFKs.Length == 0)
                {
                    return NothingRestored(projectIds.Where(x => !refusedRefs.Contains(x)).ToArray(), refused);
                }

                transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                // 2026-10-16: the per-program delete lock first, so a restore never runs alongside a
                // delete in the same program.
                await _db.AcquireProgramDeletionLockAsync(ProgramParent.ProgramPK, cancellationToken);

                // 2026-10-24: every project decided again on locked rows (project, its stages, the
                // program's status), so a publish or an approval that landed after the read above
                // refuses the batch instead of slipping by. Throws when a project is no
                // longer there (e.g. a concurrent hard delete).
                var decided = await _db.DecideProjectDeletionsUnderLockAsync(projectFKs, ProgramParent.ProgramPK, cancellationToken);
                foreach (var (projectRef, projectFK) in projectFKByRef)
                {
                    var reason = RestoreRefusal(decided[projectFK]);
                    if (reason != null)
                    {
                        throw new ProjectHelper.DeletionRefusedException($"Project {projectRef} can no longer be restored here: {reason}.");
                    }
                }

                // 2026-10-24 (RS5, confirmed 2026-10-25: latest deleted revision only): only the project's
                // LATEST deleted revision in this program comes back (Max(Id)), as before. Batch
                // Delete flags one revision per call (the current stage's), so this is its inverse
                // for the most recent delete; an older stage's deleted revision needs another restore.
                var latestDeletedRevisions = await (
                    from revision in _db.tProjectRevisions
                    where revision.ProgramFK == ProgramParent.ProgramPK
                          && projectFKs.Contains(revision.ProjectFK)
                          && revision.IsDeleted
                    group revision by revision.ProjectFK
                    into revisionGroup
                    select new
                    {
                        ProjectFK = revisionGroup.Key,
                        Id = revisionGroup.Max(x => x.Id)
                    })
                    .ToListAsync(cancellationToken);
                HashSet<int> ProjectRevisionIds = latestDeletedRevisions.Select(x => x.Id).ToHashSet();
                var projectsToRestore = await _db.tProjectRevisions.Where(x => ProjectRevisionIds.Contains(x.Id))
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            revision => revision.IsDeleted,
                            false),
                        cancellationToken);

                var restoredFKs = latestDeletedRevisions.Select(x => x.ProjectFK).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var restoredSet = new HashSet<string>(
                    projectFKByRef.Where(x => restoredFKs.Contains(x.Value)).Select(x => x.Key),
                    StringComparer.OrdinalIgnoreCase
                );

                var missingProjectIds = projectIds
                    .Where(x => !restoredSet.Contains(x) && !refusedRefs.Contains(x))
                    .ToArray();

                if (latestDeletedRevisions.Count > 0)
                {
                    // 2026-10-15: one audit row per restored project (IsDeleted true -> false),
                    // the inverse of Batch Delete's soft-delete row, in this transaction.
                    var restoredStageNames = await _db.tProjectStages.AsNoTracking()
                        .Where(x => ProjectRevisionIds.Contains(x.RevisionId))
                        .Select(x => new { x.RevisionId, x.StageName })
                        .ToListAsync(cancellationToken);
                    _db.AddSoftDeleteAuditRows(
                        latestDeletedRevisions.Select(x => (
                            x.ProjectFK,
                            x.Id,
                            restoredStageNames.FirstOrDefault(s => s.RevisionId == x.Id)?.StageName)),
                        deleted: false, _Session.UserId, CurrentDate);
                    await _db.SaveChangesAsync(cancellationToken);

                    // 2026-10-24 (RS1): a restored project counts toward its program's Cost again,
                    // and Program Details reads the STORED tProgramRevisions.Cost, so recompute it
                    // before the commit, exactly as BatchDelete does after its delete. Without this
                    // the header kept the post-delete figure.
                    await _db.RecomputeProgramCostAsync(ProgramParent.ProgramPK, cancellationToken);

                    // The restore itself went through ExecuteUpdateAsync (no change tracking);
                    // the commit is what persists it, together with the audit rows and the Cost.
                    await transaction.CommitAsync(cancellationToken);

                    bool partial = missingProjectIds.Length > 0 || refused.Count > 0;
                    return Ok(new
                    {
                        Message =
                            $"{latestDeletedRevisions.Count} project(s) restored to their original stage." +
                            (partial ? " " + DescribeNotRestored(missingProjectIds, refused) : string.Empty),
                        Title = partial ? "Restore Projects Partially Successful" : "Restore Projects Successful",
                        UpdatedCount = projectsToRestore,
                        RestoredProjectIds = projectIds.Where(x => restoredSet.Contains(x)).ToArray(),
                        MissingProjectIds = missingProjectIds,
                        RefusedProjects = refused
                    });
                }

                // Nothing was written; DisposeAsync in the finally rolls the empty transaction back.
                return NothingRestored(missingProjectIds, refused);
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                // The program delete lock could not be had (a Delete Program of it is running).
                if (transaction != null)
                {
                    try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                }
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Restore Not Possible" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                if (transaction != null)
                {
                    try { await transaction.RollbackAsync(CancellationToken.None); } catch { }
                }
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                if (transaction != null)
                {
                    // 2026-10-24 (RS3): CancellationToken.None, not the request's token, for the
                    // reason given in BatchDelete's catch: a cancelled request would throw again
                    // here and reach the client as a raw, unlogged 500.
                    try
                    {
                        await transaction.RollbackAsync(CancellationToken.None);
                    }
                    catch
                    {
                    }
                }
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
            finally
            {
                if (transaction != null)
                {
                    await transaction.DisposeAsync();
                }
            }
        }

        /// <summary>
        /// Why <see cref="BatchAddExistingProject"/> will not restore a project, or null when it may.
        /// Read from the same tier row Batch Delete decides on: nothing is changed in an Approved
        /// program or for a published project. Lump Sum projects are restored like any other
        /// (confirmed 2026-10-24): an itemized child is always hard-deleted, so it is simply not
        /// found, and a Lump Sum parent soft-deleted past its first stage gets its latest revision
        /// back. The flags are read directly, not via Tier, because the tier rates an itemized child
        /// Hard even in an Approved program.
        /// </summary>
        private static string? RestoreRefusal(ProjectHelper.ProjectDeletionTierResult row)
        {
            if (row.IsPublished)
            {
                return "published";
            }
            return row.ProgramApproved ? "program is approved" : null;
        }

        /// <summary>The ids a restore left alone, by reason, for the Message the UI toasts.</summary>
        private static string DescribeNotRestored(IReadOnlyCollection<string> missingProjectIds, IReadOnlyCollection<BatchDeleteRefusal> refused)
        {
            var notes = new List<string>();
            if (missingProjectIds.Count > 0)
            {
                notes.Add($"Not found or not deleted: {string.Join(", ", missingProjectIds)}.");
            }
            foreach (var byReason in refused.GroupBy(x => x.Reason))
            {
                notes.Add($"Not restored ({byReason.Key}): {string.Join(", ", byReason.Select(x => x.ProjectId))}.");
            }
            return string.Join(" ", notes);
        }

        /// <summary>The 400 for a restore that changed nothing. Names every id and why, since the UI
        /// shows only Message.</summary>
        private static BadRequestObjectResult NothingRestored(string[] missingProjectIds, List<BatchDeleteRefusal> refused)
        {
            string message = refused.Count == 0
                ? "No deleted projects were found matching the provided IDs. They may already be active or do not belong to this program."
                : "None of the project IDs can be restored. " + DescribeNotRestored(missingProjectIds, refused);
            return new BadRequestObjectResult(new
            {
                Message = message,
                Title = "No Projects Restored",
                MissingProjectIds = missingProjectIds,
                RefusedProjects = refused
            });
        }
        #endregion

        #region Exception Reports
        // Re-derives the same GAA-R rules pAllowProjectPublishing already enforces
        // (rules 3+4 for Implementation Plan, rule 6 for Location), surfaced as a
        // program-wide review list instead of a single-project publish gate. See
        // Main/Resources/Internal/SQLScripts/ for pProjectImplementationPlanExceptions
        // and pProjectLocationExceptions.

        [HttpGet]
        public async Task<IActionResult> ProjectImplementationPlanExceptions([FromQuery] string programId, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(programId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = "Program ID is required.",
                        Message = "Program ID cannot be empty or missing.",
                        Title = "Invalid Request"
                    });
                }

                var exceptions = await _db.pProjectImplementationPlanExceptions
                    .FromSqlRaw($"""
                    EXEC dbo.pProjectImplementationPlanExceptions
                        @ProgramId = {programId}
                    """)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Ok(exceptions);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpGet]
        public async Task<IActionResult> ProjectLocationExceptions([FromQuery] string programId, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(programId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Data = "Program ID is required.",
                        Message = "Program ID cannot be empty or missing.",
                        Title = "Invalid Request"
                    });
                }

                var exceptions = await _db.pProjectLocationExceptions
                    .FromSqlRaw($"""
                    EXEC dbo.pProjectLocationExceptions
                        @ProgramId = {programId}
                    """)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Ok(exceptions);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        #endregion
    }
}
