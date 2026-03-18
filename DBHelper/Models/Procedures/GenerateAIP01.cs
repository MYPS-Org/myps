using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class GenerateAIP01
    {
        [Key]
        [Required]
        public int Id { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        public string? UACS { get; set; }
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public string Region { get; set; } = string.Empty;
        [Required]
        public string OperatingUnit { get; set; } = string.Empty;
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        public string DEO { get; set; } = string.Empty;
        public string? ImplementingOffice { get; set; }
        public string? Category { get; set; }
        [Required]
        public string Thrust { get; set; } = string.Empty;
    }
}
