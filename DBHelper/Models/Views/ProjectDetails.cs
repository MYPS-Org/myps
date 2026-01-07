using DBHelper.Models.Enums;

namespace DBHelper.Models.Views
{
    public class ProjectDetails
    {
        public int? Id { get; set; }
        public string? ProgramId { get; set; }
        public string ProgramName { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string ReferenceId { get; set; } = string.Empty;
        public string? ProjectId { get; set; }
        public string? AlternateId { get; set; }
        public string? ExternalId { get; set; }
        public string? MYId { get; set; }
        public string? UACS { get; set; }
        public DateTime? MYCAApprovalDate { get; set; }
        public string? IslandCode { get; set; }
        public int? RevisionId { get; set; }
        public string? Description { get; set; }
        public int Category { get; set; }
        public int? Thrust { get; set; }
        public int Origin { get; set; }
        public string City { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string LegislativeDistrict { get; set; } = string.Empty;
        public string? OperatingUnit { get; set; }
        public string? ImplementingOffice { get; set; }
        public string? DEO { get; set; }
        public string? Region { get; set; }
        public int Agency { get; set; }
        public int? ImplementationMode { get; set; }
        public bool EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public bool? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
        public bool? RowAvailable { get; set; }
        public int RegionWide { get; set; } = 0;
        public int Tier { get; set; } = 0;
        public bool? isRevised { get; set; } = false;
        public int? RevisedNumber { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
