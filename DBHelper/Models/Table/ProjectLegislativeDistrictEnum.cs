using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class AdminAreaCongressionalDistrict
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(255)]
        public string GdbId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ProvinceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProvinceName { get; set; } = string.Empty;
    }
}
