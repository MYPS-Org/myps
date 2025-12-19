using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DBHelper.Models.Extra
{
    public class FileUpload
    {
        public string Name { get; set; } = string.Empty;

        public string Extension { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public string DataUrl { get; set; } = string.Empty;
    }
}
