using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.CodeTable
{
    public class UpdateCodeTableDTO
    {
        [Required]
        public string Code { get; set; } = string.Empty;
        [Required]
        public CodeTransactionType TransactionType { get; set; }
        [Required]
        public string Json { get; set; } = string.Empty;
    }
    public enum CodeTransactionType {
        Create = 0,
        Update = 1,
        Delete = 2,
    }
}