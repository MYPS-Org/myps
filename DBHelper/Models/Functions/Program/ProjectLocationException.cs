using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Functions.Program
{
    public class ProjectLocationException
    {
        [Required]
        [Key]
        [MaxLength(255)]
        public string ProjectId { get; set; } = string.Empty;
        public string? ProjectDescription { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}
