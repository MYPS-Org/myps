using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data.SqlClient;
using System.Reflection;
using System.Xml;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProgramController : CoreController
    {
        public ProgramController(AppDbContext db) : base(db) { }
        #region Program Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterProgram()
        {
            try
            {
                var AvailableStages = await _db.tProgramStageEnum.ToListAsync();
                var AvailableTypes = await _db.tProgramTypeEnum.ToListAsync();
                var AvailableStatuses = await _db.tProgramStatusEnum.ToListAsync();
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

                if (!string.IsNullOrEmpty(dto.Filters?.YearEnd))
                    baseQuery = baseQuery.Where(e => e.YearEnd.ToString() == dto.Filters.YearEnd);

                if (dto.Filters?.GroupName != null)
                    baseQuery = baseQuery.Where(e => e.GroupName == dto.Filters.GroupName);

                if (dto.Filters?.StageName != null)
                    baseQuery = baseQuery.Where(e => e.StageName == dto.Filters.StageName);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                 List<DBHelper.Models.Views.Programs> permissionLists = await sortedQuery
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
        public async Task<IActionResult> InitAddProgram()
        {
            try
            {
                var Stage = await _db.tProgramStageEnum.ToListAsync();
                var Type = await _db.tProgramTypeEnum.ToListAsync();
                var Status = await _db.tProgramStatusEnum.ToListAsync();
                var Group = await _db.tGroups.ToListAsync();
                string[] includes = { "C", "R", "PMO", "PMOC", "B" };
                var Security = await _db.tProjectImplementingOfficeEnum.Where(x => includes.Contains(x.OrgType)).ToListAsync();
                return Ok(new
                {
                    Stages = Stage,
                    Types = Type,
                    Statuses = Status,
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
                var checkProgram = await _db.tProgramRevisions.FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkProgram != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program name '{dto.Name}' already exists in the System!", Title = "Program Already Exists" });
                }
                var checkStageType = await _db.tProgramStageEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Stage);
                if(checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkStatusType = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                if(checkStatusType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Status '{dto.Status}' is not valid!", Title = "Invalid Status" });
                }
                var checkType = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid!", Title = "Invalid Type" });
                }
                var checkUserGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (checkUserGroup == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User Group '{dto.UserGroup}' is not valid!", Title = "Invalid User Group" });
                }
                string uid = Sql.NormalQuery<string>(Appsetting.ConnectionString,
                        "EXEC pGenerateUID")
                    .FirstOrDefault() ?? string.Empty;
                if(string.Empty == uid)
                {
                    return new BadRequestObjectResult(new { Message = "Unable to generate Reference ID for the Program!", Title = "Please contact administrator" });
                }
                string ReferenceId = "PR" + uid ?? string.Empty;
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId ?? "TESTING";
                var newProgram = new DBHelper.Models.Table.Programs()
                {
                    ReferenceId = ReferenceId,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                    IsDeleted= false
                };
                await _db.tPrograms.AddAsync(newProgram);
                await _db.SaveChangesAsync();
                var newRevisions = new DBHelper.Models.Table.ProgramRevisions()
                {
                    ReferenceId = ReferenceId,
                    RevisionNumber = 1,
                    Name = dto.Name,
                    UserGroup = dto.UserGroup,
                    RegionCode = dto.RegionCode,
                    Status = dto.Status,
                    Type = dto.Type,
                    YearStart = dto.YearStart,
                    YearEnd = dto.YearEnd,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,

                };
                await _db.tProgramRevisions.AddAsync(newRevisions);
                await _db.SaveChangesAsync();
                var newStage = new DBHelper.Models.Table.ProgramStages()
                {
                    RevisionId = 1,
                    StageId = dto.Stage,
                    StageName = dto.Stage.ToString(),
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                    IsPublished = false,
                };
                await _db.tProgramStages.AddAsync(newStage);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
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
                var CurrentProgramVersion = await _db.vPrograms.FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                var program = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.RevisionNumber == CurrentProgramVersion.RevisionId && x.ReferenceId == dto.ProgramId);
                var AvailableStages = await _db.tProgramStageEnum.ToListAsync();
                var AvailableTypes = await _db.tProgramTypeEnum.ToListAsync();
                var AvailableStatuses = await _db.tProgramStatusEnum.ToListAsync();
                var AvailableGroups = await _db.tGroups.ToListAsync();
                string[] includes = { "C", "R", "PMO", "PMOC", "B" };
                var Security = await _db.tProjectImplementingOfficeEnum.Where(x => includes.Contains(x.OrgType)).ToListAsync();
                var response = new
                {
                    Details = program,
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
                var program = await _db.tPrograms.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProgramId);
                if (program == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} does not exist in the ", Title = "Delete Failed" });
                }
                var ProgramStage = await _db.tProgramStages.FirstOrDefaultAsync(x => x.RevisionId == dto.RevisionId);
                if(ProgramStage == null) {
                    return new BadRequestObjectResult(new { Message = $"Program Stage with Revision ID '{dto.RevisionId}' does not exist in the Program Stages table. Please contact administrator!", Title = "Stage not found" });
                }
                var AllowedStages = Enum.GetValues(typeof(EnumProgramStage))
                    .Cast<EnumProgramStage>()
                    .Where(x => new[] { EnumProgramStage.RBP, EnumProgramStage.RDIP, EnumProgramStage.PIP }.Contains(x))
                    .ToList();
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
                //await _db.SaveChangesAsync();
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
                var referenceId = dto.ReferenceId;
                var expectedRevision = dto.RevisionNumber;

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
                    .FirstOrDefaultAsync(x => x.RevisionNumber == currentVersion.RevisionId && x.ReferenceId == referenceId);

                if (getProgram == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Revision Details Not Found",
                        Message = $"Revision details for Program ID '{referenceId}' could not be found. Please contact the system administrator."
                    });
                }

                if (currentVersion.RevisionId != expectedRevision)
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
                    ReferenceId = getProgram.ReferenceId,
                    RevisionNumber = getProgram.RevisionNumber + 1, // Increment the revision number
                    Name = getProgram.Name,
                    UserGroup = getProgram.UserGroup,
                    RegionCode = getProgram.RegionCode,
                    Status = getProgram.Status,
                    Type = getProgram.Type,
                    Cost = getProgram.Cost,
                    YearStart = getProgram.YearStart,
                    YearEnd = getProgram.YearEnd,
                    CreatedBy = getProgram.CreatedBy,
                    CreatedDate = getProgram.CreatedDate,
                    UpdatedBy = _Session.UserId,
                    UpdatedDate = CurrentDate
                };
                if (dto.Name != NewProgramVersion.Name && !string.IsNullOrEmpty(NewProgramVersion.Name))
                {
                    hasUpdated = true;
                    NewProgramVersion.Name = dto.Name;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.Name,
                        OldValue = NewProgramVersion.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Groups = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (Groups == null) { return new BadRequestObjectResult(new { Message = $"The selected User Group is invalid. Please ensure the User Group field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.UserGroup != NewProgramVersion.UserGroup)
                {
                    hasUpdated = true;
                    var Current = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == NewProgramVersion.UserGroup);
                    NewProgramVersion.UserGroup = dto.UserGroup;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",    
                        AffectedColumn = "UserGroup",
                        NewValue = Groups.GroupName!,
                        OldValue = Current!.GroupName!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Status = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                if (Status == null) { return new BadRequestObjectResult(new { Message = $"The selected Status is invalid. Please ensure the Status field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Status != NewProgramVersion.Status)
                {
                    hasUpdated = true;
                    var Current = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)NewProgramVersion.Status);
                    NewProgramVersion.Status = dto.Status;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Status",
                        NewValue = Status.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Types = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Type != NewProgramVersion.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)NewProgramVersion.Type);
                    NewProgramVersion.Type = dto.Type;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
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
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearStart",
                        NewValue = dto.YearStart.ToString(),
                        OldValue = NewProgramVersion.YearStart.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearEnd != NewProgramVersion.YearEnd)
                {
                    hasUpdated = true;
                    NewProgramVersion.YearEnd = dto.YearEnd;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearEnd",
                        NewValue = dto.YearEnd.ToString(),
                        OldValue = NewProgramVersion.YearEnd.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if(hasUpdated)
                {
                    await _db.tProgramRevisions.AddAsync(NewProgramVersion);
                    await _db.tProgramStages.AddAsync(new ProgramStages()
                    {
                        RevisionId = NewProgramVersion.RevisionNumber,
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
                    Message = $"Program {dto.ReferenceId} updated successfully!",
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
        public async Task<IActionResult> AddProjectProgramDetails([FromBody] DBHelper.Models.Table.ProgramRevisions dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                var getProgram = await _db.vProgramDetails.FirstOrDefaultAsync(x => x.ReferenceId == dto.ReferenceId);
                if(getProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ReferenceId}' does not exist in the Revisions table. Please contact administrator!", Title = "Program not found" });
                }
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                DateTime CurrentDate = DateTime.UtcNow;
                if (string.IsNullOrEmpty(dto.Name)) { return new BadRequestObjectResult(new { Message = $"Program name field cannot be empty!", Title = "Update Failed" }); }
                if (dto.Name != getProgram.Name && !string.IsNullOrEmpty(dto.Name))
                {
                    hasUpdated = true;
                    getProgram.Name = dto.Name;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.Name,
                        OldValue = getProgram.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Groups = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (Groups == null) { return new BadRequestObjectResult(new { Message = $"The selected User Group is invalid. Please ensure the User Group field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.UserGroup != getProgram.UserGroup)
                {
                    hasUpdated = true;
                    var Current = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == getProgram.UserGroup);
                    getProgram.UserGroup = dto.UserGroup;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",    
                        AffectedColumn = "UserGroup",
                        NewValue = Groups.GroupName!,
                        OldValue = Current!.GroupName!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Status = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                if (Status == null) { return new BadRequestObjectResult(new { Message = $"The selected Status is invalid. Please ensure the Status field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Status != getProgram.Status)
                {
                    hasUpdated = true;
                    var Current = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                    getProgram.Status = dto.Status;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "UserGroup",
                        NewValue = Status.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Types = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Type != getProgram.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                    getProgram.Type = dto.Type;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Type",
                        NewValue = Types.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if(dto.Cost != getProgram.Cost)
                {
                    hasUpdated = true;
                    getProgram.Cost = dto.Cost;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Cost",
                        NewValue = dto.Cost.ToString(),
                        OldValue = getProgram.Cost.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearStart != getProgram.YearStart)
                {
                    hasUpdated = true;
                    getProgram.YearStart = dto.YearStart;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearStart",
                        NewValue = dto.YearStart.ToString(),
                        OldValue = getProgram.YearStart.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearEnd != getProgram.YearEnd)
                {
                    hasUpdated = true;
                    getProgram.YearEnd = dto.YearEnd;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ReferenceId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearEnd",
                        NewValue = dto.YearEnd.ToString(),
                        OldValue = getProgram.YearEnd.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                getProgram.UpdatedBy = _Session.UserId;
                getProgram.UpdatedDate = CurrentDate;
                if(hasUpdated)
                {
                    getProgram.RevisionNumber += 1;
                    ProgramRevisions newProgramRevisions = new ProgramRevisions()
                    {
                        ReferenceId = getProgram.ReferenceId,
                        RevisionNumber = getProgram.RevisionNumber,
                        Name = getProgram.Name,
                        UserGroup = getProgram.UserGroup,
                        RegionCode = getProgram.RegionCode,
                        Status = getProgram.Status,
                        Type = getProgram.Type,
                        Cost = getProgram.Cost,
                        YearStart = getProgram.YearStart,
                        YearEnd = getProgram.YearEnd,
                        CreatedBy = _Session.UserId,
                        CreatedDate = DateTime.UtcNow
                    };
                    await _db.tProgramRevisions.AddAsync(newProgramRevisions);
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = $"Program {dto.ReferenceId} updated successfully!",
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
                var checkProgram = await _db.tPrograms.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                var checkRevisions = await _db.tProgramRevisions.FirstOrDefaultAsync(x => x.ReferenceId == dto.ProgramId);
                if(checkRevisions == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Revisions table. Please contact administrator!", Title = "Program not found" });
                }
                var checkStage = await _db.tProgramStages.FirstOrDefaultAsync(x => x.RevisionId == checkRevisions.Id);
                if (checkStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID Revision '{checkRevisions.Id}' does not exist in the Stages table. Please contact administrator!", Title = "Program Stage not found" });
                }
                var newStage = new DBHelper.Models.Table.ProgramStages()
                {
                    RevisionId = checkRevisions.Id,
                    StageId = dto.Stage,
                    StageName = dto.Stage.ToString(),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow,
                    IsPublished = false,
                };
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Program updated successfully",
                    Title = "Update Stage Complete"
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