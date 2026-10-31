using Helpers;
using Xunit;

namespace MYPS.UnitTests;

public class GroupProjectScopeTests
{
    [Theory]
    [InlineData("AUC", GroupProjectScope.All)]
    [InlineData("DPD Admin", GroupProjectScope.All)]
    [InlineData("RPC", GroupProjectScope.Region)]
    [InlineData("DPC", GroupProjectScope.District)]
    [InlineData("Admin", GroupProjectScope.DataSecurity)]
    [InlineData("RPO", GroupProjectScope.DataSecurity)]
    [InlineData("dpc", GroupProjectScope.DataSecurity)]
    [InlineData(null, GroupProjectScope.DataSecurity)]
    public void ByName_IsTheScopeTheNamesGaveBefore(string? groupName, GroupProjectScope expected)
    {
        Assert.Equal(expected, GroupProjectScopes.ByName(groupName));
    }

    [Fact]
    public void All_WinsOverEveryOtherScope()
    {
        var widest = GroupProjectScopes.Widest(new[] { GroupProjectScope.District, GroupProjectScope.All, GroupProjectScope.Region }, out _, out _);
        Assert.Equal(GroupProjectScope.All, widest);
    }

    [Fact]
    public void RegionAndDistrict_AddUp()
    {
        var widest = GroupProjectScopes.Widest(new[] { GroupProjectScope.District, GroupProjectScope.DataSecurity, GroupProjectScope.Region }, out bool region, out bool district);
        Assert.NotNull(widest);
        Assert.NotEqual(GroupProjectScope.All, widest);
        Assert.True(region);
        Assert.True(district);
    }

    [Fact]
    public void DistrictAlone_IsDistrictOnly()
    {
        var widest = GroupProjectScopes.Widest(new[] { GroupProjectScope.District, GroupProjectScope.DataSecurity }, out bool region, out bool district);
        Assert.Equal(GroupProjectScope.District, widest);
        Assert.False(region);
        Assert.True(district);
    }

    [Fact]
    public void OnlyDataSecurity_OrNoGroup_FallsBackToTheDataSecurityRule()
    {
        Assert.Null(GroupProjectScopes.Widest(new[] { GroupProjectScope.DataSecurity }, out _, out _));
        Assert.Null(GroupProjectScopes.Widest(Array.Empty<GroupProjectScope>(), out _, out _));
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(3, true)]
    [InlineData(-1, false)]
    [InlineData(4, false)]
    public void IsValid_AcceptsTheFourScopes(int value, bool valid)
    {
        Assert.Equal(valid, GroupProjectScopes.IsValid(value));
    }
}
