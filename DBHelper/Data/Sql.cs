using System.Data.SqlClient;
using Dapper;
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
                var Sup = NormalQuery<Forwarders>(AppsettingsConfig.ConnectionString, "SELECT * FROM tForwarders WHERE tid = @username", parameters);
            
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
    }
}
