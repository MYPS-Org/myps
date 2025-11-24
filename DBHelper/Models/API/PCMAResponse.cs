using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.API
{
    public class PCMAResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string ResponseData { get; set; } = string.Empty;
    }
}
