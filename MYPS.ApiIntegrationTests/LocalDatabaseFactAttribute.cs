using Xunit;

namespace MYPS.ApiIntegrationTests;

/*  A [Fact] that needs a real local MYPS database (DeletionEndpointsHttpFixture). When
    MYPS_HTTP_TEST_MYPSDB is not set the test is reported as SKIPPED -- not as passed, which is
    what an early `return` inside the test used to look like on CI (2026-10-16). xunit 2.5 has no
    runtime Skip, so the attribute decides when the test is discovered. */
public sealed class LocalDatabaseFactAttribute : FactAttribute
{
    public LocalDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(DeletionEndpointsHttpFixture.ConnectionStringVariable)))
        {
            Skip = $"Set {DeletionEndpointsHttpFixture.ConnectionStringVariable} to a LOCAL MYPS database connection string to run this test.";
        }
    }
}
