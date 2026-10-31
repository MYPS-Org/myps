using DBHelper.Models.Enums;
using Helpers.MultiYear;
using Xunit;

namespace MYPS.UnitTests;

/// <summary>
/// The pure rules of Multi-Year Phase 2 (documents/plans/multi-year-phase-2-annual-program-linking.md):
/// the portfolio update after a GAA approval, proposing into an RBP / UBP, PIP membership, saved totals
/// and the planning-project import.
/// </summary>
public class MultiYearLinkingRulesTests
{
    private const int Y = 2027;
    private static PortfolioUpdateRules.Facts F(bool inGaa = false, bool other = false, bool withdrawn = false, bool later = false) => new(inGaa, other, withdrawn, later);

    // ---------------------------------------------------------------- portfolio update (MY-PFL-11, -21, -22)

    [Fact]
    public void Potential_InTheGaa_BecomesOngoing()
    {
        var move = Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2027, F(inGaa: true), Y));
        Assert.Equal((EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing, 2027, 2027), (move.From, move.To, move.FromStartYear, move.ToStartYear));
        Assert.Equal("In the approved GAA 2027.", move.Reason);
    }

    [Fact]
    public void Potential_NotInTheGaa_ImplementedInAnotherYear_BecomesOngoing()
    {
        var move = Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2026, F(other: true), Y));
        Assert.Equal(EnumMembershipStatus.Ongoing, move.To);
    }

    [Fact]
    public void Potential_NeverImplemented_GoesBackToNew_WithNextYearsStart()
    {
        var move = Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2027, F(), Y));
        Assert.Equal((EnumMembershipStatus.New, 2028), (move.To, move.ToStartYear));
        Assert.Equal("Not in the GAA 2027 and never implemented: back to New, start year 2028.", move.Reason);

        // A start year already after Y stays.
        Assert.Equal(2030, Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2030, F(), Y)).ToStartYear);
    }

    [Fact]
    public void Potential_ProposedForALaterYear_WaitsForThatGaa()
    {
        Assert.Empty(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2027, F(later: true), Y));
        // ...unless it is already in this GAA.
        Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Potential, 2027, F(inGaa: true, later: true), Y));
    }

    [Fact]
    public void New_FoundInTheGaa_MovesThroughPotentialToOngoing()
    {
        var moves = PortfolioUpdateRules.Decide(EnumMembershipStatus.New, 2027, F(inGaa: true), Y);
        Assert.Collection(moves,
            m => Assert.Equal((EnumMembershipStatus.New, EnumMembershipStatus.Potential), (m.From, m.To)),
            m => Assert.Equal((EnumMembershipStatus.Potential, EnumMembershipStatus.Ongoing), (m.From, m.To)));
    }

    [Fact]
    public void New_StillNewAfterTheGaa_StartsTheNextYear_OnlyWhenItsStartIsDue()
    {
        var move = Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.New, 2025, F(), Y));
        Assert.Equal((EnumMembershipStatus.New, EnumMembershipStatus.New, 2025, 2028), (move.From, move.To, move.FromStartYear, move.ToStartYear));
        Assert.Equal("Still New after the GAA 2027: start year moved to 2028.", move.Reason);

        Assert.Empty(PortfolioUpdateRules.Decide(EnumMembershipStatus.New, 2028, F(), Y));
    }

    [Fact]
    public void Ongoing_WhoseOnlyGaaEntryWasWithdrawn_GoesBackToNew()
    {
        var move = Assert.Single(PortfolioUpdateRules.Decide(EnumMembershipStatus.Ongoing, 2027, F(withdrawn: true), Y));
        Assert.Equal((EnumMembershipStatus.New, 2028), (move.To, move.ToStartYear));
        Assert.StartsWith("Its GAA entry was withdrawn", move.Reason);
    }

    [Fact]
    public void Ongoing_StaysOngoing_WhenAnyValidEntryRemains()
    {
        Assert.Empty(PortfolioUpdateRules.Decide(EnumMembershipStatus.Ongoing, 2027, F(), Y));
        Assert.Empty(PortfolioUpdateRules.Decide(EnumMembershipStatus.Ongoing, 2027, F(inGaa: true, withdrawn: true), Y));
        Assert.Empty(PortfolioUpdateRules.Decide(EnumMembershipStatus.Ongoing, 2027, F(other: true, withdrawn: true), Y));
    }

    [Theory]
    [InlineData(EnumMembershipStatus.Completed)]
    [InlineData(EnumMembershipStatus.Cancelled)]
    public void CompletedOrCancelled_AreNeverTouched(EnumMembershipStatus status)
    {
        foreach (var facts in AllFacts())
            Assert.Empty(PortfolioUpdateRules.Decide(status, 2020, facts, Y));
    }

    // Every move the update makes is one of the status diagram's System moves, or a start-year move.
    [Fact]
    public void EveryMove_IsADiagramSystemMove_OrOnlyAStartYearMove()
    {
        foreach (var status in Enum.GetValues<EnumMembershipStatus>())
            foreach (var facts in AllFacts())
                foreach (int start in new[] { 2025, 2027, 2028, 2031 })
                    foreach (var move in PortfolioUpdateRules.Decide(status, start, facts, Y))
                        Assert.True(move.From == move.To
                            ? move.ToStartYear > move.FromStartYear
                            : MembershipStatusRules.CanMove(move.From, move.To, MembershipStatusRules.TransitionKind.System),
                            $"{status} {facts} -> {move}");
    }

    // MY-PFL-21: running the update twice gives the same result.
    [Fact]
    public void RunningItAgain_WithTheSameFacts_MovesNothing()
    {
        foreach (var status in Enum.GetValues<EnumMembershipStatus>())
            foreach (var facts in AllFacts())
                foreach (int start in new[] { 2025, 2027, 2028, 2031 })
                {
                    var first = PortfolioUpdateRules.Decide(status, start, facts, Y);
                    var (after, afterStart) = PortfolioUpdateRules.After(status, start, first);
                    Assert.Empty(PortfolioUpdateRules.Decide(after, afterStart, facts, Y));
                }
    }

    [Fact]
    public void OngoingBackToNew_IsASystemMove_NotACoordinatorOne()
    {
        Assert.True(MembershipStatusRules.CanMove(EnumMembershipStatus.Ongoing, EnumMembershipStatus.New, MembershipStatusRules.TransitionKind.System));
        Assert.Equal("An Ongoing project can only be set to Completed or Cancelled.",
            MembershipStatusRules.ManualMoveRefusal(EnumMembershipStatus.Ongoing, EnumMembershipStatus.New));
    }

    private static IEnumerable<PortfolioUpdateRules.Facts> AllFacts() =>
        from a in new[] { false, true }
        from b in new[] { false, true }
        from c in new[] { false, true }
        from d in new[] { false, true }
        select F(a, b, c, d);

    // ---------------------------------------------------------------- propose to RBP / UBP (MY-PFL-20)

    [Fact]
    public void Proposal_IsFromANewOrOngoingRdipOrUdipMembership()
    {
        Assert.Null(ProposalRules.MembershipRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New));
        Assert.Null(ProposalRules.MembershipRefusal(EnumPortfolioKind.UDIP, EnumMembershipStatus.Ongoing));
        Assert.Equal("A project is proposed from its RDIP or UDIP, not from PIP.", ProposalRules.MembershipRefusal(EnumPortfolioKind.PIP, EnumMembershipStatus.New));
        Assert.StartsWith("This project is already proposed", ProposalRules.MembershipRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.Potential));
        Assert.Equal("This project is Cancelled in this portfolio and can no longer change.", ProposalRules.MembershipRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.Cancelled));

        Assert.Equal(EnumMembershipStatus.Potential, ProposalRules.StatusAfter(EnumMembershipStatus.New));
        Assert.Equal(EnumMembershipStatus.Ongoing, ProposalRules.StatusAfter(EnumMembershipStatus.Ongoing));
    }

    [Fact]
    public void Proposal_GoesToTheRbpOfThePortfoliosOwner_OrTheUpmosForAUdip()
    {
        string[] upmo = { "OI2688" };
        Assert.True(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.RDIP, "OI237", new[] { "OI237" }, upmo));
        Assert.False(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.RDIP, "OI237", new[] { "OI238" }, upmo));
        Assert.False(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.RDIP, "OI237", new[] { "OI2688" }, upmo));
        Assert.True(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.UDIP, "OI2690", new[] { "OI2690" }, upmo));
        Assert.True(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.UDIP, "OI2690", new[] { "OI10", "OI2688" }, upmo));
        Assert.False(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.UDIP, "OI2690", new[] { "OI237" }, upmo));
        Assert.False(ProposalRules.ProgramFitsOwner(EnumPortfolioKind.PIP, null, new[] { "OI10" }, upmo));
    }

    [Fact]
    public void Proposal_IsOncePerBudgetYear_FromTheStartYear_WithThatYearsPlannedCost()
    {
        const string program = "RBP FY 2027 Region III";
        Assert.Null(ProposalRules.YearRefusal(2027, 2027, 100m, Array.Empty<int>(), program));
        Assert.Equal("This project is already proposed for 2027. A project is proposed once per budget year.",
            ProposalRules.YearRefusal(2027, 2027, 100m, new[] { 2027 }, program));
        Assert.Equal("RBP FY 2027 Region III is for 2027, before the project's Start Year (2028).",
            ProposalRules.YearRefusal(2027, 2028, 100m, Array.Empty<int>(), program));
        Assert.Equal("This project has no planned cost for 2027. Add it to the yearly costs on the project page first.",
            ProposalRules.YearRefusal(2027, 2027, null, Array.Empty<int>(), program));
    }

    // ---------------------------------------------------------------- PIP (MY-PFL-18, -19, -21)

    [Fact]
    public void AddToPip_TakesANewOrPotentialRdipOrUdipProject_WithAnMcaScore()
    {
        Assert.Null(PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New, 2027, 2023, false, 70m));
        Assert.Null(PipRules.AddRefusal(EnumPortfolioKind.UDIP, EnumMembershipStatus.Potential, 2028, 2023, false, 0m));
        Assert.Equal("Only a New or Potential project can be added to PIP; this one is Ongoing.",
            PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.Ongoing, 2027, 2023, false, 70m));
        Assert.Equal("This project is already in this PIP.", PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New, 2027, 2023, true, 70m));
        Assert.Equal("This project starts in 2029, after this PIP term (2023–2028).",
            PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New, 2029, 2023, false, 70m));
        Assert.Equal("Enter the project's MCA Score.", PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New, 2027, 2023, false, null));
        Assert.Equal("MCA Score must be between 0 and 100.", PipRules.AddRefusal(EnumPortfolioKind.RDIP, EnumMembershipStatus.New, 2027, 2023, false, 100.5m));
        Assert.Equal("Choose a project from an RDIP or UDIP.", PipRules.AddRefusal(EnumPortfolioKind.PIP, EnumMembershipStatus.New, 2027, 2023, false, 70m));
    }

    [Fact]
    public void PipCost_MustBeMoreThanZero()
    {
        Assert.Null(PipRules.CostRefusal(1m));
        Assert.Equal("The PIP cost must be more than zero.", PipRules.CostRefusal(0m));
    }

    [Theory]
    [InlineData("MY00003005LS", "MY00003005LS")]
    [InlineData("  my00403006lz ", "MY00403006LZ")]
    [InlineData("MY0000300LS", null)]
    [InlineData("BP00003005LS", null)]
    [InlineData("MY-2024-001", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void AsMyId_AcceptsOnlyTheGeneratorsFormat(string? multiYearId, string? expected) =>
        Assert.Equal(expected, PipRules.AsMyId(multiYearId));

    [Fact]
    public void HorizonFor_IsTheShortestThatHoldsTheCostYears_ElseLongTerm()
    {
        var horizons = new List<(int Id, int? Years)> { (1, 3), (2, 6), (3, null) };
        Assert.Equal(1, PipRules.HorizonFor(2024, 2026, horizons));
        Assert.Equal(2, PipRules.HorizonFor(2024, 2027, horizons));
        Assert.Equal(2, PipRules.HorizonFor(2024, 2029, horizons));
        Assert.Equal(3, PipRules.HorizonFor(2024, 2030, horizons));
    }

    // ---------------------------------------------------------------- saved totals (MY-PFL-24)

    [Fact]
    public void Totals_CountAYearOnce_ApprovedBeforeProposedBeforePlanned()
    {
        Assert.Equal((0m, 0m, 50m), SavedTotalsRules.Classify(new(50m, 40m, 30m)));
        Assert.Equal((0m, 40m, 0m), SavedTotalsRules.Classify(new(null, 40m, 30m)));
        Assert.Equal((30m, 0m, 0m), SavedTotalsRules.Classify(new(null, null, 30m)));
        Assert.Equal((0m, 0m, 0m), SavedTotalsRules.Classify(new(null, null, null)));
    }

    [Fact]
    public void Totals_AddAPortfolioLinePerTermYear_WithItsCeiling()
    {
        var figures = new Dictionary<(int, int), SavedTotalsRules.YearFigures>
        {
            [(1, 2027)] = new(100m, null, 90m),
            [(2, 2027)] = new(null, 20m, 15m),
            [(2, 2028)] = new(null, null, 30m),
            [(3, 2028)] = new(null, null, null),
        };
        var lines = SavedTotalsRules.Build(figures, new[] { 2027, 2028 }, new Dictionary<int, decimal> { [2027] = 500m });

        Assert.Equal(3, lines.Count(l => l.MultiYearProjectFK != null)); // the empty project-year is left out
        var total2027 = lines.Single(l => l.MultiYearProjectFK == null && l.Year == 2027);
        Assert.Equal((0m, 20m, 100m, (decimal?)500m), (total2027.Planned, total2027.Proposed, total2027.Approved, total2027.Ceiling));
        var total2028 = lines.Single(l => l.MultiYearProjectFK == null && l.Year == 2028);
        Assert.Equal((30m, (decimal?)null), (total2028.Planned, total2028.Ceiling));
    }

    [Fact]
    public void Totals_AreTheSame_WhenTheyHoldTheSameLines_InAnyOrder()
    {
        var a = new List<SavedTotalsRules.Line> { new(1, 2027, 10m, 0m, 0m, null), new(null, 2027, 10m, 0m, 0m, 5m) };
        var b = new List<SavedTotalsRules.Line> { new(null, 2027, 10.00000m, 0m, 0m, 5m), new(1, 2027, 10m, 0m, 0m, null) };
        Assert.True(SavedTotalsRules.Same(a, b));
        Assert.False(SavedTotalsRules.Same(a, new List<SavedTotalsRules.Line> { new(1, 2027, 11m, 0m, 0m, null), a[1] }));
    }

    // ---------------------------------------------------------------- import (MY-PFL-17)

    [Fact]
    public void ImportHeader_IsTheFixedColumnsThenNumberedAmounts()
    {
        var headers = PlanningImportRules.Columns.Concat(new[] { "Amount 1", "Amount 2", "Amount 3" }).ToList<string?>();
        Assert.Null(PlanningImportRules.HeaderRefusal(headers, out int amounts));
        Assert.Equal(3, amounts);

        var gap = PlanningImportRules.Columns.Concat(new[] { "Amount 1", "Amount 3" }).ToList<string?>();
        Assert.Equal($"Column {PlanningImportRules.Columns.Length + 2} must be \"Amount 2\", not \"Amount 3\".", PlanningImportRules.HeaderRefusal(gap, out _));

        Assert.Equal("The template needs at least the column \"Amount 1\".", PlanningImportRules.HeaderRefusal(PlanningImportRules.Columns.ToList<string?>(), out _));

        var renamed = PlanningImportRules.Columns.ToList<string?>();
        renamed[1] = "Categ";
        Assert.Equal("Column 2 must be \"Category\", not \"Categ\". Download the template again.", PlanningImportRules.HeaderRefusal(renamed, out _));
    }

    [Fact]
    public void ImportAmounts_RunFromTheStartYear_AndStopAtTheLastFilledCell()
    {
        var result = PlanningImportRules.ReadAmounts(2027, new[] { "1,000.50", "2000", null, "" });
        Assert.Empty(result.Errors);
        Assert.Equal(new[] { new MultiYearCostRules.YearAmount(2027, 1000.50m), new MultiYearCostRules.YearAmount(2028, 2000m) }, result.Years);
    }

    [Fact]
    public void ImportAmounts_RefuseABlankBetweenFilledCells_AZero_AndText()
    {
        var result = PlanningImportRules.ReadAmounts(2027, new[] { "100", "", "0", "abc" });
        Assert.Equal(new[]
        {
            "Amount 2 (2028) is blank, but a later amount is filled. Enter every year's amount from the Start Year on.",
            "Amount 3 (2029) must be more than zero.",
            "Amount 4 (2030) is not a number.",
        }, result.Errors);

        Assert.Equal("Enter at least one yearly amount, starting with Amount 1 (the Start Year).",
            Assert.Single(PlanningImportRules.ReadAmounts(2027, new string?[] { null, " " }).Errors));
    }

    [Fact]
    public void ImportLookups_TakeACodeOrAnExactName()
    {
        var regions = new List<PlanningImportRules.Option> { new("OI237", "Region III"), new("OI238", "Region IV-A"), new("X1", "Twin"), new("X2", "Twin") };
        Assert.Equal(("OI237", (string?)null), PlanningImportRules.Resolve("oi237", regions, "Region", true));
        Assert.Equal(("OI238", (string?)null), PlanningImportRules.Resolve(" region iv-a ", regions, "Region", true));
        Assert.Equal((null, "Region \"Twin\" matches 2 entries. Use its code from the Lists sheet."), PlanningImportRules.Resolve("Twin", regions, "Region", true));
        Assert.Equal((null, "Region \"Mars\" is not in the Lists sheet."), PlanningImportRules.Resolve("Mars", regions, "Region", false));
        Assert.Equal((null, "Region is required."), PlanningImportRules.Resolve(" ", regions, "Region", true));
        Assert.Equal(((string?)null, (string?)null), PlanningImportRules.Resolve(null, regions, "Province", false));
    }

    [Fact]
    public void ImportCells_SplitListsAndReadYears()
    {
        Assert.Equal(new[] { "Feasibility Study", "ROW" }, PlanningImportRules.SplitList(" Feasibility Study ; ;ROW "));
        Assert.Equal((2027, (string?)null), PlanningImportRules.ReadYear("2027", "Start Year", true));
        Assert.Equal(((int?)null, "Start Year must be a year between 1990 and 2100."), PlanningImportRules.ReadYear("27.5", "Start Year", true));
        Assert.Equal(((int?)null, "Start Year is required."), PlanningImportRules.ReadYear("", "Start Year", true));
        Assert.Equal(((decimal?)null, "MCA Score is not a number."), PlanningImportRules.ReadNumber("high", "MCA Score"));
    }
}
