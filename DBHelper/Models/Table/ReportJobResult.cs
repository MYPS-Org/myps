using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ReportJobResult
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(50)]
        public string JobId { get; set; } = string.Empty;
        [MaxLength(50)]
        public string HangfireJobId { get; set; } = string.Empty;
        [MaxLength(50)]
        public string Status { get; set; } = string.Empty;// Queued, Processing, Completed, CompletedWithErrors, Failed
        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;
        [MaxLength(200)]
        public string FileName { get; set; } = string.Empty;
        [MaxLength(200)]
        public string FilePath { get; set; } = string.Empty;
        public DateTime QueuedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        [MaxLength(50)]
        public string RequestedBy { get; set; } = string.Empty;
    }
}
