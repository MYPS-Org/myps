using System.Resources;
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
    public class PISConfig
    {
        public string Host { get; set; } = string.Empty;
        public string userName { get; set; } = string.Empty;
        public string password { get; set; } = string.Empty;
    }
    public class MYPSToPCMA
    {
        public string Host { get; set; } = string.Empty;
        public string userName { get; set; } = string.Empty;
        public string password { get; set; } = string.Empty;
    }
    public class ResourcesFolder
    {
        public string Main { get; set; } = string.Empty;
        public string Projects { get; set; } = string.Empty;
        public string ProjectNotes { get; set; } = string.Empty;
        public string SupportingDocs { get; set; } = string.Empty;
    }
    public class KafkaConfig
    {
        public string KafkaServer { get; set; } = string.Empty;
    }
    public static class Appsetting
    {
        public static string ConnectionString { get; set; } = string.Empty;
        public static string Environment { get; set; } = "Development";
        public static string MachineName { get; set; } = System.Environment.MachineName;
        public static string AppName { get; } = "MYPS";
        public static LDAPConfig LDAP { get; set; } = new LDAPConfig();
        public static PISConfig PIS { get; set; } = new PISConfig();
        public static MYPSToPCMA PCMA { get; set; } = new MYPSToPCMA();
        public static string WebRootPath { get; set; } = string.Empty;
        public static string RootPath { get; set; } = string.Empty;
        public static ResourcesFolder Resources { get; set; } = new ResourcesFolder();
        public static KafkaConfig KafkaConfigs { get; set; } = new KafkaConfig();
        public static void PrepareAppsettings(IConfiguration config)
        {
            /* PREPARE DATABASE CONNECTIONS */
            ConnectionString = config.GetConnectionString("DbConnection")!;
            LDAP = config.GetSection("LDAP").Get<LDAPConfig>()!;
            PIS = config.GetSection("PIS").Get<PISConfig>()!;
            PCMA = config.GetSection("MYPSToPCMA").Get<MYPSToPCMA>()!;
            Resources = config.GetSection("Resources").Get<ResourcesFolder>()!;
            Resources.Projects = Path.Combine(Resources.Main, Resources.Projects);
            Resources.ProjectNotes = Path.Combine(Resources.Projects, Resources.ProjectNotes);
            Resources.SupportingDocs = Path.Combine(Resources.Projects, Resources.SupportingDocs);
            KafkaConfigs = config.GetSection("Kafka").Get<KafkaConfig>()!;
        }
    }
}
