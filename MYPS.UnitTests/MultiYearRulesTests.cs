using DBHelper.Models.Enums;
using Helpers;
using Helpers.MultiYear;
using Xunit;

namespace MYPS.UnitTests;

// The Multi-Year module's rules (documents/plans/multi-year-phase-1-portfolio-module.md), from the
// requirements in docs/multi-year: MY-PFL-03/-04/-06 terms, MY-PFL-11/-12/-13 membership status,
// MY-PRJ-10/-26 planned yearly costs, MY-PFL-08/-26 who sees which portfolio.
public class MultiYearRulesTests
{
    // ---------------------------------------------------------------- terms

    [Fact]
    public void Term_IsSixYears_AndTheNextStartsTheYearAfter()
    {
        Assert.Equal(2028, PortfolioTermRules.TermEnd(2023));
        Assert.Equal(2029, PortfolioTermRules.NextTermStart(2023));
        Assert.Equal("2023–2028", PortfolioTermRules.TermLabel(2023));
        Assert.Equal("RDIP Region VI 2023–2028", PortfolioTermRules.PortfolioName(EnumPortfolioKind.RDIP, "Region VI", 2023));
        Assert.Equal("PIP 2023–2028", PortfolioTermRules.PortfolioName(EnumPortfolioKind.PIP, null, 2023));
    }

    [Theory]
    [InlineData(2023, 2023, true)]
    [InlineData(2023, 2028, true)]
    [InlineData(2023, 2018, true)]
    [InlineData(2023, 2029, false)]
    [InlineData(2023, 2017, false)]
    public void Terms_OverlapWhenTheirStartsAreLessThanSixYearsApart(int a, int b, bool overlaps)
    {
        Assert.Equal(overlaps, PortfolioTermRules.Overlaps(a, b));
    }

    [Fact]
    public void CreateRefusal_SendsTheNextTermThroughOpenNextTerm_AndNamesTheClash()
    {
        Assert.Null(PortfolioTermRules.CreateRefusal(EnumPortfolioKind.PIP, null, 2023, Array.Empty<int>()));
        // An earlier, historical term may still be created beside a later one.
        Assert.Null(PortfolioTermRules.CreateRefusal(EnumPortfolioKind.RDIP, "Region VI", 2011, new[] { 2017, 2023 }));
        Assert.Equal("RDIP Region VI 2023–2028 is the term before it. Use Open Next Term on that portfolio instead, so its unfinished projects are carried forward.",
            PortfolioTermRules.CreateRefusal(EnumPortfolioKind.RDIP, "Region VI", 2029, new[] { 2017, 2023 }));

        Assert.Equal("RDIP Region VI 2023–2028 already exists.",
            PortfolioTermRules.CreateRefusal(EnumPortfolioKind.RDIP, "Region VI", 2023, new[] { 2023 }));
        string? overlap = PortfolioTermRules.CreateRefusal(EnumPortfolioKind.RDIP, "Region VI", 2025, new[] { 2023 });
        Assert.NotNull(overlap);
        Assert.StartsWith("RDIP Region VI 2023–2028 overlaps the term 2025–2030.", overlap);
        Assert.Contains("starts in 2029", overlap);
    }

    [Theory]
    [InlineData(1989)]
    [InlineData(2096)]
    public void CreateRefusal_RefusesATermOutsideTheYearRange(int start)
    {
        Assert.Equal("The term must start between 1990 and 2095.",
            PortfolioTermRules.CreateRefusal(EnumPortfolioKind.UDIP, "Flood Control", start, Array.Empty<int>()));
    }

    [Fact]
    public void AClosedTerm_IsReadOnly()
    {
        Assert.Null(PortfolioTermRules.WriteRefusal(EnumPortfolioStatus.Open, 2017));
        Assert.Equal("The term 2017–2022 is closed and read-only.", PortfolioTermRules.WriteRefusal(EnumPortfolioStatus.Closed, 2017));
    }

    // ---------------------------------------------------------------- membership status

    [Theory]
    [InlineData(EnumMembershipStatus.New, EnumMembershipStatus.Cancelled)]
    [InlineData(EnumMembershipStatus.Ongoing, EnumMembershipStatus.Completed)]
    [InlineData(EnumMembershipStatus.Ongoing, EnumMembershipStatus.Cancelled)]
    public void Coordinator_MaySetOnlyTheDiagramsManualMoves(EnumMembershipStatus from, EnumMembershipStatus to)
    {
        Assert.Null(MembershipStatusRules.ManualMoveRefusal(from, to));
    }

    [Theory]
    [InlineData(EnumMembershipStatus.New, EnumMembershipStatus.Potential)]      // system: proposed to RBP/UBP
    [InlineData(EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing)]  // system: GAA approval
    [InlineData(EnumMembershipStatus.Potential, EnumMembershipStatus.Cancelled)] // not in the diagram
    [InlineData(EnumMembershipStatus.New, EnumMembershipStatus.Completed)]
    [InlineData(EnumMembershipStatus.New, EnumMembershipStatus.Ongoing)]
    public void Coordinator_CannotSetAMoveTheDiagramDoesNotGiveThem(EnumMembershipStatus from, EnumMembershipStatus to)
    {
        Assert.NotNull(MembershipStatusRules.ManualMoveRefusal(from, to));
    }

