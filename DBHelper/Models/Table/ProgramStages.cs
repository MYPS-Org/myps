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
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public string ProgramUniqueId { get; set; } = string.Empty;
        [Required]
        public int RevisionId { get; set; }
        [Required]
        public EnumProgramStage StageId { get; set; }
        [Required]
        [MaxLength(100)]
        public string StageName { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [Required]
        public bool IsPublished { get; set; }
    }
}
