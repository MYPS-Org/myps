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
    public class AdminAreaProvince
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int GdbId { get; set; }
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;
        [Required]
        public int RegionFkId { get; set; }
        [Required]
        [MaxLength(255)]
        public string RegionName { get; set; } = string.Empty;
    }
}
