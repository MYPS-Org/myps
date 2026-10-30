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
        /// Rows created in MYPS may be edited and deleted; RBIA-migrated ones may not. Rows added before the Add
        /// endpoints set NetworkStatusId were saved with 0, and they were created here too.
        /// </summary>
        private static bool IsCreatedInMyps(int networkStatusId) => networkStatusId == MypsNetworkStatusId || networkStatusId == 0;

        private static string NormalizeInfraId(string id) => (id ?? string.Empty).Trim().ToUpperInvariant();

        private static bool TryParseLength(string? value, out double meters) =>
            double.TryParse(value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out meters) && meters > 0;

        private static BadRequestObjectResult RbiaReadOnly(string what) => new BadRequestObjectResult(new
        {
            Message = $"This {what} comes from RBIA and cannot be edited in MYPS. Only future infra created in MYPS can be edited.",
            Title = "Maintained in RBIA"
        });

        /// <summary>
        /// Next free future infra ID: prefix (FR / FS / FB) + the lowest free 5-digit number + island code.
        /// IDs are generated, never typed (S06-TC003-P001, TC005, TC010). The number runs across all
        /// islands (FR00001LZ, FR00002VS, ...), as in the Add dialog's example, and a number freed by a
        /// delete is handed out again (see <see cref="FutureInfraIds.LowestFreeNumber"/>). Null when all
        /// 99999 are used. Call inside the Add transaction after <see cref="LockInfraIdAsync"/>.
        /// </summary>
        private static async Task<string?> NextInfraIdAsync(IQueryable<string> ids, string prefix, string islandCode, CancellationToken ct)
        {
            var existing = await ids.Where(id => id.StartsWith(prefix)).ToListAsync(ct);
            // One shared regex inside FutureInfraIds: IsValidFutureInfraId builds a compiled Regex per call, and
            // this runs over ~17k project references (93 s per Add, which also timed out the other Adds' lock waits).
            int? number = FutureInfraIds.LowestFreeNumber(existing, prefix);
            return number == null ? null : FutureInfraIds.Format(prefix, number.Value, islandCode);
        }

        /// <summary>
        /// Section / bridge IDs that projects and their revisions point at (InfraId, no FK). Many are not
        /// in the infra tables (on myps_db_dev: 16,716 FS and 4,951 FB references in
        /// tProjectMajorWorkLocations, up to FS97844 / FB97614), so a generated number must clear these
        /// too: reusing one would hand that project's work location to the new section or bridge.
        /// </summary>
        private IQueryable<string> ProjectInfraIds() =>
            _db.tProjectMajorWorkLocations.AsNoTracking().Select(x => x.InfraId)
                .Concat(_db.tRevisionProjectMajorWorkLocations.AsNoTracking().Select(x => x.InfraId));

        /// <summary>
        /// The ID columns have no unique index: serialize Adds per prefix so two at once cannot take the
        /// same number. Transaction-owned, so it is released at commit or rollback.
        /// </summary>
        private Task LockInfraIdAsync(string prefix, CancellationToken ct) =>
            _db.Database.ExecuteSqlRawAsync(
                "DECLARE @r INT; EXEC @r = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000; IF @r < 0 THROW 50000, 'Another item is being added. Try again in a moment.', 1;",
                new object[] { $"MYPS_FutureInfraId_{prefix}" }, ct);

        /// <summary>
        /// The ID a section / bridge keeps on edit: its own number, with the island code of its (possibly
        /// new) parent. IDs are not typed on edit either, so moving a row to a parent on another island
        /// re-suffixes it (FS00012LZ -> FS00012VS) instead of failing the island check. Null when the
        /// stored ID is not in the FS/FB format.
        /// </summary>
        private static string? IdUnderParent(string prefix, string storedId, string parentId) =>
            prefix.IsValidFutureInfraId(storedId) && parentId.Length >= 2
                ? $"{prefix}{storedId.Substring(2, 5)}{parentId[^2..]}"
                : null;

        private Task<List<string>> IslandCodesAsync(CancellationToken ct) =>
            _db.tOptionAdminAreaRegion.AsNoTracking()
                .Where(x => x.IslandCode != "")
                .Select(x => x.IslandCode)
                .Distinct()
                .OrderBy(x => x)
                .ToListAsync(ct);

        // Sortable list columns (S06-TC001-P001): the list's field name -> a fixed SQL expression.
        // Only these strings ever reach the ORDER BY; an unknown SortField falls back to the Id order.
        private static readonly IReadOnlyDictionary<string, string> RoadSortColumns = new Dictionary<string, string>
        {
            ["RoadId"] = "v.[RoadId]",
            ["Name"] = "v.[Name]",
            ["Classification"] = "v.[Classification]",
        };
        private static readonly IReadOnlyDictionary<string, string> RoadSectionSortColumns = new Dictionary<string, string>
        {
            ["RoadSectionId"] = "v.[RoadSectionId]",
            ["RoadId"] = "v.[RoadId]",
            ["RoadLength"] = "v.[LengthM]",
            // The column shows the DEO name, so sort by the name rather than the OI code.
            ["DEO"] = "(SELECT TOP 1 d.[Name] FROM [dbo].[vAdminDEO] d WHERE d.[ParticipantId] = v.[DEOParticipantId])",
        };
        private static readonly IReadOnlyDictionary<string, string> BridgeSortColumns = new Dictionary<string, string>
        {
            ["RoadSectionId"] = "v.[RoadSectionId]",
            ["Name"] = "v.[Name]",
            ["BridgeId"] = "v.[BridgeId]",
            ["From"] = "v.[From]",
            ["Length"] = "v.[Length]",
            ["CarriageWay"] = "v.[CarriageWay]",
        };

        /// <summary>
        /// One page of an Infra Management list. With a known SortField it is ordered by that column
        /// (FilterDataSorted); otherwise newest first by Id, keyset-paged as before (FilterDataCursor).
        /// </summary>
        private async Task<IActionResult> ShowPageAsync<T, TFilter>(
            string tableName,
            SortableFutureInfraPagination<TFilter> dto,
            List<(string Clause, string ParamName, object? Value)> filters,
            IReadOnlyDictionary<string, string> sortColumns,
            CancellationToken ct) where T : class
        {
            FilterDataResult<T> result =
                !string.IsNullOrEmpty(dto.SortField) && sortColumns.TryGetValue(dto.SortField, out string? orderBy)
                    ? await _db.FilterDataSorted<T, TFilter>(tableName, dto, filters, orderBy, descending: dto.sortDirection != 0, ct: ct)
                    : await _db.FilterDataCursor<T, TFilter>(
                        tableName: tableName,
                        dto: dto,
                        filter: filters,
                        keyColumn: "Id",
                        descending: true,
                        includeTotal: true,
                        ct: ct);
            if (result.HasError)
            {
                return new BadRequestObjectResult(new ErrorResult
                {
                    Title = "Pagination error",
                    Message = result.ErrorMessage ?? "Unable to retrieve the records."
                });
            }
            return Ok(result.Data);
        }

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
                    Classifications = Classification,
                    // The Add Future Road dialog picks one of these; the Road ID is generated from it.
                    IslandCodes = await IslandCodesAsync(cancellationToken)
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

                return await ShowPageAsync<FutureRoads, ShowFutureRoadsFilterDTO>("tFutureRoads", dto, filters, RoadSortColumns, cancellationToken);
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
                var checkRoad = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road does not exists in the System", Title = "Invalid Road" });
                }
                // RBIA owns the roads it migrated (S06-TC003 / TC008 / TC013): MYPS only edits its own.
                if (!IsCreatedInMyps(checkRoad.NetworkStatusId))
                {
                    return RbiaReadOnly("road");
                }
                dto.RoadId = NormalizeInfraId(dto.RoadId);
                if (!"FR".IsValidFutureInfraId(dto.RoadId))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road ID '{dto.RoadId}' is invalid. Expected format: 2 letters, 5 digits, 2-letter island code (e.g., FR12345LZ).",
                        Title = "Invalid Road ID Format"
                    });
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
                string islandCode = NormalizeInfraId(dto.IslandCode);
                if (!(await IslandCodesAsync(cancellationToken)).Contains(islandCode))
                {
                    return new BadRequestObjectResult(new { Message = $"Island code '{dto.IslandCode}' is not valid.", Title = "Invalid Island Code" });
                }
                var checkRoadName = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkRoadName != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Future Road name '{dto.Name}' already exists in the System.", Title = "Road Already Exists" });
                }
                await LockInfraIdAsync("FR", cancellationToken);
                string? roadId = await NextInfraIdAsync(_db.tFutureRoads.AsNoTracking().Select(x => x.RoadId), "FR", islandCode, cancellationToken);
                if (roadId == null)
                {
                    return new BadRequestObjectResult(new { Message = "All Future Road IDs (FR00001 to FR99999) are in use.", Title = "No Road ID Available" });
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
                    RoadId = roadId,
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
                    RoadId = roadId,
                    Message = $"Future Road {roadId} added successfully.",
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

                return await ShowPageAsync<FutureRoadSections, ShowFutureRoadSectionsFilterDTO>("tFutureRoadSections", dto, filters, RoadSectionSortColumns, cancellationToken);
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
                var checkRoad = await _db.tFutureRoads.AsNoTracking().FirstOrDefaultAsync(x => x.RoadId == dto.RoadId, cancellationToken);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road ID {dto.RoadId} does not exist in the system.", Title = "Invalid Road ID" });
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
                // Generated: FS + next number + the road's island code (S06-TC005-P001).
                await LockInfraIdAsync("FS", cancellationToken);
                string? roadSectionId = await NextInfraIdAsync(_db.tFutureRoadSections.AsNoTracking().Select(x => x.RoadSectionId).Concat(ProjectInfraIds()), "FS", dto.RoadId[^2..], cancellationToken);
                if (roadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = "All Road Section IDs (FS00001 to FS99999) are in use.", Title = "No Road Section ID Available" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureRoadSection = new FutureRoadSections()
                {
                    NetworkStatusId = MypsNetworkStatusId,
                    RoadId = dto.RoadId,
                    RoadSectionId = roadSectionId,
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
                    RoadSectionId = roadSectionId,
                    Message = $"Future Road Section {roadSectionId} added successfully.",
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
                var checkRoad = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkRoad == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road section does not exists in the System", Title = "Invalid Road Section" });
                }
                if (!IsCreatedInMyps(checkRoad.NetworkStatusId))
                {
                    return RbiaReadOnly("road section");
                }
                dto.RoadId = NormalizeInfraId(dto.RoadId);
                // The ID is not typed: the section keeps its number under its (possibly new) road's island.
                string? derivedSectionId = IdUnderParent("FS", checkRoad.RoadSectionId, dto.RoadId);
                if (derivedSectionId == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Road Section ID '{checkRoad.RoadSectionId}' is not in the FS12345LZ format, so it cannot be edited here.",
                        Title = "Invalid Road Section ID Format"
                    });
                }
                dto.RoadSectionId = derivedSectionId;
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
                if (!TryParseLength(dto.RoadLength, out double lengthM))
                {
                    return new BadRequestObjectResult(new { Message = $"Length '{dto.RoadLength}' is not a valid number of meters greater than 0.", Title = "Invalid Length" });
                }
                // Its bridges' From Chainage must stay within the section (S06-TC010-P001).
                double? furthestBridgeFrom = await _db.tFutureBridge.AsNoTracking()
                    .Where(x => x.RoadSectionId == checkRoad.RoadSectionId)
                    .MaxAsync(x => (double?)x.From, cancellationToken);
                var shorten = BridgePlacement.ShortenRefusal(lengthM, furthestBridgeFrom);
                if (shorten != null)
                {
                    return new BadRequestObjectResult(new { Message = shorten, Title = "Invalid Length" });
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
                    // Bridges point at the section by RoadSectionId (no FK): move them along. The section only
                    // changes ID when its new road is on another island, so their IDs take that island too.
                    var bridges = await _db.tFutureBridge.Where(x => x.RoadSectionId == checkRoad.RoadSectionId).ToListAsync(cancellationToken);
                    var bridgeIds = bridges.Select(b => b.BridgeId).ToList();
                    if (await _db.tProjectMajorWorkLocations.AsNoTracking().AnyAsync(x => bridgeIds.Contains(x.InfraId), cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = "A bridge on this road section is used by a project, so the section cannot move to a road on another island.",
                            Title = "Bridge In Use"
                        });
                    }
                    foreach (var bridge in bridges)
                    {
                        string? newBridgeId = IdUnderParent("FB", bridge.BridgeId, dto.RoadSectionId);
                        if (newBridgeId != null && newBridgeId != bridge.BridgeId)
                        {
                            if (await _db.tFutureBridge.AsNoTracking().AnyAsync(x => x.BridgeId == newBridgeId, cancellationToken))
                            {
                                return new BadRequestObjectResult(new { Message = $"Bridge {bridge.BridgeId} would become {newBridgeId}, which already exists.", Title = "Bridge ID Already Exists" });
                            }
                            Transactions.Add(new TransactionLog
                            {
                                ReferenceId = bridge.BridgeId,
                                TransactionType = EnumTransactionType.Update.ToString(),
                                AffectedTable = "tFutureBridge",
                                AffectedColumn = "BridgeId",
                                OldValue = bridge.BridgeId,
                                NewValue = newBridgeId,
                                CreatedBy = UserId,
                                CreatedDate = currentDate
                            });
                            bridge.BridgeId = newBridgeId;
                        }
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

                return await ShowPageAsync<FutureBridge, ShowFutureBridgeFilterDTO>("tFutureBridge", dto, filters, BridgeSortColumns, cancellationToken);
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
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
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
                var placement = BridgePlacement.Refusal(dto.From, dto.Length, checkRoadSectionId.LengthM, checkRoadSectionId.RoadSectionId);
                if (placement != null)
                {
                    return new BadRequestObjectResult(new { Message = placement, Title = "Invalid Bridge Position" });
                }
                // Generated: FB + next number + the section's island code (S06-TC010-P001).
                await LockInfraIdAsync("FB", cancellationToken);
                string? bridgeId = await NextInfraIdAsync(_db.tFutureBridge.AsNoTracking().Select(x => x.BridgeId).Concat(ProjectInfraIds()), "FB", dto.RoadSectionId[^2..], cancellationToken);
                if (bridgeId == null)
                {
                    return new BadRequestObjectResult(new { Message = "All Bridge IDs (FB00001 to FB99999) are in use.", Title = "No Bridge ID Available" });
                }
                DateTime currentDate = Functions.CurrentDate(); ;
                string UserId = _Session.UserId;
                var newFutureBridge = new FutureBridge()
                {
                    NetworkStatusId = MypsNetworkStatusId,
                    RoadSectionId = dto.RoadSectionId,
                    BridgeId = bridgeId,
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
                    BridgeId = bridgeId,
                    Message = $"Future Bridge {bridgeId} added successfully.",
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
                var checkBridge = await _db.tFutureBridge.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (checkBridge == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Bridge does not exists in the System", Title = "Invalid Bridge" });
                }
                if (!IsCreatedInMyps(checkBridge.NetworkStatusId))
                {
                    return RbiaReadOnly("bridge");
                }
                dto.RoadSectionId = NormalizeInfraId(dto.RoadSectionId);
                var checkRoadSectionId = await _db.tFutureRoadSections.AsNoTracking().FirstOrDefaultAsync(x => x.RoadSectionId == dto.RoadSectionId);
                if (checkRoadSectionId == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Road Section ID {dto.RoadSectionId} does not exist in the system. Please use other Road ID.", Title = "Invalid Road Section ID" });
                }
                var placement = BridgePlacement.Refusal(dto.From, dto.Length, checkRoadSectionId.LengthM, checkRoadSectionId.RoadSectionId);
                if (placement != null)
                {
                    return new BadRequestObjectResult(new { Message = placement, Title = "Invalid Bridge Position" });
                }
                // The ID is not typed: the bridge keeps its number under its (possibly new) section's island.
                string? derivedBridgeId = IdUnderParent("FB", checkBridge.BridgeId, dto.RoadSectionId);
                if (derivedBridgeId == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Bridge ID '{checkBridge.BridgeId}' is not in the FB12345LZ format, so it cannot be edited here.",
                        Title = "Invalid Bridge ID Format"
                    });
                }
                dto.BridgeId = derivedBridgeId;
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

                if (!string.IsNullOrWhiteSpace(dto.Filters.Search))
                    filters.Add(("v.RoadSectionId LIKE @Search OR v.RoadName LIKE @Search", "@Search", $"%{dto.Filters.Search.Trim()}%"));

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

                if (!string.IsNullOrWhiteSpace(dto.Filters.Search))
                    filters.Add(("v.BridgeId LIKE @Search OR v.BridgeName LIKE @Search", "@Search", $"%{dto.Filters.Search.Trim()}%"));

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