using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table
{
    public class Permissions
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(100)]
        public string? ModuleFunction { get; set; }
        [MaxLength(200)]
        public string? Description { get; set; }
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
    }
}
