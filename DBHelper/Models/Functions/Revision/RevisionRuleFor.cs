using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Revision
{
    public class RevisionRuleFor
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int ReasonId { get; set; }
        [Required]
        [MaxLength(50)]
        public string PCMA_Status { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Package_Status { get; set; } = string.Empty;
        [Required]
        [MaxLength(1500)]
        public string Field { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
