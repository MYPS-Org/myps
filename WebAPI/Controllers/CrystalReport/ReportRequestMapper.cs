using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebAPI.Controllers.CrystalReport;

public static class ReportRequestMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public static bool TryMap(
        string reportName,
        JsonElement body,
        out Dictionary<string, string> legacyParams,
        out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!ReportCatalog.TryGetFamily(reportName, out var family))
        {
            error = $"'{reportName}' is not a supported report type.";
            return false;
        }

        return family switch
        {
            ReportFamily.Rbp => MapRbp(body, out legacyParams, out error),
            ReportFamily.Aip => MapAip(body, out legacyParams, out error),
            ReportFamily.ExtractPcmiow => MapExtract(body, out legacyParams, out error),
            ReportFamily.ExtractPc => MapExtract(body, out legacyParams, out error),
            ReportFamily.RbpSummary => MapRbpSummary(body, out legacyParams, out error),
            _ => Fail(out legacyParams, out error, "Unknown report family.")
        };
    }

    // rbp-summary-report / rbp-summary-report-with-tier: yearStart/regionCode/programId feed
    // the backing stored procedures' SQL filtering and stay required. planningEngr/reviewedBy/
    // approvedBy are report-level-only (letterhead/signature block) -- #422 made them optional
    // here too (matching MapRbp's existing behavior for the same 3 fields on "rbp"); omitted
    // values render blank in the signature block instead of blocking generation, handled on the
    // CrystalReportService side via ReportDefinition.OptionalReportLevelParameters.
    private static bool MapRbpSummary(JsonElement body, out Dictionary<string, string> legacyParams, out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!TryDeserialize(body, out GenerateRbpSummaryRequestDTO? request, out error))
            return Fail(out legacyParams, out error, error!);

        if (request == null)
            return Fail(out legacyParams, out error, "Invalid RBP Summary request body.");

        if (!request.YearStart.HasValue)
            return Fail(out legacyParams, out error, "yearStart is required.");

        if (string.IsNullOrWhiteSpace(request.RegionCode))
            return Fail(out legacyParams, out error, "regionCode is required.");

        if (string.IsNullOrWhiteSpace(request.ProgramId))
            return Fail(out legacyParams, out error, "programId is required.");

        legacyParams["yearstart"] = request.YearStart.Value.ToString();
        legacyParams["region"] = request.RegionCode;
        legacyParams["programid"] = request.ProgramId;
        AddOptional(legacyParams, "planningEngr", request.PlanningEngr);
        AddOptional(legacyParams, "reviewedBy", request.ReviewedBy);
        AddOptional(legacyParams, "approvedBy", request.ApprovedBy);

        return true;
    }

    private static bool MapRbp(JsonElement body, out Dictionary<string, string> legacyParams, out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!TryDeserialize(body, out GenerateRbpRequestDTO? request, out error))
            return Fail(out legacyParams, out error, error!);

        if (request == null)
            return Fail(out legacyParams, out error, "Invalid RBP request body.");

        if (!request.YearStart.HasValue)
            return Fail(out legacyParams, out error, "yearStart is required.");

        var programIds = JoinProgramIds(request.ProgramIds);
        if (programIds == null)
            return Fail(out legacyParams, out error, "programIds is required.");

        if (string.IsNullOrWhiteSpace(request.RegionCode))
            return Fail(out legacyParams, out error, "regionCode is required.");

        legacyParams["yearstart"] = request.YearStart.Value.ToString();
        legacyParams["programid"] = programIds;
        legacyParams["region"] = request.RegionCode;
        AddOptional(legacyParams, "PlanningEngineer", request.PlanningEngineer);
        AddOptional(legacyParams, "ApprovedBy", request.ApprovedBy);
        AddOptional(legacyParams, "ReviewedBy", request.ReviewedBy);
        if (!string.IsNullOrWhiteSpace(request.ReviewedBy))
            legacyParams["ReviewdBy"] = request.ReviewedBy;

        return true;
    }

    private static bool MapAip(JsonElement body, out Dictionary<string, string> legacyParams, out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!TryDeserialize(body, out GenerateAipRequestDTO? request, out error))
            return Fail(out legacyParams, out error, error!);

        if (request == null)
            return Fail(out legacyParams, out error, "Invalid AIP request body.");

        if (!request.YearStart.HasValue)
            return Fail(out legacyParams, out error, "yearStart is required.");

        var programIds = JoinProgramIds(request.ProgramIds);
        if (programIds == null)
            return Fail(out legacyParams, out error, "programIds is required.");

        if (string.IsNullOrWhiteSpace(request.RegionCode))
            return Fail(out legacyParams, out error, "regionCode is required.");

        if (string.IsNullOrWhiteSpace(request.ReportType))
            return Fail(out legacyParams, out error, "reportType is required.");

        if (string.IsNullOrWhiteSpace(request.ReportTypeTitle))
            return Fail(out legacyParams, out error, "reportTypeTitle is required.");

        legacyParams["yearstart"] = request.YearStart.Value.ToString();
        legacyParams["programid"] = programIds;
        legacyParams["region"] = request.RegionCode;
        legacyParams["ReportType"] = request.ReportType ?? string.Empty;
        legacyParams["ReportTypeTitle"] = request.ReportTypeTitle ?? string.Empty;

        return true;
    }

    // Shared by ExtractPcmiow and ExtractPc -- both usp_extract_PC_MIOW_list and
    // usp_extract_PC_list take the identical (programid, categoryid, rocode, deocode,
    // io_code) + 5 display-label parameter contract, so one DTO/mapper covers both.
    private static bool MapExtract(JsonElement body, out Dictionary<string, string> legacyParams, out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!TryDeserialize(body, out GenerateExtractPcmiowRequestDTO? request, out error))
            return Fail(out legacyParams, out error, error!);

        if (request == null)
            return Fail(out legacyParams, out error, "Invalid extract request body.");

        var programIds = JoinProgramIds(request.ProgramIds);
        if (programIds == null)
            return Fail(out legacyParams, out error, "programIds is required.");

        if (!request.CategoryId.HasValue)
            return Fail(out legacyParams, out error, "categoryId is required.");

        if (string.IsNullOrWhiteSpace(request.RegionCode))
            return Fail(out legacyParams, out error, "regionCode is required.");

        if (string.IsNullOrWhiteSpace(request.DeoCode))
            return Fail(out legacyParams, out error, "deoCode is required.");

        if (string.IsNullOrWhiteSpace(request.IoCode))
            return Fail(out legacyParams, out error, "ioCode is required.");

        legacyParams["programid"] = programIds;
        legacyParams["categoryid"] = request.CategoryId.Value.ToString();
        legacyParams["rocode"] = request.RegionCode;
        legacyParams["deocode"] = request.DeoCode;
        legacyParams["io_code"] = request.IoCode;
        legacyParams["programX"] = request.ProgramLabel ?? string.Empty;
        legacyParams["categoryX"] = request.CategoryLabel ?? "0";
        legacyParams["regionX"] = request.RegionLabel ?? string.Empty;
        legacyParams["deoX"] = request.DeoLabel ?? string.Empty;
        legacyParams["ioX"] = request.IoLabel ?? string.Empty;

        return true;
    }

    private static bool TryDeserialize<T>(
        JsonElement body,
        out T? request,
        out string? error)
    {
        request = default;
        error = null;

        try
        {
            request = JsonSerializer.Deserialize<T>(body, JsonOptions);
            return true;
        }
        catch (JsonException ex)
        {
            error = $"Invalid request body: {ex.Message}";
            return false;
        }
    }

    private static string? JoinProgramIds(string[]? programIds)
    {
        if (programIds is not { Length: > 0 })
            return null;

        var ids = programIds
            .Select(id => id?.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToArray();

        return ids.Length == 0 ? null : string.Join(",", ids);
    }

    private static void AddOptional(Dictionary<string, string> dict, string key, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            dict[key] = value;
    }

    private static bool Fail(
        out Dictionary<string, string> legacyParams,
        out string? error,
        string message)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = message;
        return false;
    }
}