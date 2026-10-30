using Hangfire.Services;
using Xunit;

namespace MYPS.UnitTests;

// S08-TC002-P001 (UAT, 2026-10-30): a report the Crystal report service refused showed its raw
// {"Message": "..."} body, braces and all, in the toast and in the Failed panel.
public class ReportServiceErrorTextTests
{
    [Fact]
    public void WebApiErrorBody_ShowsTheMessageOnly()
    {
        const string body = """{"Message":"Report-level parameter(s) not supplied: @PlanningEngineer. Supplied: [yearstart, programid, region]."}""";

        Assert.Equal(
            "Report-level parameter(s) not supplied: @PlanningEngineer. Supplied: [yearstart, programid, region].",
            ReportJobService.ReportServiceErrorText(body));
    }

    [Fact]
    public void MessageKey_IsMatchedWhateverItsCase()
    {
        Assert.Equal("No rows.", ReportJobService.ReportServiceErrorText("""{"message":"No rows.","Detail":"x"}"""));
    }

    [Theory]
    [InlineData("<html><body>500 - Internal server error.</body></html>")]
    [InlineData("""{"Error":"something else"}""")]
    [InlineData("""["not", "an", "object"]""")]
    [InlineData("""{"Message":""}""")]
    public void AnyOtherBody_IsShownAsItCame(string body)
    {
        Assert.Equal(body, ReportJobService.ReportServiceErrorText(body));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NoBody_IsEmpty(string? body)
    {
        Assert.Equal(string.Empty, ReportJobService.ReportServiceErrorText(body));
    }
}
