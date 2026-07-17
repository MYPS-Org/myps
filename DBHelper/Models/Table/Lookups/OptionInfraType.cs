using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionInfraType
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        public int InfraId { get; set; }
        [Required]
        [MaxLength(10)]
        public string InfraCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string InfraName { get; set; } = string.Empty;
    }
}
