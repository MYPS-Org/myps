using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.API
{
    public class PublishPCMAParent
    {
        public string ProgramId { get; set; } = string.Empty;
        public string MYPSUserName { get; set; } = string.Empty;
        public List<PublishPCMAProjects> Projects { get; set; } = new List<PublishPCMAProjects>();
    }
}
