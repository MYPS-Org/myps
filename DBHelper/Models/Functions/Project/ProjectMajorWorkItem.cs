using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Functions.Project
{
    public class ProjectMajorWorkItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(8)]
        public string Source { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string InfraTypeFK { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
