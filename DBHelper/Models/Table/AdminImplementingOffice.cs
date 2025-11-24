using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class AdminImplementingOffice
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(20)]
        public string ParticipantId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? InternalOrgUnitName { get; set; }
        [MaxLength(5)]
        public string? InternalOrgUnitType { get; set; }
        [MaxLength(100)]
        public string? ProvinceName { get; set; }
        [MaxLength(100)]
        public string? RegionName { get; set; }
        [MaxLength(100)]
        public string? CongressionalDistrictName { get; set; }
        [MaxLength(2)]
        public string? IslandCode { get; set; }
    }
}
