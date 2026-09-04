using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Program
{
    public class ProgramProjects
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionId { get; set; }
        public int? OldSourceId { get; set; }
        [Required]
        public int StageFK { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProgramFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProgramName { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        public int? Category { get; set; }
        [MaxLength(200)]
        public string? CategoryName { get; set; }
        [MaxLength(400)]
        public string? ThrustName { get; set; }
        public string? Description { get; set; }
        [MaxLength(20)]
        public string? Region { get; set; }
        [Required]
        [MaxLength(255)]
        public string OperatingUnitName { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? OperatingUnitParticipantId { get; set; }
        [Required]
        [MaxLength(255)]
        public string ImplementingOfficeName { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? ImplementingOfficeParticipantId { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        public bool IsPublishable { get; set; }
        [Required]
        public bool IsPublished { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? LastUpdatedBy { get; set; }
        public DateTime? LastUpdatedDate { get; set; }
        [MaxLength(100)]
        public string? RevisionCreatedBy { get; set; }
        [Required]
        public DateTime RevisionCreatedDate { get; set; }
    }
}
