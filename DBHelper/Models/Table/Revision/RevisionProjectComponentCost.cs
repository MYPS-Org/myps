using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tRevisionDetails(Id)
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(20)]
        // FK -> dbo.tOptionProjectComponentType(ComponentId)
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
        [Required]
        public bool IsDeleted { get; set; } = false;

        [NotMapped]
        public string TransactionId { get; set; } = string.Empty;
    }
}
