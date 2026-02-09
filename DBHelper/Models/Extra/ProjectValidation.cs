using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    public class ProjectValidation
    {
        public bool IsValid { get; set; } = false;
        public string Message { get; set; } = string.Empty;
    }
}
