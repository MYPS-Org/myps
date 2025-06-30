using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Models.Enums;

namespace DBHelper.Models.Dtos
{
    public class ShowPermissionsDTO : EnumPagination
    {
        public ShowPermissionFilterDTO Filters { get; set; } = new ShowPermissionFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowPermissionFilterDTO
    {
        public string? ModuleFunction { get; set; }
        public string? Description { get; set; }
    }
}