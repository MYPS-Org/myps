
using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions
{
    public class ProjectsPerStage
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public int StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string ReferenceId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Category { get; set; }
        public string Thrust { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string LegislativeDistrict { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public bool IsPublishable { get; set; } = false;
    }
}
