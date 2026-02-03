using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views
{
    [Table("vAIPBase")]
    public class AIPBase
    {
        public string ProgramName { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string? ProjectCategory { get; set; }
        public string? Region { get; set; }
        public string ComponentId { get; set; } = string.Empty;
        public Double ComponentAmount { get; set; }
        public string? ComponentDescription { get; set; }
        public string MW_ComponentId { get; set; } = string.Empty;
        public string Measure { get; set; } = string.Empty;
        public string WorkTypeDescription { get; set; } = string.Empty;
    }
}
