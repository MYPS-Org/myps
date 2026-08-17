using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Hangfire.Models
{
    public class ReportJobPayload
    {
        public string JobId { get; set; } = Guid.NewGuid().ToString("N");
        public string ReportName { get; set; }
        public string QueryString { get; set; } // pre-built query string
        public string RequestedBy { get; set; }
    }
}
