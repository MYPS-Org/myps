using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// #479: an inactive Infra Type / Work Type used to fail every save of a project that already held
// it, because every posted row was checked. Only new or changed rows may be held to "is active".
public sealed class RetiredLookupRuleTests
{
    private sealed record Row(int Id, bool IsDeleted, int WorkTypeFK, string InfraTypeFK);

    private static readonly IReadOnlyDictionary<int, (int, string)> Stored = new Dictionary<int, (int, string)>
    {
        [1] = (80, "RETIRED"),
        [2] = (79, "RD"),
    };

    private static List<int> Check(params Row[] rows) =>
        RetiredLookupRule.RowsRequiringActiveCheck(rows, x => x.Id, x => x.IsDeleted, x => (x.WorkTypeFK, x.InfraTypeFK), Stored)
            .Select(x => x.Id)
            .ToList();

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void UnchangedExistingRow_IsNotChecked() =>
        Assert.Empty(Check(new Row(1, false, 80, "RETIRED")));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void DeletedRow_IsNotChecked() =>
        Assert.Empty(Check(new Row(0, true, 80, "RETIRED"), new Row(2, true, 1, "OTHER")));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void NewRow_IsChecked() =>
        Assert.Equal(new[] { 0 }, Check(new Row(0, false, 80, "RETIRED")));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ExistingRowWithAnyLookupChanged_IsChecked()
    {
        // Infra Type changed while the Work Type stayed: the whole row is re-checked, so a
        // retired Work Type it kept is not waved through.
        Assert.Equal(new[] { 1 }, Check(new Row(1, false, 80, "RD")));
        Assert.Equal(new[] { 2 }, Check(new Row(2, false, 80, "RD")));
    }

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void RowIdNotInStoredRows_IsTreatedAsNew() =>
        Assert.Equal(new[] { 99 }, Check(new Row(99, false, 79, "RD")));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void MixedRows_ReturnOnlyNewAndChangedRows() =>
        Assert.Equal(
            new[] { 0, 2 },
            Check(
                new Row(1, false, 80, "RETIRED"),
                new Row(0, false, 79, "BR"),
                new Row(2, false, 79, "BR"),
                new Row(0, true, 80, "RETIRED")));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void NoRows_ReturnsEmpty() =>
        Assert.Empty(Check());
}
