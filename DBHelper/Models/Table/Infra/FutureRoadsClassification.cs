using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Infra
{
    public class FutureRoadsClassification
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int ClassificationId { get; set; }
        [Required]
        [MaxLength(10)]
        public string Classification { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
        [MaxLength(200)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdateDate { get; set; }
    }
}
