using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.MultiYear
{
    /// <summary>
    /// One RDIP, UDIP or PIP over one fixed six-year term (MY-PFL-01, -03, -04). Never deleted
    /// (MY-PFL-07): opening the next term closes this one, which then stays readable.
    /// </summary>
    public class MultiYearPortfolio
    {
        [Key]
        public int Id { get; set; }
        public EnumPortfolioKind Kind { get; set; }
        /// <summary>Region ParticipantId (RDIP), PMO cluster office ParticipantId (UDIP); null for PIP.</summary>
        [MaxLength(20)]
        public string? OwnerParticipantId { get; set; }
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        [MaxLength(20)]
        public string OwnerKey { get; set; } = string.Empty;
        public int TermStartYear { get; set; }
        /// <summary>Always TermStartYear + 5, computed by the database.</summary>
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int TermEndYear { get; set; }
        public EnumPortfolioStatus Status { get; set; }
        // FK -> dbo.tMultiYearPortfolio(Id): the term this one followed
        public int? PreviousPortfolioFK { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? ClosedBy { get; set; }
        public DateTime? ClosedDate { get; set; }
    }

    /// <summary>Budget ceiling of one portfolio for one year of its term (MY-PFL-23).</summary>
    public class MultiYearPortfolioCeiling
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearPortfolio(Id)
        public int PortfolioFK { get; set; }
        public int Year { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
