using Hangfire.Models;
using Xunit;

namespace MYPS.UnitTests;

public class ReportParameterBagTests
{
    [Fact]
    public void Parse_JsonObject_ReturnsLegacyKeys()
    {
        var json = """{"yearstart":"2026","programid":"p1","ReportType":"","ReportTypeTitle":""}""";
        var dict = ReportParameterBag.Parse(json);

        Assert.Equal("2026", dict["yearstart"]);
        Assert.Equal("p1", dict["programid"]);
        Assert.Equal("", dict["ReportType"]);
        Assert.Equal("", dict["ReportTypeTitle"]);
    }

    [Fact]
    public void Parse_LegacyQueryString_ReturnsKeys()
    {
        var qs = "yearstart=2026&programid=p1&region=OI237";
        var dict = ReportParameterBag.Parse(qs);

        Assert.Equal("2026", dict["yearstart"]);
        Assert.Equal("p1", dict["programid"]);
        Assert.Equal("OI237", dict["region"]);
    }

    [Fact]
    public void ToQueryString_IncludesEmptyValues()
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["yearstart"] = "2026",
            ["ReportType"] = ""
        };

        var qs = ReportParameterBag.ToQueryString(dict);

        Assert.Contains("yearstart=2026", qs);
        Assert.Contains("ReportType=", qs);
    }
}
