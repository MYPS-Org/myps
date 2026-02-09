using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    public class SMTPModel
    {
        public string? Recipient { get; set; } = string.Empty;
        public string Subject { get; set; } = "MYPS Web";
        public string? Body { get; set; } = string.Empty;
        public string? CCAddress { get; set; } = string.Empty;
        public List<dynamic>? Files { get; set; } = null;
    }
}
