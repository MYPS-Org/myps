using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class OptionReportProgram
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(50)]
        public string? ReportName { get; set; }
    }
}
