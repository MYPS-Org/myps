using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.Revision.RegionalOffice
{
    public class RORevisionDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public DBHelper.Models.Enums.EnumRevisionStatus Status { get; set; }
        public string? Description { get; set; }
    }
}
