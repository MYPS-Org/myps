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
    public class ProgramRevisions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public int RevisionNumber { get; set; }
        [Required]
        public EnumProgramStatus Status { get; set; }
        public Double? Cost { get; set; }
        [Required]
        public int YearStart { get; set; }
        [Required]
        public int YearEnd { get; set; }
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(50)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
