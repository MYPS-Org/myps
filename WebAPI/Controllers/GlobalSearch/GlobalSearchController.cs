using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using OfficeOpenXml;
using System.Data;
using System.Text.Json;
using WebAPI.MicroService;

namespace WebAPI.Controllers.GlobalSearch
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class GlobalSearchController : CoreController
    {
        public GlobalSearchController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler)
        : base(
            db,
            hub,
            pcma,
            exceptionHandler)
        { }

        // fProjectDetails/vProjects store Region as the raw admin-area ParticipantId (e.g. "R3"),
        // same as everywhere else project data flows (see ProjectDetailsForm.tsx's Region dropdown,
        // which maps ParticipantId -> Name) -- there's no separate "RegionName" field like the other
        // coded columns (Category/Thrust/Origin/Agency) get, so callers must resolve it themselves
        // before it reaches the FE.
        private async Task<Dictionary<string, string>> GetRegionNamesAsync(CancellationToken cancellationToken)
        {
            return await _db.tOptionAdminAreaRegion.AsNoTracking()
                .ToDictionaryAsync(r => r.ParticipantId, r => r.Name, cancellationToken);
        }

        /// <summary>A matched project stage, as fProjectDetails reads it (serialized into @Filters).</summary>
        private sealed record ProjectStageKey(string ProjectPK, EnumProgramStage StageId);

        // 2026-10-30: the project categories returned every matching stage, so an Apply Filter (or DPC/RPC)
        // user could read other regions' projects here. Keeps only the stages the user may open -- the
        // per-stage project view gate ShowProjectDetails applies -- before fProjectDetails reads them.
        private async Task<List<ProjectStageKey>> KeepViewableStagesAsync(
            List<(string ProjectPK, EnumProgramStage StageId, int RevisionId)> matches, CancellationToken cancellationToken)
        {
            var viewable = await _db.GetViewableStagesByProjectAsync(
                _Session, matches.Select(x => x.ProjectPK).Distinct(StringComparer.OrdinalIgnoreCase).ToList(), cancellationToken);
            return matches
                .Where(x => viewable == null || viewable[x.ProjectPK].Any(s => s.RevisionId == x.RevisionId))
                .Select(x => new ProjectStageKey(x.ProjectPK, x.StageId))
                .Distinct()
                .ToList();
        }

        // 2026-10-30: the same gate for the UACS rows, which carry ProjectId and StageName instead of the
        // ProjectPK and stage revision the gate keys on.
        private async Task<List<DBHelper.Models.Views.Project.Projects>> KeepViewableProjectRowsAsync(
            List<DBHelper.Models.Views.Project.Projects> rows, CancellationToken cancellationToken)
        {
            if (rows.Count == 0)
            {
                return rows;
            }
            var projectIds = rows.Select(x => x.ProjectId).Distinct().ToList();
            var projectPKsById = (await _db.tProjectRevisions.AsNoTracking()
                    .Where(x => projectIds.Contains(x.ProjectId))
                    .Select(x => new { x.ProjectId, x.ProjectFK })
                    .Distinct()
                    .ToListAsync(cancellationToken))
                .ToLookup(x => x.ProjectId, x => x.ProjectFK, StringComparer.OrdinalIgnoreCase);
            var viewable = await _db.GetViewableStagesByProjectAsync(
                _Session, projectPKsById.SelectMany(x => x).Distinct(StringComparer.OrdinalIgnoreCase).ToList(), cancellationToken);
            if (viewable == null)
            {
                return rows;
            }
            return rows
                .Where(row => projectPKsById[row.ProjectId].Any(pk =>
                    viewable[pk].Any(s => string.Equals(s.StageName, row.StageName, StringComparison.OrdinalIgnoreCase))))
                .ToList();
        }

        [HttpPost]
        public async Task<IActionResult> GetSearchCategory(CancellationToken cancellationToken)
        {
            try
            {
                /*
                ('Alternate ID'),
                ('Bridge'),
                ('Description'),
                ('Program Name'),
                ('Project ID'),
                ('Road Sections'),
                ('Roads'),
                ('UACS');
                 */
                var Category = await _db.tOptionGlobalSearch.ToListAsync(cancellationToken);
                return Ok(new { CategoryList = Category });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }
        [HttpPost]
        public async Task<IActionResult> Search([FromBody] SearchDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                /*
                ('Alternate ID'),
                ('Bridge'),
                ('Description'),
                ('Program Name'),
                ('Project ID'),
                ('Road Sections'),
                ('Roads'),
                ('UACS');
                 */
                var CheckCategory = await _db.tOptionGlobalSearch.FirstOrDefaultAsync(x => x.CategoryName == dto.Category, cancellationToken);
                if (CheckCategory == null)
                {
                    return new BadRequestObjectResult(new { Message = $"Category '{dto.Category}' not found.", Title = "Invalid Category" });
                }
                int SearchLength = 3;
                if (dto.Category == "Alternate ID")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var matches = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.AlternateId != null &&
                              revision.AlternateId.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId,
                            stage.RevisionId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);
                    var filters = await KeepViewableStagesAsync(
                        matches.Select(x => (x.ProjectPK, x.StageId, x.RevisionId)).ToList(), cancellationToken);

                    if (filters.Count == 0)
                    {
                        return Ok(new
                        {
                            Data = new List<DBHelper.Models.Functions.Project.ProjectStages>(),
                            Title = "0 project/s found."
                        });
                    }

                    var filtersJson = JsonSerializer.Serialize(filters);

                    var filtersParameter = new Microsoft.Data.SqlClient.SqlParameter(
                        "@Filters",
                        SqlDbType.NVarChar,
                        -1)
                    {
                        Value = filtersJson
                    };

                    var selectedRevisions = await _db.fProjectDetails
                        .FromSqlRaw($"""
                        IF ISJSON(@Filters) <> 1
                        BEGIN
                            THROW 50001, 'The supplied project-stage filter is not valid JSON.', 1;
                        END;

                        ;WITH ParsedFilters AS
                        (
                            SELECT
                                LTRIM(RTRIM(ProjectPK)) AS ProjectPK,
                                StageId
                            FROM OPENJSON(@Filters)
                            WITH
                            (
                                ProjectPK nvarchar(200) '$.ProjectPK',
                                StageId   int           '$.StageId'
                            )
                        ),
                        ValidFilters AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ParsedFilters
                            WHERE NULLIF(ProjectPK, N'') IS NOT NULL
                                AND StageId IS NOT NULL
                        ),
                        DistinctProjects AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ValidFilters
                        )
                        SELECT DISTINCT
                            result.*
                        FROM DistinctProjects AS project
                        CROSS APPLY dbo.fProjectDetails(project.ProjectPK, project.StageId) AS result
                        INNER JOIN ValidFilters AS filter
                            ON filter.ProjectPK = result.ProjectFK
                        """,
                            filtersParameter)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    var regionNames = await GetRegionNamesAsync(cancellationToken);
                    var Result = selectedRevisions.Select(x => new
                    {
                        x.ProjectId,
                        x.AlternateId,
                        x.Description,
                        x.StageName,
                        Region = x.Region != null && regionNames.TryGetValue(x.Region, out var regionName) ? regionName : x.Region
                    }).ToList();
                    return Ok(new { Data = Result, Title = $"{Result.Count} project/s found." });
                }
                if (dto.Category == "Description")
                {
                    SearchLength = 4;
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var matches = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.Description != null &&
                              revision.Description.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId,
                            stage.RevisionId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);
                    var filters = await KeepViewableStagesAsync(
                        matches.Select(x => (x.ProjectPK, x.StageId, x.RevisionId)).ToList(), cancellationToken);

                    if (filters.Count == 0)
                    {
                        return Ok(new
                        {
                            Data = new List<DBHelper.Models.Functions.Project.ProjectStages>(),
                            Title = "0 project/s found."
                        });
                    }

                    var filtersJson = JsonSerializer.Serialize(filters);

                    var filtersParameter = new Microsoft.Data.SqlClient.SqlParameter(
                        "@Filters",
                        SqlDbType.NVarChar,
                        -1)
                    {
                        Value = filtersJson
                    };

                    var selectedRevisions = await _db.fProjectDetails
                        .FromSqlRaw($"""
                        IF ISJSON(@Filters) <> 1
                        BEGIN
                            THROW 50001, 'The supplied project-stage filter is not valid JSON.', 1;
                        END;

                        ;WITH ParsedFilters AS
                        (
                            SELECT
                                LTRIM(RTRIM(ProjectPK)) AS ProjectPK,
                                StageId
                            FROM OPENJSON(@Filters)
                            WITH
                            (
                                ProjectPK nvarchar(200) '$.ProjectPK',
                                StageId   int           '$.StageId'
                            )
                        ),
                        ValidFilters AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ParsedFilters
                            WHERE NULLIF(ProjectPK, N'') IS NOT NULL
                                AND StageId IS NOT NULL
                        ),
                        DistinctProjects AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ValidFilters
                        )
                        SELECT DISTINCT
                            result.*
                        FROM DistinctProjects AS project
                        CROSS APPLY dbo.fProjectDetails(project.ProjectPK, project.StageId) AS result
                        INNER JOIN ValidFilters AS filter
                            ON filter.ProjectPK = result.ProjectFK
                        """,
                            filtersParameter)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    var regionNames = await GetRegionNamesAsync(cancellationToken);
                    var Result = selectedRevisions.Select(x => new
                    {
                        x.ProjectId,
                        x.Description,
                        x.ProgramName,
                        x.StageName,
                        Region = x.Region != null && regionNames.TryGetValue(x.Region, out var regionName) ? regionName : x.Region
                    }).ToList();
                    return Ok(new { Data = Result, Title = $"{Result.Count} project/s found." });
                }
                if (dto.Category == "Program Name")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var matches = await (
                        from revision in _db.tProgramRevisions.AsNoTracking()
                        join stage in _db.tProgramStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.Name != null &&
                              revision.Name.Contains(dto.SearchFor)
                        select new
                        {
                            ProgramPK = revision.ProgramFK,
                            stage.StageId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);
                    // 2026-10-30: an Apply Filter user finds only their region's programs, by the Data
                    // Security Group rule ValidateProgramId applies when ProgramDetails opens the result.
                    var accessiblePrograms = await _db.GetAccessibleProgramPKsAsync(
                        _Session, matches.Select(x => x.ProgramPK).Distinct().ToList(), cancellationToken);
                    var filters = accessiblePrograms == null
                        ? matches
                        : matches.Where(x => accessiblePrograms.Contains(x.ProgramPK)).ToList();

                    if (filters.Count == 0)
                    {
                        return Ok(new
                        {
                            Data = new List<DBHelper.Models.Functions.Program.ProgramStages>(),
                            Title = "0 project/s found."
                        });
                    }

                    var filtersJson = JsonSerializer.Serialize(filters);

                    var filtersParameter = new Microsoft.Data.SqlClient.SqlParameter(
                        "@Filters",
                        SqlDbType.NVarChar,
                        -1)
                    {
                        Value = filtersJson
                    };

                    var selectedRevisions = await _db.fProgramDetails
                        .FromSqlRaw(
                            """
                        IF ISJSON(@Filters) <> 1
                        BEGIN
                            THROW 50001, 'The supplied program-stage filter is not valid JSON.', 1;
                        END;

                        ;WITH ParsedFilters AS
                        (
                            SELECT
                                LTRIM(RTRIM(ProgramPK)) AS ProgramPK,
                                StageId
                            FROM OPENJSON(@Filters)
                            WITH
                            (
                                ProgramPK nvarchar(200) '$.ProgramPK',
                                StageId   int           '$.StageId'
                            )
                        ),
                        ValidFilters AS
                        (
                            SELECT DISTINCT
                                ProgramPK,
                                StageId
                            FROM ParsedFilters
                            WHERE NULLIF(ProgramPK, N'') IS NOT NULL
                                AND StageId IS NOT NULL
                        ),
                        DistinctPrograms AS
                        (
                            SELECT DISTINCT
                                ProgramPK,
                                StageId
                            FROM ValidFilters
                        )
                        SELECT DISTINCT
                            result.*
                        FROM DistinctPrograms AS program
                        CROSS APPLY dbo.fProgramDetails(program.ProgramPK, program.StageId) AS result
                        INNER JOIN ValidFilters AS filter
                            ON filter.ProgramPK = result.ProgramPK
                            AND filter.StageId = result.StageId;
                        """,
                            filtersParameter)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions.Count} project/s found." });
                }
                if (dto.Category == "Project ID")
                {
                    SearchLength = 7;
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var matches = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.ProjectId != null &&
                              revision.ProjectId.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId,
                            stage.RevisionId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);
                    var filters = await KeepViewableStagesAsync(
                        matches.Select(x => (x.ProjectPK, x.StageId, x.RevisionId)).ToList(), cancellationToken);

                    if (filters.Count == 0)
                    {
                        return Ok(new
                        {
                            Data = new List<DBHelper.Models.Functions.Project.ProjectStages>(),
                            Title = "0 project/s found."
                        });
                    }

                    var filtersJson = JsonSerializer.Serialize(filters);

                    var filtersParameter = new Microsoft.Data.SqlClient.SqlParameter(
                        "@Filters",
                        SqlDbType.NVarChar,
                        -1)
                    {
                        Value = filtersJson
                    };

                    var selectedRevisions = await _db.fProjectDetails
                        .FromSqlRaw($"""
                        IF ISJSON(@Filters) <> 1
                        BEGIN
                            THROW 50001, 'The supplied project-stage filter is not valid JSON.', 1;
                        END;

                        ;WITH ParsedFilters AS
                        (
                            SELECT
                                LTRIM(RTRIM(ProjectPK)) AS ProjectPK,
                                StageId
                            FROM OPENJSON(@Filters)
                            WITH
                            (
                                ProjectPK nvarchar(200) '$.ProjectPK',
                                StageId   int           '$.StageId'
                            )
                        ),
                        ValidFilters AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ParsedFilters
                            WHERE NULLIF(ProjectPK, N'') IS NOT NULL
                                AND StageId IS NOT NULL
                        ),
                        DistinctProjects AS
                        (
                            SELECT DISTINCT
                                ProjectPK,
                                StageId
                            FROM ValidFilters
                        )
                        SELECT DISTINCT
                            result.*
                        FROM DistinctProjects AS project
                        CROSS APPLY dbo.fProjectDetails(project.ProjectPK, project.StageId) AS result
                        INNER JOIN ValidFilters AS filter
                            ON filter.ProjectPK = result.ProjectFK
                        """,
                            filtersParameter)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    var regionNames = await GetRegionNamesAsync(cancellationToken);
                    var Result = selectedRevisions.Select(x => new
                    {
                        x.ProjectId,
                        x.Description,
                        x.ProgramName,
                        x.StageName,
                        Region = x.Region != null && regionNames.TryGetValue(x.Region, out var regionName) ? regionName : x.Region
                    }).ToList();
                    return Ok(new { Data = Result, Title = $"{Result.Count} project/s found." });
                }
                if (dto.Category == "UACS")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    // vProjects already carries ProjectId/Description/ProgramName/StageName/Region/UACS
                    // in one row, unlike the tProjectRevisions+tProjectStages join the other project
                    // categories use -- no cross-apply to fProjectDetails needed here.
                    var Projects = await KeepViewableProjectRowsAsync(
                        await _db.vProjects.AsNoTracking()
                            .Where(x => x.UACS != null && x.UACS.Contains(dto.SearchFor))
                            .ToListAsync(cancellationToken),
                        cancellationToken);
                    var regionNames = await GetRegionNamesAsync(cancellationToken);
                    var Result = Projects.Select(x => new
                    {
                        x.ProjectId,
                        x.UACS,
                        x.Description,
                        x.StageName,
                        Region = x.Region != null && regionNames.TryGetValue(x.Region, out var regionName) ? regionName : x.Region
                    }).ToList();
                    return Ok(new { Data = Result, Title = $"{Result.Count} project/s found." });
                }
                if (dto.Category == "Bridge")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var Bridges = await _db.tFutureBridge.Where(x => x.BridgeId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync(cancellationToken);
                    return Ok(new { Data = Bridges, Title = $"{Bridges.Count} bridge/s found." });
                }
                if (dto.Category == "Road Sections")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    // RegionParticipantId is a raw admin-area code (e.g. "R3"), not a display name --
                    // resolve it against tOptionAdminAreaRegion the same way ProjectController/
                    // ReportingController do, instead of returning the code as-is.
                    var RoadSections = await (
                        from rs in _db.tFutureRoadSections.AsNoTracking()
                        where rs.RoadSectionId.Contains(dto.SearchFor) || rs.RoadId.Contains(dto.SearchFor)
                        join region in _db.tOptionAdminAreaRegion.AsNoTracking()
                            on rs.RegionParticipantId equals region.ParticipantId into regionJoin
                        from region in regionJoin.DefaultIfEmpty()
                        select new
                        {
                            rs.RoadSectionId,
                            rs.RoadId,
                            rs.LengthM,
                            Region = region != null ? region.Name : null
                        })
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = RoadSections, Title = $"{RoadSections.Count} road section/s found." });
                }
                if (dto.Category == "Roads")
                {
                    if (dto.SearchFor.Length <= SearchLength)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least {SearchLength + 1} characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var Roads = await _db.tFutureRoads.Where(x => x.RoadId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync(cancellationToken);
                    return Ok(new { Data = Roads, Title = $"{Roads.Count} road/s found." });
                }
                return new BadRequestObjectResult(new { Message = $"Search for category '{dto.Category}' is not implemented yet.", Title = "Not Implemented" });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
    }
}