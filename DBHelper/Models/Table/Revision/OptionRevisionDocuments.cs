using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class OptionRevisionDocuments
    {
        [Key]
        public int Id { get; set; }
        public bool IsActive { get; set; } = false;
        [Required]
        public int RevisionGroupId { get; set; }
        public int? CategoryId { get; set; }
        [Required]
        [MaxLength(10)]
        public string SecondSegmentName { get; set; } = string.Empty;
        // Added by Migration.RevisionDocumentsDescription.2026-10-21.sql: run it before deploying.
        [MaxLength(500)]
        public string? Description { get; set; }
    }
}
