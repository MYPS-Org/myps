using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Helpers
{
    /// <summary>
    /// Whether the database carries the deletion objects THIS build needs (dbo.fProjectDeletionTier,
    /// dbo.fProgramDeletionEligibility, dbo.pExecuteProjectDeletion, dbo.pExecuteProgramDeletion,
    /// in the version that matches this code). The delete endpoints answer 503 while it is not,
    /// instead of failing with a 500 on first use; the rest of the API is unaffected.
    /// </summary>
    public interface IDeletionObjectsStatus
    {
        /// <summary>True once the objects are present and current. While not ready, re-checks the
        /// database at most every <see cref="DeletionObjectsStatus.RecheckInterval"/>, so applying
        /// the objects (Main.exe --apply-sql-objects --yes) recovers without restarting the API.</summary>
        Task<bool> EnsureReadyAsync(CancellationToken ct = default);

        /// <summary>What is missing, when not ready (for the log and the 503 message).</summary>
        string? Problem { get; }
    }

    public sealed class DeletionObjectsStatus : IDeletionObjectsStatus
    {
        public static readonly TimeSpan RecheckInterval = TimeSpan.FromSeconds(30);

        /// <summary>Result columns this build reads from each function. A function missing one is an
        /// older deployment (e.g. the 2026-10-14 version has no Kind/Reason/ProgramApproved).</summary>
        public static readonly IReadOnlyDictionary<string, string[]> RequiredFunctionColumns = new Dictionary<string, string[]>
        {
            ["fProjectDeletionTier"] = new[] { "Ref", "ProjectFK", "ProgramFK", "MatchedBy", "Kind", "IsPublished", "IsRevised", "StageCount", "ProgramApproved", "Tier", "Reason" },
            ["fProgramDeletionEligibility"] = new[] { "ProgramFK", "StageCount", "CurrentStatus", "Eligibility", "Reason" },
        };

        /// <summary>Procedures this build calls, and a marker their current version contains: the
        /// 'DELETE_REFUSED:' token the wrappers turn into DeletionRefusedException.</summary>
        public static readonly IReadOnlyList<string> RequiredProcedures = new[] { "pExecuteProjectDeletion", "pExecuteProgramDeletion" };
        public const string ProcedureMarker = "DELETE_REFUSED:";

        private readonly string _connectionString;
        private readonly ILogger<DeletionObjectsStatus>? _logger;
        private readonly TimeSpan _recheckInterval;
        private readonly SemaphoreSlim _gate = new(1, 1);
        private DateTime _lastCheckUtc = DateTime.MinValue;
        private volatile bool _ready;

        public DeletionObjectsStatus(string connectionString, ILogger<DeletionObjectsStatus>? logger = null, TimeSpan? recheckInterval = null)
        {
            _connectionString = connectionString;
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
                    problem = await ProbeAsync(_connectionString, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    problem = $"could not check the database ({ex.Message})";
                }

                Problem = problem;
                _ready = problem == null;
                if (_ready)
                    _logger?.LogInformation("Deletion database objects are ready.");
                else
                    _logger?.LogError("Deletion database objects are NOT ready: {Problem}. Delete endpoints answer 503 until " +
                                      "`Main.exe --apply-sql-objects --yes` is run on this environment.", problem);
                return _ready;
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>One read-only round trip. Returns null when everything this build needs is there,
        /// otherwise a description of what is missing or out of date.</summary>
        public static async Task<string?> ProbeAsync(string connectionString, CancellationToken ct = default)
        {
            await using var connection = new SqlConnection(connectionString);
            var columns = (await connection.QueryAsync<(string Obj, string Col)>(new CommandDefinition("""
                SELECT o.name, c.name
                FROM sys.objects o
                JOIN sys.columns c ON c.object_id = o.object_id
                WHERE o.schema_id = SCHEMA_ID('dbo') AND o.name IN ('fProjectDeletionTier', 'fProgramDeletionEligibility')
                """, cancellationToken: ct))).ToList();
            var procedures = (await connection.QueryAsync<(string Name, string? Definition)>(new CommandDefinition("""
                SELECT o.name, OBJECT_DEFINITION(o.object_id)
                FROM sys.objects o
                WHERE o.schema_id = SCHEMA_ID('dbo') AND o.type = 'P' AND o.name IN ('pExecuteProjectDeletion', 'pExecuteProgramDeletion')
                """, cancellationToken: ct))).ToList();
            int compatibility = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CAST(compatibility_level AS INT) FROM sys.databases WHERE database_id = DB_ID();", cancellationToken: ct));

            var problems = new List<string>();
            foreach (var (function, required) in RequiredFunctionColumns)
            {
                var present = columns.Where(c => c.Obj == function).Select(c => c.Col).ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (present.Count == 0) { problems.Add($"dbo.{function} is missing"); continue; }
                var missing = required.Where(r => !present.Contains(r)).ToList();
                if (missing.Count > 0) problems.Add($"dbo.{function} is an older version (no {string.Join(", ", missing)})");
            }
            foreach (string procedure in RequiredProcedures)
            {
                var found = procedures.FirstOrDefault(p => p.Name == procedure);
                if (found.Name == null) problems.Add($"dbo.{procedure} is missing");
                else if (found.Definition?.Contains(ProcedureMarker, StringComparison.Ordinal) != true)
                    problems.Add($"dbo.{procedure} is an older version");
            }
            if (compatibility < 130) problems.Add($"compatibility level {compatibility} is below 130");

            return problems.Count == 0 ? null : string.Join("; ", problems);
        }
    }
}
