using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace Helpers
{
    public static class Appsetting
    {
        public static string ConnectionString { get; set; } = string.Empty;
        public static string Environment { get; set; } = "Development";
        public static string MachineName { get; set; } = System.Environment.MachineName;
        public static string AppName { get; } = "MYPS";
        public static void PrepareAppsettings(IConfiguration config)
        {
            /* PREPARE DATABASE CONNECTIONS */
            ConnectionString = config.GetConnectionString("DbConnection")!;
        }
    }
}
