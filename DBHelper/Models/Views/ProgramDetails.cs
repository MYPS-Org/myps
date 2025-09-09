using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views
{
    public class ProgramDetails
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public int RevisionNumber { get; set; }
        public bool AllowAutoName { get; set; }
        public string Name { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public bool IsSkipped { get; set; }
        public string? SkipReason { get; set; }
        public int UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
        public EnumProgramStatus Status { get; set; }
        public EnumProgramType Type { get; set; }
        public string TypeName { get; set; } = string.Empty;
        public Double? Cost { get; set; }
        public int YearStart { get; set; }
        public bool IsPublished { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
