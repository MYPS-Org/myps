using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups.Project
{
    [Table("dbo.tOptionProjectThrustList")]
    public class OptionProjectThrustList
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int PAPKey { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string SubProgramName { get; set; } = string.Empty;
        [Required]
        [MaxLength(400)]
        public string ActivityName { get; set; } = string.Empty;
        [Required]
        public int SequenceNumber { get; set; }
        [Required]
        public int ValidFromDate { get; set; }
        [Required]
        public int ValidToDate { get; set; }
        [MaxLength(100)]
        public string? InfrastructureType { get; set; }
        [Required]
        [MaxLength(400)]
        public string ThrustDescription { get; set; } = string.Empty;
        [Required]
        public bool IsActive { get; set; }
    }
}
