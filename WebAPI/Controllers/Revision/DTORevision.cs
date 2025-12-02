using DBHelper.Models.Enums;
using DBHelper.Models.Table;

namespace WebAPI.Controllers.Revision
{
    public class MyRevisionRequestFilterDTO
    {
        public string? TransactionId { get; set; }
        public int? ModificationCategory { get; set; }
        public int? ModificationReason { get; set; }
        public DBHelper.Models.Enums.EnumRevisionStatus? RegionApproveStatus { get; set; }
        public DBHelper.Models.Enums.EnumRevisionStatus? COApproveStatus { get; set; }
    }
    public class ShowMyRevisionDTO : EnumPagination<MyRevisionRequestFilterDTO> { }
}
