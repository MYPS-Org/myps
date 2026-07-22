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
    [Table("dbo.tOptionAdminOffice")]
    public class OptionAdminOffice
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(15)]
        public string OfficeType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(10)]
        public string? InternalOrgUnitType { get; set; }
        public int? NetworkStatusId { get; set; }
        [Required]
        public bool Deprecated { get; set; }
        [MaxLength(10)]
        public string? SucceededByParticipantId { get; set; }
        [Required]
        public DateTime CreatedDate { get; set; }
        public DateTime? UpdatedDate { get; set; }
        [MaxLength(10)]
        // FK -> dbo.tOptionAdminAreaRegion(ParticipantId)
        public string? RegionParticipantId { get; set; }
        [MaxLength(10)]
        // FK -> dbo.tOptionAdminOffice(ParticipantId)
        public string? ParentParticipantId { get; set; }
    }
}
