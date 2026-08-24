using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Project
{
    /// <summary>
    /// Read model for dbo.fProjectStageTargets(@ProjectFK) — one row per project
    /// component / work item per Program Stage the project has undergone, with the
    /// component's total physical target at that stage. Backs the Component Targets
    /// panel on the project details page.
    /// The function is defined in Main/Resources/Internal/SQLScripts/Project.StageTargets.sql.
    /// </summary>
    public class ProjectStageTargets
    {
        /// <summary>
        /// Dense ROW_NUMBER over (stage hierarchy, component, work item) — the keyset
        /// pagination key, and the reason rows come back in stage progression order.
        /// Not a work item id; see <see cref="WorkItemId"/>.
        /// </summary>
        [Key]
        public long Id { get; set; }
        /// <summary>The underlying tProjectMajorWorkItem id this row summarises.</summary>
        public int WorkItemId { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ProjectId { get; set; }
        public int StageId { get; set; }
        [MaxLength(100)]
        public string? StageName { get; set; }
        /// <summary>
        /// Composed stage label, e.g. "NEP 2026 OO-1" — stage short name, program start
        /// year, and the project's Organizational Outcome. Matches the legacy Targets tab.
        /// </summary>
        [MaxLength(120)]
        public string? Source { get; set; }
        /// <summary>
        /// 'Base' (project record) or 'Revision' (effective revision snapshot).
        /// Not shown in the Targets table; available for callers that need to tell an
        /// approved figure from a pending revision.
        /// </summary>
        [MaxLength(8)]
        public string? Provenance { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        /// <summary>"{ProjectId}-{ComponentId}", matching the legacy Targets tab.</summary>
        [MaxLength(255)]
        public string? ComponentCode { get; set; }
        public string? ComponentDescription { get; set; }
        [MaxLength(400)]
        public string? TypeOfWork { get; set; }
        /// <summary>Sum of the work item's work-location physical targets at this stage.</summary>
        public Double? Target { get; set; }
        [MaxLength(100)]
        public string? TargetUnit { get; set; }
    }
}
