using Dapper;
using System.Data;
using Microsoft.Data.SqlClient;
namespace Helpers
{
    /// <summary>
    /// Centralized Dapper-based SQL Executor.
    /// Provides async-first data access and file-based SQL execution.
    /// </summary>
    public interface ISqlExecutor
    {
        Task<IEnumerable<T>> QueryAsync<T>(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default);
        Task<int> ExecuteAsync(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default);
        Task<T> ExecuteScalarAsync<T>(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Executes a SQL script file within a managed transaction.
        /// Automatically commits on success and rolls back on exception.
        /// </summary>
        Task<IEnumerable<T>> ExecuteScriptFileInTransactionAsync<T>(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Executes a non-query SQL script file (e.g. migration, DDL, batch update) within a managed transaction.
        /// Automatically commits on success and rolls back on exception.
        /// </summary>
        Task<int> ExecuteScriptFileNonQueryInTransactionAsync(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Reads a SQL script file and runs it as a query on the CALLER's own connection/transaction
        /// (no transaction is opened or committed here — the caller's owns that). Use this to compose
        /// several script-file calls into one caller-level atomic unit, e.g. a delete cascade that must
        /// commit or roll back as a whole across more than one file.
        /// </summary>
        Task<IEnumerable<T>> ExecuteScriptFileInTransactionAsync<T>(string fileName, object? parameters, IDbTransaction tx, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Reads a SQL script file and runs it as a non-query on the CALLER's own connection/transaction
        /// (no transaction is opened or committed here — the caller's owns that). Use this to compose
        /// several script-file calls into one caller-level atomic unit, e.g. a delete cascade that must
        /// commit or roll back as a whole across more than one file.
        /// </summary>
        Task<int> ExecuteScriptFileNonQueryInTransactionAsync(string fileName, object? parameters, IDbTransaction tx, int timeout = 120, CancellationToken ct = default);

        // --- Managed Transactions ---
        /// <summary>
        /// Executes a block of code within a managed database transaction. 
        /// Automatically commits on success and rolls back on exception.
        /// </summary>
        Task<T> ExecuteTransactionAsync<T>(Func<IDbConnection, IDbTransaction, Task<T>> action, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Splits a script on GO (<see cref="SqlBatchSplitter"/>) and runs each batch, in order, on the
        /// caller's connection and transaction. A failing batch throws <see cref="SqlScriptBatchException"/>
        /// naming <paramref name="sourceName"/>, the batch and its start line; the caller's transaction
        /// decides what is rolled back.
        /// </summary>
        Task<int> ExecuteBatchesAsync(string script, IDbConnection connection, IDbTransaction transaction, string sourceName, int timeout = 120, CancellationToken ct = default);
    }

    /// <summary>A batch of a GO-separated script failed; the inner exception is the SQL error.</summary>
    public sealed class SqlScriptBatchException : Exception
    {
        public string SourceName { get; }
        public int BatchIndex { get; }
        public int StartLine { get; }

        public SqlScriptBatchException(string sourceName, SqlBatch batch, Exception inner)
            : base($"{sourceName}: batch {batch.Index} (line {batch.StartLine}) failed: {inner.Message}", inner)
        {
            SourceName = sourceName;
            BatchIndex = batch.Index;
            StartLine = batch.StartLine;
        }
    }

    public class SqlExecutor : ISqlExecutor
    {
        private readonly string _connectionString;
        private readonly string _scriptFileRoot; // Resources/Internal/SQLObjects (2026-10-16): the 4 deletion scripts live here, grouped by object type with the real deployed objects, not a separate SQLScripts/ tree.

        public SqlExecutor(string? connectionString = null)
        {
            _connectionString = connectionString ?? Appsetting.DbConnections.MYPSDb;
            _scriptFileRoot = Appsetting.Resources.SQLObjects;
        }
        public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default)
        {
            if (tx != null)
            {
                return await tx.Connection!.QueryAsync<T>(new CommandDefinition(sql, parameters, tx, commandTimeout: timeout, cancellationToken: ct));
            }
            await using var connection = new SqlConnection(_connectionString);
            return await connection.QueryAsync<T>(new CommandDefinition(sql, parameters, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<int> ExecuteAsync(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default)
        {
            if (tx != null)
            {
                return await tx.Connection!.ExecuteAsync(new CommandDefinition(sql, parameters, tx, commandTimeout: timeout, cancellationToken: ct));
            }
            await using var connection = new SqlConnection(_connectionString);
            return await connection.ExecuteAsync(new CommandDefinition(sql, parameters, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<T> ExecuteScalarAsync<T>(string sql, object? parameters = null, IDbTransaction? tx = null, int timeout = 120, CancellationToken ct = default)
        {
            if (tx != null)
            {
                return await tx.Connection!.ExecuteScalarAsync<T>(new CommandDefinition(sql, parameters, tx, commandTimeout: timeout, cancellationToken: ct));
            }
            await using var connection = new SqlConnection(_connectionString);
            return await connection.ExecuteScalarAsync<T>(new CommandDefinition(sql, parameters, commandTimeout: timeout, cancellationToken: ct));
        }


        public async Task<IEnumerable<T>> ExecuteScriptFileInTransactionAsync<T>(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default)
        {
            string fullPath = Path.Combine(_scriptFileRoot, fileName);
            if (!File.Exists(fullPath)) throw new FileNotFoundException($"SQL Script file not found: {fullPath}");

            string sql = await File.ReadAllTextAsync(fullPath, ct);

            return await ExecuteTransactionAsync(async (connection, transaction) =>
            {
                return await connection.QueryAsync<T>(new CommandDefinition(sql, parameters, transaction, commandTimeout: timeout, cancellationToken: ct));
            }, timeout, ct);
        }

        public async Task<int> ExecuteScriptFileNonQueryInTransactionAsync(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default)
        {
            string fullPath = Path.Combine(_scriptFileRoot, fileName);
            if (!File.Exists(fullPath)) throw new FileNotFoundException($"SQL Script file not found: {fullPath}");

            string sql = await File.ReadAllTextAsync(fullPath, ct);

            return await ExecuteTransactionAsync(async (connection, transaction) =>
            {
                return await connection.ExecuteAsync(new CommandDefinition(sql, parameters, transaction, commandTimeout: timeout, cancellationToken: ct));
            }, timeout, ct);
        }

        public async Task<IEnumerable<T>> ExecuteScriptFileInTransactionAsync<T>(string fileName, object? parameters, IDbTransaction tx, int timeout = 120, CancellationToken ct = default)
        {
            if (tx?.Connection == null) throw new ArgumentNullException(nameof(tx), "A live transaction with an open connection is required.");

            string fullPath = Path.Combine(_scriptFileRoot, fileName);
            if (!File.Exists(fullPath)) throw new FileNotFoundException($"SQL Script file not found: {fullPath}");

            string sql = await File.ReadAllTextAsync(fullPath, ct);

            return await tx.Connection.QueryAsync<T>(new CommandDefinition(sql, parameters, tx, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<int> ExecuteScriptFileNonQueryInTransactionAsync(string fileName, object? parameters, IDbTransaction tx, int timeout = 120, CancellationToken ct = default)
        {
            if (tx?.Connection == null) throw new ArgumentNullException(nameof(tx), "A live transaction with an open connection is required.");

            string fullPath = Path.Combine(_scriptFileRoot, fileName);
            if (!File.Exists(fullPath)) throw new FileNotFoundException($"SQL Script file not found: {fullPath}");

            string sql = await File.ReadAllTextAsync(fullPath, ct);

            return await tx.Connection.ExecuteAsync(new CommandDefinition(sql, parameters, tx, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<T> ExecuteTransactionAsync<T>(Func<IDbConnection, IDbTransaction, Task<T>> action, int timeout = 120, CancellationToken ct = default)
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(ct);
            using var transaction = connection.BeginTransaction();
            try
            {
                var result = await action(connection, transaction);
                transaction.Commit();
                return result;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task<int> ExecuteBatchesAsync(string script, IDbConnection connection, IDbTransaction transaction, string sourceName, int timeout = 120, CancellationToken ct = default)
        {
            int executed = 0;
            foreach (SqlBatch batch in SqlBatchSplitter.Split(script))
            {
                for (int run = 0; run < batch.Repeat; run++)
                {
                    try
                    {
                        await connection.ExecuteAsync(new CommandDefinition(batch.Text, transaction: transaction, commandTimeout: timeout, cancellationToken: ct));
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        throw new SqlScriptBatchException(sourceName, batch, ex);
                    }
                    executed++;
                }
            }
            return executed;
        }
    }
}

/*
HOW TO USE:

1. Registration (Startup.cs / Program.cs):
   services.AddSingleton<ISqlExecutor, SqlExecutor>();

2. Dependency Injection:
   public class MyService
   {
       private readonly ISqlExecutor _sql;
       public MyService(ISqlExecutor sql) => _sql = sql;

       public async Task RunExamples()
       {
           // A. Standard Async Query (Read-only)
           var data = await _sql.QueryAsync<MyDto>("SELECT * FROM Table WHERE Id = @Id", new { Id = 1 });

           // B. Managed Transaction (Data Modification)
           // ⚠️ IMPORTANT: For all data-modifying operations (INSERT, UPDATE, DELETE),
           // ALWAYS use ExecuteTransactionAsync to ensure atomicity and automatic rollback on failure.
           var success = await _sql.ExecuteTransactionAsync(async (conn, tx) => 
           {
               await conn.ExecuteAsync("INSERT INTO Logs (Msg) VALUES (@Msg)", new { Msg = "Start" }, tx);
               await conn.ExecuteAsync("UPDATE Status SET Val = 1 WHERE Id = @Id", new { Id = 1 }, tx);
               return true; // Commits automatically on success
           });

           // C. Executing SQL Files (from Resources/SQLScripts/)
           // Execute as a query (returning results)
           var results = await _sql.ExecuteScriptFileAsync<ProjectDto>("GetProjects.sql", new { Status = "Active" });
           
           // Execute migration/DDL in a managed transaction (Data Modification)
           await _sql.ExecuteScriptFileNonQueryInTransactionAsync("Migration.Script.sql");
       }
   }

3. Using a Custom Database Connection:
   // If you need to query a different database (e.g., PCMA) on the fly:
   var pcmaExecutor = new SqlExecutor(Appsetting.DbConnections.PCMADb);
   var pcmaData = await pcmaExecutor.QueryAsync<MyDto>("SELECT * FROM PCMA_Table");
*/
