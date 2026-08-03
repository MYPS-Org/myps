using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Hangfire.Importing
{
    public class ImportProjectDetailsExcel
    {
        public string ProjectId { get; set; } = string.Empty;
        public string? ExternalId { get; set; }
        public string? MYId { get; set; }
        public string? UACS { get; set; }
        public string? MYCAApprovalDate { get; set; }
        public string? Description { get; set; }
        public string Province { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string LegislativeDistrict { get; set; } = string.Empty;
        public string OperatingUnit { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
        public string DEO { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Thrust { get; set; } = string.Empty;
        public string Origin { get; set; } = string.Empty;
        public string Agency { get; set; } = string.Empty;
        public string ImplementationMode { get; set; } = string.Empty;
        public string EmergencyMode { get; set; } = string.Empty;
        public string Feasibility { get; set; } = string.Empty;
        public string? FeasibilityDate { get; set; }
        public string DetailedDesign { get; set; } = string.Empty;
        public string? DetailedDesignDate { get; set; }
        public string RowAvailable { get; set; } = string.Empty;
        public string RegionWide { get; set; } = string.Empty;
        public string Tier { get; set; } = string.Empty;
        public string? Rank { get; set; } = string.Empty;
        public string? ErrorMessage { get; set; } = string.Empty;

        public int? CategoryCategoryId { get; set; }
        public int? ThrustPAPKey { get; set; }
        public int? OriginNameId { get; set; }
        public string? CityGdbId { get; set; }
        public string? ProvinceGdbId { get; set; }
        public string? LDGdbId { get; set; }
        public string? OperatingUnitParticipantId { get; set; }
        public string? ImplementingOfficeParticipantId { get; set; }
        public string? DeoParticipantId { get; set; }
        public string? RegionParticipantId { get; set; }
        public int? AgencyNameId { get; set; }
        public int? ImplementationModeNameId { get; set; }
        public int? EmergencyModeNameId { get; set; }
        public string? RegionIslandCode { get; set; }
        public int? FeasibilityNameId { get; set; }
        public int? DetailedDesignNameId { get; set; }
        public int? RowAvailableNameId { get; set; }
        public int? RegionWideNameId { get; set; }
    }
    public class ImportFundingProfileExcel
    {
        public string ProjectId { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string Agreement { get; set; } = string.Empty;
        public Double Percentage { get; set; }
        //public Double Amount { get; set; }
        public string Amount { get; set; }
        public string? ErrorMessage { get; set; } = string.Empty;

        public string? SourceOrganization { get; set; }
        public string? AgreementCode { get; set; }
    }
    public class ImportComponentDetailsExcel
    {
        public string ProjectId { get; set; } = string.Empty;
        public string ComponentType { get; set; } = string.Empty;
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; } = string.Empty;
        public string Cost { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string InfraType { get; set; } = string.Empty;
        public string WorkTypeId { get; set; } = string.Empty;
        public string ActiveYear { get; set; }
        public string? ErrorMessage { get; set; } = string.Empty;

        public int? ScopeOfWorkEnum { get; set; }
        public string? InfraTypeInfraCode { get; set; }
    }
    public class ImportMajorItemsOfWorkExcel
    {
        public string ProjectId { get; set; } = string.Empty;
        public string ComponentId { get; set; } = string.Empty;
        public string ReferenceId { get; set; } = string.Empty;
        public string InfrastructureId { get; set; } = string.Empty;
        public string? DetailsScope { get; set; }
        public string TargetUnit { get; set; } = string.Empty;
        public string? StartX { get; set; } //Double
        public string? StartY { get; set; } //Double
        public string? EndX { get; set; } //Double
        public string? EndY { get; set; } //Double
        public string PhysicalTarget { get; set; } //Double
        public string? StartStation { get; set; }
        public string? EndStation { get; set; }
        public string? StartChainage { get; set; } //Double
        public string? EndChainage { get; set; } //Double
        public string? Length { get; set; } //Double
        public string? ActivityYear { get; set; }
        public string? ErrorMessage { get; set; } = string.Empty;

        public int? TargetUnitId { get; set; }
    }
    public class ImportProjectReference
    {
        public string OldProjectId { get; set; } = string.Empty;
        public string NewProjectId { get; set; } = string.Empty;
        public string ThirdSegment { get; set; } = string.Empty;
        public string MaxId { get; set; } = string.Empty;
    }
    public class ImportProjectDTOExcel
    {
        [Required]
        public List<ImportProjectDetailsExcel> ProjectDetails { get; set; } = new List<ImportProjectDetailsExcel>();
        [Required]
        public List<ImportFundingProfileExcel> FundingProfile { get; set; } = new List<ImportFundingProfileExcel>();
        [Required]
        public List<ImportComponentDetailsExcel> ComponentDetails { get; set; } = new List<ImportComponentDetailsExcel>();
        [Required]
        public List<ImportMajorItemsOfWorkExcel> MajorItemsOfWork { get; set; } = new List<ImportMajorItemsOfWorkExcel>();
    }
}
