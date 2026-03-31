using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Views
{
    public class AppModules
    {
        public int Id { get; set; }
        public string ModuleName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? ControllerCount { get; set; }
        public int? ViewCount { get; set; }
    }
}
