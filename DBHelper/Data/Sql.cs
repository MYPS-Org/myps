using Dapper;
using System.Data;
using System.Data.SqlClient;
namespace DBHelper.Data
{
    public static class Sql
    {
        public static DynamicParameters GetParameters(object parameters) => new DynamicParameters(parameters);
        public static List<T> NormalQuery<T>(string connection, string command, Dictionary<string, object> parameters = null)
        {
            /*
                HOW TO USE?
                var parameters2 = new Dictionary<string, object>
                {
                    {"@username", username},
                    {"@ConnectionID", ConnectionID},
                };
                var Sup = NormalQuery<q>(AppsettingsConfig.ConnectionString, "SELECT * FROM tForwarders WHERE tid = @username", parameters);
            
            List<UniqueID> list = NormalQuery<UniqueID>(AppsettingsConfig.ConnectionString, "EXEC pGenerateUID");
             */
            using (var sql = new SqlConnection(connection))
            {
                sql.Open();
                command = command.Trim();
                if (parameters == null) parameters = new Dictionary<string, object>();
                var ret = sql.Query<T>(command, GetParameters(parameters), commandTimeout: 120).ToList();
                sql.Close();
                return ret;
            }
        }
        /*
         var uniqueIds = await QueryAsync<UniqueID>(
            connectionString,
            "dbo.pGenerateUID",
            commandType: CommandType.StoredProcedure,
            cancellationToken: cancellationToken);

        var forwarders = await QueryAsync<ForwarderDto>(
            connectionString,
            """
            SELECT
                Id,
                Name,
                ConnectionID
            FROM dbo.tForwarders
            WHERE Id = @Username
              AND ConnectionID = @ConnectionID;
            """,
            new
            {
                Username = username,
                ConnectionID = connectionId
            },
            cancellationToken: cancellationToken);
         */
        public static async Task<List<T>> QueryAsync<T>(
            string connectionString,
            string commandText,
            object? parameters = null,
            int commandTimeout = 120,
            CommandType commandType = CommandType.Text,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new ArgumentException(
                    "Connection string is required.",
                    nameof(connectionString));
            }

            if (string.IsNullOrWhiteSpace(commandText))
            {
                throw new ArgumentException(
                    "SQL command is required.",
                    nameof(commandText));
            }

            await using var connection = new SqlConnection(connectionString);

            await connection.OpenAsync(cancellationToken);

            var command = new CommandDefinition(
                commandText: commandText.Trim(),
                parameters: parameters,
                commandTimeout: commandTimeout,
                commandType: commandType,
                cancellationToken: cancellationToken);

            var results = await connection.QueryAsync<T>(command);

            return results.ToList();
        }
        #region How to use?
        /*
            Query
            var employees = await QueryAsync<Employee>(
                connectionString,
                "SELECT Id, Name, Salary FROM Employees WHERE DepartmentId = @DeptId",
                new { DeptId = 5 },
                cancellationToken: cancellationToken);

            var employees = await QueryAsync<Employee>(
                connectionString,
                @"SELECT Id, Name, Salary 
                  FROM Employees 
                  WHERE DepartmentId = @DeptId 
                    AND Salary >= @MinSalary",
                new { DeptId = 5, MinSalary = 50000m },
                cancellationToken: cancellationToken);

            Stored Procedure
            var employees = await QueryAsync<Employee>(
                connectionString,
                "sp_GetEmployeesByDepartment",   // just the SP name
                new { DeptId = 5 },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            var parameters = new DynamicParameters();
            parameters.Add("DeptId", 5);
            parameters.Add("TotalCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

            var employees = await QueryAsync<Employee>(
                connectionString,
                "sp_GetEmployeesByDepartment",
                parameters,
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            int totalCount = parameters.Get<int>("TotalCount");
         */
        #endregion
    }
}
