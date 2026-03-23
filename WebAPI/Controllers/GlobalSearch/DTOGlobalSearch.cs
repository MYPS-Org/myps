using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.GlobalSearch
{
    public class SearchDTO
    {
        [Required]
        public string Category { get; set; } = string.Empty;
        [Required]
        public string SearchFor { get; set; } = string.Empty;
    }
}