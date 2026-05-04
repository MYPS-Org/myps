using Microsoft.EntityFrameworkCore;

namespace DBHelper.Models.Views
{
    [Keyless]
    public class PCMAProjectComponentStatus
    {
        public string? ProgramName { get; set; }
        public string? ProjectId { get; set; }
        public string? ProjectComponentId { get; set; }
        public decimal? PlannedProjectComponentCostTotal { get; set; }
        public decimal? RevisedProjectComponentCost { get; set; }
        public string? ConstructionStatusCode { get; set; }
        public string? ConstructionStatusName { get; set; }
        public string? NotYetStartedCode { get; set; }
        public string? NotYetStartedName { get; set; }
        public bool? isPackaged { get; set; }
        public string? PermanentPayItems { get; set; }
        public string? PermanentMonthlyTargets { get; set; }
        public string? TypeofWorkCode { get; set; }
        public decimal? PlannedPhysicalTarget { get; set; }
        public decimal? RevisedPhysicalTarget { get; set; }
        public decimal? ActualOutput { get; set; }
        public decimal? FinalOutput { get; set; }
        public DateTime? PhysicalCompletionDate { get; set; }
        public string? ImplementationModeCode { get; set; }
        public string? ImplementationModeName { get; set; }
    }
}
