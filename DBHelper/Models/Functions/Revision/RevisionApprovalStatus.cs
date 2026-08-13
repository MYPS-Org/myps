using DBHelper.Models.Enums;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionApprovalStatus
    {
        public EnumRevisionStatus ROStatus { get; set; }
        public EnumRevisionStatus COStatus { get; set; }
        public int IsFullyApproved { get; set; }
        public int IsDisapproved { get; set; }
    }
}
