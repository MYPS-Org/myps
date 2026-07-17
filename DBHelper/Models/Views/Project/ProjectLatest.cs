using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views.Project
{
    public class ProjectLatest
    {
        [Key]
        public int Id { get; set; }
        public int RevisionId { get; set; }
        public int StageFK { get; set; }
        public string ProjectPK { get; set; } = string.Empty;
        public string ProgramFK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string? ProgramName { get; set; }
        public string? StageName { get; set; }
        public int Category { get; set; }
        public string? CategoryName { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? LastUpdatedBy { get; set; }
        public DateTime? LastUpdatedDate { get; set; }
        public string RevisionCreatedBy { get; set; } = string.Empty;
        public DateTime RevisionCreatedDate { get; set; }
    }
}
