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
    public class AdminOfficeRegion
    {
        public string OfficeParticipantId { get; set; } = string.Empty;
        public string OfficeName { get; set; } = string.Empty;
        public string OfficeType { get; set; } = string.Empty;
        public string? RegionParticipantId { get; set; }
        public string? RegionCode { get; set; }
        public string? RegionName { get; set; }
    }
}
