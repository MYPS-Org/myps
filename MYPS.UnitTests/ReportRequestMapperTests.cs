using System.Text.Json;
using WebAPI.Controllers.CrystalReport;
using Xunit;

namespace MYPS.UnitTests;

public class ReportRequestMapperTests
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static JsonElement Body(string json) =>
        JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void Map_Rbp_MapsSignatoriesAndPrograms()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp",
            Body("""{"yearStart":2026,"programIds":["a","b"],"regionCode":"OI237","planningEngineer":"PE","approvedBy":"A","reviewedBy":"R"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("2026", legacy["yearstart"]);
        Assert.Equal("a,b", legacy["programid"]);
        Assert.Equal("OI237", legacy["region"]);
        Assert.Equal("PE", legacy["PlanningEngineer"]);
        Assert.Equal("A", legacy["ApprovedBy"]);
        Assert.Equal("R", legacy["ReviewedBy"]);
        Assert.Equal("R", legacy["ReviewdBy"]);
    }

    [Fact]
    public void Map_Aip_MapsRequiredFields()
    {
        var ok = ReportRequestMapper.TryMap(
            "aip-official",
            Body("""{"yearStart":2026,"programIds":["p1"],"regionCode":"OI237","reportType":"Official","reportTypeTitle":"AIP Official"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("OI237", legacy["region"]);
        Assert.Equal("Official", legacy["ReportType"]);
        Assert.Equal("AIP Official", legacy["ReportTypeTitle"]);
    }

    [Fact]
    public void Map_Aip_MissingRegionCode_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "aip-official",
            Body("""{"yearStart":2026,"programIds":["p1"]}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("regionCode", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_Aip_MissingReportType_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "aip-official",
            Body("""{"yearStart":2026,"programIds":["p1"],"regionCode":"OI237"}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("reportType", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_Extract_DefaultsLabels_AllowsCategoryZero()
    {
        var ok = ReportRequestMapper.TryMap(
            "extract-pcmiow",
            Body("""{"programIds":["p1"],"categoryId":0,"regionCode":"OI237","deoCode":"OI405","ioCode":"OI405"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("0", legacy["categoryid"]);
        Assert.Equal("OI237", legacy["rocode"]);
        Assert.Equal("OI405", legacy["deocode"]);
        Assert.Equal("OI405", legacy["io_code"]);
        Assert.Equal("", legacy["programX"]);
        Assert.Equal("0", legacy["categoryX"]);
        Assert.Equal("", legacy["regionX"]);
        Assert.Equal("", legacy["deoX"]);
        Assert.Equal("", legacy["ioX"]);
    }

    [Fact]
    public void Map_Extract_AllowsCategoryRegionDeoIoOmitted()
    {
        var ok = ReportRequestMapper.TryMap(
            "extract-pcmiow",
            Body("""{"programIds":["p1"]}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("p1", legacy["programid"]);
        Assert.Equal("", legacy["categoryid"]);
        Assert.Equal("", legacy["rocode"]);
        Assert.Equal("", legacy["deocode"]);
        Assert.Equal("", legacy["io_code"]);
    }

    [Fact]
    public void Map_Extract_MissingProgramIds_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "extract-pcmiow",
            Body("""{"categoryId":1,"regionCode":"OI237"}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("programIds", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_RbpSummary_MapsAllRequiredFields()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp-summary-report",
            Body("""{"yearStart":2026,"programId":"p1","regionCode":"OI237","planningEngr":"PE","reviewedBy":"R","approvedBy":"A"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("2026", legacy["yearstart"]);
        Assert.Equal("OI237", legacy["region"]);
        Assert.Equal("p1", legacy["programid"]);
        Assert.Equal("PE", legacy["planningEngr"]);
        Assert.Equal("R", legacy["reviewedBy"]);
        Assert.Equal("A", legacy["approvedBy"]);
    }

    [Fact]
    public void Map_RbpSummaryWithTier_UsesSameFamily()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp-summary-report-with-tier",
            Body("""{"yearStart":2026,"programId":"p1","regionCode":"OI237","planningEngr":"PE","reviewedBy":"R","approvedBy":"A"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("PE", legacy["planningEngr"]);
    }

    [Fact]
    public void Map_RbpSummary_MissingPlanningEngr_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp-summary-report",
            Body("""{"yearStart":2026,"programId":"p1","regionCode":"OI237","reviewedBy":"R","approvedBy":"A"}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("planningEngr", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_RbpSummary_MissingRegionCode_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp-summary-report",
            Body("""{"yearStart":2026,"programId":"p1","planningEngr":"PE","reviewedBy":"R","approvedBy":"A"}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("regionCode", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_Rbp_MissingYearStart_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp",
            Body("""{"programIds":["p1"]}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("yearStart", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Map_Rbp_WrongTypeYearStart_FailsWithoutThrowing()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp",
            Body("""{"yearStart":"bad","programIds":["p1"]}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.StartsWith("Invalid request body:", error);
    }
}
