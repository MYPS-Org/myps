using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Others
{
    public class UserVisibleOffices
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(15)]
        public string OfficeType { get; set; } = string.Empty;
        public int? RegionId { get; set; }
    }
}
