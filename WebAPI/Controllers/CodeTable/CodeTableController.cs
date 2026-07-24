using Confluent.Kafka;
using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table;
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
namespace WebAPI.Controllers.CodeTable
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class CodeTableController : CoreController
    {
        public CodeTableController(MYPSDbContext db, IProducer<Null, string> producer, PCMADbContext pcma) : base(db, producer, pcma) { }
        
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
        
        [HttpPost]
        public async Task<IActionResult> GetAdminAreas()
        {
            try
            {
                var regions   = await _db.tOptionAdminAreaRegion.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var cities    = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().OrderBy(x => x.Name).ToListAsync();
                var deos      = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().OrderBy(x => x.Name).ToListAsync();

                return Ok(new
                {
                    Regions   = regions,
                    Provinces = provinces,
                    Cities    = cities,
                    Districts = districts,
                    DEOs      = deos
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        
        [HttpPost]
        public async Task<IActionResult> GetTransactionLog([FromBody] GetTransactionLogDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                string AffectedTable = string.Empty;
                switch(dto.TableCode)
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
                        AffectedTable = "tOptionProjectCategory";
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
                        AffectedTable = "tOptionProjectComponent";
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
                }
                var CodeTableLists = await _db.tCodeTableTransactionLog.Where(x => x.AffectedTable == AffectedTable).ToListAsync();
                return Ok(new
                {
                    Logs = CodeTableLists,
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> UpdateCodeTable([FromBody] UpdateCodeTableDTO dto, CancellationToken cancellationToken)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                //Program
                CodeTableTransactionLog transactionLog = new CodeTableTransactionLog();
                string tablename = "";
                DateTime CurrentDate = Functions.CurrentDate();

                string hostName = User.FindFirstValue(ClaimTypes.GivenName) ?? "Unknown";
                string userId = _Session.UserId ?? "Unknown";
                string timestamp = CurrentDate.ToString("yyyyMMddHHmmssfff");
                transactionLog.TransactionId = $"{hostName}_{userId}_{timestamp}";
                transactionLog.TypeOfTransaction = dto.TransactionType.ToString();
                transactionLog.CreatedDate = CurrentDate;
                transactionLog.CreatedBy = _Session.UserId!;

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
                    var CheckIfAlreadyUse = await _db.tProgramStages.AsNoTracking().FirstOrDefaultAsync(x => x.StageName == data.Name);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Already in Use",
                            Message = $"The program stage {data.Name} is already in use and cannot be modified, please select another program stage."
                        });
                    }
                    else if (CheckIfAlreadyUse != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Stage Already Exists",
                            Message = $"The program stage {data.Name} already exists, please select another program stage."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramStage.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionProgramStage.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                        data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
                        await _db.tOptionProgramStage.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update)
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
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (CheckUpdate.IsActive != data.IsActive)
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
                        _db.tOptionProgramStage.Remove(data);
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
                    var CheckIfAlreadyUse = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Status == (EnumProgramStatus)data.NameId);
                    if (CheckIfAlreadyUse == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Status In Use",
                            Message = "The selected program status is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionProgramStatus.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                        data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
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
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (CheckUpdate.IsActive != data.IsActive)
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
                        _db.tOptionProgramStatus.Remove(data);
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
                    var CheckIfAlreadyUse = await _db.tProgramRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Type == (EnumProgramType)data.NameId);
                    if (CheckIfAlreadyUse == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Program Type In Use",
                            Message = "The selected program type is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProgramType.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionProgramType.AsNoTracking().OrderByDescending(x => x.NameId).FirstOrDefault();
                        data.NameId = (CheckMaxId != null) ? CheckMaxId.NameId + 1 : 1;
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
                            transactionLog.NewValue = data.Description!;
                            transactionLog.OldValue = CheckUpdate.Description!;
                            CheckUpdate.Description = data.Description;
                        }
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Category == data.CategoryId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Category In Use",
                            Message = "The selected project category is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryName == data.CategoryName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                        _db.tOptionProjectCategory.Remove(CheckUpdate);
                    }
                }
                else if (dto.Code == "ProjectThrust")
                {
                    tablename = "Project Thrust";
                    transactionLog.AffectedTable = "tOptionProjectCategory";
                    var data = JsonConvert.DeserializeObject<ProjectThrustLists>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Thrust Selected",
                            Message = "No Project Thrust has been selected, please select a project thrust."
                        });
                    }
                    var CheckIfAlreadyUse = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Thrust == data.PAPKey);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust In Use",
                            Message = "The selected project thrust is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckDescriptionIfExists = await _db.tProjectThrustLists.AsNoTracking().FirstOrDefaultAsync(x => x.ThrustDescription == data.ThrustDescription);
                    if (CheckDescriptionIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust Already Exists",
                            Message = $"The project thrust {data.ThrustDescription} already exists, please select another project thrust."
                        });
                    }
                    var CheckIfPAPKeyExist = await _db.tProjectThrustLists.AsNoTracking().FirstOrDefaultAsync(x => x.PAPKey == data.PAPKey);
                    if (CheckIfPAPKeyExist != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust PAP Key Already Exists",
                            Message = $"The project thrust PAP key {data.PAPKey} already exists, please select another project thrust PAP key."
                        });
                    }
                    var CheckUpdate = await _db.tProjectThrustLists.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Thrust Not Found",
                            Message = $"The project thrust with id {data.Id} is not found, please select another project thrust."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tProjectThrustLists.AddAsync(data);
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
                        if (CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tProjectThrustLists.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tProjectThrustLists.Remove(CheckUpdate);
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
                    var CheckIfAlreadyUse = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Agency == data.NameId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency In Use",
                            Message = "The selected project agency is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Agency Already Exists",
                            Message = $"The project agency {data.Name} already exists, please select another project agency."
                        });
                    }
                    var CheckIfNameIdExist = await _db.tOptionProjectAgency.AsNoTracking().FirstOrDefaultAsync(x => x.NameId == data.NameId);
                    if (CheckIfNameIdExist != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tProjectRevisions.AsNoTracking().FirstOrDefaultAsync(x => x.Origin == data.NameId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Origin In Use",
                            Message = "The selected project origin is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tProjectFundingProfile.AsNoTracking().FirstOrDefaultAsync(x => x.Agreement == data.Code);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement In Use",
                            Message = "The selected funding agreement is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Agreement Already Exists",
                            Message = $"The funding agreement {data.Name} already exists, please select another funding agreement."
                        });
                    }
                    var CheckIfCodeExist = await _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefaultAsync(x => x.Code == data.Code);
                    if (CheckIfCodeExist != null && dto.TransactionType == CodeTransactionType.Create)
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
                            transactionLog.NewValue = data.FinancingSourceSegmentCode!;
                            transactionLog.OldValue = CheckUpdate.FinancingSourceSegmentCode!;
                            CheckUpdate.FinancingSourceSegmentCode = data.FinancingSourceSegmentCode;
                        }
                        if (CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        CheckUpdate.UpdatedBy = data.UpdatedBy;
                        CheckUpdate.UpdatedDate = CurrentDate;
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
                    var CheckIfAlreadyUse = await _db.tProjectFundingProfile.AsNoTracking().FirstOrDefaultAsync(x => x.Source == data.Organization);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source In Use",
                            Message = "The selected funding source is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Funding Source Already Exists",
                            Message = $"The funding source {data.Name} already exists, please select another funding source."
                        });
                    }
                    var CheckIfOrganizationExist = await _db.tOptionFundingSource.AsNoTracking().FirstOrDefaultAsync(x => x.Organization == data.Organization);
                    if (CheckIfOrganizationExist != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        CheckUpdate.UpdatedBy = data.UpdatedBy;
                        CheckUpdate.UpdatedDate = CurrentDate;
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
                    var CheckIfAlreadyUse = await _db.tProjectMajorWorkItem.AsNoTracking().FirstOrDefaultAsync(x => x.WorkTypeId == data.Enum);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Scope Of Work In Use",
                            Message = "The selected scope of work is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefaultAsync(x => x.WorkCategory == data.WorkCategory);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Work Category Already Exists",
                            Message = $"The work category {data.WorkCategory} already exists, please choose another work category."
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
                        if (CheckUpdate.InfraType != data.InfraType)
                        {
                            var validInfraCodes = await _db.tOptionInfraType
                            .Select(x => x.InfraCode)
                            .ToListAsync();
                            var nonExistingInfraTypes = data.InfraType
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
                            transactionLog.AffectedColumn = "InfraType";
                            transactionLog.NewValue = $"{data.InfraType}";
                            transactionLog.OldValue = $"{CheckUpdate.InfraType}";
                            CheckUpdate.InfraType = data.InfraType;
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
                        if (CheckUpdate.MinAmount != data.MinAmount)
                        {
                            transactionLog.AffectedColumn = "MinAmount";
                            transactionLog.NewValue = $"{data.MinAmount}";
                            transactionLog.OldValue = $"{CheckUpdate.MinAmount}";
                            CheckUpdate.MinAmount = data.MinAmount;
                        }
                        if(CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tProjectMajorWorkItem.AsNoTracking().FirstOrDefaultAsync(x => x.InfraType == data.InfraName);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type In Use",
                            Message = "The selected infra type is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(x => x.InfraName == data.InfraName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Infra Type Already Exists",
                            Message = $"The infra type {data.InfraName} already exists, please select another infra type."
                        });
                    }
                    var CheckIfInfraCodeExist = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(x => x.InfraCode == data.InfraCode);
                    if (CheckIfInfraCodeExist != null && dto.TransactionType == CodeTransactionType.Create)
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
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        var CheckMaxId = _db.tOptionInfraType.AsNoTracking().OrderByDescending(x => x.InfraCode).FirstOrDefault();
                        data.InfraId = (CheckMaxId != null) ? CheckMaxId.InfraId + 1 : 1;
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    transactionLog.AffectedTable = "tOptionProjectComponent";
                    var data = JsonConvert.DeserializeObject<OptionProjectComponent>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Project Component Selected",
                            Message = "No Project Component has been selected, please select a project component."
                        });
                    }
                    var CheckIfAlreadyUse = await _db.tProjectComponentCost.AsNoTracking().FirstOrDefaultAsync(x => x.ComponentType == data.ComponentName);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component In Use",
                            Message = "The selected project component is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionProjectComponent.AsNoTracking().FirstOrDefaultAsync(x => x.ComponentName == data.ComponentName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Already Exists",
                            Message = $"The project component {data.ComponentName} already exists, please select another project component."
                        });
                    }
                    var CheckIfComponentIdExist = await _db.tOptionProjectComponent.AsNoTracking().FirstOrDefaultAsync(x => x.ComponentId == data.ComponentId);
                    if (CheckIfComponentIdExist != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Id Already Exists",
                            Message = $"The project component id {data.ComponentId} already exists, please select another project component id."
                        });
                    }
                    var CheckUpdate = await _db.tOptionProjectComponent.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (CheckUpdate == null && dto.TransactionType != CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Project Component Not Found",
                            Message = $"The project component with id {data.Id} is not found, please select another project component."
                        });
                    }
                    #endregion
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty;
                        transactionLog.NewValue = dto.Json;
                        transactionLog.OldValue = string.Empty;
                        await _db.tOptionProjectComponent.AddAsync(data);
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
                        if (CheckUpdate.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = CheckUpdate.IsActive ? "True" : "False";
                            CheckUpdate.IsActive = data.IsActive;
                        }
                        _db.tOptionProjectComponent.Update(CheckUpdate);
                    }
                    else if (CheckUpdate != null && dto.TransactionType == CodeTransactionType.Delete)
                    {
                        transactionLog.NewValue = string.Empty;
                        transactionLog.OldValue = JsonConvert.SerializeObject(CheckUpdate);
                        _db.tOptionProjectComponent.Remove(CheckUpdate);
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
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == data.RevisionGroupId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Header In Use",
                            Message = "The selected revision header is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionHeader.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionName == data.RevisionName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryId == data.CategoryId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Category In Use",
                            Message = "The selected revision category is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionCategory.AsNoTracking().FirstOrDefaultAsync(x => x.CategoryName == data.CategoryName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == data.ReasonId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Reason In Use",
                            Message = "The selected revision reason is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionReasons.AsNoTracking().FirstOrDefaultAsync(x => x.Reason == data.Reason);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        if (CheckUpdate.CategoryId != data.CategoryId)
                        {
                            var validCategoryIds = await _db.tOptionRevisionCategory
                                .Select(x => x.CategoryId)
                                .ToListAsync();
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
                            transactionLog.NewValue = $"{data.CategoryId}";
                            transactionLog.OldValue = $"{CheckUpdate.CategoryId}";
                            CheckUpdate.CategoryId = data.CategoryId;
                        }
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var data = JsonConvert.DeserializeObject<DBHelper.Models.Table.RevisionRules>(dto.Json);
                    #region Validation
                    if (data == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "No Revision Rule Selected",
                            Message = "No Revision Rule has been selected, please select a revision rule."
                        });
                    }
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.ReasonId == data.ReasonId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Rule In Use",
                            Message = "The selected revision rule is currently in use and cannot be deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tRevisionRules.AsNoTracking().FirstOrDefaultAsync(x => x.PCMA_Status == data.PCMA_Status && x.Package_Status == data.Package_Status && x.Field == data.Field);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Rule Already Exists",
                            Message = $"The revision rule with PCMA Status {data.PCMA_Status}, Package Status {data.Package_Status} and Field {data.Field} already exists, please select another revision rule."
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.RevisionGroupId == data.RevisionGroupId);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Document In Use",
                            Message = "The selected revision document is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.SecondSegmentName == data.SecondSegmentName);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                            if(data.CategoryId != null)
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                    var CheckIfAlreadyUse = await _db.tRevisionDetails.AsNoTracking().FirstOrDefaultAsync(x => x.RegionStatus == data.Enum || x.COStatus == data.Enum);
                    if (CheckIfAlreadyUse != null && (dto.TransactionType == CodeTransactionType.Update || dto.TransactionType == CodeTransactionType.Delete))
                    {
                        return new BadRequestObjectResult(new
                        {
                            Title = "Revision Status In Use",
                            Message = "The selected revision status is currently in use and cannot be updated or deleted."
                        });
                    }
                    var CheckNameIfExists = await _db.tOptionRevisionStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Name == data.Name);
                    if (CheckNameIfExists != null && dto.TransactionType == CodeTransactionType.Create)
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
                        var CheckMaxId = _db.tOptionRevisionStatus.AsNoTracking().OrderByDescending(x => x.Enum).FirstOrDefault();
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
                        if (CheckUpdate.IsActive != data.IsActive)
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
                else if (dto.Code == "AdminAreaRegion")
                {
                    tablename = "Admin Area Region";
                    transactionLog.AffectedTable = "tOptionAdminAreaRegion";
                    var data = JsonConvert.DeserializeObject<OptionAdminAreaRegion>(dto.Json);
                    if (data == null) return new BadRequestObjectResult(new { Title = "Invalid Data", Message = "No data provided." });
                    var existing = await _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (existing == null && dto.TransactionType != CodeTransactionType.Create)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"Region with Id {data.Id} was not found." });
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty; transactionLog.OldValue = string.Empty; transactionLog.NewValue = dto.Json;
                        await _db.tOptionAdminAreaRegion.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update && existing != null)
                    {
                        if (existing.GdbId != data.GdbId)
                        {
                            transactionLog.AffectedColumn = "GdbId";
                            transactionLog.NewValue = data.GdbId!;
                            transactionLog.OldValue = existing.GdbId!;
                            existing.GdbId = data.GdbId;
                        }
                        if(existing.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = existing.Name!;
                            existing.Name = data.Name;
                        }
                        if (existing.ParticipantId != data.ParticipantId)
                        {
                            transactionLog.AffectedColumn = "ParticipantId";
                            transactionLog.NewValue = data.ParticipantId!;
                            transactionLog.OldValue = existing.ParticipantId!;
                            existing.ParticipantId = data.ParticipantId;
                        }
                        if (existing.IslandCode != data.IslandCode)
                        {
                            transactionLog.AffectedColumn = "IslandCode";
                            transactionLog.NewValue = data.IslandCode!;
                            transactionLog.OldValue = existing.IslandCode!;
                            existing.IslandCode = data.IslandCode;
                        }
                        if (existing.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = existing.IsActive ? "True" : "False";
                            existing.IsActive = data.IsActive;
                        }
                        _db.tOptionAdminAreaRegion.Update(existing);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete && existing != null)
                    {
                        transactionLog.OldValue = JsonConvert.SerializeObject(existing); transactionLog.NewValue = string.Empty; transactionLog.AffectedColumn = string.Empty;
                        _db.tOptionAdminAreaRegion.Remove(existing);
                    }
                }
                else if (dto.Code == "AdminAreaProvince")
                {
                    tablename = "Admin Area Province";
                    transactionLog.AffectedTable = "tOptionAdminAreaProvince";
                    var data = JsonConvert.DeserializeObject<OptionAdminAreaProvince>(dto.Json);
                    if (data == null) return new BadRequestObjectResult(new { Title = "Invalid Data", Message = "No data provided." });
                    var existing = await _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (existing == null && dto.TransactionType != CodeTransactionType.Create)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"Province with Id {data.Id} was not found." });
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty; transactionLog.OldValue = string.Empty; transactionLog.NewValue = dto.Json;
                        await _db.tOptionAdminAreaProvince.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update && existing != null)
                    {
                        if (existing.GdbId != data.GdbId)
                        {
                            transactionLog.AffectedColumn = "GdbId";
                            transactionLog.NewValue = data.GdbId!;
                            transactionLog.OldValue = existing.GdbId!;
                            existing.GdbId = data.GdbId;
                        }
                        if (existing.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = existing.Name!;
                            existing.Name = data.Name;
                        }
                        if (existing.Code != data.Code)
                        {
                            transactionLog.AffectedColumn = "Code";
                            transactionLog.NewValue = data.Code!;
                            transactionLog.OldValue = existing.Code!;
                            existing.Code = data.Code;
                        }
                        if (existing.RegionParticipantId != data.RegionParticipantId)
                        {
                            transactionLog.AffectedColumn = "RegionParticipantId";
                            transactionLog.NewValue = data.RegionParticipantId!;
                            transactionLog.OldValue = existing.RegionParticipantId!;
                            existing.RegionParticipantId = data.RegionParticipantId;
                        }
                        if (existing.RegionName != data.RegionName)
                        {
                            transactionLog.AffectedColumn = "RegionName";
                            transactionLog.NewValue = data.RegionName!;
                            transactionLog.OldValue = existing.RegionName!;
                            existing.RegionName = data.RegionName;
                        }
                        if (existing.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = existing.IsActive ? "True" : "False";
                            existing.IsActive = data.IsActive;
                        }
                        _db.tOptionAdminAreaProvince.Update(existing);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete && existing != null)
                    {
                        transactionLog.OldValue = JsonConvert.SerializeObject(existing); transactionLog.NewValue = string.Empty; transactionLog.AffectedColumn = string.Empty;
                        _db.tOptionAdminAreaProvince.Remove(existing);
                    }
                }
                else if (dto.Code == "AdminAreaCity")
                {
                    tablename = "Admin Area City/Municipality";
                    transactionLog.AffectedTable = "tOptionAdminAreaCityMunicipality";
                    var data = JsonConvert.DeserializeObject<OptionAdminAreaCityMunicipality>(dto.Json);
                    if (data == null) return new BadRequestObjectResult(new { Title = "Invalid Data", Message = "No data provided." });
                    var existing = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (existing == null && dto.TransactionType != CodeTransactionType.Create)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"City/Municipality with Id {data.Id} was not found." });
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty; transactionLog.OldValue = string.Empty; transactionLog.NewValue = dto.Json;
                        await _db.tOptionAdminAreaCityMunicipality.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update && existing != null)
                    {
                        if (existing.GdbId != data.GdbId)
                        {
                            transactionLog.AffectedColumn = "GdbId";
                            transactionLog.NewValue = data.GdbId!;
                            transactionLog.OldValue = existing.GdbId!;
                            existing.GdbId = data.GdbId;
                        }
                        if (existing.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = existing.Name!;
                            existing.Name = data.Name;
                        }
                        if (existing.Code != data.Code)
                        {
                            transactionLog.AffectedColumn = "Code";
                            transactionLog.NewValue = data.Code!;
                            transactionLog.OldValue = existing.Code!;
                            existing.Code = data.Code;
                        }
                        if (existing.ProvinceGdbId != data.ProvinceGdbId)
                        {
                            transactionLog.AffectedColumn = "ProvinceGdbId";
                            transactionLog.NewValue = data.ProvinceGdbId!;
                            transactionLog.OldValue = existing.ProvinceGdbId!;
                            existing.ProvinceGdbId = data.ProvinceGdbId;
                        }
                        if (existing.ProvinceName != data.ProvinceName)
                        {
                            transactionLog.AffectedColumn = "ProvinceName";
                            transactionLog.NewValue = data.ProvinceName!;
                            transactionLog.OldValue = existing.ProvinceName!;
                            existing.ProvinceName = data.ProvinceName;
                        }
                        if (existing.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = existing.IsActive ? "True" : "False";
                            existing.IsActive = data.IsActive;
                        }
                        _db.tOptionAdminAreaCityMunicipality.Update(existing);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete && existing != null)
                    {
                        transactionLog.OldValue = JsonConvert.SerializeObject(existing); transactionLog.NewValue = string.Empty; transactionLog.AffectedColumn = string.Empty;
                        _db.tOptionAdminAreaCityMunicipality.Remove(existing);
                    }
                }
                else if (dto.Code == "AdminAreaDistrict")
                {
                    tablename = "Admin Area Congressional District";
                    transactionLog.AffectedTable = "tOptionAdminAreaCongressionalDistrict";
                    var data = JsonConvert.DeserializeObject<OptionAdminAreaCongressionalDistrict>(dto.Json);
                    if (data == null) return new BadRequestObjectResult(new { Title = "Invalid Data", Message = "No data provided." });
                    var existing = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (existing == null && dto.TransactionType != CodeTransactionType.Create)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"District with Id {data.Id} was not found." });
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty; transactionLog.OldValue = string.Empty; transactionLog.NewValue = dto.Json;
                        await _db.tOptionAdminAreaCongressionalDistrict.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update && existing != null)
                    {
                        if (existing.GdbId != data.GdbId)
                        {
                            transactionLog.AffectedColumn = "GdbId";
                            transactionLog.NewValue = data.GdbId!;
                            transactionLog.OldValue = existing.GdbId!;
                            existing.GdbId = data.GdbId;
                        }
                        if (existing.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = existing.Name!;
                            existing.Name = data.Name;
                        }
                        if (existing.Code != data.Code)
                        {
                            transactionLog.AffectedColumn = "Code";
                            transactionLog.NewValue = data.Code!;
                            transactionLog.OldValue = existing.Code!;
                            existing.Code = data.Code;
                        }
                        if (existing.ProvinceGdbId != data.ProvinceGdbId)
                        {
                            transactionLog.AffectedColumn = "ProvinceGdbId";
                            transactionLog.NewValue = data.ProvinceGdbId!;
                            transactionLog.OldValue = existing.ProvinceGdbId!;
                            existing.ProvinceGdbId = data.ProvinceGdbId;
                        }
                        if (existing.ProvinceName != data.ProvinceName)
                        {
                            transactionLog.AffectedColumn = "ProvinceName";
                            transactionLog.NewValue = data.ProvinceName!;
                            transactionLog.OldValue = existing.ProvinceName!;
                            existing.ProvinceName = data.ProvinceName;
                        }
                        if (existing.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = existing.IsActive ? "True" : "False";
                            existing.IsActive = data.IsActive;
                        }
                        _db.tOptionAdminAreaCongressionalDistrict.Update(existing);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete && existing != null)
                    {
                        transactionLog.OldValue = JsonConvert.SerializeObject(existing); transactionLog.NewValue = string.Empty; transactionLog.AffectedColumn = string.Empty;
                        _db.tOptionAdminAreaCongressionalDistrict.Remove(existing);
                    }
                }
                else if (dto.Code == "AdminAreaDEO")
                {
                    tablename = "Admin Area District Engineering Office";
                    transactionLog.AffectedTable = "tOptionAdminAreaDistrictEngineeringOffice";
                    var data = JsonConvert.DeserializeObject<OptionAdminAreaDistrictEngineeringOffice>(dto.Json);
                    if (data == null) return new BadRequestObjectResult(new { Title = "Invalid Data", Message = "No data provided." });
                    var existing = await _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefaultAsync(x => x.Id == data.Id);
                    if (existing == null && dto.TransactionType != CodeTransactionType.Create)
                        return new BadRequestObjectResult(new { Title = "Not Found", Message = $"DEO with Id {data.Id} was not found." });
                    if (dto.TransactionType == CodeTransactionType.Create)
                    {
                        transactionLog.AffectedColumn = string.Empty; transactionLog.OldValue = string.Empty; transactionLog.NewValue = dto.Json;
                        await _db.tOptionAdminAreaDistrictEngineeringOffice.AddAsync(data);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Update && existing != null)
                    {
                        if (existing.GdbId != data.GdbId)
                        {
                            transactionLog.AffectedColumn = "GdbId";
                            transactionLog.NewValue = data.GdbId!;
                            transactionLog.OldValue = existing.GdbId!;
                            existing.GdbId = data.GdbId;
                        }
                        if (existing.Name != data.Name)
                        {
                            transactionLog.AffectedColumn = "Name";
                            transactionLog.NewValue = data.Name!;
                            transactionLog.OldValue = existing.Name!;
                            existing.Name = data.Name;
                        }
                        if (existing.ParticipantId != data.ParticipantId)
                        {
                            transactionLog.AffectedColumn = "ParticipantId";
                            transactionLog.NewValue = data.ParticipantId!;
                            transactionLog.OldValue = existing.ParticipantId!;
                            existing.ParticipantId = data.ParticipantId;
                        }
                        if (existing.ProvinceGdbId != data.ProvinceGdbId)
                        {
                            transactionLog.AffectedColumn = "ProvinceGdbId";
                            transactionLog.NewValue = data.ProvinceGdbId!;
                            transactionLog.OldValue = existing.ProvinceGdbId!;
                            existing.ProvinceGdbId = data.ProvinceGdbId;
                        }
                        if (existing.ProvinceName != data.ProvinceName)
                        {
                            transactionLog.AffectedColumn = "ProvinceName";
                            transactionLog.NewValue = data.ProvinceName!;
                            transactionLog.OldValue = existing.ProvinceName!;
                            existing.ProvinceName = data.ProvinceName;
                        }
                        if (existing.RegionParticipantId != data.RegionParticipantId)
                        {
                            transactionLog.AffectedColumn = "RegionParticipantId";
                            transactionLog.NewValue = data.RegionParticipantId!;
                            transactionLog.OldValue = existing.RegionParticipantId!;
                            existing.RegionParticipantId = data.RegionParticipantId;
                        }
                        if (existing.RegionName != data.RegionName)
                        {
                            transactionLog.AffectedColumn = "RegionName";
                            transactionLog.NewValue = data.RegionName!;
                            transactionLog.OldValue = existing.RegionName!;
                            existing.RegionName = data.RegionName;
                        }
                        if (existing.IsActive != data.IsActive)
                        {
                            transactionLog.AffectedColumn = "IsActive";
                            transactionLog.NewValue = data.IsActive ? "True" : "False";
                            transactionLog.OldValue = existing.IsActive ? "True" : "False";
                            existing.IsActive = data.IsActive;
                        }
                        _db.tOptionAdminAreaDistrictEngineeringOffice.Update(existing);
                    }
                    else if (dto.TransactionType == CodeTransactionType.Delete && existing != null)
                    {
                        transactionLog.OldValue = JsonConvert.SerializeObject(existing); transactionLog.NewValue = string.Empty; transactionLog.AffectedColumn = string.Empty;
                        _db.tOptionAdminAreaDistrictEngineeringOffice.Remove(existing);
                    }
                }
                else
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Invalid Code",
                        Message = $"The code {dto.Code} is not valid."
                    });
                }
                _db.tCodeTableTransactionLog.Add(transactionLog);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new
                {
                    Title = "Udpate Success",
                    Message = $"{tablename} updated successfully."
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
    }
}