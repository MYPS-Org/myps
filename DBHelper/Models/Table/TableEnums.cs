using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Table
{
    public class TableEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int NameId { get; set; }
        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;
    }
}
