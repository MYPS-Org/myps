using Microsoft.AspNetCore.SignalR;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.Infra;
using DBHelper.Models.Views.Infra;
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

        /// <summary>tOptionInfraNetworkStatus: 1 = RBIA (migrated), 2 = MYPS (created here).</summary>
        private const int MypsNetworkStatusId = 2;

        /// <summary>
        /// Rows created in MYPS may be deleted; RBIA-migrated ones may not. Rows added before the Add
        /// endpoints set NetworkStatusId were saved with 0, and they were created here too.
        /// </summary>
        private static bool IsCreatedInMyps(int networkStatusId) => networkStatusId == MypsNetworkStatusId || networkStatusId == 0;

        private static string NormalizeInfraId(string id) => (id ?? string.Empty).Trim().ToUpperInvariant();

        /// <summary>FS00001LZ under FR00001LZ: the last two letters (island code) must match.</summary>
        private static bool SameIslandCode(string childId, string parentId) =>
            childId.Length >= 2 && parentId.Length >= 2 && childId[^2..] == parentId[^2..];

        private static bool TryParseLength(string? value, out double meters) =>
            double.TryParse(value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out meters) && meters > 0;

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

                // The filter dialog sends the ClassificationId ("1".."4"); it was accepted but never applied.
                if (int.TryParse(dto.Filters.Classification, out int classificationId))
                    filters.Add(("v.Classification = @Classification", "@Classification", classificationId));

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
                dto.RoadId = NormalizeInfraId(dto.RoadId);
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
                // Was missing the name comparison, so any edit failed as soon as a second road existed.
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.Name == dto.Name);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road name {dto.Name} already exist in the system. Please use other name", Title = "Invalid Road Name" });
                }
                var CheckIfUsedInRoadSection = await _db.tFutureRoadSections.AsNoTracking().Where(x => x.RoadId == checkRoad.RoadId).ToListAsync(cancellationToken);
                // Projects reference the section/bridge IDs, never the road itself, so only a Road ID
                // change (which re-parents the sections) needs the in-use check; a name or
                // classification fix is always safe.
                if (checkRoad.RoadId != dto.RoadId && CheckIfUsedInRoadSection.Any())
                {
                    HashSet<string> RoadSectionIds = CheckIfUsedInRoadSection.Select(x => x.RoadSectionId).ToHashSet<string>();
                    var CheckIfUsedInProject = await _db.tProjectMajorWorkLocations.AsNoTracking().FirstOrDefaultAsync(x => RoadSectionIds.Contains(x.InfraId));
                    if (CheckIfUsedInProject != null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = "The selected road is currently in use, so its Road ID cannot be changed.",
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
                                Message = "The selected road is currently in use, so its Road ID cannot be changed.",
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
                    // Sections point at the road by RoadId (no FK), so move them along or they are orphaned.
                    foreach (var section in CheckIfUsedInRoadSection)
                    {
                        section.RoadId = dto.RoadId;
                        section.UpdatedBy = UserId;
                        section.UpdatedDate = currentDate;
                    }
                    _db.tFutureRoadSections.UpdateRange(CheckIfUsedInRoadSection);
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
                    Message = "Future Road updated successfully.",
                    Title = "Update Complete"
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
                dto.RoadId = NormalizeInfraId(dto.RoadId);
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
                    return new BadRequestObjectResult(new { Message = $"Future Road ID '{dto.RoadId}' already exists in the System.", Title = "Road ID Already Exists" });
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
                    // Created in MYPS (tOptionInfraNetworkStatus 2). Left at 0, the row could never be
                    // deleted: DeleteFutureRoad only accepts MYPS-created roads.
                    NetworkStatusId = MypsNetworkStatusId,
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
                dto.RoadId = NormalizeInfraId(dto.RoadId);
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
                if (!IsCreatedInMyps(checkRoad.NetworkStatusId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Only future roads that were not migrated from RBIA are eligible for deletion.",
                        Title = "Invalid Network Status"
                    });
                }
                var RoadSectionIds = await _db.tFutureRoadSections.AsNoTracking().Where(x => x.RoadId == dto.RoadId).ToListAsync(cancellationToken);
                // No FK between the infra tables: deleting the road would orphan its sections.
                if (RoadSectionIds.Count > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The selected road still has {RoadSectionIds.Count} road section(s). Delete them in the Road Sections tab first.",
                        Title = "Road Has Sections"
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
                dto.RoadId = NormalizeInfraId(dto.RoadId);
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
                if (!"FS".IsValidFutureInfraId(dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road Section ID '{dto.RoadSectionId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FS12345LZ).",
                        Title = "Invalid Road Section ID Format"
                    });
                }
                var checkRoad = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId, cancellationToken);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} does not exist in the system.", Title = "Invalid Road ID" });
                }
                if (!SameIslandCode(dto.RoadSectionId, dto.RoadId))
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} must end with the island code of road {dto.RoadId}.", Title = "Invalid Island Code" });
                }
                if (await _db.tFutureRoadSections.AsNoTracking().AnyAsync(x => x.RoadSectionId == dto.RoadSectionId, cancellationToken))
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} already exists in the system. Please use another number.", Title = "Road Section ID Already Exists" });
                }
                if (!TryParseLength(dto.RoadLength, out double lengthM))
                {
                    return new BadRequestObjectResult(new { Message = $"Length '{dto.RoadLength}' is not a valid number of meters greater than 0.", Title = "Invalid Length" });
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
                    NetworkStatusId = MypsNetworkStatusId,
                    RoadId = dto.RoadId,
                    RoadSectionId = dto.RoadSectionId,
                    LengthM = lengthM,
                    DEOParticipantId = dto.DEO,
                    RegionParticipantId = checkDEO.RegionParticipantId,
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
                dto.RoadId = NormalizeInfraId(dto.RoadId);
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
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
                    return new BadRequestObjectResult(new { Message = $"Road section does not exists in the System", Title = "Invalid Road Section" });
                }
                // Was missing the ID comparison, so any edit failed as soon as a second section existed.
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id != dto.Id && x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} already exist in the system. Please use other Road ID.", Title = "Invalid Road Section ID" });
                }
                // Projects reference the section by RoadSectionId, so only an ID or parent-road change
                // needs the in-use check; length and DEO corrections are always allowed.
                bool keyChange = checkRoad.RoadSectionId != dto.RoadSectionId || checkRoad.RoadId != dto.RoadId;
                if (keyChange && await _db.tProjectMajorWorkLocations.AsNoTracking().AnyAsync(x => x.InfraId == checkRoad.RoadSectionId, cancellationToken))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected road section is currently in use, so its ID and parent road cannot be changed.",
                        Title = "Road Section In Use"
                    });
                }
                var checkRoadId = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId);
                if (checkRoadId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} does not exist in the system.", Title = "Invalid Road ID" });
                }
                if (keyChange && !SameIslandCode(dto.RoadSectionId, dto.RoadId))
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} must end with the island code of road {dto.RoadId}.", Title = "Invalid Island Code" });
                }
                if (!TryParseLength(dto.RoadLength, out double lengthM))
                {
                    return new BadRequestObjectResult(new { Message = $"Length '{dto.RoadLength}' is not a valid number of meters greater than 0.", Title = "Invalid Length" });
                }
                var checkDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO '{dto.DEO}' is not valid.", Title = "Invalid DEO" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                List<TransactionLog> Transactions = new List<TransactionLog>();
                if (checkRoad.RoadId != dto.RoadId)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadSectionId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoadSections",
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
                        ReferenceId = checkRoad.RoadSectionId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoadSections",
                        AffectedColumn = "RoadSectionId",
                        OldValue = checkRoad.RoadSectionId,
                        NewValue = dto.RoadSectionId,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    // Bridges point at the section by RoadSectionId (no FK): move them along.
                    var bridges = await _db.tFutureBridge.Where(x => x.RoadSectionId == checkRoad.RoadSectionId).ToListAsync(cancellationToken);
                    foreach (var bridge in bridges)
                    {
                        bridge.RoadSectionId = dto.RoadSectionId;
                        bridge.UpdatedBy = UserId;
                        bridge.UpdatedDate = currentDate;
                    }
                    checkRoad.RoadSectionId = dto.RoadSectionId;
                }
                if (checkRoad.LengthM != lengthM)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadSectionId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoadSections",
                        AffectedColumn = "LengthM",
                        OldValue = checkRoad.LengthM.ToString(),
                        NewValue = lengthM.ToString(),
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.LengthM = lengthM;
                }
                if (checkRoad.DEOParticipantId != dto.DEO)
                {
                    Transactions.Add(new TransactionLog
                    {
                        ReferenceId = checkRoad.RoadSectionId,
                        TransactionType = EnumTransactionType.Update.ToString(),
                        AffectedTable = "tFutureRoadSections",
                        AffectedColumn = "DEOParticipantId",
                        OldValue = checkRoad.DEOParticipantId,
                        NewValue = dto.DEO,
                        CreatedBy = UserId,
                        CreatedDate = currentDate
                    });
                    checkRoad.DEOParticipantId = dto.DEO;
                    checkRoad.RegionParticipantId = checkDEO.RegionParticipantId;
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
                    Message = "Future Road Section updated successfully.",
                    Title = "Update Complete"
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
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
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
                if (!IsCreatedInMyps(checkRoadSection.NetworkStatusId))
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
                        Message = "The selected road section is currently in use by a project and cannot be deleted.",
                        Title = "Road Section In Use"
                    });
                }
                // No FK between the infra tables: deleting the section would orphan its bridges.
                var BridgeCount = await _db.tFutureBridge.AsNoTracking().CountAsync(x => x.RoadSectionId == dto.RoadSectionId, cancellationToken);
                if (BridgeCount > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The selected road section still has {BridgeCount} bridge(s). Delete them in the Bridges tab first.",
                        Title = "Road Section Has Bridges"
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
                dto.BridgeId = NormalizeInfraId(dto.BridgeId);
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
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
                if (await _db.tFutureBridge.AsNoTracking().AnyAsync(x => x.BridgeId == dto.BridgeId, cancellationToken))
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} already exists in the system. Please use another number.", Title = "Bridge ID Already Exists" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section '{dto.RoadSectionId}' is not valid.", Title = "Invalid Road Section" });
                }
                if (!SameIslandCode(dto.BridgeId, dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} must end with the island code of road section {dto.RoadSectionId}.", Title = "Invalid Island Code" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureBridge = new FutureBridge()
                {
                    NetworkStatusId = MypsNetworkStatusId,
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
                dto.BridgeId = NormalizeInfraId(dto.BridgeId);
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
                if (!"FB".IsValidFutureInfraId(dto.BridgeId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Bridge ID '{dto.BridgeId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FB12345LU).",
                        Title = "Invalid Bridge ID Format"
                    });
                }
                var checkBridge = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkBridge == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge does not exists in the System", Title = "Invalid Bridge" });
                }
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} does not exist in the system. Please use other Road ID.", Title = "Invalid Road Section ID" });
                }
                // Was "any other bridge exists" with the result inverted; it is a duplicate-ID check.
                if (await _db.tFutureBridge.AsNoTracking().AnyAsync(x => x.Id != dto.Id && x.BridgeId == dto.BridgeId, cancellationToken))
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} already exists in the system.", Title = "Bridge ID Already Exists" });
                }
                // Projects reference the bridge by BridgeId, so only an ID change needs the in-use check.
                if (checkBridge.BridgeId != dto.BridgeId
                    && await _db.tProjectMajorWorkLocations.AsNoTracking().AnyAsync(x => x.InfraId == checkBridge.BridgeId, cancellationToken))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The selected bridge is currently in use, so its Bridge ID cannot be changed.",
                        Title = "Bridge In Use"
                    });
                }
                if ((checkBridge.BridgeId != dto.BridgeId || checkBridge.RoadSectionId != dto.RoadSectionId) && !SameIslandCode(dto.BridgeId, dto.RoadSectionId))
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge ID {dto.BridgeId} must end with the island code of road section {dto.RoadSectionId}.", Title = "Invalid Island Code" });
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
                    Message = "Future Bridge updated successfully.",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        // The name is misspelled, but it is what tApiActions registers and groups are granted
        // (permissions are keyed by action name). Renaming it needs SyncAPIPermissions plus a
        // re-grant in every environment, so the UI calls this name instead.
        [HttpPost]
        public async Task<IActionResult> DeleteFutureBridg([FromBody] DeleteFutureBridgeDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                dto.BridgeId = NormalizeInfraId(dto.BridgeId);
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
                if (!IsCreatedInMyps(checkBridge.NetworkStatusId))
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
                        Message = "The selected bridge is currently in use by a project and cannot be deleted.",
                        Title = "Bridge In Use"
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
        #region Infra Selection (Project/Revision work-location picker)

        // Distinct from ShowFutureRoadSections/ShowFutureBridge above (which serve the
        // Rbia-admin CRUD screen and treat DEO as optional) - these two require DEO,
        // and resolve RoadName/CreatedByName/UpdatedByName via vInfraRoadSectionOptions/
        // vInfraBridgeOptions (both LEFT JOIN tFutureRoadSections/tFutureBridge against
        // tFutureRoads and tUsers), so ProjectController/RevisionController's work-location
        // forms can present a scoped, human-readable picker for what becomes InfraId.

        [HttpPost]
        public async Task<IActionResult> ShowInfraRoadSections([FromBody] ShowInfraRoadSectionsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Filters.DEO))
                {
                    return new BadRequestObjectResult(new { Message = "DEO is required.", Title = "Missing Filter" });
                }

                var checkDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.Filters.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO '{dto.Filters.DEO}' is not valid.", Title = "Invalid DEO" });
                }

                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>
                {
                    ("v.DEOParticipantId = @DEOParticipantId", "@DEOParticipantId", dto.Filters.DEO.Trim())
                };

                if (!string.IsNullOrEmpty(dto.Filters.RoadName))
                    filters.Add(("v.RoadName LIKE @RoadName", "@RoadName", $"%{dto.Filters.RoadName.Trim()}%"));

                FilterDataResult<InfraRoadSectionOption> result =
                    await _db.FilterDataCursor<
                        InfraRoadSectionOption,
                        ShowInfraRoadSectionsFilterDTO>(
                            tableName: "vInfraRoadSectionOptions",
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
        public async Task<IActionResult> ShowInfraBridges([FromBody] ShowInfraBridgesDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Filters.DEO))
                {
                    return new BadRequestObjectResult(new { Message = "DEO is required.", Title = "Missing Filter" });
                }

                var checkDEO = await _db.vAdminDEO.AsNoTracking().FirstOrDefaultAsync(x => x.ParticipantId == dto.Filters.DEO);
                if (checkDEO == null)
                {
                    return new BadRequestObjectResult(new { Message = $"DEO '{dto.Filters.DEO}' is not valid.", Title = "Invalid DEO" });
                }

                var filters = new List<(
                    string Clause,
                    string ParamName,
                    object? Value)>
                {
                    ("v.DEOParticipantId = @DEOParticipantId", "@DEOParticipantId", dto.Filters.DEO.Trim())
                };

                if (!string.IsNullOrEmpty(dto.Filters.BridgeName))
                    filters.Add(("v.BridgeName LIKE @BridgeName", "@BridgeName", $"%{dto.Filters.BridgeName.Trim()}%"));

                if (!string.IsNullOrEmpty(dto.Filters.RoadSectionId))
                    filters.Add(("v.RoadSectionId LIKE @RoadSectionId", "@RoadSectionId", $"%{dto.Filters.RoadSectionId.Trim()}%"));

                FilterDataResult<InfraBridgeOption> result =
                    await _db.FilterDataCursor<
                        InfraBridgeOption,
                        ShowInfraBridgesFilterDTO>(
                            tableName: "vInfraBridgeOptions",
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
        #endregion
    }
}