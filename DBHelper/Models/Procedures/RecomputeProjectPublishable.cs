using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class RecomputeProjectPublishable
    {
        [Key]
        public int ProjectsEvaluated { get; set; }
    }
}
