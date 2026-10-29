using Helpers;
using Helpers.API;
using Xunit;

namespace MYPS.UnitTests;

public class LocalLoginTests
{
    [Fact]
    public void Verify_AcceptsTheHashedPassword_RejectsOthers()
    {
        string hash = LocalPassword.Hash("Correct-Horse-7", iterations: 1_000);

        Assert.StartsWith("PBKDF2-SHA256$1000$", hash);
        Assert.True(LocalPassword.Verify("Correct-Horse-7", hash));
        Assert.False(LocalPassword.Verify("correct-horse-7", hash));
        Assert.False(LocalPassword.Verify("", hash));
        Assert.False(LocalPassword.Verify(null, hash));
    }

    [Fact]
    public void Hash_UsesANewSaltEachTime()
    {
        Assert.NotEqual(LocalPassword.Hash("same", 1_000), LocalPassword.Hash("same", 1_000));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("plain-text-password")]
    [InlineData("PBKDF2-SHA256$abc$c2FsdA==$aGFzaA==")]
    [InlineData("PBKDF2-SHA256$0$c2FsdA==$aGFzaA==")]
    [InlineData("PBKDF2-SHA256$1000$not base64$aGFzaA==")]
    [InlineData("SHA1$1000$c2FsdA==$aGFzaA==")]
    public void Verify_RejectsMalformedHashes(string? stored)
    {
        Assert.False(LocalPassword.Verify("anything", stored));
    }

    [Fact]
    public void Check_MatchesUserIdIgnoringCase_AndRejectsUnlistedUsers()
    {
        var saved = Appsetting.LocalLogin;
        try
        {
            Appsetting.LocalLogin = new LocalLoginConfig
            {
                Enabled = true,
                Users = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["testuser"] = LocalPassword.Hash("Pass-1234", 1_000),
                },
            };

            Assert.True(LocalPassword.Check("TestUser", "Pass-1234"));
            Assert.False(LocalPassword.Check("testuser", "wrong"));
            Assert.False(LocalPassword.Check("someoneelse", "Pass-1234"));
        }
        finally
        {
            Appsetting.LocalLogin = saved;
        }
    }

    [Fact]
    public async Task PisDisabled_SendsNothing()
    {
        var saved = Appsetting.PIS;
        try
        {
            // Nothing listens on port 9: if a request were sent, it would fail with a connection error.
            Appsetting.PIS = new PISConfig { Disabled = true, Host = "http://127.0.0.1:9/", Login = "http://127.0.0.1:9/" };

            Assert.Null(await APIRequest.XML(new GetUserInfoPIS("00000")));
            Assert.Null(await APIRequest.XML(new AuthenticatePIS("someone", "secret")));
        }
        finally
        {
            Appsetting.PIS = saved;
        }
    }
}
