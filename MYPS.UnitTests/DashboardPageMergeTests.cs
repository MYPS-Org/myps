using WebAPI.Controllers.Dashboard;
using Xunit;

namespace MYPS.UnitTests;

public sealed class DashboardPageMergeTests
{
    [Theory]
    [Trait("Feature", "Dashboard")]
    [InlineData(0, 3, 10)]
    [InlineData(25, 0, 10)]
    [InlineData(25, 1, 10)]
    [InlineData(25, 4, 10)]
    [InlineData(47, 6, 7)]
    [InlineData(5, 12, 4)]
    public void Page_MatchesTheSingleSortedRanking(int baseCount, int extraCount, int limit)
    {
        var random = new Random(baseCount * 1000 + extraCount * 10 + limit);
        // Budgets repeat on purpose (only 15 distinct values) so ties are exercised; ties are
        // broken by ProjectPK, which is unique.
        var all = Enumerable.Range(0, baseCount + extraCount)
            .Select(index => new DashboardProjectBudget
            {
                ProjectPK = $"P{index:D4}",
                Budget = random.Next(1, 16) * 1_000_000m
            })
            .OrderBy(_ => random.Next())
            .ToList();
        var extra = all.Take(extraCount).ToList();
        var sqlRanking = Ranked(all.Skip(extraCount));
        var expected = Ranked(all);

        var pageCount = (int)Math.Ceiling(expected.Count / (double)limit);
        for (var page = 0; page < Math.Max(pageCount, 1); page++)
        {
            var offset = page * limit;
            var windowStart = DashboardPageMerge.WindowStart(offset, extra.Count);
            var window = sqlRanking.Skip(windowStart).Take(offset + limit - windowStart).ToList();

            var actual = DashboardPageMerge.Page(window, windowStart, extra, offset, limit);

            Assert.Equal(
                expected.Skip(offset).Take(limit).Select(item => item.ProjectPK),
                actual.Select(item => item.ProjectPK));
        }
    }

    [Fact]
    [Trait("Feature", "Dashboard")]
    public void Page_WithNoExtraProjects_IsTheSqlPageUnchanged()
    {
        var sqlRanking = Ranked(Enumerable.Range(0, 30)
            .Select(index => new DashboardProjectBudget { ProjectPK = $"P{index:D2}", Budget = 100 - index }));

        var windowStart = DashboardPageMerge.WindowStart(20, 0);
        var window = sqlRanking.Skip(windowStart).Take(10).ToList();

        Assert.Equal(20, windowStart);
        Assert.Equal(window, DashboardPageMerge.Page(window, windowStart, new List<DashboardProjectBudget>(), 20, 10));
    }

    private static List<DashboardProjectBudget> Ranked(IEnumerable<DashboardProjectBudget> items) =>
        items.OrderByDescending(item => item.Budget)
            .ThenBy(item => item.ProjectPK, StringComparer.Ordinal)
            .ToList();
}
