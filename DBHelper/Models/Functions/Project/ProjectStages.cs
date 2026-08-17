using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectStages
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int RevisionId { get; set; }
        [Required]
        public int StageId { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageDisplayName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        public int Category { get; set; }
        [MaxLength(200)]
        public string? CategoryName { get; set; }
        [MaxLength(400)]
        public string? ThrustName { get; set; }
        [Required]
        [MaxLength(100)]
        public string RevisionCreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime RevisionCreatedDate { get; set; }
    }
}
