using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Revision
{
    public class GenerateReportDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
    }
    public class RequestReportAIPDTO : GenerateReportDTO
    {
        public string? StageName { get; set; }
        public string? CategoryName { get; set; }
        public string? RegionName { get; set; }
        public string? OperatingUnitName { get; set; }
        public string? DistrictEngineeringOffice { get; set; }
        public string? ImplementingOfficeName { get; set; }
        public string? LegislativeDistrictName { get; set; }
    }
    public class RequestReportRBPComponentsDTO: GenerateReportDTO
    {
        public string? RegionName { get; set; }
    }
    public class RequestReportRBPDTO: GenerateReportDTO
    {
        public string? RegionName { get; set; }
    }
    public class RequestReportRBPTierDTO : GenerateReportDTO
    {
        public string? RegionName { get; set; }
    }
    public class RequestReportRDIPDTO : GenerateReportDTO
    {
        public string? RegionName { get; set; }
    }
}