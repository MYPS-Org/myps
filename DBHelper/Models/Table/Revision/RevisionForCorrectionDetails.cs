using DBHelper.Models.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Table.Revision
{
    public class RevisionForCorrectionDetails
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public int RevisionDetailFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ReturnedBy { get; set; } = string.Empty;
        [Required]
        [MaxLength(500)]
        public string CorrectionReason { get; set; } = string.Empty;
        [Required]
        public DateTime ForCorrectionDate { get; set; }
    }
}