    [Fact]
    public void SystemMoves_AreTheDiagramsAutomaticOnes()
    {
        Assert.True(MembershipStatusRules.CanMove(EnumMembershipStatus.New, EnumMembershipStatus.Potential, MembershipStatusRules.TransitionKind.System));
        Assert.True(MembershipStatusRules.CanMove(EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing, MembershipStatusRules.TransitionKind.System));
        Assert.True(MembershipStatusRules.CanMove(EnumMembershipStatus.Potential, EnumMembershipStatus.New, MembershipStatusRules.TransitionKind.System));
        Assert.False(MembershipStatusRules.CanMove(EnumMembershipStatus.New, EnumMembershipStatus.Potential, MembershipStatusRules.TransitionKind.Manual));
    }

    [Theory]
    [InlineData(EnumMembershipStatus.Completed)]
    [InlineData(EnumMembershipStatus.Cancelled)]
    public void CompletedOrCancelled_LocksTheMembership(EnumMembershipStatus status)
    {
        Assert.True(MembershipStatusRules.IsLocked(status));
        Assert.Empty(MembershipStatusRules.ManualTargets(status));
        Assert.Equal($"This project is {status} in this portfolio and can no longer change.",
            MembershipStatusRules.ManualMoveRefusal(status, EnumMembershipStatus.Ongoing));
    }

    [Fact]
    public void StartYear_IsEditableOnlyWhileNew()
    {
        Assert.True(MembershipStatusRules.CanEditStartYear(EnumMembershipStatus.New));
        Assert.False(MembershipStatusRules.CanEditStartYear(EnumMembershipStatus.Potential));
        Assert.False(MembershipStatusRules.CanEditStartYear(EnumMembershipStatus.Ongoing));
    }

    [Fact]
    public void APotentialProject_IsSetByTheSystem()
    {
        Assert.Equal("A Potential project's status is set by the system, not by hand.",
            MembershipStatusRules.ManualMoveRefusal(EnumMembershipStatus.Potential, EnumMembershipStatus.Cancelled));
        Assert.Equal("A New project can only be set to Cancelled.",
            MembershipStatusRules.ManualMoveRefusal(EnumMembershipStatus.New, EnumMembershipStatus.Ongoing));
    }

    // ---------------------------------------------------------------- planned yearly costs

    private static MultiYearCostRules.YearAmount Y(int year, decimal amount) => new(year, amount);

