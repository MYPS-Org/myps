using Microsoft.AspNetCore.SignalR;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Infra;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebAPI.MicroService;
using Microsoft.AspNetCore.Authorization;

namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class FutureInfraController : CoreController
    {
        public FutureInfraController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        [HttpPost]
        public async Task<IActionResult> GetInfraInfo()
        {
            try
            {
                var FutureRoads = await _db.tFutureRoads.AsNoTracking().CountAsync();
                var FutureRoadSections = await _db.tFutureRoadSections.AsNoTracking().CountAsync();
                var FutureBridges = await _db.tFutureBridge.AsNoTracking().CountAsync();
                var response = new
                {
                    Roads = FutureRoads,
                    RoadSections = FutureRoadSections,
                    Bridge = FutureBridges
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        #region Future Roads

        [HttpPost]
        public async Task<IActionResult> InitFilterFutureRoads(CancellationToken cancellationToken)
        {
            try
            {
                var Classification = await _db.tFutureRoadsClassification.AsNoTracking().ToListAsync(cancellationToken);
                var response = new
                {
                    Classifications = Classification
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowFutureRoads([FromBody] ShowFutureRoadsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();


                if (!string.IsNullOrEmpty(dto.Filters.Name))
                    filters.Add(("v.Name LIKE @Name", "@Name", $"%{dto.Filters.Name.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.RoadId))
                    filters.Add(("v.RoadId LIKE @RoadId", "@RoadId", $"%{dto.Filters.RoadId.Trim()}%"));

                FilterDataResult<FutureRoads> result =
                    await _db.FilterDataCursor<
                        FutureRoads,
                        ShowFutureRoadsFilterDTO>(
                            tableName: "tFutureRoads",
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
        public async Task<IActionResult> EditFutureRoads([FromBody] EditFutureRoadsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FR".IsValidFutureInfraId(dto.RoadId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road ID '{dto.RoadId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FR12345LZ).",
                        Title = "Invalid Road ID Format"
                    });
                }

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
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road name {dto.Name} already exist in the system. Please use other name", Title = "Invalid Road Name" });
                }
                var CheckIfUsedInRoadSection = await _db.tFutureRoadSections.AsNoTracking().Where(x => x.RoadId == checkRoad.RoadId).ToListAsync(cancellationToken);
                if (CheckIfUsedInRoadSection.Any())
                {
                    HashSet<string> RoadSectionIds = CheckIfUsedInRoadSection.Select(x => x.RoadSectionId).ToHashSet<string>();
                    var CheckIfUsedInProject = await _db.tProjectMajorWorkLocations.AsNoTracking().FirstOrDefaultAsync(x => RoadSectionIds.Contains(x.InfraId));
                    if (CheckIfUsedInProject != null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = "The selected road is currently in use and cannot be edited.",
                            Title = "Road In Use"
                        });
                    }
                    var CheckIfUsedInBridge = await _db.tFutureBridge.AsNoTracking().Where(x => RoadSectionIds.Contains(x.RoadSectionId)).ToListAsync(cancellationToken);
                    if (CheckIfUsedInBridge.Any())
                    {
                        HashSet<string> BridgeIds = CheckIfUsedInBridge.Select(x => x.BridgeId).ToHashSet<string>();
                        var CheckIfUsedInProjectBridge = await _db.tProjectMajorWorkLocations.AsNoTracking().FirstOrDefaultAsync(x => BridgeIds.Contains(x.InfraId));
                        if (CheckIfUsedInProjectBridge != null)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Message = "The selected road is currently in use and cannot be edited.",
                                Title = "Road In Use"
                            });
                        }
                    }

                }
                var checkClassification = await _db.tFutureRoadsClassification.AsNoTracking().FirstOrDefaultAsync(x => x.ClassificationId == dto.Classification);
                if (checkClassification == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Classification '{dto.Classification}' is not valid.", Title = "Invalid Classification" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkRoad.RoadId != dto.RoadId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                    var NewClassification = await _db.tFutureRoadsClassification.FirstOrDefaultAsync(x => x.ClassificationId == dto.Classification);
                    var OldClassification = await _db.tFutureRoadsClassification.FirstOrDefaultAsync(x => x.ClassificationId == checkRoad.Classification);
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "Classification",
                        OldValue = OldClassification?.Classification,
                        NewValue = NewClassification?.Classification,
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
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddFutureRoads([FromBody] AddFutureRoadsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FR".IsValidFutureInfraId(dto.RoadId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road ID '{dto.RoadId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FR12345LZ).",
                        Title = "Invalid Road ID Format"
                    });
                }
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Future Road name '{dto.Name}' already exists in the System.", Title = "Road Already Exists" });
                }
                var checkRoadID = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoadID != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Future Road ID '{dto.Name}' already exists in the System.", Title = "Road ID Already Exists" });
                }
                var checkClassification = await _db.tFutureRoadsClassification.AsNoTracking().FirstOrDefaultAsync(x => x.ClassificationId == dto.Classification);
                if (checkClassification == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Classification '{dto.Classification}' is not valid.", Title = "Invalid Classification" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureRoad = new FutureRoads()
                {
                    RoadId = dto.RoadId,
                    Name = dto.Name,
                    Classification = dto.Classification,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureRoads.AddAsync(newFutureRoad);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteFutureRoad([FromBody] DeleteFutureRoadDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FR".IsValidFutureInfraId(dto.RoadId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road ID '{dto.RoadId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FR12345LZ).",
                        Title = "Invalid Road ID Format"
                    });
                }
                var checkRoad = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                if (checkRoad.NetworkStatusId != 2)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Only future roads that were not migrated from RBIA are eligible for deletion.",
                        Title = "Invalid Network Status"
                    });
                }
                var RoadSectionIds = await _db.tFutureRoadSections.AsNoTracking().Where(x => x.RoadId == dto.RoadId).ToListAsync(cancellationToken);
                HashSet<string> RoadIds = RoadSectionIds.Select(x => x.RoadSectionId).ToHashSet<string>();
                var ValidateRoadSections = await _db.tProjectMajorWorkLocations.Where(x => RoadIds.Contains(x.InfraId)).ToListAsync(cancellationToken);
                if (ValidateRoadSections.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road has road sections that are currently in use and cannot be deleted.",
                        Title = "Road In Use"
                    });
                }
                var FutureBridgeIds = await _db.tFutureBridge.AsNoTracking().Where(x => RoadIds.Contains(x.RoadSectionId)).ToListAsync(cancellationToken);
                HashSet<string> BridgeIds = FutureBridgeIds.Select(x => x.BridgeId).ToHashSet<string>();
                var ValidateBridgeIds = await _db.tProjectMajorWorkLocations.Where(x => BridgeIds.Contains(x.InfraId)).ToListAsync(cancellationToken);
                if (ValidateBridgeIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road has bridge that are currently in use and cannot be deleted.",
                        Title = "Bridge In Use"
                    });
                }
                _db.tFutureRoads.Remove(checkRoad);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road deleted successfully.",
                    Title = "Remove Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
        #region Future Road Section

        [HttpPost]
        public async Task<IActionResult> InitFilterFutureRoadSections(CancellationToken cancellationToken)
        {
            try
            {
                var DEO = await _db.vAdminDEO.AsNoTracking().ToListAsync(cancellationToken);
                var response = new
                {
                    DEOs = DEO
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ShowFutureRoadSections([FromBody] ShowFutureRoadSectionsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();



                if (!string.IsNullOrEmpty(dto.Filters.RoadId))
                    filters.Add(("v.RoadId LIKE @RoadId", "@RoadId", $"%{dto.Filters.RoadId.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.RoadSectionId))
                    filters.Add(("v.RoadSectionId LIKE @RoadSectionId", "@RoadSectionId", $"%{dto.Filters.RoadSectionId.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.DEO))
                {
                    filters.Add(("v.DEOParticipantId LIKE @DEOParticipantId", "@DEOParticipantId", $"%{dto.Filters.DEO.Trim()}%"));
                }

                FilterDataResult<FutureRoadSections> result =
                    await _db.FilterDataCursor<
                        FutureRoadSections,
                        ShowFutureRoadSectionsFilterDTO>(
                            tableName: "tFutureRoadSections",
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
        public async Task<IActionResult> AddFutureRoadSections([FromBody] AddFutureRoadSectionsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FS".IsValidFutureInfraId(dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road Section ID '{dto.RoadSectionId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FS12345LZ).",
                        Title = "Invalid Road Section ID Format"
                    });
                }
                var checkDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO '{dto.DEO}' is not valid.", Title = "Invalid DEO" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureRoadSection = new FutureRoadSections()
                {
                    RoadId = dto.RoadId,
                    RoadSectionId = dto.RoadSectionId,
                    LengthM = double.Parse(dto.RoadLength),
                    DEOParticipantId = dto.DEO,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureRoadSections.AddAsync(newFutureRoadSection);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road Section added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> EditFutureRoadSections([FromBody] EditFutureRoadSectionsDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FS".IsValidFutureInfraId(dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road Section ID '{dto.RoadSectionId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FS12345LZ).",
                        Title = "Invalid Road Section ID Format"
                    });
                }
                var checkRoad = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id);
                if (checkRoadSectionId != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} already exist in the system. Please use other Road ID.", Title = "Invalid Road Section ID" });
                }
                var CheckIfUsedinProject = await _db.tProjectMajorWorkLocations.AsNoTracking().FirstOrDefaultAsync(x => x.InfraId == checkRoad.RoadSectionId);
                if (CheckIfUsedinProject != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road section is currently in use and cannot be edited.",
                        Title = "Road Section In Use"
                    });
                }
                var checkRoadId = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoadId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} does exist in the system.", Title = "Invalid Road ID" });
                }
                var checkDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO {dto.RoadId} does exist in the system.", Title = "Invalid DEO" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkRoad.RoadId != dto.RoadId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "RoadSectionId",
                        OldValue = checkRoad.RoadSectionId,
                        NewValue = dto.RoadSectionId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.RoadSectionId = dto.RoadSectionId;
                }
                if (checkRoad.LengthM != double.Parse(dto.RoadLength))
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "LengthM",
                        OldValue = checkRoad.LengthM.ToString(),
                        NewValue = dto.RoadLength,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.LengthM = double.Parse(dto.RoadLength);
                }
                if (checkRoad.DEOParticipantId != dto.DEO)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoads",
                        AffectedColumn = "DEOParticipantId",
                        OldValue = checkRoad.DEOParticipantId,
                        NewValue = dto.DEO,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.DEOParticipantId = dto.DEO;
                }
                if (Transactions.Count > 0)
                {
                    await _db.tTransactionLog.AddRangeAsync(Transactions);
                    checkRoad.UpdatedBy = UserId;
                    checkRoad.UpdatedDate = currentDate;
                    _db.tFutureRoadSections.Update(checkRoad);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteFutureRoadSection([FromBody] DeleteFutureRoadSectionDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FS".IsValidFutureInfraId(dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road ID '{dto.RoadSectionId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FS12345LZ).",
                        Title = "Invalid Road ID Format"
                    });
                }
                var checkRoadSection = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSection == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road section does not exists in the System", Title = "Invalid Road Section" });
                }
                if (checkRoadSection.NetworkStatusId != 2)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Only future roads sections that were not migrated from RBIA are eligible for deletion.",
                        Title = "Invalid Network Status"
                    });
                }
                var ValidateRoadSections = await _db.tProjectMajorWorkLocations.Where(x => x.InfraId == dto.RoadSectionId).ToListAsync(cancellationToken);
                if (ValidateRoadSections.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road has road sections that are currently in use and cannot be deleted.",
                        Title = "Road In Use"
                    });
                }
                var FutureBridgeIds = await _db.tFutureBridge.AsNoTracking().Where(x => x.RoadSectionId == dto.RoadSectionId).ToListAsync(cancellationToken);
                HashSet<string> BridgeIds = FutureBridgeIds.Select(x => x.BridgeId).ToHashSet<string>();
                var ValidateBridgeIds = await _db.tProjectMajorWorkLocations.Where(x => BridgeIds.Contains(x.InfraId)).ToListAsync(cancellationToken);
                if (ValidateBridgeIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected bridge has locations that are currently in use and cannot be deleted.",
                        Title = "Bridge In Use"
                    });
                }
                _db.tFutureRoadSections.Remove(checkRoadSection);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Road section deleted successfully.",
                    Title = "Remove Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
        #region Future Bridge

        [HttpPost]
        public async Task<IActionResult> InitFilterFutureBridge(CancellationToken cancellationToken)
        {
            try
            {
                var DEO = await _db.vAdminDEO.AsNoTracking().ToListAsync(cancellationToken);
                var response = new
                {
                    DEOs = DEO
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> ShowFutureBridge([FromBody] ShowFutureBridgeDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>();



                if (!string.IsNullOrEmpty(dto.Filters.BridgeId))
                    filters.Add(("v.BridgeId LIKE @BridgeId", "@BridgeId", $"%{dto.Filters.BridgeId.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.RoadSectionId))
                    filters.Add(("v.RoadSectionId LIKE @RoadSectionId", "@RoadSectionId", $"%{dto.Filters.RoadSectionId.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.Name))
                {
                    filters.Add(("v.Name LIKE @Name", "@Name", $"%{dto.Filters.Name.Trim()}%"));
                }

                FilterDataResult<FutureBridge> result =
                    await _db.FilterDataCursor<
                        FutureBridge,
                        ShowFutureBridgeFilterDTO>(
                            tableName: "tFutureBridge",
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
        public async Task<IActionResult> AddFutureBridge([FromBody] AddFutureBridgeDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FB".IsValidFutureInfraId(dto.BridgeId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Bridge ID '{dto.BridgeId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FB12345LU).",
                        Title = "Invalid Bridge ID Format"
                    });
                }
                var checkBridgeName = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkBridgeName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge name '{dto.Name}' already exists in the System.", Title = "Bridge Already Exists" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section '{dto.RoadSectionId}' is not valid.", Title = "Invalid Road Section" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureBridge = new FutureBridge()
                {
                    RoadSectionId = dto.RoadSectionId,
                    BridgeId = dto.BridgeId,
                    Name = dto.Name,
                    From = dto.From,
                    Length = dto.Length,
                    CarriageWay = dto.CarriageWay,
                    OverallWidth = dto.OverallWidth,
                    CreatedBy = UserId,
                    CreatedDate = currentDate,
                };
                await _db.tFutureBridge.AddAsync(newFutureBridge);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Bridge added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> EditFutureBridge([FromBody] EditFutureBridgeDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FB".IsValidFutureInfraId(dto.BridgeId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Bridge ID '{dto.BridgeId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., AB12345LU).",
                        Title = "Invalid Bridge ID Format"
                    });
                }
                var checkBridge = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkBridge == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} does not exist in the system. Please use other Road ID.", Title = "Invalid Road Section ID" });
                }
                var checkBridgeId = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id);
                if (checkBridgeId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} does not exist in the system.", Title = "Invalid Bridge ID" });
                }
                var CheckIfUsedinProject = await _db.tProjectMajorWorkLocations.AsNoTracking().FirstOrDefaultAsync(x => x.InfraId == checkBridge.BridgeId);
                if (CheckIfUsedinProject != null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected bridge is currently in use and cannot be edited.",
                        Title = "Bridge In Use"
                    });
                }
                var checkName = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.Name == dto.Name);
                if (checkName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge Name {dto.Name} already exist in the system.", Title = "Invalid Bridge Name" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkBridge.RoadSectionId != dto.RoadSectionId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkBridge.RoadSectionId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                        ReferenceId = checkBridge.BridgeId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                        ReferenceId = checkBridge.BridgeId,
                        TransactionType = EnumTransactionType.Update.ToString(),
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
                        ReferenceId = checkBridge.BridgeId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "From",
                        OldValue = checkBridge.From.ToString(),
                        NewValue = dto.From.ToString(),
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.From = dto.From;
                }
                if (checkBridge.Length != dto.Length)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkBridge.BridgeId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "Length",
                        OldValue = checkBridge.Length.ToString(),
                        NewValue = dto.Length.ToString(),
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkBridge.Length = dto.Length;
                }
                if (checkBridge.CarriageWay != dto.CarriageWay)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkBridge.BridgeId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureBridge",
                        AffectedColumn = "CarriageWay",
                        OldValue = checkBridge.CarriageWay.ToString(),
                        NewValue = dto.CarriageWay.ToString(),
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
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = "Future Road added successfully.",
                    Title = "Add Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> DeleteFutureBridg([FromBody] DeleteFutureBridgeDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (!"FB".IsValidFutureInfraId(dto.BridgeId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Bridge ID '{dto.BridgeId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FB12345LZ).",
                        Title = "Invalid Bridge ID Format"
                    });
                }
                var checkBridge = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.BridgeId == dto.BridgeId);
                if (checkBridge == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge does not exists in the System", Title = "Invalid Bridge" });
                }
                if (checkBridge.NetworkStatusId != 2)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Only future bridges that were not migrated from RBIA are eligible for deletion.",
                        Title = "Invalid Network Status"
                    });
                }
                var ValidateRoadSections = await _db.tProjectMajorWorkLocations.Where(x => x.InfraId == dto.BridgeId).ToListAsync(cancellationToken);
                if (ValidateRoadSections.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road has road sections that are currently in use and cannot be deleted.",
                        Title = "Road In Use"
                    });
                }
                _db.tFutureBridge.Remove(checkBridge);
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Future Bridge deleted successfully.",
                    Title = "Remove Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
    }
}