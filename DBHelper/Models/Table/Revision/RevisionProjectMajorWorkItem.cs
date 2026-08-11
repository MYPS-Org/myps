using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionProjectMajorWorkItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        // FK -> dbo.tRevisionDetails(Id)
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(20)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        // FK -> dbo.tOptionScopeOfWork(Enum)
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionInfraType(InfraCode)
        public string InfraTypeFK { get; set; } = string.Empty;
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
