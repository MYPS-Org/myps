using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionRules
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        public int ReasonId { get; set; }
        [Required]
        [MaxLength(50)]
        public string PCMA_Status { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Package_Status { get; set; } = string.Empty;
        [Required]
        [MaxLength(1500)]
        public string Field { get; set; } = string.Empty;
    }
}
