using DBHelper.Models.Enums;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class RecomputeProgramCost
    {
        [Key]
        public int RevisionId { get; set; }
        public EnumProgramStage StageId { get; set; }
        public decimal NewCost { get; set; }
    }
}
