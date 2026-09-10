using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
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

        // 2026-09-10: single source of truth for "is this option valid for a NEW selection" --
        // previously duplicated as hand-rolled date math in the frontend (3 call-sites) and
        // divergent from ValidateProjectDetailsLookups' own (deliberately different) "is this
        // already-selected value still acceptable to keep" rule. Date-only by design, matching
        // the frontend's pre-existing behavior exactly -- no IsActive gate.
        // Timezone logic duplicated (not called) from Helpers.Functions.CurrentDate() --
        // DBHelper has no project reference to Helpers (Helpers references DBHelper, not the
        // reverse), so this project can't call it directly. Keep in sync if that logic changes.
        [NotMapped]
        public bool IsCurrentlyValid => ValidUntil == 0 || ValidUntil >= TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila")).Year;
    }
}
