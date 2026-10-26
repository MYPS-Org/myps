using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Newtonsoft.Json;
using WebAPI.MicroService;
using ProjectGroupTable = DBHelper.Models.Table.ProjectGroups;

namespace WebAPI.Controllers.ProjectGroup
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectGroupController : CoreController
    {
        // Keeps one paste to a size a user can review in the result chips.
        private const int MaxProjectsPerAdd = 500;

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

        /// <summary>
        /// Adds the pasted projects to the group. Partial success: ungrouped projects are added,
        /// the rest are skipped and reported (not found / already in this group / in another
        /// group). A project in another group is never moved. Returns 200 even when nothing was
        /// added, so the dialog can show the breakdown instead of an error toast.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> AddProject([FromBody] ProjectGroupAddProjectDTO dto, CancellationToken cancellationToken)
        {
            IDbContextTransaction? transaction = null;
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

                var requestedProjectIds = NormalizeProjectIds(dto.ProjectId);
                if (requestedProjectIds.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "No Projects selected.", Title = "Parameter Error" });
                }

                if (requestedProjectIds.Length > MaxProjectsPerAdd)
                {
                    return new BadRequestObjectResult(new { Message = $"You can add at most {MaxProjectsPerAdd} projects at a time.", Title = "Parameter Error" });
                }

                var (projectIdByPk, notFoundProjectIds) = await ResolveProjectIdsAsync(requestedProjectIds, cancellationToken);
                var resolvedProjectPks = projectIdByPk.Keys.ToArray();
                var projectRows = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => resolvedProjectPks.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                // Every project found must land in exactly one result group, so a view row with
                // no tProjects row behind it is reported as not found rather than dropped. (A
                // ProjectId and its PK pasted together are one project and are reported once.)
                var rowPks = projectRows.Select(x => x.ProjectPK).ToHashSet(StringComparer.OrdinalIgnoreCase);
                notFoundProjectIds = notFoundProjectIds
                    .Concat(projectIdByPk.Where(x => !rowPks.Contains(x.Key)).Select(x => x.Value))
                    .ToArray();

                var alreadyInGroupProjectIds = projectRows
                    .Where(x => x.ProjectGroupFK == group.Id)
                    .Select(x => projectIdByPk[x.ProjectPK])
                    .ToArray();

                // Only a live group owns a project. A project whose FK still points at a
                // soft-deleted group (deleted before DeleteProjectGroup nulled its members) is
                // treated as ungrouped, so it can be re-linked instead of being stuck.
                var otherGroupIds = projectRows
                    .Where(x => x.ProjectGroupFK != null && x.ProjectGroupFK != group.Id)
                    .Select(x => x.ProjectGroupFK!.Value)
                    .Distinct()
                    .ToArray();
                var liveOtherGroupNames = await _db.tProjectGroups
                    .AsNoTracking()
                    .Where(x => otherGroupIds.Contains(x.Id) && !x.IsDeleted)
                    .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
                var inOtherGroupProjects = projectRows
                    .Where(x => x.ProjectGroupFK != null && liveOtherGroupNames.ContainsKey(x.ProjectGroupFK.Value))
                    .Select(x => new
                    {
                        ProjectId = projectIdByPk[x.ProjectPK],
                        GroupName = liveOtherGroupNames[x.ProjectGroupFK!.Value]
                    })
                    .ToArray();

                var rowsToAdd = projectRows
                    .Where(x => x.ProjectGroupFK == null
                        || (x.ProjectGroupFK != group.Id && !liveOtherGroupNames.ContainsKey(x.ProjectGroupFK.Value)))
                    .ToList();
                if (rowsToAdd.Count > 0)
                {
                    var addPks = rowsToAdd.Select(x => x.ProjectPK).ToArray();
                    var staleGroupIds = rowsToAdd.Where(x => x.ProjectGroupFK != null).Select(x => x.ProjectGroupFK!.Value).Distinct().ToArray();
                    transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    // Conditional write: only rows that are still ungrouped (or still point at a
                    // deleted group). If another request grouped one of them since the read above,
                    // nothing is written, so a project in another group is never moved.
                    var updated = await _db.tProjects
                        .Where(x => addPks.Contains(x.ProjectPK)
                            && (x.ProjectGroupFK == null || staleGroupIds.Contains(x.ProjectGroupFK.Value)))
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProjectGroupFK, (int?)group.Id), cancellationToken);
                    if (updated != rowsToAdd.Count)
                    {
                        await RollbackQuietlyAsync(transaction);
                        return new ConflictObjectResult(new { Message = "Some of these projects were changed by someone else at the same time. Try again.", Title = "Try Again" });
                    }

                    var currentDate = Functions.CurrentDate();
                    var transactionLogs = rowsToAdd.Select(project => new TransactionLog
                    {
                        ReferenceId = project.ProjectPK,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tProjects",
                        AffectedColumn = "ProjectGroupFK",
                        NewValue = group.Id.ToString(),
                        OldValue = project.ProjectGroupFK?.ToString() ?? string.Empty,
                        CreatedBy = _Session.UserId ?? string.Empty,
                        Hostname = Environment.MachineName,
                        CreatedDate = currentDate
                    }).ToList();

                    await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }

                return Ok(new
                {
                    Message = rowsToAdd.Count > 0 ? $"{rowsToAdd.Count} project(s) added to group." : "No projects were added.",
                    Title = rowsToAdd.Count > 0 ? "Add Complete" : "Nothing Added",
                    AddedProjectIds = rowsToAdd.Select(x => projectIdByPk[x.ProjectPK]).ToArray(),
                    AlreadyInGroupProjectIds = alreadyInGroupProjectIds,
                    InOtherGroupProjects = inOtherGroupProjects,
                    NotFoundProjectIds = notFoundProjectIds
                });
            }
            catch (Exception ex)
            {
                await RollbackQuietlyAsync(transaction);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
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
        /// Removes the given projects from this group (sets ProjectGroupFK to null; the projects
        /// are not deleted). Only projects whose ProjectGroupFK is this group are touched; any
        /// other ID (not found, ungrouped, or in another group) is reported in NotInGroupProjectIds.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> DeleteProject([FromBody] ProjectGroupDeleteProjectDTO dto, CancellationToken cancellationToken)
        {
            IDbContextTransaction? transaction = null;
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

                var requestedProjectIds = NormalizeProjectIds(dto.ProjectIds);
                if (requestedProjectIds.Length == 0)
                {
                    return new BadRequestObjectResult(new { Message = "No Projects selected.", Title = "Parameter Error" });
                }

                var (projectIdByPk, notFoundProjectIds) = await ResolveProjectIdsAsync(requestedProjectIds, cancellationToken);
                var resolvedProjectPks = projectIdByPk.Keys.ToArray();
                var rowsToRemove = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => resolvedProjectPks.Contains(x.ProjectPK) && x.ProjectGroupFK == group.Id)
                    .ToListAsync(cancellationToken);

                var removedPks = rowsToRemove.Select(x => x.ProjectPK).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var notInGroupProjectIds = notFoundProjectIds
                    .Concat(projectIdByPk.Where(x => !removedPks.Contains(x.Key)).Select(x => x.Value))
                    .ToArray();

                if (rowsToRemove.Count > 0)
                {
                    var removePks = removedPks.ToArray();
                    transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    // Conditional write: only rows still in THIS group. If one was moved to another
                    // group since the read above, nothing is written, so that group keeps it.
                    var updated = await _db.tProjects
                        .Where(x => removePks.Contains(x.ProjectPK) && x.ProjectGroupFK == group.Id)
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.ProjectGroupFK, (int?)null), cancellationToken);
                    if (updated != rowsToRemove.Count)
                    {
                        await RollbackQuietlyAsync(transaction);
                        return new ConflictObjectResult(new { Message = "Some of these projects were changed by someone else at the same time. Try again.", Title = "Try Again" });
                    }

                    var currentDate = Functions.CurrentDate();
                    var transactionLogs = rowsToRemove.Select(project => new TransactionLog
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
                    }).ToList();

                    await _db.tTransactionLog.AddRangeAsync(transactionLogs, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }

                return Ok(new
                {
                    Message = rowsToRemove.Count > 0 ? $"{rowsToRemove.Count} project(s) removed from group." : "No projects were removed.",
                    Title = rowsToRemove.Count > 0 ? "Remove Complete" : "Nothing Removed",
                    RemovedProjectIds = rowsToRemove.Select(x => projectIdByPk[x.ProjectPK]).ToArray(),
                    NotInGroupProjectIds = notInGroupProjectIds
                });
            }
            catch (Exception ex)
            {
                await RollbackQuietlyAsync(transaction);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId?.ToString() ?? string.Empty);
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

                var members = await _db.tProjects
                    .AsNoTracking()
                    .Where(x => x.ProjectGroupFK == groupId)
                    .Select(x => new { x.ProjectPK, IsLumpSum = x.ProjectType == "LS" && x.ParentProjectId == null })
                    .ToListAsync(cancellationToken);
                var projectKeys = members.Select(x => x.ProjectPK).ToList();

                var projectList = await _db.vProjectLatest
                    .AsNoTracking()
                    .Where(x => projectKeys.Contains(x.ProjectPK))
                    .ToListAsync(cancellationToken);

                // IsLumpSum is computed, not a view column (see ProjectLatest). Set it here as
                // ShowProjects does, so a Lump Sum Project's link opens the Lump Sum page.
                var lumpSumPks = members.Where(x => x.IsLumpSum).Select(x => x.ProjectPK).ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (var row in projectList)
                {
                    row.IsLumpSum = lumpSumPks.Contains(row.ProjectPK);
                }

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

        private static string[] NormalizeProjectIds(IEnumerable<string>? projectIds)
        {
            return (projectIds ?? Array.Empty<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        /// <summary>
        /// Resolves each requested ID (a Project ID or a Project PK, any case) against vProjectLatest.
        /// Returns PK → Project ID for the projects found (so results always report Project IDs),
        /// and the IDs that matched nothing, as typed. vProjectLatest can hold more than one row
        /// per PK, so each PK takes the Project ID the user typed, else the first one in order.
        /// </summary>
        private async Task<(Dictionary<string, string> ProjectIdByPk, string[] NotFoundProjectIds)> ResolveProjectIdsAsync(
            string[] requestedProjectIds, CancellationToken cancellationToken)
        {
            var matches = await _db.vProjectLatest
                .AsNoTracking()
                .Where(x => requestedProjectIds.Contains(x.ProjectId) || requestedProjectIds.Contains(x.ProjectPK))
                .Select(x => new { x.ProjectPK, x.ProjectId })
                .ToListAsync(cancellationToken);

            var typed = requestedProjectIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var projectIdByPk = matches
                .GroupBy(x => x.ProjectPK, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    x => x.Key,
                    x => (x.FirstOrDefault(p => typed.Contains(p.ProjectId)) ?? x.OrderBy(p => p.ProjectId, StringComparer.OrdinalIgnoreCase).First()).ProjectId,
                    StringComparer.OrdinalIgnoreCase);

            var notFoundProjectIds = requestedProjectIds
                .Where(id => !matches.Any(p =>
                    string.Equals(p.ProjectId, id, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(p.ProjectPK, id, StringComparison.OrdinalIgnoreCase)))
                .ToArray();

            return (projectIdByPk, notFoundProjectIds);
        }

        // CancellationToken.None: when the request is cancelled mid-write, a rollback handed the
        // request's token throws again inside the catch and masks the original error.
        private static async Task RollbackQuietlyAsync(IDbContextTransaction? transaction)
        {
            if (transaction == null)
            {
                return;
            }

            try
            {
                await transaction.RollbackAsync(CancellationToken.None);
            }
            catch
            {
            }
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

