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
using WebAPI.Controllers.Projects;
namespace WebAPI.Controllers.Importing
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ImportingController : CoreController
    {
        public ImportingController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> ImportProject([FromBody] ImportProjectDTO dto)
        {
            var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                #region Program Validation
                var IsValidProgram = _db.IsValidProgramId(dto.ProgramDetails.ProgramId, dto.ProgramDetails.StageName);
                if(!IsValidProgram.IsValid)
                {
                    return new BadRequestObjectResult(new { Message = IsValidProgram.Message, Tile = "Validation Error." });
                }
                #endregion

                List<ImportProjectReference> ProjectReference = new List<ImportProjectReference>();
                #region Projects
                DBHelper.Models.Table.Projects projects = new DBHelper.Models.Table.Projects();
                //List<DBHelper.Models.Table.ProjectRevisions> projectrevisions = new List<DBHelper.Models.Table.ProjectRevisions>();
                List<DBHelper.Models.Table.ProjectStages> projectstages = new List<DBHelper.Models.Table.ProjectStages>();
                string User = _Session.UserId;
                DateTime CurrentDate = Functions.CurrentDate();
                foreach (var Item in dto.ProjectDetails)
                {
                    ImportProjectReference AddProject = new ImportProjectReference
                    {
                        OldProjectId = Item.ProjectId,
                        NewProjectId = string.Empty
                    };
                    var Projects = _db.GenerateProject(IsValidProgram.ProgramDetails, Item);
                    if (!Projects.IsValid)
                    {
                        return new BadRequestObjectResult(new { Message = Projects.Message, Tile = "Project Validation Error." });
                    }
                    AddProject.NewProjectId = Projects.Project.ReferenceId;
                    Projects.Project.CreatedBy = User;
                    Projects.Project.CreatedDate = CurrentDate;
                    Projects.ProjectRevision.CreatedBy = User;
                    Projects.ProjectRevision.CreatedDate = CurrentDate;
                    if(projects == null)
                    {
                        projects = Projects.Project;
                    }
                    ProjectReference.Add(AddProject);
                    _db.tProjectRevisions.Add(Projects.ProjectRevision);
                    _db.SaveChanges();

                    Projects.ProjectStage.RevisionId = Projects.ProjectRevision.Id;
                    Projects.ProjectStage.CreatedBy = User;
                    Projects.ProjectStage.CreatedDate = CurrentDate;

                    projectstages.Add(Projects.ProjectStage);
                }
                await _db.tProjects.AddAsync(projects);
                await _db.tProjectStages.AddRangeAsync(projectstages);
                #endregion

                #region Fundin Profile
                List<DBHelper.Models.Table.ProjectFundingProfile> FundingProfile = new List<DBHelper.Models.Table.ProjectFundingProfile>();
                foreach (var Item in dto.FundingProfile)
                {
                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
                    if (Reference != null)
                    {
                        var Validate = _db.GenerateFundingProfile(Item, Reference);
                        if(!Validate.IsValid)
                        {
                            return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Funding Profile Validation Error." });
                        }
                        Validate.FundingProfile.CreatedBy = User;
                        Validate.FundingProfile.CreatedDate = CurrentDate;
                        Validate.FundingProfile.StageName = IsValidProgram.ProgramDetails.StageName;
                        FundingProfile.Add(Validate.FundingProfile);
                    }
                }
                await _db.tProjectFundingProfile.AddRangeAsync(FundingProfile);
                #endregion

                #region Component Cost
                List<DBHelper.Models.Table.ProjectComponentCost> ComponentCost = new List<DBHelper.Models.Table.ProjectComponentCost>();
                foreach(var Item in dto.ComponentCosts)
                {
                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
                    if (Reference != null)
                    {
                        var Validate = _db.GenerateComponentCost(Item, Reference);
                        if (!Validate.IsValid)
                        {
                            return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Validation Error." });
                        }
                        Validate.ComponentCost.CreatedBy = User;
                        Validate.ComponentCost.CreatedDate = CurrentDate;
                        Validate.ComponentCost.StageName = IsValidProgram.ProgramDetails.StageName;
                        ComponentCost.Add(Validate.ComponentCost);
                    }
                }
                await _db.tProjectComponentCost.AddRangeAsync(ComponentCost);
                #endregion

                #region Component Cost Per Year
                List<DBHelper.Models.Table.ProjectComponentCostPerYear> ComponentCostPerYear = new List<DBHelper.Models.Table.ProjectComponentCostPerYear>();
                foreach (var Item in dto.ComponentCostPerYear)
                {
                    var Reference = ComponentCost.FirstOrDefault(x => x.CostId == Item.ComponentCostId);
                    if (Reference != null)
                    {
                        var Validate = _db.GenerateComponentCostPerYear(Item);
                        if (!Validate.IsValid)
                        {
                            return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Component Cost Per Year Validation Error." });
                        }
                        Validate.ComponentCostPerYear.CreatedBy = User;
                        Validate.ComponentCostPerYear.CreatedDate = CurrentDate;
                        Validate.ComponentCostPerYear.StageName = IsValidProgram.ProgramDetails.StageName;
                        ComponentCostPerYear.Add(Validate.ComponentCostPerYear);
                    }
                }
                await _db.tProjectComponentCostPerYear.AddRangeAsync(ComponentCostPerYear);
                #endregion

                #region MajorItemOfWork
                List<DBHelper.Models.Table.ProjectMajorWorkItem> MajorItemOfWork = new List<DBHelper.Models.Table.ProjectMajorWorkItem>();
                foreach (var Item in dto.MajorItemOfWorks)
                {
                    var Reference = ProjectReference.FirstOrDefault(x => x.OldProjectId == Item.ProjectId);
                    if (Reference != null)
                    {
                        var Validate = _db.GenerateMajorWorkItem(Item, Reference);
                        if (!Validate.IsValid)
                        {
                            return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Item Of Work Validation Error." });
                        }
                        Validate.MajorWorkItem.CreatedBy = User;
                        Validate.MajorWorkItem.CreatedDate = CurrentDate;
                        Validate.MajorWorkItem.StageName = IsValidProgram.ProgramDetails.StageName;
                        MajorItemOfWork.Add(Validate.MajorWorkItem);
                    }
                }
                await _db.tProjectMajorWorkItem.AddRangeAsync(MajorItemOfWork);
                #endregion

                #region MajorWorkLocations
                List<DBHelper.Models.Table.ProjectMajorWorkLocations> MajorWorkLocations = new List<DBHelper.Models.Table.ProjectMajorWorkLocations>();
                foreach (var Item in dto.MajorItemLocations)
                {
                    var Reference = MajorItemOfWork.FirstOrDefault(x => x.ReferenceId == Item.ParentId);
                    if (Reference != null)
                    {
                        var Validate = _db.GenerateMajorWorkLocation(Item);
                        if (!Validate.IsValid)
                        {
                            return new BadRequestObjectResult(new { Message = Validate.Message, Tile = "Major Work Locations Validation Error." });
                        }
                        Validate.MajorWorkLocation.CreatedBy = User;
                        Validate.MajorWorkLocation.CreatedDate = CurrentDate;
                        MajorWorkLocations.Add(Validate.MajorWorkLocation);
                    }
                }
                await _db.tProjectMajorWorkLocations.AddRangeAsync(MajorWorkLocations);
                #endregion
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new { Message = "Notes added successfully!", Tile = "Add Success." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return ExceptionHandler(ex);
            }
        }
    }
}