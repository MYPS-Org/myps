using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Project
{
    public class ProjectSupportingDocs
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        [Required]
        [MaxLength(500)]
        public string DocTypeName { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionSupportingDocs(Code)
        public string DocTypeFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string FileName { get; set; } = string.Empty;
        [Required]
        [MaxLength(4)]
        public string FileExtension { get; set; } = string.Empty;
        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; } = string.Empty;
        [MaxLength(1000)]
        public string? Description { get; set; }
        [Required]
        [MaxLength(200)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? CreatedDate { get; set; }
    }
}
