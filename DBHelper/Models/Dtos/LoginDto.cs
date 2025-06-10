using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Dtos
{
    public class LoginDto
    {
        public string? UserName { get; set; }
        public string? Password { get; set; }
        //public bool RememberMe { get; set; } = false;
        //public string? ReturnUrl { get; set; }
        //public LoginDto()
        //{
        //    UserName = string.Empty;
        //    Password = string.Empty;
        //    ReturnUrl = string.Empty;
        //}
    }
}
