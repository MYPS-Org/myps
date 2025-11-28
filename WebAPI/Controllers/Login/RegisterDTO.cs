using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Login
{
    public class RegisterDTO
    {
        public string SeachUserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }
}
