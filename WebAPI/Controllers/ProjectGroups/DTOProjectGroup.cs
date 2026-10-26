using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Eaf.Webhooks;
using System.ComponentModel.DataAnnotations;
using System.Security;

namespace WebAPI.Controllers.ProjectGroup
{
    public partial class ShowProjectGroupDTO : EnumPagination<ShowProjectGroupFilterDTO> { }
    public partial class ShowProjectGroupDTO
    {
        public string? SortField { get; set; }
        public string? sortDirection { get; set; }
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
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;
        [Required]
        public int UserGroup { get; set; }
    }
    public class DeleteProjectGroupDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
    }
    public class SearchProjectDTO
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
    }
    public class ProjectGroupAddProjectDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
        [Required]
        public string[] ProjectId { get; set; } = Array.Empty<string>();
    }
    public class ProjectGroupDeleteProjectDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
        [Required]
        public string[] ProjectIds { get; set; } = Array.Empty<string>();
    }
    public class ShowProjectGroupDetailsDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
    }
    public class UpdateProjectGroupDetailsDTO
    {
        [Required]
        public DBHelper.Models.Views.Project.ProjectGroups GroupDetails { get; set; } = new();
        // No Projects list: membership is saved only by AddProject / DeleteProject. A Projects list
        // used to be bound here and never read, and the page's project rows (numeric Category)
        // failed its validation, so Update returned 400 for any group that had projects.
    }
}
