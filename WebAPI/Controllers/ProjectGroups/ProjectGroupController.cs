using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Reflection;
namespace WebAPI.Controllers.ProjectGroup
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectGroupController : CoreController
    {
        public ProjectGroupController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region Project Lists
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowProjectGroups([FromBody] ShowProjectGroupDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.ProjectGroups)
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

                var baseQuery = _db.vProjectGroups.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.UserGroupName))
                    baseQuery = baseQuery.Where(e => e.UserGroupName!.Contains(dto.Filters.UserGroupName));

                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

                var SearchId = await _db.tProjectsInGroup.FirstOrDefaultAsync(x => x.ProjectId == dto.Filters!.ProjectId);
                if (SearchId != null)
                    baseQuery = baseQuery.Where(e => e.GroupId.Contains(SearchId.GroupId));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.ProjectGroups> permissionLists = await sortedQuery
                   .Skip((dto.page - 1) * dto.limit)
                   .Take(dto.limit)
                   .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var UserGroup = await _db.tGroups.ToListAsync();
                return Ok(new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages,
                    Dropdowns = new
                    {
                        UserGroups = UserGroup
                    }
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Add Project Group
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddProjectGroup([FromBody] AddProjectGroupDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var CheckName = await _db.tProjectGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if(CheckName != null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group Name already exists!", Title = "Duplicate Name" });
                }
                string GroupId = $"PRG-{("tCountSequence").GenerateCode()}";
                var NewGroup = new ProjectGroups
                {
                    GroupId = GroupId,
                    Name = dto.Name,
                    Description = dto.Description,
                    UserGroup = dto.UserGroup,
                    CreatedBy = _Session.UserId ?? "TEST",
                    CreatedDate = Functions.CurrentDate()
                };
                await _db.tProjectGroups.AddAsync(NewGroup);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    NewGroupId = NewGroup.GroupId,
                    Message = "Project Group added successfully",
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
        #region Delete Project Group
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> DeleteProjectGroup([FromBody] DeleteProjectGroupDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var CheckName = await _db.tProjectGroups.AsNoTracking().FirstOrDefaultAsync(x => x.GroupId == dto.GroupId);
                if (CheckName == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found!", Title = "Not Found" });
                }
                var ExistingProjects = await _db.tProjectsInGroup
                    .AsNoTracking()
                    .Where(x => x.GroupId == dto.GroupId)
                    .ToListAsync();
                var transactionLogs = new List<TransactionLog>();
                DateTime CurrentDate = Functions.CurrentDate();;
                transactionLogs.Add(new TransactionLog
                {
                    TransactionId = dto.GroupId,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tProjectGroups",
                    AffectedColumn = "GroupId",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(CheckName),
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate
                });
                _db.tProjectGroups.Remove(CheckName);
                if (ExistingProjects.Count > 0)
                {
                    foreach (var project in ExistingProjects)
                    {
                        transactionLogs.Add(new TransactionLog
                        {
                            TransactionId = dto.GroupId,
                            TypeOfTransaction = "Delete",
                            AffectedTable = "tProjectsInGroup",
                            AffectedColumn = "ProjectId",
                            NewValue = "",
                            OldValue = JsonConvert.SerializeObject(project),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                    }
                }
                _db.tProjectsInGroup.RemoveRange(ExistingProjects);
                await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Project Group deleted successfully",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Add Project
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> SearchProject([FromBody] SearchProjectDTO dto)
        {
            try
            {
                var CheckName = await _db.vProjectsInGroup.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                if (CheckName != null)
                {
                    return new BadRequestObjectResult(
                    new {
                        Title = "Project Already Grouped",
                        Message = "This project is already assigned to a group. Please remove it from the current group before reassigning."
                    });
                }
                var CheckProject = await _db.vProjects.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                if (CheckProject == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found!", Title = "Not Found" });
                }
                return Ok(new
                {
                    Project = CheckProject
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] ProjectGroupAddProjectDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var CheckName = await _db.vProjectsInGroup.AsNoTracking().Where(x => dto.ProjectId.Contains(x.ProjectId)).ToListAsync();
                if (CheckName.Count > 0)
                {
                    string joinedProjectIds = string.Join(", ", CheckName.Select(x => x.ProjectId));
                    return new BadRequestObjectResult(
                    new
                    {
                        Title = "Project Already Grouped",
                        Message = $"Projects {joinedProjectIds} is already assigned to a group. Please remove it from the current group before reassigning."
                    });
                }
                var CheckProjects = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => dto.ProjectId.Contains(x.ReferenceId))
                    .ToListAsync();
                var CheckMissingProjects = dto.ProjectId.Except(CheckProjects.Select(x => x.ReferenceId)).ToList();
                if (CheckMissingProjects.Count > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Projects {string.Join(", ", CheckMissingProjects)} not found!", Title = "Not Found" });
                }
                if (CheckProjects.Count < 1)
                {
                    return new BadRequestObjectResult(new { Message = $"No Projects not found!", Title = "Not Found" });
                }
                await _db.tProjectsInGroup.AddRangeAsync(CheckProjects.Select(x =>
                {
                    return new DBHelper.Models.Table.ProjectsInGroup
                    {
                        GroupId = dto.GroupId,
                        ProjectId = x.ReferenceId,
                        CreatedBy = _Session.UserId ?? "TEST",
                        CreatedDate = Functions.CurrentDate()
                    };
                }));
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Project(s) added to group successfully",
                    Title = "Add Complete"
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
        public async Task<IActionResult> DeleteProject([FromBody] ProjectGroupDeleteProjectDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var CheckName = await _db.vProjectsInGroup.AsNoTracking().FirstOrDefaultAsync(x => dto.ProjectId == x.ProjectId);
                if (CheckName == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in group!", Title = "Not Found" });
                }
                var CheckProjects = await _db.tProjects.AsNoTracking().FirstOrDefaultAsync(x => dto.ProjectId == x.ReferenceId);
                if (CheckProjects == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found! Please contact administrator", Title = "Not Found" });
                }
                var ExistingProject = await _db.tProjectsInGroup
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId);
                await _db.tTransactionLog.AddAsync(new TransactionLog
                {
                    TransactionId = dto.ProjectId,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tProjectsInGroup",
                    AffectedColumn = "Row",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(ExistingProject),
                    CreatedBy = _Session.UserId,
                    CreatedDate = Functions.CurrentDate()
                });
                _db.tProjectsInGroup.Remove(ExistingProject!);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Project removed from group successfully",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region Project Group Details
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ProjectGroupDetails([FromBody] ShowProjectGroupDetailsDTO dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.GroupId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                var GroupDetail = await _db.vProjectGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.GroupId == dto.GroupId);
                if (GroupDetail == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found!", Title = "Not Found" });
                }
                var ProjectDetails = await _db.tProjectsInGroup.AsNoTracking().Select(x => x.ProjectId).ToListAsync();
                var ProjectList = await _db.vProjects
                    .AsNoTracking()
                    .Where(x => ProjectDetails.Contains(x.ProjectId))
                    .ToListAsync();
                var UserGroup = await _db.tGroups.ToListAsync();
                return Ok(new
                {
                    GroupDetails = GroupDetail,
                    Projects = ProjectList,
                    UserGroups = UserGroup
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> UpdateProjectGroupDetails([FromBody] UpdateProjectGroupDetailsDTO dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.GroupDetails.GroupId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                var GroupDetail = await _db.tProjectGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.GroupId == dto.GroupDetails.GroupId);
                if (GroupDetail == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found!", Title = "Not Found" });
                }
                var transactionLogs = new List<TransactionLog>();
                DateTime CurrentDate = Functions.CurrentDate();;
                #region Update Group Details
                bool hasChangesInDetails = false;
                if (GroupDetail.Description != dto.GroupDetails.Description)
                {
                    hasChangesInDetails = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = GroupDetail.GroupId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "Details",
                        NewValue = dto.GroupDetails.Description!,
                        OldValue = GroupDetail.Description ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    GroupDetail.Description = dto.GroupDetails!.Description;
                }
                if(GroupDetail.Name != dto.GroupDetails.Name)
                {
                    hasChangesInDetails = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = GroupDetail.GroupId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "Name",
                        NewValue = dto.GroupDetails.Name!,
                        OldValue = GroupDetail.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    GroupDetail.Name = dto.GroupDetails!.Name;
                }
                if (GroupDetail.UserGroup != dto.GroupDetails.UserGroup)
                {
                    var SelectedGroup = await _db.tGroups
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == dto.GroupDetails.UserGroup);
                    var OldGroup = await _db.tGroups
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x => x.Id == GroupDetail.UserGroup);
                    hasChangesInDetails = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = GroupDetail.GroupId!,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "UserGroup",
                        NewValue = SelectedGroup?.GroupName!,
                        OldValue = OldGroup?.GroupName ?? "",
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    GroupDetail.UserGroup = dto.GroupDetails!.UserGroup;
                }
                #endregion
                if (hasChangesInDetails)
                {
                    if (hasChangesInDetails) { _db.tProjectGroups.Update(GroupDetail); }
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync();
                }
                return Ok(new
                {
                    Message = $"Project Group {dto.GroupDetails.GroupId} updated successfully!",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}