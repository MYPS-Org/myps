using DBHelper.Models.Enums;

namespace DBHelper.Models.Views
{
    public class ProjectDetails
    {
        public int? Id { get; set; }
        public string? ProgramId { get; set; }
        public string? ProgramName { get; set; }
        public string? ProjectId { get; set; }
        public int? RevisionNumber { get; set; }
        public string? Description { get; set; }
        public int Category { get; set; }
        public int Thrust { get; set; }
        public int Origin { get; set; }
        public int City { get; set; }
        public int LegislativeDistrict { get; set; }
        public string? OperatingUnit { get; set; }
        public string? ImplementingOffice { get; set; }
        public string? DEO { get; set; }
        public string? Region { get; set; }
        public int Agency { get; set; }
        public string? ProjectCode { get; set; }
        public int ImplementationMode { get; set; }
        public bool EmergencyMode { get; set; }
        public int? Feasibility { get; set; }
        public bool? DetailedDesign { get; set; }
        public bool? RowAvailable { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
