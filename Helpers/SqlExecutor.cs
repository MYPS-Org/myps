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
        Task<IEnumerable<T>> QueryAsync<T>(string sql, object? parameters = null, CommandType commandType = CommandType.Text, int timeout = 120, CancellationToken ct = default);
        Task<int> ExecuteAsync(string sql, object? parameters = null, CommandType commandType = CommandType.Text, int timeout = 120, CancellationToken ct = default);

        /// <summary>
        /// Executes a SQL script file located in the configured Resources:SQLScripts path.
        /// </summary>
        Task<IEnumerable<T>> ExecuteScriptFileAsync<T>(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default);
    }

    public class SqlExecutor : ISqlExecutor
    {
        private readonly string _connectionString;
        private readonly string _sqlScriptsPath;

        public SqlExecutor(string? connectionString = null)
        {
            _connectionString = connectionString ?? Appsetting.DbConnections.MYPSDb;
            _sqlScriptsPath = Appsetting.Resources.SQLScripts;
        }

        public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? parameters = null, CommandType commandType = CommandType.Text, int timeout = 120, CancellationToken ct = default)
        {
            await using var connection = new SqlConnection(_connectionString);
            return await connection.QueryAsync<T>(new CommandDefinition(sql, parameters, commandType: commandType, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<int> ExecuteAsync(string sql, object? parameters = null, CommandType commandType = CommandType.Text, int timeout = 120, CancellationToken ct = default)
        {
            await using var connection = new SqlConnection(_connectionString);
            return await connection.ExecuteAsync(new CommandDefinition(sql, parameters, commandType: commandType, commandTimeout: timeout, cancellationToken: ct));
        }

        public async Task<IEnumerable<T>> ExecuteScriptFileAsync<T>(string fileName, object? parameters = null, int timeout = 120, CancellationToken ct = default)
        {
            string fullPath = Path.Combine(_sqlScriptsPath, fileName);
            if (!File.Exists(fullPath)) throw new FileNotFoundException($"SQL Script file not found: {fullPath}");

            string sql = await File.ReadAllTextAsync(fullPath, ct);
            return await QueryAsync<T>(sql, parameters, CommandType.Text, timeout, ct);
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
           // A. Standard Async Query (Uses MYPSDb by default)
           var data = await _sql.QueryAsync<MyDto>("SELECT * FROM Table WHERE Id = @Id", new { Id = 1 });

           // B. Executing from file (Look inside Resources/SQLScripts/)
           // Dynamic parameters are passed via anonymous objects.
           // Dapper automatically maps properties (e.g., @Status) to your anonymous object properties:
           var results = await _sql.ExecuteScriptFileAsync<ProjectDto>("GetProjects.sql", new { 
               Status = "Active", 
               StartDate = DateTime.Now.AddDays(-7) 
           });
       }
   }

3. Using a Custom Database Connection:
   // If you need to query a different database (e.g., PCMA) on the fly:
   var pcmaExecutor = new SqlExecutor(Appsetting.DbConnections.PCMADb);
   var pcmaData = await pcmaExecutor.QueryAsync<MyDto>("SELECT * FROM PCMA_Table");
*/
