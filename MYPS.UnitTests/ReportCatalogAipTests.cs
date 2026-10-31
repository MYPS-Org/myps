using WebAPI.Controllers.CrystalReport;
using Xunit;

namespace MYPS.UnitTests;

public class ReportCatalogAipTests
{
    [Theory]
    [InlineData("aip-official")]
    [InlineData("AIP-Executive")]
    [InlineData("aip-official-without-ld")]
    [InlineData("aip-executive-2")]
    public void TheFourAipReports_AreAip(string reportName)
    {
        Assert.True(ReportCatalog.IsAip(reportName));
    }

    [Theory]
    [InlineData("rbp")]
    [InlineData("rbp-summary-report")]
    [InlineData("rbp-summary-report-with-tier")]
    [InlineData("extract-pc")]
    [InlineData("extract-pcmiow")]
    [InlineData("")]
    [InlineData("aip")]
    public void OtherReports_AreNotAip(string reportName)
    {
        Assert.False(ReportCatalog.IsAip(reportName));
    }

    [Fact]
    public void EveryCatalogAipEntry_IsGated()
    {
        // The options list hides exactly these from a user without the AIP grant.
        var aip = ReportCatalog.SupportedReports.Where(r => ReportCatalog.IsAip(r.Id)).Select(r => r.Id).ToArray();
        Assert.Equal(new[] { "aip-official", "aip-executive", "aip-official-without-ld", "aip-executive-2" }, aip);
    }
}
