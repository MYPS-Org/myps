using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using OfficeOpenXml;
using System.Data;

namespace Hangfire.Services
{
    /// <summary>
    /// One parameter a stored proc expects, mirroring the pattern used in
    /// CrystalReportService's SqlParamDefinition - kept separate here since
    /// this runs entirely in WebAPI (net8.0), not the Crystal service.
    /// </summary>
    public class ExcelReportParam
    {
        public string Name { get; set; } = string.Empty;
        public SqlDbType DbType { get; set; }
        public bool IsRequired { get; set; } = true;
    }

    public interface IExcelReportGenerator
    {
        /// <summary>
        /// True if the given report name is handled by this Excel path
        /// instead of being sent to CrystalReportService.
        /// </summary>
        bool CanHandle(string reportName);

        /// <summary>
        /// Runs the report's backing stored proc and returns an .xlsx file
        /// as bytes. Throws ArgumentException for missing/invalid parameters
        /// (mirrors CrystalReportRenderer's validation contract), so callers
        /// can handle both the same way.
        /// </summary>
        Task<byte[]> GenerateAsync(string reportName, IDictionary<string, string> parameters, CancellationToken ct);
    }

    /// <summary>
    /// Handles reports that produce raw, wide/tall data extracts poorly
    /// suited to Crystal's page-based PDF rendering (rows get truncated).
    /// Excel has no such row-count ceiling at this scale, and skips the
    /// entire CrystalReportService round-trip for these reports.
    /// </summary>
    public class ExcelReportGenerator : IExcelReportGenerator
    {
        // Report inventory for the Excel path only. Add more report names
        // here if other reports turn out to need the same treatment.
        private static readonly Dictionary<string, (string DbObjectName, List<ExcelReportParam> Parameters)> Reports =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["extract-pcmiow"] = (
                    "usp_extract_PC_MIOW_list",
                    new List<ExcelReportParam>
                    {
                        new() { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
                        new() { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
                    }),
                ["extract-pc"] = (
                    "usp_extract_PC_list",
                    new List<ExcelReportParam>
                    {
                        new() { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
                        new() { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new() { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
                    })
            };

        private readonly string _connectionString;

        public ExcelReportGenerator(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("MYPSDb")
                ?? throw new InvalidOperationException("MYPSDb connection string not found in configuration.");
        }

        public bool CanHandle(string reportName) => Reports.ContainsKey(reportName);

        public async Task<byte[]> GenerateAsync(string reportName, IDictionary<string, string> parameters, CancellationToken ct)
        {
            if (!Reports.TryGetValue(reportName, out var definition))
                throw new ArgumentException($"No Excel report defined for '{reportName}'.");

            var dataTable = await LoadDataAsync(definition.DbObjectName, definition.Parameters, parameters, ct);
            return BuildWorkbook(reportName, dataTable);
        }

        private async Task<DataTable> LoadDataAsync(
            string dbObjectName,
            List<ExcelReportParam> paramDefs,
            IDictionary<string, string> parameters,
            CancellationToken ct)
        {
            await using var connection = new SqlConnection(_connectionString);
            await using var command = connection.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = dbObjectName;
            command.CommandTimeout = 120; // data extracts can be large - same allowance as Crystal reports

            var missing = new List<string>();

            foreach (var paramDef in paramDefs)
            {
                var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
                               && !string.IsNullOrEmpty(rawValue);

                if (!hasValue)
                {
                    if (paramDef.IsRequired)
                        missing.Add(paramDef.Name);
                    continue; // optional + not supplied: let the proc's own default apply
                }

                object sqlValue;
                try
                {
                    sqlValue = ConvertValue(rawValue!, paramDef.DbType);
                }
                catch (FormatException)
                {
                    throw new ArgumentException(
                        $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
                }

                var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
                sqlParam.Value = sqlValue;
            }

            if (missing.Count > 0)
            {
                var expected = string.Join(", ", paramDefs.Select(p => p.Name));
                var supplied = string.Join(", ", parameters.Keys);
                throw new ArgumentException(
                    $"'{dbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
                    $"Expected: [{expected}]. Supplied: [{supplied}].");
            }

            var dataTable = new DataTable();
            await connection.OpenAsync(ct);
            using (var reader = await command.ExecuteReaderAsync(ct))
            {
                dataTable.Load(reader);
            }
            return dataTable;
        }

        private static object ConvertValue(string stringValue, SqlDbType dbType) => dbType switch
        {
            SqlDbType.Int or SqlDbType.SmallInt or SqlDbType.TinyInt or SqlDbType.BigInt => int.Parse(stringValue),
            SqlDbType.Decimal or SqlDbType.Money or SqlDbType.SmallMoney => decimal.Parse(stringValue),
            SqlDbType.Bit => bool.Parse(stringValue),
            SqlDbType.Date or SqlDbType.DateTime or SqlDbType.DateTime2 or SqlDbType.SmallDateTime => DateTime.Parse(stringValue),
            _ => stringValue
        };

        private static byte[] BuildWorkbook(string reportName, DataTable dataTable)
        {
            using var package = new ExcelPackage();
            var sheet = package.Workbook.Worksheets.Add(reportName);

            // Header row
            for (var col = 0; col < dataTable.Columns.Count; col++)
            {
                sheet.Cells[1, col + 1].Value = dataTable.Columns[col].ColumnName;
                sheet.Cells[1, col + 1].Style.Font.Bold = true;
            }

            // Data rows - LoadFromDataTable would also work, but this keeps
            // header styling explicit and avoids EPPlus's own column-type
            // inference guessing wrong for mixed-content columns.
            for (var row = 0; row < dataTable.Rows.Count; row++)
            {
                for (var col = 0; col < dataTable.Columns.Count; col++)
                {
                    sheet.Cells[row + 2, col + 1].Value = dataTable.Rows[row][col];
                }
            }

            sheet.Cells[sheet.Dimension.Address].AutoFitColumns();
            sheet.View.FreezePanes(2, 1);

            return package.GetAsByteArray();
        }
    }
}
