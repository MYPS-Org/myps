using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProgramStages
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionId { get; set; }
        [Required]
        public EnumProgramStage StageNumber { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        public int StageStatus { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
