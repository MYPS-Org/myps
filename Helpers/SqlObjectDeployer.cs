using Dapper;
using Microsoft.Data.SqlClient;

namespace Helpers
{
    /// <summary>
    /// Applies the CREATE OR ALTER files under Resources/Internal/SQLObjects to MYPSDb through Dapper.
    ///
    /// Run deliberately, never on app start: <c>Main.exe --apply-sql-objects</c> prints the target
    /// server/database and the files it would apply and changes nothing; adding <c>--yes</c> applies
    /// them. All files go in ONE transaction (SQL Server DDL is transactional), so a failing batch
    /// leaves every object as it was. An exclusive app lock makes a second concurrent run fail fast.
    ///
    /// Order: Functions, Views, Stored Procedures, each by file name. An optional order.txt in the
    /// root lists relative paths to apply first, for when a dependency needs a different order
    /// (a function, unlike a procedure, needs the objects it references to exist already).
    /// Tables/ and the DDL template are never applied.
    ///
    /// NOT every .sql file under Functions/Views/Stored Procedures is deployed (2026-10-16): some
    /// (e.g. the project/program deletion scripts) are plain parameterized scripts run directly by
    /// ISqlExecutor.ExecuteScriptFile*InTransactionAsync at request time, grouped into the same
    /// folders for discoverability/convention but never CREATE OR ALTER DDL. Discover() skips
    /// any file with no CREATE [OR ALTER] FUNCTION/VIEW/PROCEDURE batch (<see cref="IsDeployableObject"/>), so
    /// running --apply-sql-objects --yes can never try to execute one as a bare, unparameterized
    /// query/cascade; the run lists what it skipped (<see cref="DiscoverRuntimeScripts"/>). With
    /// nothing to deploy (the case today) it says so, checks only the compatibility level the
    /// runtime scripts need, and demands no DDL rights.
    /// </summary>
    public sealed class SqlObjectDeployer
    {
        public const string CommandFlag = "--apply-sql-objects";
        public const string ConfirmFlag = "--yes";
        public const string OrderFileName = "order.txt";
        public static readonly IReadOnlyList<string> Folders = new[] { "Functions", "Views", "Stored Procedures" };

        private const string LockResource = "MYPS_SqlObjectDeploy";
        private const int TimeoutSeconds = 600;

        private readonly ISqlExecutor _sql;
        private readonly string _connectionString;

        /// <param name="sql">Executor bound to <paramref name="connectionString"/>.</param>
        /// <param name="connectionString">Used to report the target server/database; must be the executor's.</param>
        public SqlObjectDeployer(ISqlExecutor sql, string connectionString)
        {
            _sql = sql;
            _connectionString = connectionString;
        }

        /// <summary>Entry point for <c>Main --apply-sql-objects [--yes]</c>; returns the process exit code.</summary>
        public static async Task<int> RunCommandAsync(string[] args, TextWriter log, CancellationToken ct = default)
        {
            try
            {
                string connectionString = Appsetting.DbConnections?.MYPSDb ?? string.Empty;
                if (string.IsNullOrWhiteSpace(connectionString))
                    throw new InvalidOperationException("ConnectionStrings:MYPSDb is not configured for this environment.");

                log.WriteLine($"Environment: {Appsetting.Environment}");
                var deployer = new SqlObjectDeployer(new SqlExecutor(connectionString), connectionString);
                await deployer.ApplyAsync(Appsetting.Resources.SQLObjects, args.Contains(ConfirmFlag), log, ct);
                return 0;
            }
            catch (Exception ex)
            {
                log.WriteLine($"FAILED: {ex.Message}");
                log.WriteLine("Nothing was committed.");
                return 1;
            }
        }

