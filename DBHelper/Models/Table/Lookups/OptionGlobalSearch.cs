using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionGlobalSearch
    {
        [Key]
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string CategoryName { get; set; } = string.Empty;
    }
}
