using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System.ComponentModel.DataAnnotations;

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
    public class ReviseProjectDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public int RevisionHeader { get; set; }
        public int? RevisionCategory { get; set; }
        [Required]
        public int RevisionReason { get; set; }
    }
}
