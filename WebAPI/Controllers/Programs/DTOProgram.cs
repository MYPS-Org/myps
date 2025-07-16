using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    public class ShowProgramDTO : EnumPagination
    {
        public ShowProgramFilterDTO Filters { get; set; } = new ShowProgramFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowProgramFilterDTO
    {
        public string? Name { get; set; }
        public string? YearStart { get; set; }
        public string? UserGroup { get; set; }
    }
    public class AddProgramDTO
    {
        public EnumProgramStage Stage { get; set; }
        public EnumProgramStatus Status { get; set; }
        public EnumProgramType Type { get; set; }
        public string Name { get; set; } = string.Empty;
        public int YearStart { get; set; }
        public int YearEnd { get; set; }
        public int UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
    }
}
