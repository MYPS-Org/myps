using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    public class DTOProgram
    {
    }
    public class AddProgramDTO
    {
        public int Stage { get; set; }
        public int Status { get; set; }
        public int Type { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Cost { get; set; }
        public int YearStart { get; set; }
        public int YearEnd { get; set; }
        public int UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
    }
}
