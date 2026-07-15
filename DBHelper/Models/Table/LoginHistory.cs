using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class LoginHistory
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string UserId { get; set; } = string.Empty;
        [Required]
        [MaxLength(15)]
        public string IpAddress { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string HostName { get; set; } = string.Empty;
        [Required]
        public DateTime LogDate { get; set; } = DateTime.UtcNow;
        [Required]
        public bool IsValid { get; set; }
        [Required]
        [MaxLength(100)]
        public string ValidationMessage { get; set; } = "Authenticated";
    }
}
