using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class Project
    {
        [Key]
        public required int Id { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string ProjectName { get; set; } = string.Empty;
        public string ProjectDescription { get; set; } = string.Empty;
        public Double Cost { get; set; }
        public int StatusId { get; set; } = 0; // 0: Inactive, 1: Active, 2: Completed
        public DateTime StartDate { get; set; } = DateTime.Now;
        public int ProgramStageId { get; set; }
        public EnumProgramStage ProgramStage { get; set; }
        public string UsertId { get; set; } = string.Empty;
        public Users? User { get; set; } // User who created the project
    }
}
