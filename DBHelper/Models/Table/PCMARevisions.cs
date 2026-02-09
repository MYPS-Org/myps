using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class PCMARevisions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string RevisionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
    }
}
