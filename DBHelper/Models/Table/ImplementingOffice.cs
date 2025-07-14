using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ImplementingOffice
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string OrgName { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string OrgCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(6)]
        public string OrgType { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string OrgId { get; set; } = string.Empty;
    }
}