    [Fact]
    public void Costs_WithinTheYears_AreValid_WithNoWarning()
    {
        var result = MultiYearCostRules.Check(2026, 2031, 6, "Medium term", new[] { Y(2026, 100), Y(2027, 50), Y(2031, 1) });
        Assert.True(result.IsValid);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Costs_RefuseZero_Duplicates_AndYearsOutsideStartAndEnd()
    {
        var result = MultiYearCostRules.Check(2026, 2028, 3, "Short term", new[] { Y(2025, 10), Y(2026, 0), Y(2027, 5), Y(2027, 6), Y(2029, 1) });
        Assert.False(result.IsValid);
        Assert.Contains("2027 is entered more than once.", result.Errors);
        Assert.Contains("The planned cost for 2026 must be more than zero.", result.Errors);
        Assert.Contains("2025 is before the Start Year (2026).", result.Errors);
        Assert.Contains("2029 is after the End Year (2028).", result.Errors);
    }

    [Fact]
    public void Costs_NeedAtLeastOneYear()
    {
        Assert.Equal(new[] { "Enter at least one planned yearly cost." },
            MultiYearCostRules.Check(2026, null, 3, "Short term", Array.Empty<MultiYearCostRules.YearAmount>()).Errors);
    }

    [Fact]
    public void Costs_BeyondTheHorizon_WarnButSave()
    {
        var result = MultiYearCostRules.Check(2026, null, 3, "Short term", new[] { Y(2026, 1), Y(2029, 1), Y(2030, 1) });
        Assert.True(result.IsValid);
        Assert.Equal(new[] { "2029, 2030 are beyond the Short term horizon (2026–2028). Saved anyway." }, result.Warnings);

        Assert.Empty(MultiYearCostRules.Check(2026, null, null, "Long term", new[] { Y(2026, 1), Y(2060, 1) }).Warnings);
    }

    [Theory]
    [InlineData(2026, null, null)]
    [InlineData(2026, 2026, null)]
    [InlineData(1989, null, "Start Year must be between 1990 and 2100.")]
    [InlineData(2026, 2025, "End Year must be between the Start Year (2026) and 2100.")]
    public void ProjectYears_EndIsNotBeforeStart(int start, int? end, string? refusal)
    {
        Assert.Equal(refusal, MultiYearCostRules.YearsRefusal(start, end));
    }

    // ---------------------------------------------------------------- who sees which portfolio

    private static readonly MultiYearAccess.OfficeFacts NoOffice = new();

    [Fact]
    public void All_SeesEveryPortfolio_IncludingPip()
    {
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.Region, GroupProjectScope.All }, NoOffice, applyFilter: true, hasPipGrant: false);
        Assert.True(v.CanSee(EnumPortfolioKind.PIP, null));
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI233"));
        Assert.True(v.CanSee(EnumPortfolioKind.UDIP, "OI2690"));
    }

    [Fact]
    public void OwnRegion_SeesThatRegionsRdipOnly()
    {
        var office = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI1908", PlantillaIsRegion = true };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.Region }, office, applyFilter: true, hasPipGrant: false);
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI1908"));
        Assert.False(v.CanSee(EnumPortfolioKind.RDIP, "OI233"));
        Assert.False(v.CanSee(EnumPortfolioKind.UDIP, "OI2690"));
        Assert.False(v.CanSee(EnumPortfolioKind.PIP, null));
    }

    [Fact]
    public void OwnDistrict_SeesTheRdipOfItsRegion()
    {
        var office = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI57", PlantillaDeoRegion = "OI238" };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.District }, office, applyFilter: true, hasPipGrant: false);
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI238"));
        Assert.False(v.CanSee(EnumPortfolioKind.RDIP, "OI57"));
    }

    [Fact]
    public void OwnCluster_SeesItsClusters_Udip_AndTheUpmoSeesEveryUdip()
    {
        var cluster = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI2690", PlantillaIsPmoCluster = true };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.Cluster }, cluster, applyFilter: true, hasPipGrant: false);
        Assert.True(v.CanSee(EnumPortfolioKind.UDIP, "OI2690"));
        Assert.False(v.CanSee(EnumPortfolioKind.UDIP, "OI2689"));
        Assert.False(v.CanSee(EnumPortfolioKind.RDIP, "OI233"));

        var upmo = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI2688", PlantillaIsUpmo = true };
        var all = MultiYearAccess.Decide(new[] { GroupProjectScope.Cluster }, upmo, applyFilter: true, hasPipGrant: false);
        Assert.True(all.CanSee(EnumPortfolioKind.UDIP, "OI2689"));
        Assert.True(all.CanSee(EnumPortfolioKind.UDIP, "OI3573"));
        Assert.False(all.CanSee(EnumPortfolioKind.RDIP, "OI233"));
    }

    [Fact]
    public void AnOfficeThatDoesNotFit_SeesNothing()
    {
        var office = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI10" };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.Region, GroupProjectScope.Cluster }, office, applyFilter: false, hasPipGrant: false);
        Assert.False(v.AllRdip);
        Assert.False(v.AllUdip);
        Assert.Empty(v.RdipOwners);
        Assert.Empty(v.UdipOwners);
    }

    [Fact]
    public void DataSecurity_WithoutApplyFilter_SeesEveryRdipAndUdip_ButNotPip()
    {
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.DataSecurity }, NoOffice, applyFilter: false, hasPipGrant: false);
        Assert.True(v.AllRdip);
        Assert.True(v.AllUdip);
        Assert.False(v.CanSee(EnumPortfolioKind.PIP, null));
    }

    [Fact]
    public void DataSecurity_WithApplyFilter_SeesItsRegionsRdip_OrEverythingForACentralOffice()
    {
        var regional = new MultiYearAccess.OfficeFacts { DataSecurityRegion = "OI238" };
        var v = MultiYearAccess.Decide(Array.Empty<GroupProjectScope>(), regional, applyFilter: true, hasPipGrant: false);
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI238"));
        Assert.False(v.CanSee(EnumPortfolioKind.RDIP, "OI233"));
        Assert.False(v.AllUdip);

        var central = new MultiYearAccess.OfficeFacts { DataSecurityOfficeHasNoRegion = true };
        var c = MultiYearAccess.Decide(new[] { GroupProjectScope.DataSecurity }, central, applyFilter: true, hasPipGrant: false);
        Assert.True(c.AllRdip);
        Assert.True(c.AllUdip);
    }

    [Fact]
    public void DataSecurity_AddsNothing_WhenAnotherGroupHasAnOfficeScope()
    {
        var office = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI1908", PlantillaIsRegion = true };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.DataSecurity, GroupProjectScope.Region }, office, applyFilter: false, hasPipGrant: false);
        Assert.False(v.AllRdip);
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI1908"));
    }

    [Fact]
    public void ShowPipGrant_AddsPip_ToWhateverElseTheUserSees()
    {
        var office = new MultiYearAccess.OfficeFacts { PlantillaOffice = "OI1908", PlantillaIsRegion = true };
        var v = MultiYearAccess.Decide(new[] { GroupProjectScope.Region }, office, applyFilter: true, hasPipGrant: true);
        Assert.True(v.CanSee(EnumPortfolioKind.PIP, null));
        Assert.True(v.CanSee(EnumPortfolioKind.RDIP, "OI1908"));
        Assert.False(v.CanSee(EnumPortfolioKind.RDIP, "OI233"));
    }
}
