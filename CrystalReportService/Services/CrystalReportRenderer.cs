using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Web.Hosting;
using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;

namespace CrystalReportService.Services
{
    public interface ICrystalReportRenderer
    {
        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
    }

    /// <summary>
    /// Source type for a report's data - determines how we build the SQL
    /// command before handing the resulting DataTable to Crystal.
    /// </summary>
    public enum DataSourceType
    {
        StoredProcedure,
        View
    }

    /// <summary>
    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
    /// proc has a SQL default (e.g. "= NULL") - required params missing from
    /// the request fail fast with a clear message instead of a SQL error.
    /// </summary>
    public class SqlParamDefinition
    {
        public string Name { get; set; }
        public SqlDbType DbType { get; set; }
        public bool IsRequired { get; set; } = true;
    }

    /// <summary>
    /// Everything needed to render one report: which .rpt file, which
    /// stored proc/view backs it, and (for stored procs) what parameters
    /// it expects.
    /// </summary>
    public class ReportDefinition
    {
        public string RptFileName { get; set; }
        public DataSourceType SourceType { get; set; }
        public string DbObjectName { get; set; }
        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
    }

    /// <summary>
    /// Loads a .rpt file, runs its backing stored proc/view directly via
    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
    /// bypassing Crystal's own database connectivity entirely. This avoids
    /// the ".rpt has stale data saved with it" problem, and puts us in full
    /// control of the SQL instead of relying on Crystal's stored-proc
    /// parameter binding.
    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
    /// </summary>
    public class CrystalReportRenderer : ICrystalReportRenderer
    {
        // Report inventory: URL key -> .rpt file + backing SP/view + its
        // parameters. Filenames must match exactly what's in the Reports
        // folder, spaces included. Source: report inventory table + the
        // three stored proc signatures shared earlier.
        private static readonly Dictionary<string, ReportDefinition> Reports =
            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
            {
                ["rbp"] = new ReportDefinition
                {
                    RptFileName = "RBP.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "sp_RBP",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                },
                ["extract-pcmiow"] = new ReportDefinition
                {
                    RptFileName = "ExtractPCMIOW.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "usp_extract_PC_MIOW_list",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
                    }
                },
                ["rbp-summary-report"] = new ReportDefinition
                {
                    //RptFileName = "RBPSummaryReport.rpt",
                    //SourceType = DataSourceType.StoredProcedure,
                    //DbObjectName = "sp_RBPSummary"

                    RptFileName = "RBP Summary Report.rpt",
                    SourceType = DataSourceType.View,
                    DbObjectName = "MYPS_vw_rptRBPSummary"

                    //RptFileName = "RBPSummaryReport.rpt",
                    //SourceType = DataSourceType.View,
                    //DbObjectName = "MYPS_vw_rptRBPSummary"
                },
                ["rbp-summary-report-with-tier"] = new ReportDefinition
                {
                    RptFileName = "RBP_Summary_Report_with_Tier.rpt",
                    SourceType = DataSourceType.View,
                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
                },
                ["aip-official"] = new ReportDefinition
                {
                    RptFileName = "AIP_Official.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "a1_usp_AIP2",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                },
                ["aip-executive"] = new ReportDefinition
                {
                    RptFileName = "AIP_Executive.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "a1_usp_AIP2",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                },
                ["aip-official-without-ld"] = new ReportDefinition
                {
                    RptFileName = "AIP_Official_without_LD.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "a1_usp_AIP2",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                },
                ["aip-executive-2"] = new ReportDefinition
                {
                    RptFileName = "AIP_Executive2.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "a1_usp_AIP2",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                }
            };

        private readonly string _reportsFolder;
        private readonly string _connectionString;

        public CrystalReportRenderer()
        {
            // .rpt files live in the project's own /Reports folder and deploy
            // with the app, so this is resolved relative to the app root
            // rather than read from an absolute path in Web.config.
            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
        }

        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
        {
            if (!Reports.TryGetValue(reportName, out var definition))
                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
            if (!File.Exists(rptPath))
                throw new FileNotFoundException($"Report file not found: {rptPath}");

            var dataTable = LoadData(definition, parameters);

            using (var report = new ReportDocument())
            {
                try
                {
                    report.Load(rptPath);
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed at report.Load('{rptPath}'): {ex.Message}", ex);
                }

                // We're supplying live data directly below, so this just
                // makes sure Crystal doesn't try to fall back to whatever
                // was saved in the file at design time.
                report.ReportOptions.EnableSaveDataWithReport = false;

                // Even though SetDataSource below supplies the actual row
                // data, Crystal's export pipeline can still internally
                // reference the .rpt's ORIGINAL Database Expert connection
                // metadata during Export - if that's stale/broken, Export
                // throws a COM "path not found" error regardless of
                // SetDataSource. Scoped to View-backed reports only: calling
                // this on a StoredProcedure-backed Table can make Crystal
                // attempt to validate/execute that proc internally (with no
                // parameters, since those are handled entirely via our own
                // ADO.NET call above) - which broke the 6 SP-backed reports
                // that worked fine without this call.
                if (definition.SourceType == DataSourceType.View)
                {
                    try
                    {
                        ApplyDatabaseLogon(report);
                    }
                    catch (Exception ex)
                    {
                        throw new Exception($"Failed at ApplyDatabaseLogon: {ex.Message}", ex);
                    }
                }

                try
                {
                    report.SetDataSource(dataTable);
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed at report.SetDataSource (rows: {dataTable.Rows.Count}): {ex.Message}", ex);
                }

                // SetDataSource above only supplies the row data. A .rpt can
                // separately define its own Crystal "report parameters" used
                // for display purposes (title, as-of-date, etc.) that have
                // nothing to do with the SQL data source - those still need
                // to be set explicitly, or Crystal throws "Missing parameter
                // values" during export regardless of the data being present.
                try
                {
                    ApplyReportLevelParameters(report, parameters);
                }
                catch (ArgumentException)
                {
                    throw; // already has a clear message - don't wrap it
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed at ApplyReportLevelParameters: {ex.Message}", ex);
                }

                // NOTE: if any of these reports have subreports with their
                // OWN separate data source, SetDataSource on the main report
                // does not feed them - they'd need their own query + their
                // own report.Subreports[i].SetDataSource(...) call. None of
                // the 8 reports were noted as having subreports so far.

                try
                {
                    using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
                    using (var buffer = new MemoryStream())
                    {
                        // Crystal's ExportToStream doesn't guarantee the stream is
                        // positioned at the start - without this, CopyTo silently
                        // copies zero bytes.
                        exportStream.Position = 0;
                        exportStream.CopyTo(buffer);
                        return buffer.ToArray();
                    }
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed at report.ExportToStream. rptPath='{rptPath}' (exists: {File.Exists(rptPath)}). reportsFolder='{_reportsFolder}'. Error: {ex.Message}", ex);
                }
            }
        }

        /// <summary>
        /// Points the report's own Database Expert connection info (server/
        /// database/credentials) at the real SQL Server, even though the
        /// actual row data comes from our own DataTable via SetDataSource.
        /// Without this, Crystal's export pipeline can still choke on
        /// stale/broken original connection metadata baked into the .rpt.
        /// Applies to the main report and any subreports.
        /// </summary>
        private void ApplyDatabaseLogon(ReportDocument report)
        {
            var builder = new SqlConnectionStringBuilder(_connectionString);

            var connectionInfo = new ConnectionInfo
            {
                ServerName = builder.DataSource,
                DatabaseName = builder.InitialCatalog,
                UserID = builder.UserID,
                Password = builder.Password,
                IntegratedSecurity = builder.IntegratedSecurity
            };

            ApplyLogOnToTables(report.Database.Tables, connectionInfo);

            foreach (ReportDocument subreport in report.Subreports)
            {
                ApplyLogOnToTables(subreport.Database.Tables, connectionInfo);
            }
        }

        private void ApplyLogOnToTables(Tables tables, ConnectionInfo connectionInfo)
        {
            foreach (Table table in tables)
            {
                var logOnInfo = table.LogOnInfo;
                logOnInfo.ConnectionInfo = connectionInfo;
                table.ApplyLogOnInfo(logOnInfo);
            }
        }

        /// <summary>
        /// Runs the report's backing stored proc or view directly via
        /// ADO.NET and returns the result as a DataTable ready to hand to
        /// Crystal via SetDataSource.
        /// </summary>
        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
        {
            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

            using (var connection = new SqlConnection(_connectionString))
            using (var command = connection.CreateCommand())
            {
                // Report queries (aggregations over many rows, multiple joins)
                // can legitimately take longer than ADO.NET's 30s default.
                // Adjust this if reports still time out or if you want it
                // configurable per-report instead of a single global value.
                command.CommandTimeout = 120;

                if (definition.SourceType == DataSourceType.StoredProcedure)
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandText = definition.DbObjectName;

                    var missing = new List<string>();

                    foreach (var paramDef in definition.Parameters)
                    {
                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
                                       && rawValue != null
                                       && !string.IsNullOrEmpty(rawValue.ToString());

                        if (!hasValue)
                        {
                            if (paramDef.IsRequired)
                                missing.Add(paramDef.Name);

                            // Optional + not supplied: don't add the SqlParameter
                            // at all, so the proc's own SQL default (= NULL) applies.
                            continue;
                        }

                        object sqlValue;
                        try
                        {
                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
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
                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
                        var supplied = string.Join(", ", parameters.Keys);
                        throw new ArgumentException(
                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
                            $"Expected: [{expected}]. Supplied: [{supplied}].");
                    }
                }
                else // View
                {
                    command.CommandType = CommandType.Text;
                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
                    // Views in this inventory take no parameters. If a view
                    // needs filtering later, add a WHERE clause built from
                    // validated/whitelisted parameter names here - never
                    // string-concatenate raw user input into SQL text.
                }

                var dataTable = new DataTable();
                try
                {
                    using (var adapter = new SqlDataAdapter(command))
                    {
                        adapter.Fill(dataTable);
                    }
                }
                catch (SqlException ex) when (ex.Number == -2 || ex.Message.Contains("Timeout"))
                {
                    throw new TimeoutException(
                        $"Query against '{definition.DbObjectName}' timed out after {command.CommandTimeout}s. " +
                        "This usually means the query itself is slow (check its execution plan / indexes in SSMS), " +
                        "not a code bug. If it's expected to take this long, raise CommandTimeout further.", ex);
                }
                return dataTable;
            }
        }

        /// <summary>
        /// Sets any Crystal-level report parameter the .rpt defines and that
        /// was supplied in the request. These are independent of the SQL
        /// data source - a report can define display-only parameters (title,
        /// as-of-date, etc.) that Crystal still requires a value for before
        /// it will export, even when SetDataSource already supplied the rows.
        /// Parameters the report doesn't define are ignored. Parameters the
        /// report defines but weren't supplied and have no existing default
        /// will cause Crystal's own "Missing parameter values" error at
        /// export time - if that happens, the report defines a parameter
        /// this list doesn't know about yet; check report.DataDefinition.ParameterFields
        /// in the Designer to find its exact name.
        /// </summary>
        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters)
        {
            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            var missing = new List<string>();

            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
            {
                // Crystal sometimes keeps the literal "@ParamName" from the
                // stored proc as the parameter field's Name. Match on either
                // form so callers can use plain query-string keys.
                var lookupKey = parameters.ContainsKey(pf.Name)
                    ? pf.Name
                    : pf.Name.TrimStart('@');

                var hasValue = parameters.TryGetValue(lookupKey, out var rawValue)
                               && rawValue != null
                               && !string.IsNullOrEmpty(rawValue.ToString());

                if (!hasValue)
                {
                    // Deliberately NOT checking pf.HasCurrentValue here - it's
                    // not reliable immediately after SetParameterValue in the
                    // same pass. Every parameter this .rpt defines is treated
                    // as required unless/until we confirm otherwise.
                    missing.Add(pf.Name);
                    continue;
                }

                var stringValue = rawValue.ToString();
                object convertedValue;
                try
                {
                    convertedValue = ConvertToCrystalValue(stringValue, pf.ValueType);
                }
                catch (FormatException)
                {
                    throw new ArgumentException(
                        $"Report parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
                }

                report.SetParameterValue(pf.Name, convertedValue);
            }

            if (missing.Count > 0)
            {
                var allDefined = string.Join(", ", report.DataDefinition.ParameterFields.Cast<ParameterFieldDefinition>().Select(p => $"{p.Name} ({p.ValueType})"));
                var supplied = string.Join(", ", parameters.Keys);
                throw new ArgumentException(
                    $"Report-level parameter(s) not supplied: {string.Join(", ", missing)}. " +
                    $"All report-level parameters this .rpt defines: [{allDefined}]. Supplied: [{supplied}].");
            }
        }

        private static object ConvertToCrystalValue(string stringValue, FieldValueType valueType)
        {
            switch (valueType)
            {
                case FieldValueType.NumberField:
                case FieldValueType.Int8sField:
                case FieldValueType.Int8uField:
                case FieldValueType.Int16sField:
                case FieldValueType.Int16uField:
                case FieldValueType.Int32sField:
                case FieldValueType.Int32uField:
                    return int.Parse(stringValue);

                case FieldValueType.CurrencyField:
                    return decimal.Parse(stringValue);

                case FieldValueType.BooleanField:
                    return bool.Parse(stringValue);

                case FieldValueType.DateField:
                case FieldValueType.DateTimeField:
                    return DateTime.Parse(stringValue);

                default:
                    return stringValue;
            }
        }

        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
        {
            switch (dbType)
            {
                case SqlDbType.Int:
                case SqlDbType.SmallInt:
                case SqlDbType.TinyInt:
                case SqlDbType.BigInt:
                    return int.Parse(stringValue);

                case SqlDbType.Decimal:
                case SqlDbType.Money:
                case SqlDbType.SmallMoney:
                    return decimal.Parse(stringValue);

                case SqlDbType.Bit:
                    return bool.Parse(stringValue);

                case SqlDbType.Date:
                case SqlDbType.DateTime:
                case SqlDbType.DateTime2:
                case SqlDbType.SmallDateTime:
                    return DateTime.Parse(stringValue);

                default:
                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
            }
        }
    }
}

//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Source type for a report's data - determines how we build the SQL
//    /// command before handing the resulting DataTable to Crystal.
//    /// </summary>
//    public enum DataSourceType
//    {
//        StoredProcedure,
//        View
//    }

//    /// <summary>
//    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
//    /// proc has a SQL default (e.g. "= NULL") - required params missing from
//    /// the request fail fast with a clear message instead of a SQL error.
//    /// </summary>
//    public class SqlParamDefinition
//    {
//        public string Name { get; set; }
//        public SqlDbType DbType { get; set; }
//        public bool IsRequired { get; set; } = true;
//    }

//    /// <summary>
//    /// Everything needed to render one report: which .rpt file, which
//    /// stored proc/view backs it, and (for stored procs) what parameters
//    /// it expects.
//    /// </summary>
//    public class ReportDefinition
//    {
//        public string RptFileName { get; set; }
//        public DataSourceType SourceType { get; set; }
//        public string DbObjectName { get; set; }
//        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
//    }

//    /// <summary>
//    /// Loads a .rpt file, runs its backing stored proc/view directly via
//    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
//    /// bypassing Crystal's own database connectivity entirely. This avoids
//    /// the ".rpt has stale data saved with it" problem, and puts us in full
//    /// control of the SQL instead of relying on Crystal's stored-proc
//    /// parameter binding.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Report inventory: URL key -> .rpt file + backing SP/view + its
//        // parameters. Filenames must match exactly what's in the Reports
//        // folder, spaces included. Source: report inventory table + the
//        // three stored proc signatures shared earlier.
//        private static readonly Dictionary<string, ReportDefinition> Reports =
//            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
//            {
//                ["rbp"] = new ReportDefinition
//                {
//                    RptFileName = "RBP.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBP",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["extract-pcmiow"] = new ReportDefinition
//                {
//                    RptFileName = "ExtractPCMIOW.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "usp_extract_PC_MIOW_list",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
//                    }
//                },
//                ["rbp-summary-report"] = new ReportDefinition
//                {
//                    RptFileName = "RBPSummaryReport.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummary"
//                },
//                ["rbp-summary-report-with-tier"] = new ReportDefinition
//                {
//                    RptFileName = "RBP_Summary_Report_with_Tier.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
//                },
//                ["aip-official"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-official-without-ld"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official_without_LD.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive-2"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive2.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!Reports.TryGetValue(reportName, out var definition))
//                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            var dataTable = LoadData(definition, parameters);

//            using (var report = new ReportDocument())
//            {
//                try
//                {
//                    report.Load(rptPath);
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at report.Load('{rptPath}'): {ex.Message}", ex);
//                }

//                // We're supplying live data directly below, so this just
//                // makes sure Crystal doesn't try to fall back to whatever
//                // was saved in the file at design time.
//                report.ReportOptions.EnableSaveDataWithReport = false;

//                try
//                {
//                    report.SetDataSource(dataTable);
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at report.SetDataSource (rows: {dataTable.Rows.Count}): {ex.Message}", ex);
//                }

//                // SetDataSource above only supplies the row data. A .rpt can
//                // separately define its own Crystal "report parameters" used
//                // for display purposes (title, as-of-date, etc.) that have
//                // nothing to do with the SQL data source - those still need
//                // to be set explicitly, or Crystal throws "Missing parameter
//                // values" during export regardless of the data being present.
//                try
//                {
//                    ApplyReportLevelParameters(report, parameters);
//                }
//                catch (ArgumentException)
//                {
//                    throw; // already has a clear message - don't wrap it
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at ApplyReportLevelParameters: {ex.Message}", ex);
//                }

//                // NOTE: if any of these reports have subreports with their
//                // OWN separate data source, SetDataSource on the main report
//                // does not feed them - they'd need their own query + their
//                // own report.Subreports[i].SetDataSource(...) call. None of
//                // the 8 reports were noted as having subreports so far.

//                try
//                {
//                    using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                    using (var buffer = new MemoryStream())
//                    {
//                        // Crystal's ExportToStream doesn't guarantee the stream is
//                        // positioned at the start - without this, CopyTo silently
//                        // copies zero bytes.
//                        exportStream.Position = 0;
//                        exportStream.CopyTo(buffer);
//                        return buffer.ToArray();
//                    }
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception(ex.ToString());
//                    //throw new Exception($"Failed at report.ExportToStream. rptPath='{rptPath}' (exists: {File.Exists(rptPath)}). reportsFolder='{_reportsFolder}'. Error: {ex.Message}", ex);
//                }
//            }
//        }

//        /// <summary>
//        /// Runs the report's backing stored proc or view directly via
//        /// ADO.NET and returns the result as a DataTable ready to hand to
//        /// Crystal via SetDataSource.
//        /// </summary>
//        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            using (var connection = new SqlConnection(_connectionString))
//            using (var command = connection.CreateCommand())
//            {
//                if (definition.SourceType == DataSourceType.StoredProcedure)
//                {
//                    command.CommandType = CommandType.StoredProcedure;
//                    command.CommandText = definition.DbObjectName;

//                    var missing = new List<string>();

//                    foreach (var paramDef in definition.Parameters)
//                    {
//                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
//                                       && rawValue != null
//                                       && !string.IsNullOrEmpty(rawValue.ToString());

//                        if (!hasValue)
//                        {
//                            if (paramDef.IsRequired)
//                                missing.Add(paramDef.Name);

//                            // Optional + not supplied: don't add the SqlParameter
//                            // at all, so the proc's own SQL default (= NULL) applies.
//                            continue;
//                        }

//                        object sqlValue;
//                        try
//                        {
//                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
//                        }
//                        catch (FormatException)
//                        {
//                            throw new ArgumentException(
//                                $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
//                        }

//                        var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
//                        sqlParam.Value = sqlValue;
//                    }

//                    if (missing.Count > 0)
//                    {
//                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
//                        var supplied = string.Join(", ", parameters.Keys);
//                        throw new ArgumentException(
//                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                            $"Expected: [{expected}]. Supplied: [{supplied}].");
//                    }
//                }
//                else // View
//                {
//                    command.CommandType = CommandType.Text;
//                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
//                    // Views in this inventory take no parameters. If a view
//                    // needs filtering later, add a WHERE clause built from
//                    // validated/whitelisted parameter names here - never
//                    // string-concatenate raw user input into SQL text.
//                }

//                var dataTable = new DataTable();
//                using (var adapter = new SqlDataAdapter(command))
//                {
//                    adapter.Fill(dataTable);
//                }
//                return dataTable;
//            }
//        }

//        /// <summary>
//        /// Sets any Crystal-level report parameter the .rpt defines and that
//        /// was supplied in the request. These are independent of the SQL
//        /// data source - a report can define display-only parameters (title,
//        /// as-of-date, etc.) that Crystal still requires a value for before
//        /// it will export, even when SetDataSource already supplied the rows.
//        /// Parameters the report doesn't define are ignored. Parameters the
//        /// report defines but weren't supplied and have no existing default
//        /// will cause Crystal's own "Missing parameter values" error at
//        /// export time - if that happens, the report defines a parameter
//        /// this list doesn't know about yet; check report.DataDefinition.ParameterFields
//        /// in the Designer to find its exact name.
//        /// </summary>
//        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
//            var missing = new List<string>();

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                // Crystal sometimes keeps the literal "@ParamName" from the
//                // stored proc as the parameter field's Name. Match on either
//                // form so callers can use plain query-string keys.
//                var lookupKey = parameters.ContainsKey(pf.Name)
//                    ? pf.Name
//                    : pf.Name.TrimStart('@');

//                var hasValue = parameters.TryGetValue(lookupKey, out var rawValue)
//                               && rawValue != null
//                               && !string.IsNullOrEmpty(rawValue.ToString());

//                if (!hasValue)
//                {
//                    // Deliberately NOT checking pf.HasCurrentValue here - it's
//                    // not reliable immediately after SetParameterValue in the
//                    // same pass. Every parameter this .rpt defines is treated
//                    // as required unless/until we confirm otherwise.
//                    missing.Add(pf.Name);
//                    continue;
//                }

//                var stringValue = rawValue.ToString();
//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertToCrystalValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Report parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }

//            if (missing.Count > 0)
//            {
//                var allDefined = string.Join(", ", report.DataDefinition.ParameterFields.Cast<ParameterFieldDefinition>().Select(p => $"{p.Name} ({p.ValueType})"));
//                var supplied = string.Join(", ", parameters.Keys);
//                throw new ArgumentException(
//                    $"Report-level parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                    $"All report-level parameters this .rpt defines: [{allDefined}]. Supplied: [{supplied}].");
//            }
//        }

//        private static object ConvertToCrystalValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue;
//            }
//        }

//        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
//        {
//            switch (dbType)
//            {
//                case SqlDbType.Int:
//                case SqlDbType.SmallInt:
//                case SqlDbType.TinyInt:
//                case SqlDbType.BigInt:
//                    return int.Parse(stringValue);

//                case SqlDbType.Decimal:
//                case SqlDbType.Money:
//                case SqlDbType.SmallMoney:
//                    return decimal.Parse(stringValue);

//                case SqlDbType.Bit:
//                    return bool.Parse(stringValue);

//                case SqlDbType.Date:
//                case SqlDbType.DateTime:
//                case SqlDbType.DateTime2:
//                case SqlDbType.SmallDateTime:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
//            }
//        }
//    }
//}

//WORKING OTHER THAN VIEW RBPSUMMARY AND RBPSUMMARYWITHTIER ----------------------------------------------
//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Source type for a report's data - determines how we build the SQL
//    /// command before handing the resulting DataTable to Crystal.
//    /// </summary>
//    public enum DataSourceType
//    {
//        StoredProcedure,
//        View
//    }

//    /// <summary>
//    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
//    /// proc has a SQL default (e.g. "= NULL") - required params missing from
//    /// the request fail fast with a clear message instead of a SQL error.
//    /// </summary>
//    public class SqlParamDefinition
//    {
//        public string Name { get; set; }
//        public SqlDbType DbType { get; set; }
//        public bool IsRequired { get; set; } = true;
//    }

//    /// <summary>
//    /// Everything needed to render one report: which .rpt file, which
//    /// stored proc/view backs it, and (for stored procs) what parameters
//    /// it expects.
//    /// </summary>
//    public class ReportDefinition
//    {
//        public string RptFileName { get; set; }
//        public DataSourceType SourceType { get; set; }
//        public string DbObjectName { get; set; }
//        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
//    }

//    /// <summary>
//    /// Loads a .rpt file, runs its backing stored proc/view directly via
//    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
//    /// bypassing Crystal's own database connectivity entirely. This avoids
//    /// the ".rpt has stale data saved with it" problem, and puts us in full
//    /// control of the SQL instead of relying on Crystal's stored-proc
//    /// parameter binding.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Report inventory: URL key -> .rpt file + backing SP/view + its
//        // parameters. Filenames must match exactly what's in the Reports
//        // folder, spaces included. Source: report inventory table + the
//        // three stored proc signatures shared earlier.
//        private static readonly Dictionary<string, ReportDefinition> Reports =
//            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
//            {
//                ["rbp"] = new ReportDefinition
//                {
//                    RptFileName = "RBP.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBP",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["extract-pcmiow"] = new ReportDefinition
//                {
//                    RptFileName = "ExtractPCMIOW.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "usp_extract_PC_MIOW_list",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
//                    }
//                },
//                ["rbp-summary-report"] = new ReportDefinition
//                {
//                    RptFileName = "RBPSummaryReport.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummary"
//                },
//                ["rbp-summary-report-with-tier"] = new ReportDefinition
//                {
//                    RptFileName = "RBP_Summary_Report_with_Tier.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
//                },
//                ["aip-official"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-official-without-ld"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official_without_LD.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive-2"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive2.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!Reports.TryGetValue(reportName, out var definition))
//                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            var dataTable = LoadData(definition, parameters);

//            using (var report = new ReportDocument())
//            {
//                try
//                {
//                    report.Load(rptPath);
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at report.Load('{rptPath}'): {ex.Message}", ex);
//                }

//                // We're supplying live data directly below, so this just
//                // makes sure Crystal doesn't try to fall back to whatever
//                // was saved in the file at design time.
//                report.ReportOptions.EnableSaveDataWithReport = false;

//                try
//                {
//                    report.SetDataSource(dataTable);
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at report.SetDataSource (rows: {dataTable.Rows.Count}): {ex.Message}", ex);
//                }

//                // SetDataSource above only supplies the row data. A .rpt can
//                // separately define its own Crystal "report parameters" used
//                // for display purposes (title, as-of-date, etc.) that have
//                // nothing to do with the SQL data source - those still need
//                // to be set explicitly, or Crystal throws "Missing parameter
//                // values" during export regardless of the data being present.
//                try
//                {
//                    ApplyReportLevelParameters(report, parameters);
//                }
//                catch (ArgumentException)
//                {
//                    throw; // already has a clear message - don't wrap it
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at ApplyReportLevelParameters: {ex.Message}", ex);
//                }

//                // NOTE: if any of these reports have subreports with their
//                // OWN separate data source, SetDataSource on the main report
//                // does not feed them - they'd need their own query + their
//                // own report.Subreports[i].SetDataSource(...) call. None of
//                // the 8 reports were noted as having subreports so far.

//                try
//                {
//                    using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                    using (var buffer = new MemoryStream())
//                    {
//                        // Crystal's ExportToStream doesn't guarantee the stream is
//                        // positioned at the start - without this, CopyTo silently
//                        // copies zero bytes.
//                        exportStream.Position = 0;
//                        exportStream.CopyTo(buffer);
//                        return buffer.ToArray();
//                    }
//                }
//                catch (Exception ex)
//                {
//                    throw new Exception($"Failed at report.ExportToStream: {ex.Message}", ex);
//                }
//            }
//        }

//        /// <summary>
//        /// Runs the report's backing stored proc or view directly via
//        /// ADO.NET and returns the result as a DataTable ready to hand to
//        /// Crystal via SetDataSource.
//        /// </summary>
//        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            using (var connection = new SqlConnection(_connectionString))
//            using (var command = connection.CreateCommand())
//            {
//                if (definition.SourceType == DataSourceType.StoredProcedure)
//                {
//                    command.CommandType = CommandType.StoredProcedure;
//                    command.CommandText = definition.DbObjectName;

//                    var missing = new List<string>();

//                    foreach (var paramDef in definition.Parameters)
//                    {
//                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
//                                       && rawValue != null
//                                       && !string.IsNullOrEmpty(rawValue.ToString());

//                        if (!hasValue)
//                        {
//                            if (paramDef.IsRequired)
//                                missing.Add(paramDef.Name);

//                            // Optional + not supplied: don't add the SqlParameter
//                            // at all, so the proc's own SQL default (= NULL) applies.
//                            continue;
//                        }

//                        object sqlValue;
//                        try
//                        {
//                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
//                        }
//                        catch (FormatException)
//                        {
//                            throw new ArgumentException(
//                                $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
//                        }

//                        var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
//                        sqlParam.Value = sqlValue;
//                    }

//                    if (missing.Count > 0)
//                    {
//                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
//                        var supplied = string.Join(", ", parameters.Keys);
//                        throw new ArgumentException(
//                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                            $"Expected: [{expected}]. Supplied: [{supplied}].");
//                    }
//                }
//                else // View
//                {
//                    command.CommandType = CommandType.Text;
//                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
//                    // Views in this inventory take no parameters. If a view
//                    // needs filtering later, add a WHERE clause built from
//                    // validated/whitelisted parameter names here - never
//                    // string-concatenate raw user input into SQL text.
//                }

//                var dataTable = new DataTable();
//                using (var adapter = new SqlDataAdapter(command))
//                {
//                    adapter.Fill(dataTable);
//                }
//                return dataTable;
//            }
//        }

//        /// <summary>
//        /// Sets any Crystal-level report parameter the .rpt defines and that
//        /// was supplied in the request. These are independent of the SQL
//        /// data source - a report can define display-only parameters (title,
//        /// as-of-date, etc.) that Crystal still requires a value for before
//        /// it will export, even when SetDataSource already supplied the rows.
//        /// Parameters the report doesn't define are ignored. Parameters the
//        /// report defines but weren't supplied and have no existing default
//        /// will cause Crystal's own "Missing parameter values" error at
//        /// export time - if that happens, the report defines a parameter
//        /// this list doesn't know about yet; check report.DataDefinition.ParameterFields
//        /// in the Designer to find its exact name.
//        /// </summary>
//        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
//            var missing = new List<string>();

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                // Crystal sometimes keeps the literal "@ParamName" from the
//                // stored proc as the parameter field's Name. Match on either
//                // form so callers can use plain query-string keys.
//                var lookupKey = parameters.ContainsKey(pf.Name)
//                    ? pf.Name
//                    : pf.Name.TrimStart('@');

//                var hasValue = parameters.TryGetValue(lookupKey, out var rawValue)
//                               && rawValue != null
//                               && !string.IsNullOrEmpty(rawValue.ToString());

//                if (!hasValue)
//                {
//                    // Deliberately NOT checking pf.HasCurrentValue here - it's
//                    // not reliable immediately after SetParameterValue in the
//                    // same pass. Every parameter this .rpt defines is treated
//                    // as required unless/until we confirm otherwise.
//                    missing.Add(pf.Name);
//                    continue;
//                }

//                var stringValue = rawValue.ToString();
//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertToCrystalValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Report parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }

//            if (missing.Count > 0)
//            {
//                var allDefined = string.Join(", ", report.DataDefinition.ParameterFields.Cast<ParameterFieldDefinition>().Select(p => $"{p.Name} ({p.ValueType})"));
//                var supplied = string.Join(", ", parameters.Keys);
//                throw new ArgumentException(
//                    $"Report-level parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                    $"All report-level parameters this .rpt defines: [{allDefined}]. Supplied: [{supplied}].");
//            }
//        }

//        private static object ConvertToCrystalValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue;
//            }
//        }

//        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
//        {
//            switch (dbType)
//            {
//                case SqlDbType.Int:
//                case SqlDbType.SmallInt:
//                case SqlDbType.TinyInt:
//                case SqlDbType.BigInt:
//                    return int.Parse(stringValue);

//                case SqlDbType.Decimal:
//                case SqlDbType.Money:
//                case SqlDbType.SmallMoney:
//                    return decimal.Parse(stringValue);

//                case SqlDbType.Bit:
//                    return bool.Parse(stringValue);

//                case SqlDbType.Date:
//                case SqlDbType.DateTime:
//                case SqlDbType.DateTime2:
//                case SqlDbType.SmallDateTime:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
//            }
//        }
//    }
//}

//WORKING OTHER THAN VIEW RBPSUMMARY AND RBPSUMMARYWITHTIER ----------------------------------------------
//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Source type for a report's data - determines how we build the SQL
//    /// command before handing the resulting DataTable to Crystal.
//    /// </summary>
//    public enum DataSourceType
//    {
//        StoredProcedure,
//        View
//    }

//    /// <summary>
//    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
//    /// proc has a SQL default (e.g. "= NULL") - required params missing from
//    /// the request fail fast with a clear message instead of a SQL error.
//    /// </summary>
//    public class SqlParamDefinition
//    {
//        public string Name { get; set; }
//        public SqlDbType DbType { get; set; }
//        public bool IsRequired { get; set; } = true;
//    }

//    /// <summary>
//    /// Everything needed to render one report: which .rpt file, which
//    /// stored proc/view backs it, and (for stored procs) what parameters
//    /// it expects.
//    /// </summary>
//    public class ReportDefinition
//    {
//        public string RptFileName { get; set; }
//        public DataSourceType SourceType { get; set; }
//        public string DbObjectName { get; set; }
//        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
//    }

//    /// <summary>
//    /// Loads a .rpt file, runs its backing stored proc/view directly via
//    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
//    /// bypassing Crystal's own database connectivity entirely. This avoids
//    /// the ".rpt has stale data saved with it" problem, and puts us in full
//    /// control of the SQL instead of relying on Crystal's stored-proc
//    /// parameter binding.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Report inventory: URL key -> .rpt file + backing SP/view + its
//        // parameters. Filenames must match exactly what's in the Reports
//        // folder, spaces included. Source: report inventory table + the
//        // three stored proc signatures shared earlier.
//        private static readonly Dictionary<string, ReportDefinition> Reports =
//            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
//            {
//                ["rbp"] = new ReportDefinition
//                {
//                    RptFileName = "RBP.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBP",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["extract-pcmiow"] = new ReportDefinition
//                {
//                    RptFileName = "ExtractPCMIOW.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "usp_extract_PC_MIOW_list",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
//                    }
//                },
//                ["rbp-summary-report"] = new ReportDefinition
//                {
//                    //RptFileName = "RBPSummaryReport.rpt",
//                    //SourceType = DataSourceType.View,
//                    //DbObjectName = "MYPS_vw_rptRBPSummary"
//                    RptFileName = "RBPSummaryReport.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBPSummary",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["rbp-summary-report-with-tier"] = new ReportDefinition
//                {
//                    RptFileName = "RBP_Summary_Report_with_Tier.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
//                },
//                ["aip-official"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-official-without-ld"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official_without_LD.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive-2"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive2.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.

//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!Reports.TryGetValue(reportName, out var definition))
//                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);

//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException(
//            $"Report file not found. " +
//            $"Looked for: '{rptPath}'. " +
//            $"Reports folder: '{_reportsFolder}'. " +
//            $"Folder exists: {Directory.Exists(_reportsFolder)}. " +
//            $"Files in folder: [{(Directory.Exists(_reportsFolder) ? string.Join(", ", Directory.GetFiles(_reportsFolder, "*.rpt").Select(Path.GetFileName)) : "N/A")}].");
//            //throw new FileNotFoundException($"Report file not found: {rptPath}");

//            var dataTable = LoadData(definition, parameters);

//            using (var report = new ReportDocument())
//            {
//                report.Load(rptPath);

//                // We're supplying live data directly below, so this just
//                // makes sure Crystal doesn't try to fall back to whatever
//                // was saved in the file at design time.
//                report.ReportOptions.EnableSaveDataWithReport = false;

//                report.SetDataSource(dataTable);

//                // SetDataSource above only supplies the row data. A .rpt can
//                // separately define its own Crystal "report parameters" used
//                // for display purposes (title, as-of-date, etc.) that have
//                // nothing to do with the SQL data source - those still need
//                // to be set explicitly, or Crystal throws "Missing parameter
//                // values" during export regardless of the data being present.
//                ApplyReportLevelParameters(report, parameters);

//                // NOTE: if any of these reports have subreports with their
//                // OWN separate data source, SetDataSource on the main report
//                // does not feed them - they'd need their own query + their
//                // own report.Subreports[i].SetDataSource(...) call. None of
//                // the 8 reports were noted as having subreports so far.

//                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                using (var buffer = new MemoryStream())
//                {
//                    // Crystal's ExportToStream doesn't guarantee the stream is
//                    // positioned at the start - without this, CopyTo silently
//                    // copies zero bytes.
//                    exportStream.Position = 0;
//                    exportStream.CopyTo(buffer);
//                    return buffer.ToArray();
//                }
//            }
//        }

//        /// <summary>
//        /// Runs the report's backing stored proc or view directly via
//        /// ADO.NET and returns the result as a DataTable ready to hand to
//        /// Crystal via SetDataSource.
//        /// </summary>
//        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            using (var connection = new SqlConnection(_connectionString))
//            using (var command = connection.CreateCommand())
//            {
//                if (definition.SourceType == DataSourceType.StoredProcedure)
//                {
//                    command.CommandType = CommandType.StoredProcedure;
//                    command.CommandText = definition.DbObjectName;

//                    var missing = new List<string>();

//                    foreach (var paramDef in definition.Parameters)
//                    {
//                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
//                                       && rawValue != null
//                                       && !string.IsNullOrEmpty(rawValue.ToString());

//                        if (!hasValue)
//                        {
//                            if (paramDef.IsRequired)
//                                missing.Add(paramDef.Name);

//                            // Optional + not supplied: don't add the SqlParameter
//                            // at all, so the proc's own SQL default (= NULL) applies.
//                            continue;
//                        }

//                        object sqlValue;
//                        try
//                        {
//                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
//                        }
//                        catch (FormatException)
//                        {
//                            throw new ArgumentException(
//                                $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
//                        }

//                        var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
//                        sqlParam.Value = sqlValue;
//                    }

//                    if (missing.Count > 0)
//                    {
//                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
//                        var supplied = string.Join(", ", parameters.Keys);
//                        throw new ArgumentException(
//                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                            $"Expected: [{expected}]. Supplied: [{supplied}].");
//                    }
//                }
//                else // View
//                {
//                    command.CommandType = CommandType.Text;
//                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
//                    // Views in this inventory take no parameters. If a view
//                    // needs filtering later, add a WHERE clause built from
//                    // validated/whitelisted parameter names here - never
//                    // string-concatenate raw user input into SQL text.
//                }

//                var dataTable = new DataTable();
//                using (var adapter = new SqlDataAdapter(command))
//                {
//                    adapter.Fill(dataTable);
//                }
//                return dataTable;
//            }
//        }

//        /// <summary>
//        /// Sets any Crystal-level report parameter the .rpt defines and that
//        /// was supplied in the request. These are independent of the SQL
//        /// data source - a report can define display-only parameters (title,
//        /// as-of-date, etc.) that Crystal still requires a value for before
//        /// it will export, even when SetDataSource already supplied the rows.
//        /// Parameters the report doesn't define are ignored. Parameters the
//        /// report defines but weren't supplied and have no existing default
//        /// will cause Crystal's own "Missing parameter values" error at
//        /// export time - if that happens, the report defines a parameter
//        /// this list doesn't know about yet; check report.DataDefinition.ParameterFields
//        /// in the Designer to find its exact name.
//        /// </summary>
//        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
//            var missing = new List<string>();

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                // Crystal sometimes keeps the literal "@ParamName" from the
//                // stored proc as the parameter field's Name. Match on either
//                // form so callers can use plain query-string keys.
//                var lookupKey = parameters.ContainsKey(pf.Name)
//                    ? pf.Name
//                    : pf.Name.TrimStart('@');

//                var hasValue = parameters.TryGetValue(lookupKey, out var rawValue)
//                               && rawValue != null
//                               && !string.IsNullOrEmpty(rawValue.ToString());

//                if (!hasValue)
//                {
//                    // Deliberately NOT checking pf.HasCurrentValue here - it's
//                    // not reliable immediately after SetParameterValue in the
//                    // same pass. Every parameter this .rpt defines is treated
//                    // as required unless/until we confirm otherwise.
//                    missing.Add(pf.Name);
//                    continue;
//                }

//                var stringValue = rawValue.ToString();
//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertToCrystalValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Report parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }

//            if (missing.Count > 0)
//            {
//                var allDefined = string.Join(", ", report.DataDefinition.ParameterFields.Cast<ParameterFieldDefinition>().Select(p => $"{p.Name} ({p.ValueType})"));
//                var supplied = string.Join(", ", parameters.Keys);
//                throw new ArgumentException(
//                    $"Report-level parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                    $"All report-level parameters this .rpt defines: [{allDefined}]. Supplied: [{supplied}].");
//            }
//        }

//        private static object ConvertToCrystalValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue;
//            }
//        }

//        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
//        {
//            switch (dbType)
//            {
//                case SqlDbType.Int:
//                case SqlDbType.SmallInt:
//                case SqlDbType.TinyInt:
//                case SqlDbType.BigInt:
//                    return int.Parse(stringValue);

//                case SqlDbType.Decimal:
//                case SqlDbType.Money:
//                case SqlDbType.SmallMoney:
//                    return decimal.Parse(stringValue);

//                case SqlDbType.Bit:
//                    return bool.Parse(stringValue);

//                case SqlDbType.Date:
//                case SqlDbType.DateTime:
//                case SqlDbType.DateTime2:
//                case SqlDbType.SmallDateTime:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
//            }
//        }
//    }
//}

//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Source type for a report's data - determines how we build the SQL
//    /// command before handing the resulting DataTable to Crystal.
//    /// </summary>
//    public enum DataSourceType
//    {
//        StoredProcedure,
//        View
//    }

//    /// <summary>
//    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
//    /// proc has a SQL default (e.g. "= NULL") - required params missing from
//    /// the request fail fast with a clear message instead of a SQL error.
//    /// </summary>
//    public class SqlParamDefinition
//    {
//        public string Name { get; set; }
//        public SqlDbType DbType { get; set; }
//        public bool IsRequired { get; set; } = true;
//    }

//    /// <summary>
//    /// Everything needed to render one report: which .rpt file, which
//    /// stored proc/view backs it, and (for stored procs) what parameters
//    /// it expects.
//    /// </summary>
//    public class ReportDefinition
//    {
//        public string RptFileName { get; set; }
//        public DataSourceType SourceType { get; set; }
//        public string DbObjectName { get; set; }
//        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
//    }

//    /// <summary>
//    /// Loads a .rpt file, runs its backing stored proc/view directly via
//    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
//    /// bypassing Crystal's own database connectivity entirely. This avoids
//    /// the ".rpt has stale data saved with it" problem, and puts us in full
//    /// control of the SQL instead of relying on Crystal's stored-proc
//    /// parameter binding.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Report inventory: URL key -> .rpt file + backing SP/view + its
//        // parameters. Filenames must match exactly what's in the Reports
//        // folder, spaces included. Source: report inventory table + the
//        // three stored proc signatures shared earlier.
//        private static readonly Dictionary<string, ReportDefinition> Reports =
//            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
//            {
//                ["rbp"] = new ReportDefinition
//                {
//                    RptFileName = "RBP.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBP",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["extract-pcmiow"] = new ReportDefinition
//                {
//                    RptFileName = "ExtractPCMIOW.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "usp_extract_PC_MIOW_list",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
//                    }
//                },
//                ["rbp-summary-report"] = new ReportDefinition
//                {
//                    RptFileName = "RBP Summary Report.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummary"
//                },
//                ["rbp-summary-report-with-tier"] = new ReportDefinition
//                {
//                    RptFileName = "RBP Summary Report with Tier.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
//                },
//                ["aip-official"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-official-without-ld"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official_without_LD.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive-2"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive2.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!Reports.TryGetValue(reportName, out var definition))
//                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            var dataTable = LoadData(definition, parameters);

//            using (var report = new ReportDocument())
//            {
//                report.Load(rptPath);

//                // We're supplying live data directly below, so this just
//                // makes sure Crystal doesn't try to fall back to whatever
//                // was saved in the file at design time.
//                report.ReportOptions.EnableSaveDataWithReport = false;

//                report.SetDataSource(dataTable);

//                // SetDataSource above only supplies the row data. A .rpt can
//                // separately define its own Crystal "report parameters" used
//                // for display purposes (title, as-of-date, etc.) that have
//                // nothing to do with the SQL data source - those still need
//                // to be set explicitly, or Crystal throws "Missing parameter
//                // values" during export regardless of the data being present.
//                ApplyReportLevelParameters(report, parameters);

//                // NOTE: if any of these reports have subreports with their
//                // OWN separate data source, SetDataSource on the main report
//                // does not feed them - they'd need their own query + their
//                // own report.Subreports[i].SetDataSource(...) call. None of
//                // the 8 reports were noted as having subreports so far.

//                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                using (var buffer = new MemoryStream())
//                {
//                    // Crystal's ExportToStream doesn't guarantee the stream is
//                    // positioned at the start - without this, CopyTo silently
//                    // copies zero bytes.
//                    exportStream.Position = 0;
//                    exportStream.CopyTo(buffer);
//                    return buffer.ToArray();
//                }
//            }
//        }

//        /// <summary>
//        /// Runs the report's backing stored proc or view directly via
//        /// ADO.NET and returns the result as a DataTable ready to hand to
//        /// Crystal via SetDataSource.
//        /// </summary>
//        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            using (var connection = new SqlConnection(_connectionString))
//            using (var command = connection.CreateCommand())
//            {
//                if (definition.SourceType == DataSourceType.StoredProcedure)
//                {
//                    command.CommandType = CommandType.StoredProcedure;
//                    command.CommandText = definition.DbObjectName;

//                    var missing = new List<string>();

//                    foreach (var paramDef in definition.Parameters)
//                    {
//                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
//                                       && rawValue != null
//                                       && !string.IsNullOrEmpty(rawValue.ToString());

//                        if (!hasValue)
//                        {
//                            if (paramDef.IsRequired)
//                                missing.Add(paramDef.Name);

//                            // Optional + not supplied: don't add the SqlParameter
//                            // at all, so the proc's own SQL default (= NULL) applies.
//                            continue;
//                        }

//                        object sqlValue;
//                        try
//                        {
//                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
//                        }
//                        catch (FormatException)
//                        {
//                            throw new ArgumentException(
//                                $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
//                        }

//                        var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
//                        sqlParam.Value = sqlValue;
//                    }

//                    if (missing.Count > 0)
//                    {
//                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
//                        var supplied = string.Join(", ", parameters.Keys);
//                        throw new ArgumentException(
//                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                            $"Expected: [{expected}]. Supplied: [{supplied}].");
//                    }
//                }
//                else // View
//                {
//                    command.CommandType = CommandType.Text;
//                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
//                    // Views in this inventory take no parameters. If a view
//                    // needs filtering later, add a WHERE clause built from
//                    // validated/whitelisted parameter names here - never
//                    // string-concatenate raw user input into SQL text.
//                }

//                var dataTable = new DataTable();
//                using (var adapter = new SqlDataAdapter(command))
//                {
//                    adapter.Fill(dataTable);
//                }
//                return dataTable;
//            }
//        }

//        /// <summary>
//        /// Sets any Crystal-level report parameter the .rpt defines and that
//        /// was supplied in the request. These are independent of the SQL
//        /// data source - a report can define display-only parameters (title,
//        /// as-of-date, etc.) that Crystal still requires a value for before
//        /// it will export, even when SetDataSource already supplied the rows.
//        /// Parameters the report doesn't define are ignored. Parameters the
//        /// report defines but weren't supplied and have no existing default
//        /// will cause Crystal's own "Missing parameter values" error at
//        /// export time - if that happens, the report defines a parameter
//        /// this list doesn't know about yet; check report.DataDefinition.ParameterFields
//        /// in the Designer to find its exact name.
//        /// </summary>
//        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                if (!parameters.TryGetValue(pf.Name, out var rawValue) || rawValue == null)
//                    continue; // not supplied - leave as-is (report may already have a default)

//                var stringValue = rawValue.ToString();
//                if (string.IsNullOrEmpty(stringValue))
//                    continue;

//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertToCrystalValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Report parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }
//        }

//        private static object ConvertToCrystalValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue;
//            }
//        }

//        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
//        {
//            switch (dbType)
//            {
//                case SqlDbType.Int:
//                case SqlDbType.SmallInt:
//                case SqlDbType.TinyInt:
//                case SqlDbType.BigInt:
//                    return int.Parse(stringValue);

//                case SqlDbType.Decimal:
//                case SqlDbType.Money:
//                case SqlDbType.SmallMoney:
//                    return decimal.Parse(stringValue);

//                case SqlDbType.Bit:
//                    return bool.Parse(stringValue);

//                case SqlDbType.Date:
//                case SqlDbType.DateTime:
//                case SqlDbType.DateTime2:
//                case SqlDbType.SmallDateTime:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
//            }
//        }
//    }
//}


//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;
//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Source type for a report's data - determines how we build the SQL
//    /// command before handing the resulting DataTable to Crystal.
//    /// </summary>
//    public enum DataSourceType
//    {
//        StoredProcedure,
//        View
//    }

//    /// <summary>
//    /// One SQL parameter a stored proc expects. IsRequired mirrors whether the
//    /// proc has a SQL default (e.g. "= NULL") - required params missing from
//    /// the request fail fast with a clear message instead of a SQL error.
//    /// </summary>
//    public class SqlParamDefinition
//    {
//        public string Name { get; set; }
//        public SqlDbType DbType { get; set; }
//        public bool IsRequired { get; set; } = true;
//    }

//    /// <summary>
//    /// Everything needed to render one report: which .rpt file, which
//    /// stored proc/view backs it, and (for stored procs) what parameters
//    /// it expects.
//    /// </summary>
//    public class ReportDefinition
//    {
//        public string RptFileName { get; set; }
//        public DataSourceType SourceType { get; set; }
//        public string DbObjectName { get; set; }
//        public List<SqlParamDefinition> Parameters { get; set; } = new List<SqlParamDefinition>();
//    }

//    /// <summary>
//    /// Loads a .rpt file, runs its backing stored proc/view directly via
//    /// ADO.NET, and hands Crystal a plain DataTable via SetDataSource -
//    /// bypassing Crystal's own database connectivity entirely. This avoids
//    /// the ".rpt has stale data saved with it" problem, and puts us in full
//    /// control of the SQL instead of relying on Crystal's stored-proc
//    /// parameter binding.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Report inventory: URL key -> .rpt file + backing SP/view + its
//        // parameters. Filenames must match exactly what's in the Reports
//        // folder, spaces included. Source: report inventory table + the
//        // three stored proc signatures shared earlier.
//        private static readonly Dictionary<string, ReportDefinition> Reports =
//            new Dictionary<string, ReportDefinition>(StringComparer.OrdinalIgnoreCase)
//            {
//                ["rbp"] = new ReportDefinition
//                {
//                    RptFileName = "RBP.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "sp_RBP",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = false },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["extract-pcmiow"] = new ReportDefinition
//                {
//                    RptFileName = "ExtractPCMIOW.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "usp_extract_PC_MIOW_list",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = true }
//                    }
//                },
//                ["rbp-summary-report"] = new ReportDefinition
//                {
//                    RptFileName = "RBP Summary Report.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummary"
//                },
//                ["rbp-summary-report-with-tier"] = new ReportDefinition
//                {
//                    RptFileName = "RBP Summary Report with Tier.rpt",
//                    SourceType = DataSourceType.View,
//                    DbObjectName = "MYPS_vw_rptRBPSummaryTier"
//                },
//                ["aip-official"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-official-without-ld"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Official_without_LD.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                },
//                ["aip-executive-2"] = new ReportDefinition
//                {
//                    RptFileName = "AIP_Executive2.rpt",
//                    SourceType = DataSourceType.StoredProcedure,
//                    DbObjectName = "a1_usp_AIP2",
//                    Parameters = new List<SqlParamDefinition>
//                    {
//                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
//                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
//                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.VarChar, IsRequired = false }
//                    }
//                }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!Reports.TryGetValue(reportName, out var definition))
//                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            var dataTable = LoadData(definition, parameters);

//            using (var report = new ReportDocument())
//            {
//                report.Load(rptPath);

//                // We're supplying live data directly below, so this just
//                // makes sure Crystal doesn't try to fall back to whatever
//                // was saved in the file at design time.
//                report.ReportOptions.EnableSaveDataWithReport = false;

//                report.SetDataSource(dataTable);

//                // NOTE: if any of these reports have subreports with their
//                // OWN separate data source, SetDataSource on the main report
//                // does not feed them - they'd need their own query + their
//                // own report.Subreports[i].SetDataSource(...) call. None of
//                // the 8 reports were noted as having subreports so far.

//                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                using (var buffer = new MemoryStream())
//                {
//                    // Crystal's ExportToStream doesn't guarantee the stream is
//                    // positioned at the start - without this, CopyTo silently
//                    // copies zero bytes.
//                    exportStream.Position = 0;
//                    exportStream.CopyTo(buffer);
//                    return buffer.ToArray();
//                }
//            }
//        }

//        /// <summary>
//        /// Runs the report's backing stored proc or view directly via
//        /// ADO.NET and returns the result as a DataTable ready to hand to
//        /// Crystal via SetDataSource.
//        /// </summary>
//        private DataTable LoadData(ReportDefinition definition, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

//            using (var connection = new SqlConnection(_connectionString))
//            using (var command = connection.CreateCommand())
//            {
//                if (definition.SourceType == DataSourceType.StoredProcedure)
//                {
//                    command.CommandType = CommandType.StoredProcedure;
//                    command.CommandText = definition.DbObjectName;

//                    var missing = new List<string>();

//                    foreach (var paramDef in definition.Parameters)
//                    {
//                        var hasValue = parameters.TryGetValue(paramDef.Name, out var rawValue)
//                                       && rawValue != null
//                                       && !string.IsNullOrEmpty(rawValue.ToString());

//                        if (!hasValue)
//                        {
//                            if (paramDef.IsRequired)
//                                missing.Add(paramDef.Name);

//                            // Optional + not supplied: don't add the SqlParameter
//                            // at all, so the proc's own SQL default (= NULL) applies.
//                            continue;
//                        }

//                        object sqlValue;
//                        try
//                        {
//                            sqlValue = ConvertToSqlValue(rawValue.ToString(), paramDef.DbType);
//                        }
//                        catch (FormatException)
//                        {
//                            throw new ArgumentException(
//                                $"Parameter '{paramDef.Name}' received value '{rawValue}', which isn't a valid {paramDef.DbType}.");
//                        }

//                        var sqlParam = command.Parameters.Add("@" + paramDef.Name, paramDef.DbType);
//                        sqlParam.Value = sqlValue;
//                    }

//                    if (missing.Count > 0)
//                    {
//                        var expected = string.Join(", ", definition.Parameters.Select(p => p.Name));
//                        var supplied = string.Join(", ", parameters.Keys);
//                        throw new ArgumentException(
//                            $"'{definition.DbObjectName}' requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                            $"Expected: [{expected}]. Supplied: [{supplied}].");
//                    }
//                }
//                else // View
//                {
//                    command.CommandType = CommandType.Text;
//                    command.CommandText = $"SELECT * FROM {definition.DbObjectName}";
//                    // Views in this inventory take no parameters. If a view
//                    // needs filtering later, add a WHERE clause built from
//                    // validated/whitelisted parameter names here - never
//                    // string-concatenate raw user input into SQL text.
//                }

//                var dataTable = new DataTable();
//                using (var adapter = new SqlDataAdapter(command))
//                {
//                    adapter.Fill(dataTable);
//                }
//                return dataTable;
//            }
//        }

//        private static object ConvertToSqlValue(string stringValue, SqlDbType dbType)
//        {
//            switch (dbType)
//            {
//                case SqlDbType.Int:
//                case SqlDbType.SmallInt:
//                case SqlDbType.TinyInt:
//                case SqlDbType.BigInt:
//                    return int.Parse(stringValue);

//                case SqlDbType.Decimal:
//                case SqlDbType.Money:
//                case SqlDbType.SmallMoney:
//                    return decimal.Parse(stringValue);

//                case SqlDbType.Bit:
//                    return bool.Parse(stringValue);

//                case SqlDbType.Date:
//                case SqlDbType.DateTime:
//                case SqlDbType.DateTime2:
//                case SqlDbType.SmallDateTime:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // VarChar, NVarChar, etc. pass through as-is
//            }
//        }
//    }
//}

//ON HOLD ----------------------------------------------------------------------------------------------------
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;
//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data.SqlClient;
//using System.Drawing;
//using System.IO;
//using System.Web.Hosting;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Loads a .rpt file whose data source is a stored procedure, applies the
//    /// SQL connection + parameter values, and exports to PDF.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Maps the short report name used in the URL to the actual .rpt file on disk.
//        // Filenames must match exactly what's in the Reports folder, spaces included.
//        //
//        // Data source reference (from report inventory):
//        //   rbp                          -> RBP.rpt                          -> sp_RBP (stored proc)
//        //   extract-pcmiow                -> ExtractPCMIOW.rpt                -> usp_extract_PC_MIOW_list (stored proc)
//        //   rbp-summary-report            -> RBP Summary Report.rpt           -> MYPS_vw_rptRBPSummary (VIEW - no SP params, check Record Selection Formula)
//        //   rbp-summary-report-with-tier  -> RBP Summary Report with Tier.rpt -> MYPS_vw_rptRBPSummaryTier (VIEW - no SP params, check Record Selection Formula)
//        //   aip-official                  -> AIP_Official.rpt                 -> a1_usp_AIP2 (stored proc)
//        //   aip-executive                 -> AIP_Executive.rpt                -> a1_usp_AIP2 (stored proc, same source as aip-official)
//        //   aip-official-without-ld       -> AIP_Official_without_LD.rpt      -> a1_usp_AIP2 (stored proc, same source as aip-official)
//        //   aip-executive-2               -> AIP_Executive2.rpt               -> UNKNOWN - not in report inventory, confirm data source before use
//        private static readonly Dictionary<string, string> ReportMap =
//            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
//            {
//                { "rbp", "RBP.rpt" },
//                { "aip-official-without-ld", "AIP_Official_without_LD.rpt" },
//                { "aip-executive", "AIP_Executive.rpt" },
//                { "extract-pcmiow", "ExtractPCMIOW.rpt" },
//                { "rbp-summary-report", "RBP Summary Report.rpt" },
//                { "rbp-summary-report-with-tier", "RBP Summary Report with Tier.rpt" },
//                { "aip-official", "AIP_Official.rpt" },
//                { "aip-executive-2", "AIP_Executive2.rpt" }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            // HostingEnvironment.MapPath works outside of a request context
//            // (unlike Server.MapPath), which matters since this runs from a
//            // plain service class, not a controller.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!ReportMap.TryGetValue(reportName, out var fileName))
//                throw new FileNotFoundException($"No .rpt mapped for report name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, fileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            using (var report = new ReportDocument())
//            {
//                report.Load(rptPath);

//                ApplyDatabaseLogon(report);
//                ApplyParameters(report, parameters);

//                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                using (var buffer = new MemoryStream())
//                {
//                    exportStream.Position = 0;
//                    exportStream.CopyTo(buffer);
//                    return buffer.ToArray();
//                }
//            }
//        }

//        /// <summary>
//        /// Points the report's data source (the stored proc) at the actual
//        /// SQL Server instance/db/credentials, instead of whatever was baked
//        /// in at design time. Applies to the main report and any subreports.
//        /// </summary>
//        private void ApplyDatabaseLogon(ReportDocument report)
//        {
//            var builder = new SqlConnectionStringBuilder(_connectionString);

//            var connectionInfo = new ConnectionInfo
//            {
//                ServerName = builder.DataSource,
//                DatabaseName = builder.InitialCatalog,
//                UserID = builder.UserID,
//                Password = builder.Password,
//                IntegratedSecurity = builder.IntegratedSecurity
//            };

//            ApplyLogOnToTables(report.Database.Tables, connectionInfo);

//            foreach (ReportDocument subreport in report.Subreports)
//            {
//                ApplyLogOnToTables(subreport.Database.Tables, connectionInfo);
//            }
//        }

//        private void ApplyLogOnToTables(Tables tables, ConnectionInfo connectionInfo)
//        {
//            foreach (Table table in tables)
//            {
//                var logOnInfo = table.LogOnInfo;
//                logOnInfo.ConnectionInfo = connectionInfo;
//                table.ApplyLogOnInfo(logOnInfo);
//            }
//        }

//        /// <summary>
//        /// Sets any parameter the report actually defines (i.e. what feeds the
//        /// stored proc's params). Unknown query-string keys are ignored rather
//        /// than throwing. Values are converted to match the parameter's
//        /// declared type (e.g. @yearstart/@categoryid are INT in SQL, but
//        /// everything from the query string arrives as a raw string) --
//        /// passing a string into a numeric Crystal parameter can otherwise
//        /// throw a type-mismatch error at render time.
//        /// </summary>
//        private void ApplyParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            if (parameters == null) return;

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                if (!parameters.TryGetValue(pf.Name, out var rawValue) || rawValue == null)
//                    continue; // param not supplied - leave unset (matters for optional SP params like @region)

//                var stringValue = rawValue.ToString();
//                if (string.IsNullOrEmpty(stringValue))
//                    continue;

//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertParameterValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }
//        }

//        private static object ConvertParameterValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // StringField and anything else passes through as-is
//            }
//        }
//    }
//}

//TO GET THE PARAMETERS -----------------------------------------------------------------------------------
//using System;
//using System.Collections.Generic;
//using System.Configuration;
//using System.Data.SqlClient;
//using System.IO;
//using System.Linq;
//using System.Web.Hosting;
//using CrystalDecisions.CrystalReports.Engine;
//using CrystalDecisions.Shared;

//namespace CrystalReportService.Services
//{
//    public interface ICrystalReportRenderer
//    {
//        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
//    }

//    /// <summary>
//    /// Loads a .rpt file whose data source is a stored procedure, applies the
//    /// SQL connection + parameter values, and exports to PDF.
//    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
//    /// </summary>
//    public class CrystalReportRenderer : ICrystalReportRenderer
//    {
//        // Maps the short report name used in the URL to the actual .rpt file on disk.
//        // Filenames must match exactly what's in the Reports folder, spaces included.
//        //
//        // Data source reference (from report inventory):
//        //   rbp                          -> RBP.rpt                          -> sp_RBP (stored proc)
//        //   extract-pcmiow                -> ExtractPCMIOW.rpt                -> usp_extract_PC_MIOW_list (stored proc)
//        //   rbp-summary-report            -> RBP Summary Report.rpt           -> MYPS_vw_rptRBPSummary (VIEW - no SP params, check Record Selection Formula)
//        //   rbp-summary-report-with-tier  -> RBP Summary Report with Tier.rpt -> MYPS_vw_rptRBPSummaryTier (VIEW - no SP params, check Record Selection Formula)
//        //   aip-official                  -> AIP_Official.rpt                 -> a1_usp_AIP2 (stored proc)
//        //   aip-executive                 -> AIP_Executive.rpt                -> a1_usp_AIP2 (stored proc, same source as aip-official)
//        //   aip-official-without-ld       -> AIP_Official_without_LD.rpt      -> a1_usp_AIP2 (stored proc, same source as aip-official)
//        //   aip-executive-2               -> AIP_Executive2.rpt               -> UNKNOWN - not in report inventory, confirm data source before use
//        private static readonly Dictionary<string, string> ReportMap =
//            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
//            {
//                { "rbp", "RBP.rpt" },
//                { "aip-official-without-ld", "AIP_Official_without_LD.rpt" },
//                { "aip-executive", "AIP_Executive.rpt" },
//                { "extract-pcmiow", "ExtractPCMIOW.rpt" },
//                { "rbp-summary-report", "RBP Summary Report.rpt" },
//                { "rbp-summary-report-with-tier", "RBP Summary Report with Tier.rpt" },
//                { "aip-official", "AIP_Official.rpt" },
//                { "aip-executive-2", "AIP_Executive2.rpt" }
//            };

//        private readonly string _reportsFolder;
//        private readonly string _connectionString;

//        public CrystalReportRenderer()
//        {
//            // .rpt files live in the project's own /Reports folder and deploy
//            // with the app, so this is resolved relative to the app root
//            // rather than read from an absolute path in Web.config.
//            // HostingEnvironment.MapPath works outside of a request context
//            // (unlike Server.MapPath), which matters since this runs from a
//            // plain service class, not a controller.
//            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
//            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
//        }

//        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
//        {
//            if (!ReportMap.TryGetValue(reportName, out var fileName))
//                throw new FileNotFoundException($"No .rpt mapped for report name '{reportName}'.");

//            var rptPath = Path.Combine(_reportsFolder, fileName);
//            if (!File.Exists(rptPath))
//                throw new FileNotFoundException($"Report file not found: {rptPath}");

//            using (var report = new ReportDocument())
//            {
//                report.Load(rptPath);

//                ApplyDatabaseLogon(report);
//                ApplyParameters(report, parameters);

//                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
//                using (var buffer = new MemoryStream())
//                {
//                    // Crystal's ExportToStream doesn't guarantee the stream is
//                    // positioned at the start - without this, CopyTo silently
//                    // copies zero bytes (exactly the empty-PDF symptom).
//                    exportStream.Position = 0;
//                    exportStream.CopyTo(buffer);
//                    return buffer.ToArray();
//                }
//            }
//        }

//        /// <summary>
//        /// Points the report's data source (the stored proc) at the actual
//        /// SQL Server instance/db/credentials, instead of whatever was baked
//        /// in at design time. Applies to the main report and any subreports.
//        /// </summary>
//        private void ApplyDatabaseLogon(ReportDocument report)
//        {
//            var builder = new SqlConnectionStringBuilder(_connectionString);

//            var connectionInfo = new ConnectionInfo
//            {
//                ServerName = builder.DataSource,
//                DatabaseName = builder.InitialCatalog,
//                UserID = builder.UserID,
//                Password = builder.Password,
//                IntegratedSecurity = builder.IntegratedSecurity
//            };

//            ApplyLogOnToTables(report.Database.Tables, connectionInfo);

//            foreach (ReportDocument subreport in report.Subreports)
//            {
//                ApplyLogOnToTables(subreport.Database.Tables, connectionInfo);
//            }
//        }

//        private void ApplyLogOnToTables(Tables tables, ConnectionInfo connectionInfo)
//        {
//            foreach (Table table in tables)
//            {
//                var logOnInfo = table.LogOnInfo;
//                logOnInfo.ConnectionInfo = connectionInfo;
//                table.ApplyLogOnInfo(logOnInfo);
//            }
//        }

//        /// <summary>
//        /// Sets any parameter the report actually defines (i.e. what feeds the
//        /// stored proc's params). Unknown query-string keys are ignored rather
//        /// than throwing. Values are converted to match the parameter's
//        /// declared type (e.g. @yearstart/@categoryid are INT in SQL, but
//        /// everything from the query string arrives as a raw string) --
//        /// passing a string into a numeric Crystal parameter can otherwise
//        /// throw a type-mismatch error at render time.
//        /// </summary>
//        private void ApplyParameters(ReportDocument report, IDictionary<string, object> parameters)
//        {
//            parameters = parameters ?? new Dictionary<string, object>();
//            var missing = new List<string>();

//            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
//            {
//                if (!parameters.TryGetValue(pf.Name, out var rawValue) || rawValue == null || string.IsNullOrEmpty(rawValue.ToString()))
//                {
//                    // Optional parameters (marked "Optional Prompt" in the Designer)
//                    // don't need a value - anything else does.
//                    if (!pf.EnableAllowEditingDefaultValue && pf.HasCurrentValue)
//                        continue;

//                    missing.Add(pf.Name);
//                    continue;
//                }

//                var stringValue = rawValue.ToString();
//                object convertedValue;
//                try
//                {
//                    convertedValue = ConvertParameterValue(stringValue, pf.ValueType);
//                }
//                catch (FormatException)
//                {
//                    throw new ArgumentException(
//                        $"Parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
//                }

//                report.SetParameterValue(pf.Name, convertedValue);
//            }

//            if (missing.Count > 0)
//            {
//                var defined = string.Join(", ", report.DataDefinition.ParameterFields.Cast<ParameterFieldDefinition>().Select(p => p.Name));
//                var supplied = string.Join(", ", parameters.Keys);
//                throw new ArgumentException(
//                    $"Report requires parameter(s) not supplied: {string.Join(", ", missing)}. " +
//                    $"Report defines: [{defined}]. Query string supplied: [{supplied}].");
//            }
//        }

//        private static object ConvertParameterValue(string stringValue, FieldValueType valueType)
//        {
//            switch (valueType)
//            {
//                case FieldValueType.NumberField:
//                case FieldValueType.Int8sField:
//                case FieldValueType.Int8uField:
//                case FieldValueType.Int16sField:
//                case FieldValueType.Int16uField:
//                case FieldValueType.Int32sField:
//                case FieldValueType.Int32uField:
//                    return int.Parse(stringValue);

//                case FieldValueType.CurrencyField:
//                    return decimal.Parse(stringValue);

//                case FieldValueType.BooleanField:
//                    return bool.Parse(stringValue);

//                case FieldValueType.DateField:
//                case FieldValueType.DateTimeField:
//                    return DateTime.Parse(stringValue);

//                default:
//                    return stringValue; // StringField and anything else passes through as-is
//            }
//        }
//    }
//}