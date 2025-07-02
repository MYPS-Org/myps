using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Views
{
    public class Users
    {
        public int Id { get; set; }
        public string? UserGroups { get; set; }
        public string? EmployeeId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string RegCode { get; set; } = string.Empty;
        public string? PlantillaOffice { get; set; }
        public bool IsActive { get; set; }
    }
}
