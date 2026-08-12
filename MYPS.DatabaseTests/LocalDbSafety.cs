using Microsoft.Data.SqlClient;

namespace MYPS.DatabaseTests;

internal static class LocalDbSafety
{
    internal const string Server = @"(localdb)\MSSQLLocalDB";
    internal const string RequiredPrefix = "MYPS_Test_";

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
        return new SqlConnectionStringBuilder
        {
            DataSource = Server,
            InitialCatalog = databaseName,
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            ConnectTimeout = 15,
            MultipleActiveResultSets = true
        }.ConnectionString;
    }

    internal static string MasterConnectionString => new SqlConnectionStringBuilder
    {
        DataSource = Server,
        InitialCatalog = "master",
        IntegratedSecurity = true,
        TrustServerCertificate = true,
        ConnectTimeout = 15
    }.ConnectionString;
}
