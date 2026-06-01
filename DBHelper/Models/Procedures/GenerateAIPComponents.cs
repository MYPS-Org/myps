using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Procedures
{
    public class GenerateAIPComponents
    {
        [Key]
        [Required]
        public int Id { get; set; }
        public int ComponentSortKey { get; set; }
        public string? ProjectComponentId { get; set; }
        public string? Description { get; set; }
        public string? ScopeDescription { get; set; }
        public string? ScopeMeasure { get; set; }
        public object? TotalUnitCost { get; set; }
        [Required]
        public Double TotalComponentCost { get; set; }
    }
}
