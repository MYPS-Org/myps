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

    // #480: funding lines. Source and Agreement are each judged on their own, compared the way
    // SQL Server does (FundingLookupCode: trimmed, case-insensitive).
    private static readonly ProjectHelper.FundingLookupRow StoredLine = new(7, false, "RETIRED-SRC", "RETIRED-AGR");

    private static List<int> CheckFunding(Func<ProjectHelper.FundingLookupRow, string> field, params ProjectHelper.FundingLookupRow[] rows) =>
        RetiredLookupRule.RowsRequiringActiveCheck(
                rows, x => x.Id, x => x.IsDeleted, x => ProjectHelper.FundingLookupCode(field(x)),
                new[] { StoredLine }.ToDictionary(x => x.Id, x => ProjectHelper.FundingLookupCode(field(x))))
            .Select(x => x.Id)
            .ToList();

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void FundingLine_UnchangedButDifferentCaseOrPadding_IsNotChecked()
    {
        var line = new ProjectHelper.FundingLookupRow(7, false, " retired-src", "retired-agr ");
        Assert.Empty(CheckFunding(x => x.SourceOrg, line));
        Assert.Empty(CheckFunding(x => x.AgreementCode, line));
    }

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void FundingLine_OnlyTheChangedFieldIsChecked()
    {
        // A new Agreement under the line's retired Source: the Agreement is checked, the Source kept.
        var line = new ProjectHelper.FundingLookupRow(7, false, "RETIRED-SRC", "NEW-AGR");
        Assert.Empty(CheckFunding(x => x.SourceOrg, line));
        Assert.Equal(new[] { 7 }, CheckFunding(x => x.AgreementCode, line));
    }

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void FundingLine_NewIsChecked_DeletedIsNot() =>
        Assert.Equal(
            new[] { 0 },
            CheckFunding(
                x => x.AgreementCode,
                new ProjectHelper.FundingLookupRow(0, false, "RETIRED-SRC", "RETIRED-AGR"),
                new ProjectHelper.FundingLookupRow(7, true, "OTHER", "OTHER")));

    // #481: Project Details lookups (Tier, Origin, Agency, ...), one value per project.
    private static readonly ProjectHelper.ProjectDetailsLookupValues Saved = new(1, 13, 1001, 2, null, 1, 0, null);

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ProjectDetails_NewRecord_ChecksEverySetValue() =>
        Assert.Equal(
            new[] { "Tier", "Origin", "Originating Agency", "Implementation Mode", "ROW Available", "Feasibility Study" },
            ProjectHelper.ChangedProjectDetailsLookups(Saved, null).Select(x => x.Lookup));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ProjectDetails_Unchanged_ChecksNothing() =>
        Assert.Empty(ProjectHelper.ChangedProjectDetailsLookups(Saved with { }, Saved));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ProjectDetails_OnlyChangedValuesAreChecked() =>
        Assert.Equal(
            new[] { ("Originating Agency", 1002), ("Emergency Mode", 1) },
            ProjectHelper.ChangedProjectDetailsLookups(Saved with { Agency = 1002, EmergencyMode = 1 }, Saved));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ProjectDetails_NullValue_IsNotChecked() =>
        // UpdateLumpSum may omit a field to keep the stored one.
        Assert.Empty(ProjectHelper.ChangedProjectDetailsLookups(Saved with { Tier = null, ImplementationMode = null }, Saved));

    [Fact]
    [Trait("Feature", "CodeTableRetiredValues")]
    public void ProjectDetails_Resubmit_KeepsEitherTheProjectsOrTheRequestsValue()
    {
        // The request had changed Agency 1001 -> 1002; resubmitting 1001 (the project's) or 1002
        // (the request's) is kept, a third value is checked.
        var request = Saved with { Agency = 1002 };
        Assert.Empty(ProjectHelper.ChangedProjectDetailsLookups(Saved, Saved, alsoKept: request));
        Assert.Empty(ProjectHelper.ChangedProjectDetailsLookups(request, Saved, alsoKept: request));
        Assert.Equal(new[] { ("Originating Agency", 1003) }, ProjectHelper.ChangedProjectDetailsLookups(Saved with { Agency = 1003 }, Saved, alsoKept: request));
    }
}
