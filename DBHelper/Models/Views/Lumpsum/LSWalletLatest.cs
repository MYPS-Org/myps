using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.Lumpsum
{
    public class LSWalletLatest
    {
        [Key]
        public int Id { get; set; }
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string? ProgramName { get; set; }
        public string? TypeName { get; set; }
        public int YearStart { get; set; }
        public string? ProgramStageName { get; set; }
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public int? SubCategoryFK { get; set; }
        public string? SubCategoryName { get; set; }
        public string? OperatingUnit { get; set; }
        public string? FundingSource { get; set; }
        public string? FundingAgreement { get; set; }
        public decimal Amount { get; set; }
        public Double? FundingPercentage { get; set; }
        public string? CurrentStage { get; set; }
        public int? ComponentYear { get; set; }
        public string? ComponentUACS { get; set; }
        public DateTime? ComponentStartDate { get; set; }
        public DateTime? ComponentEndDate { get; set; }
        public decimal Total { get; set; }
        public decimal Used { get; set; }
        public decimal Available { get; set; }
        public long ProjectCount { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
