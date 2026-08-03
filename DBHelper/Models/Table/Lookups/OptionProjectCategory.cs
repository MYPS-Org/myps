using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionProjectCategory
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int CategoryId { get; set; }
        [MaxLength(200)]
        public string? CategoryName { get; set; }
        [Required]
        public int Minimum { get; set; }
        [Required]
        public int Maximum { get; set; }
        [Required]
        public int ValidUntil { get; set; }
        public bool IsActive { get; set; } = false;
    }
}
