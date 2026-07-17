using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class RecomputeProjectPublishable
    {
        [Required]
        public int ProjectsEvaluated { get; set; }
    }
}
