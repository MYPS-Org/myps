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
        /*  ParentWalletId and WalletDrawFrozen are NOT mapped.
            Both are wallet-era columns that V2 retired:
              - ParentWalletId pointed at dbo.tLSWallets, which no longer exists.
                The live parent link is ParentProjectId below.
              - WalletDrawFrozen's only writer was WF-6's ApplyApprovedRevisionAsync,
                and WF-6 has left the module. Publishing never wrote it.
            Both columns remain on dbo.tProjects (nullable, no default) so dropping
            them is a separate, deliberate migration — but nothing reads them, and
            an unmapped nullable column costs nothing on insert. */

        /// <summary>
        /// The itemized project's parent Lump Sum Project, by that project's
        /// ProjectId. Set by ItemizeProject; the whole Lump Sum child set hangs
        /// off it.
        /// </summary>
        [MaxLength(200)]
        public string? ParentProjectId { get; set; }

        /// <summary>Proj-1: 'Itemized' or 'Additional'.</summary>
        [MaxLength(20)]
        public string? ItemizationType { get; set; }

        /// <summary>Proj-9 lifecycle: 'potential' then 'scheduled'.</summary>
        [MaxLength(20)]
        public string? ProjectStatus { get; set; }
        [Required]
        public bool IsPublished { get; set; }
        [Required]
        public bool IsRevised { get; set; }
        [Required]
        public bool IsPublishable { get; set; }
        [Required]
        public int PCMARevisionCount { get; set; } = 0;
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
