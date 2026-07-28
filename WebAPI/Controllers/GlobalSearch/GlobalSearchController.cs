using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using OfficeOpenXml;
using System.Text.Json;
namespace WebAPI.Controllers.GlobalSearch
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class GlobalSearchController : CoreController
    {
        public GlobalSearchController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma) : base(db, producer, pcma) { }

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
                if (dto.Category == "Alternate ID")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
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
                            revision.ProjectFK,
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

                    var selectedRevisions = await _db.fProjectStages
                        .FromSqlInterpolated($"""
                            SELECT DISTINCT result.*
                            FROM OPENJSON({filtersJson})
                            WITH
                            (
                                ProjectFK uniqueidentifier '$.ProjectFK',
                                StageId int '$.StageId'
                            ) filter
                            CROSS APPLY dbo.fProjectStages(
                                filter.ProjectFK,
                                filter.StageId
                            ) result
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions} project/s found." });
                }
                if (dto.Category == "Description")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
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
                            revision.ProjectFK,
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

                    var selectedRevisions = await _db.fProjectStages
                        .FromSqlInterpolated($"""
                            SELECT DISTINCT result.*
                            FROM OPENJSON({filtersJson})
                            WITH
                            (
                                ProjectFK uniqueidentifier '$.ProjectFK',
                                StageId int '$.StageId'
                            ) filter
                            CROSS APPLY dbo.fProjectStages(
                                filter.ProjectFK,
                                filter.StageId
                            ) result
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions} project/s found." });
                }
                if (dto.Category == "Program Name")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
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
                            revision.ProgramFK,
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

                    var selectedRevisions = await _db.fProgramStages
                        .FromSqlInterpolated($"""
                            SELECT DISTINCT result.*
                            FROM OPENJSON({filtersJson})
                            WITH
                            (
                                ProgramFK uniqueidentifier '$.ProgramFK',
                                StageId int '$.StageId'
                            ) filter
                            CROSS APPLY dbo.fProgramStages(
                                filter.ProjectFK,
                                filter.StageId
                            ) result
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions} project/s found." });
                }
                if (dto.Category == "Project ID")
                {
                    if (dto.SearchFor.Length <= 7)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
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
                            revision.ProjectFK,
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

                    var selectedRevisions = await _db.fProjectStages
                        .FromSqlInterpolated($"""
                            SELECT DISTINCT result.*
                            FROM OPENJSON({filtersJson})
                            WITH
                            (
                                ProjectFK uniqueidentifier '$.ProjectFK',
                                StageId int '$.StageId'
                            ) filter
                            CROSS APPLY dbo.fProjectStages(
                                filter.ProjectFK,
                                filter.StageId
                            ) result
                        """)
                        .AsNoTracking()
                        .ToListAsync(cancellationToken);
                    return Ok(new { Data = selectedRevisions, Title = $"{selectedRevisions} project/s found." });
                }
                if (dto.Category == "Bridge")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var Bridges = await _db.tFutureBridge.Where(x => x.BridgeId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = Bridges, Title = $"{Bridges.Count} bridge/s found." });
                }
                if (dto.Category == "Road Sections")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
                            Title = "Invalid Search"
                        });
                    }
                    var RoadSections = await _db.tFutureRoadSections.Where(x => x.RoadSectionId.Contains(dto.SearchFor) || x.RoadId.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = RoadSections, Title = $"{RoadSections.Count} road section/s found." });
                }
                if (dto.Category == "Roads")
                {
                    if (dto.SearchFor.Length <= 3)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"{dto.Category} must contain at least 4 characters.",
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