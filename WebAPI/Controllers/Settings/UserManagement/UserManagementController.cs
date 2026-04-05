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
using System.Text.Json;
using WebAPI.Controllers.Settings.Modules;

namespace WebAPI.Controllers.Settings.UserManagement
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UserManagementController : CoreController
    {
        public UserManagementController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region MODULE TAB
        // ── ShowAppModules ────────────────────────────────────────────────────────────
        // Fetches vAppModules (raw), deserializes the JSON Controllers/Views columns,
        // and projects to the AppModules response model with full Linked info.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> ShowAppModules([FromBody] ModulePaginationDto dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing!", Title = "Parameter Error" });
                }

                // Validate sort field against AppModules (scalar columns only)
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.AppModules)
                        .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                        .Any(p => string.Equals(p.Name, dto.SortField, StringComparison.OrdinalIgnoreCase));

                    if (!isValid)
                    {
                        return new BadRequestObjectResult(new { Message = $"Invalid Column: {dto.SortField} to sort!", Title = "Parameter Error" });
                    }
                }

                dto.sortDirection = string.IsNullOrEmpty(dto.sortDirection.ToString())
                    ? sortDirectionList.DESC
                    : dto.sortDirection;

                if (!Enum.IsDefined(typeof(sortDirectionList), dto.sortDirection!))
                {
                    return new BadRequestObjectResult(new { Message = $"Sorting Direction: {dto.sortDirection} not allowed!", Title = "Invalid sort option" });
                }

                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;

                var baseQuery = _db.vAppModules.AsNoTracking();

                var totalRecords = await baseQuery.CountAsync();

                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                    ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                    : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                var rawList = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();


                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                return Ok(new
                {
                    lists = rawList,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        // ── AddAppModule ──────────────────────────────────────────────────────────────
        // Creates the module, then links any controllers/views whose Linked = true.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> AddAppModule([FromBody] DBHelper.Models.Views.AppModules dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Guard: module name must be unique
                var existing = await _db.tAppModules
                    .FirstOrDefaultAsync(x => x.ModuleName == dto.ModuleName);
                if (existing != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{dto.ModuleName}' already exists in the System!",
                        Title = "Duplicate Module"
                    });
                }

                var newModule = new DBHelper.Models.Table.AppModules
                {
                    ModuleName = dto.ModuleName,
                    Description = dto.Description
                };

                await _db.tAppModules.AddAsync(newModule);
                await _db.SaveChangesAsync(); // Get the inserted row into the DB first

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
                            var controllers = await _db.tPermissionControllers
                                .Where(x => linkedControllerNames.Contains(x.ControllerName))
                                .ToListAsync();

                            foreach (var ctrl in controllers)
                                ctrl.ModuleName = newModule.ModuleName;

                            _db.tPermissionControllers.UpdateRange(controllers);
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
                            var views = await _db.tPermissionViews
                                .Where(x => linkedRouteNames.Contains(x.RouteName))
                                .ToListAsync();

                            foreach (var view in views)
                                view.ModuleName = newModule.ModuleName;

                            _db.tPermissionViews.UpdateRange(views);
                        }
                    }
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Module '{dto.ModuleName}' has been created successfully.",
                    Title = "Module Created"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }

        // ── UpdateAppModule ───────────────────────────────────────────────────────────
        // Updates the module description, then reconciles controller and view linkages:
        //   - Linked = true  → sets tPermissionControllers/tPermissionViews.ModuleName = this module
        //   - Linked = false → clears ModuleName to NULL (unlinks from this module)
        //
        // NOTE: Only controllers/views listed in the payload are touched.
        //       Unlisted ones are left as-is.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> UpdateAppModule([FromBody] DBHelper.Models.Views.AppModules dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getModule = await _db.tAppModules.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getModule == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module with Id '{dto.Id}' does not exist in the System!",
                        Title = "Module not found"
                    });
                }

                // Update description (ModuleName is immutable after creation)
                getModule.Description = dto.Description;
                _db.tAppModules.Update(getModule);

                // ── Reconcile Controller linkages ─────────────────────────────────────
                if (dto.Controllers != null && dto.Controllers.Any())
                {
                    var Controllers = JsonConvert.DeserializeObject<List<AppModuleControllerModel>>(dto.Controllers);
                    var controllerNames = Controllers.Where(x => x.Linked).Select(c => c.ControllerName).ToList();

                    var dbControllers = await _db.tPermissionControllers
                        .Where(x => controllerNames.Contains(x.ControllerName))
                        .ToListAsync();

                    foreach (var ctrl in dbControllers)
                    {
                        var payload = Controllers
                            .First(c => c.ControllerName == ctrl.ControllerName);

                        // Linked = true  → assign to this module
                        // Linked = false → remove from this module (set NULL)
                        ctrl.ModuleName = payload.Linked ? getModule.ModuleName : null;
                    }

                    _db.tPermissionControllers.UpdateRange(dbControllers);
                }

                // ── Reconcile View linkages ───────────────────────────────────────────
                if (dto.Views != null && dto.Views.Any())
                {
                    var Views = JsonConvert.DeserializeObject<List<AppModuleViewModel>>(dto.Views);
                    var routeNames = Views.Where(x => x.Linked).Select(v => v.RouteName).ToList();

                    var dbViews = await _db.tPermissionViews
                        .Where(x => routeNames.Contains(x.RouteName))
                        .ToListAsync();

                    foreach (var view in dbViews)
                    {
                        var payload = Views
                            .First(v => v.RouteName == view.RouteName);

                        // Linked = true  → assign to this module
                        // Linked = false → remove from this module (set NULL)
                        view.ModuleName = payload.Linked ? getModule.ModuleName : null;
                    }

                    _db.tPermissionViews.UpdateRange(dbViews);
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Module '{getModule.ModuleName}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }

        // ── DeleteAppModule ───────────────────────────────────────────────────────────
        // Blocks deletion if any controller or view is still linked to the module.
        // The frontend should unlink all first (set Linked = false via UpdateAppModule)
        // before calling delete.
        // ─────────────────────────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> DeleteAppModule([FromBody] DBHelper.Models.Views.AppModules dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getModule = await _db.tAppModules.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getModule == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Module '{dto.ModuleName}' does not exist in the System!",
                        Title = "Module not found"
                    });
                }

                // Block if any controller is still linked
                var linkedController = await _db.tPermissionControllers
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
                var linkedView = await _db.tPermissionViews
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
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Module '{getModule.ModuleName}' has been deleted successfully.",
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
        #region USERS TAB
        [HttpPost]
        public async Task<IActionResult> InitUserManagement()
        {
            try
            {
                var CountUsers = await _db.vUsers.CountAsync();
                var CountPermissions = await _db.tPermissionActions.CountAsync();
                var CountRoutePermissions = await _db.tPermissionViews.CountAsync();
                var CountGroups = await _db.tGroups.CountAsync();
                List<DBHelper.Models.Views.Users> UserLists = await _db.vUsers
                .AsNoTracking()
                .OrderByDescending(x => x.Id)
                .Take(10)
                .ToListAsync();
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
                return ExceptionHandler(ex);
            }
        }
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
                if (!string.IsNullOrEmpty(dto.Filters?.EmployeeId))
                    baseQuery = baseQuery.Where(e => e.EmployeeId!.Contains(dto.Filters.EmployeeId));

                if (!string.IsNullOrEmpty(dto.Filters?.UserId))
                    baseQuery = baseQuery.Where(e => e.UserId!.Contains(dto.Filters.UserId));

                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

                if (!string.IsNullOrEmpty(dto.Filters?.Email))
                    baseQuery = baseQuery.Where(e => e.Email!.Contains(dto.Filters.Email));

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
        [HttpPost]
        public async Task<IActionResult> UpdateUser([FromBody] DBHelper.Models.Views.Users dto)
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

                // 2. Check if User exists in tUsers
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id);
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
                        .ToListAsync();

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

                // 5. Update User details
                getUser.EmployeeId = dto.EmployeeId?.Trim();
                getUser.UserId = dto.UserId.Trim();
                getUser.Name = dto.Name.Trim();
                getUser.Email = dto.Email?.Trim();
                getUser.RegCode = dto.RegCode.Trim();
                getUser.PlantillaOffice = dto.PlantillaOffice?.Trim();
                getUser.IsActive = dto.IsActive;
                _db.tUsers.Update(getUser);

                // 6. Update UserGroups — get existing UserGroups record for this User
                var getUserGroup = await _db.tUserGroups
                    .FirstOrDefaultAsync(x => x.UserId == getUser.UserId);

                if (getUserGroup != null)
                {
                    // Update existing UserGroups record
                    getUserGroup.GroupIds = dto.UserGroupIds;
                    _db.tUserGroups.Update(getUserGroup);
                }
                else
                {
                    // Create new UserGroups record if it doesn't exist
                    if (dto.UserGroupIds.Length > 0)
                    {
                        var newUserGroup = new DBHelper.Models.Table.UserGroups
                        {
                            UserId = getUser.UserId,
                            GroupIds = dto.UserGroupIds,
                            CreatedBy = User.Identity?.Name ?? "System",
                            CreatedDate = DateTime.UtcNow
                        };
                        await _db.tUserGroups.AddAsync(newUserGroup);
                    }
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"User '{getUser.Name}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> AddUser([FromBody] DBHelper.Models.Views.Users dto)
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
                    .AnyAsync(x => x.UserId.ToLower() == dto.UserId.ToLower());

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
                        .ToListAsync();

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

                // 4. Create new User
                var newUser = new DBHelper.Models.Table.Users
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
                await _db.SaveChangesAsync(); // Save first to get generated Id

                // 5. Create UserGroups record linking User to GroupIds
                if (dto.UserGroupIds.Length > 0)
                {
                    var newUserGroup = new DBHelper.Models.Table.UserGroups
                    {
                        UserId = newUser.UserId,
                        GroupIds = dto.UserGroupIds,
                        CreatedBy = User.Identity?.Name ?? "System",
                        CreatedDate = DateTime.UtcNow
                    };

                    await _db.tUserGroups.AddAsync(newUserGroup);
                    await _db.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"User '{newUser.Name}' has been created successfully.",
                    Title = "User Created",
                    Data = newUser
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        #endregion
        #region VIEW PERMISSIONS TAB
        [HttpPost]
        public async Task<IActionResult> ShowViewPermissions([FromBody] ShowViewPermissionsDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.APIPermissions)
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

                var baseQuery = _db.tPermissionViews.AsNoTracking();

                if (!string.IsNullOrEmpty(dto.Filters?.RoutePath))
                    baseQuery = baseQuery.Where(e => e.RoutePath!.Contains(dto.Filters.RoutePath));

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
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> SyncViewPermissions([FromBody] SyncViewPermissionsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Get all existing PermissionViews from DB
                var existingViews = await _db.tPermissionViews.ToListAsync();

                var existingPathMap = existingViews
                    .ToDictionary(x => x.RoutePath, x => x, StringComparer.OrdinalIgnoreCase);

                // 2. Separate incoming routes into new and existing
                var newRoutes = new List<PermissionViews>();
                var updatedRoutes = new List<PermissionViews>();

                foreach (var route in dto.RoutesAvailable)
                {
                    if (existingPathMap.TryGetValue(route.path, out var existing))
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
                        newRoutes.Add(new PermissionViews
                        {
                            RouteName = route.RouteName,
                            RoutePath = route.path,
                        });
                    }
                }

                if (newRoutes.Count > 0)
                    await _db.tPermissionViews.AddRangeAsync(newRoutes);

                if (updatedRoutes.Count > 0)
                    _db.tPermissionViews.UpdateRange(updatedRoutes);

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Sync complete! Routes added: {newRoutes.Count}, updated: {updatedRoutes.Count}",
                    Title = "Sync Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateViewPermissionDetails([FromBody] UpdateViewPermissionDetailsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tPermissionViews.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{dto.RoutePath}' is not a recognized permission view. Try syncing permissions to update the list.",
                        Title = "Unrecognized View"
                    });
                }
                getPermission.Description = dto.Description;
                _db.tPermissionViews.Update(getPermission);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync(); return Ok(new
                {
                    Message = $"'{dto.RoutePath}' details have been saved successfully.",
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
        public async Task<IActionResult> DeleteViewPermission(int id)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getAction = await _db.tPermissionViews.FirstOrDefaultAsync(x => x.Id == id);
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
                    .AnyAsync(x => x.ViewIds.Contains(getAction.Id));

                if (isAssignedToRole)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"'{getAction.RoutePath}' cannot be deleted because it is currently assigned to one or more roles. Please remove the role assignments first.",
                        Title = "Deletion Not Allowed"
                    });
                }

                _db.tPermissionViews.Remove(getAction);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"Permission view '{getAction.RoutePath}' has been deleted successfully.",
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
                    bool isValid = typeof(DBHelper.Models.Views.APIPermissions)
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

                var baseQuery = _db.vAPIPermissions.AsNoTracking();

                if (!string.IsNullOrEmpty(dto.Filters?.ControllerName))
                    baseQuery = baseQuery.Where(e => e.ControllerName!.Contains(dto.Filters.ControllerName));

                if (!string.IsNullOrEmpty(dto.Filters?.ControllerDescription))
                    baseQuery = baseQuery.Where(e => e.ControllerDescription!.Contains(dto.Filters.ControllerDescription));

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
        public async Task<IActionResult> SyncAPIPermissions()
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Discover all controller Types via reflection
                var controllerTypes = typeof(CoreController).Assembly
                    .GetTypes()
                    .Where(t => t.IsClass && !t.IsAbstract && t.IsSubclassOf(typeof(CoreController)))
                    .ToList()
                    .OrderBy(x => x.Name);

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
                ).ToList()
                .OrderBy(x => x.ActionName);

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
                getPermission.ModuleName = dto.ModuleName;
                _db.tPermissionControllers.Update(getPermission);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
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
                await transaction.CommitAsync();
                return Ok(new
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
        [HttpPost]
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
        public async Task<IActionResult> ShowUserGroupDropdowns()
        {
            try
            {
                var AppModules = await _db.tAppModules
                    .AsNoTracking()
                    .OrderBy(x => x.ModuleName)
                    .ToListAsync();
                var PermissionControllers = await _db.tPermissionControllers
                    .AsNoTracking()
                    .OrderBy(x => x.ControllerName)
                    .ToListAsync();
                var PermissionActions = await _db.tPermissionActions
                    .AsNoTracking()
                    .OrderBy(x => x.ActionName)
                    .ToListAsync();
                var PermissionViews = await _db.tPermissionViews
                    .AsNoTracking()
                    .OrderBy(x => x.RoutePath)
                    .ToListAsync();

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
                return ExceptionHandler(ex);
            }
        }
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
        public async Task<IActionResult> AddUserGroup([FromBody] AddUserGroupDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
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

                // 2. Check if GroupName already exists in tGroups
                var groupExists = await _db.tGroups
                    .AnyAsync(x => x.GroupName.ToLower() == dto.GroupName.ToLower());

                if (groupExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A group with the name '{dto.GroupName}' already exists. Please choose a different name.",
                        Title = "Group Already Exists"
                    });
                }
                var NewGroup = new DBHelper.Models.Table.Groups
                {
                    GroupName = dto.GroupName.Trim(),
                    Description = dto.Description?.Trim()
                };

                await _db.tGroups.AddAsync(NewGroup);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"User group '{NewGroup.GroupName}' has been created successfully.",
                    Title = "Group Created"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> UpdateUserGroup([FromBody] UpdateUserGroupDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
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
                    .AnyAsync(x => x.GroupName.ToLower() == dto.GroupName.ToLower() && x.Id != dto.Id);

                if (groupNameExists)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A group with the name '{dto.GroupName}' already exists. Please choose a different name.",
                        Title = "Group Name Already Exists"
                    });
                }

                // 4. Validate ActionIds exist in tPermissionActions
                if (dto.PermissionActionIds.Length > 0)
                {
                    var existingActionIds = await _db.tPermissionActions
                        .Where(x => dto.PermissionActionIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync();

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
                    var existingViewIds = await _db.tPermissionViews
                        .Where(x => dto.PermissionViewIds.Contains(x.Id))
                        .Select(x => x.Id)
                        .ToListAsync();

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
                _db.tGroups.Update(getGroup);

                // 7. Update GroupRoles — get existing GroupRoles for this Group
                var getGroupRoles = await _db.tGroupRoles.FirstOrDefaultAsync(x => x.GroupId == dto.Id);
                if (getGroupRoles != null)
                {
                    // Update existing GroupRoles
                    getGroupRoles.ActionIds = dto.PermissionActionIds;
                    getGroupRoles.ViewIds = dto.PermissionViewIds;
                    _db.tGroupRoles.Update(getGroupRoles);
                }
                else
                {
                    // Create new GroupRoles if it doesn't exist
                    var newGroupRoles = new GroupRoles
                    {
                        GroupId = dto.Id,
                        ActionIds = dto.PermissionActionIds,
                        ViewIds = dto.PermissionViewIds,
                    };
                    await _db.tGroupRoles.AddAsync(newGroupRoles);
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"User group '{getGroup.GroupName}' has been updated successfully.",
                    Title = "Update Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        public async Task<IActionResult> DeleteUserGroup(int id)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1. Check if Group exists in tGroups
                var getGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == id);
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
                    .AnyAsync(x => x.GroupIds.Contains(id));

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
                    .ToListAsync();

                if (getGroupRoles.Count > 0)
                {
                    _db.tGroupRoles.RemoveRange(getGroupRoles);
                }

                // 4. Remove the Group
                _db.tGroups.Remove(getGroup);

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = $"User group '{getGroup.GroupName}' has been deleted successfully.",
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
    }
}