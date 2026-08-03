using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Project
{
    public class Projects
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        // FK -> dbo.tPrograms(ProgramPK)
        public string ProgramFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(255)]
        public string ProgramId { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? ExternalId { get; set; }
        [MaxLength(200)]
        public string? MYId { get; set; }
        [Required]
        [MaxLength(10)]
        public string ProjectType { get; set; } = string.Empty;
        // FK -> dbo.tProjectGroups(Id)
        public int? ProjectGroupFK { get; set; }
        // FK -> dbo.tLSWallets(Id)
        public int? ParentWalletId { get; set; }
        [Column(TypeName = "decimal(18,5)")]
        public decimal? WalletDrawFrozen { get; set; }
        [Required]
        public bool IsPublished { get; set; }
        [Required]
        public bool IsRevised { get; set; }
        [Required]
        public bool IsPublishable { get; set; }
        [Required]
        public int PCMARevisionCount { get; set; }
        [MaxLength(100)]
        public string? LockedBy { get; set; }
        public DateTime? LockedDate { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
}
