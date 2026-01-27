using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class RevisionRules
    {
        [Key]
        public int Id { get; set; }
        public string Reason { get; set; } = string.Empty;
        public int RevisionGroupId { get; set; }
        public int ReasonId { get; set; }
        public string PCMA_Status { get; set; } = string.Empty;
        public string Package_Status { get; set; } = string.Empty;
        public string Field { get; set; } = string.Empty;
    }
}
