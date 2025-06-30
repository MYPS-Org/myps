using DBHelper.Data;
using DBHelper.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Eaf.Authorization.Roles;
using System.Security.Claims;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Dtos;

namespace WebAPI.Controllers.UserProfile
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UserProfileController : CoreController
    {
        public UserProfileController(AppDbContext db) : base(db) { }

        #region USERS TAB
        [HttpPost]
        //[Authorize(Policy = "View UserProfiles")]
        [AllowAnonymous]
        public async Task<IActionResult> ShowUsers([FromBody] UsersPaginationDto dto)
        {
            try
            {
                var query = _db.tUsers.AsNoTracking();

                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    query = query.Where(e => e.Name!.Contains(dto.Filters.Name));

                //if (dto.Filters?.UserGroup != null)
                //    query = query.Where(e => e.UserGroup == dto.Filters.UserGroup);

                //if (!string.IsNullOrEmpty(dto.Filters?.IsActive.ToString()))
                //    query = query.Where(e => e.IsActive == dto.Filters.IsActive);

                query = !string.IsNullOrEmpty(dto.SortField)
                    ? (dto.sortDirection == sortDirectionList.DESC
                        ? query.OrderByDescending(e => EF.Property<object>(e, dto.SortField))
                        : query.OrderBy(e => EF.Property<object>(e, dto.SortField)))
                    : query.OrderByDescending(e => e.Id);

                query = query.Skip((dto.page - 1) * dto.limit).Take(dto.limit);

                var lists = await query.ToListAsync();
                int totalRecords = lists.Count();
                if (totalRecords < 1)
                {
                    totalRecords = await _db.tUsers.AsNoTracking().CountAsync();
                }

                var response = new
                {
                    lists = lists,
                    page = dto.page,
                    limit = dto.limit,
                    total = totalRecords,
                    totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit)
                };

                return Ok(response);
            }
            catch (Exception ex) 
            {
                string ErrorId = ExceptionHandler(ex, "PermissionsController-ShowUsers");
                return Json(
                    new
                    {
                        StatusCode = 500,
                        Message = ex.Message,
                        ErrorId = ErrorId
                    }
                );
            }
        }
        #endregion
        [HttpPost]
        //[Authorize(Policy = "View UserProfiles")]
        [AllowAnonymous]
        public async Task<IActionResult> ShowPermissions([FromBody] ShowPermissionsDTO dto)
        {
            try
            {
                // Validate pagination parameters
                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;
                if (dto.limit > 10) dto.limit = 10; // Prevent excessive data requests

                var baseQuery = _db.tPermissions.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.ModuleFunction))
                    baseQuery = baseQuery.Where(e => e.ModuleFunction!.Contains(dto.Filters.ModuleFunction));

                if (!string.IsNullOrEmpty(dto.Filters?.Description))
                    baseQuery = baseQuery.Where(e => e.Description!.Contains(dto.Filters.Description));

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                var sortedQuery = !string.IsNullOrEmpty(dto.SortField)
                    ? (dto.sortDirection == sortDirectionList.DESC
                        ? baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField)))
                    : baseQuery.OrderByDescending(e => e.Id);

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
                string ErrorId = ExceptionHandler(ex, "PermissionsController-ShowPermissions");
                return Json(new
                {
                    StatusCode = 500,
                    Message = ex.Message,
                    ErrorId = ErrorId
                });
            }
        }
        [HttpPost]
        [Authorize(Policy = "View UserProfiles")]
        public async Task<IActionResult> ShowUserGroups()
        {
            try
            {
                var Permissions = await _db.vUserGroupPermissions.AsNoTracking().ToListAsync();
                var UserGroups = await _db.tUserGroups.AsNoTracking().ToListAsync();
                return Ok(new { Groups = UserGroups, GroupPermissions = Permissions});
            }
            catch (Exception ex)
            {
                string ErrorId = ExceptionHandler(ex, "PermissionsController-ShowUsers");
                return Json(
                    new
                    {
                        StatusCode = 500,
                        Message = ex.Message,
                        ErrorId = ErrorId
                    }
                );
            }
        }
    }
}