        /// <summary>
        /// Lists, and when <paramref name="execute"/> is true applies, every object file under
        /// <paramref name="rootDir"/>. Returns the relative paths in the order they were (or would be)
        /// applied. Throws on any failure, after the transaction has rolled back.
        /// </summary>
        public async Task<IReadOnlyList<string>> ApplyAsync(string rootDir, bool execute, TextWriter log, CancellationToken ct = default)
        {
            string root = ResolveRoot(rootDir);
            IReadOnlyList<string> files = Discover(root);
            var target = new SqlConnectionStringBuilder(_connectionString);

            log.WriteLine($"SQLObjects {(execute ? "APPLY" : "DRY RUN")} -> server '{target.DataSource}', database '{target.InitialCatalog}'");
            log.WriteLine($"Source: {root}");

            var scripts = new List<(string File, string Script)>();
            foreach (string file in files)
            {
                string script = await File.ReadAllTextAsync(Path.Combine(root, file), ct);
                scripts.Add((file, script));
                log.WriteLine($"  {scripts.Count,2}. {file} ({SqlBatchSplitter.Split(script).Count} batch(es))");
            }

            IReadOnlyList<string> runtimeScripts = DiscoverRuntimeScripts(root);
            if (runtimeScripts.Count > 0)
            {
                log.WriteLine("Skipped (runtime scripts the API reads at request time; never deployed):");
                foreach (string file in runtimeScripts)
                    log.WriteLine($"   - {file}");
            }

            // Read-only; runs in the dry run too, so the dry run says whether --yes would work.
            await PreflightAsync(log, ct, deploying: files.Count > 0);

            if (files.Count == 0)
            {
                log.WriteLine("Nothing to deploy: no CREATE OR ALTER object files here. Nothing executed.");
                return files;
            }

            if (!execute)
            {
                log.WriteLine($"Dry run: nothing executed. Re-run with {CommandFlag} {ConfirmFlag} to apply.");
                return files;
            }

            await _sql.ExecuteTransactionAsync(async (connection, transaction) =>
            {
                int lockResult = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
                    "DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @Resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0; SELECT @r;",
                    new { Resource = LockResource }, transaction, TimeoutSeconds, cancellationToken: ct));
                if (lockResult < 0)
                    throw new InvalidOperationException($"Another {CommandFlag} run holds the deploy lock (sp_getapplock returned {lockResult}).");

                foreach (var (file, script) in scripts)
                {
                    int batches = await _sql.ExecuteBatchesAsync(script, connection, transaction, file, TimeoutSeconds, ct);
                    log.WriteLine($"  applied {file} ({batches} batch(es))");
                }
                return scripts.Count;
            }, TimeoutSeconds, ct);

