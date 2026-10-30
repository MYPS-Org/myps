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
        public string Login { get; set; } = string.Empty;
        public string Host { get; set; } = string.Empty;
        public string userName { get; set; } = string.Empty;
        public string password { get; set; } = string.Empty;
        /// <summary>
        /// Local dev escape hatch: skip the PIS password check during login.
        /// Only honoured when the environment is Development. Defaults to false,
        /// so leaving it out of appsettings keeps the normal PIS round trip.
        /// </summary>
        public bool BypassLogin { get; set; } = false;
        /// <summary>
        /// Turns PIS off: no request is sent to it at all. For hosts that must never contact
        /// DPWH's PIS, such as the MonsterASP test site; sign-in there uses <see cref="LocalLoginConfig"/>.
        /// </summary>
        public bool Disabled { get; set; } = false;
    }
    /// <summary>
    /// Sign-in against password hashes kept in this host's settings instead of PIS. Off unless
    /// "LocalLogin:Enabled" is true. Make each hash with <see cref="LocalPassword.Hash"/>.
    /// </summary>
    public class LocalLoginConfig
    {
        public bool Enabled { get; set; } = false;
        /// <summary>User ID (as in vUsers) to password hash.</summary>
        public Dictionary<string, string> Users { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }
    /// <summary>
    /// Limits sign-in to computers under the organization domain (2026-10-31). Off unless
    /// "SignIn:AllowedHostDomains" lists at least one domain, e.g. ["dpwh.gov.ph"]: sign-in is then
    /// refused when the client IP's reverse-DNS name does not end with one of them. Before, a
    /// per-request "Invalid hostname" check promised this, but sign-in stored the User ID when the
    /// lookup failed, so the name was never empty and the check never refused anyone.
    /// </summary>
    public class SignInConfig
    {
        public string[] AllowedHostDomains { get; set; } = [];

        public bool Restricted => AllowedHostDomains.Any(d => !string.IsNullOrWhiteSpace(d));

        /// <summary>True when unrestricted, or when <paramref name="hostName"/> is one of the domains or under one.</summary>
        public bool Allows(string? hostName)
        {
            if (!Restricted) return true;
            string host = (hostName ?? string.Empty).Trim().TrimEnd('.');
            if (host.Length == 0) return false;
            return AllowedHostDomains
                .Select(d => (d ?? string.Empty).Trim().Trim('.'))
                .Where(d => d.Length > 0)
                .Any(d => host.Equals(d, StringComparison.OrdinalIgnoreCase)
                       || host.EndsWith("." + d, StringComparison.OrdinalIgnoreCase));
        }
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
        public string Internal { get; set; } = string.Empty;
        public string UploadedFiles { get; set; } = string.Empty;
        public string Projects { get; set; } = string.Empty;
        public string ProjectNotes { get; set; } = string.Empty;
        public string SupportingDocs { get; set; } = string.Empty;
        public RevisionFolder Revision { get; set; } = new RevisionFolder();
        public string Images { get; set; } = string.Empty;
        public string SQLScripts { get; set; } = string.Empty;
        /// <summary>CREATE OR ALTER functions/views/procedures applied by <c>Main --apply-sql-objects</c>. Defaults so no appsettings key is required.</summary>
        public string SQLObjects { get; set; } = "SQLObjects";
        public string Template { get; set; } = string.Empty;
    }
    public class RevisionFolder
    {
        public string RevisionsMain { get; set; } = string.Empty;
        public string CentralOffice { get; set; } = string.Empty;
        public string ImplementingOffice { get; set; } = string.Empty;
    }
    public class KafkaConfig
    {
        public string KafkaServer { get; set; } = string.Empty;
    }
    public class SMTPClass
    {
        public static string DisplayName { get; set; } = string.Empty;
        public static string To { get; set; } = string.Empty;
        public static string FROM { get; set; } = string.Empty;
        public static string SMTP { get; set; } = string.Empty;
        public static int PORT { get; set; }
        public static bool SSL { get; set; }
        public static int TimeOut { get; set; }
        public static string Username { get; set; } = string.Empty;
        public static string Password { get; set; } = string.Empty;
        public static string PathEmailTemplate { get; set; } = string.Empty;
    }
    public class DatabaseConnections
    {
        public string MYPSDb { get; set; } = string.Empty;
        public string PCMADb { get; set; } = string.Empty;
    }
    public static class Appsetting
    {
        public static string Environment { get; set; } = "Development";
        public static string MachineName { get; set; } = System.Environment.MachineName;
        public static string AppName { get; } = "MYPS";
        public static LDAPConfig LDAP { get; set; } = new LDAPConfig();
        public static PISConfig PIS { get; set; } = new PISConfig();
        public static LocalLoginConfig LocalLogin { get; set; } = new LocalLoginConfig();
        public static SignInConfig SignIn { get; set; } = new SignInConfig();
        public static MYPSToPCMA PCMA { get; set; } = new MYPSToPCMA();
        public static string WebRootPath { get; set; } = string.Empty;
        public static string RootPath { get; set; } = string.Empty;
        public static ResourcesFolder Resources { get; set; } = new ResourcesFolder();
        public static KafkaConfig KafkaConfigs { get; set; } = new KafkaConfig();
        public static SMTPClass SMTP { get; set; } = new SMTPClass();
        public static DatabaseConnections DbConnections { get; set; } = new DatabaseConnections();
        public static void PrepareAppsettings(IConfiguration config)
        {
            DbConnections = config.GetSection("ConnectionStrings").Get<DatabaseConnections>()!;
            LDAP = config.GetSection("LDAP").Get<LDAPConfig>()!;
            PIS = config.GetSection("PIS").Get<PISConfig>()!;
            LocalLogin = config.GetSection("LocalLogin").Get<LocalLoginConfig>() ?? new LocalLoginConfig();
            LocalLogin.Users = new Dictionary<string, string>(LocalLogin.Users, StringComparer.OrdinalIgnoreCase);
            SignIn = config.GetSection("SignIn").Get<SignInConfig>() ?? new SignInConfig();
            PCMA = config.GetSection("MYPSToPCMA").Get<MYPSToPCMA>()!;
            Resources = config.GetSection("Resources").Get<ResourcesFolder>()!;
            Resources.Internal = Path.Combine(Resources.Main, Resources.Internal);
            Resources.UploadedFiles = Path.Combine(Resources.Main, Resources.UploadedFiles);
            Resources.Projects = Path.Combine(Resources.UploadedFiles, Resources.Projects);
            Resources.ProjectNotes = Path.Combine(Resources.Projects, Resources.ProjectNotes);
            Resources.SupportingDocs = Path.Combine(Resources.Projects, Resources.SupportingDocs);
            Resources.Revision.RevisionsMain = Path.Combine(Resources.UploadedFiles, Resources.Revision.RevisionsMain);
            Resources.Revision.CentralOffice = Path.Combine(Resources.Revision.RevisionsMain, Resources.Revision.CentralOffice);
            Resources.Revision.ImplementingOffice = Path.Combine(Resources.Revision.RevisionsMain, Resources.Revision.ImplementingOffice);
            Resources.Images = Path.Combine(Resources.Internal, Resources.Images);
            Resources.SQLScripts = Path.Combine(Resources.Internal, Resources.SQLScripts);
            Resources.SQLObjects = Path.Combine(Resources.Internal, Resources.SQLObjects);
            Resources.Template = Path.Combine(Resources.Internal, Resources.Template);
            KafkaConfigs = config.GetSection("Kafka").Get<KafkaConfig>()!;
            SMTP = config.GetSection("SMTP").Get<SMTPClass>()!;
        }
    }
}
