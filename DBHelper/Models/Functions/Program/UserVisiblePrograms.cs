using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Program
{
    public class UserVisiblePrograms
    {
        [Required]
        [MaxLength(200)]
        public string ProgramPK { get; set; } = string.Empty;
    }
}
