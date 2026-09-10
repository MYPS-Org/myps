using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups.Project
{
    public class OptionProjectThrustList
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int PAPKey { get; set; }
        [Required]
        [MaxLength(200)]
        public string ProgramName { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string SubProgramName { get; set; } = string.Empty;
        [Required]
        [MaxLength(400)]
        public string ActivityName { get; set; } = string.Empty;
        [Required]
        public int SequenceNumber { get; set; }
        [Required]
        public int ValidFromDate { get; set; }
        [Required]
        public int ValidToDate { get; set; }
        [MaxLength(100)]
        public string? InfrastructureType { get; set; }
        [Required]
        [MaxLength(400)]
        public string ThrustDescription { get; set; } = string.Empty;
        [Required]
        public bool IsActive { get; set; }

        // 2026-09-10: single source of truth for "is this option valid for a NEW selection" --
        // previously duplicated as hand-rolled date math in the frontend (3 call-sites, with its
        // own ValidFromDate-not-started exclusion and a strict > that Category's equivalent rule
        // didn't have). Aligned to Category's shape per operator decision: date-only, ValidToDate
        // >= currentYear, no ValidFromDate check, no IsActive gate.
        // Timezone logic duplicated (not called) from Helpers.Functions.CurrentDate() --
        // DBHelper has no project reference to Helpers (Helpers references DBHelper, not the
        // reverse), so this project can't call it directly. Keep in sync if that logic changes.
        [NotMapped]
        public bool IsCurrentlyValid => ValidToDate == 0 || ValidToDate >= TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila")).Year;
    }
}
