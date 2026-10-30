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
        /// <summary>tUsers.Id of the user being edited: that user holding this Employee ID is not a duplicate. Null when adding.</summary>
        public int? ExcludeUserRowId { get; set; }
    }

    public class AuthenticateUserDTO
    {
        public string EmployeeId { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}