using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// 2026-10-31, found while planning the Multi-Year module (documents/plans/multi-year-phase-1-portfolio-module.md, Task 0).
// The MYOA-date half is MYPS.DatabaseTests/YearRowMyoaDateMappingTests.cs (it needs the SQL Server EF provider).
public class ProgramStatusAndMyoaDateTests
{
    // vProgramLatest.Status is the status NAME. UpdateProjectDetails compared it with "1", so an
    // Approved RBP program never locked its projects.
    [Theory]
    [InlineData("Approved", true)]
    [InlineData(" approved ", true)]
    [InlineData("Working", false)]
    [InlineData("1", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsApprovedStatus_ReadsTheStatusName(string? status, bool expected)
    {
        Assert.Equal(expected, ProgramHelper.IsApprovedStatus(status));
    }
}
