using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Endpoints;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
namespace WebAPI.Controllers.CodeTable
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class CodeTableController : CoreController
    {
        public CodeTableController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> GetAllCodeTables()
        {
            try
            {
                var CodeTableLists = await _db.tOptionCodeTables.AsNoTracking().ToListAsync();

                //Program
                var programStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync();
                var programStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync();
                var programTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync();

                //Project
                var projectCategories = await _db.tOptionProjectCategory.AsNoTracking().ToListAsync();
                var projectThrusts = await _db.tProjectThrustLists.AsNoTracking().ToListAsync();
                var projectAgencies = await _db.tOptionProjectAgency.AsNoTracking().ToListAsync();
                var projectOrigins = await _db.tOptionProjectOrigin.AsNoTracking().ToListAsync();

                var Agreements = await _db.tOptionFundingAgreement.AsNoTracking().ToListAsync();
                var Sources = await _db.tOptionFundingSource.AsNoTracking().ToListAsync();
                var scopeOfWorks = await _db.tOptionScopeOfWork.AsNoTracking().ToListAsync();
                var infraTypes = await _db.tOptionInfraType.AsNoTracking().ToListAsync();
                var projectComponents = await _db.tOptionProjectComponent.AsNoTracking().ToListAsync();

                //Revision
                var revisionHeaders = await _db.tOptionRevisionHeader.AsNoTracking().ToListAsync();
                var revisionCategories = await _db.tOptionRevisionCategory.AsNoTracking().ToListAsync();
                var reasons = await _db.tOptionRevisionReasons.AsNoTracking().ToListAsync();
                var revisionRules = await _db.vRevisionRules.AsNoTracking().ToListAsync();
                var revisionDocuments = await _db.tOptionRevisionDocuments.AsNoTracking().ToListAsync();
                var revisionStatuses = await _db.tOptionRevisionStatus.AsNoTracking().ToListAsync();

                return Ok(new
                {
                    CodeTable = CodeTableLists,
                    ProgramStages = programStages,
                    ProgramStatuses = programStatuses,
                    ProgramTypes = programTypes,
                    ProjectCategories = projectCategories,
                    ProjectThrusts = projectThrusts,
                    ProjectAgencies = projectAgencies,
                    ProjectOrigins = projectOrigins,
                    FundingAgreements = Agreements,
                    FundingSources = Sources,
                    ScopeOfWorks = scopeOfWorks,
                    InfraTypes = infraTypes,
                    ProjectComponents = projectComponents,
                    RevisionCategories = revisionCategories,
                    RevisionDocuments = revisionDocuments,
                    RevisionHeaders = revisionHeaders,
                    Reasons = reasons,
                    RevisionStatuses = revisionStatuses,
                    RevisionRules = revisionRules
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> GetAllCodeTablesv2()
        {
            try
            {
                //Program
                string tablename = "tOptionProgramStage";
                var programStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync();
                var programStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync();
                var programTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync();

                //Project
                var projectCategories = await _db.tOptionProjectCategory.AsNoTracking().ToListAsync();
                var projectThrusts = await _db.tProjectThrustLists.AsNoTracking().ToListAsync();
                var projectAgencies = await _db.tOptionProjectAgency.AsNoTracking().ToListAsync();
                var projectOrigins = await _db.tOptionProjectOrigin.AsNoTracking().ToListAsync();

                var Agreements = await _db.tOptionFundingAgreement.AsNoTracking().ToListAsync();
                var Sources = await _db.tOptionFundingSource.AsNoTracking().ToListAsync();
                var scopeOfWorks = await _db.tOptionScopeOfWork.AsNoTracking().ToListAsync();
                var infraTypes = await _db.tOptionInfraType.AsNoTracking().ToListAsync();
                var projectComponents = await _db.tOptionProjectComponent.AsNoTracking().ToListAsync();

                //Revision
                var revisionCategories = await _db.tOptionRevisionCategory.AsNoTracking().ToListAsync();
                var revisionDocuments = await _db.tOptionRevisionDocuments.AsNoTracking().ToListAsync();
                var revisionHeaders = await _db.tOptionRevisionHeader.AsNoTracking().ToListAsync();
                var reasons = await _db.tOptionRevisionReasons.AsNoTracking().ToListAsync();
                var revisionStatuses = await _db.tOptionRevisionStatus.AsNoTracking().ToListAsync();
                var revisionRules = await _db.vRevisionRules.AsNoTracking().ToListAsync();

                return Ok(new
                {
                    ProgramStages = programStages,
                    ProgramStatuses = programStatuses,
                    ProgramTypes = programTypes,
                    ProjectCategories = projectCategories,
                    ProjectThrusts = projectThrusts,
                    ProjectAgencies = projectAgencies,
                    ProjectOrigins = projectOrigins,
                    FundingAgreements = Agreements,
                    FundingSources = Sources,
                    ScopeOfWorks = scopeOfWorks,
                    InfraTypes = infraTypes,
                    ProjectComponents = projectComponents,
                    RevisionCategories = revisionCategories,
                    RevisionDocuments = revisionDocuments,
                    RevisionHeaders = revisionHeaders,
                    Reasons = reasons,
                    RevisionStatuses = revisionStatuses,
                    RevisionRules = revisionRules
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
    }
}