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
using System.Text.RegularExpressions;
using System.Xml;
using static Eaf.Domain.Uow.EafDataFilters;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
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
                var SelectedStage = new[] { EnumProgramStage.RBP, EnumProgramStage.BP }.Select(stage => (int)stage).ToList();
                var SelectedStatus = new[] { EnumProgramStatus.Working, EnumProgramStatus.Approved }.Select(stage => (int)stage).ToList();

                var AvailableStages = await _db.tProgramStageEnum.Where(x => SelectedStage.Contains(x.Id)).ToListAsync();
                var AvailableTypes = await _db.tProgramTypeEnum.ToListAsync();

                var AvailableStatuses = await _db.tProgramStatusEnum.Where(x => SelectedStatus.Contains(x.Enum)).ToListAsync();
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
                int[] initialStageInts = new[]
                {
                    (int)EnumProgramStage.RBP,
                    (int)EnumProgramStage.BP
                };
                //int[] initialStatus = new[]
                //{
                //    (int)EnumProgramStatus.Working
                //};

                var Stage = await _db.tProgramStageEnum.AsNoTracking().Where(x => initialStageInts.Contains(x.Enum)).ToListAsync();
                var Type = await _db.tProgramTypeEnum.AsNoTracking().ToListAsync();
                //var Status = await _db.tProgramStatusEnum.AsNoTracking().Where(x => initialStatus.Contains(x.Enum)).ToListAsync();
                var Group = await _db.tGroups.ToListAsync();
                string[] includes = { "C", "R", "PMO", "PMOC", "B" };
                var Security = await _db.tProjectImplementingOfficeEnum.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                return Ok(new
                {
                    Stages = Stage,
                    Types = Type,
                    //Statuses = Status,
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
                var checkStageType = await _db.tProgramStageEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == (int)dto.Stage);
                if(checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkStatusType = await _db.tProgramStatusEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                if(checkStatusType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Status '{dto.Status}' is not valid!", Title = "Invalid Status" });
                }
                var checkType = await _db.tProgramTypeEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid!", Title = "Invalid Type" });
                }
                var checkUserGroup = await _db.tGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (checkUserGroup == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User Group '{dto.UserGroup}' is not valid!", Title = "Invalid User Group" });
                }
                string ReferenceId = "PR" + ("tCountSequence").GenerateCode();
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                var newProgram = new DBHelper.Models.Table.Programs()
                {
                    ProgramId = ReferenceId,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                    IsDeleted= false
                };
                await _db.tPrograms.AddAsync(newProgram);
                var newRevisions = new ProgramRevisions()
                {
                    ProgramId = ReferenceId,
                    RevisionNumber = 1,
                    Name = dto.Name,
                    UserGroup = dto.UserGroup,
                    RegionCode = dto.RegionCode,
                    Status = EnumProgramStatus.Working,
                    Type = dto.Type,
                    YearStart = dto.YearStart,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,

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
                var program = await _db.vProgramDetails.AsNoTracking().FirstOrDefaultAsync(x => x.Id == CurrentProgramVersion.RevisionId && x.ProgramId == dto.ProgramId);
                var ProjectLists = await _db.vProjects.AsNoTracking().Where(x => x.ProgramId == dto.ProgramId).ToListAsync();
                var AvailableStages = await _db.tProgramStageEnum.AsNoTracking().ToListAsync();
                var AvailableTypes = await _db.tProgramTypeEnum.AsNoTracking().ToListAsync();
                var AvailableStatuses = await _db.tProgramStatusEnum.AsNoTracking().ToListAsync();
                var AvailableGroups = await _db.tGroups.AsNoTracking().ToListAsync();
                string[] includes = { "C", "R", "PMO", "PMOC", "B" };
                var Security = await _db.tProjectImplementingOfficeEnum.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                var response = new
                {
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
                var program = await _db.tPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (program == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} does not exist in the ", Title = "Delete Failed" });
                }
                var ProgramStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionId == dto.RevisionId);
                if(ProgramStage == null) {
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
                    .FirstOrDefaultAsync(x => x.RevisionNumber == currentVersion.RevisionId && x.ProgramId == referenceId);

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
                    ProgramId = getProgram.ProgramId,
                    RevisionNumber = getProgram.RevisionNumber + 1, // Increment the revision number
                    Name = getProgram.Name,
                    UserGroup = getProgram.UserGroup,
                    RegionCode = getProgram.RegionCode,
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
                var Groups = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (Groups == null) { return new BadRequestObjectResult(new { Message = $"The selected User Group is invalid. Please ensure the User Group field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.UserGroup != NewProgramVersion.UserGroup)
                {
                    hasUpdated = true;
                    var Current = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == NewProgramVersion.UserGroup);
                    NewProgramVersion.UserGroup = dto.UserGroup;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
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
                var Types = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Type != NewProgramVersion.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)NewProgramVersion.Type);
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
                if(hasUpdated)
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
                var checkProgram = await _db.tPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator!", Title = "Program not found" });
                }
                var checkRevisions = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if(checkRevisions == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Revisions table. Please contact administrator!", Title = "Program not found" });
                }
                var checkStage = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionId == checkRevisions.Id);
                if (checkStage == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID Revision '{checkRevisions.Id}' does not exist in the Stages table. Please contact administrator!", Title = "Program Stage not found" });
                }
                var checkStageType = await _db.tProgramStageEnum.AsNoTracking().FirstOrDefaultAsync(x => x.Enum == (int)dto.Stage);
                if(checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkProjects = await _db.vProjectDetails.AsNoTracking().Where(x => x.ProgramId == dto.ProgramId).ToListAsync();
                if (checkProjects.Count > 0)
                {
                    HashSet<string> projectIds = checkProjects.Select(p => p.ProjectId!).ToHashSet();
                    var ProjectRevisions = await _db.tProjectRevisions.AsNoTracking().Where(x => projectIds.Contains(x.AlternateId)).ToListAsync();
                    List<ProjectRevisions> NewRevisions = new List<ProjectRevisions>();
                    if (ProjectRevisions.Count > 0)
                    {
                        foreach (var project in ProjectRevisions)
                        {
                            string FirstSegment = Functions.GenerateProjec1stSegment(checkStageType.Name);
                            string NewProjectId = Regex.Replace(project.ProjectId, @"\b(BP|MY|P)\b", FirstSegment);
                            var newRevision = new ProjectRevisions()
                            {
                                ProjectId = NewProjectId,
                                AlternateId = project.AlternateId,
                                RevisionNumber = project.RevisionNumber + 1,
                                Description = project.Description,
                                Category = project.Category,
                                Thrust = project.Thrust,
                                Origin = project.Origin,
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
                                DetailedDesign = project.DetailedDesign,
                                RowAvailable = project.RowAvailable,
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            };
                            NewRevisions.Add(newRevision);
                        }
                        await _db.tProjectRevisions.AddRangeAsync(NewRevisions);
                        await _db.SaveChangesAsync();
                        var newStages = NewRevisions.Select(pr => new ProjectStages
                        {
                            RevisionId = pr.Id,
                            StageId = dto.Stage,
                            StageName = checkStageType.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsPublished = false
                        });
                        await _db.tProjectStages.AddRangeAsync(newStages);
                    }
                }
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
                var newProgramRevision = new ProgramRevisions()
                {
                    ProgramId = dto.ProgramId,
                    RevisionNumber = checkRevisions.RevisionNumber + 1,
                    Name = checkRevisions.Name,
                    UserGroup = checkRevisions.UserGroup,
                    RegionCode = checkRevisions.RegionCode,
                    Status = checkRevisions.Status,
                    Type = checkRevisions.Type,
                    Cost = checkRevisions.Cost,
                    YearStart = checkRevisions.YearStart,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProgramRevisions.AddAsync(newProgramRevision);
                await _db.SaveChangesAsync();
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