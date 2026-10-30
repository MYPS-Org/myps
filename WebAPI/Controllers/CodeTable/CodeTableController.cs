using Microsoft.AspNetCore.SignalR;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Table.AdminAreas;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Lookups.Project;
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
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Transactions;
using System.Xml;
using WebAPI.MicroService;
using DBHelper.Models.Table.Revision;
namespace WebAPI.Controllers.CodeTable
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class CodeTableController : CoreController
    {
        public CodeTableController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        [HttpPost]
        public async Task<IActionResult> GetAllCodeTables(CancellationToken cancellationToken)
        {
            try
            {
                var CodeTableLists = await _db.tOptionCodeTables.AsNoTracking().ToListAsync(cancellationToken);

                //Program
                var programStages = await _db.tOptionProgramStage.AsNoTracking().ToListAsync(cancellationToken);
                var programStatuses = await _db.tOptionProgramStatus.AsNoTracking().ToListAsync(cancellationToken);
                var programTypes = await _db.tOptionProgramType.AsNoTracking().ToListAsync(cancellationToken);

                //Project
                var projectCategories = await _db.tOptionProjectCategory.AsNoTracking().ToListAsync(cancellationToken);
                var projectThrusts = await _db.tOptionProjectThrustList.AsNoTracking().ToListAsync(cancellationToken);
                var projectAgencies = await _db.tOptionProjectAgency.AsNoTracking().ToListAsync(cancellationToken);
                var projectOrigins = await _db.tOptionProjectOrigin.AsNoTracking().ToListAsync(cancellationToken);

                var Agreements = await _db.tOptionFundingAgreement.AsNoTracking().ToListAsync(cancellationToken);
                var Sources = await _db.tOptionFundingSource.AsNoTracking().ToListAsync(cancellationToken);
                var scopeOfWorks = await _db.tOptionScopeOfWork.AsNoTracking().ToListAsync(cancellationToken);
                var infraTypes = await _db.tOptionInfraType.AsNoTracking().ToListAsync(cancellationToken);
                var projectComponents = await _db.tOptionProjectComponentType.AsNoTracking().ToListAsync(cancellationToken);

                //Revision
                var revisionHeaders = await _db.tOptionRevisionHeader.AsNoTracking().ToListAsync(cancellationToken);
                var revisionCategories = await _db.tOptionRevisionCategory.AsNoTracking().ToListAsync(cancellationToken);
                var reasons = await _db.tOptionRevisionReasons.AsNoTracking().ToListAsync(cancellationToken);
                var revisionRules = await (
                    from rule in _db.tRevisionRules.AsNoTracking()
                    join reason in _db.tOptionRevisionReasons.AsNoTracking()
                        on rule.ReasonId equals reason.ReasonId
                    where rule.IsActive
                    select new DBHelper.Models.Views.RevisionRules
                    {
                        Id = rule.Id,
                        Reason = reason.Reason,
                        RevisionGroupId = reason.RevisionGroupId,
                        ReasonId = rule.ReasonId,
                        PCMA_Status = rule.PCMA_Status,
                        Package_Status = rule.Package_Status,
                        Field = rule.Field,
                        IsActive = rule.IsActive
                    })
                    .ToListAsync(cancellationToken);
                var revisionDocuments = await _db.tOptionRevisionDocuments.AsNoTracking().ToListAsync(cancellationToken);
                var revisionStatuses = await _db.tOptionRevisionStatus.AsNoTracking().ToListAsync(cancellationToken);
                // S04-TC016 (2026-10-30): empty until the migration creates the table.
                var revisionValidationDates = await _db.ListValidationWindowsAsync(cancellationToken);

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
                    RevisionRules = revisionRules,
                    RevisionValidationDates = revisionValidationDates
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> GetAdminAreas(CancellationToken cancellationToken)
        {
            try
            {
                var regions = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var cities = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
                var deos = await _db.vAdminDEO.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

                return Ok(new
                {
                    Regions = regions,
                    Provinces = provinces,
                    Cities = cities,
                    Districts = districts,
                    DEOs = deos
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }


        [HttpPost]
        public async Task<IActionResult> GetTransactionLog([FromBody] GetTransactionLogDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                string AffectedTable = string.Empty;
                switch (dto.TableCode)
                {
                    case "ProgramStage":
                        AffectedTable = "tOptionProgramStage";
                        break;
                    case "ProgramStatus":
                        AffectedTable = "tOptionProgramStatus";
                        break;
                    case "ProgramType":
                        AffectedTable = "tOptionProgramType";
                        break;
                    case "ProjectCategory":
                        AffectedTable = "tOptionProjectCategory";
                        break;
                    case "ProjectThrust":
                        AffectedTable = "tOptionProjectThrustList";
                        break;
                    case "ProjectAgency":
                        AffectedTable = "tOptionProjectAgency";
                        break;
                    case "ProjectOrigin":
                        AffectedTable = "tOptionProjectOrigin";
                        break;
                    case "FundingAgreement":
                        AffectedTable = "tOptionFundingAgreement";
                        break;
                    case "FundingSource":
                        AffectedTable = "tOptionFundingSource";
                        break;
                    case "ProjectScopeOfWork":
                        AffectedTable = "tOptionScopeOfWork";
                        break;
                    case "ProjectInfraType":
                        AffectedTable = "tOptionInfraType";
                        break;
                    case "ProjectComponent":
                        AffectedTable = "tOptionProjectComponentType";
                        break;
                    case "RevisionHeader":
                        AffectedTable = "tOptionRevisionHeader";
                        break;
                    case "RevisionCategory":
                        AffectedTable = "tOptionRevisionCategory";
                        break;
                    case "RevisionReasons":
                        AffectedTable = "tOptionRevisionReasons";
                        break;
                    case "RevisionRules":
                        AffectedTable = "tRevisionRules";
                        break;
                    case "RevisionDocuments":
                        AffectedTable = "tOptionRevisionDocuments";
                        break;
                    case "RevisionStatus":
                        AffectedTable = "tOptionRevisionStatus";
                        break;
                    case "RevisionValidationDates":
                        AffectedTable = "tOptionRevisionValidationDate";
                        break;
                    case "AdminAreaRegion":
                        AffectedTable = "tOptionAdminAreaRegion";
                        break;
                    case "AdminAreaProvince":
                        AffectedTable = "tOptionAdminAreaProvince";
                        break;
                    case "AdminAreaCity":
                        AffectedTable = "tOptionAdminAreaCityMunicipality";
                        break;
                    case "AdminAreaDistrict":
                        AffectedTable = "tOptionAdminAreaCongressionalDistrict";
                        break;
                    case "AdminAreaDEO":
                        AffectedTable = "tOptionAdminOffice";
                        break;
                }
                var CodeTableLists = await _db.tCodeTableTransactionLog.Where(x => x.AffectedTable == AffectedTable).ToListAsync(cancellationToken);
                return Ok(new
                {
                    Logs = CodeTableLists,
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        private static IActionResult AamsOnlyLinkEditable(string what, string link) => new BadRequestObjectResult(new
        {
            Title = "Maintained in AAMS",
            Message = $"{what} are maintained in AAMS: they cannot be added, renamed or deleted in MYPS. Only the {link} link can be changed."
        });

        [HttpPost]
        public async Task<IActionResult> UpdateCodeTable([FromBody] UpdateCodeTableDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                //Program
                CodeTableChangeLog transactionLog = new CodeTableChangeLog();
                string tablename = "";
                DateTime CurrentDate = Functions.CurrentDate();

                string hostName = User.FindFirstValue(ClaimTypes.GivenName) ?? "Unknown";
                string userId = _Session.UserId ?? "Unknown";
                string timestamp = CurrentDate.ToString("yyyyMMddHHmmssfff");
                transactionLog.TransactionId = $"{hostName}_{userId}_{timestamp}";
                transactionLog.TypeOfTransaction = dto.TransactionType.ToString();
                transactionLog.CreatedDate = CurrentDate;
                transactionLog.CreatedBy = _Session.UserId!;

                // 2026-10-29 (S04): IsActive is a bool, so a request without it read as false, and every
                // branch below copied it: an edit form without the Active switch (Origin's) silently
                // retired the row, and an add created it Inactive. Now an update changes IsActive only
                // when the request sends it, and a new row without it is created Active, as the Code
                // Tables screens promise.
                bool sentIsActive = false;
                if (!string.IsNullOrWhiteSpace(dto.Json) && Newtonsoft.Json.Linq.JToken.Parse(dto.Json) is Newtonsoft.Json.Linq.JObject payload)
                {
                    sentIsActive = payload.Properties().Any(p => string.Equals(p.Name, "IsActive", StringComparison.OrdinalIgnoreCase));
                    if (!sentIsActive && dto.TransactionType == CodeTransactionType.Create)
                    {
                        payload["IsActive"] = true;
                        dto.Json = payload.ToString(Newtonsoft.Json.Formatting.None);
                    }
                }

                // 2026-10-29: new ids (CategoryId, NameId, Enum, ReasonId, ...) are MAX + 1, read under
                // READ COMMITTED: two admins adding to one table at the same moment got the same id, or a
                // unique-key error. One add per table at a time; released with this transaction.
                if (dto.TransactionType == CodeTransactionType.Create)
                {
                    string LockResource = $"CodeTable:{dto.Code}";
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"EXEC sp_getapplock @Resource = {LockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000",
                        cancellationToken);
                }

                if (dto.Code == "ProgramStage")
                {
                    tablename = "Program Stage";
                    transactionLog.AffectedTable = "tOptionProgramStage";
                    var data = JsonConvert.DeserializeObject<OptionProgramStage>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Program Selected",
                            Message = "No Program has been selected, please select a program."
                        });
                    }
                    // 2026-10-29: the program stages are fixed by the system (EnumProgramStage, the stage
                    // order, the BP/P Project ID rules). A stage added here got StageHierarchy 0 and a name
                    // the app does not know, so a program at it could not be opened ("not a valid program
                    // stage"). Stages can be described, set Inactive, or deleted when unused; not added.
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stages Are Fixed",
                            Message = "Program stages are defined by the system and cannot be added. You can edit a stage's description or set it Inactive."
                        });
                    }
                    var CheckIfAlreadyUse = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.StageName == data.Name);
                    if (CheckIfAlreadyUse != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Already Exists",
                            Message = $"The program stage {data.Name} already exists, please select another program stage."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Already Exists",
                            Message = $"The program stage {data.Name} already exists, please select another program stage."
                        });
                    }

                    var CheckUpdate = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Not Found",
                            Message = $"The program stage with id {data.Id} is not found, please select another program stage."
                        });
                    }
                    // Programs store the stage by NAME (tProgramStages.StageName), so a used stage must keep
                    // its name and cannot be deleted. This used to test the incoming name: renaming a used
                    // stage slipped through, while a description fix on it was refused.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Name != data.Name)
                        && await _db.tProgramStages.AsNoTracking().AnyAsync(x => x.StageName == CheckUpdate.Name, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Already in Use",
                            Message = $"The program stage {CheckUpdate.Name} is already in use, so it cannot be renamed or deleted."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        // A typed NameId is kept if free (the test steps enter one); blank = next number.
                        if (data.NameId > 0 && await _db.tOptionProgramStage.AsNoTracking().AnyAsync(x => x.NameId == data.NameId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new { Title = "NameId Already Exists", Message = $"The NameId {data.NameId} already exists, please enter another NameId or leave it blank." });
                        }
                        if (data.NameId <= 0)
                        {
                            var CheckMaxId = _db.tOptionProgramStage.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                            data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
                        }
                        await _db.tOptionProgramStage.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name;
                            transactionLog.OldValue = CheckUpdate.Name;
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Description ?? string.Empty;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProgramStage.Update(CheckUpdate);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProgramStage.Remove(CheckUpdate!);
                    }
                }
                else if (dto.Code == "ProgramStatus")
                {
                    tablename = "Program Status";
                    transactionLog.AffectedTable = "tOptionProgramStatus";
                    var data = JsonConvert.DeserializeObject<OptionProgramStatus>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Program Status Selected",
                            Message = "No Program Status has been selected, please select a program status."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Status Already Exists",
                            Message = $"The program status {data.Name} already exists, please select another program status."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProgramStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Status Not Found",
                            Message = $"The program status with id {data.Id} is not found, please select another program status."
                        });
                    }
                    // Programs store the NameId, but the name is read back as text (vProgramLatest.Status is
                    // "Approved" / "Working"), so a used status keeps its name and cannot be deleted. Both
                    // statuses are in use, and every edit used to be refused, even a description change.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Name != data.Name)
                        && await _db.tProgramRevisions.AsNoTracking().AnyAsync(x => x.Status == (EnumProgramStatus)CheckUpdate.NameId, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Status In Use",
                            Message = "The selected program status is currently in use, so it cannot be renamed or deleted."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        // A typed NameId is kept if free (the test steps enter one); blank = next number.
                        if (data.NameId > 0 && await _db.tOptionProgramStatus.AsNoTracking().AnyAsync(x => x.NameId == data.NameId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new { Title = "NameId Already Exists", Message = $"The NameId {data.NameId} already exists, please enter another NameId or leave it blank." });
                        }
                        if (data.NameId <= 0)
                        {
                            var CheckMaxId = _db.tOptionProgramStatus.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                            data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
                        }
                        await _db.tOptionProgramStatus.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "NameId";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Description ?? string.Empty;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProgramStatus.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProgramStatus.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProgramType")
                {
                    tablename = "Program Type";
                    transactionLog.AffectedTable = "tOptionProgramType";
                    var data = JsonConvert.DeserializeObject<OptionProgramType>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Program Type Selected",
                            Message = "No Program Type has been selected, please select a program type."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Type Already Exists",
                            Message = $"The program type {data.Name} already exists, please select another program type."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Type Not Found",
                            Message = $"The program type with id {data.Id} is not found, please select another program type."
                        });
                    }
                    // tPrograms.Type is the NameId (was compared with Id, which only matches by accident).
                    // A used type keeps its name and cannot be deleted; description/active edits are fine.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Name != data.Name)
                        && await _db.tPrograms.AsNoTracking().AnyAsync(x => x.Type == (EnumProgramType)CheckUpdate.NameId, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Type In Use",
                            Message = "The selected program type is currently in use, so it cannot be renamed or deleted."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        // A typed NameId is kept if free (the test steps enter one); blank = next number.
                        if (data.NameId > 0 && await _db.tOptionProgramType.AsNoTracking().AnyAsync(x => x.NameId == data.NameId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new { Title = "NameId Already Exists", Message = $"The NameId {data.NameId} already exists, please enter another NameId or leave it blank." });
                        }
                        if (data.NameId <= 0)
                        {
                            var CheckMaxId = _db.tOptionProgramType.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                            data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
                        }
                        await _db.tOptionProgramType.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Description ?? string.Empty;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProgramType.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProgramType.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectCategory")
                {
                    tablename = "Project Category";
                    transactionLog.AffectedTable = "tOptionProjectCategory";
                    var data = JsonConvert.DeserializeObject<OptionProjectCategory>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Category Selected",
                            Message = "No Project Category has been selected, please select a project category."
                        });
                    }
                    // 2026-10-29: a blank name, or a range whose minimum is above its maximum, was saved.
                    if (dto.TransactionType != CodeTransactionType.Delete)
                    {
                        if (string.IsNullOrWhiteSpace(data.CategoryName))
                        {
                            return new BadRequestObjectResult(new { Title = "Name Required", Message = "Enter the Category name." });
                        }
                        data.CategoryName = data.CategoryName.Trim();
                        if (data.Minimum > data.Maximum)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Invalid Amount Range",
                                Message = $"Min Amount ({data.Minimum:N0}) is greater than Max Amount ({data.Maximum:N0})."
                            });
                        }
                    }
                    var CheckNameIfExists = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryName == data.CategoryName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Category Already Exists",
                            Message = $"The project category {data.CategoryName} already exists, please select another project category."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Category Not Found",
                            Message = $"The project category with id {data.Id} is not found, please select another project category."
                        });
                    }
                    // #482: an in-use category may still be retired -- set Inactive, move its Valid Until,
                    // or change its range (Minimum / Maximum only bound ProjectIds still to be minted) --
                    // since the projects that use it keep it. Only a delete or a rename (CategoryName) is
                    // refused. In use = a project or a modification request refers to the stored
                    // CategoryId. This used to refuse every update, so an in-use category could not be
                    // retired at all.
                    if (CheckUpdate != null
                        && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.CategoryName != data.CategoryName)
                        && (await _db.tProjectRevisions.AsNoTracking().AnyAsync(x => x.Category == CheckUpdate.CategoryId, cancellationToken)
                            || await _db.tRevisionProjects.AsNoTracking().AnyAsync(x => x.Category == CheckUpdate.CategoryId, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Category In Use",
                            Message = "The selected project category is currently in use, so it cannot be deleted or renamed. You can still set it Inactive or change its validity."
                        });
                    }
                    // RISK-072 fix (2026-09-19): ProjectId digits (D5 sequence) never encode
                    // CategoryId -- uniqueness across categories depends entirely on no two
                    // active categories' [Minimum,Maximum] ranges overlapping, and nothing
                    // previously enforced that (confirmed live: dozens of active categories
                    // already overlap). Scoped to active categories only per operator decision --
                    // an inactive category can't mint new IDs, so it neither needs checking nor
                    // blocks anything else.
                    // Only re-validate when the range is actually changing (or a category is being
                    // (re)activated) -- pre-existing overlaps already live in the data (confirmed:
                    // several active categories already overlap each other) must not block an
                    // unrelated edit, like fixing a typo in CategoryName, to a category that
                    // happens to already sit in one of those overlaps.
                    bool isRangeOrActivationChange = dto.TransactionType == CodeTransactionType.Create
                        || (CheckUpdate != null && (CheckUpdate.Minimum != data.Minimum || CheckUpdate.Maximum != data.Maximum || (!CheckUpdate.IsActive && data.IsActive)));
                    if (isRangeOrActivationChange)
                    {
                        if (data.Minimum > data.Maximum)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Invalid Project Category Range",
                                Message = $"Minimum ({data.Minimum}) cannot be greater than Maximum ({data.Maximum})."
                            });
                        }
                        if (data.IsActive)
                        {
                            var OverlappingCategory = await _db.tOptionProjectCategory.AsNoTracking()
                                .Where(x => x.Id != data.Id && x.IsActive
                                    && x.Minimum <= data.Maximum && data.Minimum <= x.Maximum)
                                .FirstOrDefaultAsync();
                            if (OverlappingCategory != null)
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Project Category Range Overlap",
                                    Message = $"The range {data.Minimum}-{data.Maximum} overlaps with active category '{OverlappingCategory.CategoryName}' (range {OverlappingCategory.Minimum}-{OverlappingCategory.Maximum}). ProjectId sequence digits do not encode which category generated them, so overlapping ranges between active categories can produce duplicate ProjectIds."
                                });
                            }
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionProjectCategory.AsNoTracking().OrderByDescending(x => x.CategoryId).FirstOrDefault();
                        data.CategoryId = (CheckMaxId != null) ? CheckMaxId.CategoryId + 1 : 1;
                        await _db.tOptionProjectCategory.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.CategoryName != data.CategoryName)
                        {
                            transactionLog.AffectedColumn = "CategoryName";
                            transactionLog.NewValue = $"{data.CategoryName}";
                            transactionLog.OldValue = $"{CheckUpdate.CategoryName}";
                            CheckUpdate.CategoryName = data.CategoryName;
                        }
                        if (CheckUpdate.Minimum != data.Minimum)
                        {
                            transactionLog.AffectedColumn = "Minimum";
                            transactionLog.NewValue = $"{data.Minimum}";
                            transactionLog.OldValue = $"{CheckUpdate.Minimum}";
                            CheckUpdate.Minimum = data.Minimum;
                        }
                        if (CheckUpdate.Maximum != data.Maximum)
                        {
                            transactionLog.AffectedColumn = "Maximum";
                            transactionLog.NewValue = $"{data.Maximum}";
                            transactionLog.OldValue = $"{CheckUpdate.Maximum}";
                            CheckUpdate.Maximum = data.Maximum;
                        }
                        if (CheckUpdate.ValidUntil != data.ValidUntil)
                        {
                            transactionLog.AffectedColumn = "ValidUntil";
                            transactionLog.NewValue = $"{data.ValidUntil}";
                            transactionLog.OldValue = $"{CheckUpdate.ValidUntil}";
                            CheckUpdate.ValidUntil = data.ValidUntil;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectCategory.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        // 2026-10-29: its Sub-Category mappings go with it. They were left behind, and the
                        // next Category, given the freed CategoryId, inherited them.
                        long DeletedCategoryId = CheckUpdate.CategoryId;
                        _db.tOptionProjectCategoryToPAPMap.RemoveRange(
                            await _db.tOptionProjectCategoryToPAPMap.Where(x => x.CategoryId == DeletedCategoryId).ToListAsync(cancellationToken));
                        _db.tOptionProjectCategory.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectThrust")
                {
                    tablename = "Project Thrust";
                    // 2026-10-29: was "tOptionProjectCategory", so Thrust history was always empty and
                    // Category history showed Thrust edits.
                    transactionLog.AffectedTable = "tOptionProjectThrustList";
                    var data = JsonConvert.DeserializeObject<OptionProjectThrustList>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Thrust Selected",
                            Message = "No Project Thrust has been selected, please select a project thrust."
                        });
                    }
                    // 2026-10-29: PAP Key 0 means "no Sub-Category" on projects, so a Thrust saved with it
                    // counted every such project as its user and could never be deleted or renamed.
                    if (dto.TransactionType == CodeTransactionType.Create && data.PAPKey <= 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid PAP Key",
                            Message = "Enter the PAP Key of the Sub-Category (Thrust); it must be greater than 0."
                        });
                    }
                    if (dto.TransactionType != CodeTransactionType.Delete && string.IsNullOrWhiteSpace(data.ThrustDescription))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Description Required",
                            Message = "Enter the Sub-Category (Thrust) description."
                        });
                    }
                    // Valid From / Valid To are years; 0 leaves that side open. A window that ends before
                    // it starts is never selectable, while the Code Tables filter showed it as valid.
                    if (dto.TransactionType != CodeTransactionType.Delete
                        && data.ValidFromDate > 0 && data.ValidToDate > 0 && data.ValidFromDate > data.ValidToDate)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Validity",
                            Message = $"Valid From ({data.ValidFromDate}) is after Valid To ({data.ValidToDate})."
                        });
                    }
                    if (data.ThrustDescription != null) data.ThrustDescription = data.ThrustDescription.Trim();
                    var CheckDescriptionIfExists = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.ThrustDescription == data.ThrustDescription);
                    if (CheckDescriptionIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckDescriptionIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust Already Exists",
                            Message = $"The project thrust {data.ThrustDescription} already exists, please select another project thrust."
                        });
                    }
                    var CheckIfPAPKeyExist = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == data.PAPKey);
                    if (CheckIfPAPKeyExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfPAPKeyExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust PAP Key Already Exists",
                            Message = $"The project thrust PAP key {data.PAPKey} already exists, please select another project thrust PAP key."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectThrustList.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust Not Found",
                            Message = $"The project thrust with id {data.Id} is not found, please select another project thrust."
                        });
                    }
                    // #482: an in-use thrust may still be retired -- set Inactive, move its Valid From / To or change its Infra Type -- since
                    // the projects that use it keep it. Only a delete, or a change to what the thrust is
                    // (ThrustDescription, ProgramName, SubProgramName, ActivityName, SequenceNumber), is refused. In use = a project or a modification request
                    // refers to the stored PAPKey. This used to refuse every update, so an in-use thrust
                    // could not be retired at all.
                    if (CheckUpdate != null
                        && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.ThrustDescription != data.ThrustDescription || CheckUpdate.ProgramName != data.ProgramName || CheckUpdate.SubProgramName != data.SubProgramName || CheckUpdate.ActivityName != data.ActivityName || CheckUpdate.SequenceNumber != data.SequenceNumber)
                        && (await _db.tProjectRevisions.AsNoTracking().AnyAsync(x => x.Thrust == CheckUpdate.PAPKey, cancellationToken)
                            || await _db.tRevisionProjects.AsNoTracking().AnyAsync(x => x.Thrust == CheckUpdate.PAPKey, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust In Use",
                            Message = "The selected project thrust is currently in use, so it cannot be deleted or renamed. You can still set it Inactive or change its validity."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tOptionProjectThrustList.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.ProgramName != data.ProgramName)
                        {
                            transactionLog.AffectedColumn = "ProgramName";
                            transactionLog.NewValue = $"{data.ProgramName}";
                            transactionLog.OldValue = $"{CheckUpdate.ProgramName}";
                            CheckUpdate.ProgramName = data.ProgramName;
                        }
                        if (CheckUpdate.SubProgramName != data.SubProgramName)
                        {
                            transactionLog.AffectedColumn = "SubProgramName";
                            transactionLog.NewValue = $"{data.SubProgramName}";
                            transactionLog.OldValue = $"{CheckUpdate.SubProgramName}";
                            CheckUpdate.SubProgramName = data.SubProgramName;
                        }
                        if (CheckUpdate.ActivityName != data.ActivityName)
                        {
                            transactionLog.AffectedColumn = "ActivityName";
                            transactionLog.NewValue = $"{data.ActivityName}";
                            transactionLog.OldValue = $"{CheckUpdate.ActivityName}";
                            CheckUpdate.ActivityName = data.ActivityName;
                        }
                        if (CheckUpdate.SequenceNumber != data.SequenceNumber)
                        {
                            transactionLog.AffectedColumn = "SequenceNumber";
                            transactionLog.NewValue = $"{data.SequenceNumber}";
                            transactionLog.OldValue = $"{CheckUpdate.SequenceNumber}";
                            CheckUpdate.SequenceNumber = data.SequenceNumber;
                        }
                        if (CheckUpdate.ValidFromDate != data.ValidFromDate)
                        {
                            transactionLog.AffectedColumn = "ValidFromDate";
                            transactionLog.NewValue = $"{data.ValidFromDate}";
                            transactionLog.OldValue = $"{CheckUpdate.ValidFromDate}";
                            CheckUpdate.ValidFromDate = data.ValidFromDate;
                        }
                        if (CheckUpdate.ValidToDate != data.ValidToDate)
                        {
                            transactionLog.AffectedColumn = "ValidToDate";
                            transactionLog.NewValue = $"{data.ValidToDate}";
                            transactionLog.OldValue = $"{CheckUpdate.ValidToDate}";
                            CheckUpdate.ValidToDate = data.ValidToDate;
                        }
                        if (CheckUpdate.InfrastructureType != data.InfrastructureType)
                        {
                            transactionLog.AffectedColumn = "InfrastructureType";
                            transactionLog.NewValue = $"{data.InfrastructureType}";
                            transactionLog.OldValue = $"{CheckUpdate.InfrastructureType}";
                            CheckUpdate.InfrastructureType = data.InfrastructureType;
                        }
                        if (CheckUpdate.ThrustDescription != data.ThrustDescription)
                        {
                            transactionLog.AffectedColumn = "ThrustDescription";
                            transactionLog.NewValue = $"{data.ThrustDescription}";
                            transactionLog.OldValue = $"{CheckUpdate.ThrustDescription}";
                            CheckUpdate.ThrustDescription = data.ThrustDescription;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectThrustList.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProjectThrustList.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectAgency")
                {
                    tablename = "Project Agency";
                    transactionLog.AffectedTable = "tOptionProjectAgency";
                    var data = JsonConvert.DeserializeObject<OptionProjectAgency>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Agency Selected",
                            Message = "No Project Agency has been selected, please select a project agency."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency Already Exists",
                            Message = $"The project agency {data.Name} already exists, please select another project agency."
                        });
                    }
                    var CheckIfNameIdExist = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == data.NameId);
                    if (CheckIfNameIdExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfNameIdExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency NameId Already Exists",
                            Message = $"The project agency name id {data.NameId} already exists, please select another project agency name id."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency Not Found",
                            Message = $"The project agency with id {data.Id} is not found, please select another project agency."
                        });
                    }
                    // #481: an in-use agency may still be set Active / Inactive or have its Description
                    // edited -- retiring it only takes it out of the dropdowns, and the projects that use
                    // it keep it. Only a delete, or a change to the Name those projects show, is refused.
                    // In use = a project or a modification request refers to the stored NameId (the
                    // Update below never writes NameId, and the Origin screen does not even send it).
                    // This used to refuse every update, so an in-use agency could not be retired at all.
                    if (CheckUpdate != null
                        && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Name != data.Name)
                        && (await _db.tProjectRevisions.AsNoTracking().AnyAsync(x => x.Agency == CheckUpdate.NameId, cancellationToken)
                            || await _db.tRevisionProjects.AsNoTracking().AnyAsync(x => x.Agency == CheckUpdate.NameId, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency In Use",
                            Message = "The selected project agency is currently in use, so it cannot be deleted or renamed. You can still set it Inactive."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tOptionProjectAgency.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectAgency.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProjectAgency.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectOrigin")
                {
                    tablename = "Project Origin";
                    transactionLog.AffectedTable = "tOptionProjectOrigin";
                    var data = JsonConvert.DeserializeObject<OptionProjectOrigin>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Origin Selected",
                            Message = "No Project Origin has been selected, please select a project origin."
                        });
                    }
                    // 2026-10-29: a blank name was saved (the screen has no check either).
                    if (dto.TransactionType != CodeTransactionType.Delete)
                    {
                        if (string.IsNullOrWhiteSpace(data.Name))
                        {
                            return new BadRequestObjectResult(new { Title = "Name Required", Message = "Enter the Origin name." });
                        }
                        data.Name = data.Name.Trim();
                    }
                    var CheckNameIfExists = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Origin Already Exists",
                            Message = $"The project origin {data.Name} already exists, please select another project origin."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Origin Not Found",
                            Message = $"The project origin with id {data.Id} is not found, please select another project origin."
                        });
                    }
                    // #481: an in-use origin may still be set Active / Inactive or have its Description
                    // edited -- retiring it only takes it out of the dropdowns, and the projects that use
                    // it keep it. Only a delete, or a change to the Name those projects show, is refused.
                    // In use = a project or a modification request refers to the stored NameId (the
                    // Update below never writes NameId, and the Origin screen does not even send it).
                    // This used to refuse every update, so an in-use origin could not be retired at all.
                    if (CheckUpdate != null
                        && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Name != data.Name)
                        && (await _db.tProjectRevisions.AsNoTracking().AnyAsync(x => x.Origin == CheckUpdate.NameId, cancellationToken)
                            || await _db.tRevisionProjects.AsNoTracking().AnyAsync(x => x.Origin == CheckUpdate.NameId, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Origin In Use",
                            Message = "The selected project origin is currently in use, so it cannot be deleted or renamed. You can still set it Inactive."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionProjectOrigin.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                        data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
                        await _db.tOptionProjectOrigin.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectOrigin.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProjectOrigin.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "FundingAgreement")
                {
                    tablename = "Funding Agreement";
                    transactionLog.AffectedTable = "tOptionFundingAgreement";
                    var data = JsonConvert.DeserializeObject<OptionFundingAgreement>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Funding Agreement Selected",
                            Message = "No Funding Agreement has been selected, please select a funding agreement."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement Already Exists",
                            Message = $"The funding agreement {data.Name} already exists, please select another funding agreement."
                        });
                    }
                    var CheckIfCodeExist = await _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefaultAsync(x => x.Code == data.Code);
                    if (CheckIfCodeExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfCodeExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement Code Already Exists",
                            Message = $"The funding agreement code {data.Code} already exists, please select another funding agreement code."
                        });
                    }
                    var CheckUpdate = await _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement Not Found",
                            Message = $"The funding agreement with id {data.Id} is not found, please select another funding agreement."
                        });
                    }
                    // Funding profiles reference the Code (FK_tProjectFundingProfile_Agreement and
                    // FK_tRevFunding_Agreement), so only a delete or a code change can break them. This
                    // used to test the incoming Code and block every edit, even a name fix or a toggle.
                    // 2026-10-29: a Source Org change counts too: the Funding Profile lists an agreement
                    // under its Source Org only, so the lines that use it showed a blank Agreement.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Code != data.Code
                            || !string.Equals((CheckUpdate.SourceOrg ?? string.Empty).Trim(), (data.SourceOrg ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase))
                        && (await _db.tProjectFundingProfile.AsNoTracking().AnyAsync(x => x.AgreementCode == CheckUpdate.Code, cancellationToken)
                            || await _db.tRevisionProjectFundingProfile.AsNoTracking().AnyAsync(x => x.AgreementCode == CheckUpdate.Code, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement In Use",
                            Message = "The selected funding agreement is currently in use, so it cannot be deleted or have its code or source organization changed."
                        });
                    }
                    if (dto.TransactionType == CodeTransactionType.Create
                        && !await _db.tOptionFundingSource.AsNoTracking().AnyAsync(x => x.Organization == data.SourceOrg, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source Not Found",
                            Message = $"The funding source {data.SourceOrg} is not found, please enter the Organization of an existing funding source."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        data.CreatedBy = _Session.UserId!;
                        data.CreatedDate = CurrentDate;
                        await _db.tOptionFundingAgreement.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.SourceOrg != data.SourceOrg)
                        {
                            var checkSource = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Organization == data.SourceOrg);
                            if (checkSource == null)
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Funding Source Not Found",
                                    Message = $"The funding source {data.SourceOrg} is not found, please select another funding source."
                                });
                            }
                            transactionLog.AffectedColumn = "SourceOrg";
                            transactionLog.NewValue = $"{data.SourceOrg}";
                            transactionLog.OldValue = $"{CheckUpdate.SourceOrg}";
                            CheckUpdate.SourceOrg = data.SourceOrg;
                        }
                        if (CheckUpdate.Code != data.Code)
                        {
                            transactionLog.AffectedColumn = "Code";
                            transactionLog.NewValue = $"{data.Code}";
                            transactionLog.OldValue = $"{CheckUpdate.Code}";
                            CheckUpdate.Code = data.Code;
                        }
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.FinancingSourceSegmentCode != data.FinancingSourceSegmentCode)
                        {
                            transactionLog.AffectedColumn = "FinancingSourceSegmentCode";
                            // Nullable column (27 rows are NULL): the log columns are NOT NULL.
                            transactionLog.NewValue = data.FinancingSourceSegmentCode ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.FinancingSourceSegmentCode ?? string.Empty;
                            CheckUpdate.FinancingSourceSegmentCode = data.FinancingSourceSegmentCode;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionFundingAgreement.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionFundingAgreement.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "FundingSource")
                {
                    tablename = "Funding Source";
                    transactionLog.AffectedTable = "tOptionFundingSource";
                    var data = JsonConvert.DeserializeObject<OptionFundingSource>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Funding Source Selected",
                            Message = "No Funding Source has been selected, please select a funding source."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source Already Exists",
                            Message = $"The funding source {data.Name} already exists, please select another funding source."
                        });
                    }
                    var CheckIfOrganizationExist = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Organization == data.Organization);
                    if (CheckIfOrganizationExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfOrganizationExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source Organization Already Exists",
                            Message = $"The funding source organization {data.Organization} already exists, please select another funding source organization."
                        });
                    }
                    var CheckUpdate = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source Not Found",
                            Message = $"The funding source with id {data.Id} is not found, please select another funding source."
                        });
                    }
                    // Funding profiles and agreements reference the Organization, so only a delete or an
                    // Organization change can break them (this used to block every edit of a used source).
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.Organization != data.Organization)
                        && (await _db.tProjectFundingProfile.AsNoTracking().AnyAsync(x => x.SourceOrg == CheckUpdate.Organization, cancellationToken)
                            || await _db.tRevisionProjectFundingProfile.AsNoTracking().AnyAsync(x => x.SourceOrg == CheckUpdate.Organization, cancellationToken)
                            || await _db.tOptionFundingAgreement.AsNoTracking().AnyAsync(x => x.SourceOrg == CheckUpdate.Organization, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source In Use",
                            Message = "The selected funding source is currently in use, so it cannot be deleted or have its organization changed."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        data.CreatedBy = _Session.UserId!;
                        data.CreatedDate = CurrentDate;
                        await _db.tOptionFundingSource.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Organization != data.Organization)
                        {
                            transactionLog.AffectedColumn = "Organization";
                            transactionLog.NewValue = $"{data.Organization}";
                            transactionLog.OldValue = $"{CheckUpdate.Organization}";
                            CheckUpdate.Organization = data.Organization;
                        }
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = $"{data.Name}";
                            transactionLog.OldValue = $"{CheckUpdate.Name}";
                            CheckUpdate.Name = data.Name;
                        }
                        // Nature is editable in the UI but was never saved.
                        if (CheckUpdate.Nature != data.Nature)
                        {
                            transactionLog.AffectedColumn = "Nature";
                            transactionLog.NewValue = data.Nature ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Nature ?? string.Empty;
                            CheckUpdate.Nature = data.Nature;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionFundingSource.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionFundingSource.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectScopeOfWork")
                {
                    tablename = "Scope Of Work";
                    transactionLog.AffectedTable = "tOptionScopeOfWork";
                    var data = JsonConvert.DeserializeObject<OptionScopeOfWork>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Scope Of Work Selected",
                            Message = "No Scope Of Work has been selected, please select a scope of work."
                        });
                    }
                    var CheckUpdate = await _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Scope Of Work Not Found",
                            Message = $"The scope of work with id {data.Id} is not found, please select another scope of work."
                        });
                    }
                    // Checked against the stored Enum: the UI never sends Enum, so data.Enum was always 0
                    // and an in-use delete fell through to the FK_tProjectMajorWorkItem_WorkType / FK_tRevWork_WorkType error.
                    if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete
                        && (await _db.tProjectMajorWorkItem.AsNoTracking().AnyAsync(x => x.WorkTypeFK == CheckUpdate.Enum, cancellationToken)
                            || await _db.tRevisionProjectMajorWorkItem.AsNoTracking().AnyAsync(x => x.WorkTypeFK == CheckUpdate.Enum, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Scope Of Work In Use",
                            Message = "The selected scope of work is currently in use and cannot be deleted."
                        });
                    }
                    if (dto.TransactionType != CodeTransactionType.Delete)
                    {
                        // 2026-10-29: Code Tables added Types of Work with Measure "0" and, for a blank Max,
                        // MaxAmount 0, which the Major Item form enforces as a real limit.
                        if (dto.TransactionType == CodeTransactionType.Create
                            && (string.IsNullOrWhiteSpace(data.Measure) || decimal.TryParse(data.Measure, out _)))
                        {
                            return new BadRequestObjectResult(new { Title = "Target Unit Required", Message = "Choose the Target Unit of the Type of Work." });
                        }
                        if (data.MaxAmount <= 0)
                        {
                            return new BadRequestObjectResult(new { Title = "Max Required", Message = "Enter the Max quantity; it must be greater than 0." });
                        }
                        if (data.MinAmount > data.MaxAmount)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Invalid Quantity Range",
                                Message = $"Min ({data.MinAmount}) cannot be greater than Max ({data.MaxAmount})."
                            });
                        }
                        // A work category holds many scopes (165 rows share 18 categories), so only an
                        // exact copy is a duplicate: same category, description and infra types.
                        var SameDescription = await _db.tOptionScopeOfWork.AsNoTracking()
                            .Where(x => x.Id != data.Id && x.WorkCategory == data.WorkCategory && x.Description == data.Description)
                            .ToListAsync(cancellationToken);
                        if (SameDescription.Any(x => x.InfraType.OrderBy(i => i).SequenceEqual(data.InfraType.OrderBy(i => i))))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Scope Of Work Already Exists",
                                Message = $"The scope of work {data.WorkCategory} - {data.Description} already exists for the selected infra types."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionScopeOfWork.AsNoTracking().OrderByDescending(x => x.Enum).FirstOrDefault();
                        data.Enum = (CheckMaxId != null) ? CheckMaxId.Enum + 1 : 1;
                        await _db.tOptionScopeOfWork.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        // 2026-10-29: the arrays were compared by reference (always "changed"), so every save
                        // re-checked every code, and a scope that still listed a since-deleted infra code
                        // could no longer be saved or toggled at all. Now: compared as sets; only codes being
                        // ADDED must exist; a code may not be REMOVED while Major Items use it with this
                        // Type of Work (their Type of Work list is filtered by it and would show blank).
                        var StoredInfra = (CheckUpdate.InfraType ?? Array.Empty<string>()).Select(x => x.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                        var PostedInfra = (data.InfraType ?? Array.Empty<string>()).Select(x => x.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
                        if (!StoredInfra.SetEquals(PostedInfra))
                        {
                            var validInfraCodes = (await _db.tOptionInfraType.AsNoTracking()
                                .Select(x => x.InfraCode)
                                .ToListAsync(cancellationToken))
                                .Select(x => x.Trim())
                                .ToHashSet(StringComparer.OrdinalIgnoreCase);
                            var nonExistingInfraTypes = PostedInfra.Except(StoredInfra, StringComparer.OrdinalIgnoreCase)
                                .Where(infra => !validInfraCodes.Contains(infra))
                                .ToList();
                            if (nonExistingInfraTypes.Any())
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Invalid InfraType",
                                    Message = $"The following InfraType values are invalid: {string.Join(", ", nonExistingInfraTypes)}. Please provide valid InfraType values."
                                });
                            }
                            var RemovedInfra = StoredInfra.Except(PostedInfra, StringComparer.OrdinalIgnoreCase).ToList();
                            if (RemovedInfra.Count > 0)
                            {
                                int WorkTypeEnum = CheckUpdate.Enum;
                                var UsedInfra = (await _db.tProjectMajorWorkItem.AsNoTracking()
                                        .Where(x => x.WorkTypeFK == WorkTypeEnum && !x.IsDeleted)
                                        .Select(x => x.InfraTypeFK)
                                        .Distinct()
                                        .ToListAsync(cancellationToken))
                                    .Concat(await _db.tRevisionProjectMajorWorkItem.AsNoTracking()
                                        .Where(x => x.WorkTypeFK == WorkTypeEnum && !x.IsDeleted)
                                        .Select(x => x.InfraTypeFK)
                                        .Distinct()
                                        .ToListAsync(cancellationToken))
                                    .Where(x => x != null)
                                    .Select(x => x!.Trim())
                                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                                var RemovedInUse = RemovedInfra.Where(UsedInfra.Contains).ToList();
                                if (RemovedInUse.Count > 0)
                                {
                                    return new BadRequestObjectResult(new
                                    {
                                        Title = "Scope Of Work In Use",
                                        Message = $"Major Items use this Type of Work with {string.Join(", ", RemovedInUse)}, so that Infra Type cannot be removed from it. You can set the Type of Work Inactive instead."
                                    });
                                }
                            }
                            transactionLog.AffectedColumn = "InfraType";
                            transactionLog.NewValue = JsonConvert.SerializeObject(data.InfraType);
                            transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate.InfraType);
                            CheckUpdate.InfraType = data.InfraType ?? Array.Empty<string>();
                        }
                        if (CheckUpdate.WorkCategory != data.WorkCategory)
                        {
                            transactionLog.AffectedColumn = "WorkCategory";
                            transactionLog.NewValue = $"{data.WorkCategory}";
                            transactionLog.OldValue = $"{CheckUpdate.WorkCategory}";
                            CheckUpdate.WorkCategory = data.WorkCategory;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (CheckUpdate.Measure != data.Measure)
                        {
                            transactionLog.AffectedColumn = "Measure";
                            transactionLog.NewValue = $"{data.Measure}";
                            transactionLog.OldValue = $"{CheckUpdate.Measure}";
                            CheckUpdate.Measure = data.Measure;
                        }
                        if (CheckUpdate.MinAmount != data.MinAmount)
                        {
                            transactionLog.AffectedColumn = "MinAmount";
                            transactionLog.NewValue = $"{data.MinAmount}";
                            transactionLog.OldValue = $"{CheckUpdate.MinAmount}";
                            CheckUpdate.MinAmount = data.MinAmount;
                        }
                        if (CheckUpdate.MaxAmount != data.MaxAmount)
                        {
                            transactionLog.AffectedColumn = "MaxAmount";
                            transactionLog.NewValue = $"{data.MaxAmount}";
                            transactionLog.OldValue = $"{CheckUpdate.MaxAmount}";
                            CheckUpdate.MaxAmount = data.MaxAmount;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionScopeOfWork.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionScopeOfWork.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectInfraType")
                {
                    tablename = "Infra Type";
                    transactionLog.AffectedTable = "tOptionInfraType";
                    var data = JsonConvert.DeserializeObject<OptionInfraType>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Infra Type Selected",
                            Message = "No Infra Type has been selected, please select an infra type."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(x => x.InfraName == data.InfraName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type Already Exists",
                            Message = $"The infra type {data.InfraName} already exists, please select another infra type."
                        });
                    }
                    var CheckIfInfraCodeExist = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(x => x.InfraCode == data.InfraCode);
                    if (CheckIfInfraCodeExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfInfraCodeExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type Id Already Exists",
                            Message = $"The infra type id {data.InfraCode} already exists, please select another infra type id."
                        });
                    }
                    var CheckUpdate = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type Not Found",
                            Message = $"The infra type with id {data.Id} is not found, please select another infra type."
                        });
                    }
                    // Major items reference the InfraCode (FK_tProjectMajorWorkItem_InfraType, FK_tRevWork_InfraType), not the
                    // name, so only a delete or a code change can break them.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.InfraCode != data.InfraCode)
                        && (await _db.tProjectMajorWorkItem.AsNoTracking().AnyAsync(x => x.InfraTypeFK == CheckUpdate.InfraCode, cancellationToken)
                            || await _db.tRevisionProjectMajorWorkItem.AsNoTracking().AnyAsync(x => x.InfraTypeFK == CheckUpdate.InfraCode, cancellationToken)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type In Use",
                            Message = "The selected infra type is currently in use, so it cannot be deleted or have its code changed."
                        });
                    }
                    // 2026-10-29: Types of Work (Scope of Work) list infra codes as text, not by FK. Deleting
                    // or re-coding one they list left them pointing at a code that no longer exists, and
                    // those Types of Work could no longer be saved or toggled.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.InfraCode != data.InfraCode))
                    {
                        string StoredCode = (CheckUpdate.InfraCode ?? string.Empty).Trim();
                        var ListedBy = (await _db.tOptionScopeOfWork.AsNoTracking().ToListAsync(cancellationToken))
                            .Where(s => (s.InfraType ?? Array.Empty<string>()).Any(c => string.Equals(c?.Trim(), StoredCode, StringComparison.OrdinalIgnoreCase)))
                            .Select(s => s.Description)
                            .ToList();
                        if (ListedBy.Count > 0)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Infra Type In Use",
                                Message = $"{ListedBy.Count} Type(s) of Work list this infra type (for example \"{ListedBy[0]}\"), so it cannot be deleted or have its code changed. Remove it from them first, or set it Inactive."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        if (data.InfraId > 0)
                        {
                            if (await _db.tOptionInfraType.AsNoTracking().AnyAsync(x => x.InfraId == data.InfraId, cancellationToken))
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Infra ID Already Exists",
                                    Message = $"The infra ID {data.InfraId} already exists, please enter another infra ID or leave it blank."
                                });
                            }
                        }
                        else
                        {
                            // Was ordered by InfraCode, so the "next" id came from the alphabetically last
                            // code (WW = 14) and collided with an existing InfraId.
                            var MaxInfraId = await _db.tOptionInfraType.AsNoTracking().MaxAsync(x => (int?)x.InfraId, cancellationToken);
                            data.InfraId = (MaxInfraId ?? 0) + 1;
                        }
                        await _db.tOptionInfraType.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.InfraCode != data.InfraCode)
                        {
                            transactionLog.AffectedColumn = "InfraCode";
                            transactionLog.NewValue = $"{data.InfraCode}";
                            transactionLog.OldValue = $"{CheckUpdate.InfraCode}";
                            CheckUpdate.InfraCode = data.InfraCode;
                        }
                        if (CheckUpdate.InfraName != data.InfraName)
                        {
                            transactionLog.AffectedColumn = "InfraName";
                            transactionLog.NewValue = data.InfraName!;
                            transactionLog.OldValue = CheckUpdate.InfraName!;
                            CheckUpdate.InfraName = data.InfraName;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionInfraType.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionInfraType.Remove(CheckUpdate);
                    }

                }
                else if (dto.Code == "ProjectComponent")
                {
                    tablename = "Project Component";
                    transactionLog.AffectedTable = "tOptionProjectComponentType";
                    var data = JsonConvert.DeserializeObject<OptionProjectComponentType>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Component Selected",
                            Message = "No Project Component has been selected, please select a project component."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectComponentType.AsNoTracking().FirstOrDefaultAsync(x => x.ComponentName == data.ComponentName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Already Exists",
                            Message = $"The project component {data.ComponentName} already exists, please select another project component."
                        });
                    }
                    var CheckIfComponentIdExist = await _db.tOptionProjectComponentType.AsNoTracking().FirstOrDefaultAsync(x => x.ComponentId == data.ComponentId);
                    if (CheckIfComponentIdExist != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckIfComponentIdExist.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Id Already Exists",
                            Message = $"The project component id {data.ComponentId} already exists, please select another project component id."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectComponentType.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Not Found",
                            Message = $"The project component with id {data.Id} is not found, please select another project component."
                        });
                    }
                    // 2026-10-29: component costs store the Component ID (FK to ComponentId), but this
                    // check compared them with the posted NAME, so it never matched: a used type's
                    // delete or ID change failed with a generic foreign-key error, and revision rows were
                    // not checked at all. Now the stored Component ID, in projects and in revisions; a
                    // name fix, the PCMA flag and Active stay editable while in use.
                    if (CheckUpdate != null && (dto.TransactionType == CodeTransactionType.Delete || CheckUpdate.ComponentId != data.ComponentId))
                    {
                        string StoredComponentId = CheckUpdate.ComponentId;
                        if (await _db.tProjectComponentCost.AsNoTracking().AnyAsync(x => x.ComponentType == StoredComponentId, cancellationToken)
                            || await _db.tRevisionProjectComponentCost.AsNoTracking().AnyAsync(x => x.ComponentType == StoredComponentId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Project Component In Use",
                                Message = $"Cost type {StoredComponentId} is used by projects, so it cannot be deleted or have its Component ID changed. You can still rename it or set it Inactive."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tOptionProjectComponentType.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.ComponentId != data.ComponentId)
                        {
                            transactionLog.AffectedColumn = "ComponentId";
                            transactionLog.NewValue = $"{data.ComponentId}";
                            transactionLog.OldValue = $"{CheckUpdate.ComponentId}";
                            CheckUpdate.ComponentId = data.ComponentId;
                        }
                        if (CheckUpdate.ComponentName != data.ComponentName)
                        {
                            transactionLog.AffectedColumn = "ComponentName";
                            transactionLog.NewValue = data.ComponentName!;
                            transactionLog.OldValue = CheckUpdate.ComponentName!;
                            CheckUpdate.ComponentName = data.ComponentName;
                        }
                        if (CheckUpdate.ExportToPCMA != data.ExportToPCMA)
                        {
                            transactionLog.AffectedColumn = "ExportToPCMA";
                            transactionLog.NewValue = data.ExportToPCMA ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.ExportToPCMA ? "True" : "False";
                            CheckUpdate.ExportToPCMA = data.ExportToPCMA;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectComponentType.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProjectComponentType.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionHeader")
                {
                    tablename = "Revision Header";
                    transactionLog.AffectedTable = "tOptionRevisionHeader";
                    var data = JsonConvert.DeserializeObject<OptionRevisionHeader>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Header Selected",
                            Message = "No Revision Header has been selected, please select a revision header."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionName == data.RevisionName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Header Already Exists",
                            Message = $"The revision header {data.RevisionName} already exists, please select another revision header."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Header Not Found",
                            Message = $"The revision header with id {data.Id} is not found, please select another revision header."
                        });
                    }
                    // 2026-10-29: judged by the STORED header, and also refused while Reasons, Categories
                    // or Documents still point at it: the delete used to fail with a generic database
                    // error, or leave them pointing at nothing.
                    if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        int GroupId = CheckUpdate.RevisionGroupId;
                        if (await _db.tRevisionDetails.AsNoTracking().AnyAsync(x => x.RevisionGroupId == GroupId, cancellationToken)
                            || await _db.tOptionRevisionReasons.AsNoTracking().AnyAsync(x => x.RevisionGroupId == GroupId, cancellationToken)
                            || await _db.tOptionRevisionCategory.AsNoTracking().AnyAsync(x => x.RevisionGroupId == GroupId, cancellationToken)
                            || await _db.tOptionRevisionDocuments.AsNoTracking().AnyAsync(x => x.RevisionGroupId == GroupId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Revision Header In Use",
                                Message = "The selected revision header is used by revision requests, reasons, categories or documents, so it cannot be deleted. You can set it Inactive."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionRevisionHeader.AsNoTracking().OrderByDescending(x => x.RevisionGroupId).FirstOrDefault();
                        data.RevisionGroupId = (CheckMaxId != null) ? CheckMaxId.RevisionGroupId + 1 : 1;
                        await _db.tOptionRevisionHeader.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.RevisionName != data.RevisionName)
                        {
                            transactionLog.AffectedColumn = "RevisionName";
                            transactionLog.NewValue = data.RevisionName!;
                            transactionLog.OldValue = CheckUpdate.RevisionName!;
                            CheckUpdate.RevisionName = data.RevisionName;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionHeader.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionHeader.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionCategory")
                {
                    tablename = "Revision Category";
                    transactionLog.AffectedTable = "tOptionRevisionCategory";
                    var data = JsonConvert.DeserializeObject<OptionRevisionCategory>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Category Selected",
                            Message = "No Revision Category has been selected, please select a revision category."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryName == data.CategoryName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Category Already Exists",
                            Message = $"The revision category {data.CategoryName} already exists, please select another revision category."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Category Not Found",
                            Message = $"The revision category with id {data.Id} is not found, please select another revision category."
                        });
                    }
                    // 2026-10-29: judged by the STORED category, and also refused while Reasons or
                    // Documents list it (they were left pointing at a deleted category).
                    if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        int StoredCategoryId = CheckUpdate.CategoryId;
                        bool UsedByReason = (await _db.tOptionRevisionReasons.AsNoTracking().ToListAsync(cancellationToken))
                            .Any(r => r.CategoryId.Contains(StoredCategoryId));
                        if (UsedByReason
                            || await _db.tRevisionDetails.AsNoTracking().AnyAsync(x => x.CategoryId == StoredCategoryId, cancellationToken)
                            || await _db.tOptionRevisionDocuments.AsNoTracking().AnyAsync(x => x.CategoryId == StoredCategoryId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Revision Category In Use",
                                Message = "The selected revision category is used by revision requests, reasons or documents, so it cannot be deleted. You can set it Inactive."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionRevisionCategory.AsNoTracking().OrderByDescending(x => x.CategoryId).FirstOrDefault();
                        data.CategoryId = (CheckMaxId != null) ? CheckMaxId.CategoryId + 1 : 1;
                        await _db.tOptionRevisionCategory.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.CategoryName != data.CategoryName)
                        {
                            transactionLog.AffectedColumn = "CategoryName";
                            transactionLog.NewValue = data.CategoryName!;
                            transactionLog.OldValue = CheckUpdate.CategoryName!;
                            CheckUpdate.CategoryName = data.CategoryName;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionCategory.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionCategory.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionReasons")
                {
                    tablename = "Revision Reasons";
                    transactionLog.AffectedTable = "tOptionRevisionReasons";
                    var data = JsonConvert.DeserializeObject<OptionRevisionReasons>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Reason Selected",
                            Message = "No Revision Reason has been selected, please select a revision reason."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.Reason == data.Reason);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Reason Already Exists",
                            Message = $"The revision reason {data.Reason} already exists, please select another revision reason."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Reason Not Found",
                            Message = $"The revision reason with id {data.Id} is not found, please select another revision reason."
                        });
                    }
                    // 2026-10-29: judged by the STORED reason. A delete is also refused while Rules use it
                    // (they vanished from the Rules screen, and the next new reason took the freed ReasonId
                    // and inherited them). Moving it to another Revision Header is refused while requests
                    // use it: they find their reason by ReasonId AND RevisionGroupId, and failed with
                    // "Revision Reason not found".
                    if (CheckUpdate != null)
                    {
                        int StoredReasonId = CheckUpdate.ReasonId;
                        bool UsedByRequests = await _db.tRevisionDetails.AsNoTracking().AnyAsync(x => x.ReasonId == StoredReasonId, cancellationToken);
                        if (dto.TransactionType == CodeTransactionType.Delete
                            && (UsedByRequests || await _db.tRevisionRules.AsNoTracking().AnyAsync(x => x.ReasonId == StoredReasonId, cancellationToken)))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Revision Reason In Use",
                                Message = "The selected revision reason is used by revision requests or rules, so it cannot be deleted. You can set it Inactive."
                            });
                        }
                        if (dto.TransactionType == CodeTransactionType.Update && UsedByRequests && CheckUpdate.RevisionGroupId != data.RevisionGroupId)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Revision Reason In Use",
                                Message = "The selected revision reason is used by revision requests, so it cannot be moved to another revision header."
                            });
                        }
                    }
                    // FK -> tOptionRevisionHeader(RevisionGroupId): a missing group was a raw SQL error.
                    if (dto.TransactionType != CodeTransactionType.Delete
                        && !await _db.tOptionRevisionHeader.AsNoTracking().AnyAsync(x => x.RevisionGroupId == data.RevisionGroupId, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid RevisionGroupId",
                            Message = $"The RevisionGroupId {data.RevisionGroupId} does not exist, please select a valid revision group."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionRevisionReasons.AsNoTracking().OrderByDescending(x => x.ReasonId).FirstOrDefault();
                        data.ReasonId = (CheckMaxId != null) ? CheckMaxId.ReasonId + 1 : 1;
                        await _db.tOptionRevisionReasons.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Reason != data.Reason)
                        {
                            transactionLog.AffectedColumn = "Reason";
                            transactionLog.NewValue = data.Reason!;
                            transactionLog.OldValue = CheckUpdate.Reason!;
                            CheckUpdate.Reason = data.Reason;
                        }
                        if (CheckUpdate.RevisionGroupId != data.RevisionGroupId)
                        {
                            transactionLog.AffectedColumn = "RevisionGroupId";
                            transactionLog.NewValue = $"{data.RevisionGroupId}";
                            transactionLog.OldValue = $"{CheckUpdate.RevisionGroupId}";
                            CheckUpdate.RevisionGroupId = data.RevisionGroupId;
                        }
                        // Arrays: != compared references, so this branch ran on every edit.
                        if (!CheckUpdate.CategoryId.SequenceEqual(data.CategoryId))
                        {
                            var validCategoryIds = await _db.tOptionRevisionCategory
                                .Select(x => x.CategoryId)
                                .ToListAsync(cancellationToken);
                            var nonExistingCategoryIds = data.CategoryId
                                .Where(category => !validCategoryIds.Contains((int)category!))
                                .ToList();

                            if (nonExistingCategoryIds.Any())
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Invalid CategoryId",
                                    Message = $"The following CategoryId values are invalid: {string.Join(", ", nonExistingCategoryIds)}. Please provide valid CategoryId values."
                                });
                            }
                            transactionLog.AffectedColumn = "CategoryId";
                            transactionLog.NewValue = JsonConvert.SerializeObject(data.CategoryId);
                            transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate.CategoryId);
                            CheckUpdate.CategoryId = data.CategoryId;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionReasons.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionReasons.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionRules")
                {
                    tablename = "Revision Rules";
                    transactionLog.AffectedTable = "tRevisionRules";
                    var data = JsonConvert.DeserializeObject<DBHelper.Models.Table.Revision.RevisionRules>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Rule Selected",
                            Message = "No Revision Rule has been selected, please select a revision rule."
                        });
                    }
                    var CheckNameIfExists = await _db.tRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == data.ReasonId && x.PCMA_Status == data.PCMA_Status && x.Package_Status == data.Package_Status);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Rule Already Exists",
                            Message = $"A revision rule for this Reason with PCMA Status {data.PCMA_Status} and Package Status {data.Package_Status} already exists, please select another revision rule."
                        });
                    }
                    var CheckUpdate = await _db.tRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Rule Not Found",
                            Message = $"The revision rule with id {data.Id} is not found, please select another revision rule."
                        });
                    }
                    // 2026-10-29: judged by the STORED rule. The Rules screen deletes with { Id } only, so
                    // the check on the posted ReasonId never matched and an in-use rule was deleted.
                    if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        int RuleReasonId = CheckUpdate.ReasonId;
                        if (await _db.tRevisionDetails.AsNoTracking().AnyAsync(x => x.ReasonId == RuleReasonId, cancellationToken))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Revision Rule In Use",
                                Message = "The selected revision rule is currently in use and cannot be deleted."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tRevisionRules.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.ReasonId != data.ReasonId)
                        {
                            var CheckReasonId = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == data.ReasonId);
                            if (CheckReasonId == null)
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Invalid ReasonId",
                                    Message = $"The ReasonId {data.ReasonId} does not exist, please select a valid ReasonId."
                                });
                            }
                            transactionLog.AffectedColumn = "ReasonId";
                            transactionLog.NewValue = $"{data.ReasonId}";
                            transactionLog.OldValue = $"{CheckUpdate.ReasonId}";
                            CheckUpdate.ReasonId = data.ReasonId;
                        }
                        if (CheckUpdate.PCMA_Status != data.PCMA_Status)
                        {
                            transactionLog.AffectedColumn = "PCMA_Status";
                            transactionLog.NewValue = data.PCMA_Status!;
                            transactionLog.OldValue = CheckUpdate.PCMA_Status!;
                            CheckUpdate.PCMA_Status = data.PCMA_Status;
                        }
                        if (CheckUpdate.Package_Status != data.Package_Status)
                        {
                            transactionLog.AffectedColumn = "Package_Status";
                            transactionLog.NewValue = data.Package_Status!;
                            transactionLog.OldValue = CheckUpdate.Package_Status!;
                            CheckUpdate.Package_Status = data.Package_Status;
                        }
                        if (CheckUpdate.Field != data.Field)
                        {
                            transactionLog.AffectedColumn = "Field";
                            transactionLog.NewValue = data.Field!;
                            transactionLog.OldValue = CheckUpdate.Field!;
                            CheckUpdate.Field = data.Field;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tRevisionRules.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tRevisionRules.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionDocuments")
                {
                    tablename = "Revision Documents";
                    transactionLog.AffectedTable = "tOptionRevisionDocuments";
                    var data = JsonConvert.DeserializeObject<OptionRevisionDocuments>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Document Selected",
                            Message = "No Revision Document has been selected, please select a revision document."
                        });
                    }
                    // The second segment only shapes the file name of NEW uploads, so a group that revisions
                    // already use can still have its document edited; only deleting it is refused.
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == data.RevisionGroupId);
                    if (CheckIfAlreadyUse != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Document In Use",
                            Message = "The selected revision document is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.SecondSegmentName == data.SecondSegmentName);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Document Already Exists",
                            Message = $"The revision document with second segment name {data.SecondSegmentName} already exists, please select another revision document."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Document Not Found",
                            Message = $"The revision document with id {data.Id} is not found, please select another revision document."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tOptionRevisionDocuments.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.SecondSegmentName != data.SecondSegmentName)
                        {
                            transactionLog.AffectedColumn = "SecondSegmentName";
                            transactionLog.NewValue = data.SecondSegmentName!;
                            transactionLog.OldValue = CheckUpdate.SecondSegmentName!;
                            CheckUpdate.SecondSegmentName = data.SecondSegmentName;
                        }
                        // Blank and NULL are the same "no description"; NULL in the NOT NULL log would fail.
                        var description = string.IsNullOrWhiteSpace(data.Description) ? null : data.Description.Trim();
                        if (CheckUpdate.Description != description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = description ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Description ?? string.Empty;
                            CheckUpdate.Description = description;
                        }
                        if (CheckUpdate.RevisionGroupId != data.RevisionGroupId)
                        {
                            var CheckRevisionGroupId = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == data.RevisionGroupId);
                            if (CheckRevisionGroupId == null)
                            {
                                return new BadRequestObjectResult(new
                                {
                                    Title = "Invalid RevisionGroupId",
                                    Message = $"The RevisionGroupId {data.RevisionGroupId} does not exist, please select a valid RevisionGroupId."
                                });
                            }
                            transactionLog.AffectedColumn = "RevisionGroupId";
                            transactionLog.NewValue = $"{data.RevisionGroupId}";
                            transactionLog.OldValue = $"{CheckUpdate.RevisionGroupId}";
                            CheckUpdate.RevisionGroupId = data.RevisionGroupId;
                        }
                        if (CheckUpdate.CategoryId != data.CategoryId)
                        {
                            if (data.CategoryId != null)
                            {
                                var CheckCategoryId = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == data.CategoryId);
                                if (CheckCategoryId == null)
                                {
                                    return new BadRequestObjectResult(new
                                    {
                                        Title = "Invalid CategoryId",
                                        Message = $"The CategoryId {data.CategoryId} does not exist, please select a valid CategoryId."
                                    });
                                }
                            }
                            transactionLog.AffectedColumn = "CategoryId";
                            transactionLog.NewValue = $"{data.CategoryId}";
                            transactionLog.OldValue = $"{CheckUpdate.CategoryId}";
                            CheckUpdate.CategoryId = data.CategoryId;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionDocuments.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionDocuments.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionValidationDates")
                {
                    // S04-TC016 (2026-10-30): the Validation Dates screen used to change only the page (built-in
                    // sample rows, nothing saved). One row per funding year; RequestRevision enforces it
                    // (Helpers/RevisionValidationWindow.cs).
                    tablename = "Validation Date";
                    transactionLog.AffectedTable = "tOptionRevisionValidationDate";
                    var data = JsonConvert.DeserializeObject<DBHelper.Models.Table.Revision.OptionRevisionValidationDate>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new { Title = "No Validation Date Selected", Message = "No validation date has been selected." });
                    }
                    bool TableExists = await _db.Database
                        .SqlQuery<int>($"SELECT COUNT(*) AS Value FROM sys.tables WHERE name = N'tOptionRevisionValidationDate'")
                        .SingleAsync(cancellationToken) > 0;
                    if (!TableExists)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Validation Dates Not Set Up",
                            Message = "Validation Dates are not set up on this server yet. Ask the administrator to run Migration.RevisionValidationDates.2026-10-30.sql."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionValidationDate.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id, cancellationToken);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new { Title = "Validation Date Not Found", Message = $"The validation date with id {data.Id} is not found." });
                    }
                    if (dto.TransactionType != CodeTransactionType.Delete)
                    {
                        if (data.FundingYear < 2000 || data.FundingYear > 2100)
                        {
                            return new BadRequestObjectResult(new { Title = "Invalid Funding Year", Message = "Enter a Funding Year between 2000 and 2100." });
                        }
                        if (data.StartDate.Year < 2000 || data.EndDate.Year < 2000)
                        {
                            return new BadRequestObjectResult(new { Title = "Dates Required", Message = "Enter both the Start Date and the End Date." });
                        }
                        data.StartDate = data.StartDate.Date;
                        data.EndDate = data.EndDate.Date;
                        if (data.StartDate > data.EndDate)
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Invalid Dates",
                                Message = $"The Start Date ({data.StartDate:MMMM d, yyyy}) is after the End Date ({data.EndDate:MMMM d, yyyy})."
                            });
                        }
                        if (await _db.tOptionRevisionValidationDate.AsNoTracking().AnyAsync(x => x.FundingYear == data.FundingYear && x.Id != data.Id, cancellationToken))
                        {
                            return new BadRequestObjectResult(new
                            {
                                Title = "Validation Date Already Exists",
                                Message = $"Funding Year {data.FundingYear} already has a validation date range. Edit that row instead."
                            });
                        }
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        data.Id = 0;
                        data.CreatedBy = _Session.UserId ?? string.Empty;
                        data.CreatedDate = CurrentDate;
                        await _db.tOptionRevisionValidationDate.AddAsync(data, cancellationToken);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.FundingYear != data.FundingYear)
                        {
                            transactionLog.AffectedColumn = "FundingYear";
                            transactionLog.NewValue = $"{data.FundingYear}";
                            transactionLog.OldValue = $"{CheckUpdate.FundingYear}";
                            CheckUpdate.FundingYear = data.FundingYear;
                        }
                        if (CheckUpdate.StartDate != data.StartDate)
                        {
                            transactionLog.AffectedColumn = "StartDate";
                            transactionLog.NewValue = data.StartDate.ToString("yyyy-MM-dd");
                            transactionLog.OldValue = CheckUpdate.StartDate.ToString("yyyy-MM-dd");
                            CheckUpdate.StartDate = data.StartDate;
                        }
                        if (CheckUpdate.EndDate != data.EndDate)
                        {
                            transactionLog.AffectedColumn = "EndDate";
                            transactionLog.NewValue = data.EndDate.ToString("yyyy-MM-dd");
                            transactionLog.OldValue = CheckUpdate.EndDate.ToString("yyyy-MM-dd");
                            CheckUpdate.EndDate = data.EndDate;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionValidationDate.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionValidationDate.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "RevisionStatus")
                {
                    tablename = "Revision Status";
                    transactionLog.AffectedTable = "tOptionRevisionStatus";
                    var data = JsonConvert.DeserializeObject<OptionRevisionStatus>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Status Selected",
                            Message = "No Revision Status has been selected, please select a revision status."
                        });
                    }
                    // Approvals store the NameId, which an update never changes (only Name, Description and
                    // IsActive are saved), so a used status only needs protecting from deletion. Blocking
                    // updates too meant For Approval / Approved could never even get a description fix.
                    var CheckIfAlreadyUse = await _db.tRevisionApprovals.AsNoTracking().FirstOrDefaultAsync(x => x.Status == data.NameId);
                    if (CheckIfAlreadyUse != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Status In Use",
                            Message = "The selected revision status is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && (dto.TransactionType == CodeTransactionType.Create || (dto.TransactionType == CodeTransactionType.Update && CheckNameIfExists.Id != data.Id)))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Status Already Exists",
                            Message = $"The revision status with name {data.Name} already exists, please select another revision status."
                        });
                    }
                    var CheckUpdate = await _db.tOptionRevisionStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Status Not Found",
                            Message = $"The revision status with id {data.Id} is not found, please select another revision status."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionRevisionStatus.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                        //data.Enum = (CheckMaxId != null) ? CheckMaxId.Enum + 1 : 1;
                        await _db.tOptionRevisionStatus.AddAsync(data);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Update)
                    {
                        if (CheckUpdate.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = CheckUpdate.Name!;
                            CheckUpdate.Name = data.Name;
                        }
                        if (CheckUpdate.Description != data.Description)
                        {
                            transactionLog.AffectedColumn = "Description";
                            transactionLog.NewValue = data.Description ?? string.Empty;
                            transactionLog.OldValue = CheckUpdate.Description ?? string.Empty;
                            CheckUpdate.Description = data.Description;
                        }
                        if (sentIsActive && CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionRevisionStatus.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionRevisionStatus.Remove(CheckUpdate);
                    }
                }
                // Admin Areas are maintained in AAMS (UAT S04-TC020..TC024): MYPS may not add, rename or
                // delete them. Regions are read-only; provinces, cities, legislative districts and DEOs may
                // only be re-linked to their parent. The Code Tables UI offers exactly that and no more.
                else if (dto.Code == "AdminAreaRegion")
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Maintained in AAMS",
                        Message = "Regions are maintained in AAMS and cannot be added, edited or deleted in MYPS."
                    });
                }
                else if (dto.Code == "AdminAreaProvince")
                {
                    tablename = "Admin Area Province";
                    transactionLog.AffectedTable = "tOptionAdminAreaProvince";
                    var data = dto.TransactionType == CodeTransactionType.Update ? JsonConvert.DeserializeObject<OptionAdminAreaProvince>(dto.Json) : null;
                    if (data == null) return AamsOnlyLinkEditable("Provinces", "region");
                    var existing = await _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id, cancellationToken);
                    if (existing == null)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"Province with Id {data.Id} was not found." });
                    if (data.Name != existing.Name || data.Code != existing.Code || data.Deprecated != existing.Deprecated)
                        return AamsOnlyLinkEditable("Provinces", "region");
                    if (!await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(x => x.ParticipantId == data.RegionParticipantId, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Region",
                            Message = $"The RegionParticipantId '{data.RegionParticipantId}' does not exist. Please select a valid Region."
                        });
                    }
                    if (existing.RegionParticipantId != data.RegionParticipantId)
                    {
                        transactionLog.AffectedColumn = "RegionParticipantId";
                        transactionLog.NewValue = data.RegionParticipantId;
                        transactionLog.OldValue = existing.RegionParticipantId;
                        existing.RegionParticipantId = data.RegionParticipantId;
                    }
                    existing.UpdatedDate = CurrentDate;
                    _db.tOptionAdminAreaProvince.Update(existing);
                }
                else if (dto.Code == "AdminAreaCity")
                {
                    tablename = "Admin Area City/Municipality";
                    transactionLog.AffectedTable = "tOptionAdminAreaCityMunicipality";
                    var data = dto.TransactionType == CodeTransactionType.Update ? JsonConvert.DeserializeObject<OptionAdminAreaCityMunicipality>(dto.Json) : null;
                    if (data == null) return AamsOnlyLinkEditable("Cities/Municipalities", "province");
                    var existing = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id, cancellationToken);
                    if (existing == null)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"City/Municipality with Id {data.Id} was not found." });
                    if (data.Name != existing.Name || data.Code != existing.Code || data.Deprecated != existing.Deprecated)
                        return AamsOnlyLinkEditable("Cities/Municipalities", "province");
                    if (!await _db.tOptionAdminAreaProvince.AsNoTracking().AnyAsync(x => x.Code == data.ProvinceCode, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Province",
                            Message = $"The ProvinceCode '{data.ProvinceCode}' does not exist. Please select a valid Province."
                        });
                    }
                    if (existing.ProvinceCode != data.ProvinceCode)
                    {
                        transactionLog.AffectedColumn = "ProvinceCode";
                        transactionLog.NewValue = data.ProvinceCode;
                        transactionLog.OldValue = existing.ProvinceCode;
                        existing.ProvinceCode = data.ProvinceCode;
                    }
                    existing.UpdatedDate = CurrentDate;
                    _db.tOptionAdminAreaCityMunicipality.Update(existing);
                }
                else if (dto.Code == "AdminAreaDistrict")
                {
                    tablename = "Admin Area Congressional District";
                    transactionLog.AffectedTable = "tOptionAdminAreaCongressionalDistrict";
                    var data = dto.TransactionType == CodeTransactionType.Update ? JsonConvert.DeserializeObject<OptionAdminAreaCongressionalDistrict>(dto.Json) : null;
                    if (data == null) return AamsOnlyLinkEditable("Legislative Districts", "province");
                    var existing = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id, cancellationToken);
                    if (existing == null)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"District with Id {data.Id} was not found." });
                    if (data.Name != existing.Name || data.Code != existing.Code || data.Deprecated != existing.Deprecated)
                        return AamsOnlyLinkEditable("Legislative Districts", "province");
                    if (!await _db.tOptionAdminAreaProvince.AsNoTracking().AnyAsync(x => x.Code == data.ProvinceCode, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Province",
                            Message = $"The ProvinceCode '{data.ProvinceCode}' does not exist. Please select a valid Province."
                        });
                    }
                    if (existing.ProvinceCode != data.ProvinceCode)
                    {
                        transactionLog.AffectedColumn = "ProvinceCode";
                        transactionLog.NewValue = data.ProvinceCode;
                        transactionLog.OldValue = existing.ProvinceCode;
                        existing.ProvinceCode = data.ProvinceCode;
                    }
                    existing.UpdatedDate = CurrentDate;
                    _db.tOptionAdminAreaCongressionalDistrict.Update(existing);
                }
                else if (dto.Code == "AdminAreaDEO")
                {
                    tablename = "Admin Area District Engineering Office";
                    transactionLog.AffectedTable = "tOptionAdminOffice";
                    var data = dto.TransactionType == CodeTransactionType.Update ? JsonConvert.DeserializeObject<OptionAdminOffice>(dto.Json) : null;
                    if (data == null) return AamsOnlyLinkEditable("DEOs", "region");
                    var existing = await _db.tOptionAdminOffice.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id && x.OfficeType == "DEO", cancellationToken);
                    if (existing == null)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"DEO with Id {data.Id} was not found." });
                    if (data.Name != existing.Name || data.ParticipantId != existing.ParticipantId)
                        return AamsOnlyLinkEditable("DEOs", "region");
                    if (string.IsNullOrWhiteSpace(data.RegionParticipantId)
                        || !await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(x => x.ParticipantId == data.RegionParticipantId, cancellationToken))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Invalid Region",
                            Message = $"The RegionParticipantId '{data.RegionParticipantId}' does not exist. Please select a valid Region."
                        });
                    }
                    if (existing.RegionParticipantId != data.RegionParticipantId)
                    {
                        transactionLog.AffectedColumn = "RegionParticipantId";
                        transactionLog.NewValue = data.RegionParticipantId;
                        transactionLog.OldValue = existing.RegionParticipantId ?? string.Empty;
                        existing.RegionParticipantId = data.RegionParticipantId;
                    }
                    existing.UpdatedDate = CurrentDate;
                    _db.tOptionAdminOffice.Update(existing);
                }
                else
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Code",
                        Message = $"The code {dto.Code} is not valid."
                    });
                }
                _db.tCodeTableTransactionLog.AddRange(transactionLog.Rows());
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync();
                return Ok(new
                {
                    Title = "Update Success",
                    Message = $"{tablename} updated successfully."
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// The audit rows of one Code Tables save: one row per changed column. The branches of
        /// UpdateCodeTable set AffectedColumn, NewValue and OldValue once per changed field; on a single
        /// CodeTableTransactionLog each field overwrote the previous one, so an edit that changed the
        /// name and the description logged only the description (2026-10-29). Setting AffectedColumn
        /// starts a new row; NewValue / OldValue fill the current one (a delete sets only those).
        /// </summary>
        private sealed class CodeTableChangeLog
        {
            private readonly List<CodeTableTransactionLog> _rows = new();
            private CodeTableTransactionLog? _current;

            public string TransactionId { get; set; } = string.Empty;
            public string TypeOfTransaction { get; set; } = string.Empty;
            public string AffectedTable { get; set; } = string.Empty;
            public string CreatedBy { get; set; } = string.Empty;
            public DateTime CreatedDate { get; set; }

            public string AffectedColumn
            {
                get => Current.AffectedColumn;
                set { _current = new CodeTableTransactionLog { AffectedColumn = value ?? string.Empty }; _rows.Add(_current); }
            }
            public string NewValue { get => Current.NewValue; set => Current.NewValue = value ?? string.Empty; }
            public string OldValue { get => Current.OldValue; set => Current.OldValue = value ?? string.Empty; }

            private CodeTableTransactionLog Current
            {
                get
                {
                    if (_current == null) { _current = new CodeTableTransactionLog(); _rows.Add(_current); }
                    return _current;
                }
            }

            /// <summary>The rows to save; one blank row when nothing changed, as before.</summary>
            public IEnumerable<CodeTableTransactionLog> Rows()
            {
                var rows = _rows.Count > 0 ? _rows : new List<CodeTableTransactionLog> { new() };
                foreach (var row in rows)
                {
                    row.TransactionId = TransactionId;
                    row.TypeOfTransaction = TypeOfTransaction;
                    row.AffectedTable = AffectedTable;
                    row.CreatedBy = CreatedBy;
                    row.CreatedDate = CreatedDate;
                }
                return rows;
            }
        }
    }
}



