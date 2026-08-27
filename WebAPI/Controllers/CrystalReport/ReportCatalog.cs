namespace WebAPI.Controllers.CrystalReport;

public enum ReportFamily
{
    Rbp,
    Aip,
    ExtractPcmiow
}

public static class ReportCatalog
{
    public static IReadOnlyList<ReportTypeOptionDTO> SupportedReports { get; } = BuildSupportedReports();

    private static IReadOnlyList<ReportTypeOptionDTO> BuildSupportedReports()
    {
        var reports = new List<ReportTypeOptionDTO>
        {
            new()
            {
                Id = "rbp",
                Label = "RBP (Regional Budget Proposal)",
                OutputFormat = "pdf"
            },
            new()
            {
                Id = "extract-pcmiow",
                Label = "Extract PCMIOW",
                OutputFormat = "xlsx"
            },
            new()
            {
                Id = "aip-official",
                Label = "AIP Official",
                OutputFormat = "pdf"
            },
            new()
            {
                Id = "aip-executive",
                Label = "AIP Executive",
                OutputFormat = "pdf"
            },
            new()
            {
                Id = "aip-official-without-ld",
                Label = "AIP Official without LD",
                OutputFormat = "pdf"
            },
            new()
            {
                Id = "aip-executive-2",
                Label = "AIP Executive 2",
                OutputFormat = "pdf"
            }
        };

        foreach (var report in reports)
        {
            report.Family = TryGetFamily(report.Id, out var family)
                ? FamilyToString(family)
                : string.Empty;
        }

        return reports;
    }

    private static string FamilyToString(ReportFamily family) => family switch
    {
        ReportFamily.Rbp => "rbp",
        ReportFamily.Aip => "aip",
        ReportFamily.ExtractPcmiow => "extract-pcmiow",
        _ => string.Empty
    };

    public static bool IsSupported(string reportName) =>
        TryGetFamily(reportName, out _);

    public static bool TryGetFamily(string reportName, out ReportFamily family)
    {
        family = default;
        if (string.IsNullOrWhiteSpace(reportName))
            return false;

        if (reportName.Equals("rbp", StringComparison.OrdinalIgnoreCase))
        {
            family = ReportFamily.Rbp;
            return true;
        }

        if (reportName.Equals("extract-pcmiow", StringComparison.OrdinalIgnoreCase))
        {
            family = ReportFamily.ExtractPcmiow;
            return true;
        }

        if (reportName.Equals("aip-official", StringComparison.OrdinalIgnoreCase)
            || reportName.Equals("aip-executive", StringComparison.OrdinalIgnoreCase)
            || reportName.Equals("aip-executive-2", StringComparison.OrdinalIgnoreCase)
            || reportName.Equals("aip-official-without-ld", StringComparison.OrdinalIgnoreCase))
        {
            family = ReportFamily.Aip;
            return true;
        }

        return false;
    }
}
