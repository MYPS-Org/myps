using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views.AdminAreas
{
    public class AdminDEO
    {
        [Key]
        public int Id { get; set; }
        public string ParticipantId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string OfficeType { get; set; } = string.Empty;
        public string? RegionParticipantId { get; set; }
        public string? RegionCode { get; set; }
        public string? RegionName { get; set; }
        public string? ParentParticipantId { get; set; }
        public string? ParentName { get; set; }
    }
}
