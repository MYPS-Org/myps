using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data.SqlClient;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml;
using static Eaf.Domain.Uow.EafDataFilters;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class FutureInfraController : CoreController
    {
        public FutureInfraController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region Future Roads
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterFutureRoads()
        {
            try
            {
                var Classification = await _db.tFutureRoadsClassification.AsNoTracking().ToListAsync();
                var response = new
                {
                    Classifications = Classification
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
        public async Task<IActionResult> ShowFutureRoads([FromBody] ShowFutureRoadsDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Table.FutureRoads)
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

                var baseQuery = _db.tFutureRoads.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                    baseQuery = baseQuery.Where(e => e.Name!.Contains(dto.Filters.Name));

                if (!string.IsNullOrEmpty(dto.Filters?.RoadId))
                    baseQuery = baseQuery.Where(e => e.RoadId.ToString() == dto.Filters.RoadId);

                if (!string.IsNullOrEmpty(dto.Filters?.Classification))
                    baseQuery = baseQuery.Where(e => e.Classification.ToString() == dto.Filters.Classification);

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                 List<DBHelper.Models.Table.FutureRoads> permissionLists = await sortedQuery
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
        public async Task<IActionResult> EditFutureRoads([FromBody] EditFutureRoadsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkRoad = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                var checkRoadId = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.RoadId == dto.RoadId);
                if (checkRoadId != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} already exist in the system. Please use other Road ID", Title = "Invalid Road ID" });
                }
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.Name == dto.Name);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road name {dto.Name} already exist in the system. Please use other name", Title = "Invalid Road Name" });
                }
                var checkClassification = await _db.tFutureRoadsClassification.AsNoTracking().FirstOrDefaultAsync(x => x.Classification == dto.Classification);
                if(checkClassification == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Classification '{dto.Classification}' is not valid!", Title = "Invalid Classification" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if(checkRoad.RoadId != dto.RoadId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadId",
                        OldValue = checkRoad.RoadId,
                        NewValue = dto.RoadId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadId = dto.RoadId;
                }
                if (checkRoad.Name != dto.Name)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "Name",
                        OldValue = checkRoad.Name,
                        NewValue = dto.Name,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.Name = dto.Name;
                }
                if (checkRoad.Classification != dto.Classification)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "Classification",
                        OldValue = checkRoad.Classification,
                        NewValue = dto.Classification,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.Classification = dto.Classification;
                }
                if (Transactions.Count > 0)
                {
                    await _db.tTransactionLog.AddRangeAsync(Transactions);
                    checkRoad.UpdatedBy = UserId;
                    checkRoad.UpdatedDate = currentDate;
                    _db.tFutureRoads.Update(checkRoad);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> AddFutureRoads([FromBody] AddFutureRoadsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Future Road name '{dto.Name}' already exists in the System!", Title = "Road Already Exists" });
                }
                var checkRoadID = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoadID != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Future Road ID '{dto.Name}' already exists in the System!", Title = "Road ID Already Exists" });
                }
                var checkClassification = await _db.tFutureRoadsClassification.AsNoTracking().FirstOrDefaultAsync(x => x.Classification == dto.Classification);
                if(checkClassification == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Classification '{dto.Classification}' is not valid!", Title = "Invalid Classification" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                var newFutureRoad = new DBHelper.Models.Table.FutureRoads()
                {
                    RoadId = dto.RoadId,
                    Name = dto.Name,
                    Classification = dto.Classification,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureRoads.AddAsync(newFutureRoad);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road added successfully",
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
        #region Future Road Section
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterFutureRoadSections()
        {
            try
            {
                var DEO = await _db.tAdminImplementingOffice.AsNoTracking().Where(x => x.InternalOrgUnitType == "DO").ToListAsync();
                var response = new
                {
                    DEOs = DEO
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
        public async Task<IActionResult> ShowFutureRoadSections([FromBody] ShowFutureRoadSectionsDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Table.FutureRoadSections)
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

                var baseQuery = _db.tFutureRoadSections.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.RoadId))
                    baseQuery = baseQuery.Where(e => e.RoadId!.Contains(dto.Filters.RoadId));

                if (!string.IsNullOrEmpty(dto.Filters?.RoadSectionId))
                    baseQuery = baseQuery.Where(e => e.RoadSectionId.ToString() == dto.Filters.RoadSectionId);

                if (!string.IsNullOrEmpty(dto.Filters?.DEO))
                {
                    baseQuery = baseQuery.Where(e => e.DEO.ToString() == dto.Filters.DEO);
                }

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Table.FutureRoadSections> permissionLists = await sortedQuery
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
        public async Task<IActionResult> AddFutureRoadSections([FromBody] AddFutureRoadSectionsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkDEO = await _db.tAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO '{dto.DEO}' is not valid!", Title = "Invalid DEO" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                var newFutureRoadSection = new DBHelper.Models.Table.FutureRoadSections()
                {
                    RoadId = dto.RoadId,
                    RoadSectionId = dto.RoadSectionId,
                    RoadLength = dto.RoadLength,
                    DEO = dto.DEO,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureRoadSections.AddAsync(newFutureRoadSection);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road Section added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> EditFutureRoadSections([FromBody] EditFutureRoadSectionsDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkRoad = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} already exist in the system. Please use other Road ID", Title = "Invalid Road Section ID" });
                }
                var checkRoadId = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoadId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} does exist in the system.", Title = "Invalid Road ID" });
                }
                var checkDEO = await _db.tAdminImplementingOffice.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO {dto.RoadId} does exist in the system.", Title = "Invalid DEO" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkRoad.RoadId != dto.RoadId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadId",
                        OldValue = checkRoad.RoadId,
                        NewValue = dto.RoadId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadId = dto.RoadId;
                }
                if (checkRoad.RoadSectionId != dto.RoadSectionId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadSectionId",
                        OldValue = checkRoad.RoadSectionId,
                        NewValue = dto.RoadSectionId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadSectionId = dto.RoadSectionId;
                }
                if (checkRoad.RoadLength != dto.RoadLength)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadLength",
                        OldValue = checkRoad.RoadLength,
                        NewValue = dto.RoadLength,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadLength = dto.RoadLength;
                }
                if (checkRoad.RoadLength != dto.RoadLength)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadLength",
                        OldValue = checkRoad.RoadLength,
                        NewValue = dto.RoadLength,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadLength = dto.RoadLength;
                }
                if (checkRoad.DEO != dto.DEO)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkRoad.RoadId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "DEO",
                        OldValue = checkRoad.DEO,
                        NewValue = dto.DEO,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.DEO = dto.DEO;
                }
                if (Transactions.Count > 0)
                {
                    await _db.tTransactionLog.AddRangeAsync(Transactions);
                    checkRoad.UpdatedBy = UserId;
                    checkRoad.UpdatedDate = currentDate;
                    _db.tFutureRoadSections.Update(checkRoad);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully",
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
        #region Future Bridge
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> InitFilterFutureBridge()
        {
            try
            {
                var DEO = await _db.tAdminImplementingOffice.AsNoTracking().ToListAsync();
                var response = new
                {
                    DEOs = DEO
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
        public async Task<IActionResult> ShowFutureBridge([FromBody] ShowFutureBridgeDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parametes missing!", Title = "Parameter Error" });
                }
                if (!string.IsNullOrEmpty(dto.SortField))
                {
                    bool isValid = typeof(DBHelper.Models.Table.FutureBridge)
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

                var baseQuery = _db.tFutureBridge.AsNoTracking();

                // Apply filters to base query
                if (!string.IsNullOrEmpty(dto.Filters?.RoadSectionId))
                    baseQuery = baseQuery.Where(e => e.RoadSectionId!.Contains(dto.Filters.RoadSectionId));

                if (!string.IsNullOrEmpty(dto.Filters?.BridgeId))
                    baseQuery = baseQuery.Where(e => e.BridgeId.ToString() == dto.Filters.BridgeId);

                if (!string.IsNullOrEmpty(dto.Filters?.Name))
                {
                    baseQuery = baseQuery.Where(e => e.Name.ToString() == dto.Filters.Name);
                }

                // Get total count of filtered results (before pagination)
                var totalRecords = await baseQuery.CountAsync();

                // Apply sorting and pagination
                dto.SortField = !string.IsNullOrEmpty(dto.SortField) ? dto.SortField : "Id";
                var sortedQuery = dto.sortDirection == sortDirectionList.ASC
                        ? baseQuery.OrderBy(e => EF.Property<object>(e, dto.SortField))
                        : baseQuery.OrderByDescending(e => EF.Property<object>(e, dto.SortField));

                // Apply pagination and execute query
                List<DBHelper.Models.Table.FutureBridge> permissionLists = await sortedQuery
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
        public async Task<IActionResult> AddFutureBridge([FromBody] AddFutureBridgeDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkBridgeName = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkBridgeName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge name '{dto.Name}' already exists in the System!", Title = "Bridge Already Exists" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section '{dto.RoadSectionId}' is not valid!", Title = "Invalid Road Section" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                var newFutureBridge = new DBHelper.Models.Table.FutureBridge()
                {
                    RoadSectionId = dto.RoadSectionId,
                    BridgeId = dto.BridgeId,
                    Name = dto.Name,
                    From = dto.From,
                    Length = dto.Length,
                    CarriageWay = dto.CarriageWay,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureBridge.AddAsync(newFutureBridge);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Bridge added successfully",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> EditFutureBridge([FromBody] EditFutureBridgeDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkBridge = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkBridge == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x =>x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} does not exist in the system. Please use other Road ID", Title = "Invalid Road Section ID" });
                }
                var checkBridgeId = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.BridgeId == dto.BridgeId);
                if (checkBridgeId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} does not exist in the system.", Title = "Invalid Bridge ID" });
                }
                var checkName = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.Name == dto.Name);
                if (checkName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge Name {dto.Name} already exist in the system.", Title = "Invalid Bridge Name" });
                }
                DateTime currentDate = DateTime.UtcNow;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkBridge.RoadSectionId != dto.RoadSectionId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.RoadSectionId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "RoadSectionId",
                        OldValue = checkBridge.RoadSectionId,
                        NewValue = dto.RoadSectionId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.RoadSectionId = dto.RoadSectionId;
                }
                if (checkBridge.BridgeId != dto.BridgeId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.BridgeId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "BridgeId",
                        OldValue = checkBridge.BridgeId,
                        NewValue = dto.BridgeId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.BridgeId = dto.BridgeId;
                }
                if (checkBridge.Name != dto.Name)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.Name,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "Name",
                        OldValue = checkBridge.Name,
                        NewValue = dto.Name,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.Name = dto.Name;
                }
                if (checkBridge.From != dto.From)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.From,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "From",
                        OldValue = checkBridge.From,
                        NewValue = dto.From,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.From = dto.From;
                }
                if (checkBridge.Length != dto.Length)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.Length,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "Length",
                        OldValue = checkBridge.Length,
                        NewValue = dto.Length,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.Length = dto.Length;
                }
                if (checkBridge.CarriageWay != dto.CarriageWay)
                {
                    Transactions.Add(new TransactionLog
                    {
                        TransactionId = checkBridge.CarriageWay,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "CarriageWay",
                        OldValue = checkBridge.CarriageWay,
                        NewValue = dto.CarriageWay,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.CarriageWay = dto.CarriageWay;
                }
                if (Transactions.Count > 0)
                {
                    await _db.tTransactionLog.AddRangeAsync(Transactions);
                    checkBridge.UpdatedBy = UserId;
                    checkBridge.UpdatedDate = currentDate;
                    _db.tFutureBridge.Update(checkBridge);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully",
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
    }
}