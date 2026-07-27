using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using Eaf.Webhooks;
using System.ComponentModel.DataAnnotations;
using System.Security;

namespace WebAPI.Controllers.ProjectGroup
{
    public class ShowProjectGroupDTO : EnumPagination<ShowProjectGroupFilterDTO> { }
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
        public string ProjectId { get; set; } = string.Empty;
    }
    public class ShowProjectGroupDetailsDTO
    {
        [Required]
        public string GroupId { get; set; } = string.Empty;
    }
    public class UpdateProjectGroupDetailsDTO
    {
        //[Required]
        //public DBHelper.Models.Views.Project.ProjectGroups GroupDetails { get; set; } = new DBHelper.Models.Views.ProjectGroups();
        [Required]
        public List<DBHelper.Models.Views.Project.ProjectsInGroup> Projects { get; set; } = new List<DBHelper.Models.Views.Project.ProjectsInGroup>();
    }
}
