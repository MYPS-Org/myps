using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.MultiYear
{
    /// <summary>
    /// A project's membership of one portfolio, with its own status, start year, cost and planning
    /// fields (MY-PFL-09). The multi-valued fields are JSON arrays, like tGroupRoles.ActionIds, so a
    /// changed selection is an update, never a deleted row:
    ///   ReadinessLevelIds  [1,4]
    ///   RdpOutcomes        [{"OutcomeId":1,"OutputId":2}]   one output per outcome
    /// </summary>
    public class MultiYearPortfolioMember
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearPortfolio(Id)
        public int PortfolioFK { get; set; }
        // FK -> dbo.tMultiYearProject(Id)
        public int MultiYearProjectFK { get; set; }
        /// <summary>The RDIP or UDIP that created the project (MY-PFL-10).</summary>
        public bool IsOwner { get; set; }
        /// <summary>For a PIP membership, the RDIP or UDIP it came from (MY-PFL-10); null when the
        /// GAA update added it.</summary>
        public int? SourcePortfolioFK { get; set; }
        /// <summary>The previous term's membership this one was carried from (MY-PFL-06).</summary>
        public int? CarriedFromMemberFK { get; set; }
        public EnumMembershipStatus Status { get; set; }
        public int StartYear { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Cost { get; set; }
        /// <summary>Set when a project enters PIP (MY-PFL-18); never changed after.</summary>
        [Column(TypeName = "decimal(18,5)")]
        public decimal? OriginalCost { get; set; }
        public int? BasisForImplementationFK { get; set; }
        public int? NedaProjectStatusFK { get; set; }
        [Required]
        [MaxLength(1000)]
        public string ReadinessLevelIds { get; set; } = "[]";
        [Required]
        [MaxLength(4000)]
        public string RdpOutcomes { get; set; } = "[]";
        public int? Tier { get; set; }
        [Column(TypeName = "decimal(9,4)")]
        public decimal? McaScore { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }

    /// <summary>
    /// One change to a membership (insert only): a status move, a start-year move or a PIP cost
    /// change. A row with FromStatus = ToStatus records only the start year or the cost. RunFK names
    /// the portfolio update that made a system move; ProposalFK the proposal (Phase 2).
    /// </summary>
    public class MultiYearMemberStatusLog
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearPortfolioMember(Id)
        public int MemberFK { get; set; }
        public EnumMembershipStatus? FromStatus { get; set; }
        public EnumMembershipStatus ToStatus { get; set; }
        [MaxLength(500)]
        public string? Reason { get; set; }
        [Required]
        [MaxLength(100)]
        public string ChangedBy { get; set; } = string.Empty;
        public DateTime ChangedDate { get; set; }
        public int? FromStartYear { get; set; }
        public int? ToStartYear { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal? FromCost { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal? ToCost { get; set; }
        // FK -> dbo.tMultiYearUpdateRun(Id)
        public int? RunFK { get; set; }
        // FK -> dbo.tMultiYearProposal(Id)
        public int? ProposalFK { get; set; }
    }
}
