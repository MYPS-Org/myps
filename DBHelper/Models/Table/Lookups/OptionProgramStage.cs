using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionProgramStage : TableEnum
    {
        [Required]
        [Column(TypeName = "decimal(7,5)")]
        public decimal StageHierarchy { get; set; }
        [MaxLength(100)]
        public string? DisplayName { get; set; }
    
    }
}
