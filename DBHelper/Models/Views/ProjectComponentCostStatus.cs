using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class ProjectComponentCostStatus
    {
        public int Id { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public string? CostId { get; set; }
        public string ComponentType { get; set; } = string.Empty;
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Double Total { get; set; }
        public string StageName { get; set; } = string.Empty;
        public int? ConstructionStatusCode { get; set; }
        public string ConstructionStatusName { get; set; } = string.Empty;
        public bool PackedStatusCode { get; set; }
        public string PackedStatusName { get; set; } = string.Empty;
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
        public bool IsDeleted { get; set; }
    }
}
