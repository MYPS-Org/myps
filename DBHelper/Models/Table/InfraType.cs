using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class InfraType
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int InfraId { get; set; }
        [Required]
        [MaxLength(5)]
        public string InfraCode { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string Description { get; set; } = string.Empty;
    }
}
