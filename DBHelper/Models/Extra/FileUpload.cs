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
        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(20)]

        public string Extension { get; set; } = string.Empty;
        [MaxLength(100)]
        [Required]
        public string ContentType { get; set; } = string.Empty;
        [Required]
        public string DataUrl { get; set; } = string.Empty;
    }
}
