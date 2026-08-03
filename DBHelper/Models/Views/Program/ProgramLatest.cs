using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views.Program
{
    public class ProgramLatest
    {
        [Key]
        public int Id { get; set; }
        public int RevisionId { get; set; }
        public int StageFKId { get; set; }
        public string ProgramPK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Status { get; set; }
        public string? Type { get; set; }
        public string[] DataSecurityGroup { get; set; } = Array.Empty<string>();
        public int[] UserGroup { get; set; } = Array.Empty<int>();
        public int? NumberOfProjects { get; set; }
        public int StartYear { get; set; }
    }
}
