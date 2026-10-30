using Helpers;
using Xunit;

namespace MYPS.UnitTests;

public class SignInHostDomainTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("10.1.2.3")]
    [InlineData("pc-123.example.com")]
    public void NoDomainsListed_AllowsAnyComputer(string? host)
    {
        Assert.True(new SignInConfig().Allows(host));
        Assert.True(new SignInConfig { AllowedHostDomains = ["", "  "] }.Allows(host));
    }

    [Theory]
    [InlineData("PC-123.dpwh.gov.ph")]
    [InlineData("pc-123.co.DPWH.gov.ph")]
    [InlineData("dpwh.gov.ph")]
    [InlineData("pc-123.dpwh.gov.ph.")]
    public void UnderAListedDomain_IsAllowed(string host)
    {
        Assert.True(new SignInConfig { AllowedHostDomains = [" .dpwh.gov.ph "] }.Allows(host));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("10.1.2.3")]
    [InlineData("pc-123.notdpwh.gov.ph")]
    [InlineData("dpwh.gov.ph.example.com")]
    [InlineData("almadronesat")]
    public void OutsideTheListedDomains_IsRefused(string? host)
    {
        Assert.False(new SignInConfig { AllowedHostDomains = ["dpwh.gov.ph"] }.Allows(host));
    }
}
