using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class ProjectLatestStage
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string? ReferenceId { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int? CategoryId { get; set; }
        public string? Category { get; set; }
        public int? ThrustPAPKey { get; set; }
        public string? Thrust { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
    }
}
