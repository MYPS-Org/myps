using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.SqlClient;
using System.Drawing;
using System.IO;
using System.Web.Hosting;

namespace CrystalReportService.Services
{
    public interface ICrystalReportRenderer
    {
        byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters);
    }

    /// <summary>
    /// Loads a .rpt file whose data source is a stored procedure, applies the
    /// SQL connection + parameter values, and exports to PDF.
    /// Requires the SAP Crystal Reports runtime to be installed on this machine.
    /// </summary>
    public class CrystalReportRenderer : ICrystalReportRenderer
    {
        // Maps the short report name used in the URL to the actual .rpt file on disk.
        // Filenames must match exactly what's in the Reports folder, spaces included.
        //
        // Data source reference (from report inventory):
        //   rbp                          -> RBP.rpt                          -> sp_RBP (stored proc)
        //   extract-pcmiow                -> ExtractPCMIOW.rpt                -> usp_extract_PC_MIOW_list (stored proc)
        //   rbp-summary-report            -> RBP Summary Report.rpt           -> MYPS_vw_rptRBPSummary (VIEW - no SP params, check Record Selection Formula)
        //   rbp-summary-report-with-tier  -> RBP Summary Report with Tier.rpt -> MYPS_vw_rptRBPSummaryTier (VIEW - no SP params, check Record Selection Formula)
        //   aip-official                  -> AIP_Official.rpt                 -> a1_usp_AIP2 (stored proc)
        //   aip-executive                 -> AIP_Executive.rpt                -> a1_usp_AIP2 (stored proc, same source as aip-official)
        //   aip-official-without-ld       -> AIP_Official_without_LD.rpt      -> a1_usp_AIP2 (stored proc, same source as aip-official)
        //   aip-executive-2               -> AIP_Executive2.rpt               -> UNKNOWN - not in report inventory, confirm data source before use
        private static readonly Dictionary<string, string> ReportMap =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "rbp", "RBP.rpt" },
                { "aip-official-without-ld", "AIP_Official_without_LD.rpt" },
                { "aip-executive", "AIP_Executive.rpt" },
                { "extract-pcmiow", "ExtractPCMIOW.rpt" },
                { "rbp-summary-report", "RBP Summary Report.rpt" },
                { "rbp-summary-report-with-tier", "RBP Summary Report with Tier.rpt" },
                { "aip-official", "AIP_Official.rpt" },
                { "aip-executive-2", "AIP_Executive2.rpt" }
            };

        private readonly string _reportsFolder;
        private readonly string _connectionString;

        public CrystalReportRenderer()
        {
            // .rpt files live in the project's own /Reports folder and deploy
            // with the app, so this is resolved relative to the app root
            // rather than read from an absolute path in Web.config.
            // HostingEnvironment.MapPath works outside of a request context
            // (unlike Server.MapPath), which matters since this runs from a
            // plain service class, not a controller.
            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
        }

        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
        {
            if (!ReportMap.TryGetValue(reportName, out var fileName))
                throw new FileNotFoundException($"No .rpt mapped for report name '{reportName}'.");

            var rptPath = Path.Combine(_reportsFolder, fileName);
            if (!File.Exists(rptPath))
                throw new FileNotFoundException($"Report file not found: {rptPath}");

            using (var report = new ReportDocument())
            {
                report.Load(rptPath);

                ApplyDatabaseLogon(report);
                ApplyParameters(report, parameters);

                using (var exportStream = report.ExportToStream(ExportFormatType.PortableDocFormat))
                using (var buffer = new MemoryStream())
                {
                    exportStream.CopyTo(buffer);
                    return buffer.ToArray();
                }
            }
        }

        /// <summary>
        /// Points the report's data source (the stored proc) at the actual
        /// SQL Server instance/db/credentials, instead of whatever was baked
        /// in at design time. Applies to the main report and any subreports.
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
        /// Sets any parameter the report actually defines (i.e. what feeds the
        /// stored proc's params). Unknown query-string keys are ignored rather
        /// than throwing. Values are converted to match the parameter's
        /// declared type (e.g. @yearstart/@categoryid are INT in SQL, but
        /// everything from the query string arrives as a raw string) --
        /// passing a string into a numeric Crystal parameter can otherwise
        /// throw a type-mismatch error at render time.
        /// </summary>
        private void ApplyParameters(ReportDocument report, IDictionary<string, object> parameters)
        {
            if (parameters == null) return;

            foreach (ParameterFieldDefinition pf in report.DataDefinition.ParameterFields)
            {
                if (!parameters.TryGetValue(pf.Name, out var rawValue) || rawValue == null)
                    continue; // param not supplied - leave unset (matters for optional SP params like @region)

                var stringValue = rawValue.ToString();
                if (string.IsNullOrEmpty(stringValue))
                    continue;

                object convertedValue;
                try
                {
                    convertedValue = ConvertParameterValue(stringValue, pf.ValueType);
                }
                catch (FormatException)
                {
                    throw new ArgumentException(
                        $"Parameter '{pf.Name}' received value '{stringValue}', which isn't a valid {pf.ValueType}.");
                }

                report.SetParameterValue(pf.Name, convertedValue);
            }
        }

        private static object ConvertParameterValue(string stringValue, FieldValueType valueType)
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
                    return stringValue; // StringField and anything else passes through as-is
            }
        }
    }
}