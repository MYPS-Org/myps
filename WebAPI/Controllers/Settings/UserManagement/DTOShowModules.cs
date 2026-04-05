using DBHelper.Models.Table;
using DBHelper.Models.Enums;
namespace WebAPI.Controllers.Settings.Modules
{
    public class ModulePaginationDto : EnumPagination<ModuleFilterDTO> { }
    public class ModuleFilterDTO
    {
        public string? ModuleName { get; set; }
    }
}
