using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Project
{
    public class UserVisibleProjects
    {
        [Required]
        [MaxLength(200)]
        public string ProjectPK { get; set; } = string.Empty;
    }
}
