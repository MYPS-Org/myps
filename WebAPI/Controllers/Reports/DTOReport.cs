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
    public class DTOReportAIP
    {
        [Required]
        public string ProgramName { get; set; } = string.Empty;
        [Required]
        public string ReportType { get; set; } = string.Empty;
    }
    public class DTOReportAIPFilter
    {
        public string ProgramName { get; set; }
        public string ProgramId { get; set; }
        public string StageName { get; set; }
        public string Region { get; set; }
    }

    public class DTOProgramProjectDetailsResponse
    {
        public DTOProgramDetails Program { get; set; }
    }

    public class DTOProgramDetails
    {
        public string ProgramName { get; set; }
        public string ProgramId { get; set; }
        public string StageName { get; set; }
        public List<DTOProjectInfo> ProjectList { get; set; } = new List<DTOProjectInfo>();
    }

    public class DTOProjectInfo
    {
        public string ProjectId { get; set; }
        public string ProjectCategory { get; set; }
        public string Region { get; set; }
        public List<DTOComponentCost> ComponentCosts { get; set; } = new List<DTOComponentCost>();
        public List<DTOMajorWorkItem> MajorItems { get; set; } = new List<DTOMajorWorkItem>();
    }

    public class DTOComponentCost
    {
        public string ComponentId { get; set; }
        public double Amount { get; set; }
        public string Description { get; set; }
    }

    public class DTOMajorWorkItem
    {
        public string ComponentId { get; set; }
        public string Measure { get; set; }
        public string Description { get; set; }
    }
}


