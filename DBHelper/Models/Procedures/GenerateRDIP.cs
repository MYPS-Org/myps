using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class GenerateRDIP
    {
        [Required]
        public string Region { get; set; } = string.Empty;
        [Required]
        public string CategoryName { get; set; } = string.Empty;
        [Required]
        public string ThrustProgramName { get; set; } = string.Empty;
        [Required]
        public string? ThrustSubProgramName { get; set; }
        [Required]
        public string? ThrustActivityName { get; set; }
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string ProjectDescription { get; set; } = string.Empty;
        [Required]
        public string CityMunicipality { get; set; } = string.Empty;
        [Required]
        public string Province { get; set; } = string.Empty;
        [Required]
        public string CongressionalDistrict { get; set; } = string.Empty;
        [Required]
        public int StartYear { get; set; }
        [Required]
        public int EndYear { get; set; }
        public Double TotalCost { get; set; }
        public Double FirstYear { get; set; }
        public Double SecondYear { get; set; }
        public Double ThirdYear { get; set; }
        public Double FourthYear { get; set; }
        public Double FifthYear { get; set; }
        public Double SixthYear { get; set; }
        public Double LaterYears { get; set; }
    }
}
