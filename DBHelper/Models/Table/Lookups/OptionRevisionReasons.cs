using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionRevisionReasons
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int ReasonId { get; set; }
        [Required]
        [MaxLength(100)]
        public string Reason { get; set; } = string.Empty;
        [Required]
        // FK -> dbo.tOptionRevisionHeader(RevisionGroupId)
        public int RevisionGroupId { get; set; }
        public int?[] CategoryId { get; set; } = Array.Empty<int?>();
        [Required]
        public bool IsActive { get; set; }
    }
}
