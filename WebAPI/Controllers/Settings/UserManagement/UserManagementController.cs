using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Permission;
using DBHelper.Models.Views;
using DBHelper.Models.Views.Program;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Reflection;
using WebAPI.Controllers.Programs;
using WebAPI.Controllers.Settings.Modules;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Settings.UserManagement
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UserManagementController : CoreController
    {
        public UserManagementController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        #region MODULE TAB
        [HttpPost]
        public async Task<IActionResult> ShowAppModules([FromBody] ModulePaginationDto dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();


                if (!string.IsNullOrEmpty(dto.Filters.ModuleName))
                    filters.Add(("v.[ModuleName] LIKE @ModuleName", "@ModuleName", $"%{dto.Filters.ModuleName}%"));

                FilterDataResult<DBHelper.Models.Views.AppModules> result =
                    await _db.FilterDataCursor<
                        DBHelper.Models.Views.AppModules,
                        ModuleFilterDTO>(
                            tableName: "vAppModules",
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

        // ── AddAppModule ──────────────────────────────────────────────────────────────
        // Creates the module, then links any controllers/views whose Linked = true.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> AddAppModule([FromBody] DBHelper.Models.Views.AppModules dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var remediatedResult = await AddAppModuleValidated(dto, transaction, cancellationToken);
                if (remediatedResult != null)
                    return remediatedResult;

                // Guard: module name must be unique
                var existing = await _db.tAppModules
                    .FirstOrDefaultAsync(x => x.ModuleName == dto.ModuleName, cancellationToken);
                if (existing != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{dto.ModuleName}' already exists in the System.",
                        Title = "Duplicate Module"
                    });
                }

                var newModule = new DBHelper.Models.Table.Permission.AppModules
                {
                    ModuleName = dto.ModuleName,
                    Description = dto.Description
                };

                await _db.tAppModules.AddAsync(newModule);
                await _db.SaveChangesAsync(cancellationToken); // Get the inserted row into the DB first

                // Link any controllers marked Linked = true
                if (dto.Controllers != null)
                {
                    var Controllers = JsonConvert.DeserializeObject<List<AppModuleControllerModel>>(dto.Controllers);
                    if(Controllers != null)
                    {
                        var linkedControllerNames = Controllers
                            .Where(c => c.Linked)
                            .Select(c => c.ControllerName)
                            .ToList();

                        if (linkedControllerNames.Any())
                        {
                            var controllers = await _db.tApiControllers
                                .Where(x => linkedControllerNames.Contains(x.ControllerName))
                                .ToListAsync(cancellationToken);

                            foreach (var ctrl in controllers)
                                ctrl.ModuleName = newModule.ModuleName;

                            _db.tApiControllers.UpdateRange(controllers);
                        }
                    }
                }

                // Link any views marked Linked = true
                if (dto.Views != null)
                {
                    var Views = JsonConvert.DeserializeObject<List<AppModuleViewModel>>(dto.Views);
                    if(Views != null)
                    {
                        var linkedRouteNames = Views
                            .Where(v => v.Linked)
                            .Select(v => v.RouteName)
                            .ToList();

                        if (linkedRouteNames.Any())
                        {
                            var views = await _db.tAppViews
                                .Where(x => linkedRouteNames.Contains(x.RouteName))
                                .ToListAsync(cancellationToken);

                            foreach (var view in views)
                                view.ModuleName = newModule.ModuleName;

                            _db.tAppViews.UpdateRange(views);
                        }
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Module '{dto.ModuleName}' has been created successfully.",
                    Title = "Module Created"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        // ── UpdateAppModule ───────────────────────────────────────────────────────────
        // Updates the module description, then reconciles controller and view linkages:
        //   - Linked = true  → sets tApiControllers/tPermissionViews.ModuleName = this module
        //   - Linked = false → clears ModuleName to NULL (unlinks from this module)
        //
        // NOTE: Only controllers/views listed in the payload are touched.
        //       Unlisted ones are left as-is.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> UpdateAppModule([FromBody] DBHelper.Models.Views.AppModules dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getModule = await _db.tAppModules.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getModule == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module with Id '{dto.Id}' does not exist in the System.",
                        Title = "Module not found"
                    });
                }

                var remediatedResult = await UpdateAppModuleValidated(dto, getModule, transaction, cancellationToken);
                if (remediatedResult != null)
                    return remediatedResult;

                // Update description (ModuleName is immutable after creation)
                getModule.Description = dto.Description;
                _db.tAppModules.Update(getModule);

                // ── Reconcile Controller linkages ─────────────────────────────────────
                if (dto.Controllers != null && dto.Controllers.Any())
                {
                    var Controllers = JsonConvert.DeserializeObject<List<AppModuleControllerModel>>(dto.Controllers);
                    var controllerNames = Controllers.Where(x => x.Linked).Select(c => c.ControllerName).ToList();

                    //var dbControllers = await _db.tApiControllers
                    //    .AsNoTracking()
                    //    .Where(x => controllerNames.Contains(x.ControllerName))
                    //    .ToListAsync(cancellationToken);

                    var AllController = await _db.tApiControllers
                        .AsNoTracking()
                        .Where(x => x.ModuleName == dto.ModuleName)
                        .ToListAsync(cancellationToken);

                    foreach (var ctrl in AllController)
                    {
                        bool IsLinked = (controllerNames.FirstOrDefault(x => x == ctrl.ControllerName) != null) ? true : false;

                        // Linked = true  → assign to this module
                        // Linked = false → remove from this module (set NULL)
                        ctrl.ModuleName = IsLinked ? getModule.ModuleName : null;
                    }

                    _db.tApiControllers.UpdateRange(AllController);

                    //Update any controllers that are currently not linked to any module (ModuleName is NULL) but are marked Linked = true in the payload, to link to this module.a
                    if (AllController.Count != controllerNames.Count)
                    {
                        var NoModulController = await _db.tApiControllers
                            .AsNoTracking()
                            .Where(x => string.IsNullOrEmpty(x.ModuleName))
                            .ToListAsync(cancellationToken);
                        if(NoModulController.Count > 0)
                        {
                            foreach(var ctrl in NoModulController)
                            {
                                bool IsLinked = (controllerNames.FirstOrDefault(x => x == ctrl.ControllerName) != null) ? true : false;
                                ctrl.ModuleName = IsLinked ? getModule.ModuleName : null;
                            }
                            _db.tApiControllers.UpdateRange(NoModulController);
                        }
                    }
                }

                // ── Reconcile View linkages ───────────────────────────────────────────
                if (dto.Views != null && dto.Views.Any())
                {
                    var Views = JsonConvert.DeserializeObject<List<AppModuleViewModel>>(dto.Views);
                    var routeNames = Views.Where(x => x.Linked).Select(v => v.RouteName).ToList();

                    //var dbViews = await _db.tPermissionViews
                    //    .Where(x => routeNames.Contains(x.RouteName))
                    //    .ToListAsync(cancellationToken);
                    var AllViews = await _db.tAppViews
                        .AsNoTracking()
                        .Where(x => x.ModuleName == dto.ModuleName)
                        .ToListAsync(cancellationToken);

                    foreach (var view in AllViews)
                    {
                        bool IsLinked = (routeNames.FirstOrDefault(x => x == view.RouteName) != null) ? true : false;

                        // Linked = true  → assign to this module
                        // Linked = false → remove from this module (set NULL)
                        view.ModuleName = IsLinked ? getModule.ModuleName : null;
                    }

                    _db.tAppViews.UpdateRange(AllViews);
                    //Update any views that are currently not linked to any module (ModuleName is NULL) but are marked Linked = true in the payload, to link to this module.
                    if (AllViews.Count != routeNames.Count)
                    {
                        var NoModulViews = await _db.tAppViews
                            .AsNoTracking()
                            .Where(x => string.IsNullOrEmpty(x.ModuleName))
                            .ToListAsync(cancellationToken);
                        if(NoModulViews.Count > 0)
                        {
                            foreach(var view in NoModulViews)
                            {
                                bool IsLinked = (routeNames.FirstOrDefault(x => x == view.RouteName) != null) ? true : false;
                                view.ModuleName = IsLinked ? getModule.ModuleName : null;
                            }
                            _db.tAppViews.UpdateRange(NoModulViews);
                        }
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Module '{getModule.ModuleName}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        // ── DeleteAppModule ───────────────────────────────────────────────────────────
        // Blocks deletion if any controller or view is still linked to the module.
        // The frontend should unlink all first (set Linked = false via UpdateAppModule)
        // before calling delete.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> DeleteAppModule([FromBody] DBHelper.Models.Views.AppModules dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getModule = await _db.tAppModules.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getModule == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{dto.ModuleName}' does not exist in the System.",
                        Title = "Module not found"
                    });
                }

                // Block if any controller is still linked
                var linkedController = await _db.tApiControllers
                    .FirstOrDefaultAsync(x => x.ModuleName == getModule.ModuleName);

                if (linkedController != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{getModule.ModuleName}' is still linked to controller '{linkedController.ControllerName}'. " +
                                  $"Please unlink all controllers before deleting.",
                        Title = "Module still in use"
                    });
                }

                // Block if any view is still linked
                var linkedView = await _db.tAppViews
                    .FirstOrDefaultAsync(x => x.ModuleName == getModule.ModuleName);

                if (linkedView != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{getModule.ModuleName}' is still linked to view '{linkedView.RouteName}'. " +
                                  $"Please unlink all views before deleting.",
                        Title = "Module still in use"
                    });
                }

                _db.tAppModules.Remove(getModule);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Module '{getModule.ModuleName}' has been deleted successfully.",
                    Title = "Delete Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
        #region USERS TAB
        [HttpPost]
        public async Task<IActionResult> InitUserManagement(CancellationToken cancellationToken)
        {
            try
            {
                var CountUsers = await _db.vUsers.CountAsync(cancellationToken);
                var CountPermissions = await _db.tApiActions.CountAsync(cancellationToken);
                var CountRoutePermissions = await _db.tAppViews.CountAsync(cancellationToken);
                var CountGroups = await _db.tGroups.CountAsync(cancellationToken);
                List<DBHelper.Models.Views.Users> UserLists = await _db.vUsers
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .Take(10)
                .ToListAsync(cancellationToken);
                var response = new
                {
                    NumberOfUsers = CountUsers,
                    NumberOfAPIPermissions = CountPermissions,
                    NumberOfRoutePermissions = CountRoutePermissions,
                    NumberOfGroups = CountGroups,
                    Users = UserLists,
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> ShowUsers([FromBody] UsersPaginationDto dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.EmployeeId))
                    filters.Add(("v.[EmployeeId] LIKE @EmployeeId", "@EmployeeId", $"%{dto.Filters.EmployeeId}%"));

                if (!string.IsNullOrEmpty(dto.Filters.UserId))
                    filters.Add(("v.[UserId] LIKE @UserId", "@UserId", $"%{dto.Filters.UserId}%"));

                if (!string.IsNullOrEmpty(dto.Filters.Name))
                    filters.Add(("v.[Name] LIKE @Name", "@Name", $"%{dto.Filters.Name}%"));

                if (!string.IsNullOrEmpty(dto.Filters.Email))
                    filters.Add(("v.[Email] LIKE @Email", "@Email", $"%{dto.Filters.Email}%"));

                if (!string.IsNullOrEmpty(dto.Filters.UserGroup))
                    filters.Add(("v.[UserGroupNames] LIKE @UserGroup", "@UserGroup", $"%{dto.Filters.UserGroup}%"));

                if (dto.Filters.IsActive != null)
                    filters.Add(("v.[IsActive] = @IsActive", "@IsActive", dto.Filters.IsActive.Value));

                FilterDataResult<DBHelper.Models.Views.Users> result =
                    await _db.FilterDataCursor<
                        DBHelper.Models.Views.Users,
                        UserFilterDTO>(
                            tableName: "vUsers",
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
        public async Task<IActionResult> DeleteUser([FromBody] DBHelper.Models.Views.Users dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getUser == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exist in the System.", Title = "User not found" });
                }
                if (string.Equals(getUser.UserId, _Session.UserId, StringComparison.OrdinalIgnoreCase))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "You cannot delete the account used by the current session.",
                        Title = "Self-deletion Not Allowed"
                    });
                }
                var getUserGroups = await _db.tUserGroups.Where(x => x.UserId == getUser.UserId).ToListAsync(cancellationToken);
                if(getUserGroups.Count > 0)
                {
                    _db.tUserGroups.RemoveRange(getUserGroups);
                }
                _db.tUsers.Remove(getUser);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "User deleted updated successfully",
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
        public async Task<IActionResult> UpdateUser([FromBody] DBHelper.Models.Views.Users dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. Validate required fields
                if (string.IsNullOrWhiteSpace(dto.UserId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "User ID is required and cannot be empty.",
                        Title = "Invalid User ID"
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Name is required and cannot be empty.",
                        Title = "Invalid Name"
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.RegCode))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Region code is required and cannot be empty.",
                        Title = "Invalid Region Code"
                    });
                }

                // 2. Check if User exists in tUsers
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getUser == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The user '{dto.UserId}' could not be found. Please ensure the user exists.",
                        Title = "User Not Found"
                    });
                }

                // 3. Check if UserId is already taken by another user
                var userIdExists = await _db.tUsers
                    .AnyAsync(x => x.UserId.ToLower() == dto.UserId.ToLower() && x.Id != dto.Id);

                if (userIdExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A user with the ID '{dto.UserId}' already exists. Please use a different User ID.",
                        Title = "User ID Already Exists"
                    });
                }

                // 4. Validate UserGroupIds exist in tGroups
                if (dto.UserGroupIds.Length > 0)
                {
                    var existingGroupIds = await _db.tGroups
                        .Where(x => dto.UserGroupIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);

                    var invalidGroupIds = dto.UserGroupIds
                        .Except(existingGroupIds)
                        .ToList();

                    if (invalidGroupIds.Count > 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The following Group IDs do not exist: {string.Join(", ", invalidGroupIds)}. Please ensure the groups exist.",
                            Title = "Invalid Group IDs"
                        });
                    }
                }

                var normalizedGroupIds = dto.UserGroupIds.Distinct().OrderBy(x => x).ToArray();
                var oldUserId = getUser.UserId;
                var getUserGroup = await _db.tUserGroups
                    .FirstOrDefaultAsync(x => x.UserId == oldUserId, cancellationToken);

                // 5. Update User details
                getUser.EmployeeId = dto.EmployeeId?.Trim();
                getUser.UserId = dto.UserId.Trim();
                getUser.Name = dto.Name.Trim();
                getUser.Email = dto.Email?.Trim();
                getUser.RegCode = dto.RegCode.Trim();
                getUser.PlantillaOffice = dto.PlantillaOffice?.Trim();
                getUser.IsActive = dto.IsActive;
                _db.tUsers.Update(getUser);

                if (getUserGroup != null)
                {
                    getUserGroup.UserId = getUser.UserId;
                    getUserGroup.GroupIds = normalizedGroupIds;
                    _db.tUserGroups.Update(getUserGroup);
                }
                else
                {
                    // Create new UserGroups record if it doesn't exist
                    if (normalizedGroupIds.Length > 0)
                    {
                        var newUserGroup = new DBHelper.Models.Table.User.UserGroups
                        {
                            UserId = getUser.UserId,
                            GroupIds = normalizedGroupIds,
                            CreatedBy = User.Identity?.Name ?? "System",
                            CreatedDate = DateTime.UtcNow
                        };
                        await _db.tUserGroups.AddAsync(newUserGroup);
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"User '{getUser.Name}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> AddUser([FromBody] DBHelper.Models.Views.Users dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Validate required fields
                if (string.IsNullOrWhiteSpace(dto.UserId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "User ID is required and cannot be empty.",
                        Title = "Invalid User ID"
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Name is required and cannot be empty.",
                        Title = "Invalid Name"
                    });
                }

                if (string.IsNullOrWhiteSpace(dto.RegCode))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Region code is required and cannot be empty.",
                        Title = "Invalid Region Code"
                    });
                }

                // 2. Check if UserId already exists
                var userExists = await _db.tUsers
                    .AnyAsync(x => x.UserId.ToLower() == dto.UserId.ToLower(), cancellationToken);

                if (userExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A user with the ID '{dto.UserId}' already exists. Please use a different User ID.",
                        Title = "User Already Exists"
                    });
                }

                // 3. Validate UserGroupIds exist in tGroups
                if (dto.UserGroupIds.Length > 0)
                {
                    var existingGroupIds = await _db.tGroups
                        .Where(x => dto.UserGroupIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);

                    var invalidGroupIds = dto.UserGroupIds
                        .Except(existingGroupIds)
                        .ToList();

                    if (invalidGroupIds.Count > 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The following Group IDs do not exist: {string.Join(", ", invalidGroupIds)}. Please ensure the groups exist.",
                            Title = "Invalid Group IDs"
                        });
                    }
                }

                var normalizedGroupIds = dto.UserGroupIds.Distinct().OrderBy(x => x).ToArray();

                // 4. Create new User
                var newUser = new DBHelper.Models.Table.User.Users
                {
                    EmployeeId = dto.EmployeeId?.Trim(),
                    UserId = dto.UserId.Trim(),
                    Name = dto.Name.Trim(),
                    Email = dto.Email?.Trim(),
                    RegCode = dto.RegCode.Trim(),
                    PlantillaOffice = dto.PlantillaOffice?.Trim(),
                    IsActive = dto.IsActive
                };

                await _db.tUsers.AddAsync(newUser);
                await _db.SaveChangesAsync(cancellationToken); // Save first to get generated Id

                // 5. Create UserGroups record linking User to GroupIds
                if (normalizedGroupIds.Length > 0)
                {
                    var newUserGroup = new DBHelper.Models.Table.User.UserGroups
                    {
                        UserId = newUser.UserId,
                        GroupIds = normalizedGroupIds,
                        CreatedBy = User.Identity?.Name ?? "System",
                        CreatedDate = DateTime.UtcNow
                    };

                    await _db.tUserGroups.AddAsync(newUserGroup);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"User '{newUser.Name}' has been created successfully.",
                    Title = "User Created",
                    Data = newUser
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
        #region VIEW PERMISSIONS TAB
        [HttpPost]
        public async Task<IActionResult> ShowViewPermissions([FromBody] ShowViewPermissionsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.RoutePath))
                    filters.Add(("v.[RoutePath] LIKE @RoutePath", "@RoutePath", $"%{dto.Filters.RoutePath}%"));

                FilterDataResult<AppViews> result =
                    await _db.FilterDataCursor<
                        AppViews,
                        ShowViewPermissionsFilterDTO>(
                            tableName: "tAppViews",
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
        public async Task<IActionResult> SyncViewPermissions([FromBody] SyncViewPermissionsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var remediatedResult = await SyncViewPermissionsValidated(dto, transaction, cancellationToken);
                if (remediatedResult != null) return remediatedResult;

                // 1. Get all existing PermissionViews from DB
                var existingViews = await _db.tAppViews.ToListAsync(cancellationToken);

                var existingPathMap = existingViews
                    .ToDictionary(x => x.RouteName, x => x, StringComparer.OrdinalIgnoreCase);

                // 2. Separate incoming routes into new and existing
                var newRoutes = new List<AppViews>();
                var updatedRoutes = new List<AppViews>();

                foreach (var route in dto.RoutesAvailable)
                {
                    if (existingPathMap.TryGetValue(route.RouteName, out var existing))
                    {
                        // Update RouteName if it changed
                        if (!string.Equals(existing.RouteName, route.RouteName, StringComparison.OrdinalIgnoreCase))
                        {
                            existing.RouteName = route.RouteName;
                            updatedRoutes.Add(existing);
                        }
                    }
                    else
                    {
                        // New route — add it
                        newRoutes.Add(new AppViews
                        {
                            RouteName = route.RouteName,
                            RoutePath = route.path,
                        });
                    }
                }

                if (newRoutes.Count > 0)
                    await _db.tAppViews.AddRangeAsync(newRoutes);

                if (updatedRoutes.Count > 0)
                    _db.tAppViews.UpdateRange(updatedRoutes);

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Sync complete! Routes added: {newRoutes.Count}, updated: {updatedRoutes.Count}",
                    Title = "Sync Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateViewPermissionDetails([FromBody] UpdateViewPermissionDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var getPermission = await _db.tAppViews.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.RoutePath}' is not a recognized permission view. Try syncing permissions to update the list.",
                        Title = "Unrecognized View"
                    });
                }
                getPermission.Description = dto.Description;
                _db.tAppViews.Update(getPermission);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Ok(new
                {
                    Message = $"'{dto.RoutePath}' details have been saved successfully.",
                    Title = "Changes Saved"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeleteViewPermission(int id, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var getAction = await _db.tAppViews.FirstOrDefaultAsync(x => x.Id == id,cancellationToken);
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
                    .AnyAsync(x => x.ViewIds.Contains(getAction.Id), cancellationToken);

                if (isAssignedToRole)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getAction.RoutePath}' cannot be deleted because it is currently assigned to one or more roles. Please remove the role assignments first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tAppViews.Remove(getAction);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Permission view '{getAction.RoutePath}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        #endregion
        #region PERMISSIONS TAB

        [HttpPost]
        public async Task<IActionResult> ShowPermissions([FromBody] ShowPermissionsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.ControllerName))
                    filters.Add(("v.[ControllerName] LIKE @ControllerName", "@ControllerName", $"%{dto.Filters.ControllerName}%"));

                if (!string.IsNullOrEmpty(dto.Filters.ActionName))
                    filters.Add(("v.[Actions] LIKE @ActionName", "@ActionName", $"%\"ActionName\":\"{dto.Filters.ActionName}%"));

                if (!string.IsNullOrEmpty(dto.Filters.ControllerDescription))
                    filters.Add(("v.[ControllerDescription] LIKE @ControllerDescription", "@ControllerDescription", $"%{dto.Filters.ControllerDescription}%"));

                FilterDataResult<APIPermissions> result =
                    await _db.FilterDataCursor<
                        APIPermissions,
                        ShowPermissionFilterDTO>(
                            tableName: "vAPIPermissions",
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
        public async Task<IActionResult> ShowPermissionGroups(CancellationToken cancellationToken)
        {
            try
            {
                List<ApiControllers> Groups = await _db.tApiControllers.ToListAsync(cancellationToken);
                return Ok(Groups);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> SyncAPIPermissions(CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var remediatedResult = await SyncApiPermissionsValidated(transaction, cancellationToken);
                if (remediatedResult != null) return remediatedResult;

                // 1. Discover all controller Types via reflection
                var controllerTypes = typeof(CoreController).Assembly
                    .GetTypes()
                    .Where(t => t.IsClass && !t.IsAbstract && t.IsSubclassOf(typeof(CoreController)))
                    .ToList()
                    .OrderBy(x => x.Name);

                // 2. Sync controllers to tApiControllers
                var existingControllers = await _db.tApiControllers.ToListAsync(cancellationToken);
                var existingNames = existingControllers
                    .Select(x => x.ControllerName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var newControllers = controllerTypes
                    .Where(t => !existingNames.Contains(t.Name))
                    .Select(t => new ApiControllers
                    {
                        ControllerName = t.Name
                    })
                    .ToList();

                if (newControllers.Count > 0)
                {
                    await _db.tApiControllers.AddRangeAsync(newControllers);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                // 3. Discover all action methods per controller
                var discoveredActions = controllerTypes.SelectMany(type =>
                    type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                        .Where(m => !m.IsSpecialName &&
                            (m.ReturnType == typeof(IActionResult) || m.ReturnType == typeof(Task<IActionResult>)))
                        .Select(m => new { ControllerName = type.Name, ActionName = m.Name })
                ).ToList()
                .OrderBy(x => x.ActionName);

                // 4. Sync actions to tApiActions
                var existingActions = await _db.tApiActions.ToListAsync(cancellationToken);
                var existingActionKeys = existingActions
                    .Select(x => x.ActionName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var newActions = discoveredActions
                    .Where(a => !existingActionKeys.Contains(a.ActionName))
                    .Select(a => new ApiActions
                    {
                        ControllerName = a.ControllerName,
                        ActionName = a.ActionName,
                        Description = null
                    })
                    .ToList();

                if (newActions.Count > 0)
                {
                    await _db.tApiActions.AddRangeAsync(newActions);
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                var allControllers = await _db.tApiControllers
                    .OrderBy(x => x.ControllerName)
                    .ToListAsync(cancellationToken);

                var allActions = await _db.tApiActions
                    .OrderBy(x => x.ControllerName)
                    .ThenBy(x => x.ActionName)
                    .ToListAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Sync complete! Controllers added: {string.Join(", ", newControllers.Select(x => x.ControllerName))}, Actions added: {string.Join(", ", newActions.Select(x => x.ActionName))}",
                    Title = "Sync Complete",
                    Controllers = allControllers,
                    Actions = allActions
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdatePermissionControllerDetails([FromBody] UpdatePermissionControllerDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tApiControllers.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.ControllerName}' is not a recognized permission controller. Try syncing permissions to update the list.",
                        Title = "Unrecognized Controller"
                    });
                }
                if (!string.IsNullOrWhiteSpace(dto.ModuleName) && !await _db.tAppModules.AnyAsync(x => x.ModuleName == dto.ModuleName, cancellationToken))
                    return BadRequest(new { Message = $"Module '{dto.ModuleName}' does not exist.", Title = "Unknown Module" });
                getPermission.Description = dto.Description;
                getPermission.ModuleName = dto.ModuleName;
                _db.tApiControllers.Update(getPermission);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Ok(new
                {
                    Message = $"'{dto.ControllerName}' details have been saved successfully.",
                    Title = "Changes Saved"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdatePermissionActionDetails([FromBody] UpdatePermissionActionDetailsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var getPermission = await _db.tApiActions.FirstOrDefaultAsync(x => x.Id == dto.Id, cancellationToken);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.ActionName}' is not a recognized permission action. Try syncing permissions to update the list.",
                        Title = "Unrecognized Action"
                    });
                }
                getPermission.Description = dto.Description;
                _db.tApiActions.Update(getPermission);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Ok(new
                {
                    Message = $"'{dto.ActionName}' details have been saved successfully.",
                    Title = "Changes Saved"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeletePermissionController(int id, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var getPermission = await _db.tApiControllers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The permission controller could not be found. Please ensure permissions are synced.",
                        Title = "Controller Not Found"
                    });
                }
                var controllerTypes = typeof(CoreController).Assembly
                    .GetTypes()
                    .FirstOrDefault(t => t.Name == getPermission.ControllerName);
                if(controllerTypes != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Deletion Restricted",
                        Message = $"The [{getPermission.ControllerName}] is still active in the code base. Delete the code-level controller before removing this permission record."
                    });
                }

                var hasActions = await _db.tApiActions
                    .AnyAsync(x => x.ControllerName == getPermission.ControllerName, cancellationToken);

                if (hasActions)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getPermission.ControllerName}' cannot be deleted because it still has associated actions. Please remove the actions first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tApiControllers.Remove(getPermission);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Permission controller '{getPermission.ControllerName}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeletePermissionAction(int id, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var getAction = await _db.tApiActions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
                if (getAction == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The permission action could not be found. Please ensure permissions are synced.",
                        Title = "Action Not Found"
                    });
                }

                var activeController = typeof(CoreController).Assembly.GetTypes().FirstOrDefault(x => string.Equals(x.Name, getAction.ControllerName, StringComparison.OrdinalIgnoreCase));
                var activeAction = activeController?.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .Any(x => string.Equals(x.Name, getAction.ActionName, StringComparison.OrdinalIgnoreCase)) == true;
                if (activeAction)
                    return BadRequest(new { Message = $"{getAction.ControllerName}.{getAction.ActionName} is still active in code.", Title = "Deletion Restricted" });

                // Check if action is currently assigned to any roles before deleting
                var isAssignedToRole = await _db.tGroupRoles
                    .AnyAsync(x => x.ActionIds.Contains(getAction.Id), cancellationToken);

                if (isAssignedToRole)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getAction.ActionName}' cannot be deleted because it is currently assigned to one or more roles. Please remove the role assignments first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tApiActions.Remove(getAction);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"Permission action '{getAction.ActionName}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, id, _Session.UserId.ToString());
            }
        }
        #endregion
        #region USER GROUP TAB
        [HttpPost]
        public async Task<IActionResult> ShowUserGroupDropdowns(CancellationToken cancellationToken)
        {
            try
            {
                var AppModules = await _db.tAppModules
                    .AsNoTracking()
                    .OrderBy(x => x.ModuleName)
                    .ToListAsync(cancellationToken);
                var PermissionControllers = await _db.tApiControllers
                    .AsNoTracking()
                    .OrderBy(x => x.ControllerName)
                    .ToListAsync(cancellationToken);
                var PermissionActions = await _db.tApiActions
                    .AsNoTracking()
                    .OrderBy(x => x.ActionName)
                    .ToListAsync(cancellationToken);
                var PermissionViews = await _db.tAppViews
                    .AsNoTracking()
                    .OrderBy(x => x.RoutePath)
                    .ToListAsync(cancellationToken);
                return Ok(new
                {
                    AppModules,
                    PermissionControllers,
                    PermissionActions,
                    PermissionViews
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> ShowUserGroups([FromBody] UserGroupsPaginationDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.GroupName))
                    filters.Add(("v.[GroupName] LIKE @GroupName", "@GroupName", $"%{dto.Filters.GroupName}%"));

                FilterDataResult<DBHelper.Models.Views.UserGroups> result =
                    await _db.FilterDataCursor<
                        DBHelper.Models.Views.UserGroups,
                        UserGroupFilterDTO>(
                            tableName: "vUserGroups",
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
        public async Task<IActionResult> AddUserGroup([FromBody] AddUserGroupDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                // 1. Validate GroupName
                if (string.IsNullOrWhiteSpace(dto.GroupName))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Group name is required and cannot be empty.",
                        Title = "Invalid Group Name"
                    });
                }

                // 2. Check if GroupName already exists in tGroups
                var groupExists = await _db.tGroups
                    .AnyAsync(x => x.GroupName.ToLower() == dto.GroupName.ToLower(), cancellationToken);

                if (groupExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A group with the name '{dto.GroupName}' already exists. Please choose a different name.",
                        Title = "Group Already Exists"
                    });
                }
                var NewGroup = new DBHelper.Models.Table.User.Groups
                {
                    GroupName = dto.GroupName.Trim(),
                    Description = dto.Description?.Trim(),
                    ApplyFilter = dto.ApplyFilter,
                    CreatedBy = _Session.UserId,
                    CreatedDate = CurrentDate,
                };
                await _db.tGroups.AddAsync(NewGroup);
                await _db.SaveChangesAsync(cancellationToken);
                var NewGroupRoles = new DBHelper.Models.Table.User.GroupRoles
                {
                    GroupId = NewGroup.Id,
                    ActionIds = Array.Empty<int>(),
                    ViewIds = Array.Empty<int>(),
                };
                await _db.tGroupRoles.AddAsync(NewGroupRoles);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"User group '{NewGroup.GroupName}' has been created successfully.",
                    Title = "Group Created"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateUserGroup([FromBody] UpdateUserGroupDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. Validate GroupName
                if (string.IsNullOrWhiteSpace(dto.GroupName))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Group name is required and cannot be empty.",
                        Title = "Invalid Group Name"
                    });
                }

                // 2. Check if Group exists in tGroups
                var getGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getGroup == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The group '{dto.GroupName}' could not be found. Please ensure the group exists.",
                        Title = "Group Not Found"
                    });
                }

                // 3. Check if GroupName is already taken by another group
                var groupNameExists = await _db.tGroups
                    .AnyAsync(x => x.GroupName.ToLower() == dto.GroupName.ToLower() && x.Id != dto.Id, cancellationToken);

                if (groupNameExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A group with the name '{dto.GroupName}' already exists. Please choose a different name.",
                        Title = "Group Name Already Exists"
                    });
                }

                // 4. Validate ActionIds exist in tApiActions
                if (dto.PermissionActionIds.Length > 0)
                {
                    var existingActionIds = await _db.tApiActions
                        .Where(x => dto.PermissionActionIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);
                    var invalidActionIds = dto.PermissionActionIds
                        .Except(existingActionIds)
                        .ToList();

                    if (invalidActionIds.Count > 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The following Action IDs do not exist: {string.Join(", ", invalidActionIds)}. Please sync permissions and try again.",
                            Title = "Invalid Action IDs"
                        });
                    }
                }

                // 5. Validate ViewIds exist in tPermissionViews
                if (dto.PermissionViewIds.Length > 0)
                {
                    var existingViewIds = await _db.tAppViews
                        .Where(x => dto.PermissionViewIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);

                    var invalidViewIds = dto.PermissionViewIds
                        .Except(existingViewIds)
                        .ToList();

                    if (invalidViewIds.Count > 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The following View IDs do not exist: {string.Join(", ", invalidViewIds)}. Please sync permissions and try again.",
                            Title = "Invalid View IDs"
                        });
                    }
                }

                // 6. Update Group details
                getGroup.GroupName = dto.GroupName.Trim();
                getGroup.Description = dto.Description?.Trim();
                getGroup.ApplyFilter = dto.ApplyFilter;
                _db.tGroups.Update(getGroup);

                // 7. Update GroupRoles — get existing GroupRoles for this Group
                var getGroupRoles = await _db.tGroupRoles.FirstOrDefaultAsync(x => x.GroupId == dto.Id, cancellationToken);
                if (getGroupRoles != null)
                {
                    // Update existing GroupRoles
                    getGroupRoles.ActionIds = dto.PermissionActionIds.Distinct().OrderBy(x => x).ToArray();
                    getGroupRoles.ViewIds = dto.PermissionViewIds.Distinct().OrderBy(x => x).ToArray();
                    _db.tGroupRoles.Update(getGroupRoles);
                }
                else
                {
                    // Create new GroupRoles if it doesn't exist
                    var newGroupRoles = new DBHelper.Models.Table.User.GroupRoles
                    {
                        GroupId = dto.Id,
                        ActionIds = dto.PermissionActionIds.Distinct().OrderBy(x => x).ToArray(),
                        ViewIds = dto.PermissionViewIds.Distinct().OrderBy(x => x).ToArray(),
                    };
                    await _db.tGroupRoles.AddAsync(newGroupRoles, cancellationToken);
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"User group '{getGroup.GroupName}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeleteUserGroup(int id, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // 1. Check if Group exists in tGroups
                var getGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
                if (getGroup == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The group could not be found. Please ensure the group exists.",
                        Title = "Group Not Found"
                    });
                }

                // 2. Check if Group is still assigned to any users in tUserGroups
                var isAssignedToUsers = await _db.tUserGroups
                    .AnyAsync(x => x.GroupIds.Contains(id), cancellationToken);

                if (isAssignedToUsers)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getGroup.GroupName}' cannot be deleted because it is currently assigned to one or more users. Please remove the user assignments first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                // 3. Remove associated GroupRoles first
                var getGroupRoles = await _db.tGroupRoles
                    .Where(x => x.GroupId == id)
                    .ToListAsync(cancellationToken);

                if (getGroupRoles.Count > 0)
                {
                    _db.tGroupRoles.RemoveRange(getGroupRoles);
                }

                // 4. Remove the Group
                _db.tGroups.Remove(getGroup);

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    Message = $"User group '{getGroup.GroupName}' has been deleted successfully.",
                    Title = "Delete Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        private async Task<IActionResult?> SyncViewPermissionsValidated(SyncViewPermissionsDTO dto, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, CancellationToken ct)
        {
            if (dto.RoutesAvailable.Any(x => string.IsNullOrWhiteSpace(x.RouteName) || string.IsNullOrWhiteSpace(x.path))) return BadRequest(new { Message = "RouteName and path are required.", Title = "Invalid Routes" });
            if (dto.RoutesAvailable.GroupBy(x => x.RouteName.Trim(), StringComparer.OrdinalIgnoreCase).Any(x => x.Count() > 1)) return BadRequest(new { Message = "Duplicate route names are not allowed.", Title = "Invalid Routes" });
            var existing = await _db.tAppViews.ToListAsync(ct);
            var incoming = dto.RoutesAvailable.ToDictionary(x => x.RouteName.Trim(), StringComparer.OrdinalIgnoreCase);
            var added = 0; var updated = 0; var unchanged = 0;
            foreach (var route in incoming.Values)
            {
                var current = existing.FirstOrDefault(x => string.Equals(x.RouteName, route.RouteName.Trim(), StringComparison.OrdinalIgnoreCase));
                if (current == null) { await _db.tAppViews.AddAsync(new AppViews { RouteName = route.RouteName.Trim(), RoutePath = route.path.Trim() }, ct); added++; }
                else if (current.RouteName != route.RouteName.Trim() || current.RoutePath != route.path.Trim()) { current.RouteName = route.RouteName.Trim(); current.RoutePath = route.path.Trim(); updated++; }
                else unchanged++;
            }
            var stale = existing.Where(x => !incoming.ContainsKey(x.RouteName)).ToList();
            if (stale.Count > 0)
            {
                var staleIds = stale.Select(x => x.Id).ToHashSet();
                foreach (var role in await _db.tGroupRoles.ToListAsync(ct)) role.ViewIds = role.ViewIds.Where(x => !staleIds.Contains(x)).Distinct().OrderBy(x => x).ToArray();
                _db.tAppViews.RemoveRange(stale);
            }
            await _db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return Ok(new { Message = "Route reconciliation complete.", Title = "Sync Complete", Added = added, Updated = updated, Removed = stale.Count, Unchanged = unchanged });
        }

        private async Task<IActionResult?> SyncApiPermissionsValidated(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, CancellationToken ct)
        {
            var controllerTypes = typeof(CoreController).Assembly.GetTypes().Where(t => t.IsClass && !t.IsAbstract && t.IsSubclassOf(typeof(CoreController))).OrderBy(x => x.Name).ToList();
            var discoveredControllers = controllerTypes.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var discoveredActions = controllerTypes.SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName && (m.ReturnType == typeof(IActionResult) || m.ReturnType == typeof(Task<IActionResult>)))
                .Select(m => (ControllerName: type.Name, ActionName: m.Name))).ToList();
            var actionKeys = discoveredActions.Select(x => $"{x.ControllerName}\0{x.ActionName}").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var controllers = await _db.tApiControllers.ToListAsync(ct); var actions = await _db.tApiActions.ToListAsync(ct);
            var addedControllers = controllerTypes.Where(x => !controllers.Any(c => string.Equals(c.ControllerName, x.Name, StringComparison.OrdinalIgnoreCase))).Select(x => new ApiControllers { ControllerName = x.Name }).ToList();
            var addedActions = discoveredActions.Where(x => !actions.Any(a => string.Equals(a.ControllerName, x.ControllerName, StringComparison.OrdinalIgnoreCase) && string.Equals(a.ActionName, x.ActionName, StringComparison.OrdinalIgnoreCase))).Select(x => new ApiActions { ControllerName = x.ControllerName, ActionName = x.ActionName }).ToList();
            var staleActions = actions.Where(x => !actionKeys.Contains($"{x.ControllerName}\0{x.ActionName}")).ToList();
            var staleControllers = controllers.Where(x => !discoveredControllers.Contains(x.ControllerName)).ToList();
            if (staleActions.Count > 0)
            {
                var staleIds = staleActions.Select(x => x.Id).ToHashSet();
                foreach (var role in await _db.tGroupRoles.ToListAsync(ct)) role.ActionIds = role.ActionIds.Where(x => !staleIds.Contains(x)).Distinct().OrderBy(x => x).ToArray();
                _db.tApiActions.RemoveRange(staleActions);
            }
            if (addedControllers.Count > 0) await _db.tApiControllers.AddRangeAsync(addedControllers, ct);
            if (addedActions.Count > 0) await _db.tApiActions.AddRangeAsync(addedActions, ct);
            if (staleControllers.Count > 0) _db.tApiControllers.RemoveRange(staleControllers);
            await _db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return Ok(new { Message = "API permission reconciliation complete.", Title = "Sync Complete", Controllers = new { Added = addedControllers.Count, Removed = staleControllers.Count, Unchanged = controllers.Count - staleControllers.Count }, Actions = new { Added = addedActions.Count, Removed = staleActions.Count, Unchanged = actions.Count - staleActions.Count } });
        }

        private async Task<IActionResult?> AddAppModuleValidated(DBHelper.Models.Views.AppModules dto, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(dto.ModuleName)) return BadRequest(new { Message = "Module name is required.", Title = "Invalid Module" });
            if (!TryParseModulePayload(dto.Controllers, dto.Views, out var requestedControllers, out var requestedViews, out var error)) return BadRequest(new { Message = error, Title = "Invalid Module Payload" });
            var moduleName = dto.ModuleName.Trim();
            if (await _db.tAppModules.AnyAsync(x => x.ModuleName.ToLower() == moduleName.ToLower(), ct)) return BadRequest(new { Message = $"Module '{moduleName}' already exists in the System.", Title = "Duplicate Module" });
            var controllerNames = requestedControllers.Select(x => x.ControllerName).ToArray();
            var controllers = await _db.tApiControllers.Where(x => controllerNames.Contains(x.ControllerName)).ToListAsync(ct);
            var unknownControllers = controllerNames.Except(controllers.Select(x => x.ControllerName), StringComparer.OrdinalIgnoreCase).ToArray();
            if (unknownControllers.Length > 0) return BadRequest(new { Message = $"Unknown controllers: {string.Join(", ", unknownControllers)}", Title = "Invalid Controllers" });
            var routeNames = requestedViews.Select(x => x.RouteName).ToArray();
            var views = await _db.tAppViews.Where(x => routeNames.Contains(x.RouteName)).ToListAsync(ct);
            var unknownRoutes = routeNames.Except(views.Select(x => x.RouteName), StringComparer.OrdinalIgnoreCase).ToArray();
            if (unknownRoutes.Length > 0) return BadRequest(new { Message = $"Unknown routes: {string.Join(", ", unknownRoutes)}", Title = "Invalid Routes" });
            await _db.tAppModules.AddAsync(new DBHelper.Models.Table.Permission.AppModules { ModuleName = moduleName, Description = dto.Description?.Trim() }, ct);
            foreach (var item in controllers.Where(x => requestedControllers.Single(r => string.Equals(r.ControllerName, x.ControllerName, StringComparison.OrdinalIgnoreCase)).Linked)) item.ModuleName = moduleName;
            foreach (var item in views.Where(x => requestedViews.Single(r => string.Equals(r.RouteName, x.RouteName, StringComparison.OrdinalIgnoreCase)).Linked)) item.ModuleName = moduleName;
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { Message = $"Module '{moduleName}' has been created successfully.", Title = "Module Created" });
        }

        private async Task<IActionResult?> UpdateAppModuleValidated(DBHelper.Models.Views.AppModules dto, DBHelper.Models.Table.Permission.AppModules module, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, CancellationToken ct)
        {
            if (!string.IsNullOrWhiteSpace(dto.ModuleName) && !string.Equals(dto.ModuleName.Trim(), module.ModuleName, StringComparison.OrdinalIgnoreCase)) return BadRequest(new { Message = "Module Id and ModuleName do not match.", Title = "Module Mismatch" });
            if (!TryParseModulePayload(dto.Controllers, dto.Views, out var requestedControllers, out var requestedViews, out var error)) return BadRequest(new { Message = error, Title = "Invalid Module Payload" });
            var controllerNames = requestedControllers.Select(x => x.ControllerName).ToArray();
            var controllers = await _db.tApiControllers.Where(x => controllerNames.Contains(x.ControllerName)).ToListAsync(ct);
            var unknownControllers = controllerNames.Except(controllers.Select(x => x.ControllerName), StringComparer.OrdinalIgnoreCase).ToArray();
            if (unknownControllers.Length > 0) return BadRequest(new { Message = $"Unknown controllers: {string.Join(", ", unknownControllers)}", Title = "Invalid Controllers" });
            var routeNames = requestedViews.Select(x => x.RouteName).ToArray();
            var views = await _db.tAppViews.Where(x => routeNames.Contains(x.RouteName)).ToListAsync(ct);
            var unknownRoutes = routeNames.Except(views.Select(x => x.RouteName), StringComparer.OrdinalIgnoreCase).ToArray();
            if (unknownRoutes.Length > 0) return BadRequest(new { Message = $"Unknown routes: {string.Join(", ", unknownRoutes)}", Title = "Invalid Routes" });
            module.Description = dto.Description?.Trim();
            foreach (var item in controllers) { var request = requestedControllers.Single(x => string.Equals(x.ControllerName, item.ControllerName, StringComparison.OrdinalIgnoreCase)); if (request.Linked) item.ModuleName = module.ModuleName; else if (string.Equals(item.ModuleName, module.ModuleName, StringComparison.OrdinalIgnoreCase)) item.ModuleName = null; }
            foreach (var item in views) { var request = requestedViews.Single(x => string.Equals(x.RouteName, item.RouteName, StringComparison.OrdinalIgnoreCase)); if (request.Linked) item.ModuleName = module.ModuleName; else if (string.Equals(item.ModuleName, module.ModuleName, StringComparison.OrdinalIgnoreCase)) item.ModuleName = null; }
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Ok(new { Message = $"Module '{module.ModuleName}' has been updated successfully.", Title = "Update Successful" });
        }

        private static bool TryParseModulePayload(string? controllersJson, string? viewsJson, out List<AppModuleControllerModel> controllers, out List<AppModuleViewModel> views, out string error)
        {
            controllers = []; views = []; error = string.Empty;
            if ((controllersJson?.Length ?? 0) > 100_000 || (viewsJson?.Length ?? 0) > 100_000) { error = "Module link payload exceeds the 100,000 character limit."; return false; }
            try { if (!string.IsNullOrWhiteSpace(controllersJson)) controllers = JsonConvert.DeserializeObject<List<AppModuleControllerModel>>(controllersJson) ?? []; if (!string.IsNullOrWhiteSpace(viewsJson)) views = JsonConvert.DeserializeObject<List<AppModuleViewModel>>(viewsJson) ?? []; }
            catch (JsonException ex) { error = $"Malformed module link JSON: {ex.Message}"; return false; }
            if (controllers.Any(x => string.IsNullOrWhiteSpace(x.ControllerName)) || views.Any(x => string.IsNullOrWhiteSpace(x.RouteName))) { error = "ControllerName and RouteName values cannot be blank."; return false; }
            if (controllers.GroupBy(x => x.ControllerName.Trim(), StringComparer.OrdinalIgnoreCase).Any(x => x.Count() > 1) || views.GroupBy(x => x.RouteName.Trim(), StringComparer.OrdinalIgnoreCase).Any(x => x.Count() > 1)) { error = "Duplicate controller or route names are not allowed."; return false; }
            foreach (var item in controllers) item.ControllerName = item.ControllerName.Trim();
            foreach (var item in views) item.RouteName = item.RouteName.Trim();
            return true;
        }
        #endregion
    }
}
