using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Revision
{
    public class RORevisionDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        [Required]
        public string Status { get; set; } = string.Empty;
    }
}
