using DBHelper.Models.Enums;
using DBHelper.Models.Table;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WebAPI.Controllers.Programs
{
    public class ShowProgramDTO : EnumPagination
    {
        public ShowProgramFilterDTO Filters { get; set; } = new ShowProgramFilterDTO();
        public string SortField { get; set; } = "Id";
    }
    public class ShowProgramFilterDTO
    {
        public string? Name { get; set; }
        public string? YearStart { get; set; }
        public string? GroupName { get; set; }
        public string? StageName { get; set; }
    }
    public class AddProgramDTO
    {
        [Required]
        public EnumProgramStage Stage { get; set; }
        [Required]
        public EnumProgramStatus Status { get; set; }
        [Required]
        public EnumProgramType Type { get; set; }
        [Required]
        public string Name { get; set; } = string.Empty;
        [Required]
        public bool AllowAutoName { get; set; } = true;
        [Required]
        public int YearStart { get; set; }
        [Required]
        public int UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
        public bool IsSkipped { get; set; } = false;
        [MaxLength(250)]
        public string? SkipReason { get; set; }
    }
    public class ProgramDetailsDTO
    {
        [Required]
        public string ProgramId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
    }
    public class DeleteProgramDTO
    {
        public int Id { get; set; }
        public string ProgramId { get; set; } = string.Empty;
        public int RevisionId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? GroupName { get; set; }
        public string? RegionCode { get; set; }
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
        public int RevisionNumber { get; set; }
        public string Name { get; set; } = string.Empty;
        public EnumProgramStage StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public int UserGroup { get; set; }
        public string RegionCode { get; set; } = string.Empty;
        public EnumProgramStatus Status { get; set; }
        public EnumProgramType Type { get; set; }
        public Double? Cost { get; set; }
        public int YearStart { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedDate { get; set; }
    }
    public class UpdateProgramStageDTO 
    {
        public string ProgramId { get; set; } = string.Empty;
        public EnumProgramStage Stage { get; set; }
    }
}
