using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups.Project
{
    public class OptionFundingSource
    {
        [Required]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        [MaxLength(100)]
        public string Organization { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? Nature { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
