using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ImportingStatus
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ImportFunctionName { get; set; } = string.Empty;
        [MaxLength(100)]
        public string? LastUserIdInUse { get; set; }
        public DateTime? LastUsedDate { get; set; }
        [Required]
        public bool IsActive { get; set; }
    }
}
