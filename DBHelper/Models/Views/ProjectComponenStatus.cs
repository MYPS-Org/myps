using System;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class ProjectComponentStatus
    {
        public string ProgramName { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string ProjectComponentId { get; set; } = string.Empty;
        public string ComponentId { get; set; } = string.Empty;
        public int? ConstructionStatusCode { get; set; }
        public string ConstructionStatusName { get; set; } = string.Empty;
        public bool PackedStatusCode { get; set; }
        public string PackedStatusName { get; set; } = string.Empty;
    }
}
