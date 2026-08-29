using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using WebAPI.MicroService;
using ProjectGroupTable = DBHelper.Models.Table.ProjectGroups;

namespace WebAPI.Controllers.ProjectGroup
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectGroupController : CoreController
    {
        public ProjectGroupController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        [HttpPost]
        public async Task<IActionResult> ShowProjectGroups([FromBody] ShowProjectGroupDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }

                var filters = new List<(string Clause, string ParamName, object? Value)>();

                if (!string.IsNullOrWhiteSpace(dto.Filters.UserGroupName))
                {
                    filters.Add((
                        """
                        EXISTS (
                            SELECT 1
                            FROM dbo.tGroups g
                            WHERE g.Id = v.UserGroup
                              AND g.GroupName LIKE @userGroupName
                        )
                        """,
                        "@userGroupName",
                        $"%{dto.Filters.UserGroupName.Trim()}%"));
                }

                if (!string.IsNullOrWhiteSpace(dto.Filters.Name))
                {
                    filters.Add(("v.Name LIKE @name", "@name", $"%{dto.Filters.Name.Trim()}%"));
                }

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProjectId))
                {
                    var projectKey = dto.Filters.ProjectId.Trim();
                    filters.Add((
                        """
                        EXISTS (
                            SELECT 1
                            FROM dbo.tProjects p
                            LEFT JOIN dbo.vProjectLatest vpl
                                ON vpl.ProjectPK = p.ProjectPK
                            WHERE p.ProjectGroupFK = v.Id
                              AND (
                                    p.ProjectPK = @projectId
                                 OR vpl.ProjectPK = @projectId
                                 OR vpl.ProjectId = @projectId
                              )
                        )
                        """,
                        "@projectId",
                        projectKey));
                }

                filters.Add(("ISNULL(v.IsDeleted, 0) = @isDeleted", "@isDeleted", false));

                FilterDataResult<ProjectGroupTable> result =
                    await _db.FilterDataCursor<ProjectGroupTable, ShowProjectGroupFilterDTO>(
                        tableName: "tProjectGroups",
                        dto: dto,
                        filter: filters,
                        keyColumn: "Id",
                        descending: true,
                        includeTotal: true,
                        ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(new ErrorResult
                    {
                        Title = "Pagination error",
                        Message = result.ErrorMessage ?? "Unable to retrieve the records."
                    });
                }

                var userGroups = await _db.tGroups.AsNoTracking().ToListAsync(cancellationToken);
                var pageGroupIds = result.Data.lists.Select(x => x.Id).ToArray();
                var projectCounts = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => x.ProjectGroupFK != null && pageGroupIds.Contains(x.ProjectGroupFK.Value))
                    .GroupBy(x => x.ProjectGroupFK!.Value)
                    .Select(x => new { GroupId = x.Key, Count = x.Count() })
                    .ToDictionaryAsync(x => x.GroupId, x => x.Count, cancellationToken);

                var lists = result.Data.lists.Select(group =>
                {
                    var userGroupName = userGroups.FirstOrDefault(x => x.Id == group.UserGroup)?.GroupName;
                    return ToProjectGroupResponse(group, userGroupName, projectCounts.GetValueOrDefault(group.Id));
                }).ToList();

                return Ok(new
                {
                    lists,
                    result.Data.page,
                    result.Data.limit,
                    result.Data.total,
                    result.Data.totalPages,
                    result.Data.PreviousFilteredId,
                    result.Data.NextFilteredId,
                    result.Data.HasPrevious,
                    result.Data.HasNext,
                    result.Data.PageCursorId,
                    Dropdowns = new
                    {
                        UserGroups = userGroups
                    }
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddProjectGroup([FromBody] AddProjectGroupDTO dto, CancellationToken cancellationToken)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var normalizedName = dto.Name?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(normalizedName))
                {
                    return new BadRequestObjectResult(new { Message = "Project Group Name is required.", Title = "Parameter Error" });
                }

                var selectedUserGroup = await _db.tGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.UserGroup, cancellationToken);
                if (selectedUserGroup == null)
                {
                    return new BadRequestObjectResult(new { Message = "Selected user group not found.", Title = "Not Found" });
                }

                var duplicateName = await _db.tProjectGroups
                    .AsNoTracking()
                    .AnyAsync(x => x.Name == normalizedName, cancellationToken);
                if (duplicateName)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group Name already exists.", Title = "Duplicate Name" });
                }

                var newGroup = new ProjectGroupTable
                {
                    Name = normalizedName,
                    Description = dto.Description?.Trim(),
                    UserGroup = dto.UserGroup,
                    IsDeleted = false,
                    CreatedBy = _Session.UserId ?? string.Empty,
                    CreatedDate = Functions.CurrentDate()
                };

                await _db.tProjectGroups.AddAsync(newGroup, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    NewGroupId = newGroup.Id.ToString(),
                    Message = "Project Group added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteProjectGroup([FromBody] DeleteProjectGroupDTO dto, CancellationToken cancellationToken)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                if (!TryParseGroupId(dto.GroupId, out var groupId))
                {
                    return new BadRequestObjectResult(new { Message = "Invalid Project Group ID.", Title = "Parameter Error" });
                }

                var group = await _db.tProjectGroups.FirstOrDefaultAsync(x => x.Id == groupId && !x.IsDeleted, cancellationToken);
                if (group == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found.", Title = "Not Found" });
                }

                var existingProjects = await _db.tProjects.Where(x => x.ProjectGroupFK == groupId).ToListAsync(cancellationToken);
                var transactionLogs = new List<TransactionLog>();
                var currentDate = Functions.CurrentDate();

                transactionLogs.Add(new TransactionLog
                {
                    ReferenceId = group.Id.ToString(),
                    TransactionType = EnumTransactionType.Delete.ToString(),
                    AffectedTable = "tProjectGroups",
                    AffectedColumn = "IsDeleted",
                    NewValue = "True",
                    OldValue = JsonConvert.SerializeObject(group),
                    CreatedBy = _Session.UserId ?? string.Empty,
                    Hostname = Environment.MachineName,
                    CreatedDate = currentDate
                });

                foreach (var project in existingProjects)
                {
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = project.ProjectPK,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjects",
                        AffectedColumn = "ProjectGroupFK",
                        NewValue = string.Empty,
                        OldValue = group.Id.ToString(),
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    });
                    project.ProjectGroupFK = null;
                }

                group.IsDeleted = true;
                group.UpdatedBy = _Session.UserId ?? string.Empty;
                group.UpdatedDate = currentDate;

                await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = "Project Group deleted successfully",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> SearchProject([FromBody] SearchProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var projectId = dto.ProjectId?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(projectId))
                {
                    return new BadRequestObjectResult(new { Message = "Project ID is required.", Title = "Parameter Error" });
                }

                var project = await _db.vProjectLatest
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectId == projectId || x.ProjectPK == projectId, cancellationToken);

                if (project == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Not Found" });
                }

                var sourceProject = await _db.tProjects
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectPK == project.ProjectPK, cancellationToken);

                if (sourceProject?.ProjectGroupFK != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Project Already Grouped",
                        Message = "This project is already assigned to a group. Please remove it from the current group before reassigning."
                    });
                }

                return Ok(new { Project = project });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] ProjectGroupAddProjectDTO dto, CancellationToken cancellationToken)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                if (!TryParseGroupId(dto.GroupId, out var groupId))
                {
                    return new BadRequestObjectResult(new { Message = "Invalid Project Group ID.", Title = "Parameter Error" });
                }

                var group = await _db.tProjectGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == groupId && !x.IsDeleted, cancellationToken);
                if (group == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found.", Title = "Not Found" });
                }

                var requestedProjectIds = dto.ProjectId
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (requestedProjectIds.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "No Projects selected.", Title = "Parameter Error" });
                }

                var projects = await _db.vProjectLatest
                    .AsNoTracking()
                    .Where(x => requestedProjectIds.Contains(x.ProjectId) || requestedProjectIds.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                var missingProjects = requestedProjectIds
                    .Where(id => !projects.Any(p =>
                        string.Equals(p.ProjectId, id, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(p.ProjectPK, id, StringComparison.OrdinalIgnoreCase)))
                    .ToList();

                if (missingProjects.Count > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Projects {string.Join(", ", missingProjects)} not found.", Title = "Not Found" });
                }

                var resolvedProjectPks = projects.Select(x => x.ProjectPK).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                var projectRows = await _db.tProjects
                    .Where(x => resolvedProjectPks.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                var alreadyGrouped = projectRows.Where(x => x.ProjectGroupFK != null).ToList();
                if (alreadyGrouped.Count > 0)
                {
                    var joinedProjectIds = string.Join(", ", alreadyGrouped.Select(x => x.ProjectPK));
                    return new BadRequestObjectResult(new
                    {
                        Title = "Project Already Grouped",
                        Message = $"Projects {joinedProjectIds} are already assigned to a group. Please remove them from the current group before reassigning."
                    });
                }

                var currentDate = Functions.CurrentDate();
                var transactionLogs = new List<TransactionLog>();
                foreach (var project in projectRows)
                {
                    project.ProjectGroupFK = group.Id;
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = project.ProjectPK,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjects",
                        AffectedColumn = "ProjectGroupFK",
                        NewValue = group.Id.ToString(),
                        OldValue = string.Empty,
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    });
                }

                await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = "Project(s) added to group successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteProject([FromBody] ProjectGroupDeleteProjectDTO dto, CancellationToken cancellationToken)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var projectId = dto.ProjectId?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(projectId))
                {
                    return new BadRequestObjectResult(new { Message = "Project ID is required.", Title = "Parameter Error" });
                }

                var latestProject = await _db.vProjectLatest
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectId == projectId || x.ProjectPK == projectId, cancellationToken);

                if (latestProject == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found.", Title = "Not Found" });
                }

                var existingProject = await _db.tProjects.FirstOrDefaultAsync(x => x.ProjectPK == latestProject.ProjectPK, cancellationToken);
                if (existingProject?.ProjectGroupFK == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project not found in group.", Title = "Not Found" });
                }

                var currentDate = Functions.CurrentDate();
                await _db.tTransactionLog.AddAsync(new TransactionLog
                {
                    ReferenceId = existingProject.ProjectPK,
                    TransactionType = EnumTransactionType.Update.ToString(),
                    AffectedTable = "tProjects",
                    AffectedColumn = "ProjectGroupFK",
                    NewValue = string.Empty,
                    OldValue = existingProject.ProjectGroupFK.Value.ToString(),
                    CreatedBy = _Session.UserId ?? string.Empty,
                    Hostname = Environment.MachineName,
                    CreatedDate = currentDate
                }, cancellationToken);

                existingProject.ProjectGroupFK = null;
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = "Project removed from group successfully",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> ProjectGroupDetails([FromBody] ShowProjectGroupDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (!TryParseGroupId(dto.GroupId, out var groupId))
                {
                    return new BadRequestObjectResult(new { Message = "Invalid Project Group ID.", Title = "Parameter Error" });
                }

                var groupDetail = await _db.tProjectGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == groupId && !x.IsDeleted, cancellationToken);

                if (groupDetail == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found.", Title = "Not Found" });
                }

                var projectKeys = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => x.ProjectGroupFK == groupId)
                    .Select(x => x.ProjectPK)
                    .ToListAsync(cancellationToken);

                var projectList = await _db.vProjectLatest
                    .AsNoTracking()
                    .Where(x => projectKeys.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                var userGroups = await _db.tGroups.AsNoTracking().ToListAsync(cancellationToken);

                return Ok(new
                {
                    GroupDetails = ToProjectGroupResponse(groupDetail, userGroups.FirstOrDefault(x => x.Id == groupDetail.UserGroup)?.GroupName, projectKeys.Count),
                    Projects = projectList,
                    UserGroups = userGroups
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateProjectGroupDetails([FromBody] UpdateProjectGroupDetailsDTO dto, CancellationToken cancellationToken)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                if (dto.GroupDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }

                var requestedGroupId = !string.IsNullOrWhiteSpace(dto.GroupDetails.GroupId)
                    ? dto.GroupDetails.GroupId
                    : dto.GroupDetails.Id.ToString();

                if (!TryParseGroupId(requestedGroupId, out var groupId))
                {
                    return new BadRequestObjectResult(new { Message = "Invalid Project Group ID.", Title = "Parameter Error" });
                }

                var groupDetail = await _db.tProjectGroups.FirstOrDefaultAsync(x => x.Id == groupId && !x.IsDeleted, cancellationToken);
                if (groupDetail == null)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group not found.", Title = "Not Found" });
                }

                var transactionLogs = new List<TransactionLog>();
                var currentDate = Functions.CurrentDate();
                var newDescription = dto.GroupDetails.Description?.Trim();
                var newName = dto.GroupDetails.Name?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(newName))
                {
                    return new BadRequestObjectResult(new { Message = "Project Group Name is required.", Title = "Parameter Error" });
                }

                if (newName.Length > 200)
                {
                    return new BadRequestObjectResult(new { Message = "Project Group Name cannot exceed 200 characters.", Title = "Parameter Error" });
                }

                if (newDescription?.Length > 500)
                {
                    return new BadRequestObjectResult(new { Message = "Description cannot exceed 500 characters.", Title = "Parameter Error" });
                }

                if (groupDetail.Description != newDescription)
                {
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = groupDetail.Id.ToString(),
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "Description",
                        NewValue = newDescription ?? string.Empty,
                        OldValue = groupDetail.Description ?? string.Empty,
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    });
                    groupDetail.Description = newDescription;
                }

                if (groupDetail.Name != newName)
                {
                    var duplicateName = await _db.tProjectGroups
                        .AsNoTracking()
                        .AnyAsync(x => x.Id != groupDetail.Id && x.Name == newName, cancellationToken);

                    if (duplicateName)
                    {
                        return new BadRequestObjectResult(new { Message = "Project Group Name already exists.", Title = "Duplicate Name" });
                    }

                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = groupDetail.Id.ToString(),
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "Name",
                        NewValue = newName,
                        OldValue = groupDetail.Name,
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    });
                    groupDetail.Name = newName;
                }

                if (groupDetail.UserGroup != dto.GroupDetails.UserGroup)
                {
                    var selectedGroup = await _db.tGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.GroupDetails.UserGroup, cancellationToken);
                    if (selectedGroup == null)
                    {
                        return new BadRequestObjectResult(new { Message = "Selected user group not found.", Title = "Not Found" });
                    }

                    var oldGroup = await _db.tGroups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == groupDetail.UserGroup, cancellationToken);
                    transactionLogs.Add(new TransactionLog
                    {
                        ReferenceId = groupDetail.Id.ToString(),
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjectGroups",
                        AffectedColumn = "UserGroup",
                        NewValue = selectedGroup.GroupName ?? string.Empty,
                        OldValue = oldGroup?.GroupName ?? string.Empty,
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    });
                    groupDetail.UserGroup = dto.GroupDetails.UserGroup;
                }

                if (transactionLogs.Count > 0)
                {
                    groupDetail.UpdatedBy = _Session.UserId ?? string.Empty;
                    groupDetail.UpdatedDate = currentDate;
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Project Group {groupDetail.Id} updated successfully.",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
            }
        }

        private static bool TryParseGroupId(string? value, out int groupId)
        {
            groupId = 0;
            return !string.IsNullOrWhiteSpace(value) && int.TryParse(value.Trim(), out groupId) && groupId > 0;
        }

        private static object ToProjectGroupResponse(ProjectGroupTable group, string? userGroupName, int numberOfProjects)
        {
            return new
            {
                group.Id,
                GroupId = group.Id.ToString(),
                group.Name,
                group.Description,
                group.UserGroup,
                UserGroupName = userGroupName ?? string.Empty,
                NumberOfProjects = numberOfProjects,
                group.CreatedBy,
                group.CreatedDate,
                group.UpdatedBy,
                group.UpdatedDate
            };
        }
    }
}

