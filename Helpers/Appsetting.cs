using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace Helpers
{
    public class LDAPConfig
    {
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 389;
        public string DN { get; set; } = String.Empty;
    }
    public static class Appsetting
    {
        public static string ConnectionString { get; set; } = string.Empty;
        public static string Environment { get; set; } = "Development";
        public static string MachineName { get; set; } = System.Environment.MachineName;
        public static string AppName { get; } = "MYPS";
        public static LDAPConfig LDAP { get; set; } = new LDAPConfig();
        public static void PrepareAppsettings(IConfiguration config)
        {
            /* PREPARE DATABASE CONNECTIONS */
            ConnectionString = config.GetConnectionString("DbConnection")!;
            LDAP = config.GetSection("LDAP").Get<LDAPConfig>()!;
        }
    }
}
