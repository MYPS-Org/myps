using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectFundingSource
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int SourceId { get; set; }
        [Required]
        [MaxLength(100)]
        public string Org { get; set; } = string.Empty;
        [Required]
        [MaxLength(400)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(10)]
        public string? Nature { get; set; }
    }
}
