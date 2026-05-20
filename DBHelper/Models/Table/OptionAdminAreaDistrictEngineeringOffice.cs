using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionAdminAreaDistrictEngineeringOffice
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [MaxLength(100)]
        public string? GdbId { get; set; }
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ProvinceGdbId { get; set; } = string.Empty;
        [MaxLength(255)]
        public string? ProvinceName { get; set; }
        [Required]
        [MaxLength(255)]
        public string RegionParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string RegionName { get; set; } = string.Empty;
    }
}
