using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Revision
{
    public class MyRevisionRequestFilterDTO
    {
        public string? TransactionId { get; set; }
        public int? RevisionGroupId { get; set; }
        public int? ReasonId { get; set; }
        public DBHelper.Models.Enums.EnumRevisionStatus? RegionApproveStatus { get; set; }
        public DBHelper.Models.Enums.EnumRevisionStatus? COApproveStatus { get; set; }
    }
    public class ShowMyRevisionDTO : EnumPagination<MyRevisionRequestFilterDTO> { }
    public class ViewReviseProjectDTO
    {
        public string TransactionId { get; set; } = string.Empty;
    }
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
    public class UpdateRevisionStatusDTO
    {
        [Required]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        public DBHelper.Models.Enums.EnumRevisionStatus Status { get; set; }
    }
}
