namespace WebAPI.Controllers.CrystalReport;

public enum ReportFamily
{
    Rbp,
    Aip,
    ExtractPcmiow,
    ExtractPc,
    RbpSummary
}

public static class ReportCatalog
{
    public static IReadOnlyList<ReportTypeOptionDTO> SupportedReports { get; } =
    [
        new ReportTypeOptionDTO
        {
            Id = "rbp",
            Label = "RBP (Regional Budget Proposal)",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "extract-pcmiow",
            Label = "Extract PCMIOW",
            OutputFormat = "xlsx"
        },
        new ReportTypeOptionDTO
        {
            Id = "extract-pc",
            Label = "Extract PC",
            OutputFormat = "xlsx"
        },
        new ReportTypeOptionDTO
        {
            Id = "aip-official",
            Label = "AIP Official",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "aip-executive",
            Label = "AIP Executive",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "aip-official-without-ld",
            Label = "AIP Official without LD",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "aip-executive-2",
            Label = "AIP Executive 2",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "rbp-summary-report",
            Label = "RBP Summary Report",
            OutputFormat = "pdf"
        },
        new ReportTypeOptionDTO
        {
            Id = "rbp-summary-report-with-tier",
            Label = "RBP Summary Report with Tier",
            OutputFormat = "pdf"
        }
    ];

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

        if (reportName.Equals("extract-pc", StringComparison.OrdinalIgnoreCase))
        {
            family = ReportFamily.ExtractPc;
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

        if (reportName.Equals("rbp-summary-report", StringComparison.OrdinalIgnoreCase)
            || reportName.Equals("rbp-summary-report-with-tier", StringComparison.OrdinalIgnoreCase))
        {
            family = ReportFamily.RbpSummary;
            return true;
        }

        return false;
    }
}
