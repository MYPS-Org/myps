using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class RevisionProjectComponentCost
    {
        public int Id { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string ComponentType { get; set; } = string.Empty;
        public string ComponentId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public Double Amount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
}
