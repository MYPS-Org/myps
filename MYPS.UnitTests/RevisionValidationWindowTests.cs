using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// S04-TC016 (2026-10-30): a new revision request is accepted only inside its funding year's
// Validation Date window. Both end dates are included, and the time of day never matters.
public sealed class RevisionValidationWindowTests
{
    private static readonly DateTime Start = new(2025, 1, 1);
    private static readonly DateTime End = new(2025, 12, 31);

    [Theory]
    [Trait("Feature", "RevisionValidationDates")]
    [InlineData(2025, 1, 1, 0)]     // first day
    [InlineData(2025, 12, 31, 23)]  // last day, late evening
    [InlineData(2025, 6, 15, 9)]
    public void InsideTheWindow_IsOpen(int y, int m, int d, int hour) =>
        Assert.True(RevisionValidationWindow.IsOpen(new DateTime(y, m, d, hour, 30, 0), Start, End));

    [Theory]
    [Trait("Feature", "RevisionValidationDates")]
    [InlineData(2024, 12, 31)]
    [InlineData(2026, 1, 1)]
    public void OutsideTheWindow_IsClosed(int y, int m, int d) =>
        Assert.False(RevisionValidationWindow.IsOpen(new DateTime(y, m, d, 12, 0, 0), Start, End));

    [Fact]
    [Trait("Feature", "RevisionValidationDates")]
    public void StoredTimesOnTheDates_AreIgnored() =>
        Assert.True(RevisionValidationWindow.IsOpen(new DateTime(2025, 12, 31, 8, 0, 0), Start.AddHours(9), End.AddHours(1)));
}
