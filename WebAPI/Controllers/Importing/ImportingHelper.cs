using DBHelper.Data;
using Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Net.NetworkInformation;
using System.Runtime.CompilerServices;
namespace WebAPI.Controllers.Importing
{
    public static class ImportingHelper
    {
        public class ValidationResponse
        {
            public string Message { get; set; } = string.Empty;
            public bool IsValid { get; set; } = false;
        }
        public static DateTime? StringToDate(this string str)
        {
            return DateTime.TryParseExact("01/25/2026", "MM/dd/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime result)
            ? result
            : null;
        }
        public class IsValidProgramIdResponse : ValidationResponse
        {
            public DBHelper.Models.Views.ProgramDetails ProgramDetails { get; set; } = new DBHelper.Models.Views.ProgramDetails();
        }
        #region Program Validation
        public static IsValidProgramIdResponse IsValidProgramId(this AppDbContext _db, string ProgramID, string StageName)
        {
            var CheckProgram = _db.vPrograms.AsNoTracking().FirstOrDefault(x => x.ProgramId == ProgramID);
            if (CheckProgram == null)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"ProgramID: {ProgramID} does not exist." };
            }
            else if (CheckProgram.StageName != StageName)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"The provided stage '{StageName}' does not match the latest stage for Program '{ProgramID}'. Current stage: '{CheckProgram.StageName}'" };
            }
            var Details = _db.vProgramDetails.AsNoTracking().FirstOrDefault(x => x.ProgramId == ProgramID && x.StageName == StageName);
            if (Details == null)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"Program details not found for ProgramID: {ProgramID} at Stage: {StageName}." };
            }
            return new IsValidProgramIdResponse { IsValid = true, Message = string.Empty, ProgramDetails = Details };
        }
        #endregion
        #region Project Validation
        public class GenerateProjecttResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Projects Project { get; set; } = new DBHelper.Models.Table.Projects();
            public DBHelper.Models.Table.ProjectRevisions ProjectRevision { get; set; } = new DBHelper.Models.Table.ProjectRevisions();
            public DBHelper.Models.Table.ProjectStages ProjectStage { get; set; } = new DBHelper.Models.Table.ProjectStages();
        }
        public static GenerateProjecttResponse GenerateProject(this AppDbContext _db, DBHelper.Models.Views.ProgramDetails ProgramDetails, ImportProjectDetails details)
        {
            #region Validation
            var Category = _db.tOptionProjectCategory.AsNoTracking().FirstOrDefault(x => x.CategoryName == details.Category);
            if (Category == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Project Category in ProjectId: {details.ProjectId}, Selected Category: {details.Category}" };
            }
            var Thrust = _db.tProjectThrustLists.AsNoTracking().FirstOrDefault(x => x.ThrustDescription == details.Thrust);
            if (Thrust == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Thrust in ProjectId: {details.ProjectId}, Selected Thrust: {details.Thrust}" };
            }
            var Origin = _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefault(x => x.Name == details.Origin);
            if (Origin == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Project Origin in ProjectId: {details.ProjectId}, Selected Origin: {details.Origin}" };
            }
            var City = _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefault(x => x.Name == details.City);
            if (City == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect City in ProjectId: {details.ProjectId}, Selected City: {details.City}" };
            }
            var Province = _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefault(x => x.Name == details.Province);
            if (Province == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Province in ProjectId: {details.ProjectId}, Selected Province: {details.Province}" };
            }
            var LD = _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefault(x => x.Name == details.LegislativeDistrict);
            if (LD == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Legislative District in ProjectId: {details.ProjectId}, Selected Legislative District: {details.LegislativeDistrict}" };
            }
            var OperatingUnit = _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefault(x => x.Name == details.OperatingUnit);
            if (OperatingUnit == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Operating Unit in ProjectId: {details.ProjectId}, Selected Operating Unit: {details.OperatingUnit}" };
            }
            var ImplementingOffice = _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefault(x => x.Name == details.ImplementingOffice);
            if (ImplementingOffice == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Implementing Office in ProjectId: {details.ProjectId}, Selected Implementing Office: {details.ImplementingOffice}" };
            }
            var Deo = _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefault(x => x.Name == details.DEO);
            if (Deo == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect DEO in ProjectId: {details.ProjectId}, Selected DEO: {details.DEO}" };
            }
            var Region = _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefault(x => x.Name == details.Region);
            if (Region == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Region in ProjectId: {details.ProjectId}, Selected Region: {details.Region}" };
            }
            var Agency = _db.tOptionProjectAgency.AsNoTracking().FirstOrDefault(x => x.Name == details.Agency);
            if (Agency == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Agency in ProjectId: {details.ProjectId}, Selected Agency: {details.Agency}" };
            }
            var ImplementationMode = _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefault(x => x.Name == details.ImplementationMode);
            if (ImplementationMode == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Implementation Mode in ProjectId: {details.ProjectId}, Selected Implementation Mode: {details.ImplementationMode}" };
            }
            var EmergencyMode = _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefault(x => x.Name == details.EmergencyMode);
            if (EmergencyMode == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Emergency Mode in ProjectId: {details.ProjectId}, Selected Emergency Mode: {details.EmergencyMode}" };
            }
            var Feasibility = _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefault(x => x.Name == details.Feasibility);
            if (Feasibility == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Feasibility in ProjectId: {details.ProjectId}, Selected Feasibility: {details.Feasibility}" };
            }
            var DetailedDesign = _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefault(x => x.Name == details.DetailedDesign);
            if (DetailedDesign == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Detailed Design in ProjectId: {details.ProjectId}, Selected Detailed Design: {details.DetailedDesign}" };
            }
            var RowAvailable = _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefault(x => x.Name == details.RowAvailable);
            if (RowAvailable == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Row Available in ProjectId: {details.ProjectId}, Selected Row Available: {details.RowAvailable}" };
            }
            var RegionWide = _db.tOptionRegionWide.AsNoTracking().FirstOrDefault(x => x.Name == details.RegionWide);
            if (RegionWide == null)
            {
                return new GenerateProjecttResponse { IsValid = false, Message = $"Incorrect Region Wide in ProjectId: {details.ProjectId}, Selected Region Wide: {details.RegionWide}" };
            }
            #endregion
            string ReferenceId = _db.GenerateProjectID(ProgramDetails, Category, Region.IslandCode);
            DateTime CurrentDate = Functions.CurrentDate();
            var NewProject = new DBHelper.Models.Table.Projects
            {
                ProgramId = ProgramDetails.ProgramId,
                ReferenceId = ReferenceId
            };
            var NewProjectRevision = new DBHelper.Models.Table.ProjectRevisions
            {
                ProgramId = ProgramDetails.ProgramId,
                ReferenceId = ReferenceId,
                ProjectId = ReferenceId,
                AlternateId = details.AlternateId,
                ExternalId = details.ExternalId,
                MYId = details.MYId,
                UACS = details.UACS,
                MYCAApprovalDate = details.MYCAApprovalDate.StringToDate(),
                RevisionNumber = 1,
                Description = details.Description!,
                Category = Category.CategoryId,
                Thrust = Thrust.PAPKey,
                Origin = Origin.NameId,
                City = City.GdbId,
                Province = Province.GdbId,
                LegislativeDistrict = LD.GdbId,
                OperatingUnit = OperatingUnit.ParticipantId,
                ImplementingOffice = ImplementingOffice.ParticipantId,
                DEO = Deo.ParticipantId,
                Region = Region.ParticipantId,
                Agency = Agency.NameId,
                ImplementationMode = ImplementationMode.NameId,
                EmergencyMode = EmergencyMode.NameId,
                IslandCode = Region.IslandCode!,
                Feasibility = Feasibility.NameId,
                FeasibilityDate = details.FeasibilityDate.StringToDate(),
                DetailedDesign = DetailedDesign.NameId,
                DetailedDesignDate = details.DetailedDesignDate.StringToDate(),
                RowAvailable = RowAvailable.NameId,
                RegionWide = RegionWide.NameId,
                Tier = (details.Tier == "Tier I") ? 1 : 2,
                //Rank = details.Rank,
            };
            var ProjectStage = new DBHelper.Models.Table.ProjectStages
            {
                ReferenceId = ReferenceId,
                ProgramId = ProgramDetails.ProgramId,
                RevisionId = 0,
                StageId = ProgramDetails.StageId,
                StageName = ProgramDetails.StageName
            };
            return new GenerateProjecttResponse { IsValid = true, Message = string.Empty, Project = NewProject, ProjectRevision = NewProjectRevision, ProjectStage = ProjectStage };
        }
        #endregion
        #region Funding Profile
        public class GenerateFundingProfileResponse : ValidationResponse
        {
            public DBHelper.Models.Table.ProjectFundingProfile FundingProfile { get; set; } = new DBHelper.Models.Table.ProjectFundingProfile();
        }
        public static GenerateFundingProfileResponse GenerateFundingProfile(this AppDbContext _db, ImportFundingProfile Funding, ImportProjectReference ProjectRef)
        {
            var NewProject = ProjectRef.NewProjectId;
            var Source = _db.tOptionFundingSource.AsNoTracking().FirstOrDefault(x => x.Name == Funding.Source);
            if (Source == null)
            {
                return new GenerateFundingProfileResponse { IsValid = false, Message = $"Incorrect Funding Source in ProjectId: {Funding.ProjectId}, Selected Source: {Funding.Source}" };
            }
            var Agreement = _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefault(x => x.Name == Funding.Agreement);
            if (Agreement == null)
            {
                return new GenerateFundingProfileResponse { IsValid = false, Message = $"Incorrect Funding Agreement in ProjectId: {Funding.ProjectId}, Selected Agreement: {Funding.Agreement}" };
            }
            var FundingProfile = new DBHelper.Models.Table.ProjectFundingProfile
            {
                ProjectId = NewProject,
                Source = Source.Organization,
                Agreement = Agreement.Code,
                Percentage = Funding.Percentage,
                Amount = Funding.Amount
            };
            return new GenerateFundingProfileResponse { IsValid = true, Message = string.Empty, FundingProfile = FundingProfile };
        }
        #endregion
        #region Component Cost
        public class GenerateComponentCostResponse : ValidationResponse
        {
            public DBHelper.Models.Table.ProjectComponentCost ComponentCost { get; set; } = new DBHelper.Models.Table.ProjectComponentCost();
        }
        public static GenerateComponentCostResponse GenerateComponentCost(this AppDbContext _db, ImportComponentCost ComponentCost, ImportProjectReference ProjectRef)
        {
            var Component = _db.tOptionProjectComponent.AsNoTracking().FirstOrDefault(x => x.ComponentName == ComponentCost.ComponentType);
            if (Component == null) {
                return new GenerateComponentCostResponse
                {
                    IsValid = false,
                    Message = $"Incorrect Component Type in ProjectId: {ComponentCost.ProjectId}, Selected Component Type: {ComponentCost.ComponentType}"
                };
            }
            var NewProject = ProjectRef.NewProjectId;
            var ComponentCostProfile = new DBHelper.Models.Table.ProjectComponentCost
            {
                ProjectId = NewProject,
                CostId = ComponentCost.CostId,
                ComponentType = ComponentCost.ComponentType,
                ComponentId = ComponentCost.ComponentId,
                Description = ComponentCost.Description,
                Total = ComponentCost.Total
            };
            return new GenerateComponentCostResponse { IsValid = true, Message = string.Empty, ComponentCost = ComponentCostProfile };
        }
        #endregion
        #region Component Cost Per Year
        public class GenerateComponentCostPerYearResponse : ValidationResponse
        {
            public DBHelper.Models.Table.ProjectComponentCostPerYear ComponentCostPerYear { get; set; } = new DBHelper.Models.Table.ProjectComponentCostPerYear();
        }
        public static GenerateComponentCostPerYearResponse GenerateComponentCostPerYear(this AppDbContext _db, ImportComponentCostPerYear ComponentCostPerYear)
        {
            var ComponentCostPerYearProfile = new DBHelper.Models.Table.ProjectComponentCostPerYear
            {
                ComponentCostId = ComponentCostPerYear.ComponentCostId,
                Amount = ComponentCostPerYear.Amount,
                Year = ComponentCostPerYear.Year,
                StartDate = ComponentCostPerYear.StartDate.StringToDate(),
                EndDate = ComponentCostPerYear.EndDate.StringToDate()
            };
            return new GenerateComponentCostPerYearResponse { IsValid = true, Message = string.Empty, ComponentCostPerYear = ComponentCostPerYearProfile };
        }
        #endregion
        #region Major Work Item
        public class GenerateMajorWorkItemResponse : ValidationResponse
        {
            public DBHelper.Models.Table.ProjectMajorWorkItem MajorWorkItem { get; set; } = new DBHelper.Models.Table.ProjectMajorWorkItem();
        }
        public static GenerateMajorWorkItemResponse GenerateMajorWorkItem(this AppDbContext _db, ImportMajorItemOfWork MajorWorkItem, ImportProjectReference ProjectRef)
        {
            var InfraType = _db.tOptionInfraType.AsNoTracking().FirstOrDefault(x => x.InfraName == MajorWorkItem.InfraType);
            if (InfraType == null)
            {
                return new GenerateMajorWorkItemResponse { IsValid = false, Message = $"Incorrect Infra Type in ProjectId: {MajorWorkItem.ProjectId}, Selected Infra Type: {MajorWorkItem.InfraType}" };
            }
            var ScopeOfWork = _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefault(x => x.Description == MajorWorkItem.WorkTypeId);
            if (ScopeOfWork == null)
            {
                return new GenerateMajorWorkItemResponse { IsValid = false, Message = $"Incorrect Work Type in ProjectId: {MajorWorkItem.ProjectId}, Selected Work Type: {MajorWorkItem.WorkTypeId}" };
            }
            var MajorWorkItemProfile = new DBHelper.Models.Table.ProjectMajorWorkItem
            {
                ProjectId = ProjectRef.NewProjectId,
                ReferenceId = MajorWorkItem.ReferenceId,
                ComponentId = MajorWorkItem.ComponentId,
                YearOfWork = MajorWorkItem.YearOfWork,
                WorkTypeId = ScopeOfWork.Enum,
                InfraType = InfraType.InfraCode,
            };
            return new GenerateMajorWorkItemResponse { IsValid = true, Message = string.Empty, MajorWorkItem = MajorWorkItemProfile };
        }
        #endregion
        #region Major Work Location
        public class GenerateMajorWorkLocationResponse : ValidationResponse
        {
            public DBHelper.Models.Table.ProjectMajorWorkLocations MajorWorkLocation { get; set; } = new DBHelper.Models.Table.ProjectMajorWorkLocations();
        }
        public static GenerateMajorWorkLocationResponse GenerateMajorWorkLocation(this AppDbContext _db, ImportMajorItemLocation MajorWorkLocation)
        {
            var MajorWorkLocationProfile = new DBHelper.Models.Table.ProjectMajorWorkLocations
            {
                ParentId = MajorWorkLocation.ParentId,
                InfraId = MajorWorkLocation.InfraId,
                DetailedScope = MajorWorkLocation.DetailedScope,
                TargetUnitId = MajorWorkLocation.TargetUnitId,
                TargetUnit = MajorWorkLocation.TargetUnit,
                PhysicalTarget = MajorWorkLocation.PhysicalTarget,
                Length = MajorWorkLocation.Length,
                StartChainage = MajorWorkLocation.StartChainage,
                EndChainage = MajorWorkLocation.EndChainage,
                StartX = MajorWorkLocation.StartX,
                StartY = MajorWorkLocation.StartY,
                EndX = MajorWorkLocation.EndX,
                EndY = MajorWorkLocation.EndY,
                StartStationLimit = MajorWorkLocation.StartStationLimit,
                EndStationLimit = MajorWorkLocation.EndStationLimit
            };
            return new GenerateMajorWorkLocationResponse { IsValid = true, Message = string.Empty, MajorWorkLocation = MajorWorkLocationProfile };
        }
        #endregion
    }
}