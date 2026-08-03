using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
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
        public GlobalSearchController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma) : base(db, hub, pcma) { }

        [HttpPost]
        public async Task<IActionResult> GetSearchCategory()
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
                var Category = await _db.tOptionGlobalSearch.ToListAsync();
                return Ok(new { CategoryList = Category });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        [AllowAnonymous]
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
                    var filters = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.AlternateId != null &&
                              revision.AlternateId.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);

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
                        .FromSqlInterpolated($"""
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
                            ON filter.ProjectPK = result.ProjectPK
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions.Count} project/s found." });
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
                    var filters = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.Description != null &&
                              revision.Description.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);

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
                        .FromSqlInterpolated($"""
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
                            ON filter.ProjectPK = result.ProjectPK
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions.Count} project/s found." });
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
                    var filters = await (
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
                    var filters = await (
                        from revision in _db.tProjectRevisions.AsNoTracking()
                        join stage in _db.tProjectStages.AsNoTracking()
                            on revision.Id equals stage.RevisionId
                        where revision.ProjectId != null &&
                              revision.ProjectId.Contains(dto.SearchFor)
                        select new
                        {
                            ProjectPK = revision.ProjectFK,
                            stage.StageId
                        })
                        .Distinct()
                        .ToListAsync(cancellationToken);

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
                        .FromSqlInterpolated($"""
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
                            ON filter.ProjectPK = result.ProjectPK
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions.Count} project/s found." });
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
                    var Bridges = await _db.tFutureBridge.Where(x => x.BridgeId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync();
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
                    var RoadSections = await _db.tFutureRoadSections.Where(x => x.RoadSectionId.Contains(dto.SearchFor) || x.RoadId.Contains(dto.SearchFor)).ToListAsync();
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
                    var Roads = await _db.tFutureRoads.Where(x => x.RoadId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = Roads, Title = $"{Roads.Count} road/s found." });
                }
                return new BadRequestObjectResult(new { Message = $"Search for category '{dto.Category}' is not implemented yet.", Title = "Not Implemented" });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}