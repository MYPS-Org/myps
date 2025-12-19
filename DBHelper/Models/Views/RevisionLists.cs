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
        public string RevisionName { get; set; } = string.Empty;
        public int RevisionGroupId { get; set; }
        public string? CategoryName { get; set; }
        public int? CategoryId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public int ReasonId { get; set; }
        public string? RequestDocument { get; set; }
        public EnumRevisionStatus? RegionStatus { get; set; }
        public string? RegionStatusName { get; set; }
        public string? ROComment { get; set; }
        public DateTime? ROForCorrectionDate { get; set; }
        public string? RegionApprover { get; set; }
        public DateTime? RegionApprovedDate { get; set; }
        public EnumRevisionStatus? COStatus { get; set; }
        public string? COStatusName { get; set; }
        public string? COComment { get; set; }
        public DateTime? COForCorrectionDate { get; set; }
        public string? COApprover { get; set; }
        public DateTime? COApprovedDate { get; set; }
        public string? ApprovedDocument { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
