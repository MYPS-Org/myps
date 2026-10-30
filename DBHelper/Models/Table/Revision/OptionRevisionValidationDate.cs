using System;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    /// <summary>
    /// Code Tables → Revisions → Validation Dates (UAT S04-TC016): for a funding year, the dates between
    /// which a revision of that year's projects can be requested. A year with no row has no window.
    /// Created by Migration.RevisionValidationDates.2026-10-30.sql.
    /// </summary>
    public class OptionRevisionValidationDate
    {
        [Key]
        public int Id { get; set; }
        /// <summary>The program (appropriation) year the window applies to; one row per year.</summary>
        public int FundingYear { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; } = true;
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
    }
}
