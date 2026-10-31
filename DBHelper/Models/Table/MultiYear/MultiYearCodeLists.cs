using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.MultiYear
{
    /*  The Multi-Year planning code lists (MY-PFL-14, -15), all created by
        Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.2026-10-31.sql. Years are plain ints
        and 0 means open; a value can be picked when it is Active OR valid for the year, the rule the
        Category / Sub-Category lists already use. Values are retired, never deleted. */

    /// <summary>Horizon type (MY-PRJ-06). Years is null for the open-ended long term.</summary>
    public class OptionMultiYearType
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;
        public int? Years { get; set; }
        [MaxLength(250)]
        public string? Description { get; set; }
        public bool IsActive { get; set; }
    }

    /// <summary>The columns every planning code list shares. Not an entity of its own.</summary>
    public abstract class MultiYearCodeListItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(250)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(250)]
        public string? Description { get; set; }
        public int ValidFromYear { get; set; }
        public int ValidToYear { get; set; }
        public bool IsActive { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }

    public class OptionBasisForImplementation : MultiYearCodeListItem { }

    public class OptionNedaProjectStatus : MultiYearCodeListItem { }

    public class OptionReadinessLevel : MultiYearCodeListItem { }

    public class OptionRdpOutcome : MultiYearCodeListItem { }

    /// <summary>An output of one RDP Results Matrix outcome.</summary>
    public class OptionRdpOutput : MultiYearCodeListItem
    {
        // FK -> dbo.tOptionRdpOutcome(Id)
        public int OutcomeFK { get; set; }
    }
}
