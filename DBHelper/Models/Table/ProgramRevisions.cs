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
        [MaxLength(200)]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string ProgramUniqueId { get; set; } = string.Empty;
        [Required]
        public int RevisionNumber { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public string[] DataSecurityGroup { get; set; } = new string[] { };
        [Required]
        public int[] UserGroup { get; set; } = new int[] { };
        [Required]
        public EnumProgramStatus Status { get; set; }
        [Required]
        public EnumProgramType Type { get; set; }
        public Double? Cost { get; set; }
        [Required]
        public int YearStart { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
