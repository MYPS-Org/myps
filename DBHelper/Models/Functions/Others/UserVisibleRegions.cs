using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Others
{
    public class UserVisibleRegions
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(10)]
        public string ParticipantId { get; set; } = string.Empty;
        [Required]
        [MaxLength(40)]
        public string Code { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(2)]
        public string IslandCode { get; set; } = string.Empty;
    }
}
