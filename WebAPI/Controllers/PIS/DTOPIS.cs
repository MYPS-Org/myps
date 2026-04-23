using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Models.Enums;

namespace DBHelper.Models.Dtos
{
    public class SearchUserDTO
    {
        public string EmployeeId { get; set; } = string.Empty;
    }

    public class AuthenticateUserDTO
    {
        public string EmployeeId { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}