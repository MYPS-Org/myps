using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Reflection;
using System.Threading.Tasks;
using WebAPI.Controllers.Revision.RegionalOffice;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Revision : CoreController
    {
        public Revision(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RevisionRequests([FromBody] ShowMyRevisionDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Views.Projects)
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

                var baseQuery = _db.tRevisionDetails.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.TransactionId))
                    baseQuery = baseQuery.Where(e => e.TransactionId!.Contains(dto.Filters.TransactionId));

                if (dto.Filters?.ModificationCategory != null)
                    baseQuery = baseQuery.Where(e => e.ModificationCategory == dto.Filters.ModificationCategory);

                if (dto.Filters?.ModificationReason != null)
                    baseQuery = baseQuery.Where(e => e.ModificationReason == dto.Filters.ModificationReason);

                if (dto.Filters?.RegionApproveStatus != null)
                    baseQuery = baseQuery.Where(e => e.RegionApproveStatus == dto.Filters.RegionApproveStatus);

                if (dto.Filters?.COApproveStatus != null)
                    baseQuery = baseQuery.Where(e => e.COApproveStatus == dto.Filters.COApproveStatus);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Table.RevisionDetails> permissionLists = await sortedQuery
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
        public async Task<IActionResult> RevisionHistory()
        {
            try
            {
                var RevisionTypes = await _db.tOptionRevisionHeader.ToListAsync();
                var Categories = await _db.tOptionRevisionCategory.ToListAsync();
                var Reasons = await _db.tOptionRevisionReasons.ToListAsync();
                return Ok(new { RevisionTypes, Categories, Reasons });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RevisionDetails()
        {
            try
            {
                var RevisionTypes = await _db.tOptionRevisionHeader.ToListAsync();
                var Categories = await _db.tOptionRevisionCategory.ToListAsync();
                var Reasons = await _db.tOptionRevisionReasons.ToListAsync();
                return Ok(new { RevisionTypes, Categories, Reasons });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RevisionCategories()
        {
            try
            {
                var RevisionTypes = await _db.tOptionRevisionHeader.ToListAsync();
                var Categories = await _db.tOptionRevisionCategory.ToListAsync();
                var Reasons = await _db.tOptionRevisionReasons.ToListAsync();
                return Ok(new { RevisionTypes, Categories, Reasons });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}