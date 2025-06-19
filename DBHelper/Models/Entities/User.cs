using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Entities
{
    public class User
    {
        [Key]
        public int Id { get; set; }
        public string EmployeeId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty; // former userid
        public string Password { get; set; } = string.Empty; // Encrypted
        public string UserRole { get; set; } = string.Empty; //Former UserType need to change this UserRole to Department
        public bool IsActive { get; set; } = true;
    }
}
