using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionRevisionCategory
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        [MaxLength(100)]
        public string CategoryName { get; set; } = string.Empty;
        [Required]
        public int CategoryId { get; set; }
        [Required]
        public int RevisionGroupId { get; set; }
    }
}
