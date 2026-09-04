using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Lookups
{
    public class OptionProjectCategoryToPAPMap
    {
        public long? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public long? PAPKey { get; set; }
        public string? ThrustDescription { get; set; }
        public int? ValidToDate { get; set; }
    }
}
