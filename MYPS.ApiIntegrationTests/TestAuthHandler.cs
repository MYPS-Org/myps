using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MYPS.ApiIntegrationTests;

/*  Attaches the same claim shape the real cookie-auth login (AuthenticationController.cs)
    puts on a signed-in request -- ClaimTypes.NameIdentifier, "HostName" -- to every request
    made through a WebApplicationFactory client configured with this handler, bypassing only
    the password check. Every DOWNSTREAM check this session's deep-protocol plan identified
    still runs for real against the configured database: CoreController.OnActionExecuting's own
    vUsers re-resolution, and PermissionFilter's vUsers/vUserActionPermission lookups -- this
    handler only answers "who is making this request", not "are they allowed to do this".

    The UserId comes from a request header (X-Test-UserId), not static state -- this project's
    other test classes (ApplicationFactorySmokeTests, RequiresDeletionObjectsTests) build their
    own independent WebApplicationFactory instances and may run in parallel with this one;
    static mutable auth state would race across them. A request with no header authenticates
    as "unauthenticated", exercising the real 401 path the same way a real anonymous caller
    would. */
public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "TestScheme";
    public const string UserIdHeader = "X-Test-UserId";
    public const string HostNameHeader = "X-Test-HostName";

    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserIdHeader, out var userIdValues) || string.IsNullOrEmpty(userIdValues.ToString()))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        string userId = userIdValues.ToString();
        // CoreController.OnActionExecuting requires a non-empty HostName claim once
        // Appsetting.Environment != "Development" -- the test host runs as "Testing", so this
        // must default to something non-empty, matching a real caller's machine name.
        string hostName = Request.Headers.TryGetValue(HostNameHeader, out var hostValues) && !string.IsNullOrEmpty(hostValues.ToString())
            ? hostValues.ToString()
            : "TEST-HOST";

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim("Name", userId),
            new Claim("HostName", hostName),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
