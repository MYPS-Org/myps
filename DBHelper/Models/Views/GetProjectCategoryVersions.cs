using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class GetProjectCategoryVersions
    {
        public int MaxId { get; set; }
        public int Category { get; set; }
        public string ProjectSuffix { get; set; } = string.Empty;
        public string? IslandCode { get; set; }
        public int YearStart { get; set; }
    }
}
