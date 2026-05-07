using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Drawing;
using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using static Dapper.SqlMapper;

namespace Helpers
{
    public static class ExceptionReport
    {
        #region Project Level
        public static ExceptionReportResponse ValidateProjectGeneralInformation(ExceptionReportProjectGeneralInformation d)
        {
            /*
                public string ProjectId { get; set; } = string.Empty;
                public int? Category { get; set; }
                public int? Thrust { get; set; }
                public string? Description { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (string.IsNullOrEmpty(d.ProjectId))
            {
                reasons.Add("• Project ID is missing or has not been set.");
            }
            if (d.Category == null || d.Category <= 0)
            {
                reasons.Add("• Project category is missing or has not been set.");
            }
            if (d.Thrust == null || d.Thrust <= 0)
            {
                reasons.Add("• Project thrust is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.Description))
            {
                reasons.Add("• Project description is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        public static ExceptionReportResponse ValidateProjectLocationDetails(ExceptionReportProjectLocationDetails d)
        {
            /*
                public int? Province { get; set; }
                public string? City { get; set; }
                public string? LegislativeDistrict { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();

            if (d.Province == null || d.Province <= 0)
            {
                reasons.Add("• Project province is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.City))
            {
                reasons.Add("• Project city is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.LegislativeDistrict))
            {
                reasons.Add("• Project legislative district is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        public static ExceptionReportResponse ValidateProjectOrganizationalResponsibilities(ExceptionReportProjectOrganizationalResponsibilities d)
        {
            /*
                public string? DEO { get; set; }
                public string? Region { get; set; }
                public string? ImplementingOffice { get; set; }
                public string? OperatingUnit { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (string.IsNullOrEmpty(d.DEO))
            {
                reasons.Add("• Project DEO is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.Region))
            {
                reasons.Add("• Project region is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.ImplementingOffice))
            {
                reasons.Add("• Project implementing office is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.OperatingUnit))
            {
                reasons.Add("• Project operating unit is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        public static ExceptionReportResponse ValidateProjectImplementationReadinessAndModality(ExceptionReportProjectImplementationReadinessAndModality d)
        {
            /*
                public int? ImplementationMode { get; set; }
                public int? Feasibility { get; set; }
                public DateTime? FeasibilityDate { get; set; }
                public int? DetailedDesign { get; set; }
                public DateTime? DetailedDesignDate { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (d.ImplementationMode == null || d.ImplementationMode <= 0)
            {
                reasons.Add("• Project implementation mode is missing or has not been set.");
            }
            if (d.Feasibility == null || d.Feasibility <= 0)
            {
                reasons.Add("• Project feasibility is missing or has not been set.");
            }
            if (d.FeasibilityDate == null && d.Feasibility == 1)
            {
                reasons.Add("• Project feasibility date is missing or has not been set.");
            }
            if (d.DetailedDesign == null)
            {
                reasons.Add("• Project detailed design is missing or has not been set.");
            }
            if (d.DetailedDesignDate == null && d.DetailedDesign == 1)
            {
                reasons.Add("• Project detailed design date is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        #endregion
        #region Funding Profile Level
        public static ExceptionReportResponse ValidateFundingProfile(ExceptionReportFundingProfile d)
        {
            /*
                public string ProjectId { get; set; } = string.Empty;
                public string StageName { get; set; } = string.Empty;
                public string? Source { get; set; }
                public string? Agreement { get; set; }
                public double? Amount { get; set; }
                public double? Percentage { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (string.IsNullOrEmpty(d.ProjectId))
            {
                reasons.Add("• Project ID is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.Source))
            {
                reasons.Add("• Funding source is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.Agreement))
            {
                reasons.Add("• Funding agreement is missing or has not been set.");
            }
            if (d.Amount == null || d.Amount < 0)
            {
                reasons.Add("• Funding amount is missing or has not been set.");
            }
            if (d.Percentage == null || d.Percentage < 0 || d.Percentage > 100)
            {
                reasons.Add("• Funding percentage is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        #endregion
        #region Component Cost Level
        public static ExceptionReportResponse ValidateComponentCost(ExceptionReportComponentCost d)
        {
            /*
                public string ProjectId { get; set; } = string.Empty;
                public string StageName { get; set; } = string.Empty;
                public string CostId { get; set; } = string.Empty;
                public string? ComponentType { get; set; }
                public string? Description { get; set; }
                public double? Total { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (string.IsNullOrEmpty(d.ComponentType))
            {
                reasons.Add("• Component type is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.Description))
            {
                reasons.Add("• Component description is missing or has not been set.");
            }
            if (d.Total == null || d.Total < 0)
            {
                reasons.Add("• Component total cost is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;

        }
        public static ExceptionReportResponse ValidateComponentCostPerYear(List<ExceptionReportComponentCostPerYear> breakdowns)
        {
            /*
            public string ComponentCostId { get; set; } = string.Empty;
            public string? Amount { get; set; }
            public string? Year { get; set; }
            public DateTime? StartDate { get; set; }
            public DateTime? EndDate { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            foreach (var breakdown in breakdowns)
            {
                if (string.IsNullOrEmpty(breakdown.Amount))
                {
                    reasons.Add($"• Component cost amount for year {breakdown.Year} is missing or has not been set.");
                }
                if (string.IsNullOrEmpty(breakdown.Year))
                {
                    reasons.Add("• Component cost year is missing or has not been set.");
                }
                if (breakdown.StartDate == null)
                {
                    reasons.Add($"• Component cost start date for year {breakdown.Year} is missing or has not been set.");
                }
                if (breakdown.EndDate == null)
                {
                    reasons.Add($"• Component cost end date for year {breakdown.Year} is missing or has not been set.");
                }
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        #endregion
        #region Major Work Item Level
        public static ExceptionReportResponse ValidateMajorWorkItem(ExceptionReportMajorWorkItem d)
        {
            /*
                public string ProjectId { get; set; } = string.Empty;
                public string ReferenceId { get; set; } = string.Empty;
                public string StageName { get; set; } = string.Empty;
                public string? ComponentId { get; set; }
                public int? YearOfWork { get; set; }
                public int? WorkTypeId { get; set; }
                public string? InfraType { get; set; }
             */
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (string.IsNullOrEmpty(d.ComponentId))
            {
                reasons.Add("• Major work item component ID is missing or has not been set.");
            }
            if (d.YearOfWork == null)
            {
                reasons.Add("• Major work item year of work is missing or has not been set.");
            }
            if (d.WorkTypeId == null)
            {
                reasons.Add("• Major work item work type ID is missing or has not been set.");
            }
            if (string.IsNullOrEmpty(d.InfraType))
            {
                reasons.Add("• Major work item infrastructure type is missing or has not been set.");
            }
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        public static ExceptionReportResponse ValidateMajorWorkLocations(ExceptionReportMajorWorkLocations d)
        {
            //For further discussions
            var response = new ExceptionReportResponse();
            var reasons = new List<string>();
            if (reasons.Count > 0)
            {
                response.IsValid = false;
                response.Reason = string.Join("\n", reasons);
            }
            return response;
        }
        #endregion
    }
}