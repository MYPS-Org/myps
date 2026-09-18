using Microsoft.Data.SqlClient;

namespace MYPS.DatabaseTests;

internal static class LocalDbSafety
{
    /*  LocalDB is the default because it needs no server and no credentials. It is not
        installed everywhere, though -- a full SQL Server developer install has no LocalDB
        instance -- and on those machines the whole suite was simply unrunnable.

        MYPS_TEST_SQL_SERVER points the suite at any server instead. With
        MYPS_TEST_SQL_USER / MYPS_TEST_SQL_PASSWORD it authenticates with those; without
        them it uses integrated security, as LocalDB always did.

        What makes this safe is not the server but ValidateDatabaseName: every database the
        suite creates and drops is a fresh MYPS_Test_<guid>, and any name that is not one is
        refused before it reaches a CREATE or a DROP. Point it at a real server and it still
        cannot touch a real database. Point it at a shared one and you are creating and
        dropping databases on shared infrastructure, so: local servers only.

        Ported 2026-09-18 from fix/program-details-cost-computation, where it was written. */
    internal const string DefaultServer = @"(localdb)\MSSQLLocalDB";
    internal const string RequiredPrefix = "MYPS_Test_";

    private static string Server =>
        Environment.GetEnvironmentVariable("MYPS_TEST_SQL_SERVER") is { Length: > 0 } server
            ? server
            : DefaultServer;

    private static string? UserId => Environment.GetEnvironmentVariable("MYPS_TEST_SQL_USER") is { Length: > 0 } user ? user : null;

    private static string? Password => Environment.GetEnvironmentVariable("MYPS_TEST_SQL_PASSWORD");

    internal static string ValidateDatabaseName(string databaseName)
    {
        if (!databaseName.StartsWith(RequiredPrefix, StringComparison.Ordinal) ||
            databaseName.Any(character => !char.IsLetterOrDigit(character) && character != '_'))
        {
            throw new InvalidOperationException(
                $"Unsafe disposable database name '{databaseName}'. Required prefix: {RequiredPrefix}.");
        }
        return databaseName;
    }

    internal static string BuildConnectionString(string databaseName)
    {
        ValidateDatabaseName(databaseName);
        return Build(databaseName, multipleActiveResultSets: true);
    }

    internal static string MasterConnectionString => Build("master", multipleActiveResultSets: false);

    private static string Build(string databaseName, bool multipleActiveResultSets)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = Server,
            InitialCatalog = databaseName,
            TrustServerCertificate = true,
            ConnectTimeout = 15,
            MultipleActiveResultSets = multipleActiveResultSets
        };

        if (UserId is null)
        {
            builder.IntegratedSecurity = true;
        }
        else
        {
            builder.UserID = UserId;
            builder.Password = Password ?? string.Empty;
        }

        return builder.ConnectionString;
    }
}
