using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class ProjectsInGroup
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public string ProgramName { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public int RevisionNumber { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Category { get; set; }
        public string? Thrust { get; set; }
        public string? Origin { get; set; }
        public string? City { get; set; }
        public string? LegislativeDistrict { get; set; }
        public string? OperatingUnit { get; set; }
        public string? ImplementingOffice { get; set; }
        public string? DEO { get; set; }
        public string? Region { get; set; }
        public string? Agency { get; set; }
        public string? ImplementationMode { get; set; }
        public string? EmergencyMode { get; set; }
        public string? Feasibility { get; set; }
        public string? DetailedDesign { get; set; }
        public string? RowAvailable { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string UpdateBy { get; set; } = string.Empty;
        public DateTime UpdatedDate { get; set; }
        public bool IsPublished { get; set; }
    }
}
