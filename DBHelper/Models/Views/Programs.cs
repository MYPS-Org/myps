using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class Programs
    {
        public int Id { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
        public string? Stage { get; set; }
        public string? Status { get; set; }
        public string? Type { get; set; }
        public string Name { get; set; } = string.Empty;
        public Double? Cost { get; set; }
        public int YearStart { get; set; }
        public int YearEnd { get; set; }
        public string? UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string? UpdateBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        public bool IsPublished { get; set; }
    }
}
