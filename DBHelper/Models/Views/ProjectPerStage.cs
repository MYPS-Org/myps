using DBHelper.Models.Enums;

namespace DBHelper.Models.Views
{
    public class ProjectPerStage
    {
        public int? Id { get; set; }
        public string? ProgramId { get; set; }
        public string ProgramName { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string? ReferenceId { get; set; }
        public string? ProjectId { get; set; }
        public string? Category { get; set; }
        public string? Thrust { get; set; }
        public string? Description { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
        public Double Cost { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
