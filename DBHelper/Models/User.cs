using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }
        [MaxLength(50)]
        public string EmployeeId { get; set; } = string.Empty;
        [Required]
        [MaxLength(200)]
        public string UserGroup { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string UserId { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [Required]
        [MaxLength(50)]
        public string RegCode { get; set; } = string.Empty;
        [MaxLength(100)]
        public string PlantillaOffice { get; set; } = string.Empty;
        [Required]
        public bool IsActive { get; set; } = false;
    }
}
