namespace DBHelper.Models.Views.Project
{
    // Backs dbo.vProjectThrustByCategory -- see Helpers/ProjectHelper.cs's ValidateProjectDetailsLookups
    // for why a plain view can't represent the PAPKey=-1 "any thrust allowed" wildcard: no real
    // thrust row has PAPKey=-1, so this view is only populated for categories with an EXPLICIT
    // (non-wildcard) mapping. Callers must fall back to tOptionProjectCategoryToPAPMap directly to
    // detect the wildcard/no-mapping "unrestricted" cases.
    public class ProjectThrustByCategory
    {
        public int Id { get; set; }
        public long CategoryId { get; set; }
        public int PAPKey { get; set; }
        public string ProgramName { get; set; } = string.Empty;
        public string SubProgramName { get; set; } = string.Empty;
        public string ActivityName { get; set; } = string.Empty;
        public int SequenceNumber { get; set; }
        public int ValidFromDate { get; set; }
        public int ValidToDate { get; set; }
        public string? InfrastructureType { get; set; }
        public string ThrustDescription { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
