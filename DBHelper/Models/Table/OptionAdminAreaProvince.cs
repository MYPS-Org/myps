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
    public class OptionAdminAreaProvince
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string GdbId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? Code { get; set; }
        [Required]
        [MaxLength(10)]
        public string RegionParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string RegionName { get; set; } = string.Empty;
    }
}
