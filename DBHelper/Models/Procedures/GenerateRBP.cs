using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class GenerateRBP
    {
        [Required]
        public string Region { get; set; } = string.Empty;
        [Required]
        public string DEO { get; set; } = string.Empty;
        [Required]
        public string LegislativeDistrict { get; set; } = string.Empty;
        [Required]
        public int Tier { get; set; }
        public int? OO1_NoOfProj { get; set; }
        [Required]
        public Double OO1_Amount { get; set; }
        public int? OO2_NoOfProj { get; set; }
        [Required]
        public Double OO2_Amount { get; set; }
        public int? CSSP_NoOfProj { get; set; }
        [Required]
        public Double CSSP_Amount { get; set; }
        public int? LP_NoOfProj { get; set; }
        [Required]
        public Double LP_Amount { get; set; }
        public int? Total_NoOfProj { get; set; }
        [Required]
        public Double Total_Amount { get; set; }
    }
}
