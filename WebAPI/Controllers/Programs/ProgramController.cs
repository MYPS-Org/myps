using DBHelper.Data;
using DBHelper.Models.Enums;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data.SqlClient;
using System.Reflection;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    [Authorize(Roles = "Admin")]
    public class ProgramController : CoreController
    {
        public ProgramController(AppDbContext db) : base(db) { }
        #region Program Lists
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

                if (dto.Filters?.UserGroup != null)
                    baseQuery = baseQuery.Where(e => e.UserGroup == dto.Filters.UserGroup);

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
        public async Task<IActionResult> InitAddProgram()
        {
            try
            {
                var Stage = await _db.tProgramStageEnum.ToListAsync();
                var Type = await _db.tProgramTypeEnum.ToListAsync();
                var Status = await _db.tProgramStatusEnum.ToListAsync();
                var Group = await _db.tGroups.ToListAsync();
                return Ok(new
                {
                    Stages = Stage,
                    Types = Type,
                    Statuses = Status,
                    Groups = Group
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
                var checkProgram = await _db.tPrograms.FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkProgram != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program '{dto.Name}' already exists in the System!", Title = "Program Already Exists" });
                }
                var checkStageType = await _db.tProgramStageEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Stage);
                if(checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid!", Title = "Invalid Stage" });
                }
                var checkStatusType = await _db.tProgramStatusEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Status);
                if(checkStatusType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Status '{dto.Status}' is not valid!", Title = "Invalid Status" });
                }
                var checkType = await _db.tProgramTypeEnum.FirstOrDefaultAsync(x => x.Enum == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid!", Title = "Invalid Type" });
                }
                var checkUserGroup = await _db.tGroups.FirstOrDefaultAsync(x => x.Id == dto.UserGroup);
                if (checkUserGroup == null)
                {
                    return new BadRequestObjectResult(new { Message = $"User Group '{dto.UserGroup}' is not valid!", Title = "Invalid User Group" });
                }
                string ReferenceId = "PR" + Sql.NormalQuery<string>(Appsetting.ConnectionString,
                        "EXEC pGenerateUID")
                    .FirstOrDefault() ?? string.Empty;
                var newProgram = new DBHelper.Models.Table.Programs()
                {
                    ReferenceId = ReferenceId,
                    Name = dto.Name,
                    Type = dto.Type,
                    UserGroup = dto.UserGroup,
                    RegionCode = dto.RegionCode,
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow,
                    IsPublished = false
                };
                await _db.tPrograms.AddAsync(newProgram);
                await _db.SaveChangesAsync();
                var newRevisions = new DBHelper.Models.Table.ProgramRevisions()
                {
	                ProgramId = ReferenceId,
	                RevisionNumber = 1,
	                Status = dto.Status,
	                YearStart = dto.YearStart,
	                YearEnd = dto.YearEnd,
	                CreatedBy = _Session.UserId,
	                CreatedDate = DateTime.UtcNow,
                };
                await _db.tProgramRevisions.AddAsync(newRevisions);
                await _db.SaveChangesAsync();
                var newStage = new DBHelper.Models.Table.ProgramStages()
                {
                    RevisionId = 1,
                    StageNumber = dto.Stage,
                    StageName = "",
                    StageStatus = 1,
                    CreatedBy = _Session.UserId,
                    CreatedDate = DateTime.UtcNow
                };
                await _db.tProgramStages.AddAsync(newStage);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
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
        //#region USERS TAB
        //[HttpPost]
        //public async Task<IActionResult> ShowUsers([FromBody] UsersPaginationDto dto)
        //{
        //    try
        //    {
        //        if (dto.Filters == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
        //        }
        //        if (!string.IsNullOrEmpty(dto.SortField))
        //        {
        //            bool isValid = typeof(DBHelper.Models.Views.Users)
        //                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
        //                .Any(p => string.Equals(p.Name, dto.SortField, StringComparison.OrdinalIgnoreCase));
        //            if (!isValid)
        //            {
        //                return new BadRequestObjectResult(new { Message = $"Invalid Column: {dto.SortField} to sort!", Title = "Parameter Error" });
        //            }
        //        }
        //        dto.sortDirection = string.IsNullOrEmpty(dto.sortDirection.ToString()) ? sortDirectionList.DESC : dto.sortDirection;

        //        bool isValidDirection = Enum.IsDefined(typeof(sortDirectionList), dto.sortDirection!);
        //        if (!isValidDirection)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"Sorting Direction: {dto.sortDirection} not allowed!", Title = "Invalid sort option" });
        //        }
        //        // Validate pagination parameters
        //        if (dto.page < 1) dto.page = 1;
        //        if (dto.limit < 1) dto.limit = 10;

        //        var baseQuery = _db.vUsers.AsNoTracking();

        //        // Apply filters to base query
        //        if (!string.IsNullOrEmpty(dto.Filters?.Name))
        //            baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

        //        if (!string.IsNullOrEmpty(dto.Filters?.UserGroup))
        //            baseQuery = baseQuery.Where(e => e.UserGroups!.Contains(dto.Filters.UserGroup));

        //        if (dto.Filters?.IsActive != null)
        //            baseQuery = baseQuery.Where(e => e.IsActive == dto.Filters.IsActive);

        //        // Get total count of filtered results (before pagination)
        //        var totalRecords = await baseQuery.CountAsync();

        //        // Apply sorting and pagination
        //        dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
        //        var sortedQuery = (dto.sortDirection == sortDirectionList.ASC
        //                ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
        //                : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField)));

        //        // Apply pagination and execute query
        //        List<DBHelper.Models.Views.Users> permissionLists = await sortedQuery
        //            .Skip((dto.page - 1) * dto.limit)
        //            .Take(dto.limit)
        //            .ToListAsync();

        //        var totalPages = (int)Math.Ceiling((double)totalRecords / dto.limit);

        //        var response = new
        //        {
        //            lists = permissionLists,
        //            page = dto.page,
        //            limit = dto.limit,
        //            total = totalRecords,
        //            totalPages = totalPages
        //        };

        //        return Ok(response); // Remove the extra wrapper
        //    }
        //    catch (Exception ex)
        //    {
        //        return ExceptionHandler(ex);
        //    }
        //}
        //[HttpPost]
        //public async Task<IActionResult> DeleteUser([FromBody] DBHelper.Models.Views.Users dto)
        //{
        //    using var transaction = await _db.Database.BeginTransactionAsync();
        //    try
        //    {
        //        var getUser = await _db.tUsers.FirstOrDefaultAsync(x => x.Id == dto.Id);
        //        if (getUser == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = $"User '{dto.UserId}' does not exists in the System!", Title = "User not found" });
        //        }
        //        var getUserGroups = await _db.tUserGroups.Where(x => x.UserId == getUser.UserId).ToListAsync();
        //        if(getUserGroups.Count > 0)
        //        {
        //            _db.tUserGroups.RemoveRange(getUserGroups);
        //        }
        //        _db.tUsers.Remove(getUser);
        //        await _db.SaveChangesAsync();
        //        await transaction.CommitAsync();
        //        return Ok(new
        //        {
        //            Message = "User deleted updated successfully",
        //            Title = "Delete Complete"
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        return ExceptionHandler(ex);
        //    }
        //}
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
        //        if (!string.IsNullOrEmpty(dto.UserGroups) && dto.UserGroups.Contains(","))
        //        {
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
        //                            CreatedDate = DateTime.UtcNow
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
        //                        CreatedDate = DateTime.UtcNow
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
        //            PlantillaOffice = (getPlantillaOffice != null) ? getPlantillaOffice.OrgName : dto.PlantillaOffice,
        //            EmployeeId = dto.EmployeeId,
        //            RegCode = (getRegCode != null) ? getRegCode.OrgName! : dto.RegCode,
        //        };
        //        if (!string.IsNullOrEmpty(dto.UserGroups) && dto.UserGroups.Contains(","))
        //        {
        //            string[] groups = dto.UserGroups.Split(',');
        //            var getGroups = await _db.tGroups.Where(x => groups.Contains(x.GroupName)).Select(x => x.Id).ToListAsync();
        //            if (getGroups.Count > 0)
        //            {
        //                _db.tUserGroups.AddRange(getGroups.Select(GrouId =>
        //                    new DBHelper.Models.Table.UserGroups()
        //                    {
        //                        UserId = dto.UserId,
        //                        GroupId = GrouId,
        //                        CreatedBy = _Session.UserId,
        //                        CreatedDate = DateTime.UtcNow
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
        //#endregion
    }
}