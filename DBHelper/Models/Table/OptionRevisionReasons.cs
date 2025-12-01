using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionRevisionReasons
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Reason { get; set; } = string.Empty;
        [Required]
        public int RevisionGroupId { get; set; }
        [Required]
        public int ReasonId { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
    }
}
