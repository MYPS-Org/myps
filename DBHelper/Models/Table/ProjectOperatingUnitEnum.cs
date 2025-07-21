using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectOperatingUnitEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string OrgName { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string OrgType { get; set; } = string.Empty;
    }
}
