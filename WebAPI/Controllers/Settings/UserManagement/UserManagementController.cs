using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Newtonsoft.Json;
using System.Reflection;

namespace WebAPI.Controllers.Settings.UserManagement
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    //[Authorize(Roles = "Admin")]
    [AllowAnonymous]
    public class UserManagementController : CoreController
    {
        public UserManagementController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }

        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitUserManagement()
        {
            try
            {
                var CountUsers = await _db.vUsers.CountAsync();
                var CountPermissions = await _db.tPermissionActions.CountAsync();
                var CountGroups = await _db.tGroups.CountAsync();
                List<DBHelper.Models.Views.Users> UserLists = await _db.vUsers
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .Take(10)
                .ToListAsync();
                var response = new
                {
                    NumberOfUsers = CountUsers,
                    NumberOfPermissions = CountPermissions,
                    NumberOfGroups = CountGroups,
                    Users = UserLists,
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #region USERS TAB
        [HttpPost]
        public async Task<IActionResult> ShowUsers([FromBody] UsersPaginationDto dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.Users)
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

                var baseQuery = _db.vUsers.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

                if (!string.IsNullOrEmpty(dto.Filters?.UserGroup))
                    baseQuery = baseQuery.Where(e => e.UserGroups!.Contains(dto.Filters.UserGroup));

                if (dto.Filters?.IsActive != null)
                    baseQuery = baseQuery.Where(e => e.IsActive == dto.Filters.IsActive);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.Users> permissionLists = await sortedQuery
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
        [HttpPost]
        public async Task<IActionResult> DeleteUser([FromBody] DBHelper.Models.Views.Users dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getUser == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exists in the System!", Title = "User not found" });
                }
                var getUserGroups = await _db.tUserGroups.Where(x => x.UserId == getUser.UserId).ToListAsync();
                if(getUserGroups.Count > 0)
                {
                    _db.tUserGroups.RemoveRange(getUserGroups);
                }
                _db.tUsers.Remove(getUser);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "User deleted updated successfully",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        //[HttpPost]
        //public async Task<IActionResult> UpdateUser([FromBody] DBHelper.Models.Views.Users dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id);
        //        if (getUser == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exists in the System!", Title = "User not found" });
        //        }
        //        getUser.Name = dto.Name;
        //        getUser.Email = dto.Email;
        //        getUser.IsActive = dto.IsActive;
        //        getUser.PlantillaOffice = dto.PlantillaOffice;
        //        getUser.EmployeeId = dto.EmployeeId;
        //        getUser.RegCode = dto.RegCode;
        //        if (!string.IsNullOrEmpty(dto.UserGroups))
        //        {
        //            DateTime CurrentDate = Functions.CurrentDate();
        //            string[] groups = dto.UserGroups.Split(',');
        //            string newUserId = dto.UserId;
        //            var getUserGroups = await _db.tUserGroups.Where(x => x.UserId == getUser.UserId).ToListAsync();
        //            var getGroups = await _db.tGroups.Where(x => groups.Contains(x.GroupName)).Select(x => x.Id).ToListAsync();
        //            var toRemoveGroups = getUserGroups.Where(x => !getGroups.Contains(x.GroupId)).ToList();
        //            if (getUserGroups.Count() > 0)
        //            {
        //                var toAddGroups = getGroups.Where(selected => !getUserGroups.Any(ug => ug.GroupId == selected)).ToList();
        //                if(toRemoveGroups.Count > 0)
        //                {
        //                    _db.tUserGroups.RemoveRange(toRemoveGroups);
        //                }
        //                if (toAddGroups.Count > 0)
        //                {
        //                    _db.tUserGroups.AddRange(toAddGroups.Select(x =>
        //                        new DBHelper.Models.Table.UserGroups()
        //                        {
        //                            UserId = newUserId,
        //                            GroupId = x,
        //                            CreatedBy = _Session.UserId,
        //                            CreatedDate = CurrentDate
        //                        }
        //                    ));
        //                }   
        //            }
        //            else if(getUserGroups.Count() < 1 && getGroups.Count > 0)
        //            {
        //                _db.tUserGroups.AddRange(getGroups.Select(x =>
        //                    new DBHelper.Models.Table.UserGroups()
        //                    {
        //                        UserId = newUserId,
        //                        GroupId = x,
        //                        CreatedBy = _Session.UserId,
        //                        CreatedDate = CurrentDate
        //                    }
        //                ));
        //            }
        //        }

        //        _db.tUsers.Update(getUser);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();
        //        return Ok(new
        //        {
        //            Message = "User Info updated successfully",
        //            Title = "Under Maintenance"
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
        //[HttpPost]
        //public async Task<IActionResult> AddUser([FromBody] DBHelper.Models.Views.Users dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserId && x.Id == dto.Id);
        //        if (getUser != null)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' already exists in the System!", Title = "User Already Exists" });
        //        }
        //        var getPlantillaOffice = await _db.tImplementingOffice.FirstOrDefaultAsync(x => x.OrgName == dto.PlantillaOffice);
        //        var getRegCode = await _db.tImplementingOffice.FirstOrDefaultAsync(x => x.OrgName == dto.RegCode);
        //        DBHelper.Models.Table.Users addUser = new DBHelper.Models.Table.Users()
        //        {
        //            UserId = dto.UserId,
        //            Name = dto.Name,
        //            Email = dto.Email,
        //            IsActive = dto.IsActive,
        //            PlantillaOffice = getPlantillaOffice != null ? getPlantillaOffice.OrgName : dto.PlantillaOffice,
        //            EmployeeId = dto.EmployeeId,
        //            RegCode = getRegCode != null ? getRegCode.OrgName! : dto.RegCode,
        //        };
        //        if (!string.IsNullOrEmpty(dto.UserGroups) && dto.UserGroups.Contains(","))
        //        {
        //            string[] groups = dto.UserGroups.Split(',');
        //            DateTime CurrentDate = Functions.CurrentDate();
        //            var getGroups = await _db.tGroups.Where(x => groups.Contains(x.GroupName)).Select(x => x.Id).ToListAsync();
        //            if (getGroups.Count > 0)
        //            {
        //                _db.tUserGroups.AddRange(getGroups.Select(GrouId =>
        //                    new DBHelper.Models.Table.UserGroups()
        //                    {
        //                        UserId = dto.UserId,
        //                        GroupId = GrouId,
        //                        CreatedBy = _Session.UserId,
        //                        CreatedDate = CurrentDate
        //                    }
        //                ));
        //            }
        //        }
        //        _db.tUsers.Add(addUser);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();
        //        return Ok(new
        //        {
        //            Message = "User added successfully",
        //            Title = "Add Complete"
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
        #endregion
        #region PERMISSIONS TAB
        [HttpPost]
        public async Task<IActionResult> ShowPermissions([FromBody] ShowPermissionsDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.Permissions)
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

                var baseQuery = _db.vPermissions.AsNoTracking();

                if (!string.IsNullOrEmpty(dto.Filters?.ModuleFunction))
                    baseQuery = baseQuery.Where(e => e.ModuleFunction!.Contains(dto.Filters.ModuleFunction));

                if (!string.IsNullOrEmpty(dto.Filters?.Description))
                    baseQuery = baseQuery.Where(e => e.ModuleFunctionDescription!.Contains(dto.Filters.Description));

                if (!string.IsNullOrEmpty(dto.Filters?.PermissionGroupName))
                    baseQuery = baseQuery.Where(e => e.Module!.Contains(dto.Filters.PermissionGroupName));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();
                dto.sortDirection = string.IsNullOrEmpty(dto.SortField) ? sortDirectionList.DESC : dto.sortDirection;
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                // Apply sorting and pagination
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                var permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists, // Match your frontend expectation
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
        [HttpPost]
        public async Task<IActionResult> ShowPermissionGroups()
        {
            try
            {
                List<PermissionControllers> Groups = await _db.tPermissionControllers.ToListAsync();
                return Ok(Groups);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> SyncPermission()
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Discover all controller Types via reflection
                var controllerTypes = typeof(CoreController).Assembly
                    .GetTypes()
                    .Where(t => t.IsClass && !t.IsAbstract && t.IsSubclassOf(typeof(CoreController)))
                    .ToList();

                // 2. Sync controllers to tPermissionControllers
                var existingControllers = await _db.tPermissionControllers.ToListAsync();
                var existingNames = existingControllers
                    .Select(x => x.ControllerName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var newControllers = controllerTypes
                    .Where(t => !existingNames.Contains(t.Name))
                    .Select(t => new PermissionControllers
                    {
                        ControllerName = t.Name
                    })
                    .ToList();

                if (newControllers.Count > 0)
                {
                    await _db.tPermissionControllers.AddRangeAsync(newControllers);
                    await _db.SaveChangesAsync();
                }

                // 3. Discover all action methods per controller
                var discoveredActions = controllerTypes.SelectMany(type =>
                    type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                        .Where(m => !m.IsSpecialName &&
                            (m.ReturnType == typeof(IActionResult) || m.ReturnType == typeof(Task<IActionResult>)))
                        .Select(m => new { ControllerName = type.Name, ActionName = m.Name })
                ).ToList();

                // 4. Sync actions to tPermissionActions
                var existingActions = await _db.tPermissionActions.ToListAsync();
                var existingActionKeys = existingActions
                    .Select(x => x.ActionName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var newActions = discoveredActions
                    .Where(a => !existingActionKeys.Contains(a.ActionName))
                    .Select(a => new PermissionActions
                    {
                        ControllerName = a.ControllerName,
                        ActionName = a.ActionName,
                        Description = null
                    })
                    .ToList();

                if (newActions.Count > 0)
                {
                    await _db.tPermissionActions.AddRangeAsync(newActions);
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                var allControllers = await _db.tPermissionControllers
                    .OrderBy(x => x.ControllerName)
                    .ToListAsync();

                var allActions = await _db.tPermissionActions
                    .OrderBy(x => x.ControllerName)
                    .ThenBy(x => x.ActionName)
                    .ToListAsync();

                return Ok(new
                {
                    Message = $"Sync complete! Controllers added: {newControllers.Count}, Actions added: {newActions.Count}",
                    Title = "Sync Complete",
                    Controllers = allControllers,
                    Actions = allActions
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdatePermissionControllerDetails([FromBody] UpdatePermissionControllerDetailsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tPermissionControllers.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.ControllerName}' is not a recognized permission controller. Try syncing permissions to update the list.",
                        Title = "Unrecognized Controller"
                    });
                }
                getPermission.Description = dto.Description;
                _db.tPermissionControllers.Update(getPermission);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync(); return Ok(new
                {
                    Message = $"'{dto.ControllerName}' details have been saved successfully.",
                    Title = "Changes Saved"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdatePermissionActionDetails([FromBody] UpdatePermissionActionDetailsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tPermissionActions.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.ActionName}' is not a recognized permission action. Try syncing permissions to update the list.",
                        Title = "Unrecognized Action"
                    });
                }
                getPermission.Description = dto.Description;
                _db.tPermissionActions.Update(getPermission);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync(); return Ok(new
                {
                    Message = $"'{dto.ActionName}' details have been saved successfully.",
                    Title = "Changes Saved"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeletePermissionController(int id)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tPermissionControllers.FirstOrDefaultAsync(x => x.Id == id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The permission controller could not be found. Please ensure permissions are synced.",
                        Title = "Controller Not Found"
                    });
                }

                var hasActions = await _db.tPermissionActions
                    .AnyAsync(x => x.ControllerName == getPermission.ControllerName);

                if (hasActions)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getPermission.ControllerName}' cannot be deleted because it still has associated actions. Please remove the actions first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tPermissionControllers.Remove(getPermission);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Permission controller '{getPermission.ControllerName}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        public async Task<IActionResult> DeletePermissionAction(int id)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getAction = await _db.tPermissionActions.FirstOrDefaultAsync(x => x.Id == id);
                if (getAction == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The permission action could not be found. Please ensure permissions are synced.",
                        Title = "Action Not Found"
                    });
                }

                // Check if action is currently assigned to any roles before deleting
                var isAssignedToRole = await _db.tGroupRoles
                    .AnyAsync(x => x.ActionIds.Contains(getAction.Id));

                if (isAssignedToRole)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getAction.ActionName}' cannot be deleted because it is currently assigned to one or more roles. Please remove the role assignments first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tPermissionActions.Remove(getAction);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Permission action '{getAction.ActionName}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region USER GROUP TAB
        [HttpPost]
        public async Task<IActionResult> ShowUserGroups([FromBody] UserGroupsPaginationDto dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.UserGroups)
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

                var baseQuery = _db.vUserGroups.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.GroupName))
                    baseQuery = _db.vUserGroups.AsNoTracking().Where(e => e.GroupName!.Contains(dto.Filters.GroupName));

                if (!string.IsNullOrEmpty(dto.Filters?.PermissionNames))
                    baseQuery = _db.vUserGroups.AsNoTracking().Where(e => e.PermissionNames!.Contains(dto.Filters.PermissionNames));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();
                dto.sortDirection = string.IsNullOrEmpty(dto.SortField) ? sortDirectionList.DESC : dto.sortDirection;
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                // Apply sorting and pagination
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                var permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists, // Match your frontend expectation
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
        //[HttpPost]
        //public async Task<IActionResult> AddUserGroup([FromBody] AddUserGroupDTO dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        if (string.IsNullOrWhiteSpace(dto.GroupName))
        //        {
        //            return BadRequest(new { Message = "Group name is required.", Title = "Validation Error" });
        //        }

        //        var existingGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.GroupName == dto.GroupName);
        //        if (existingGroup != null)
        //        {
        //            return BadRequest(new { Message = $"Group Name '{dto.GroupName}' already exists!", Title = "Group Name Exists" });
        //        }

        //        DateTime currentDate = Functions.CurrentDate();

        //        // Create and save the new group
        //        var newGroup = new Groups
        //        {
        //            GroupName = dto.GroupName!,
        //            Description = dto.Description,
        //            CreatedBy = _Session.UserId,
        //            CreatedDate = currentDate
        //        };
        //        await _db.tGroups.AddAsync(newGroup);
        //        await _db.SaveChangesAsync();

        //        // Add GroupRoles entry
        //        var groupRole = new GroupRoles
        //        {
        //            GroupName = dto.GroupName!,
        //            ActionIds = dto.ActionIds,
        //            CreatedBy = _Session.UserId,
        //            CreatedDate = currentDate
        //        };
        //        await _db.tGroupRoles.AddAsync(groupRole);

        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();

        //        return Ok(new { Message = "New Group added successfully!", Title = "Add Complete" });
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
        //[HttpPost]
        //public async Task<IActionResult> UpdateUserGroup([FromBody] UpdateUserGroupDTO dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        var ValidateGroupRole = await _db.tGroupRoles.FirstOrDefaultAsync(x => x.Id == dto.Id);
        //        if (ValidateGroupRole == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"Group Name '{dto.GroupName}' does no exists!", Title = "Group not found" });
        //        }
        //        if (dto.PermissionIds.Length > 0)
        //        {
        //            DateTime CurrentDate = Functions.CurrentDate();
        //            var permissions = await _db.tPermissionControllers.Select(x => x.Id).ToListAsync();
        //            var checkIds = dto.PermissionIds!.Where(x => !permissions.Contains(x)).ToList();
        //            if (checkIds.Count > 0)
        //            {
        //                return new BadRequestObjectResult(new { Message = $"Some of the selected Permission IDs do not exist in the System!", Title = "Invalid Permission IDs" });
        //            }
        //            var existingRoles = await _db.tGroupRoles.Where(x => x.GroupId == checkSameName.Id).ToListAsync();
        //            if (existingRoles.Count > 0)
        //            {
        //                var toRemoveRoles = existingRoles.Where(x => !dto.PermissionIds!.Contains(x.PermissionId)).ToList();
        //                var toAddRoles = dto.PermissionIds.Where(selected => !existingRoles.Any(ug => ug.PermissionId == selected)).ToList();
        //                if (toRemoveRoles.Count > 0)
        //                {
        //                    _db.tGroupRoles.RemoveRange(toRemoveRoles);
        //                }
        //                if (toAddRoles.Count > 0)
        //                {
        //                    _db.tGroupRoles.AddRange(toAddRoles.Select(permissionId =>
        //                        new GroupRoles()
        //                        {
        //                            GroupId = checkSameName.Id,
        //                            PermissionId = permissionId,
        //                            CreatedBy = _Session.UserId,
        //                            CreatedDate = CurrentDate
        //                        }
        //                    ));
        //                }
        //            }
        //        }
        //        checkSameName.GroupName = dto.GroupName;
        //        checkSameName.Description = dto.Description;
        //        _db.tGroups.Update(checkSameName);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();
        //        return Ok(
        //            new
        //            {
        //                Message = $"Group {dto.GroupName} updated successfully!",
        //                Title = "Update Complete"
        //            }
        //        );
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }

        //}
        //[HttpPost]
        //public async Task<IActionResult> DeleteUserGroup([FromBody] DBHelper.Models.Views.UserGroups dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        var getGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.Id);
        //        if (getGroup == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"Group with ID '{dto.Id}' does not exist in the System!", Title = "Group not found" });
        //        }

        //        var usersInGroup = await _db.tUserGroups.Where(x => x.GroupId == dto.Id).CountAsync();
        //        if (usersInGroup > 0)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"Cannot delete group '{getGroup.GroupName}' because it has {usersInGroup} user(s) assigned to it. Please remove all users from this group first.", Title = "Group has members" });
        //        }

        //        _db.tGroups.Remove(getGroup);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();
                
        //        return Ok(new
        //        {
        //            Message = $"Group '{getGroup.GroupName}' deleted successfully!",
        //            Title = "Delete Complete"
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
        #endregion
    }
}