using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class Permissions
    {
        public int Id { get; set; }
        public string Module { get; set; } = string.Empty;
        public string ModuleFunction { get; set; } = string.Empty;
        public string? ModuleFunctionDescription { get; set; }
    }
}
