using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class AdminMappingRoDeo
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string RoCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string DeoCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
    }
}
