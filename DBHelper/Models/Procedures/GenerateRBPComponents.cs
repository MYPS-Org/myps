using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class GenerateRBPComponents
    {
        [Required]
        public string Region { get; set; } = string.Empty;
        [Required]
        public int Tier { get; set; }
        [Required]
        public string DEO { get; set; } = string.Empty;
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        public string CategoryName { get; set; } = string.Empty;
        [Required]
        public string ThrustDescription { get; set; } = string.Empty;
        [Required]
        public string ProjectDescription { get; set; } = string.Empty;
        [Required]
        public string ComponentId { get; set; } = string.Empty;
        public string? ComponentDescription { get; set; }
        public string? ScopeDescription { get; set; }
        public string? ScopeMeasure { get; set; }
        [Required]
        public Double ComponentCost { get; set; }
        public string? DetailsOfWork { get; set; }
        public Double? LengthOfWork { get; set; }
        public Double? PhysicalTarget { get; set; }
        public string? TargetUnit { get; set; }
    }
}
