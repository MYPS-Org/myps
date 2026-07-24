using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views.Program
{
    public class Programs
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public int RevisionId { get; set; }
        public int NumberOfProjects { get; set; }
        public string StageName { get; set; } = string.Empty;
        public bool IsSkipped { get; set; }
        public string? SkipReason { get; set; }
        public string? Name { get; set; }
        public string[] DataSecurityGroup { get; set; } = Array.Empty<string>();
        public int[] UserGroup { get; set; } = new int[] { };
        public string? Status { get; set; }
        public string? Type { get; set; }
        public Double? Cost { get; set; }
        public int? YearStart { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public bool IsPublished { get; set; }
    }
}
