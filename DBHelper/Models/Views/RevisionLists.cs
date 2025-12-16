using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class RevisionLists
    {
        [Key]
        public int Id { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public int ReasonId { get; set; }
        public string RevisionName { get; set; } = string.Empty;
        public int RevisionGroupId { get; set; }
        public EnumRevisionStatus IsRegionApproved { get; set; }
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        public EnumRevisionStatus IsCOApproved { get; set; }
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