            log.WriteLine($"Committed {scripts.Count} file(s).");
            return files;
        }

        /// <summary>The database facts <see cref="PreflightAsync"/> checks.</summary>
        public sealed class PreflightResult
        {
            public int CompatibilityLevel { get; set; }
            public int ProductMajorVersion { get; set; }
            public bool CanCreateFunction { get; set; }
            public bool CanCreateProcedure { get; set; }
            public bool CanCreateView { get; set; }
            public bool CanAlterDbo { get; set; }
        }

        /// <summary>
        /// Read-only checks that the target can take the objects, printed as a checklist. Throws
        /// (nothing applied) if any fails:
        ///   compatibility level >= 130   — FOR JSON / OPENJSON, used by the runtime deletion
        ///   scripts and the permission migration; checked even when there is nothing to deploy.
        /// Only when <paramref name="deploying"/> (there are object files to apply):
        ///   SQL Server 2017+ (major >= 14) — STRING_AGG and CREATE OR ALTER;
        ///   CREATE FUNCTION / PROCEDURE / VIEW on the database and ALTER on schema dbo — the
        ///   login the command runs as must be able to CREATE OR ALTER the objects.
        /// </summary>
        public async Task<PreflightResult> PreflightAsync(TextWriter log, CancellationToken ct = default, bool deploying = true)
        {
            var result = (await _sql.QueryAsync<PreflightResult>("""
                SELECT
                    (SELECT CAST(compatibility_level AS INT) FROM sys.databases WHERE database_id = DB_ID()) AS CompatibilityLevel,
                    CAST(SERVERPROPERTY('ProductMajorVersion') AS INT) AS ProductMajorVersion,
                    CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE FUNCTION'), 0) AS BIT) AS CanCreateFunction,
                    CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE PROCEDURE'), 0) AS BIT) AS CanCreateProcedure,
                    CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE VIEW'), 0) AS BIT) AS CanCreateView,
                    CAST(ISNULL(HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER'), 0) AS BIT) AS CanAlterDbo;
                """, ct: ct)).Single();

            var checks = new List<(bool Ok, string Text)>
            {
                (result.CompatibilityLevel >= 130, $"compatibility level {result.CompatibilityLevel} (need >= 130 for FOR JSON / OPENJSON)"),
            };
            if (deploying)
            {
                checks.AddRange(new (bool Ok, string Text)[]
                {
                    (result.ProductMajorVersion >= 14, $"SQL Server major version {result.ProductMajorVersion} (need >= 14 / 2017 for STRING_AGG)"),
                    (result.CanCreateFunction, "permission: CREATE FUNCTION"),
                    (result.CanCreateProcedure, "permission: CREATE PROCEDURE"),
                    (result.CanCreateView, "permission: CREATE VIEW"),
                    (result.CanAlterDbo, "permission: ALTER on schema dbo"),
                });
            }

            log.WriteLine("Preflight:");
            foreach (var (ok, text) in checks)
                log.WriteLine($"  [{(ok ? "ok" : "FAIL")}] {text}");

            var failed = checks.Where(c => !c.Ok).Select(c => c.Text).ToList();
            if (failed.Count > 0)
                throw new InvalidOperationException(
                    $"Preflight failed, nothing applied: {string.Join("; ", failed)}. " +
                    "Fix the database setting, or run the command once with a login that has these rights.");
            return result;
        }

        // CREATE [OR ALTER] or ALTER of a programmable object only: a runtime script that opens
        // with CREATE TABLE #work or CREATE INDEX is still a runtime script, never deployed.
        private static readonly System.Text.RegularExpressions.Regex ObjectDdl = new(
            @"^(CREATE(\s+OR\s+ALTER)?|ALTER)\s+(FUNCTION|VIEW|PROCEDURE|PROC|TRIGGER)\b",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

        /// <summary>
        /// True when any batch of <paramref name="script"/> (per <see cref="SqlBatchSplitter"/>, which
        /// already tracks comments/strings correctly) is, once its own leading comments and whitespace
        /// are stripped, CREATE [OR ALTER] or ALTER of a FUNCTION/VIEW/PROCEDURE/TRIGGER. A real object file's DDL
        /// batch may follow a separate `SET QUOTED_IDENTIFIER ON; GO` batch, so every batch is checked,
        /// not just the first. A plain parameterized script (a SELECT/DELETE/UPDATE body meant for
        /// ISqlExecutor.ExecuteScriptFile*InTransactionAsync, not this deployer) has no such batch and
        /// is reported false, so <see cref="Discover"/> skips it -- even when it opens with
        /// CREATE TABLE #work.
        /// </summary>
        public static bool IsDeployableObject(string script)
        {
            foreach (SqlBatch batch in SqlBatchSplitter.Split(script))
            {
                string stripped = StripLeadingComments(batch.Text).TrimStart();
                if (ObjectDdl.IsMatch(stripped)) return true;
            }
            return false;
        }

        /// <summary>Removes leading whitespace, `--` line comments and `/* ... */` block comments
        /// (nested, as SQL Server nests them) from the START of <paramref name="text"/> only -- stops at
        /// the first token that is neither, which is exactly what a DDL check needs: "is the first real
        /// statement a CREATE".</summary>
        private static string StripLeadingComments(string text)
        {
            int i = 0;
            while (i < text.Length)
            {
                if (char.IsWhiteSpace(text[i])) { i++; continue; }
                if (i + 1 < text.Length && text[i] == '-' && text[i + 1] == '-')
                {
                    int newline = text.IndexOf('\n', i);
                    if (newline < 0) return string.Empty;
                    i = newline + 1;
                    continue;
                }
                if (i + 1 < text.Length && text[i] == '/' && text[i + 1] == '*')
                {
                    int depth = 1;
                    i += 2;
                    while (i < text.Length && depth > 0)
                    {
                        if (i + 1 < text.Length && text[i] == '/' && text[i + 1] == '*') { depth++; i += 2; }
                        else if (i + 1 < text.Length && text[i] == '*' && text[i + 1] == '/') { depth--; i += 2; }
                        else i++;
                    }
                    continue;
                }
                break;
            }
            return text[i..];
        }

        /// <summary>The object files under <paramref name="root"/>, relative and '/'-separated, in apply
        /// order. Only files that are actually CREATE OR ALTER DDL (<see cref="IsDeployableObject"/>) --
        /// a plain parameterized script grouped into these folders for convention is skipped (and
        /// listed by <see cref="DiscoverRuntimeScripts"/>), never attempted as a bare query.</summary>
        public static IReadOnlyList<string> Discover(string root)
        {
            var byFolder = new List<string>();
            foreach (string folder in Folders)
            {
                string dir = Path.Combine(root, folder);
                if (!Directory.Exists(dir)) continue;
                byFolder.AddRange(Directory.EnumerateFiles(dir, "*.sql", SearchOption.TopDirectoryOnly)
                    .Where(path => IsDeployableObject(File.ReadAllText(path)))
                    .Select(path => $"{folder}/{Path.GetFileName(path)}")
                    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase));
            }

            string orderFile = Path.Combine(root, OrderFileName);
            if (!File.Exists(orderFile)) return byFolder;

            var ordered = new List<string>();
            foreach (string raw in File.ReadAllLines(orderFile))
            {
                string line = raw.Trim();
                if (line.Length == 0 || line.StartsWith('#')) continue;
                string normalized = line.Replace('\\', '/');
                string? match = byFolder.FirstOrDefault(f => string.Equals(f, normalized, StringComparison.OrdinalIgnoreCase));
                if (match is null)
                    throw new InvalidOperationException($"{OrderFileName} lists '{line}', which is not an object file under {string.Join(", ", Folders)}.");
                if (!ordered.Contains(match)) ordered.Add(match);
            }
            ordered.AddRange(byFolder.Where(f => !ordered.Contains(f)));
            return ordered;
        }

        /// <summary>The .sql files under the object folders that are NOT deployable objects (no CREATE
        /// batch): runtime scripts the API reads at request time. Listed by the command so a skipped
        /// file is never silent.</summary>
        public static IReadOnlyList<string> DiscoverRuntimeScripts(string root)
        {
            var skipped = new List<string>();
            foreach (string folder in Folders)
            {
                string dir = Path.Combine(root, folder);
                if (!Directory.Exists(dir)) continue;
                skipped.AddRange(Directory.EnumerateFiles(dir, "*.sql", SearchOption.TopDirectoryOnly)
                    .Where(path => !IsDeployableObject(File.ReadAllText(path)))
                    .Select(path => $"{folder}/{Path.GetFileName(path)}")
                    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase));
            }
            return skipped;
        }

        /// <summary>A relative root resolves against the working directory, then the app's own folder.</summary>
        private static string ResolveRoot(string rootDir)
        {
            string[] candidates = Path.IsPathRooted(rootDir)
                ? new[] { rootDir }
                : new[] { Path.GetFullPath(rootDir), Path.Combine(AppContext.BaseDirectory, rootDir) };

            return candidates.FirstOrDefault(Directory.Exists)
                ?? throw new DirectoryNotFoundException($"SQLObjects folder not found: {string.Join(" or ", candidates)}");
        }
    }
}
