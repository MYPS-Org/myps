using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RuleComponentCost
    {
        public bool ComponentType { get; set; } = false;
        public bool ComponentId { get; set; } = false;
        public bool Description { get; set; } = false;
        public bool Total { get; set; } = false;
    }

    public class RuleComponentCostYear
    {
        public bool ParentId { get; set; } = false;
        public bool CostYear { get; set; } = false;
        public bool Cost { get; set; } = false;
        public bool StartDate { get; set; } = false;
        public bool EndDate { get; set; } = false;
    }

    public class RuleFundingProfile
    {
        public bool Source { get; set; } = false;
        public bool Agreement { get; set; } = false;
        public bool Amount { get; set; } = false;
        public bool Percentage { get; set; } = false;
    }

    public class RuleMajorItemLocation
    {
        public bool InfraId { get; set; } = false;
        public bool DetailedScope { get; set; } = false;
        public bool TargetUnitId { get; set; } = false;
        public bool TargetUnit { get; set; } = false;
        public bool StartX { get; set; } = false;
        public bool StartY { get; set; } = false;
        public bool EndX { get; set; } = false;
        public bool EndY { get; set; } = false;
        public bool PhysicalTarget { get; set; } = false;
        public bool StartStationLimit { get; set; } = false;
        public bool EndStationLimit { get; set; } = false;
        public bool From { get; set; } = false;
        public bool To { get; set; } = false;
    }

    public class RuleMajorItemOfWork
    {
        public bool ComponentId { get; set; } = false;
        public bool YearOfWork { get; set; } = false;
        public bool WorkTypeId { get; set; } = false;
        public bool InfraType { get; set; } = false;
    }

    public class RuleProjectDetails
    {
        public bool UACS { get; set; } = false;
        public bool MYCAApprovalDate { get; set; } = false;
        public bool Description { get; set; } = false;
        public bool Category { get; set; } = false;
        public bool Thrust { get; set; } = false;
        public bool Origin { get; set; } = false;
        public bool City { get; set; } = false;
        public bool Province { get; set; } = false;
        public bool LegislativeDistrict { get; set; } = false;
        public bool OperatingUnit { get; set; } = false;
        public bool ImplementingOffice { get; set; } = false;
        public bool DEO { get; set; } = false;
        public bool Region { get; set; } = false;
        public bool Agency { get; set; } = false;
        public bool ImplementationMode { get; set; } = false;
        public bool EmergencyMode { get; set; } = false;
        public bool Feasibility { get; set; } = false;
        public bool FeasibilityDate { get; set; } = false;
        public bool DetailedDesign { get; set; } = false;
        public bool DetailedDesignDate { get; set; } = false;
        public bool RowAvailable { get; set; } = false;
        public bool RegionWide { get; set; } = false;
        public bool Tier { get; set; } = false;
    }

    public class ModificationRules
    {
        public RuleProjectDetails ProjectDetailsRules { get; set; } = new RuleProjectDetails();
        public RuleComponentCost ComponentCostRules { get; set; } = new RuleComponentCost();
        public RuleComponentCostYear ComponentCostYearRules { get; set; } = new RuleComponentCostYear();
        public RuleMajorItemOfWork MajorItemOfWorkRules { get; set; } = new RuleMajorItemOfWork();
        public RuleMajorItemLocation MajorItemLocationRules { get; set; } = new RuleMajorItemLocation();
        public RuleFundingProfile FundingProfileRules { get; set; } = new RuleFundingProfile();
    }
}
