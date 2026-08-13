using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionApprovals
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string Level { get; set; } = string.Empty;
        [Required]
        public EnumRevisionStatus Status { get; set; } = EnumRevisionStatus.Pending;
        public string? Description { get; set; }
        [MaxLength(100)]
        public string? Approver { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public DateTime? LastUpdatedDate { get; set; }
    }
}
