using DBHelper.Data;
using DBHelper.Models.Dtos;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace WebAPI.Controllers.UserProfile
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UserProfileController : CoreController
    {
        public UserProfileController(AppDbContext db) : base(db) { }

        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> InitUserManagement([FromBody] UsersPaginationDto dto)
        {
            try
            {
                var CountUsers = await _db.vUsers.CountAsync();
                var CountPermissions = await _db.tPermissions.CountAsync();
                var response = new
                {
                    NumberOfUsers = CountUsers,
                    NumberOfPermissions = CountPermissions
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
        //[Authorize(Policy = "User Management")]
        [AllowAnonymous]
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

                //if (!string.IsNullOrEmpty(dto.Filters?.UserGroup))
                //    baseQuery = baseQuery.Where(e => e.UserGroup!.Contains(dto.Filters.UserGroup));

                if (dto.Filters?.IsActive != null)
                    baseQuery = baseQuery.Where(e => e.IsActive == dto.Filters.IsActive);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = (dto.sortDirection == sortDirectionList.DESC
                        ? baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField)));

                // Apply pagination and execute query
                List<DBHelper.Models.Views.Users> permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists,
                    page = dto.page,
                    limit = dto.limit,
                    total = totalRecords,
                    totalPages = totalPages
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> DeleteUser([FromBody] DBHelper.Models.Views.Users dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserId);
                if (getUser == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exists in the System!", Title = "User not found" });
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
        [AllowAnonymous]
        public async Task<IActionResult> UpdateUser([FromBody] DBHelper.Models.Views.Users dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.UserId == dto.UserId);
                if (getUser == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exists in the System!", Title = "User not found" });
                }
                //_db.tUsers.Remove(getUser);
                //await _db.SaveChangesAsync();
                //await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "User Info updated successfully",
                    Title = "Under Maintenance"
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
        //[Authorize(Policy = "View UserProfiles")]
        [AllowAnonymous]
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

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.PermissionGroupName))
                    baseQuery = baseQuery.Where(e => e.PermissionGroupName!.Contains(dto.Filters.PermissionGroupName));

                if (!string.IsNullOrEmpty(dto.Filters?.ModuleFunction))
                    baseQuery = baseQuery.Where(e => e.ModuleFunction!.Contains(dto.Filters.ModuleFunction));

                if (!string.IsNullOrEmpty(dto.Filters?.Description))
                    baseQuery = baseQuery.Where(e => e.Description!.Contains(dto.Filters.Description));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();
                dto.sortDirection = string.IsNullOrEmpty(dto.SortField) ? sortDirectionList.DESC : dto.sortDirection;
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                // Apply sorting and pagination
                var sortedQuery = (dto.sortDirection == sortDirectionList.DESC
                        ? baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField)));

                // Apply pagination and execute query
                var permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists, // Match your frontend expectation
                    page = dto.page,
                    limit = dto.limit,
                    total = totalRecords,
                    totalPages = totalPages
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> UpdatePermission([FromBody] DBHelper.Models.Views.Permissions dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var getPermission = await _db.tPermissions.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (getPermission == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Permission '{dto.PermissionGroupName}' does not exists in the System!", Title = "Permission not found" });
                }
                getPermission.Description = dto.Description;
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = $"{dto.PermissionGroupName} updated successfully!", Title = "Update Complete" });
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
        //[Authorize(Policy = "View UserProfiles")]
        [AllowAnonymous]
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
                    baseQuery = baseQuery.Where(e => e.GroupName!.Contains(dto.Filters.GroupName));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();
                dto.sortDirection = string.IsNullOrEmpty(dto.SortField) ? sortDirectionList.DESC : dto.sortDirection;
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                // Apply sorting and pagination
                var sortedQuery = (dto.sortDirection == sortDirectionList.DESC
                        ? baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField)));

                // Apply pagination and execute query
                var permissionLists = await sortedQuery
                    .Skip((dto.page - 1) * dto.limit)
                    .Take(dto.limit)
                    .ToListAsync();

                var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

                var response = new
                {
                    lists = permissionLists, // Match your frontend expectation
                    page = dto.page,
                    limit = dto.limit,
                    total = totalRecords,
                    totalPages = totalPages
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [HttpPost]
        //[Authorize(Policy = "View UserProfiles")]
        [AllowAnonymous]
        public async Task<IActionResult> AddUserGroups([FromBody] DBHelper.Models.Views.UserGroups dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkSameName = await _db.tGroups.FirstOrDefaultAsync(x => x.GroupName == dto.GroupName);
                if (checkSameName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Group Name '{dto.GroupName}' already exists!", Title = "Group Name Exists" });
                }
                var addUserGroup = new Groups()
                {
                    GroupName = dto.GroupName,
                    Description = dto.Description,
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                };
                await _db.AddAsync(addUserGroup);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(
                    new
                    {
                        Message = "New Group added successfully!",
                        Title = "Add Complete"
                    }
                );
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