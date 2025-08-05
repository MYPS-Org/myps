using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Eaf.Webhooks;
using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.ProjectGroup
{
    public class ShowProjectGroupDTO : EnumPagination
    {
        public ShowProjectGroupFilterDTO Filters { get; set; } = new ShowProjectGroupFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowProjectGroupFilterDTO
    {
        public string? UserGroupName { get; set; }
        public string? ProjectId { get; set; }
        public string? Name { get; set; }
    }
    public class AddProjectGroupDTO
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        [Required]
        public string Description { get; set; } = string.Empty;
        [Required]
        public int UserGroup { get; set; }
    }
    public class DeleteProjectGroupDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
    }
    public class ShowProjectGroupDetailsDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
    }
    public class UpdateProjectGroupDetailsDTO
    {
        [Required]
        public DBHelper.Models.Views.ProjectGroups GroupDetails { get; set; } = new DBHelper.Models.Views.ProjectGroups();
        [Required]
        public List<DBHelper.Models.Views.Projects> Projects { get; set; } = new List<DBHelper.Models.Views.Projects>();
    }
}
