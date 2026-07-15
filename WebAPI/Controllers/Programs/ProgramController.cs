using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
namespace WebAPI.Controllers.Programs
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProgramController : CoreController
    {
        public ProgramController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma) : base(db, producer, pcma) { }
        #region Program Lists
        
        [HttpPost]
        public async Task<IActionResult> InitFilterProgram()
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RBP, EnumProgramStage.BP }.Select(stage => (int)stage).ToList();
                var SelectedStatus = new[] { EnumProgramStatus.Working, EnumProgramStatus.Approved }.Select(stage => (int)stage).ToList();

                var AvailableStages = await _db.tOptionProgramStage.Where(x => SelectedStage.Contains(x.Id)).ToListAsync();
                var AvailableTypes = await _db.tOptionProgramType.ToListAsync();

                var AvailableStatuses = await _db.tOptionProgramStatus.Where(x => SelectedStatus.Contains(x.NameId)).ToListAsync();
                var AvailableGroups = await _db.tGroups.ToListAsync();
                var response = new
                {
                    Stages = AvailableStages,
                    Types = AvailableTypes,
                    Statuses = AvailableStatuses,
                    Groups = AvailableGroups
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        //[HttpPost]
        //public async Task<IActionResult> ShowProgram([FromBody] ShowProgramDTO dto)
        //{
        //    try
        //    {
        //        if (dto.Filters == null)
        //        {
        //            return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
        //        }
        //        // Validate pagination parameters
        //        if (dto.page < 1) dto.page = 1;
        //        if (dto.limit < 1) dto.limit = 10;


        //        var conditions = new List<string>();
        //        var sqlParams = new List<SqlParameter>();

        //        if (!string.IsNullOrEmpty(dto.Filters.Name))
        //        {
        //            conditions.Add("v.[Name] LIKE @name");                 // structure = your literal
        //            sqlParams.Add(new SqlParameter("@name", $"%{dto.Filters.Name}%"));  // value = parameter
        //        }
        //        if (dto.Filters.StartYear.HasValue)
        //        {
        //            conditions.Add("v.StartYear = @startYear");
        //            sqlParams.Add(new SqlParameter("@startYear", dto.Filters.StartYear.Value));
        //        }
        //        if (!string.IsNullOrEmpty(dto.Filters.StageName))
        //        {
        //            conditions.Add("v.StageName = @stageName");
        //            sqlParams.Add(new SqlParameter("@stageName", dto.Filters.StageName));
        //        }
        //        if (!string.IsNullOrEmpty(dto.Filters.Type))
        //        {
        //            conditions.Add("v.[Type] = @type");
        //            sqlParams.Add(new SqlParameter("@type", dto.Filters.Type));
        //        }
        //        if (_Session.ApplyFilter)
        //        {
        //            conditions.Add("v.DataSecurityGroup LIKE @regCode");
        //            sqlParams.Add(new SqlParameter("@regCode", $"%{_Session.RegCode}%"));
        //        }

        //        string whereClause = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";

        //        if(dto.page > 1)
        //        {
        //            string PageSql = @$"
        //            SELECT
        //                ((rn - 1) / {dto.limit}) + 1 AS PageNumber,
        //                Id                          AS PageStartId   -- highest Id on the page = the jump cursor
        //            FROM (
        //                SELECT Id, ROW_NUMBER() OVER (ORDER BY Id DESC) AS rn
        //                FROM dbo.vProgramLatest v{whereClause}
        //            ) x
        //            WHERE (rn - 1) % {dto.limit} = 0 AND ((rn - 1) / {dto.limit}) + 1 = {dto.page};";
        //            PaginationPages paginationPages = (await _db.Set<PaginationPages>()
        //                .FromSqlRaw(PageSql, sqlParams.ToArray())
        //                .AsNoTracking()
        //                .FirstOrDefaultAsync())!;
        //            conditions.Add("v.Id <= @pageStartId");
        //            sqlParams.Add(new SqlParameter("@pageStartId", paginationPages?.PageStartId ?? 1));

        //            whereClause = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";
        //        }

        //        string sql = $"SELECT TOP {dto.limit} * FROM dbo.vProgramLatest v{whereClause} ORDER BY v.Id DESC";
        //        var Projects = await _db.vProgramLatest
        //            .FromSqlRaw(sql, sqlParams.ToArray())
        //            .AsNoTracking()
        //            .ToListAsync();


        //        PaginationCount records = new PaginationCount();
        //        string RowCountsSql = @$"
        //            SELECT COUNT_BIG(*) AS TotalCount
        //            FROM dbo.vProgramLatest v{whereClause}";
        //        records = (await _db.Set<PaginationCount>().FromSqlRaw(RowCountsSql, sqlParams.ToArray())
        //            .AsNoTracking()
        //            .FirstOrDefaultAsync())!;


        //        var totalPages = (int)Math.Ceiling((double)records.TotalCount / dto.limit);
        //        FilteredResult<DBHelper.Models.Views.ProgramLatest> CursorResult = new FilteredResult<DBHelper.Models.Views.ProgramLatest>()
        //        {
        //            lists = Projects,
        //            totalPages = totalPages,
        //            page = dto.page,
        //            limit = dto.limit,
        //            total = records?.TotalCount
        //        };
        //        return Ok(CursorResult);
        //    }
        //    catch (Exception ex)
        //    {
        //        return ExceptionHandler(ex);
        //    }
        //}

        [HttpPost]
        public async Task<IActionResult> ShowProgram([FromBody] ShowProgramDTO dto)
        {
            try
            {
                if (dto.Filters == null)
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }

                // Validate pagination parameters
                if (dto.page < 1) dto.page = 1;
                if (dto.limit < 1) dto.limit = 10;

                var filterDefs = new List<(string Clause, string ParamName, object Value)>();

                if (!string.IsNullOrEmpty(dto.Filters.Name))
                    filterDefs.Add(("v.[Name] LIKE @name", "@name", $"%{dto.Filters.Name}%"));

                if (dto.Filters.StartYear.HasValue)
                    filterDefs.Add(("v.StartYear = @startYear", "@startYear", dto.Filters.StartYear.Value));

                if (!string.IsNullOrEmpty(dto.Filters.StageName))
                    filterDefs.Add(("v.StageName = @stageName", "@stageName", dto.Filters.StageName));

                if (!string.IsNullOrEmpty(dto.Filters.Type))
                    filterDefs.Add(("v.[Type] = @type", "@type", dto.Filters.Type));

                if (_Session.ApplyFilter)
                {
                    filterDefs.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramFK = v.Id AND d.ParticipantId = @regCode)",
                        "@regCode", _Session.RegCode));
                }

                string filterWhere = filterDefs.Count > 0
                    ? " WHERE " + string.Join(" AND ", filterDefs.Select(f => f.Clause))
                    : "";

                SqlParameter[] BuildParams(params SqlParameter[] extra) =>
                    filterDefs.Select(f => new SqlParameter(f.ParamName, f.Value))
                              .Concat(extra)
                              .ToArray();

                long? pageStartId = null;
                if (dto.page > 1)
                {
                    string pageIndexSql = $@"
                SELECT ((rn - 1) / @limit) + 1 AS PageNumber, Id AS PageStartId
                FROM (
                    SELECT v.Id, ROW_NUMBER() OVER (ORDER BY v.Id DESC) AS rn
                    FROM dbo.vProgramLatest v{filterWhere}
                ) x
                WHERE (rn - 1) % @limit = 0 AND ((rn - 1) / @limit) + 1 = @page";

                    var pageParams = BuildParams(
                        new SqlParameter("@limit", dto.limit),
                        new SqlParameter("@page", dto.page));

                    var pageRow = await _db.Set<PaginationPages>()
                        .FromSqlRaw(pageIndexSql, pageParams)
                        .AsNoTracking()
                        .FirstOrDefaultAsync();

                    if (pageRow == null)
                    {
                        var emptyCountParams = BuildParams();
                        var emptyCount = await _db.Set<PaginationCount>()
                            .FromSqlRaw($"SELECT COUNT_BIG(*) AS TotalCount FROM dbo.vProgramLatest v{filterWhere}", emptyCountParams)
                            .AsNoTracking()
                            .FirstOrDefaultAsync();

                        long total = emptyCount?.TotalCount ?? 0;
                        return Ok(new FilteredResult<DBHelper.Models.Views.ProgramLatest>
                        {
                            lists = new List<DBHelper.Models.Views.ProgramLatest>(),
                            totalPages = (int)Math.Ceiling((double)total / dto.limit),
                            page = dto.page,
                            limit = dto.limit,
                            total = total
                        });
                    }

                    pageStartId = pageRow.PageStartId;
                }

                string fetchWhere = filterWhere;
                var fetchExtraParams = new List<SqlParameter> { new SqlParameter("@limit", dto.limit) };

                if (pageStartId.HasValue)
                {
                    fetchWhere += (filterWhere.Length > 0 ? " AND" : " WHERE") + " v.Id <= @pageStartId";
                    fetchExtraParams.Add(new SqlParameter("@pageStartId", pageStartId.Value));
                }

                string fetchSql = $@"
            SELECT TOP (@limit) *
            FROM dbo.vProgramLatest v{fetchWhere}
            ORDER BY v.Id DESC";

                var projects = await _db.vProgramLatest
                    .FromSqlRaw(fetchSql, BuildParams(fetchExtraParams.ToArray()))
                    .AsNoTracking()
                    .ToListAsync();

                string countSql = $"SELECT COUNT_BIG(*) AS TotalCount FROM dbo.vProgramLatest v{filterWhere}";
                var countParams = BuildParams();

                var records = await _db.Set<PaginationCount>()
                    .FromSqlRaw(countSql, countParams)
                    .AsNoTracking()
                    .FirstOrDefaultAsync() ?? new PaginationCount { TotalCount = 0 };

                var totalPages = (int)Math.Ceiling((double)records.TotalCount / dto.limit);

                return Ok(new FilteredResult<DBHelper.Models.Views.ProgramLatest>
                {
                    lists = projects,
                    totalPages = totalPages,
                    page = dto.page,
                    limit = dto.limit,
                    total = records.TotalCount
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        [HttpPost]
        public async Task<IActionResult> ShowProgramStages([FromBody] ProgramDetailsDTO dto)
        {
            try
            {
                var Stages = await _db.fProgramStages
                .FromSqlInterpolated($"SELECT * FROM dbo.fProgramStages({dto.ProgramId})")
                .AsNoTracking()
                .ToListAsync();

                if (_Session.ApplyFilter)
                {
                    Stages = Stages.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode)).ToList();
                }
                return Ok(new
                {
                    Stages = Stages
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> InitAddProgram()
        {
            try
            {
                var SelectedStage = new[] { EnumProgramStage.RDIP, EnumProgramStage.PIP }.Select(stage => (int)stage).ToList();

                var Stage = await _db.tOptionProgramStage.AsNoTracking().Where(x => !SelectedStage.Contains(x.Id)).ToListAsync();

                var Type = await _db.tOptionProgramType.AsNoTracking().ToListAsync();
                var Group = await _db.tGroups.ToListAsync();
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                return Ok(new
                {
                    Stages = Stage,
                    Types = Type,
                    Groups = Group,
                    DataSecurity = Security
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> AddProgram([FromBody] AddProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var checkProgram = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Name == dto.Name);
                if (checkProgram != null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program name '{dto.Name}' already exists in the System.", Title = "Program Already Exists" });
                }
                var checkStageType = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Stage);
                if (checkStageType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Stage '{dto.Stage}' is not valid.", Title = "Invalid Stage" });
                }
                var checkType = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                if (checkType == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program Type '{dto.Type}' is not valid.", Title = "Invalid Type" });
                }
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).Select(x => x.ParticipantId).ToListAsync();
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid.", Title = "Invalid Security Group" });
                }
                if (dto.IsSkipped == true && string.IsNullOrEmpty(dto.SkipReason))
                {
                    return new BadRequestObjectResult(new { Message = $"Please provide a reason for skipping stage of this program.", Title = "Skip Reason Required" });
                }
                string hostName = User.FindFirstValue(ClaimTypes.GivenName) ?? "Unknown";
                //string ReferenceId = "PR_" + hostName + "_" + ("tCountSequence").GenerateCode();
                DateTime CurrentDate = Functions.CurrentDate();
                string HostName = User.FindFirstValue("HostName")!;
                string Date = CurrentDate.ToString("MMddyyyy");
                string Time = CurrentDate.ToString("HHmmss");
                string NewProgramUniqueId = $"{HostName}_{Date}_{Time}";
                string UserId = _Session.UserId;
                var newProgram = new DBHelper.Models.Table.Programs()
                {
                    ProgramPK = NewProgramUniqueId,
                    ProgramId = NewProgramUniqueId,
                    DataSecurityGroup = dto.DataSecurityGroup,
                    UserGroup = dto.UserGroup,
                    Type = dto.Type,
                    YearStart = dto.YearStart,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                };
                await _db.tPrograms.AddAsync(newProgram);
                var newRevisions = new ProgramRevisions()
                {
                    ProgramFK = NewProgramUniqueId,
                    ProgramId = NewProgramUniqueId,
                    Name = dto.Name,
                    Status = EnumProgramStatus.Working,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,

                };
                await _db.tProgramRevisions.AddAsync(newRevisions);
                await _db.SaveChangesAsync();
                await _db.tProgramStages.AddAsync(new ProgramStages()
                {
                    ProgramFK = NewProgramUniqueId,
                    ProgramId = NewProgramUniqueId,
                    RevisionId = newRevisions.Id,
                    StageId = dto.Stage,
                    StageName = dto.Stage.ToString(),
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Id = NewProgramUniqueId,
                    Stage = dto.Stage.ToString(),
                    Message = "Program added successfully.",
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
        #region Program Details
        
        [HttpPost]
        public async Task<IActionResult> ProgramDetails([FromBody] ProgramDetailsDTO dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }
                var ValidateProgram = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session,
                    ViewOldStage = true
                });
                if (!ValidateProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = ValidateProgram.Message, Title = ValidateProgram.Title });
                }
                var ProgramParent = ValidateProgram.Data.Program;
                var ProgramRevision = ValidateProgram.Data.ProgramRevision;
                var ProgramStage = ValidateProgram.Data.ProgramStage;

                var CurrentProgramVersion = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramPK == ProgramRevision.ProgramFK);
                if(CurrentProgramVersion == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the System.", Title = "Program not found" });
                }
                var regionCode = _Session.ApplyFilter ? _Session.RegCode : null;
                var ProjectLists = await _db.fProjectsPerStage
                .FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({ProgramParent.ProgramId}) fp WHERE fp.StageName = {dto.StageName} AND ({regionCode} IS NULL OR fp.Region = {regionCode})").AsNoTracking()
                    .OrderByDescending(x => x.Id)
                    .Skip(0 * 15)
                    .Take(15)
                    .ToListAsync();
                var AvailableStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync();
                var AvailableTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync();
                var AvailableStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync();
                var AvailableGroups = await _db.tGroups.AsNoTracking().ToListAsync();
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var Security = await _db.vAdminImplementingOffice.AsNoTracking().Where(x => includes.Contains(x.OrgType)).ToListAsync();
                var response = new
                {
                    IsActive = (CurrentProgramVersion.StageName == ProgramStage.StageName) ? true : false,
                    Details = ProgramRevision,
                    Projects = ProjectLists,
                    Dropdowns = new
                    {
                        Stages = AvailableStages,
                        Types = AvailableTypes,
                        Statuses = AvailableStatuses,
                        Groups = AvailableGroups,
                        DataSecurity = Security
                    }
                };
                return Ok(response);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> DeleteProgram([FromBody] DeleteProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                if (string.IsNullOrEmpty(dto.ProgramId))
                {
                    return new BadRequestObjectResult(new { Message = "Expected Parameters missing.", Title = "Parameter Error" });
                }
                EnumProgramStage[] StagesToCheck =
                {
                    EnumProgramStage.NEP,
                    EnumProgramStage.NEPE,
                    EnumProgramStage.HGAB,
                    EnumProgramStage.HGABI,
                    EnumProgramStage.GAA,
                    EnumProgramStage.GAAR,
                };
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                if (StagesToCheck.Contains(ProgramStage.StageId))
                {
                    return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it has progressed beyond the BP stage.", Title = "Delete Not Allowed" });
                }
                else
                {
                    if (ProgramRevisions.Cost > 0)
                    {
                        return new BadRequestObjectResult(new { Message = $"Program {dto.ProgramId} cannot be deleted because it has projects associated with it.", Title = "Delete Not Allowed" });
                    }
                }
                var TransactionLog = new TransactionLog()
                {
                    TransactionId = dto.ProgramId,
                    TypeOfTransaction = "Delete",
                    AffectedTable = "tPrograms",
                    AffectedColumn = "IsDeleted",
                    NewValue = "true",
                    OldValue = "false",
                    CreatedBy = _Session.UserId,
                    CreatedDate = Functions.CurrentDate()
                };
                await _db.tTransactionLog.AddRangeAsync(TransactionLog);

                EnumProgramStage[] AllowedStages =
                {
                    EnumProgramStage.BP,
                    EnumProgramStage.RBP,
                    EnumProgramStage.RDIP,
                    EnumProgramStage.PIP
                };
                if (AllowedStages.Contains(ProgramStage.StageId))//RDIP RBP PIP
                {
                    //var ProgramRevisions = await _db.tProgramRevisions.Where(x => x.ProgramId == program.ProgramId).ToListAsync();
                    //HashSet<int> ProgramRevisionIds = ProgramRevisions.Select(x => x.Id).ToHashSet();
                    //var ProgramStages = await _db.tProgramStages.Where(x => ProgramRevisionIds.Contains(x.RevisionId)).AsNoTracking().ToListAsync();
                    var ProjectsInProgram = await _db.tProjects.Where(x => x.ProgramId == ProgramRevisions.ProgramId).AsNoTracking().ToListAsync();
                    HashSet<string> ReferenceIds = ProjectsInProgram.Select(x => x.ReferenceId).ToHashSet();
                    var ProjectRevisions = await _db.tProjectRevisions.Where(x => ReferenceIds.Contains(x.ReferenceId)).AsNoTracking().ToListAsync();
                    HashSet<int> RevisionIds = ProjectRevisions.Select(x => x.Id).ToHashSet();
                    var ProjectStages = await _db.tProjectStages.Where(x => RevisionIds.Contains(x.RevisionId)).AsNoTracking().ToListAsync();

                    _db.tPrograms.Remove(ProgramParent);
                    _db.tProgramRevisions.RemoveRange(ProgramRevisions);
                    _db.tProgramStages.RemoveRange(ProgramStage);
                    _db.tProjects.RemoveRange(ProjectsInProgram);
                    _db.tProjectRevisions.RemoveRange(ProjectRevisions);
                    _db.tProjectStages.RemoveRange(ProjectStages);
                }
                else
                {
                    program.IsDeleted = true;
                    _db.tPrograms.Update(program);
                }
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Message = "Program deleted successfully.",
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
        public async Task<IActionResult> UpdateProgramDetails([FromBody] UpdateProgramDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                bool hasUpdated = false;
                DateTime CurrentDate = Functions.CurrentDate();
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                List<TransactionLog> transactionLogs = new List<TransactionLog>();
                if (string.IsNullOrEmpty(dto.Name)) { return new BadRequestObjectResult(new { Message = $"Program name field cannot be empty.", Title = "Update Failed" }); }
                //var NewProgramVersion = new ProgramRevisions()
                //{
                //    ProgramFK = dto.ProgramId,
                //    ProgramId = getProgram.ProgramId,
                //    Name = dto.Name,
                //    Status = dto.Status,
                //    Cost = dto.Cost,
                //    CreatedBy = _Session.UserId,
                //    CreatedDate = CurrentDate
                //};
                if (dto.Name != ProgramRevisions.Name && !string.IsNullOrEmpty(ProgramRevisions.Name))
                {
                    hasUpdated = true;
                    ProgramRevisions.Name = dto.Name;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Name",
                        NewValue = dto.Name,
                        OldValue = ProgramRevisions.Name,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.UserGroup != ProgramParent.UserGroup && ProgramParent.UserGroup.Count() > 0)
                {
                    hasUpdated = true;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "UserGroup",
                        NewValue = string.Join(", ", dto.UserGroup),
                        OldValue = string.Join(", ", ProgramParent.UserGroup),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    ProgramParent.UserGroup = dto.UserGroup;
                }
                string[] includes = { "CO", "R", "UPMO", "PMOC", "B" };
                var GetSecurityGroup = await _db.vAdminImplementingOffice.AsNoTracking().ToListAsync();
                var CheckItems = dto.DataSecurityGroup.Where(x => !GetSecurityGroup.Select(x => x.ParticipantId).Contains(x));
                if (CheckItems.Count() > 0)
                {
                    return new BadRequestObjectResult(new { Message = $"Security Group '{string.Join(", ", CheckItems)}' is not valid.", Title = "Invalid Security Group" });
                }
                if (dto.DataSecurityGroup != ProgramParent.DataSecurityGroup)
                {
                    hasUpdated = true;
                    string CurrentSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => ProgramParent.DataSecurityGroup.Contains(sg)));
                    string OdSecurityGroup = string.Join(", ", GetSecurityGroup.Select(x => x.Name).Where(sg => dto.DataSecurityGroup.Contains(sg)));
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "DataSecurityGroup",
                        NewValue = CurrentSecurityGroup!,
                        OldValue = OdSecurityGroup!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                    ProgramParent.DataSecurityGroup = dto.DataSecurityGroup;
                }
                var Status = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)dto.Status);
                if (Status == null) { return new BadRequestObjectResult(new { Message = $"The selected Status is invalid. Please ensure the Status field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Status != ProgramRevisions.Status)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramStatus.FirstOrDefaultAsync(x => x.NameId == (int)ProgramRevisions.Status);
                    ProgramRevisions.Status = dto.Status;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Status",
                        NewValue = Status.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                var Types = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)dto.Type);
                if (Types == null) { return new BadRequestObjectResult(new { Message = $"The selected Type is invalid. Please ensure the Type field has a valid value selected.", Title = "Update Failed" }); }
                if (dto.Type != ProgramParent.Type)
                {
                    hasUpdated = true;
                    var Current = await _db.tOptionProgramType.FirstOrDefaultAsync(x => x.NameId == (int)ProgramParent.Type);
                    ProgramParent.Type = dto.Type;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "Type",
                        NewValue = Types.Name!,
                        OldValue = Current!.Name!,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (dto.YearStart != ProgramParent.YearStart)
                {
                    hasUpdated = true;
                    ProgramParent.YearStart = dto.YearStart;
                    transactionLogs.Add(new TransactionLog
                    {
                        TransactionId = dto.ProgramId,
                        TypeOfTransaction = "Update",
                        AffectedTable = "tProgramRevisions",
                        AffectedColumn = "YearStart",
                        NewValue = dto.YearStart.ToString(),
                        OldValue = ProgramParent.YearStart.ToString(),
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate
                    });
                }
                if (hasUpdated)
                {
                    _db.tProgramRevisions.Update(ProgramRevisions);
                    await _db.SaveChangesAsync();
                    await _db.tProgramStages.AddAsync(new ProgramStages()
                    {
                        ProgramFK = ProgramRevisions.ProgramFK,
                        ProgramId = ProgramRevisions.ProgramId,
                        RevisionId = ProgramRevisions.Id,
                        StageId = ProgramStage.StageId,
                        StageName = ProgramStage.StageName,
                        CreatedBy = _Session.UserId,
                        CreatedDate = CurrentDate,
                    });
                    await _db.tTransactionLog.AddRangeAsync(transactionLogs);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                return Ok(new
                {
                    Message = $"Program {dto.ProgramId} updated successfully.",
                    Title = "Update Complete"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> UpdateProgramStage([FromBody] UpdateProgramStageDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = dto.Stage.ToString(),
                    _Session = _Session
                });
                if(!ValidateProgramId.IsValid) {
                    return new BadRequestObjectResult(new { Message = ValidateProgramId.Message, Title = ValidateProgramId.Title });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevision = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;

                var checkProjects = await _db.fProjectsPerStage
                .FromSqlInterpolated($"SELECT * FROM fProjectsInProgram({dto.ProgramId}) fp WHERE fp.StageId = {ProgramStage.StageId}")
                .AsNoTracking()
                .ToListAsync();
                if (checkProjects.Count > 0)
                {
                    HashSet<string> projectIds = checkProjects.Select(p => p.ProjectId!).ToHashSet();
                    HashSet<int> RevisionIds = checkProjects.Select(p => p.Id!).ToHashSet();
                    var ProjectRevisions = await _db.tProjectRevisions.AsNoTracking().Where(x => RevisionIds.Contains(x.Id)).ToListAsync();

                    var Components = await _db.tProjectComponentCost.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == ProgramStage.StageName && x.IsDeleted == false).ToListAsync();
                    HashSet<string> ComponentsRefs = Components.Select(pr => pr.CostId).ToHashSet();
                    var ComponentsPerYear = await _db.tProjectComponentCostPerYear.AsNoTracking().Where(x => ComponentsRefs.Contains(x.ComponentCostId) && x.StageName == ProgramStage.StageName && x.IsDeleted == false).ToListAsync();

                    var MajorItems = await _db.tProjectMajorWorkItem.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == ProgramStage.StageName && x.IsDeleted == false).ToListAsync();
                    HashSet<string> MajorItemsRefs = MajorItems.Select(pr => pr.ReferenceId).ToHashSet();
                    var MajorLocations = await _db.tProjectMajorWorkLocations.AsNoTracking().Where(x => MajorItemsRefs.Contains(x.ParentId) && x.IsDeleted == false).ToListAsync();

                    var FundingProfiles = await _db.tProjectFundingProfile.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == ProgramStage.StageName && x.IsDeleted == false).ToListAsync();
                    var SupportingDocuments = await _db.tProjectSupportingDocs.AsNoTracking().Where(x => projectIds.Contains(x.ProjectId) && x.StageName == ProgramStage.StageName).ToListAsync();
                    string HostName = User.FindFirstValue("HostName")!;
                    string Date = CurrentDate.ToString("MMddyyyy");
                    string Time = CurrentDate.ToString("HHmmss");
                    string NewProgramUniqueId = $"{HostName}_{Date}_{Time}";
                    List<ProjectRevisions> NewRevisions = new List<ProjectRevisions>();
                    if (ProjectRevisions.Count > 0)
                    {
                        string FirstSegment = checkStageType.Name.GenerateProjec1stSegment();
                        #region Component Costs
                        List<DBHelper.Models.Table.ProjectComponentCost> NewComponent = new List<DBHelper.Models.Table.ProjectComponentCost>();
                        List<ProjectComponentCostPerYear> NewComponentPerYear = new List<ProjectComponentCostPerYear>();
                        if (Components.Count() > 0)
                        {
                            foreach (var ComponentId in ComponentsRefs)
                            {
                                var SelectedComponentCost = Components.Where(x => x.CostId == ComponentId).FirstOrDefault();
                                if (SelectedComponentCost != null)
                                {
                                    NewComponent.Add(new DBHelper.Models.Table.ProjectComponentCost()
                                    {
                                        ProjectId = SelectedComponentCost.ProjectId.Replace("BP", FirstSegment),
                                        ProgramUniqueId = NewProgramUniqueId,
                                        CostId = $"{ComponentId}_{NewProgramUniqueId}",
                                        ComponentType = SelectedComponentCost.ComponentType,
                                        ComponentId = SelectedComponentCost.ComponentId,
                                        Description = SelectedComponentCost.Description,
                                        Total = SelectedComponentCost.Total,
                                        StageName = checkStageType.Name,
                                        CreatedBy = SelectedComponentCost.CreatedBy,
                                        CreatedDate = SelectedComponentCost.CreatedDate,
                                        IsDeleted = SelectedComponentCost.IsDeleted
                                    });
                                    NewComponentPerYear.AddRange(ComponentsPerYear.Where(x => x.ComponentCostId == ComponentId).Select(x => new ProjectComponentCostPerYear()
                                    {
                                        ComponentCostId = $"{ComponentId}_{NewProgramUniqueId}",
                                        ProgramUniqueId = NewProgramUniqueId,
                                        Year = x.Year,
                                        Amount = x.Amount,
                                        StageName = checkStageType.Name,
                                        StartDate = x.StartDate,
                                        EndDate = x.EndDate,
                                        CreatedBy = x.CreatedBy,
                                        CreatedDate = x.CreatedDate,
                                        IsDeleted = x.IsDeleted
                                    }));
                                }
                            }
                            await _db.tProjectComponentCost.AddRangeAsync(NewComponent);
                            await _db.tProjectComponentCostPerYear.AddRangeAsync(NewComponentPerYear);
                        }
                        #endregion
                        #region Major Items
                        List<ProjectMajorWorkItem> NewMajorItems = new List<ProjectMajorWorkItem>();
                        List<ProjectMajorWorkLocations> NewMajorLocations = new List<ProjectMajorWorkLocations>();
                        if (MajorItems.Count() > 0)
                        {
                            foreach (var reference in MajorItemsRefs)
                            {
                                var SelectedMajorItem = MajorItems.FirstOrDefault(x => x.ReferenceId == reference);
                                if (SelectedMajorItem != null)
                                {
                                    NewMajorItems.Add(new ProjectMajorWorkItem()
                                    {
                                        ProjectId = SelectedMajorItem.ProjectId.Replace("BP", FirstSegment),
                                        ProgramUniqueId = NewProgramUniqueId,
                                        ReferenceId = $"{SelectedMajorItem.ComponentId}_{NewProgramUniqueId}",
                                        ComponentId = SelectedMajorItem.ComponentId,
                                        YearOfWork = SelectedMajorItem.YearOfWork,
                                        WorkTypeId = SelectedMajorItem.WorkTypeId,
                                        InfraType = SelectedMajorItem.InfraType,
                                        StageName = checkStageType.Name,
                                        CreatedBy = SelectedMajorItem.CreatedBy,
                                        CreatedDate = SelectedMajorItem.CreatedDate,
                                        IsDeleted = SelectedMajorItem.IsDeleted
                                    });
                                    NewMajorLocations.AddRange(MajorLocations.Where(x => x.ParentId == reference).Select(x => new ProjectMajorWorkLocations()
                                    {
                                        ParentId = $"{SelectedMajorItem.ComponentId}_{NewProgramUniqueId}",
                                        ProgramUniqueId = NewProgramUniqueId,
                                        StageName = checkStageType.Name,
                                        InfraId = x.InfraId,
                                        DetailedScope = x.DetailedScope,
                                        TargetUnitId = x.TargetUnitId,
                                        TargetUnit = x.TargetUnit,
                                        StartX = x.StartX,
                                        StartY = x.StartY,
                                        EndX = x.EndX,
                                        EndY = x.EndY,
                                        PhysicalTarget = x.PhysicalTarget,
                                        StartStationLimit = x.StartStationLimit,
                                        EndStationLimit = x.EndStationLimit,
                                        EndChainage = x.EndChainage,
                                        StartChainage = x.StartChainage,
                                        CreatedBy = x.CreatedBy,
                                        CreatedDate = x.CreatedDate,
                                        Length = x.Length,
                                        IsDeleted = x.IsDeleted
                                    }));
                                }
                            }
                            await _db.tProjectMajorWorkItem.AddRangeAsync(NewMajorItems);
                            await _db.tProjectMajorWorkLocations.AddRangeAsync(NewMajorLocations);
                        }
                        #endregion
                        #region Funding Profiles
                        List<ProjectFundingProfile> NewFundingProfiles = new List<ProjectFundingProfile>();
                        if (FundingProfiles.Count() > 0)
                        {
                            NewFundingProfiles.AddRange(FundingProfiles.Select(x => new ProjectFundingProfile()
                            {
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                ProgramUniqueId = NewProgramUniqueId,
                                Source = x.Source,
                                Agreement = x.Agreement,
                                Amount = x.Amount,
                                Percentage = x.Percentage,
                                StageName = checkStageType.Name,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate,
                                IsDeleted = x.IsDeleted
                            }));
                            await _db.tProjectFundingProfile.AddRangeAsync(NewFundingProfiles);
                        }
                        #endregion
                        #region Supporting Documents
                        List<ProjectSupportingDocs> NewSupportingDocs = new List<ProjectSupportingDocs>();
                        if (SupportingDocuments.Count() > 0)
                        {
                            NewSupportingDocs.AddRange(SupportingDocuments.Select(x => new ProjectSupportingDocs()
                            {
                                StageName = checkStageType.Name,
                                DocumentType = x.DocumentType,
                                ProjectId = x.ProjectId.Replace("BP", FirstSegment),
                                FileName = x.FileName,
                                FileExtension = x.FileExtension,
                                FilePath = x.FilePath,
                                Description = x.Description,
                                CreatedBy = x.CreatedBy,
                                CreatedDate = x.CreatedDate
                            }));
                            await _db.tProjectSupportingDocs.AddRangeAsync(NewSupportingDocs);
                        }
                        #endregion
                        #region Project Revisions
                        NewRevisions.AddRange(ProjectRevisions.Select(project => new ProjectRevisions()
                        {
                            ProgramId = project.ProgramId,
                            ProgramUniqueId = NewProgramUniqueId,
                            ReferenceId = project.ReferenceId,
                            ProjectId = project.ProjectId.Replace("BP", FirstSegment),
                            AlternateId = project.AlternateId,
                            ExternalId = project.ExternalId,
                            MYId = project.MYId,
                            UACS = project.UACS,
                            MYCAApprovalDate = project.MYCAApprovalDate,
                            RevisionNumber = 1,
                            Description = project.Description,
                            Category = project.Category,
                            Thrust = project.Thrust,
                            Origin = project.Origin,
                            Province = project.Province,
                            City = project.City,
                            LegislativeDistrict = project.LegislativeDistrict,
                            OperatingUnit = project.OperatingUnit,
                            ImplementingOffice = project.ImplementingOffice,
                            DEO = project.DEO,
                            Region = project.Region,
                            Agency = project.Agency,
                            IslandCode = project.IslandCode,
                            ImplementationMode = project.ImplementationMode,
                            EmergencyMode = project.EmergencyMode,
                            Feasibility = project.Feasibility,
                            FeasibilityDate = project.FeasibilityDate,
                            DetailedDesign = project.DetailedDesign,
                            DetailedDesignDate = project.DetailedDesignDate,
                            RowAvailable = project.RowAvailable,
                            RegionWide = project.RegionWide,
                            Tier = project.Tier,
                            Rank = project.Rank,
                            IsRevised = false,
                            RevisedNumber = null,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsDeleted = project.IsDeleted,
                            IsPublishable = (dto.Stage.ToString() == "GAA-R" && Functions.ValidateProjectForPublish(project, ComponentsPerYear.Where(a => a.ComponentCostId == Components.FirstOrDefault(x => x.ProjectId == project.ProjectId && !x.IsDeleted && x.StageName == dto.Stage.ToString()).CostId).ToList()))
                        }));
                        await _db.tProjectRevisions.AddRangeAsync(NewRevisions);
                        checkRevisions.Status = EnumProgramStatus.Approved;
                        _db.tProgramRevisions.Update(checkRevisions);
                        #endregion
                        var transactionLog = new TransactionLog()
                        {
                            TransactionId = dto.ProgramId,
                            TypeOfTransaction = "Update",
                            AffectedTable = "tProgramStages",
                            AffectedColumn = "StageName",
                            NewValue = checkStageType.Name,
                            OldValue = checkStage.StageName,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        await _db.tTransactionLog.AddAsync(transactionLog);
                        await _db.SaveChangesAsync();
                        #region Project Stages
                        var newStages = NewRevisions.Select(pr => new ProjectStages
                        {
                            ProgramId = dto.ProgramId,
                            ProgramUniqueId = NewProgramUniqueId,
                            ReferenceId = pr.ReferenceId,
                            RevisionId = pr.Id,
                            StageId = (EnumProgramStage)checkStageType.NameId,//checkStage.StageId.UpdateStage(),
                            StageName = checkStageType.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        });
                        await _db.tProjectStages.AddRangeAsync(newStages);
                        #endregion
                        #region Program Revisions
                        var newProgramRevision = new ProgramRevisions()
                        {
                            ProgramId = dto.ProgramId,
                            ProgramUniqueId = NewProgramUniqueId,
                            RevisionNumber = 1,
                            Name = dto.Name,
                            DataSecurityGroup = checkRevisions.DataSecurityGroup,
                            UserGroup = checkRevisions.UserGroup,
                            Status = EnumProgramStatus.Working,
                            Type = checkRevisions.Type,
                            Cost = checkRevisions.Cost,
                            YearStart = checkRevisions.YearStart,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate
                        };
                        await _db.tProgramRevisions.AddAsync(newProgramRevision);
                        await _db.SaveChangesAsync();
                        #endregion
                        #region Program Stages
                        var newStage = new ProgramStages()
                        {
                            ProgramUniqueId = NewProgramUniqueId,
                            ProgramId = dto.ProgramId,
                            RevisionId = newProgramRevision.Id,
                            StageId = dto.Stage,
                            StageName = checkStageType.Name,
                            CreatedBy = _Session.UserId,
                            CreatedDate = CurrentDate,
                            IsPublished = false,
                        };
                        await _db.tProgramStages.AddAsync(newStage);
                        await _db.SaveChangesAsync();
                        #endregion
                        await transaction.CommitAsync();
                        return Ok(new
                        {
                            Message = "Program updated successfully.",
                            Title = "Update Stage Complete"
                        });
                    }
                }
                return new BadRequestObjectResult(new
                {
                    Message = "No projects are linked to this program.",
                    Title = "Project Link Missing"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> BatchRestrictPublish([FromBody] BatchUnpublishTaggingDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                var ProgramDetails = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if(ProgramDetails == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator.", Title = "Program not found" });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = ProgramDetails.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                char[] delimiters = { ';', ',', ' ', '\n' };
                var projectIds = dto.ProjectIds
                .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .ToArray();

                var projectIdsJson = System.Text.Json.JsonSerializer.Serialize(projectIds);

                var checkProjects = await _db.fProjectsPerStage
                .FromSqlInterpolated($@"
                    SELECT *
                    FROM dbo.fProjectsInProgram({dto.ProgramId}) fp
                    WHERE fp.StageName = {checkProgram.StageName}
                      AND fp.ProjectId IN (SELECT [value] FROM OPENJSON({projectIdsJson}))
                ")
                .AsNoTracking()
                .ToListAsync(); 
                var existingSet = new HashSet<string>(
                    checkProjects.Select(a => a.ProjectId),
                    StringComparer.OrdinalIgnoreCase
                );
                var MissingProjectIds = projectIds
                    .Where(x => !existingSet.Contains(x))
                    .ToArray();
                if (existingSet.Count() > 0)
                {
                    HashSet<int> RevisionIds = checkProjects.Select(p => p.Id!).ToHashSet();
                    var projectsToUpdate = await _db.tProjectRevisions
                        .Where(ps => RevisionIds.Contains(ps.Id))
                        .ToListAsync();
                    foreach (var projectStage in projectsToUpdate)
                    {
                        projectStage.IsPublishable = false;
                    }
                    _db.tProjectRevisions.UpdateRange(projectsToUpdate);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"The selected projects have been excluded from automatic publication to PCMA.\n\nList of missing Projects:{string.Join("\n", MissingProjectIds)}.",
                        Title = "Restrict Publishing Successful"
                    });
                }
                var notExisting = projectIds
                    .Where(x => !existingSet.Contains(x))
                    .ToArray();

                return Ok(new
                {
                    Message = "The selected projects have been excluded from automatic publication to PCMA.",
                    Title = "Restrict Publishing Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> BatchAllowPublish([FromBody] BatchUnpublishTaggingDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();;
                var checkProgram = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator.", Title = "Program not found" });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = checkProgram.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                char[] delimiters = { ';', ',', '.', '&', ' ', '\n' };
                var projectIds = dto.ProjectIds
                .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .ToArray();

                var projectIdsJson = System.Text.Json.JsonSerializer.Serialize(projectIds);

                // ✅ Fetch only the projects that actually exist in this program+stage
                var checkProjects = await _db.fProjectsPerStage
                    .FromSqlInterpolated($@"
                        SELECT *
                        FROM dbo.fProjectsInProgram({dto.ProgramId}) fp
                        WHERE fp.StageName = {checkProgram.StageName}
                          AND fp.ProjectId IN (SELECT [value] FROM OPENJSON({projectIdsJson}))
                          AND fp.IsPublishable = 0
                          AND fp.IsPublished = 0
                    ")
                    .AsNoTracking()
                    .ToListAsync();
                if (checkProjects.Count == 0)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new
                    {
                        Message = "None of the provided Project IDs were found in the current program and stage. No changes were made.",
                        Title = "Restrict Publishing Failed"
                    });
                }

                var existingSet = checkProjects.Select(x => x.ProjectId).ToHashSet<string>();

                var missingProjectIds = projectIds
                    .Where(x => !existingSet.Contains(x))
                    .ToArray();

                var revisionIds = checkProjects.Select(p => p.Id).ToHashSet<int>();

                var projectsToUpdate = await _db.tProjectRevisions
                    .Where(ps => revisionIds.Contains(ps.Id))
                    .ToListAsync();

                if (projectsToUpdate.Count == 0)
                {
                    return new BadRequestObjectResult(new { Message = $"No valid project revisions found for the specified projects.", Title = "Projects Not Found" });
                }

                foreach (var projectStage in projectsToUpdate)
                {
                    projectStage.IsPublishable = true;
                }
                if(missingProjectIds.Count() > 0)
                {
                    transaction.Rollback();
                    return Ok(new
                    {
                        Message = "Some projects were not found in the current program and stage, but the valid ones have been restricted from publication.",
                        MissingProjectIds = missingProjectIds,
                        Title = "Partial Success"
                    });
                }

                _db.tProjectRevisions.UpdateRange(projectsToUpdate);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();


                return Ok(new
                {
                    Message = $"Projects allowed for automatic publication to PCMA.",
                    Title = "Allow Publishing Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> BatchDelete([FromBody] BatchUnpublishTaggingDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();;
                var checkProgram = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator.", Title = "Program not found" });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = checkProgram.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                char[] delimiters = { ';', ',', '.', '&', ' ', '\n' };
                var projectIds = dto.ProjectIds
                .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .ToArray();

                var projectIdsJson = System.Text.Json.JsonSerializer.Serialize(projectIds);

                var checkProjects = await _db.fProjectsPerStage
                .FromSqlInterpolated($@"
                    SELECT *
                    FROM dbo.fProjectsInProgram({dto.ProgramId}) fp
                    WHERE fp.StageName = {checkProgram.StageName}
                      AND fp.ProjectId IN (SELECT [value] FROM OPENJSON({projectIdsJson}))
                ")
                .AsNoTracking()
                .ToListAsync(); 
                var existingSet = new HashSet<string>(
                    checkProjects.Select(a => a.ProjectId),
                    StringComparer.OrdinalIgnoreCase
                );
                var MissingProjectIds = projectIds
                    .Where(x => !existingSet.Contains(x))
                    .ToArray();
                if (existingSet.Count() > 0)
                {
                    HashSet<int> RevisionIds = checkProjects.Select(p => p.Id!).ToHashSet();
                    var projectsToUpdate = await _db.tProjectRevisions
                        .Where(ps => RevisionIds.Contains(ps.Id))
                        .ToListAsync();
                    foreach (var projectStage in projectsToUpdate)
                    {
                        projectStage.IsDeleted = true;
                    }
                    _db.tProjectRevisions.UpdateRange(projectsToUpdate);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"The selected projects have been excluded from automatic publication to PCMA.\n\nList of missing Projects:{string.Join("\n", MissingProjectIds)}.",
                        Title = "Restrict Publishing Successful"
                    });
                }
                var notExisting = projectIds
                    .Where(x => !existingSet.Contains(x))
                    .ToArray();

                return Ok(new
                {
                    Message = "The selected projects have been excluded from automatic publication to PCMA.",
                    Title = "Restrict Publishing Successful"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> BatchAddExistingProject([FromBody] BatchAddExistingProjectDTO dto)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                var checkProgram = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(x => x.ProgramId == dto.ProgramId);
                if (checkProgram == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Program ID '{dto.ProgramId}' does not exist in the Programs table. Please contact administrator.", Title = "Program not found" });
                }
                var ValidateProgramId = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramId,
                    StageName = checkProgram.StageName,
                    _Session = _Session
                });
                if (!ValidateProgramId.IsValid)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = ValidateProgramId.Title,
                        Message = ValidateProgramId.Message
                    });
                }
                var ProgramParent = ValidateProgramId.Data.Program;
                var ProgramRevisions = ValidateProgramId.Data.ProgramRevision;
                var ProgramStage = ValidateProgramId.Data.ProgramStage;
                char[] delimiters = { ';', ',', '.', '&', ' ', '\n' };
                var projectIds = dto.ProjectIds
                    .Split(delimiters, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .ToArray();

                // Resolve the revision IDs that belong to this program across all of its stages
                // via tProjectStages, so we can restore projects regardless of which stage they were deleted on.
                var stageRevisionIds = await _db.tProjectStages
                    .AsNoTracking()
                    .Where(x => x.ProgramId == dto.ProgramId)
                    .Select(x => x.RevisionId)
                    .ToListAsync();

                // Find deleted revisions whose ProjectId matches the supplied list
                var projectsToRestore = await _db.tProjectRevisions
                    .Where(x => stageRevisionIds.Contains(x.Id)
                             && x.IsDeleted
                             && projectIds.Contains(x.ProjectId))
                    .ToListAsync();

                var restoredSet = new HashSet<string>(
                    projectsToRestore.Select(x => x.ProjectId),
                    StringComparer.OrdinalIgnoreCase
                );
                var missingProjectIds = projectIds
                    .Where(x => !restoredSet.Contains(x))
                    .ToArray();

                if (projectsToRestore.Count > 0)
                {
                    foreach (var revision in projectsToRestore)
                    {
                        revision.IsDeleted = false;
                    }
                    _db.tProjectRevisions.UpdateRange(projectsToRestore);
                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(new
                    {
                        Message = $"The selected projects have been successfully restored to their original stage.\n\nList of projects not found or already active:{string.Join("\n", missingProjectIds)}.",
                        Title = "Restore Projects Successful"
                    });
                }

                return new BadRequestObjectResult(new
                {
                    Message = "No deleted projects were found matching the provided IDs. They may already be active or do not belong to this program.",
                    Title = "No Projects Restored"
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