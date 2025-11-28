using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionRevisionHeader
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string RevisionName { get; set; } = string.Empty;
        [Required]
        public int RevisionGroupId { get; set; }
    }
}
