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
namespace WebAPI.Controllers.GlobalSearch
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class GlobalSearchController : CoreController
    {
        public GlobalSearchController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
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
        public async Task<IActionResult> Search([FromBody] SearchDTO dto)
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
                var CheckCategory = await _db.tOptionGlobalSearch.FirstOrDefaultAsync(x => x.CategoryName == dto.Category);
                if (CheckCategory == null) {
                    return new BadRequestObjectResult(new { Message = $"Category '{dto.Category}' not found", Title = "Invalid Category" });
                }
                if(dto.Category == "Alternate ID")
                {
                    var Projects = await _db.vProjectPerStages.Where(x => x.AlternateId.Contains(dto.SearchFor)).ToListAsync();
                    return Ok( new { Data = Projects, Title = $"{Projects.Count} project/s found." });
                }
                if (dto.Category == "Description")
                {
                    var Projects = await _db.vProjectPerStages.Where(x => x.Description.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = Projects, Title = $"{Projects.Count} project/s found." });
                }
                if (dto.Category == "Program Name") 
                {
                    var Programs = await _db.vProgramDetails.Where(x => x.Name.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = Programs, Title = $"{Programs.Count} program/s found." });
                }
                if(dto.Category == "Project ID")
                {
                    var Projects = await _db.vProjectPerStages.Where(x => x.ProjectId.Contains(dto.SearchFor)).ToListAsync();
                    return Ok( new { Data = Projects, Title = $"{Projects.Count} project/s found." });
                }
                if (dto.Category == "Bridge")
                {
                    var Bridges = await _db.tFutureBridge.Where(x => x.BridgeId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync();
                    return Ok(new { Data = Bridges, Title = $"{Bridges.Count} bridge/s found." });
                }
                if (dto.Category == "Road Sections")
                {
                    var RoadSections = await _db.tFutureRoadSections.Where(x => x.RoadSectionId.Contains(dto.SearchFor) || x.RoadId.Contains(dto.SearchFor)).ToListAsync();
                    return Ok( new { Data = RoadSections, Title = $"{RoadSections.Count} road section/s found." });
                }
                if(dto.Category == "Roads")
                {
                    var Roads = await _db.tFutureRoads.Where(x => x.RoadId.Contains(dto.SearchFor) || x.Name.Contains(dto.SearchFor)).ToListAsync();
                    return Ok( new { Data = Roads, Title = $"{Roads.Count} road/s found." });
                }
                if(dto.Category == "UACS")
                {
                    //var Projects = await _db.vProjectPerStages.Where(x => x.UAC.Contains(dto.SearchFor)).ToListAsync();
                    return Ok( new { Message = "Coming soon...", Title = "Coming soon..." });
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