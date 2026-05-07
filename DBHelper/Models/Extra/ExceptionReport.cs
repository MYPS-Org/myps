using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    #region Response Model
    public class ExceptionReportResponse
    {
        public bool IsValid { get; set; } = true;
        public string? Reason { get; set; }
    }
    #endregion
    #region Project Level
    public class ExceptionReportProjectGeneralInformation
    {
        public string ProjectId { get; set; } = string.Empty;
        public int? Category { get; set; }
        public int? Thrust { get; set; }
        public string? Description { get; set; }
    }
    public class ExceptionReportProjectLocationDetails
    {
        public int? Province { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
    }
    public class ExceptionReportProjectOrganizationalResponsibilities
    {
        public string? DEO { get; set; }
        public string? Region { get; set; }
        public string? ImplementingOffice { get; set; }
        public string? OperatingUnit { get; set; }
    }
    public class ExceptionReportProjectImplementationReadinessAndModality
    {
        public int? ImplementationMode { get; set; }
        public int? Feasibility { get; set; }
        public DateTime? FeasibilityDate { get; set; }
        public int? DetailedDesign { get; set; }
        public DateTime? DetailedDesignDate { get; set; }
    }
    #endregion
    #region Funding Profile Level
    public class ExceptionReportFundingProfile
    {
        public string ProjectId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string? Source { get; set; }
        public string? Agreement { get; set; }
        public double? Amount { get; set; }
        public double? Percentage { get; set; }
    }
    #endregion
    #region Component Cost Level
    public class ExceptionReportComponentCost
    {
        public string ProjectId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string CostId { get; set; } = string.Empty;
        public string? ComponentType { get; set; }
        public string? Description { get; set; }
        public double? Total { get; set; }
    }
    public class ExceptionReportComponentCostPerYear
    {
        public string ComponentCostId { get; set; } = string.Empty;
        public string? Amount { get; set; }
        public string? Year { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
    #endregion
    #region Major Work Item Level
    public class ExceptionReportMajorWorkItem
    {
        public string ProjectId { get; set; } = string.Empty;
        public string ReferenceId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string? ComponentId { get; set; }
        public int? YearOfWork { get; set; }
        public int? WorkTypeId { get; set; }
        public string? InfraType { get; set; }
    }
    public class ExceptionReportMajorWorkLocations
    {
        public string ParentId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string? InfraId { get; set; }
        public string? DetailedScope { get; set; }
        public string? TargetUnitId { get; set; }
        public string? TargetUnit { get; set; }
        public double? StartX { get; set; }
        public double? StartY { get; set; }
        public double? EndX { get; set; }
        public double? EndY { get; set; }
        public double? PhysicalTarget { get; set; }
        public string? StartStationLimit { get; set; }
        public string? EndStationLimit { get; set; }
        public double? EndChainage { get; set; }
        public double? StartChainage { get; set; }
        public double? Length { get; set; }
    }
    #endregion
}
