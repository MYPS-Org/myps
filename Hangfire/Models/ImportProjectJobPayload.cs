using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Hangfire.Models
{
    public class ImportProjectJobPayload
    {
        public string JobId { get; set; } = Guid.NewGuid().ToString("N");
        public string FileUrl { get; set; }
        public string ProgramId { get; set; }
        public string StageName { get; set; }
        public string RequestedBy { get; set; }
    }
}
