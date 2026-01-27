using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class RevisionProjectMajorWorkItem
    {
        [Required]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string TransactionId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string ReferenceId { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        public int WorkTypeId { get; set; }
        [Required]
        [MaxLength(50)]
        public string InfraType { get; set; } = string.Empty;
        [Required]
        public bool IsDeleted { get; set; } = false;
    }
}
