using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.AdminAreas
{
    public class OptionAdminAreaCityMunicipality
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string Code { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? Hierarchy { get; set; }
        [Required]
        [MaxLength(40)]
        // FK -> dbo.tOptionAdminAreaProvince(Code)
        public string ProvinceCode { get; set; } = string.Empty;
        public int? NetworkStatusId { get; set; }
        [Required]
        public bool Deprecated { get; set; }
        [Required]
        public DateTime CreatedDate { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
