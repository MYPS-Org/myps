using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Revision
{
    public class RORevisionDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public DBHelper.Models.Enums.EnumRevisionStatus Status { get; set; }
    }
}
