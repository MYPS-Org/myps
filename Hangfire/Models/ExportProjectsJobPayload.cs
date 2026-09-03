using System;

namespace Hangfire.Models
{
    public class ExportProjectsJobPayload
    {
        public string JobId { get; set; } = Guid.NewGuid().ToString("N");
        public string ProgramId { get; set; }
        public string StageName { get; set; }
        public string RequestedBy { get; set; }
    }
}
