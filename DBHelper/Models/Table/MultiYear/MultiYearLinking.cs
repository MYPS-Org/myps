using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.MultiYear
{
    /// <summary>
    /// A planning project proposed into an RBP / UBP (MY-PFL-20): the BP-numbered annual project it
    /// created. It counts while that project's revision is not deleted. Phase 2,
    /// Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking.2026-10-31.sql.
    /// </summary>
    public class MultiYearProposal
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearProject(Id)
        public int MultiYearProjectFK { get; set; }
        // FK -> dbo.tMultiYearPortfolioMember(Id): the RDIP / UDIP membership that proposed it
        public int MemberFK { get; set; }
        /// <summary>tPrograms.ProgramPK of the RBP.</summary>
        [Required]
        [MaxLength(200)]
        public string ProgramFK { get; set; } = string.Empty;
        /// <summary>tProjects.ProjectPK of the annual project.</summary>
        [Required]
        [MaxLength(200)]
        public string ProjectFK { get; set; } = string.Empty;
        /// <summary>The annual project's BP id.</summary>
        [Required]
        [MaxLength(50)]
        public string ProjectId { get; set; } = string.Empty;
        public int BudgetYear { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Amount { get; set; }
        [Required]
        [MaxLength(100)]
        public string ProposedBy { get; set; } = string.Empty;
        public DateTime ProposedDate { get; set; }
    }

    /// <summary>One run of the portfolio update (MY-PFL-21, -22). Summary holds its counts as JSON.</summary>
    public class MultiYearUpdateRun
    {
        [Key]
        public int Id { get; set; }
        public int Year { get; set; }
        public EnumUpdateTrigger TriggerKind { get; set; }
        [MaxLength(200)]
        public string? ProgramFK { get; set; }
        public int? RevisionDetailsFK { get; set; }
        [Required]
        [MaxLength(4000)]
        public string Summary { get; set; } = "{}";
        [Required]
        [MaxLength(100)]
        public string RunBy { get; set; } = string.Empty;
        public DateTime RunDate { get; set; }
    }

    /// <summary>A portfolio's saved totals (MY-PFL-24). Insert only: nothing edits or deletes them.</summary>
    public class MultiYearTotalsSnapshot
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearPortfolio(Id)
        public int PortfolioFK { get; set; }
        public EnumTotalsReason Reason { get; set; }
        // FK -> dbo.tMultiYearUpdateRun(Id)
        public int? RunFK { get; set; }
        [MaxLength(250)]
        public string? Note { get; set; }
        [Required]
        [MaxLength(100)]
        public string TakenBy { get; set; } = string.Empty;
        public DateTime TakenDate { get; set; }
    }

    /// <summary>One year of a saved total: for a project, or (MultiYearProjectFK null) the portfolio.</summary>
    public class MultiYearTotalsLine
    {
        [Key]
        public int Id { get; set; }
        // FK -> dbo.tMultiYearTotalsSnapshot(Id)
        public int SnapshotFK { get; set; }
        // FK -> dbo.tMultiYearProject(Id); null = the portfolio's total
        public int? MultiYearProjectFK { get; set; }
        public int Year { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Planned { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Proposed { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal Approved { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal? Ceiling { get; set; }
    }
}
