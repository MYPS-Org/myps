using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DBHelper.Models.Views
{
    public class AppModules
    {
        [Key]
        public int Id { get; set; }
        public string? ModuleName { get; set; }
        public string? Description { get; set; }
        public int ControllerCount { get; set; }
        public int ViewCount { get; set; }
        public string? Controllers { get; set; }   // Raw JSON string from SQL view
        public string? Views { get; set; }          // Raw JSON string from SQL view
    }
    public class AppModuleControllerModel
    {
        public string ControllerName { get; set; } = string.Empty;
        public bool Linked { get; set; } = false;
    }

    public class AppModuleViewModel
    {
        public string RouteName { get; set; } = string.Empty;
        public bool Linked { get; set; } = false;
    }
}