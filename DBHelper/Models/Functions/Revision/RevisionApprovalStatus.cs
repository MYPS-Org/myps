using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionApprovalStatus
    {
        public EnumRevisionStatus ROStatus { get; set; }
        [MaxLength(50)]
        public string? ROStatusName { get; set; }
        public EnumRevisionStatus COStatus { get; set; }
        [MaxLength(50)]
        public string? COStatusName { get; set; }
        public int IsFullyApproved { get; set; }
        public int IsDisapproved { get; set; }
    }
}
