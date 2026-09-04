using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionProjectCategoryToPAPMap
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public long CategoryId { get; set; }
        [Required]
        public long PAPKey { get; set; }
    }
}
