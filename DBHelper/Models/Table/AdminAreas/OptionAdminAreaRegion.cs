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
    [Table("dbo.tOptionAdminAreaRegion")]
    public class OptionAdminAreaRegion
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(40)]
        public string Code { get; set; } = string.Empty;
        [MaxLength(20)]
        public string? Hierarchy { get; set; }
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
        public int? NetworkStatusId { get; set; }
        [Required]
        public bool Deprecated { get; set; }
        [MaxLength(10)]
        public string? SucceededByParticipantId { get; set; }
        [Required]
        public DateTime CreatedDate { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
