using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.Modules
{
    public class ModulePaginationDto : EnumPagination<ModuleFilterDTO> { }
    public class ModuleFilterDTO
    {
        public string? EmployeeId { get; set; }
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public bool? IsActive { get; set; }
    }
}
