using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Hosting;
using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using CrystalReportService.Diagnostics;

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

        /// <summary>
        /// Opt-out for CorrectStoredProcedureTableLocation, scoped per-report so it can never
        /// affect any other StoredProcedure-backed report. Needed for reports whose .rpt has
        /// already been correctly rebound in Designer to a real connection (not the stale ODBC
        /// DSN this correction step exists to work around) -- Crystal's own Location for a
        /// stored-proc table is "{name};{n}" (e.g. "sp_RBPSummary;1"), and the bare-name
        /// equality check in that method would otherwise treat the correct, Designer-set value
        /// as stale and strip the ";1" suffix, breaking ExportToStream. Default false so every
        /// other report keeps today's behavior unchanged.
        /// </summary>
        public bool SkipLocationCorrection { get; set; } = false;

        /// <summary>
        /// Report-level Crystal parameter names (see <see cref="ApplyReportLevelParameters"/>)
        /// that are allowed to default to an empty string instead of failing the request when
        /// not supplied. Case-insensitive, matched against whatever the .rpt itself defines --
        /// scoped per-report so it can never affect a report that hasn't opted in. Only applied
        /// to StringField parameters; a number/date/currency report-level parameter has no
        /// sensible empty default, so those stay required even if accidentally listed here.
        /// </summary>
        public HashSet<string> OptionalReportLevelParameters { get; set; } =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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
                    },
                    // #422: Planning Engineer / Approver / Reviewer should not block report
                    // generation. FE and WebAPI already treat these as optional; RBP.rpt's own
                    // report-level parameters (PascalCase, including the existing ReviewdBy typo)
                    // were the only remaining blocker.
                    OptionalReportLevelParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "PlanningEngineer", "ReviewdBy", "ApprovedBy", "ReviewedBy"
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
                    // Switched back to StoredProcedure 2026-09-07 (operator decision). The View
                    // path (MYPS_vw_rptRBPSummary) kept failing at ExportToStream: the .rpt's own
                    // saved Table.Location is the bare name "sp_RBPSummaryTier" -- a stale
                    // reference from before this report was pointed at the view, and setting
                    // Location to the correct value at runtime hit a separate Crystal SDK
                    // connection-validation failure in Table.set_Location. Reverting to
                    // StoredProcedure sidesteps ApplyDatabaseLogon/Location entirely -- it's only
                    // invoked for View-backed reports (see RenderToPdf) -- matching the 6 other
                    // SP-backed reports that already work without it.
                    //
                    // sp_RBPSummary confirmed live on myps_db_dev (2026-09-07): exists, executes,
                    // returns real rows. Its current signature is NOT the legacy 3-parameter
                    // version (@yearstart/@programid/@region) -- it has been independently
                    // rewritten against the current schema (tProjectRevisions/tProjectComponentCost
                    // etc.) with only @programid, and is documented in this file's own
                    // CRYSTAL_REPORT_GENERATION.md as a separate, still-in-progress object (a
                    // commented-out @StageName parameter and validation block). @yearstart/@region
                    // are NOT SQL parameters here -- they stay report-level Crystal parameters
                    // only (letterhead), same as before.
                    //
                    // Diagnostic swap to RBPSummaryReport.rpt (2026-09-08) confirmed the
                    // Table.set_Location "Logon failed" COMException is systemic, not specific
                    // to this report's own saved metadata -- an unrelated, empty 64KB .rpt hit
                    // the identical error at the identical stack location. Reverted here.
                    //
                    // .rpt rebound in Crystal Designer 2026-09-08 (real Designer access, not the
                    // stale ODBC DSN): Set Datasource Location -> OLE DB (ADO) -> SQL Server
                    // (SQLOLEDB) -> 192.168.50.200/myps_db_dev -> Stored Procedures. Confirmed
                    // live via DumpConnectionMetadata: ConnectionInfo now genuinely SQLOLEDB/ADO,
                    // not CRQE/ODBC-RDO. SkipLocationCorrection=true because the bare-name
                    // equality check in CorrectStoredProcedureTableLocation doesn't know
                    // "{name};1" is Crystal's own correct form for a stored-proc Location -- it
                    // was stripping the ";1" and breaking the working export. Scoped to this
                    // report only; the other 6 StoredProcedure reports still get the correction.
                    //
                    // DbObjectName switched to sp_RBPSummaryTier same day (operator decision --
                    // share one proc between this report and rbp-summary-report-with-tier
                    // instead of maintaining sp_RBPSummary separately). sp_RBPSummaryTier
                    // mirrors MYPS_vw_rptRBPSummaryTier's already-validated logic plus
                    // TotalNo/TotalAmount added to match this report's existing field bindings
                    // (backups: Main/Resources/Internal/SQLScripts/
                    // sp_RBPSummaryTier_backup_pre_totals_20260908.sql). The now-unused
                    // sp_RBPSummary was deliberately left in place rather than dropped (backed
                    // up as sp_RBPSummary_backup_20260908 and
                    // sp_RBPSummary_backup_pre_tier_alignment_20260908.sql) -- orphaned-but-
                    // harmless beats a one-way deletion. .rpt needs its OWN Designer rebind to
                    // sp_RBPSummaryTier to match -- this C# change alone is not sufficient.
                    RptFileName = "RBP Summary Report.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "sp_RBPSummaryTier",
                    SkipLocationCorrection = true,
                    // yearstart/region added here 2026-09-08 alongside the sp_RBPSummaryTier
                    // switch -- its parameter signature was matched to the legacy proc
                    // (@yearstart INT required, @programid/@region optional) per operator
                    // instruction, and @yearstart has no SQL default, so LoadData must actually
                    // supply it or the call fails with "Procedure expects parameter '@yearstart',
                    // which was not supplied." The request already carries both values (visible
                    // in every diagnostic capture's PARAMETERS section) -- they just weren't
                    // wired into this report's SQL parameter list before now.
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.NVarChar, IsRequired = false },
                        new SqlParamDefinition { Name = "region", DbType = SqlDbType.NVarChar, IsRequired = false }
                    },
                    // #422: same relaxation as "rbp" above, extended here per follow-up request --
                    // this report's .rpt uses camelCase report-level parameter names, unlike rbp's
                    // PascalCase ones (documented naming difference between the two .rpt families).
                    OptionalReportLevelParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "planningEngr", "reviewedBy", "approvedBy"
                    }
                },
                ["rbp-summary-report-with-tier"] = new ReportDefinition
                {
                    RptFileName = "RBP_Summary_Report_with_Tier.rpt",
                    SourceType = DataSourceType.View,
                    DbObjectName = "MYPS_vw_rptRBPSummaryTier",
                    // #422: same relaxation, same camelCase names as rbp-summary-report above.
                    OptionalReportLevelParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "planningEngr", "reviewedBy", "approvedBy"
                    }
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
        private readonly IReportDiagnosticLogger _diagnosticLogger;

        public CrystalReportRenderer() : this(new ReportDiagnosticLogger())
        {
        }

        public CrystalReportRenderer(IReportDiagnosticLogger diagnosticLogger)
        {
            // .rpt files live in the project's own /Reports folder and deploy
            // with the app, so this is resolved relative to the app root
            // rather than read from an absolute path in Web.config.
            _reportsFolder = HostingEnvironment.MapPath("~/Reports");
            _connectionString = ConfigurationManager.ConnectionStrings["MypsDb"].ConnectionString;
            _diagnosticLogger = diagnosticLogger;
        }

        /// <summary>Builds the diagnostic context shared by every LogRenderFailure-equivalent call site below.</summary>
        private static ReportDiagnosticContext BuildDiagnosticContext(
            string reportName, string failureLocation, ReportDefinition definition,
            IDictionary<string, object> parameters, string locationDiagnostics = null)
        {
            return new ReportDiagnosticContext
            {
                ReportName = reportName,
                FailureLocation = failureLocation,
                RptFileName = definition == null ? null : definition.RptFileName,
                SourceType = definition == null ? null : definition.SourceType.ToString(),
                DbObjectName = definition == null ? null : definition.DbObjectName,
                Parameters = parameters,
                TableLocationDiagnostics = locationDiagnostics
            };
        }

        public byte[] RenderToPdf(string reportName, IDictionary<string, object> parameters)
        {
            if (!Reports.TryGetValue(reportName, out var definition))
                throw new FileNotFoundException($"No report defined for name '{reportName}'.");

            var rptPath = Path.Combine(_reportsFolder, definition.RptFileName);
            if (!File.Exists(rptPath))
            {
                var missingFileEx = new FileNotFoundException($"Report file not found: {rptPath}");
                _diagnosticLogger.Log(missingFileEx, BuildDiagnosticContext(reportName, "Report file missing on disk", definition, parameters));
                throw missingFileEx;
            }

            var dataTable = LoadData(reportName, definition, parameters);

            using (var report = new ReportDocument())
            {
                try
                {
                    report.Load(rptPath);
                }
                catch (Exception ex)
                {
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, $"report.Load('{rptPath}')", definition, parameters));
                    throw new Exception($"Failed at report.Load('{rptPath}'): {ex.Message}", ex);
                }

                // Temporary instrumentation (2026-09-07): captures each table's saved connection
                // Type/Attributes exactly as Crystal loaded them from disk, before ApplyLogOnInfo
                // or Location are touched by anything below -- comparing this between
                // "RBP Summary Report.rpt" (fails at ExportToStream regardless of SourceType/
                // Location handling) and a known-working report should show what's structurally
                // different. Never throws; not gated to View, unlike the Location-rewrite logic.
                ReportDiagnosticLogger.LogInformational(reportName, DumpConnectionMetadata(report));

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
                // Temporary instrumentation (2026-09-07): captures every table's original and
                // rewritten Location regardless of outcome, carried into whichever catch block
                // below actually ends up logging -- ExportToStream can fail even after this step
                // succeeds cleanly, since Crystal re-resolves Location independently at export
                // time. Remove once the real cause of the still-failing View-backed exports is
                // found and fixed.
                var locationDiagnostics = new StringBuilder();

                if (definition.SourceType == DataSourceType.View)
                {
                    try
                    {
                        ApplyDatabaseLogon(report, locationDiagnostics, definition.DbObjectName);
                    }
                    catch (Exception ex)
                    {
                        _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, "ApplyDatabaseLogon", definition, parameters, locationDiagnostics.ToString()));
                        throw new Exception($"Failed at ApplyDatabaseLogon: {ex.Message}", ex);
                    }
                }
                else if (definition.SourceType == DataSourceType.StoredProcedure)
                {
                    // Mutually exclusive with the View branch above so this can never run
                    // right before ApplyDatabaseLogon's own "Authoritative" Location rewrite
                    // overwrites it. Confirmed root cause (2026-09-07): the .rpt's saved
                    // Table.Location can be stale (e.g. "RBP Summary Report.rpt" still said
                    // "sp_RBPSummaryTier", a defunct object) - Crystal re-resolves Location
                    // independently at ExportToStream regardless of SetDataSource below, so a
                    // stale value fails export outright. Proven fix shape via a live working
                    // report (rbp / sp_RBP): Location must be the BARE object name equal to
                    // DbObjectName, not a database-qualified string - ConnectionInfo/
                    // ApplyLogOnInfo are already correct and don't need touching.
                    //
                    // SkipLocationCorrection (per-report, default false) opts a report out of
                    // this entirely -- for a report whose .rpt was already correctly rebound in
                    // Designer, Crystal's own Location value (e.g. "sp_RBPSummary;1") is correct
                    // as-is, and this method's bare-name equality check would otherwise treat
                    // that ";1" suffix as staleness and strip it, breaking a working export.
                    if (!definition.SkipLocationCorrection)
                    {
                        try
                        {
                            CorrectStoredProcedureTableLocation(report, definition.DbObjectName, locationDiagnostics);
                        }
                        catch (Exception ex)
                        {
                            _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, "CorrectStoredProcedureTableLocation", definition, parameters, locationDiagnostics.ToString()));
                            throw new Exception($"Failed at CorrectStoredProcedureTableLocation: {ex.Message}", ex);
                        }
                    }
                    else
                    {
                        locationDiagnostics.AppendLine("  [MainReport] SkipLocationCorrection=true -- leaving Crystal's own Location value untouched.");
                    }
                }

                try
                {
                    report.SetDataSource(dataTable);
                }
                catch (Exception ex)
                {
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, $"report.SetDataSource (rows: {dataTable.Rows.Count})", definition, parameters, locationDiagnostics.ToString()));
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
                    ApplyReportLevelParameters(report, parameters, definition.OptionalReportLevelParameters);
                }
                catch (ArgumentException)
                {
                    throw; // already has a clear message - don't wrap it; caller-input error, not logged
                }
                catch (Exception ex)
                {
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, "ApplyReportLevelParameters", definition, parameters, locationDiagnostics.ToString()));
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
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, $"report.ExportToStream (rptPath='{rptPath}', exists: {File.Exists(rptPath)}, reportsFolder='{_reportsFolder}')", definition, parameters, locationDiagnostics.ToString()));
                    throw new Exception($"Failed at report.ExportToStream. rptPath='{rptPath}' (exists: {File.Exists(rptPath)}). reportsFolder='{_reportsFolder}'. Error: {ex.Message}", ex);
                }
            }
        }

        /// <summary>
        /// Temporary (2026-09-07): dumps each table's saved connection Type and Attributes exactly
        /// as loaded from disk -- no rewriting, called before ApplyLogOnInfo/Location are touched
        /// by anything. Purpose: compare "RBP Summary Report.rpt" (fails at ExportToStream no
        /// matter what SourceType/Location handling we apply) against a known-working report's
        /// table, to find what's structurally different instead of guessing at
        /// ConnectionInfo.Attributes QE_* keys blind. Remove once the real fix is found.
        /// </summary>
        private static string DumpConnectionMetadata(ReportDocument report)
        {
            var sb = new StringBuilder();

            try
            {
                sb.AppendLine("Table.Count: " + report.Database.Tables.Count);

                foreach (Table table in report.Database.Tables)
                {
                    sb.AppendLine("Table='" + table.Name + "' Location=[" + table.Location + "]");

                    try
                    {
                        var connectionInfo = table.LogOnInfo.ConnectionInfo;
                        sb.AppendLine("  ConnectionInfo.Type: " + connectionInfo.Type);
                        sb.AppendLine("  ConnectionInfo.ServerName: [" + connectionInfo.ServerName + "]");
                        sb.AppendLine("  ConnectionInfo.DatabaseName: [" + connectionInfo.DatabaseName + "]");
                        sb.AppendLine("  ConnectionInfo.IntegratedSecurity: " + connectionInfo.IntegratedSecurity);

                        var collection = connectionInfo.Attributes.Collection;
                        sb.AppendLine("  Attributes.Collection.Count: " + collection.Count);

                        foreach (NameValuePair2 pair in collection)
                        {
                            // QE_LogonProperties is itself a nested DbConnectionAttributes -- the
                            // provider-specific properties (e.g. Provider=SQLOLEDB, Data Source=...)
                            // that actually route the connection live one level deeper than a plain
                            // ToString() reaches.
                            var nested = pair.Value as DbConnectionAttributes;

                            if (nested != null)
                            {
                                sb.AppendLine("    " + pair.Name + " = (nested DbConnectionAttributes, " + nested.Collection.Count + " entries)");

                                foreach (NameValuePair2 nestedPair in nested.Collection)
                                {
                                    sb.AppendLine("      " + nestedPair.Name + " = " + nestedPair.Value);
                                }
                            }
                            else
                            {
                                sb.AppendLine("    " + pair.Name + " = " + pair.Value);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        sb.AppendLine("  (failed reading connection metadata: " + ex.Message + ")");
                    }
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine("(failed reading Database.Tables: " + ex.Message + ")");
            }

            return sb.ToString();
        }

        /// <summary>
        /// Points the report's own Database Expert connection info (server/
        /// database/credentials) at the real SQL Server, even though the
        /// actual row data comes from our own DataTable via SetDataSource.
        /// Without this, Crystal's export pipeline can still choke on
        /// stale/broken original connection metadata baked into the .rpt.
        /// Applies to the main report and any subreports.
        /// </summary>
        /// <param name="authoritativeDbObjectName">
        /// The view/proc this report's <see cref="ReportDefinition"/> says is authoritative --
        /// what LoadData actually queried. Used to directly set the main report's table Location
        /// rather than patch fragments of whatever Crystal saved at design time. Confirmed live
        /// 2026-09-07: "RBP Summary Report.rpt"'s saved Location is the bare name
        /// "sp_RBPSummaryTier" -- a stale reference to a stored procedure from before this report
        /// was switched to be View-backed (see the commented-out history in the Reports
        /// dictionary), not a database-name drift the old segment-rewrite logic could fix. Only
        /// applied to the main report's own tables -- a subreport's data source isn't modeled by
        /// ReportDefinition at all, so its Location still gets the older, more conservative
        /// database-segment-only rewrite.
        /// </param>
        private void ApplyDatabaseLogon(ReportDocument report, StringBuilder diagnostics, string authoritativeDbObjectName)
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

            diagnostics.AppendLine("Target ConnectionInfo.DatabaseName: [" + connectionInfo.DatabaseName + "]");
            diagnostics.AppendLine("Subreports.Count: " + report.Subreports.Count);

            ApplyLogOnToTables(report.Database.Tables, connectionInfo, diagnostics, "MainReport", authoritativeDbObjectName);

            foreach (ReportDocument subreport in report.Subreports)
            {
                diagnostics.AppendLine("Subreport: " + subreport.Name);
                ApplyLogOnToTables(subreport.Database.Tables, connectionInfo, diagnostics, "Subreport:" + subreport.Name, null);
            }
        }

        /// <summary>
        /// Deliberately narrower than <see cref="ApplyDatabaseLogon"/>: this StoredProcedure-typed
        /// path never calls <c>ApplyLogOnInfo</c> -- confirmed live 2026-09-07 that calling it on
        /// an SP-backed table risks the exact "Crystal tries to validate/execute the proc
        /// internally with no parameters" problem that scoped ApplyDatabaseLogon to View-only in
        /// the first place. It DOES set credentials directly on the table's existing ConnectionInfo
        /// (without ApplyLogOnInfo) -- confirmed live 2026-09-08 that the underlying ODBC DSN
        /// (MYPS_DB_DSN) is configured for "login ID and password entered by the user" auth, which
        /// by design never persists the password into the DSN itself, so Table.set_Location's own
        /// internal connection-validation call has no credential to use unless we supply one here.
        /// Single-table guard: skips (and logs) rather than blindly overwriting every table's
        /// Location with the same DbObjectName if a report ever turns out to have more than one
        /// table -- no report is currently known to need that, but it was never asserted either.
        /// </summary>
        private void CorrectStoredProcedureTableLocation(ReportDocument report, string authoritativeDbObjectName, StringBuilder diagnostics)
        {
            diagnostics.AppendLine("  [MainReport] Table.Count: " + report.Database.Tables.Count);
            diagnostics.AppendLine("  [MainReport] Subreports.Count: " + report.Subreports.Count);

            if (report.Database.Tables.Count != 1)
            {
                diagnostics.AppendLine("  [MainReport] Skipped Location correction: expected exactly 1 table, found " + report.Database.Tables.Count);
                return;
            }

            var table = report.Database.Tables[0];

            if (!string.Equals(table.Location, authoritativeDbObjectName, StringComparison.OrdinalIgnoreCase))
            {
                // Credentials are only committed here, inside the actual-correction branch --
                // never in the no-op branch below -- so the reports whose Location already
                // matches (everything except rbp-summary-report today) never execute this and
                // stay completely unaffected by it. Confirmed live 2026-09-08: merely mutating
                // table.LogOnInfo.ConnectionInfo's properties without ApplyLogOnInfo has no
                // effect -- LogOnInfo appears to hand back a detached snapshot -- so
                // ApplyLogOnInfo is required to actually commit the credentials, even though
                // that's the same call documented as risky for SP-backed tables in general.
                // ALSO confirmed live 2026-09-08 (diagnostic swap to an unrelated empty .rpt hit
                // the identical failure): ConnectionInfo.UserID/.Password alone are not enough --
                // this table's ConnectionInfo.Type is CRQE (Crystal's ODBC/RDO query-engine
                // type), which reads credentials from the nested QE_LogonProperties attributes
                // collection instead, using standard ODBC UID/PWD parameter names. Moderate, not
                // certain, confidence -- if this doesn't resolve it, stop guessing at this API
                // surface rather than trying a 3rd shape.
                var logOnInfo = table.LogOnInfo;
                var builder = new SqlConnectionStringBuilder(_connectionString);
                logOnInfo.ConnectionInfo.UserID = builder.UserID;
                logOnInfo.ConnectionInfo.Password = builder.Password;

                if (logOnInfo.ConnectionInfo.Attributes?.Collection?.Lookup("QE_LogonProperties") is DbConnectionAttributes logonProperties)
                {
                    logonProperties.Collection.Set("UID", builder.UserID);
                    logonProperties.Collection.Set("PWD", builder.Password);
                    diagnostics.AppendLine("  [MainReport] Set QE_LogonProperties UID/PWD");
                }
                else
                {
                    diagnostics.AppendLine("  [MainReport] QE_LogonProperties not found -- credential set skipped for that path");
                }

                table.ApplyLogOnInfo(logOnInfo);

                diagnostics.AppendLine($"  [MainReport] Table='{table.Name}' Location=[{table.Location}] -> Corrected=[{authoritativeDbObjectName}]");
                table.Location = authoritativeDbObjectName;
            }
            else
            {
                diagnostics.AppendLine($"  [MainReport] Table='{table.Name}' Location=[{table.Location}] already correct, no change");
            }
        }

        private void ApplyLogOnToTables(Tables tables, ConnectionInfo connectionInfo, StringBuilder diagnostics, string ownerLabel, string authoritativeDbObjectName)
        {
            diagnostics.AppendLine("  [" + ownerLabel + "] Table.Count: " + tables.Count);

            foreach (Table table in tables)
            {
                var originalLocation = table.Location;

                var logOnInfo = table.LogOnInfo;
                logOnInfo.ConnectionInfo = connectionInfo;
                table.ApplyLogOnInfo(logOnInfo);

                try
                {
                    string rewriteMode;

                    if (!string.IsNullOrEmpty(authoritativeDbObjectName))
                    {
                        // Primary path (main report table): don't try to patch fragments of
                        // whatever Location Crystal saved -- it can be stale in ways a
                        // database-segment substitution can't fix (a bare name, or a reference to
                        // a completely different, defunct object from before this report's data
                        // source was last changed). ReportDefinition.DbObjectName is what LoadData
                        // actually queried and what this render is really backed by, so it's
                        // always the correct answer regardless of what Crystal's own saved
                        // metadata says. Shape confirmed live 2026-09-07 by comparing a working
                        // report's own Location against its DbObjectName: a bare object name, NOT
                        // database-qualified. An earlier attempt qualifying this as
                        // "{database}.dbo.{object}" failed inside this very setter with a COM
                        // "Failed to open the connection" error -- the qualified shape doesn't fit
                        // what this ODBC/RDO-routed connection type expects for Location.
                        table.Location = authoritativeDbObjectName;
                        rewriteMode = "Authoritative";
                    }
                    else if (!string.IsNullOrEmpty(table.Location))
                    {
                        // Fallback path (subreports only, where no authoritative object name
                        // exists): unconditionally replace the leading database-name segment,
                        // preserving everything else Crystal saved -- the best available guess
                        // when we don't independently know what the object should be.
                        var segments = table.Location.Split(new[] { '.' }, 2);

                        if (segments.Length == 2)
                        {
                            table.Location = $"{connectionInfo.DatabaseName}.{segments[1]}";
                            rewriteMode = "DatabaseSegmentOnly";
                        }
                        else
                        {
                            // Bare name, no dot -- we don't know which part (if any) is a
                            // database segment, so leave it exactly as Crystal wrote it rather
                            // than guess and risk discarding the table reference entirely.
                            rewriteMode = "SkippedBareName";
                        }
                    }
                    else
                    {
                        rewriteMode = "SkippedEmptyLocation";
                    }

                    diagnostics.AppendLine(
                        "  [" + ownerLabel + "] Table='" + table.Name + "'" +
                        " OriginalLocation=[" + originalLocation + "]" +
                        " RewrittenLocation=[" + table.Location + "]" +
                        " RewriteMode=" + rewriteMode);
                }
                catch (Exception ex)
                {
                    diagnostics.AppendLine(
                        "  [" + ownerLabel + "] Table='" + table.Name + "' THREW: " +
                        "OriginalLocation=[" + originalLocation + "] " +
                        "AttemptedLocation=[" + table.Location + "] Error: " + ex.Message);

                    // If this still fails, the exception message below is deliberately
                    // verbose - table.Name and the ORIGINAL Location (before any of our
                    // changes) are the two things needed to diagnose this correctly next
                    // time instead of guessing blind.
                    throw new Exception(
                        $"Failed setting Location for table '{table.Name}'. " +
                        $"OriginalLocation='{originalLocation}'. " +
                        $"AttemptedLocation='{table.Location}'. Error: {ex.Message}", ex);
                }
            }
        }

        /// <summary>
        /// Runs the report's backing stored proc or view directly via
        /// ADO.NET and returns the result as a DataTable ready to hand to
        /// Crystal via SetDataSource.
        /// </summary>
        private DataTable LoadData(string reportName, ReportDefinition definition, IDictionary<string, object> parameters)
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
                    var timeoutEx = new TimeoutException(
                        $"Query against '{definition.DbObjectName}' timed out after {command.CommandTimeout}s. " +
                        "This usually means the query itself is slow (check its execution plan / indexes in SSMS), " +
                        "not a code bug. If it's expected to take this long, raise CommandTimeout further.", ex);
                    _diagnosticLogger.Log(timeoutEx, BuildDiagnosticContext(reportName, $"LoadData query timeout against '{definition.DbObjectName}'", definition, parameters));
                    throw timeoutEx;
                }
                catch (Exception ex)
                {
                    // Any other data-load failure (bad connection, invalid object name, permission
                    // denied, etc.) - not previously caught at all, propagated raw and unlogged.
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, $"LoadData query against '{definition.DbObjectName}'", definition, parameters));
                    throw new Exception($"Failed loading data for '{definition.DbObjectName}': {ex.Message}", ex);
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
        /// <param name="optionalParameters">
        /// Report-level parameter names (see <see cref="ReportDefinition.OptionalReportLevelParameters"/>)
        /// that default to an empty string instead of failing the request when missing -- only
        /// for StringField parameters; every other missing parameter still fails exactly as before.
        /// </param>
        private static void ApplyReportLevelParameters(ReportDocument report, IDictionary<string, object> parameters, HashSet<string> optionalParameters)
        {
            parameters = parameters ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            optionalParameters = optionalParameters ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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
                    // #422: a report can opt specific StringField parameters out of the
                    // "every parameter is required" rule below (e.g. signatory fields that
                    // should render blank rather than block generation). Every other missing
                    // parameter - not opted in, or not a string type with no sensible empty
                    // default - keeps the original, unconditional-required behavior.
                    if (optionalParameters.Contains(pf.Name.TrimStart('@')) && pf.ValueType == FieldValueType.StringField)
                    {
                        report.SetParameterValue(pf.Name, string.Empty);
                        continue;
                    }

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