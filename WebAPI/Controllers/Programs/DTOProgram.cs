using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    public class ShowProgramDTO : EnumPagination<ShowProgramFilterDTO>
    {
        /// <summary>The Program list sets this to get CanDelete / DeleteBlockedReason per row; other
        /// callers (e.g. the Project form's program type-ahead) leave it off and skip the query.</summary>
        public bool IncludeDeleteEligibility { get; set; }
    }
    public class ShowProgramFilterDTO
    {
        public string? Name { get; set; }
        public int? StartYear { get; set; }
        public string? StageName { get; set; }
        public string? Type { get; set; }
    }
    public class AddProgramDTO
    {
        public EnumProgramStage Stage { get; set; }
        [Required]
        public EnumProgramStatus Status { get; set; }
        [Required]
        public EnumProgramType Type { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        public int YearStart { get; set; }
        [Required]
        public string[] DataSecurityGroup { get; set; } = new string[] { };
        public int[] UserGroup { get; set; } = new int[] { };
        public bool IsSkipped { get; set; } = false;
        [MaxLength(250)]
        public string? SkipReason { get; set; }
    }
    public class ShowProgramStagesDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
    }
    public class ProgramDetailsDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public string StageName { get; set; } = string.Empty;
    }
    public class ShowProjectsInProgramDTO : EnumPagination<ShowProjectsInProgramFilterDTO>
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public string StageName { get; set; } = string.Empty;
    }
    public class ShowProjectsInProgramFilterDTO
    {
        public string ProjectId { get; set; } = string.Empty;
    }
    public class DeleteProgramDTO
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public int RevisionId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? GroupName { get; set; }
        public string[] DataSecurityGroup { get; set; } = new string[] { };
        public string? Status { get; set; }
        public string? Type { get; set; }
        public Double? Cost { get; set; }
        public int? YearStart { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public bool IsPublished { get; set; }
    }
    public class UpdateProgramDTO
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public string ProgramPK { get; set; } = string.Empty;
        public int RevisionNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string[] DataSecurityGroup { get; set; } = new string[] { };
        public int[] UserGroup { get; set; } = new int[] { };
        public EnumProgramStatus Status { get; set; }
        public EnumProgramType Type { get; set; }
        public Double Cost { get; set; } = 0;
        public int YearStart { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
    public class UpdateProgramStageDTO
    {
        public string ProgramPK { get; set; } = string.Empty;
        public string ProgramId { get; set; } = string.Empty;
        public EnumProgramStage Stage { get; set; }
        public string Name { get; set; } = string.Empty;
    }
    public class RelatedComponentCost
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectRevisions(Id)
        public int ProjectRevisionFK { get; set; }
        public int OldProjectRevisionFK { get; set; }
        public int OldComponentCostId { get; set; }
        [Required]
        [MaxLength(100)]
        // FK -> dbo.tOptionProjectComponentType(ComponentId)
        public string ComponentType { get; set; } = string.Empty;
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        [Column(TypeName = "decimal(18,5)")]
        public decimal Total { get; set; }
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }
    public class RelatedMajorWorkItem
    {
        [Key]
        public int Id { get; set; }
        [Required]
        // FK -> dbo.tProjectComponentCost(Id)
        public int ComponentCostFK { get; set; }
        public int OldWorkItemId { get; set; }
        public int OldComponentCostFK { get; set; }
        [Required]
        [MaxLength(10)]
        public string ComponentId { get; set; } = string.Empty;
        [Required]
        public int YearOfWork { get; set; }
        [Required]
        // FK -> dbo.tOptionScopeOfWork(Enum)
        public int WorkTypeFK { get; set; }
        [Required]
        [MaxLength(10)]
        // FK -> dbo.tOptionInfraType(InfraCode)
        public string InfraTypeFK { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedDate { get; set; }
    }

    public class BatchUnpublishTaggingDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        [Required]
        public string ProjectIds { get; set; } = string.Empty;
    }
    public class BatchPublishTaggingDTO : BatchUnpublishTaggingDTO { }
    public class BatchDeleteTaggingDTO : BatchUnpublishTaggingDTO { }
    public class BatchAddExistingProjectDTO : BatchUnpublishTaggingDTO { }
    /// <summary>Projects deleted at an earlier stage, by ProjectPK (as the Deleted projects panel lists them).</summary>
    public class RestoreToCurrentStageDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        public string[] ProjectFKs { get; set; } = Array.Empty<string>();
    }
    public class ShowDeletedProjectsDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
    }
}
