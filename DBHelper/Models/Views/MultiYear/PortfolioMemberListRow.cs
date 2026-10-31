using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views.MultiYear
{
    /// <summary>
    /// One row of dbo.vMultiYearPortfolioMemberList (Main/Resources/MultiYear/SQL/
    /// Migration.MultiYear.Schema.2026-10-31.sql): a membership with its project's planned total and
    /// yearly amounts. Keyless; read through FilterDataCursor. EF binds by column name, so change the
    /// view and this class together.
    /// </summary>
    public class PortfolioMemberListRow
    {
        public int Id { get; set; }
        public int PortfolioFK { get; set; }
        public int MultiYearProjectFK { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Category { get; set; }
        public string? Region { get; set; }
        public string? DEO { get; set; }
        public string? ImplementingOffice { get; set; }
        public bool IsOwner { get; set; }
        public EnumMembershipStatus Status { get; set; }
        public int StartYear { get; set; }
        public int? EndYear { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Cost { get; set; }
        /// <summary>A PIP membership's cost when it entered PIP (MY-PFL-18).</summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal? OriginalCost { get; set; }
        /// <summary>A PIP membership's source RDIP / UDIP (MY-PFL-10).</summary>
        public int? SourcePortfolioFK { get; set; }
        public int? Tier { get; set; }
        [Column(TypeName = "decimal(9,4)")]
        public decimal? McaScore { get; set; }
        public string HorizonType { get; set; } = string.Empty;
        [Column(TypeName = "decimal(18,5)")]
        public decimal PlannedTotal { get; set; }
        /// <summary>JSON: [{"Year":2026,"Amount":100.00000}, ...], current amounts only.</summary>
        public string YearAmounts { get; set; } = "[]";

        // Filled by the API after the page is read; not view columns.
        [NotMapped]
        public string? CategoryName { get; set; }
        [NotMapped]
        public string? RegionName { get; set; }
        [NotMapped]
        public string? DEOName { get; set; }
        [NotMapped]
        public List<EnumMembershipStatus> AllowedStatuses { get; set; } = new();
        [NotMapped]
        public string? SourcePortfolioName { get; set; }
    }
}
