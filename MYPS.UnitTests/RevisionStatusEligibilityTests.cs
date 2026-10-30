using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// S03 (ATA remark, 2026-10-30): a revision type is allowed only at the PCMA / package status the URD
// names. Every reason carried a field rule for every status, so nothing was ever refused.
public class RevisionStatusEligibilityTests
{
    private static (string, string) Status(params (string? Status, bool? Packaged)[] components) =>
        RevisionStatusEligibility.ProjectStatus(components);

    [Fact]
    public void ProjectStatus_KeepsTheRulesItReplaced()
    {
        Assert.Equal(("On-Going", "Not Packaged"), Status(("Not Yet Started", true), ("On-Going", false)));
        Assert.Equal(("Terminated", "Packaged"), Status(("Terminated", true), ("Terminated", true)));
        Assert.Equal(("Not Yet Started", "Not Packaged"), Status(("Not Yet Started", false), ("Completed", false)));
        Assert.Equal(("Completed", "Packaged"), Status(("Completed", true), ("Terminated", true)));
        Assert.Equal(("Not Yet Started", "Not Packaged"), Status(("Not Yet Started", null)));
        Assert.Equal(("No Components", "Packaged"), Status());
    }

    [Theory]
    [InlineData("Completed", "Packaged")]
    [InlineData("Completed", "Not Packaged")]
    [InlineData("Terminated", "Packaged")]
    [InlineData("Terminated", "Not Packaged")]
    public void Modification_IsRefusedForCompletedOrTerminated_InTheUrdsWords(string pcma, string package)
    {
        Assert.Equal(
            "Modification is not allowed because the Project Component has been Completed/Terminated.",
            RevisionStatusEligibility.Refusal(RevisionStatusEligibility.ModificationGroupId, pcma, package));
    }

    [Theory]
    [InlineData("Not Yet Started", "Not Packaged")]
    [InlineData("Not Yet Started", "Packaged")]
    [InlineData("On-Going", "Packaged")]
    [InlineData("On-Going", "Not Packaged")]
    public void Modification_IsAllowedForCasesAAndB(string pcma, string package)
    {
        Assert.Null(RevisionStatusEligibility.Refusal(RevisionStatusEligibility.ModificationGroupId, pcma, package));
    }

    [Fact]
    public void ChangeInAuthority_IsAllowedOnlyNotYetStartedAndNotPackaged()
    {
        const int cai = RevisionStatusEligibility.ChangeInAuthorityToImplementGroupId;
        Assert.Null(RevisionStatusEligibility.Refusal(cai, "Not Yet Started", "Not Packaged"));
        Assert.Null(RevisionStatusEligibility.Refusal(cai, "not yet started", "not packaged"));
        foreach (var (pcma, package) in new[] { ("Not Yet Started", "Packaged"), ("On-Going", "Not Packaged"), ("On-Going", "Packaged"), ("Completed", "Not Packaged"), ("Terminated", "Packaged") })
        {
            var refusal = RevisionStatusEligibility.Refusal(cai, pcma, package);
            Assert.NotNull(refusal);
            Assert.Contains("Not Yet Started and Not Packaged", refusal);
            Assert.Contains($"{pcma} and {package}", refusal);
        }
    }

    [Theory]
    [InlineData(6)]   // Adjustment
    [InlineData(9)]   // Termination
    [InlineData(12)]  // Change in Funding
    public void OtherRevisionTypes_AreLeftToTheirFieldRules(int groupId)
    {
        Assert.Null(RevisionStatusEligibility.Refusal(groupId, "Completed", "Packaged"));
        Assert.Null(RevisionStatusEligibility.Refusal(groupId, "On-Going", "Not Packaged"));
    }
}
