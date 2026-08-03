
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views;
using Helpers;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Scaffolding.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using OfficeOpenXml;
using System.Data.SqlClient;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml;
using WebAPI.Controllers.Projects;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Lumpsum
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class LumpsumController : CoreController
    {
        public LumpsumController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma) : base(db, hub, pcma) { }

        [HttpPost]
        public async Task<IActionResult> ShowLumpsum([FromBody] ShowProjectStagesDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                return Ok(new
                {
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}