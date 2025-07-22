using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    public class ShowProjectDTO : EnumPagination
    {
        public ShowProjectFilterDTO Filters { get; set; } = new ShowProjectFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowProjectFilterDTO
    {
        public string? ProgramId { get; set; }
        public string? ReferenceId { get; set; }
    }
    public class AddProjectDTO : ProjectDetails
    {
    }
    public class ProjectDetailsDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
    }
    public class AddNotesDTO : ProjectDetailsDTO
    {
        [Required]
        [MaxLength(200)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public IFormFile File { get; set; } = null!; // Using IFormFile for file uploads
    }
}
