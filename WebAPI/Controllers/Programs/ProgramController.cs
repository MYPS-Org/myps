using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.API;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Helpers.API;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection;
using System.Security.Cryptography;

namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProgramController : CoreController
    {
        public ProgramController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region Program Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterProgram()
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RBP, EnumProgramStage.BP }.Select(stage => (int)stage).ToList();
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
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowProgram([FromBody] ShowProgramDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.Programs)
                        .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                        .Any(p => string.Equals(p.Name, dto.SortField, StringComparison.OrdinalIgnoreCase));
                    if (!isValid)
                    {
                        return new BadRequestObjectResult(new { Message = $"Invalid Column: {dto.SortField} to sort!", Title = "Parameter Error" });
                    }
                }
                dto.sortDirection = string.IsNullOrEmpty(dto.sortDirection.ToString()) ? sortDirectionList.DESC : dto.sortDirection;

                bool isValidDirection = Enum.IsDefined(typeof(sortDirectionList), dto.sortDirection!);
                if (!isValidDirection)
                {
                    return new BadRequestObjectResult(new { Message = $"Sorting Direction: {dto.sortDirection} not allowed!", Title = "Invalid sort option" });
                }
                // Validate pagination parameters
                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;

                var baseQuery = _db.vPrograms.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

                if (!string.IsNullOrEmpty(dto.Filters?.YearStart))
                    baseQuery = baseQuery.Where(e => e.YearStart.ToString() == dto.Filters.YearStart);

                if (!string.IsNullOrEmpty(dto.Filters?.GroupName))
                    baseQuery = baseQuery.Where(e => e.GroupName == dto.Filters.GroupName);

                if (!string.IsNullOrEmpty(dto.Filters?.StageName))
                    baseQuery = baseQuery.Where(e => e.StageName == dto.Filters.StageName);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "YearStart";
                var sortedQuery = dto.sortDirection == sortDirectionList.DESC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.Programs> permissionLists = await sortedQuery
                    .OrderBy(x => x.Name)
                    //.OrderByDescending(x => x.YearStart)
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowProgramStages([FromBody] ProgramDetailsDTO dto)
        {
            try
            {
                var Stage = await _db.vProgramDetails.AsNoTracking().Where(x => dto.ProgramId == x.ProgramId).ToListAsync();
                return Ok(new
                {
                    Stages = Stage
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
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
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddProgram([FromBody] AddProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkProgram = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkProgram != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program name '{dto.Name}' already exists in the System!", Title = "Program Already Exists" });
                }
                var checkStageType = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if (checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkType = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid!", Title = "Invalid Type" });
                }
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).Select(x => x.ParticipantId).ToListAsync();
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid!", Title = "Invalid Security Group" });
                }
                if (dto.IsSkipped == true && string.IsNullOrEmpty(dto.SkipReason))
                {
                    return new BadRequestObjectResult(new { Message = $"Please provide a reason for skipping stage of this program.", Title = "Skip Reason Required" });
                }
                string ReferenceId = "PR" + ("tCountSequence").GenerateCode();
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                var newProgram = new DBHelper.Models.Table.Programs()
                {
                    ProgramId = ReferenceId,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                    IsDeleted = false,
                    IsSkipped = dto.IsSkipped,
                    SkipReason = dto.IsSkipped ? dto.SkipReason : null
                };
                await _db.tPrograms.AddAsync(newProgram);
                var newRevisions = new ProgramRevisions()
                {
                    ProgramId = ReferenceId,
                    RevisionNumber = 1,
                    Name = dto.Name,
                    DataSecurityGroup = dto.DataSecurityGroup,
                    UserGroup = dto.UserGroup,
                    Status = EnumProgramStatus.Working,
                    Type = dto.Type,
                    YearStart = dto.YearStart,
                    CreatedBy = UserId,
                    CreatedDate = currentDate

                };
                await _db.tProgramRevisions.AddAsync(newRevisions);
                await _db.SaveChangesAsync();
                await _db.tProgramStages.AddAsync(new ProgramStages()
                {
                    ProgramId = ReferenceId,
                    RevisionId = newRevisions.Id,
                    StageId = dto.Stage,
                    StageName = dto.Stage.ToString(),
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                    IsPublished = false,
                });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Id = ReferenceId,
                    Stage = dto.Stage.ToString(),
                    Message = "Program added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Program Details
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ProgramDetails([FromBody] ProgramDetailsDTO dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                var CurrentProgramVersion = await _db.vPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                var program = await _db.vProgramDetails.AsNoTracking().OrderByDescending(x => x.Id).FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName);
                if (program == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' with Stage {dto.StageName} does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                //var ProjectLists = await _db.vProjects.AsNoTracking().Where(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName).ToListAsync();
                var ProjectLists = await _db.fProjectsPerStage
                .FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({dto.ProgramId}) fp WHERE fp.StageName = {dto.StageName}").AsNoTracking()
                    .OrderByDescending(x => x.Id)
                    .Skip(0 * 15)
                    .Take(15)
                    .ToListAsync();
                var AvailableStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync();
                var AvailableTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync();
                var AvailableStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync();
                var AvailableGroups = await _db.tGroups.AsNoTracking().ToListAsync();
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                var response = new
                {
                    IsActive = (CurrentProgramVersion.StageName == program.StageName) ? true : false,
                    Details = program,
                    Projects = ProjectLists,
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
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> DeleteProgram([FromBody] DeleteProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                var NotAllowed = await _db.vProgramDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.StageName != "BP");
                if (NotAllowed != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it has progressed beyond the BP stage.", Title = "Delete Not Allowed" });
                }
                var program = await _db.tPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (program == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} does not exist in the ", Title = "Delete Failed" });
                }
                var ProgramStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionId == dto.RevisionId);
                if (ProgramStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage with Revision ID '{dto.RevisionId}' does not exist in the Program Stages table. Please contact administrator!", Title = "Stage not found" });
                }
                
                int[] AllowedStages =
                {
                    (int)EnumProgramStage.RBP,
                    (int)EnumProgramStage.RDIP,
                    (int)EnumProgramStage.PIP
                };
                if (ProgramStage.StageId == EnumProgramStage.RBP)
                { }
                program.IsDeleted = true;
                var TransactionLog = new TransactionLog()
                {
                    TransactionId = dto.ProgramId,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tPrograms",
                    AffectedColumn = "IsDeleted",
                    NewValue = "true",
                    OldValue = "false",
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow

                };
                _db.tPrograms.Update(program);
                await _db.tTransactionLog.AddRangeAsync(TransactionLog);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Program delete successfully!",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProgramDetails([FromBody] UpdateProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                var referenceId = dto.ProgramId;

                var currentVersion = await _db.vPrograms.FirstOrDefaultAsync(x => x.ProgramId == referenceId);
                if (currentVersion == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Program Not Found",
                        Message = $"The program with ID '{referenceId}' does not exist in the system."
                    });
                }

                var getProgram = await _db.vProgramDetails
                    .FirstOrDefaultAsync(x => x.ProgramId == referenceId && x.StageId == dto.StageId);

                if (getProgram == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Revision Details Not Found",
                        Message = $"Revision details for Program ID '{referenceId}' could not be found. Please contact the system administrator."
                    });
                }

                if (currentVersion.RevisionId != dto.Id)
                {
                    var updatedBy = getProgram?.UpdatedBy ?? "Unknown";
                    var updatedDate = getProgram?.UpdatedDate?.ToString("MM-dd-yyyy HH:mm:ss") ?? "Unknown";
                    return new BadRequestObjectResult(new
                    {
                        Title = "Outdated Revision",
                        Message = $"The provided Program ID '{referenceId}' does not match the latest revision. Last modified by: {updatedBy} on {updatedDate}. Please refresh to the most recent version before proceeding."
                    });
                }
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                DateTime CurrentDate = DateTime.UtcNow;
                if (string.IsNullOrEmpty(dto.Name)) { return new BadRequestObjectResult(new { Message = $"Program name field cannot be empty!", Title = "Update Failed" }); }
                var NewProgramVersion = new ProgramRevisions()
                {
                    ProgramId = getProgram.ProgramId,
                    RevisionNumber = getProgram.RevisionNumber + 1, // Increment the revision number
                    Name = getProgram.Name,
                    DataSecurityGroup = getProgram.DataSecurityGroup,
                    UserGroup = getProgram.UserGroup,
                    Status = getProgram.Status,
                    Type = getProgram.Type,
                    Cost = getProgram.Cost,
                    YearStart = getProgram.YearStart,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                if (dto.Name != NewProgramVersion.Name && !string.IsNullOrEmpty(NewProgramVersion.Name))
                {
                    hasUpdated = true;
                    NewProgramVersion.Name = dto.Name;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.Name,
                        OldValue = NewProgramVersion.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                //Pedning
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().ToListAsync();
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Select(x => x.ParticipantId).Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid!", Title = "Invalid Security Group" });
                }
                if (dto.DataSecurityGroup != NewProgramVersion.DataSecurityGroup)
                {
                    hasUpdated = true;
                    string CurrentSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => NewProgramVersion.DataSecurityGroup.Contains(sg)));
                    string OdSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => dto.DataSecurityGroup.Contains(sg)));
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "DataSecurityGroup",
                        NewValue = CurrentSecurityGroup!,
                        OldValue = OdSecurityGroup!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    NewProgramVersion.DataSecurityGroup = dto.DataSecurityGroup;
                }
                var Status = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)dto.Status);
                if (Status == null) { return new BadRequestObjectResult(new { Message = $"The selected Status is invalid. Please ensure the Status field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Status != NewProgramVersion.Status)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)NewProgramVersion.Status);
                    NewProgramVersion.Status = dto.Status;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
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
                if (dto.Type != NewProgramVersion.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)NewProgramVersion.Type);
                    NewProgramVersion.Type = dto.Type;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Type",
                        NewValue = Types.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearStart != NewProgramVersion.YearStart)
                {
                    hasUpdated = true;
                    NewProgramVersion.YearStart = dto.YearStart;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearStart",
                        NewValue = dto.YearStart.ToString(),
                        OldValue = NewProgramVersion.YearStart.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (hasUpdated)
                {
                    await _db.tProgramRevisions.AddAsync(NewProgramVersion);
                    await _db.SaveChangesAsync();
                    await _db.tProgramStages.AddAsync(new ProgramStages()
                    {
                        ProgramId = getProgram.ProgramId,
                        RevisionId = NewProgramVersion.Id,
                        StageId = getProgram.StageId,
                        StageName = getProgram.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                        IsPublished = getProgram.IsPublished
                    });
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = $"Program {dto.ProgramId} updated successfully!",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProgramStage([FromBody] UpdateProgramStageDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = DateTime.UtcNow;
                var checkProgram = await _db.vPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                var checkRevisions = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId && x.Id == checkProgram.RevisionId);
                if (checkRevisions == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Revisions table. Please contact administrator!", Title = "Program not found" });
                }
                var checkStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionId == checkRevisions.Id && x.ProgramId == dto.ProgramId);
                if (checkStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID Revision '{checkRevisions.Id}' does not exist in the Stages table. Please contact administrator!", Title = "Program Stage not found" });
                }
                var checkStageType = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if (checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkProjects = await _db.fProjectsPerStage
                .FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({dto.ProgramId}) fp WHERE fp.StageId = {checkStage.StageId}")
                .AsNoTracking()
                .ToListAsync();
                if (checkProjects.Count > 0)
                {
                    HashSet<string> projectIds = checkProjects.Select(p => p.ProjectId!).ToHashSet();
                    HashSet<int> RevisionIds = checkProjects.Select(p => p.Id!).ToHashSet();
                    var ProjectRevisions = await _db.tProjectRevisions.AsNoTracking().Where(x => RevisionIds.Contains(x.Id)).ToListAsync();

                    var Components = await _db.tProjectComponentCost.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == checkStage.StageName).ToListAsync();
                    //HashSet<string> ComponentsRefs = Components.Select(pr => pr.ReferenceId).ToHashSet();
                    //var ComponentsPerYear = await _db.tProjectComponentCostYear.AsNoTracking().Where(x => ComponentsRefs.Contains(x.ParentId)).ToListAsync();

                    var MajorItems = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == checkStage.StageName).ToListAsync();
                    HashSet<string> MajorItemsRefs = MajorItems.Select(pr => pr.ReferenceId).ToHashSet();
                    var MajorLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorItemsRefs.Contains(x.ParentId)).ToListAsync();

                    var FundingProfiles = await _db.tProjectFundingProfile.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == checkStage.StageName).ToListAsync();

                    var SupportingDocuments = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == checkStage.StageName).ToListAsync();

                    List<ProjectRevisions> NewRevisions = new List<ProjectRevisions>();
                    if (ProjectRevisions.Count > 0)
                    {
                        string FirstSegment = checkStageType.Name.GenerateProjec1stSegment();
                        #region Component Costs
                        List<DBHelper.Models.Table.ProjectComponentCost> NewComponent = new List<DBHelper.Models.Table.ProjectComponentCost>();
                        //List<ProjectComponentCostYear> NewComponentPerYear = new List<ProjectComponentCostYear>();
                        if (Components.Count() > 0)
                        {
                            NewComponent.AddRange(Components.Select(x => new DBHelper.Models.Table.ProjectComponentCost()
                            {
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                //ReferenceId = x.ReferenceId.UpdateReferenceId(FirstSegment),
                                ComponentType = x.ComponentType,
                                ComponentId = x.ComponentId,
                                Description = x.Description,
                                Amount = x.Amount,
                                //Total = x.Total,
                                StageName = checkStageType.Name,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = x.IsDeleted
                            }));
                            //NewComponentPerYear.AddRange(ComponentsPerYear.Select(x => new ProjectComponentCostYear()
                            //{
                            //    ParentId = x.ParentId.UpdateReferenceId(FirstSegment),
                            //    CostYear = x.CostYear,
                            //    Cost = x.Cost,
                            //    StartDate = x.StartDate,
                            //    EndDate = x.EndDate
                            //}));
                            await _db.tProjectComponentCost.AddRangeAsync(NewComponent);
                            //await _db.tProjectComponentCostYear.AddRangeAsync(NewComponentPerYear);
                        }
                        #endregion
                        #region Major Items
                        List<ProjectMajorWorkItem> NewMajorItems = new List<ProjectMajorWorkItem>();
                        List<ProjectMajorWorkLocations> NewMajorLocations = new List<ProjectMajorWorkLocations>();
                        if (MajorItems.Count() > 0)
                        {
                            NewMajorItems.AddRange(MajorItems.Select(x => new ProjectMajorWorkItem()
                            {
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                ReferenceId = x.ReferenceId.UpdateReferenceId(FirstSegment),
                                ComponentId = x.ComponentId,
                                YearOfWork = x.YearOfWork,
                                WorkTypeId = x.WorkTypeId,
                                InfraType = x.InfraType,
                                StageName = checkStageType.Name,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = x.IsDeleted
                            }));
                            NewMajorLocations.AddRange(MajorLocations.Select(x => new ProjectMajorWorkLocations()
                            {
                                ParentId = x.ParentId.UpdateReferenceId(FirstSegment),
                                InfraId = x.InfraId,
                                DetailedScope = x.DetailedScope,
                                TargetUnitId = x.TargetUnitId,
                                TargetUnit = x.TargetUnit,
                                StartX = x.StartX,
                                StartY = x.StartY,
                                EndX = x.EndX,
                                EndY = x.EndY,
                                PhysicalTarget = x.PhysicalTarget,
                                StartStationLimit = x.StartStationLimit,
                                EndStationLimit = x.EndStationLimit,
                                EndChainage = x.EndChainage,
                                StartChainage = x.StartChainage,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = x.IsDeleted
                            }));
                            await _db.tProjectMajorWorkItem.AddRangeAsync(NewMajorItems);
                            await _db.tProjectMajorWorkLocations.AddRangeAsync(NewMajorLocations);
                        }
                        #endregion
                        #region Funding Profiles
                        List<ProjectFundingProfile> NewFundingProfiles = new List<ProjectFundingProfile>();
                        if (FundingProfiles.Count() > 0)
                        {
                            NewFundingProfiles.AddRange(FundingProfiles.Select(x => new ProjectFundingProfile()
                            {
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                Source = x.Source,
                                Agreement = x.Agreement,
                                Amount = x.Amount,
                                Percentage = x.Percentage,
                                StageName = checkStageType.Name,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = x.IsDeleted
                            }));
                            await _db.tProjectFundingProfile.AddRangeAsync(NewFundingProfiles);
                        }
                        #endregion
                        #region Supporting Documents
                        List<ProjectSupportingDocs> NewSupportingDocs = new List<ProjectSupportingDocs>();
                        if (SupportingDocuments.Count() > 0)
                        {
                            NewSupportingDocs.AddRange(SupportingDocuments.Select(x => new ProjectSupportingDocs()
                            {
                                StageName = checkStageType.Name,
                                DocumentType = x.DocumentType,
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                FileName = x.FileName,
                                FileExtension = x.FileExtension,
                                FilePath = x.FilePath,
                                Description = x.Description,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate
                            }));
                            await _db.tProjectSupportingDocs.AddRangeAsync(NewSupportingDocs);
                        }
                        #endregion
                        #region Project Revisions
                        NewRevisions.AddRange(ProjectRevisions.Select(project => new ProjectRevisions()
                        {
                            ReferenceId = project.ReferenceId,
                            ProjectId = project.ProjectId.Replace("BP", FirstSegment),
                            AlternateId = project.AlternateId,
                            ExternalId = project.ExternalId,
                            MYId = project.MYId,
                            UACS = project.UACS,
                            MYCAApprovalDate = project.MYCAApprovalDate,
                            RevisionNumber = 1,
                            Description = project.Description,
                            Category = project.Category,
                            Thrust = project.Thrust,
                            Origin = project.Origin,
                            Province = project.Province,
                            City = project.City,
                            LegislativeDistrict = project.LegislativeDistrict,
                            OperatingUnit = project.OperatingUnit,
                            ImplementingOffice = project.ImplementingOffice,
                            DEO = project.DEO,
                            Region = project.Region,
                            Agency = project.Agency,
                            IslandCode = project.IslandCode,
                            ImplementationMode = project.ImplementationMode,
                            EmergencyMode = project.EmergencyMode,
                            Feasibility = project.Feasibility,
                            FeasibilityDate = project.FeasibilityDate,
                            DetailedDesign = project.DetailedDesign,
                            DetailedDesignDate = project.DetailedDesignDate,
                            RowAvailable = project.RowAvailable,
                            RegionWide = project.RegionWide,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsDeleted = project.IsDeleted
                        }));
                        await _db.tProjectRevisions.AddRangeAsync(NewRevisions);
                        checkRevisions.Status = EnumProgramStatus.Approved;
                        _db.tProgramRevisions.Update(checkRevisions);
                        #endregion
                        var transactionLog = new TransactionLog()
                        {
                            TransactionId = dto.ProgramId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tProgramStages",
                            AffectedColumn = "StageName",
                            NewValue = checkStageType.Name,
                            OldValue = checkStage.StageName,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        await _db.tTransactionLog.AddAsync(transactionLog);
                        await _db.SaveChangesAsync();
                        #region Project Stages
                        var newStages = NewRevisions.Select(pr => new ProjectStages
                        {
                            ProgramId = dto.ProgramId,
                            ReferenceId = pr.ReferenceId,
                            RevisionId = pr.Id,
                            StageId = checkStage.StageId.UpdateStage(),
                            StageName = checkStageType.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsPublished = false
                        });
                        await _db.tProjectStages.AddRangeAsync(newStages);
                        #endregion
                        #region Program Revisions
                        var newProgramRevision = new ProgramRevisions()
                        {
                            ProgramId = dto.ProgramId,
                            RevisionNumber = checkRevisions.RevisionNumber + 1,
                            Name = dto.Name,
                            DataSecurityGroup = checkRevisions.DataSecurityGroup,
                            UserGroup = checkRevisions.UserGroup,
                            Status = checkRevisions.Status,
                            Type = checkRevisions.Type,
                            Cost = checkRevisions.Cost,
                            YearStart = checkRevisions.YearStart,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        await _db.tProgramRevisions.AddAsync(newProgramRevision);
                        await _db.SaveChangesAsync();
                        #endregion
                        #region Program Stages
                        var newStage = new ProgramStages()
                        {
                            ProgramId = dto.ProgramId,
                            RevisionId = newProgramRevision.Id,
                            StageId = dto.Stage,
                            StageName = checkStageType.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsPublished = false,
                        };
                        await _db.tProgramStages.AddAsync(newStage);
                        await _db.SaveChangesAsync();
                        #endregion
                        await transaction.CommitAsync();
                        return Ok(new
                        {
                            Message = "Program updated successfully",
                            Title = "Update Stage Complete"
                        });
                    }
                }
                return new BadRequestObjectResult(new
                {
                    Message = "No projects are linked to this program.",
                    Title = "Project Link Missing"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}