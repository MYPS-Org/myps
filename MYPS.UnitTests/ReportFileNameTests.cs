using Hangfire.Models;
using Hangfire.Services;
using Xunit;

namespace MYPS.UnitTests;

public class ReportFileNameTests
{
    private static readonly DateTime CompletedAt = new(2026, 10, 24, 20, 15, 30);

    private static ReportJobPayload Payload(string reportName) => new()
    {
        ReportName = reportName,
        JobId = "7104dcd2cf4340a783e90465a118f86f"
    };

    [Fact]
    public void BuildReportFileName_WithYear_UsesReportYearAndImportStyleSuffix()
    {
        var parameters = ReportParameterBag.Parse("""{"yearstart":"2024","programid":"p1,p2","region":"OI249"}""");

        var name = ReportJobService.BuildReportFileName(Payload("rbp"), parameters, "pdf", CompletedAt);

        Assert.Equal("rbp_2024_20261024-201530-7104dcd2.pdf", name);
    }

    [Fact]
    public void BuildReportFileName_WithoutYear_OmitsYearSegment()
    {
        var parameters = ReportParameterBag.Parse("""{"programid":"p1","categoryid":"16"}""");

        var name = ReportJobService.BuildReportFileName(Payload("extract-pcmiow"), parameters, "xlsx", CompletedAt);

        Assert.Equal("extract-pcmiow_20261024-201530-7104dcd2.xlsx", name);
    }

    [Fact]
    public void BuildReportFileName_BlankYear_OmitsYearSegment()
    {
        var parameters = ReportParameterBag.Parse("""{"yearstart":"  "}""");

        var name = ReportJobService.BuildReportFileName(Payload("rbp-summary-report"), parameters, "pdf", CompletedAt);

        Assert.Equal("rbp-summary-report_20261024-201530-7104dcd2.pdf", name);
    }

    [Fact]
    public void BuildReportFileName_DoesNotIncludeProgramIds()
    {
        var parameters = ReportParameterBag.Parse("""{"yearstart":"2025","programid":"P_CO-PS-634_02052024_083949,P_CO-PS-634_02052024_084224"}""");

        var name = ReportJobService.BuildReportFileName(Payload("rbp-summary-report-with-tier"), parameters, "pdf", CompletedAt);

        Assert.Equal("rbp-summary-report-with-tier_2025_20261024-201530-7104dcd2.pdf", name);
        Assert.DoesNotContain("P_CO-PS", name);
    }
}
