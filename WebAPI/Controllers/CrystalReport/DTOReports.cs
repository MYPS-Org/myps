using System.ComponentModel.DataAnnotations;

namespace WebAPI.Controllers.CrystalReport;

public class GenerateRbpRequestDTO
{
    public int? YearStart { get; set; }
    public string[]? ProgramIds { get; set; }
    public string? RegionCode { get; set; }
    public string? PlanningEngineer { get; set; }
    public string? ApprovedBy { get; set; }
    public string? ReviewedBy { get; set; }
}

public class GenerateAipRequestDTO
{
    public int? YearStart { get; set; }
    public string[]? ProgramIds { get; set; }
    public string? RegionCode { get; set; }
    public string? ReportType { get; set; }
    public string? ReportTypeTitle { get; set; }
}

public class GenerateExtractPcmiowRequestDTO
{
    public string[]? ProgramIds { get; set; }
    public int? CategoryId { get; set; }
    public string? RegionCode { get; set; }
    public string? DeoCode { get; set; }
    public string? IoCode { get; set; }
    public string? ProgramLabel { get; set; }
    public string? CategoryLabel { get; set; }
    public string? RegionLabel { get; set; }
    public string? DeoLabel { get; set; }
    public string? IoLabel { get; set; }
}

public class FilterProgramsDTO
{
    [Required]
    public int YearStart { get; set; }

    [Required]
    public string ProgramStage { get; set; } = string.Empty;
}

public class FilterProgramItemDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class ReportOptionsDTO
{
    public IReadOnlyList<ReportTypeOptionDTO> ReportTypes { get; set; } = [];
    public IReadOnlyList<int> ProgramYears { get; set; } = [];
    public IReadOnlyList<ProgramStageOptionDTO> ProgramStages { get; set; } = [];
    public IReadOnlyList<RegionalOfficeOptionDTO> RegionalOffices { get; set; } = [];
    public IReadOnlyList<CategoryOptionDTO> Categories { get; set; } = [];
}

public class ReportTypeOptionDTO
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string OutputFormat { get; set; } = string.Empty;
    public string Family { get; set; } = string.Empty;
}

public class CategoryOptionDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class DeoOptionDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? RegionParticipantId { get; set; }
}

public class ImplementingOfficeOptionDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? RegionParticipantId { get; set; }
}

public class ProgramStageOptionDTO
{
    public int Id { get; set; }
    public int NameId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
}

public class RegionalOfficeOptionDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}
