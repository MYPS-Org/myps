using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionAdminAreaRegion
    {
        [Key]
        [MaxLength(255)]
        public string Id { get; set; } = string.Empty;
        public Double? GdbId { get; set; }
        [MaxLength(255)]
        public string? Name { get; set; }
        [MaxLength(255)]
        public string? ParticipantId { get; set; }
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
    }
}
