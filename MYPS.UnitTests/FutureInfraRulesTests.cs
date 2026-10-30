using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// S06: a future road / section / bridge gets the LOWEST free number (TC003-P001: RBIA's hand-assigned IDs are
// scattered up to FS97844, and highest + 1 never reused a deleted one's number), and a bridge's From Chainage
// must lie on its road section (TC010-P001).
public sealed class FutureInfraRulesTests
{
    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void NoIds_StartsAtOne() =>
        Assert.Equal(1, FutureInfraIds.LowestFreeNumber(Array.Empty<string>(), "FR"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void Gap_IsFilledBeforeTheHighest() =>
        Assert.Equal(3, FutureInfraIds.LowestFreeNumber(new[] { "FR00001LZ", "FR00002VS", "FR00004MN", "FR97844LZ" }, "FR"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void ANumberIsTakenOnEveryIsland() =>
        Assert.Equal(2, FutureInfraIds.LowestFreeNumber(new[] { "FS00001LZ", "FS00001VS" }, "FS"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void OtherPrefixesAndMalformedIds_DoNotTakeANumber() =>
        Assert.Equal(1, FutureInfraIds.LowestFreeNumber(new[] { "FB00001LZ", "S00001LZ", "FS0001LZ", "FS0057BLZ", null, "" }, "FS"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void IdsAreReadTrimmedAndCaseInsensitive() =>
        Assert.Equal(2, FutureInfraIds.LowestFreeNumber(new[] { " fs00001lz " }, "FS"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void EveryNumberUsed_IsNull() =>
        Assert.Null(FutureInfraIds.LowestFreeNumber(Enumerable.Range(1, 99999).Select(n => $"FB{n:D5}LZ"), "FB"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void Format_PadsTheNumber() =>
        Assert.Equal("FR00007LZ", FutureInfraIds.Format("FR", 7, "LZ"));

    [Theory]
    [Trait("Feature", "FutureInfra")]
    [InlineData(0, 50)]        // the start of the section
    [InlineData(520, 30)]      // the end of the section; the bridge may run past it
    [InlineData(260.5, 600)]
    public void BridgeOnTheSection_Fits(double from, double length) =>
        Assert.Null(BridgePlacement.Refusal(from, length, 520, "FS00016LZ"));

    [Theory]
    [Trait("Feature", "FutureInfra")]
    [InlineData(520.01)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    public void FromOutsideTheSection_IsRefused(double from) =>
        Assert.Equal("From Chainage must be between 0 and 520 m, the length of road section FS00016LZ.",
            BridgePlacement.Refusal(from, 50, 520, "FS00016LZ"));

    [Theory]
    [Trait("Feature", "FutureInfra")]
    [InlineData(0)]
    [InlineData(-5)]
    public void NoLength_IsRefused(double length) =>
        Assert.Equal("Bridge Length must be greater than 0 m.", BridgePlacement.Refusal(10, length, 520, "FS00016LZ"));

    [Fact]
    [Trait("Feature", "FutureInfra")]
    public void ShorteningBelowABridgeStart_IsRefused()
    {
        Assert.Equal("A bridge on this road section starts at 400.5 m, so its Length cannot be less than 400.5 m.",
            BridgePlacement.ShortenRefusal(400, 400.5));
        Assert.Null(BridgePlacement.ShortenRefusal(400.5, 400.5));
        Assert.Null(BridgePlacement.ShortenRefusal(10, null));
    }
}
