using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Entities
{
    public class ProgramStage
    {
        [Key]
        public required string Id { get; set; }
        public string ProjectId { get; set; } = string.Empty;
        public Project? Project { get; set; } // Navigation property to Project
        public string ProgramId { get; set; } = string.Empty;
        public Program? Program { get; set; }
    }
}
