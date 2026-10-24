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

        /// <summary>
        /// Opt-in for <see cref="CrystalReportRenderer.ApplyYearHeader"/>: the literal text of a
        /// header TextObject (e.g. "FY") that should have the "yearstart" request value appended
        /// at render time. Needed for reports whose header year is a {?@yearstart} field bound to
        /// a StoreProcedureParameter -- Crystal renders those blank once rows come from
        /// SetDataSource instead of Crystal running the proc itself. Null (default) leaves every
        /// other report untouched.
        /// </summary>
        public string YearHeaderText { get; set; }
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

        // Shared by rbp-summary-report and rbp-summary-report-with-tier -- both are backed by
        // sp_RBPSummary/sp_RBPSummaryTier, which take an identical parameter signature. A single
        // list avoids the two reports' Parameters silently drifting apart (already happened once:
        // an earlier version of this fix wired only 3 of these 6 into one report's list).
        private static readonly List<SqlParamDefinition> RbpSummaryParameters = new List<SqlParamDefinition>
        {
            new SqlParamDefinition { Name = "yearstart", DbType = SqlDbType.Int, IsRequired = true },
            new SqlParamDefinition { Name = "programid", DbType = SqlDbType.NVarChar, IsRequired = false },
            new SqlParamDefinition { Name = "region", DbType = SqlDbType.NVarChar, IsRequired = false },
            new SqlParamDefinition { Name = "planningEngr", DbType = SqlDbType.NVarChar, IsRequired = false },
            new SqlParamDefinition { Name = "reviewedBy", DbType = SqlDbType.NVarChar, IsRequired = false },
            new SqlParamDefinition { Name = "approvedBy", DbType = SqlDbType.NVarChar, IsRequired = false }
        };

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
                    },
                    // Page header is "FY" + {?@yearstart} + "BUDGET PROPOSAL"; the field rendered
                    // blank ("FY      BUDGET PROPOSAL"), so the year is written into the "FY" text.
                    YearHeaderText = "FY"
                },
                ["extract-pcmiow"] = new ReportDefinition
                {
                    RptFileName = "ExtractPCMIOW.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "usp_extract_PC_MIOW_list",
                    Parameters = new List<SqlParamDefinition>
                    {
                        new SqlParamDefinition { Name = "programid", DbType = SqlDbType.VarChar, IsRequired = true },
                        // categoryid/rocode/deocode/io_code are optional filters -- mirrors
                        // Hangfire/Services/ExcelReportGenerator.cs's "extract-pcmiow" entry,
                        // which is the live path for this report (see CanHandle in
                        // ReportJobService.cs). Kept in sync here in case this renderer is
                        // ever reached directly for the same report key.
                        new SqlParamDefinition { Name = "categoryid", DbType = SqlDbType.Int, IsRequired = false },
                        new SqlParamDefinition { Name = "rocode", DbType = SqlDbType.VarChar, IsRequired = false },
                        new SqlParamDefinition { Name = "deocode", DbType = SqlDbType.VarChar, IsRequired = false },
                        new SqlParamDefinition { Name = "io_code", DbType = SqlDbType.VarChar, IsRequired = false }
                    }
                },
                ["rbp-summary-report"] = new ReportDefinition
                {
                    // Re-pointed 2026-10-23 at a fresh Crystal Designer rebind (RBPSummaryReport.rpt,
                    // bound directly to sp_RBPSummary via OLE DB/SQLOLEDB -> Stored Procedures) and
                    // back to its own proc, sp_RBPSummary -- undoing the 2026-09-08 "share one proc"
                    // consolidation onto sp_RBPSummaryTier. sp_RBPSummary and sp_RBPSummaryTier are
                    // confirmed live on myps_db_dev3 (2026-10-23): both execute and return real,
                    // program-filtered rows for a local RBP-stage test program; the row-dropping
                    // bug was never in this proc's join logic, so no SQL change was needed here, only
                    // a checked-in current script (see Main/Resources/Internal/SQLScripts/).
                    // SkipLocationCorrection=true because the bare-name equality check in
                    // CorrectStoredProcedureTableLocation doesn't know "{name};1" is Crystal's own
                    // correct form for a stored-proc Location -- it was stripping the ";1" and
                    // breaking a working export (see rbp-summary-report-with-tier below, which hit
                    // the identical issue once switched off the View path).
                    RptFileName = "RBPSummaryReport.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "sp_RBPSummary",
                    SkipLocationCorrection = true,
                    // sp_RBPSummary's signature also takes @planningEngr/@reviewedBy/@approvedBy
                    // and passes each straight through as a PlanningEngr/ReviewedBy/ApprovedBy
                    // output column (confirmed live against myps_db_dev3) -- the .rpt's signature
                    // block binds those DataTable columns, not Crystal's own report-level
                    // parameters of the same name. Omitting them here (as an earlier version of
                    // this fix did) silently left the proc's own NULL defaults in place, so the
                    // signature block rendered with the right role labels but no names at all even
                    // when the caller supplied real values.
                    Parameters = RbpSummaryParameters,
                    // #422: belt-and-suspenders opt-out for Crystal's own report-level parameter
                    // check (separate from the SQL parameters above) -- in case a future .rpt
                    // rebind ever reintroduces these as report-level prompts. Harmless no-op today
                    // against RBPSummaryReport.rpt, which doesn't define them as report-level
                    // parameters at all (confirmed live), same camelCase names either way.
                    OptionalReportLevelParameters = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "planningEngr", "reviewedBy", "approvedBy"
                    }
                },
                ["rbp-summary-report-with-tier"] = new ReportDefinition
                {
                    // Switched 2026-10-23 from View/MYPS_vw_rptRBPSummaryTier (whose LoadData query
                    // was a bare "SELECT * FROM view" with no WHERE at all -- yearstart/programid/
                    // region never reached the SQL, only Crystal's letterhead parameters) to
                    // StoredProcedure/sp_RBPSummaryTier, matching rbp-summary-report's pattern and
                    // actually filtering by program/year/region server-side. Paired with a fresh
                    // Crystal Designer rebind (RBPSummaryReportTier.rpt, bound to sp_RBPSummaryTier).
                    // sp_RBPSummaryTier confirmed live on myps_db_dev3 (2026-10-23): executes,
                    // returns real rows whose per-tier totals reconcile with sp_RBPSummary's
                    // category totals for the same program/year.
                    RptFileName = "RBPSummaryReportTier.rpt",
                    SourceType = DataSourceType.StoredProcedure,
                    DbObjectName = "sp_RBPSummaryTier",
                    SkipLocationCorrection = true,
                    // Same reasoning as rbp-summary-report above: sp_RBPSummaryTier also takes
                    // @planningEngr/@reviewedBy/@approvedBy and passes them through as output
                    // columns the .rpt's signature block binds to directly.
                    Parameters = RbpSummaryParameters,
                    // #422: same belt-and-suspenders opt-out as rbp-summary-report above.
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
                    // overwrites it. A .rpt's saved Table.Location can be stale (pointing at a
                    // defunct object from before the report was repointed) - Crystal re-resolves
                    // Location independently at ExportToStream regardless of SetDataSource below,
                    // so a stale value fails export outright. Fix shape, proven via the working
                    // SP-backed reports: Location must be the BARE object name equal to
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

                // Must run BEFORE SetDataSource: editing a TextObject after it makes
                // ExportToStream fail with "Invalid field name" (confirmed on RBP.rpt).
                try
                {
                    ApplyYearHeader(report, parameters, definition.YearHeaderText);
                }
                catch (Exception ex)
                {
                    _diagnosticLogger.Log(ex, BuildDiagnosticContext(reportName, "ApplyYearHeader", definition, parameters, locationDiagnostics.ToString()));
                    throw new Exception($"Failed at ApplyYearHeader: {ex.Message}", ex);
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
        /// rather than patch fragments of whatever Crystal saved at design time. A .rpt's saved
        /// Location can be a stale reference to a stored procedure or view from before the report
        /// was repointed, not a database-name drift the old segment-rewrite logic could fix. Only
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
                            {
                                missing.Add(paramDef.Name);
                                continue;
                            }

                            // Optional + not supplied: pass NULL explicitly rather than
                            // omitting the SqlParameter. Most of this table's procs declare
                            // a "= NULL" default so omission already worked, but
                            // usp_extract_PC_MIOW_list/usp_extract_PC_list don't -- an
                            // omitted required-by-signature parameter fails the call outright.
                            // Explicit NULL is equivalent for the ones that do have a default.
                            command.Parameters.Add("@" + paramDef.Name, paramDef.DbType).Value = DBNull.Value;
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

        /// <summary>
        /// Writes the "yearstart" request value into every header TextObject whose text is
        /// <paramref name="yearHeaderText"/> (e.g. "FY" -> "FY 2025"), and suppresses the
        /// {?@yearstart} field objects that were meant to show it. Crystal leaves a
        /// StoreProcedureParameter field blank when the rows come from SetDataSource, even with
        /// the parameter's value set (confirmed by rendering RBP.rpt directly, 2026-10-24).
        /// The text object is widened over the suppressed field's slot so the year isn't clipped.
        /// </summary>
        private static void ApplyYearHeader(ReportDocument report, IDictionary<string, object> parameters, string yearHeaderText)
        {
            if (string.IsNullOrEmpty(yearHeaderText) || parameters == null
                || !parameters.TryGetValue("yearstart", out var year) || year == null)
                return;

            foreach (Section section in report.ReportDefinition.Sections)
            {
                var yearFields = section.ReportObjects.OfType<FieldObject>()
                    .Where(f => string.Equals(f.DataSource.FormulaName, "{?@yearstart}", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                foreach (var text in section.ReportObjects.OfType<TextObject>()
                    .Where(t => string.Equals(t.Text.Trim(), yearHeaderText, StringComparison.OrdinalIgnoreCase)))
                {
                    text.Text = $"{yearHeaderText} {year}";
                    foreach (var field in yearFields)
                    {
                        field.ObjectFormat.EnableSuppress = true;
                        text.Width = Math.Max(text.Width, field.Left + field.Width - text.Left);
                    }
                }
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
