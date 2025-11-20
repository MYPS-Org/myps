using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Revision
{
    public class DTOReportAIP
    {
        [Required]
        public string ProgramName { get; set; } = string.Empty;
        [Required]
        public string ReportType { get; set; } = string.Empty;
    }
}
