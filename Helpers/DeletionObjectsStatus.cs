using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Helpers
{
    /// <summary>
    /// Whether this build's deletion feature can actually run right now: the 4 .sql script
    /// files it reads at request time (Main/Resources/Internal/SQLScripts/Deletion/) are present
    /// on disk, and the target database is reachable and new enough for the syntax they use
    /// (FOR JSON PATH needs compatibility level >= 130). The delete endpoints answer 503 while
    /// either is not true, instead of failing with a 500 on first use; the rest of the API is
    /// unaffected.
    ///
    /// RUNTIME SCRIPT ARCHITECTURE (2026-10-16): this feature no longer deploys compiled
    /// dbo.fProjectDeletionTier / dbo.fProgramDeletionEligibility / dbo.pExecuteProjectDeletion /
    /// dbo.pExecuteProgramDeletion objects into the database at all -- ISqlExecutor.
    /// ExecuteScriptFile*InTransactionAsync reads and runs the .sql files directly on every
    /// call (see Helpers/ProjectHelper.cs, Helpers/ProgramHelper.cs). This removes the entire
    /// class of "deployed version does not match this build's code" problem the OLD version of
    /// this class existed to detect (RequiredFunctionColumns / ProcedureMarker, checking
    /// sys.objects/sys.columns for a stale CREATE FUNCTION/PROCEDURE) -- there is no separate
    /// deploy step left to drift out of sync with the code, so that whole check is gone, not
    /// just disabled. What is still a real, independent failure mode -- a missing file (a bad
    /// publish, a stripped Docker image layer, a misconfigured Resources path) or an
    /// unreachable/too-old database -- is what this class now actually checks.
    /// </summary>
    public interface IDeletionObjectsStatus
    {
        /// <summary>True once the scripts are present on disk and the database is reachable and
        /// new enough. While not ready, re-checks at most every
        /// <see cref="DeletionObjectsStatus.RecheckInterval"/>, so fixing a missing file or a
        /// database outage recovers without restarting the API.</summary>
        Task<bool> EnsureReadyAsync(CancellationToken ct = default);

        /// <summary>What is missing, when not ready (for the log and the 503 message).</summary>
        string? Problem { get; }
    }

    public sealed class DeletionObjectsStatus : IDeletionObjectsStatus
    {
        public static readonly TimeSpan RecheckInterval = TimeSpan.FromSeconds(30);

        /// <summary>The 4 script files this build's deletion feature reads at request time, relative
        /// to Appsetting.Resources.SQLScripts. A missing one means the feature cannot run at all.</summary>
        public static readonly IReadOnlyList<string> RequiredScriptFiles = new[]
        {
            "Deletion/Functions/GetProjectDeletionTier.sql",
            "Deletion/Functions/GetProgramDeletionEligibility.sql",
            "Deletion/Stored Procedures/ExecuteProjectDeletion.sql",
            "Deletion/Stored Procedures/ExecuteProgramDeletion.sql",
        };

        /// <summary>The scripts use FOR JSON PATH for their audit-log snapshots (SQL Server 2016 /
        /// compatibility level 130+).</summary>
        public const int MinimumCompatibilityLevel = 130;

        private readonly string _connectionString;
        private readonly string _sqlScriptsPath;
        private readonly ILogger<DeletionObjectsStatus>? _logger;
        private readonly TimeSpan _recheckInterval;
        private readonly SemaphoreSlim _gate = new(1, 1);
        private DateTime _lastCheckUtc = DateTime.MinValue;
        private volatile bool _ready;

        public DeletionObjectsStatus(string connectionString, ILogger<DeletionObjectsStatus>? logger = null, TimeSpan? recheckInterval = null)
            : this(connectionString, Appsetting.Resources.SQLScripts, logger, recheckInterval)
        {
        }

        /// <summary>Overload taking the scripts root explicitly, for tests that do not rely on the
        /// static Appsetting configuration having been set.</summary>
        public DeletionObjectsStatus(string connectionString, string sqlScriptsPath, ILogger<DeletionObjectsStatus>? logger = null, TimeSpan? recheckInterval = null)
        {
            _connectionString = connectionString;
            _sqlScriptsPath = sqlScriptsPath;
            _logger = logger;
            _recheckInterval = recheckInterval ?? RecheckInterval;
        }

        public string? Problem { get; private set; } = "not checked yet";

        public async Task<bool> EnsureReadyAsync(CancellationToken ct = default)
        {
            if (_ready) return true;
            if (DateTime.UtcNow - _lastCheckUtc < _recheckInterval) return false;

            await _gate.WaitAsync(ct);
            try
            {
                if (_ready) return true;
                if (DateTime.UtcNow - _lastCheckUtc < _recheckInterval) return false;
                _lastCheckUtc = DateTime.UtcNow;

                string? problem;
                try
                {
                    problem = await ProbeAsync(_connectionString, _sqlScriptsPath, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    problem = $"could not check readiness ({ex.Message})";
                }

                Problem = problem;
                _ready = problem == null;
                if (_ready)
                    _logger?.LogInformation("Deletion feature is ready (scripts on disk, database reachable).");
                else
                    _logger?.LogError("Deletion feature is NOT ready: {Problem}.", problem);
                return _ready;
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>One check: the 4 script files exist on disk, then one read-only database round
        /// trip for reachability and compatibility level. Returns null when everything this build
        /// needs is there, otherwise a description of what is missing.</summary>
        public static async Task<string?> ProbeAsync(string connectionString, string sqlScriptsPath, CancellationToken ct = default)
        {
            var problems = new List<string>();

            foreach (string relativePath in RequiredScriptFiles)
            {
                string fullPath = Path.Combine(sqlScriptsPath, relativePath);
                if (!File.Exists(fullPath)) problems.Add($"{relativePath} is missing from {sqlScriptsPath}");
            }

            // A missing file already dooms every call; still probe the database so a single
            // EnsureReadyAsync call reports every problem at once, not one at a time.
            try
            {
                await using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync(ct);
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT CAST(compatibility_level AS INT) FROM sys.databases WHERE database_id = DB_ID();";
                command.CommandTimeout = 30;
                object? result = await command.ExecuteScalarAsync(ct);
                int compatibility = result is int i ? i : Convert.ToInt32(result);
                if (compatibility < MinimumCompatibilityLevel)
                    problems.Add($"compatibility level {compatibility} is below {MinimumCompatibilityLevel}");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                problems.Add($"database is not reachable ({ex.Message})");
            }

            return problems.Count == 0 ? null : string.Join("; ", problems);
        }

        /// <summary>Back-compat overload using the statically configured Appsetting.Resources.SQLScripts
        /// (set by Main's startup from appsettings.json) -- for any remaining caller that only has the
        /// connection string at hand.</summary>
        public static Task<string?> ProbeAsync(string connectionString, CancellationToken ct = default)
            => ProbeAsync(connectionString, Appsetting.Resources.SQLScripts, ct);
    }
}
