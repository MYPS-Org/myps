using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using System.Data.SqlClient;
using System.Reflection;
using System.Xml;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.ProjectGroup
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectGroupController : CoreController
    {
        public ProjectGroupController(AppDbContext db) : base(db) { }
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

                var SearchId = await _db.tProjectInGroups.FirstOrDefaultAsync(x => x.ProjectId == dto.Filters!.ProjectId);
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
                var param = new Dictionary<string, object>
                {
                    {"@Table", "tCountSequence"}
                };
                string UID = Sql.NormalQuery<string>(Appsetting.ConnectionString,
                        "EXEC pGenerateUID @Table = @Table", param)
                    .FirstOrDefault() ?? string.Empty;
                if (string.Empty == UID)
                {
                    return new BadRequestObjectResult(new { Message = "Unable to generate Reference ID for the Program!", Title = "Please contact administrator" });
                }
                string GroupId = $"PRG-{UID}";
                var NewGroup = new DBHelper.Models.Table.ProjectGroups
                {
                    GroupId = GroupId,
                    Name = dto.Name,
                    Description = dto.Description,
                    UserGroup = dto.UserGroup,
                    CreatedBy = _Session.UserId ?? "TEST",
                    CreatedDate = DateTime.UtcNow
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
                if(CheckName == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found!", Title = "Not Found" });
                }
                var ExistingProjects = await _db.tProjectInGroups
                    .AsNoTracking()
                    .Where(x => x.GroupId == dto.GroupId)
                    .ToListAsync();
                var transactionLogs = new List<TransactionLog>();
                transactionLogs.Add(new TransactionLog
                {
                    TransactionId = dto.GroupId,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tProjectGroups",
                    AffectedColumn = "GroupId",
                    NewValue = "",
                    OldValue = JsonConvert.SerializeObject(CheckName),
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
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
                            AffectedTable = "tProjectInGroups",
                            AffectedColumn = "ProjectId",
                            NewValue = "",
                            OldValue = JsonConvert.SerializeObject(project),
                            CreatedBy = _Session.UserId,
                            CreatedDate = DateTime.UtcNow
                        });
                    }
                }
                _db.tProjectInGroups.RemoveRange(ExistingProjects);
                await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    //NewGroupId = NewGroup.GroupId,
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
                var ProjectDetails = await _db.tProjectInGroups.AsNoTracking().Select(x => x.ProjectId).ToListAsync();
                var ProjectList = await _db.vProjects
                    .AsNoTracking()
                    .Where(x => ProjectDetails.Contains(x.ProjectId))
                    .ToListAsync();
                return Ok(new
                {
                    GroupDetails = GroupDetail,
                    Projects = ProjectList
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
                DateTime CurrentDate = DateTime.UtcNow;
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
                #region Update Projects
                bool hasChangesInProjects = false;
                var ExistingProjects = await _db.tProjectInGroups
                    .AsNoTracking()
                    .Where(x => x.GroupId == GroupDetail.GroupId)
                    .ToListAsync();
                var ExistingProjectIds = ExistingProjects.Select(x => x.ProjectId).ToList();
                var NewProjectIds = dto.Projects.Select(x => x.ProjectId).ToList();
                // Remove projects that are no longer in the list
                var projectsToRemove = ExistingProjects
                    .Where(x => !NewProjectIds.Contains(x.ProjectId))
                    .ToList();
                var projectsToAdd = ExistingProjectIds
                    .Where(x => !NewProjectIds.Contains(x))
                    .ToList();
                if (projectsToRemove.Count > 0)
                {
                    hasChangesInProjects = true;
                    foreach (var project in projectsToRemove)
                    {
                        transactionLogs.Add(new TransactionLog
                        {
                            TransactionId = GroupDetail.GroupId!,
                            TypeOfTransaction = "Delete",
                            AffectedTable = "tProjectInGroups",
                            AffectedColumn = "ProjectId",
                            NewValue = "",
                            OldValue = JsonConvert.SerializeObject(project),
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        _db.tProjectInGroups.Remove(project);
                    }
                }
                if (NewProjectIds.Count > 0)
                {
                    var projectsToAddDetails = await _db.tProjects
                        .AsNoTracking()
                        .Where(x => NewProjectIds.Contains(x.ProjectId))
                        .ToListAsync();
                    foreach (var project in projectsToAddDetails)
                    {
                        if (!ExistingProjectIds.Contains(project.ProjectId))
                        {
                            hasChangesInProjects = true;
                            transactionLogs.Add(new TransactionLog
                            {
                                TransactionId = GroupDetail.GroupId!,
                                TypeOfTransaction = "Insert",
                                AffectedTable = "tProjectInGroups",
                                AffectedColumn = "ProjectId",
                                NewValue = project.ProjectId,
                                OldValue = "",
                                CreatedBy = _Session.UserId,
                                CreatedDate = CurrentDate
                            });
                            _db.tProjectInGroups.Add(new DBHelper.Models.Table.ProjectInGroups
                            {
                                GroupId = GroupDetail.GroupId!,
                                ProjectId = project.ProjectId
                            });
                        }
                    }
                }
                #endregion
                if (hasChangesInDetails || hasChangesInProjects)
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