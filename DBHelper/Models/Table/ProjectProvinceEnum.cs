using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class ProjectProvinceEnum
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(50)]
        public string ProvinceName { get; set; } = string.Empty;
    }
}
