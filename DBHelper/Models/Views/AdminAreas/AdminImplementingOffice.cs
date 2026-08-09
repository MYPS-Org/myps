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
    public class AdminImplementingOffice
    {
        public string Name { get; set; } = string.Empty;
        public string ParticipantId { get; set; } = string.Empty;
        public string OrgType { get; set; } = string.Empty;
        public string? RegionParticipantId { get; set; }
        public string? RegionName { get; set; }
    }
}
