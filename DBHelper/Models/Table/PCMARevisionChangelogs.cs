using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class PCMARevisionChangelogs
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string RevisionDetailsId { get; set; } = string.Empty;
        [Required]
        public string OldValue { get; set; } = string.Empty;
        [Required]
        public string NewValue { get; set; } = string.Empty;
    }
}
