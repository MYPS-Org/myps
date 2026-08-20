using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ImportJobResult
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
        public int ValidCount { get; set; }
        public int WarningCount { get; set; }
        public int ErrorCount { get; set; }
        [MaxLength(200)]
        public string TextFileName { get; set; } = string.Empty;
        [MaxLength(200)]
        public string ExcelFileName { get; set; } = string.Empty;
        public DateTime QueuedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        [MaxLength(50)]
        public string RequestedBy { get; set; } = string.Empty;
    }
    //public class ImportJobResult
    //{
    //    [Key]
    //    public int Id { get; set; }
    //    [Required]
    //    [MaxLength(200)]
    //    public string ImportFunctionName { get; set; } = string.Empty;
    //    [MaxLength(100)]
    //    public string? LastUserIdInUse { get; set; }
    //    public DateTime? LastUsedDate { get; set; }
    //    [Required]
    //    public bool IsActive { get; set; }
    //}
}