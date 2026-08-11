using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views.Program;
using DBHelper.Models.Views.Project;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.CodeAnalysis;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Security.Claims;
using WebAPI.MicroService;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProgramController : CoreController
    {
        public ProgramController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }
        #region Program Lists
        
        [HttpPost]
        public async Task<IActionResult> InitFilterProgram()
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RDIP, EnumProgramStage.PIP }.Select(stage => (int)stage).ToList();
                var SelectedStatus = new[] { EnumProgramStatus.Working, EnumProgramStatus.Approved }.Select(stage => (int)stage).ToList();

                var AvailableStages = await _db.tOptionProgramStage.Where(x => SelectedStage.Contains(x.Id)).ToListAsync();
                var AvailableTypes = await _db.tOptionProgramType.ToListAsync();

                var AvailableStatuses = await _db.tOptionProgramStatus.Where(x => SelectedStatus.Contains(x.NameId)).ToListAsync();
                var AvailableGroups = await _db.tGroups.ToListAsync();
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
                    .ToListAsync();

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
        public async Task<IActionResult> InitAddProgram()
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RDIP, EnumProgramStage.PIP }.Select(stage => (int)stage).ToList();

                var Stage = await _db.tOptionProgramStage.AsNoTracking().Where(x => !SelectedStage.Contains(x.Id)).ToListAsync();

                var Type = await _db.tOptionProgramType.AsNoTracking().ToListAsync();
                var Group = await _db.tGroups.ToListAsync();
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
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
                if(dto.Type == EnumProgramType.TrustFund)
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
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).Select(x => x.ParticipantId).ToListAsync();
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
                    StageName = dto.Stage.ToString(),
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
                if (_Session.ApplyFilter)
                {
                    filters.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                        "@regCode", _Session.RegCode));
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

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramRevision.ProgramPK, cancellationToken);
                if(CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the System.", Title = "Program not found" });
                }
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                //var ProjectLists = await _db.fProjectsPerStage
                //.FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({ProgramParent.ProgramId}) fp WHERE fp.StageName = {dto.StageName} AND ({regionCode} IS NULL OR fp.Region = {regionCode})").AsNoTracking()
                //    .OrderByDescending(x => x.Id)
                //    .Skip(0 * 15)
                //    .Take(15)
                //    .ToListAsync();
                var AllowedStages = new[] { EnumProgramStage.NEP, EnumProgramStage.NEPE, EnumProgramStage.HGAB, EnumProgramStage.HGABI, EnumProgramStage.GAA, EnumProgramStage.GAAR }.Select(stage => (int)stage).Select(x => x).ToList();
                var AvailableStages = await _db.tOptionProgramStage.AsNoTracking().Where(x => AllowedStages.Contains(x.NameId)).ToListAsync();
                var AvailableTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync();
                var AvailableStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync();
                var AvailableGroups = await _db.tGroups.AsNoTracking().ToListAsync();
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                var response = new
                {
                    IsActive = (CurrentProgramVersion.StageName == ProgramStage.StageName) ? true : false,
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
        public async Task<IActionResult> DeleteProgram([FromBody] DeleteProgramDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }
                string ProgramId = dto.ProgramId;
                EnumProgramStage[] StagesToCheck =
                {
                    EnumProgramStage.NEP,
                    EnumProgramStage.NEPE,
                    EnumProgramStage.HGAB,
                    EnumProgramStage.HGABI,
                    EnumProgramStage.GAA,
                    EnumProgramStage.GAAR,
                };
                DateTime CurrentDate = Functions.CurrentDate();
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramDetails = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                if (StagesToCheck.Contains(ProgramStage.StageId))
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it has progressed beyond the BP stage.", Title = "Delete Not Allowed" });
                }
                else
                {
                    EnumProgramStage[] AllowedStages =
                    {
                        EnumProgramStage.BP,
                        EnumProgramStage.RBP,
                        EnumProgramStage.RDIP,
                        EnumProgramStage.PIP
                    };
                    if (!AllowedStages.Contains(ProgramStage.StageId))
                    {
                        return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it is not in a deletable stage.", Title = "Delete Not Allowed" });
                    }
                    if (ProgramDetails.Cost > 0)
                    {
                        return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it has projects associated with it.", Title = "Delete Not Allowed" });
                    }
                }
                var TransactionLog = new TransactionLog()
                {
                    ReferenceId = ProgramId,
                    TransactionType = EnumTransactionType.Delete.ToString(),
                    AffectedTable = "tPrograms",
                    AffectedColumn = "IsDeleted",
                    NewValue = "true",
                    OldValue = "false",
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tTransactionLog.AddRangeAsync(TransactionLog);

                var ProgramRevisions = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ProgramStage.RevisionId, cancellationToken);

                var ProjectsInProgram = await _db.tProjects.Where(x => x.ProgramId == ProgramRevisions.ProgramId).AsNoTracking().ToListAsync();
                HashSet<string> ReferenceIds = ProjectsInProgram.Select(x => x.ProjectPK).ToHashSet();
                var ProjectRevisions = await _db.tProjectRevisions.Where(x => ReferenceIds.Contains(x.ProjectFK)).AsNoTracking().ToListAsync();
                var ProjectStages = await _db.tProjectStages.Where(x => ReferenceIds.Contains(x.ProjectFK)).AsNoTracking().ToListAsync();

                _db.tProjectStages.RemoveRange(ProjectStages);
                await _db.SaveChangesAsync(cancellationToken);
                _db.tProjectRevisions.RemoveRange(ProjectRevisions);
                await _db.SaveChangesAsync(cancellationToken);

                _db.tProjects.RemoveRange(ProjectsInProgram);
                await _db.SaveChangesAsync(cancellationToken);

                _db.tProgramStages.RemoveRange(ProgramStage);
                await _db.SaveChangesAsync(cancellationToken);
                _db.tProgramRevisions.RemoveRange(ProgramRevisions);
                await _db.SaveChangesAsync(cancellationToken);

                _db.tPrograms.Remove(ProgramParent);

                //_db.tPrograms.Remove(ProgramParent);
                //_db.tProgramRevisions.RemoveRange(ProgramRevisions);
                //_db.tProgramStages.RemoveRange(ProgramStage);
                //_db.tProjects.RemoveRange(ProjectsInProgram);
                //_db.tProjectRevisions.RemoveRange(ProjectRevisions);
                //_db.tProjectStages.RemoveRange(ProjectStages);

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Program deleted successfully.",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
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
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramDetails = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                if(ProgramDetails.StageName != dto.StageName)
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} is not in the '{dto.StageName}' stage. Please ensure you are updating the correct stage of the program.", Title = "Update Failed" });
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
                if (dto.UserGroup != ProgramParent.UserGroup && ProgramParent.UserGroup.Count() > 0)
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
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().ToListAsync();
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Select(x => x.ParticipantId).Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid.", Title = "Invalid Security Group" });
                }
                if (dto.DataSecurityGroup != ProgramParent.DataSecurityGroup)
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
                var Types = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Type != ProgramParent.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)ProgramParent.Type);
                    ProgramParent.Type = dto.Type;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Type",
                        NewValue = Types.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearStart != ProgramParent.StartYear)
                {
                    hasUpdated = true;
                    ProgramParent.StartYear = dto.YearStart;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = ProgramId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "StartYear",
                        NewValue = dto.YearStart.ToString(),
                        OldValue = ProgramParent.StartYear.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (hasUpdated)
                {
                    _db.tProgramRevisions.Update(ProgramRevisions);
                    await _db.SaveChangesAsync(cancellationToken);
                    await _db.tProgramStages.AddAsync(new DBHelper.Models.Table.Program.ProgramStages()
                    {
                        ProgramFK = ProgramRevisions.ProgramFK,
                        ProgramId = ProgramRevisions.ProgramId,
                        RevisionId = ProgramRevisions.Id,
                        StageId = ProgramStage.StageId,
                        StageName = ProgramStage.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                    });
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = $"Program {dto.ProgramId} updated successfully.",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProgramStage([FromBody] UpdateProgramStageDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var ValidateStage = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if(ValidateStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid.", Title = "Invalid Stage" });
                }

                string ProgramId = dto.ProgramId;
                DateTime CurrentDate = Functions.CurrentDate();

                var currentVersion = await _db.vProgramLatest.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId, cancellationToken);
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
                if(!ValidateProgramId.IsValid) {
                    return new BadRequestObjectResult(new { Message = ValidateProgramId.Message, Title = ValidateProgramId.Title });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramDetails = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                var ProgramRevision = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ProgramStage.RevisionId, cancellationToken);

                var checkProjects = await _db.vProjectLatest
                .Where(x => x.ProgramFK == ProgramParent.ProgramPK)
                .AsNoTracking()
                .ToListAsync();
                if (checkProjects.Count > 0)
                {
                    HashSet<int> ProjectRevisionFK = checkProjects.Select(x => x.RevisionId).ToHashSet();

                    var FundingProfiles = await _db.tProjectFundingProfile.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK) && !x.IsDeleted).ToListAsync();

                    var Components = await _db.tProjectComponentCost.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK) && !x.IsDeleted).ToListAsync();
                    HashSet<int> ComponentCostFK = Components.Select(pr => pr.Id).ToHashSet();
                    var ComponentsPerYear = await _db.tProjectComponentCostPerYear.AsNoTracking().Where(x => ComponentCostFK.Contains(x.ComponentCostFK) && !x.IsDeleted).ToListAsync();

                    var MajorItems = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => ComponentCostFK.Contains(x.ComponentCostFK) && !x.IsDeleted).ToListAsync();
                    HashSet<int> MajorWorkItemFK = MajorItems.Select(pr => pr.Id).ToHashSet();
                    var MajorLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorWorkItemFK.Contains(x.WorkItemFK) && !x.IsDeleted).ToListAsync();

                    var SupportingDocuments = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.ProjectRevisionFK)).ToListAsync();

                    string HostName = User.FindFirstValue("HostName")!;
                    string Date = CurrentDate.ToString("MMddyyyy");
                    string Time = CurrentDate.ToString("HHmmss");
                    string NewProgramUniqueId = $"{HostName}_{Date}_{Time}";
                    var ProjectRevisions = await _db.tProjectRevisions.AsNoTracking().Where(x => ProjectRevisionFK.Contains(x.Id) && !x.IsDeleted).ToListAsync();
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
                            #region ComponentCost
                            var NewComponentCost =
                            (
                                from newRevision in NewRevisions
                                join oldRevision in ProjectRevisions
                                    on newRevision.ProjectFK equals oldRevision.ProjectFK
                                join cc in Components
                                    on oldRevision.Id equals cc.ProjectRevisionFK
                                select new DBHelper.Models.Table.Project.ProjectComponentCost
                                {
                                    ProjectRevisionFK = newRevision.Id,

                                    ComponentType = cc.ComponentType,
                                    ComponentId = cc.ComponentId,
                                    Description = cc.Description,
                                    Total = cc.Total,

                                    CreatedBy = cc.CreatedBy,
                                    CreatedDate = cc.CreatedDate,

                                    UpdatedBy = cc.UpdatedBy,
                                    UpdatedDate = cc.UpdatedDate,

                                    IsDeleted = cc.IsDeleted
                                }
                            )
                            .ToList();

                            await _db.tProjectComponentCost
                                .AddRangeAsync(NewComponentCost);
                            await _db.SaveChangesAsync();
                            #endregion

                            #region Component Per Year
                            var NewComponentCostPerYear =
                            (
                                from cc in NewComponentCost

                                join year in ComponentsPerYear
                                    on cc.ComponentId equals year.ComponentId

                                select new DBHelper.Models.Table.Project.ProjectComponentCostPerYear
                                {
                                    ComponentCostFK = cc.Id,

                                    ComponentId = year.ComponentId,

                                    Amount = year.Amount,
                                    Year = year.Year,
                                    UACS = year.UACS,

                                    StartDate = year.StartDate,
                                    EndDate = year.EndDate,

                                    CreatedBy = year.CreatedBy,
                                    CreatedDate = year.CreatedDate,

                                    UpdatedBy = year.UpdatedBy,
                                    UpdatedDate = year.UpdatedDate,

                                    IsDeleted = year.IsDeleted,
                                }
                            )
                            .ToList();

                            await _db.tProjectComponentCostPerYear
                                .AddRangeAsync(NewComponentCostPerYear);
                            #endregion

                            #region Major Work Items
                            var NewMajorWorkItems =
                            (
                                from cc in NewComponentCost

                                join workItem in MajorItems
                                    on cc.ComponentId equals workItem.ComponentId

                                select new DBHelper.Models.Table.Project.ProjectMajorWorkItem
                                {
                                    // New Component Cost identity
                                    ComponentCostFK = cc.Id,

                                    ComponentId = workItem.ComponentId,

                                    YearOfWork = workItem.YearOfWork,
                                    WorkTypeFK = workItem.WorkTypeFK,
                                    InfraTypeFK = workItem.InfraTypeFK,

                                    CreatedBy = workItem.CreatedBy,
                                    CreatedDate = workItem.CreatedDate,

                                    UpdatedBy = workItem.UpdatedBy,
                                    UpdatedDate = workItem.UpdatedDate,

                                    IsDeleted = workItem.IsDeleted
                                }
                            )
                            .ToList();

                            await _db.tProjectMajorWorkItem
                                .AddRangeAsync(NewMajorWorkItems);
                            await _db.SaveChangesAsync();
                            #endregion

                            #region Major Work Locations


                            var NewMajorWorkLocations =
                            (
                                from item in NewMajorWorkItems

                                join loc in MajorLocations
                                    on item.ComponentId equals loc.ComponentId

                                select new DBHelper.Models.Table.Project.ProjectMajorWorkLocations
                                {
                                    WorkItemFK = item.Id,

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

                                    IsDeleted = loc.IsDeleted
                                }
                            )
                            .ToList();
                            await _db.tProjectMajorWorkLocations
                                .AddRangeAsync(NewMajorWorkLocations);
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
                        #region Program Level
                        #region Program Revisions
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
                        #endregion
                        #region Program Stages
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
                        if(dto.Stage == EnumProgramStage.GAAR)
                        {
                            var syncPublishableProjects = (
                                await _db.Database
                                    .SqlQuery<int>(
                                        $"EXEC dbo.pRecomputeProjectPublishable @ProgramFK = {ProgramParent.ProgramPK}"
                                    )
                                    .ToListAsync()
                            ).FirstOrDefault();
                        }
                        #endregion
                        #endregion
                        await _db.SaveChangesAsync(cancellationToken);
                        await transaction.CommitAsync();
                        return Ok(new
                        {
                            Message = "Program updated successfully.",
                            Title = "Update Stage Complete"
                        });
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
                        Message = "Program ID is required.",
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
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            $"Program ID '{dto.ProgramId}' does not exist in the Programs table. " +
                            "Please contact the administrator.",
                        Title = "Program Not Found"
                    });
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
                    return new BadRequestObjectResult(new
                    {
                        validationResult.Title,
                        validationResult.Message
                    });
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
                var projectRevisions = await _db.vProjectLatest
                    .AsNoTracking()
                    .Where(x =>
                        x.ProjectId != null &&
                        requestedProjectIds.Contains(x.ProjectId))
                    .Select(x => new
                    {
                        x.ProjectId,
                        x.ProjectPK
                    })
                    .ToListAsync(cancellationToken);

                var existingProjectIds = projectRevisions
                    .Where(x => !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var missingProjectIds = requestedProjectIds
                    .Where(id => !existingProjectIds.Contains(id))
                    .ToArray();

                var projectPks = projectRevisions
                    .Where(x => !string.IsNullOrWhiteSpace(x.ProjectPK))
                    .Select(x => x.ProjectPK!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (projectPks.Length == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "None of the supplied project IDs were found.",
                        Title = "Projects Not Found",
                        MissingProjectIds = missingProjectIds
                    });
                }

                var updatedCount = await _db.tProjects
                    .Where(x => projectPks.Contains(x.ProjectPK))
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

                if (missingProjectIds.Length > 0)
                {
                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project(s) were excluded from automatic " +
                            "publication to PCMA. Some project IDs were not found.",
                        Title = "Restrict Publishing Partially Successful",
                        UpdatedCount = updatedCount,
                        MissingProjectIds = missingProjectIds
                    });
                }

                return Ok(new
                {
                    Message =
                        $"{updatedCount} project(s) were excluded from automatic publication to PCMA.",
                    Title = "Restrict Publishing Successful",
                    UpdatedCount = updatedCount,
                    MissingProjectIds = Array.Empty<string>()
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> BatchUndoRestrictPublish([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            try
            {
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
                        Message = "Program ID is required.",
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
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            $"Program ID '{dto.ProgramId}' does not exist in the Programs table. " +
                            "Please contact the administrator.",
                        Title = "Program Not Found"
                    });
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
                    return new BadRequestObjectResult(new
                    {
                        validationResult.Title,
                        validationResult.Message
                    });
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
                    return new BadRequestObjectResult(new
                    {
                        Message = "No valid project IDs were provided.",
                        Title = "No Projects Selected"
                    });
                }

                /*
                 * Retrieve the matching projects together with their current
                 * IsPublishable status.
                 */
                var matchedProjects = await (
                    from revision in _db.vProjectLatest.AsNoTracking()
                    join project in _db.tProjects.AsNoTracking()
                        on revision.ProjectPK equals project.ProjectPK
                    where revision.ProjectId != null
                          && requestedProjectIds.Contains(revision.ProjectId)
                    select new
                    {
                        ProjectId = revision.ProjectId,
                        ProjectPK = project.ProjectPK,
                        project.IsPublishable
                    })
                    .ToListAsync(cancellationToken);

                var existingProjectIds = matchedProjects
                    .Where(x => !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var missingProjectIds = requestedProjectIds
                    .Where(id => !existingProjectIds.Contains(id))
                    .ToArray();

                var alreadyAllowedProjectIds = matchedProjects
                    .Where(x => x.IsPublishable)
                    .Select(x => x.ProjectId!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var restrictedProjectPks = matchedProjects
                    .Where(x => !x.IsPublishable)
                    .Select(x => x.ProjectPK)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (matchedProjects.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "None of the supplied project IDs were found.",
                        Title = "Projects Not Found",
                        UpdatedCount = 0,
                        MissingProjectIds = missingProjectIds
                    });
                }

                if (restrictedProjectPks.Length == 0)
                {
                    return Ok(new
                    {
                        Message =
                            "No changes were required because all matching projects " +
                            "are already allowed for automatic publication to PCMA.",
                        Title = "No Changes Required",
                        UpdatedCount = 0,
                        MissingProjectIds = missingProjectIds,
                        AlreadyAllowedProjectIds = alreadyAllowedProjectIds
                    });
                }

                var updatedCount = await _db.tProjects
                    .Where(x =>
                        restrictedProjectPks.Contains(x.ProjectPK) &&
                        !x.IsPublishable)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            project => project.IsPublishable,
                            true),
                        cancellationToken);

                if (updatedCount == 0)
                {
                    return BadRequest(new
                    {
                        Message =
                            "Matching restricted projects were found, but no project record was updated.",
                        Title = "No Projects Updated",
                        UpdatedCount = 0
                    });
                }

                if (missingProjectIds.Length > 0)
                {
                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project(s) were restored for automatic publication " +
                            "to PCMA. Some project IDs were not found.",
                        Title = "Undo Restriction Partially Successful",
                        UpdatedCount = updatedCount,
                        MissingProjectIds = missingProjectIds,
                        AlreadyAllowedProjectIds = alreadyAllowedProjectIds
                    });
                }

                return Ok(new
                {
                    Message =
                        $"{updatedCount} project(s) were restored for automatic publication to PCMA.",
                    Title = "Undo Restriction Successful",
                    UpdatedCount = updatedCount,
                    MissingProjectIds = Array.Empty<string>(),
                    AlreadyAllowedProjectIds = alreadyAllowedProjectIds
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> BatchDelete([FromBody] BatchUnpublishTaggingDTO dto, CancellationToken cancellationToken)
        {
            try
            {
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
                        Message = "Program ID is required.",
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
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            $"Program ID '{dto.ProgramId}' does not exist in the Programs table. " +
                            "Please contact the administrator.",
                        Title = "Program Not Found"
                    });
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
                    return new BadRequestObjectResult(new
                    {
                        validationResult.Title,
                        validationResult.Message
                    });
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
                    return new BadRequestObjectResult(new
                    {
                        Message = "No valid project IDs were provided.",
                        Title = "No Projects Selected"
                    });
                }

                /*
                 * Match the same way as BatchRestrictPublish.
                 *
                 * The ProgramId condition is important so projects from another
                 * program cannot be deleted accidentally.
                 */
                var projectRevisions = await _db.vProjectLatest
                    .AsNoTracking()
                    .Where(x =>
                        x.ProgramId == dto.ProgramId &&
                        x.StageName == programDetails.StageName &&
                        x.ProjectId != null &&
                        requestedProjectIds.Contains(x.ProjectId))
                    .Select(x => new
                    {
                        x.Id,
                        x.ProjectId
                    })
                    .ToListAsync(cancellationToken);

                var existingProjectIds = projectRevisions
                    .Where(x => !string.IsNullOrWhiteSpace(x.ProjectId))
                    .Select(x => x.ProjectId!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var missingProjectIds = requestedProjectIds
                    .Where(id => !existingProjectIds.Contains(id))
                    .ToArray();

                var revisionIds = projectRevisions
                    .Select(x => x.Id)
                    .Distinct()
                    .ToArray();

                if (revisionIds.Length == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message =
                            "None of the supplied project IDs were found in the current program and stage.",
                        Title = "Projects Not Found",
                        MissingProjectIds = missingProjectIds
                    });
                }

                var updatedCount = await _db.tProjectRevisions
                    .Where(x =>
                        revisionIds.Contains(x.Id) &&
                        !x.IsDeleted)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            revision => revision.IsDeleted,
                            true),
                        cancellationToken);

                if (updatedCount == 0)
                {
                    return Ok(new
                    {
                        Message =
                            "No changes were required because all matching project revisions " +
                            "are already deleted.",
                        Title = "No Changes Required",
                        UpdatedCount = 0,
                        MissingProjectIds = missingProjectIds
                    });
                }

                if (missingProjectIds.Length > 0)
                {
                    return Ok(new
                    {
                        Message =
                            $"{updatedCount} project revision(s) were deleted. " +
                            "Some project IDs were not found.",
                        Title = "Project Deletion Partially Successful",
                        UpdatedCount = updatedCount,
                        MissingProjectIds = missingProjectIds
                    });
                }

                return Ok(new
                {
                    Message = $"{updatedCount} project revision(s) were deleted successfully.",
                    Title = "Project Deletion Successful",
                    UpdatedCount = updatedCount,
                    MissingProjectIds = Array.Empty<string>()
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> BatchAddExistingProject([FromBody] BatchAddExistingProjectDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                var checkProgram = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator.", Title = "Program not found" });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = checkProgram.StageName,
                    _Session = _Session
                }, cancellationToken);
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                char[] delimiters = { ';', ',', '.', '&', ' ', '\n' };
                var projectIds = dto.ProjectIds
                    .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .ToArray();

                // Resolve the revision IDs that belong to this program across all of its stages
                // via tProjectStages, so we can restore projects regardless of which stage they were deleted on.char[] delimiters = { ';', ',', '.', '&', ' ', '\n', '\r', '\t' };


                var latestDeletedRevisionsQuery =
                    from revision in _db.tProjectRevisions
                    where revision.ProjectId != null
                          && projectIds.Contains(revision.ProjectId)
                          && revision.IsDeleted
                    group revision by revision.ProjectId
                    into revisionGroup
                    select new
                    {
                        ProjectId = revisionGroup.Key,
                        Id = revisionGroup.Max(x => x.Id)
                    };
                HashSet<int> ProjectRevisionIds = latestDeletedRevisionsQuery.Select(x => x.Id).ToHashSet();
                var projectsToRestore = await _db.tProjectRevisions.Where(x => ProjectRevisionIds.Contains(x.Id))
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            revision => revision.IsDeleted,
                            true),
                        cancellationToken);


                var restoredSet = new HashSet<string>(
                    latestDeletedRevisionsQuery.Select(x => x.ProjectId),
                    StringComparer.OrdinalIgnoreCase
                );

                var missingProjectIds = projectIds
                    .Where(x => !restoredSet.Contains(x))
                    .ToArray();

                if (latestDeletedRevisionsQuery.Count() > 0)
                {
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"The selected projects have been successfully restored to their original stage.\n\nList of projects not found or already active:{string.Join("\n", missingProjectIds)}.",
                        Title = "Restore Projects Successful"
                    });
                }

                return new BadRequestObjectResult(new
                {
                    Message = "No deleted projects were found matching the provided IDs. They may already be active or do not belong to this program.",
                    Title = "No Projects Restored"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
    }
}