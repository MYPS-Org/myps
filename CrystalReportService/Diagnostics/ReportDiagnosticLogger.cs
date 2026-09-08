using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Hosting;

namespace CrystalReportService.Diagnostics
{
    /// <summary>
    /// Writes a structured diagnostic report for a failed report render.
    /// </summary>
    public interface IReportDiagnosticLogger
    {
        /// <summary>
        /// Records <paramref name="exception"/> and returns the error reference id written with it,
        /// so the caller can hand that id back to the client. A user reporting "I got error
        /// 3f2a...", maps to exactly one Event Log entry.
        /// <para>Never throws. A logging failure must never mask the failure it is recording.</para>
        /// </summary>
        Guid Log(Exception exception, ReportDiagnosticContext context);
    }

    /// <summary>
    /// The CrystalReportService counterpart to WebAPI's <c>Helpers.IMYPSExceptionHandler</c>.
    /// <para>
    /// That handler cannot be referenced here: it targets net8.0 and depends on ASP.NET Core types
    /// (<c>IHttpContextAccessor</c>, <c>Microsoft.AspNetCore.Mvc.ObjectResult</c>, <c>ILogger&lt;T&gt;</c>)
    /// that do not exist in this project's classic .NET Framework 4.8 / System.Web.Http runtime.
    /// This mirrors its report structure, classification approach, redaction discipline and
    /// self-guarding, adapted to the Crystal Reports domain and to the Windows Event Log.
    /// </para>
    /// <para>
    /// Two deliberate divergences from the WebAPI handler. First, it is a logger, not a response
    /// builder -- <c>ReportsController</c> already maps failures onto correct status codes
    /// (404/400/504/500), which is better than the 400-for-everything the other handler returns.
    /// Second, the WebAPI handler passes the exception object to <c>ILogger</c> and lets the
    /// provider append the stack trace; <see cref="EventLog"/> has no such provider, so the stack
    /// trace is written into the report body here.
    /// </para>
    /// <para>
    /// Requires a one-time, elevated registration on each host, because an IIS application pool
    /// identity cannot create an event source itself (that writes under HKLM):
    /// <code>New-EventLog -LogName Application -Source "CrystalReportService"</code>
    /// Until that is done the logger degrades to a file sink and records why -- see
    /// <see cref="Log"/>.
    /// </para>
    /// </summary>
    public sealed class ReportDiagnosticLogger : IReportDiagnosticLogger
    {
        // ===================================================================================
        // CONFIGURATION
        // ===================================================================================

        /// <summary>Event source name. Matches the IIS app pool and DeployIisAppPath already in use.</summary>
        public const string EventSourceName = "CrystalReportService";

        /// <summary>Standard Windows log. Where an administrator looks first.</summary>
        public const string EventLogName = "Application";

        /// <summary>
        /// EventLog.WriteEntry throws past 32766 bytes; this leaves headroom for multi-byte
        /// characters in exception messages. The fully assembled report is truncated to this as the
        /// final step, after every section is built -- truncating sections individually is not
        /// enough, since their combined length is what actually hits the limit.
        /// </summary>
        private const int MaximumEventLogCharacters = 30000;

        private const int MaximumStackTraceCharacters = 12000;
        private const int MaximumParameterCharacters = 4000;
        private const int MaximumExceptionChainDepth = 25;

        /// <summary>
        /// Marker written into <see cref="Exception.Data"/> once an exception has been recorded, so
        /// the Web API-level <c>ReportExceptionLogger</c> does not log the same failure a second
        /// time as it propagates out of the renderer.
        /// </summary>
        public const string LoggedMarkerKey = "CrystalReportService.Diagnostics.Logged";

        /// <summary>Key under which the error reference id is stashed in <see cref="Exception.Data"/>.</summary>
        public const string ErrorReferenceIdKey = "CrystalReportService.Diagnostics.ErrorReferenceId";

        // ===================================================================================
        // EVENT IDS -- stable per failure category so operators can filter and alert on them.
        // Never renumber these; add new ones at the end.
        // ===================================================================================

        private const int EventIdCrystalRuntimeMissing = 1001;
        private const int EventIdCrystalExportFailure = 1002;
        private const int EventIdCrystalLoadFailure = 1003;
        private const int EventIdCrystalDataBindFailure = 1004;
        private const int EventIdCrystalParameterFailure = 1005;
        private const int EventIdSqlServerFailure = 1006;
        private const int EventIdTimeout = 1007;
        private const int EventIdReportDefinitionMissing = 1008;
        private const int EventIdDiagnosticsDegraded = 1009;
        private const int EventIdUnclassified = 1900;

        /// <summary>Temporary -- connection-metadata comparison capture, remove with the instrumentation using it.</summary>
        private const int EventIdDiagnosticCapture = 1098;

        // ===================================================================================
        // REDACTION
        // ===================================================================================

        /// <summary>
        /// Matched as substrings, case-insensitively -- so "UserPassword" and "X-Api-Key" are caught,
        /// which the WebAPI handler's exact-name matching would miss.
        /// </summary>
        private static readonly string[] SensitiveKeyFragments =
        {
            "password", "passwordhash", "pwd", "token", "accesstoken", "refreshtoken", "idtoken",
            "authorization", "cookie", "apikey", "api_key", "secret", "clientsecret",
            "connectionstring", "privatekey", "credential"
        };

        /// <summary>
        /// Scrubs credentials out of free text -- SqlException messages and Crystal's own errors can
        /// echo a connection string back. This project's Web.config holds a plaintext 'sa' password,
        /// and the Application log has a far wider audience than a file under the site root, so this
        /// runs over every rendered report before it leaves this class.
        /// </summary>
        private static readonly Regex CredentialInTextPattern = new Regex(
            @"(?<key>\b(?:password|pwd|user\s*id|uid)\s*=\s*)(?<value>[^;""'\r\n]*)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Pulls "at Method in File:line N" out of a stack trace. Same technique the WebAPI handler
        /// uses; only frames from this assembly are considered, so it points at our code rather than
        /// at a Crystal or framework frame.
        /// </summary>
        private static readonly Regex StackFramePattern = new Regex(
            @"at\s+(?<method>.+?)\s+in\s+(?<file>.+?):line\s+(?<line>\d+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Result of the event source probe. EventLog.SourceExists reads under HKLM and can itself
        /// throw SecurityException for a restricted identity. Nullable&lt;bool&gt; cannot be declared
        /// volatile, so every read goes through <see cref="EventSourceProbeLock"/> -- negligible
        /// cost, since this only runs on failure paths, never per-request.
        /// </summary>
        private static bool? _eventSourceAvailable;

        /// <summary>
        /// When <see cref="_eventSourceAvailable"/> was last set. A positive result is cached for
        /// the process lifetime -- a registered source doesn't un-register itself. A negative result
        /// gets re-probed after <see cref="NegativeProbeExpiry"/> instead of caching forever: the
        /// realistic sequence on a fresh deploy is the app pool starting (and probing) before an
        /// operator runs the one-time `New-EventLog` registration, and without an expiry that
        /// permanently cached `false` would make Event Log stay empty indefinitely even after the
        /// source is correctly registered, until the app pool happens to recycle.
        /// </summary>
        private static DateTime _eventSourceProbedAt;

        private static readonly TimeSpan NegativeProbeExpiry = TimeSpan.FromMinutes(2);

        private static readonly object EventSourceProbeLock = new object();

        // ===================================================================================
        // ENTRY POINT
        // ===================================================================================

        /// <inheritdoc />
        public Guid Log(Exception exception, ReportDiagnosticContext context)
        {
            Guid errorReferenceId = Guid.NewGuid();

            try
            {
                if (exception == null)
                {
                    return errorReferenceId;
                }

                context = context ?? new ReportDiagnosticContext();
                MarkAsLogged(exception, errorReferenceId);

                // Classification and full report-building are kept in their own try/catch, separate
                // from the sink write below. Confirmed live 2026-09-07: a real Crystal export
                // failure reached MarkAsLogged (the returned ErrorId proved it) but produced no
                // entry anywhere -- Event Log or either file fallback. With everything under one
                // catch, a failure in BuildReport (untested until now against a real, possibly
                // COM-originated Crystal exception) skips WriteReport entirely, so even the "always
                // write a file" fallback never runs. If building the full report fails, a minimal
                // report is written instead -- WriteReport, and therefore every sink, still runs
                // either way. Only every sink itself failing should ever produce zero trace.
                string report;
                int eventId;

                try
                {
                    FailureClassification classification = Classify(exception, context);
                    report = BuildReport(errorReferenceId, exception, context, classification);
                    eventId = classification.EventId;
                }
                catch (Exception buildFailure)
                {
                    report = BuildMinimalReport(errorReferenceId, exception, buildFailure);
                    eventId = EventIdUnclassified;
                }

                WriteReport(report, eventId);
            }
            catch
            {
                // Never allow the diagnostic logger itself to hide the original failure. There is
                // deliberately nothing here: any recovery attempt would need the very sinks that
                // just failed. The outer callers still surface the original exception.
            }

            return errorReferenceId;
        }

        /// <summary>
        /// Temporary -- writes a plain informational entry (not an Error) through the same sink
        /// cascade as <see cref="Log"/>, for capturing diagnostic data that isn't tied to a
        /// failure (e.g. comparing a broken report's connection metadata against a working one's).
        /// Never throws. Remove this method together with whatever instrumentation calls it once
        /// the real fix is found.
        /// </summary>
        public static void LogInformational(string reportName, string message)
        {
            try
            {
                var sb = new StringBuilder();
                sb.AppendLine("/===================== MYPS CRYSTAL REPORT DIAGNOSTIC CAPTURE (temporary, not an error) =====================/");
                sb.AppendLine("Timestamp: " + DateTimeOffset.Now.ToString("O"));
                sb.AppendLine("Report: " + Coalesce(reportName, "Not Available"));
                sb.AppendLine();
                sb.AppendLine(message);
                sb.AppendLine();
                sb.AppendLine("/====================== MYPS CRYSTAL REPORT DIAGNOSTIC CAPTURE ENDS HERE ======================/");

                string scrubbed = ScrubCredentials(sb.ToString());
                string truncated = scrubbed.Length > MaximumEventLogCharacters
                    ? scrubbed.Substring(0, MaximumEventLogCharacters)
                    : scrubbed;

                WriteReport(truncated, EventIdDiagnosticCapture, EventLogEntryType.Information);
            }
            catch
            {
                // Diagnostic capture must never be the reason a report render fails.
            }
        }

        /// <summary>
        /// Guaranteed-to-succeed fallback when <see cref="Classify"/> or <see cref="BuildReport"/>
        /// itself throws. Deliberately minimal -- no classification, no stack-frame extraction, no
        /// SQL inspection -- so there is nothing left in this path that could plausibly fail. Still
        /// scrubs credentials, since the raw exception message could still echo a connection string.
        /// </summary>
        private static string BuildMinimalReport(Guid errorReferenceId, Exception exception, Exception buildFailure)
        {
            StringBuilder report = new StringBuilder();

            report.AppendLine("/===================== MYPS CRYSTAL REPORT ERROR EVENT (MINIMAL) =====================/");
            report.AppendLine();
            report.AppendLine("NOTE: The full diagnostic report could not be built -- see BUILD FAILURE below.");
            report.AppendLine("ErrorId: " + errorReferenceId);
            report.AppendLine("Timestamp: " + DateTimeOffset.Now.ToString("O"));
            report.AppendLine();
            report.AppendLine("ORIGINAL EXCEPTION");
            report.AppendLine("------------------");
            report.AppendLine("Type: " + SafeTypeName(exception));
            report.AppendLine("Message: " + SafeMessage(exception));
            report.AppendLine("ToString: " + SafeToString(exception));
            report.AppendLine();
            report.AppendLine("BUILD FAILURE (while constructing the full report)");
            report.AppendLine("----------------------------------------------------");
            report.AppendLine("Type: " + SafeTypeName(buildFailure));
            report.AppendLine("Message: " + SafeMessage(buildFailure));
            report.AppendLine();
            report.AppendLine("/====================== MYPS CRYSTAL REPORT ERROR EVENT ENDS HERE ======================/");

            string text = report.ToString();

            try
            {
                text = ScrubCredentials(text);
            }
            catch
            {
                // Scrubbing is a bonus here, not a requirement -- an unscrubbed minimal report still
                // beats no report at all.
            }

            return text.Length > MaximumEventLogCharacters
                ? text.Substring(0, MaximumEventLogCharacters)
                : text;
        }

        private static string SafeTypeName(Exception exception)
        {
            try
            {
                return exception == null ? "Not Available" : exception.GetType().FullName;
            }
            catch
            {
                return "Not Available";
            }
        }

        private static string SafeMessage(Exception exception)
        {
            try
            {
                return exception == null ? "Not Available" : Coalesce(exception.Message, "(no message)");
            }
            catch
            {
                return "Not Available";
            }
        }

        private static string SafeToString(Exception exception)
        {
            try
            {
                return exception == null ? "Not Available" : exception.ToString();
            }
            catch
            {
                return "Not Available";
            }
        }

        /// <summary>
        /// True when this exception has already been recorded, so the Web API-level logger can skip
        /// it instead of writing a duplicate entry for the same failure.
        /// </summary>
        public static bool AlreadyLogged(Exception exception)
        {
            try
            {
                return exception != null
                    && exception.Data != null
                    && exception.Data.Contains(LoggedMarkerKey);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Walks the exception chain looking for an error reference id a prior <see cref="Log"/>
        /// call attached. Lets the controller include, in its HTTP error response, the exact id
        /// that identifies the matching Event Log entry -- without the controller needing to know
        /// anything about how or where that entry was written.
        /// </summary>
        public static bool TryGetErrorReferenceId(Exception exception, out Guid errorReferenceId)
        {
            int depth = 0;

            for (Exception current = exception;
                 current != null && depth < MaximumExceptionChainDepth;
                 current = current.InnerException, depth++)
            {
                try
                {
                    if (current.Data != null && current.Data.Contains(ErrorReferenceIdKey))
                    {
                        object value = current.Data[ErrorReferenceIdKey];

                        if (value is Guid)
                        {
                            errorReferenceId = (Guid)value;
                            return true;
                        }
                    }
                }
                catch
                {
                    // Fall through to the next frame in the chain.
                }
            }

            errorReferenceId = Guid.Empty;
            return false;
        }

        private static void MarkAsLogged(Exception exception, Guid errorReferenceId)
        {
            try
            {
                if (exception.Data != null && !exception.Data.IsReadOnly)
                {
                    exception.Data[LoggedMarkerKey] = true;
                    exception.Data[ErrorReferenceIdKey] = errorReferenceId;
                }
            }
            catch
            {
                // A non-writable Data dictionary only costs us a possible duplicate entry.
            }
        }

        // ===================================================================================
        // CLASSIFICATION
        // ===================================================================================

        /// <summary>
        /// First match wins, ordered most-specific first. Every branch names a likely cause and a
        /// concrete next step -- a report that only says "it failed" is not worth writing.
        /// </summary>
        private static FailureClassification Classify(Exception exception, ReportDiagnosticContext context)
        {
            Exception root = GetRootException(exception);
            SqlException sqlException = FindSqlException(exception);
            string failureLocation = context.FailureLocation ?? string.Empty;
            string message = (root ?? exception).Message ?? string.Empty;

            if (ContainsType(exception, typeof(TypeInitializationException)))
            {
                return new FailureClassification(
                    "CrystalRuntimeMissing",
                    EventIdCrystalRuntimeMissing,
                    "The SAP Crystal Reports runtime failed to initialise on this host.",
                    "Confirm the Crystal Reports runtime is installed and registered for the " +
                    "bitness this app pool runs as (32- vs 64-bit is the usual cause). The real " +
                    "reason is in the ROOT EXCEPTION section, not the outer message.");
            }

            if (sqlException != null)
            {
                return new FailureClassification(
                    "SqlServerFailure",
                    EventIdSqlServerFailure,
                    DescribeSqlError(sqlException.Number),
                    RecommendSqlAction(sqlException.Number, context.DbObjectName));
            }

            if (exception is TimeoutException ||
                message.IndexOf("timeout", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new FailureClassification(
                    "Timeout",
                    EventIdTimeout,
                    "The backing query did not finish inside the command timeout.",
                    "Check the execution plan and indexes for " +
                    Coalesce(context.DbObjectName, "the backing SQL object") +
                    " in SSMS. Raise CommandTimeout only if the duration is genuinely expected.");
            }

            if (exception is FileNotFoundException)
            {
                return new FailureClassification(
                    "ReportDefinitionMissing",
                    EventIdReportDefinitionMissing,
                    "The .rpt file for this report is not present on this host.",
                    "Confirm " + Coalesce(context.RptFileName, "the .rpt file") + " deployed into " +
                    "the Reports folder. A publish that skips extra files can leave this stale.");
            }

            if (failureLocation.IndexOf("ExportToStream", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                bool pathNotFound = message.IndexOf("cannot find the path", StringComparison.OrdinalIgnoreCase) >= 0;

                return new FailureClassification(
                    "CrystalExportFailure",
                    EventIdCrystalExportFailure,
                    pathNotFound
                        ? "Crystal resolved a table Location that does not exist on the connected " +
                          "database. Export re-resolves the .rpt's design-time Database Expert " +
                          "metadata independently of SetDataSource, so stale metadata fails here " +
                          "even though the row data was supplied successfully."
                        : "Crystal failed while exporting the loaded report to PDF.",
                    pathNotFound
                        ? "Check ApplyLogOnToTables: every table's Location must have its leading " +
                          "database segment rewritten to the database actually connected. Verify " +
                          "the .rpt's tables resolve against " +
                          Coalesce(context.DbObjectName, "the backing object") + "."
                        : "Confirm the report has no subreport with its own unfed data source, and " +
                          "that every report-level parameter was supplied.");
            }

            if (failureLocation.IndexOf("report.Load", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new FailureClassification(
                    "CrystalLoadFailure",
                    EventIdCrystalLoadFailure,
                    "Crystal could not load the .rpt file.",
                    "The file exists but could not be opened -- check it is not locked by another " +
                    "process, not zero-length from a partial deploy, and readable by the app pool " +
                    "identity.");
            }

            if (failureLocation.IndexOf("SetDataSource", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new FailureClassification(
                    "CrystalDataBindFailure",
                    EventIdCrystalDataBindFailure,
                    "Crystal rejected the DataTable supplied to SetDataSource.",
                    "The result shape of " + Coalesce(context.DbObjectName, "the backing object") +
                    " most likely no longer matches what the .rpt was designed against. Compare " +
                    "its current columns to the report's field list.");
            }

            if (failureLocation.IndexOf("Parameter", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new FailureClassification(
                    "CrystalParameterFailure",
                    EventIdCrystalParameterFailure,
                    "Applying report-level parameters failed.",
                    "Report-level parameters are separate from the SQL parameters. Check " +
                    "report.DataDefinition.ParameterFields in the Designer for the exact names " +
                    "this .rpt defines.");
            }

            if (failureLocation.IndexOf("ApplyDatabaseLogon", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new FailureClassification(
                    "CrystalExportFailure",
                    EventIdCrystalExportFailure,
                    "Applying database logon information to the report's tables failed.",
                    "Check the MypsDb connection string resolves, and that every table's Location " +
                    "has a 'database.rest' shape before its leading segment is rewritten.");
            }

            return new FailureClassification(
                "Unclassified",
                EventIdUnclassified,
                (root ?? exception).GetType().Name + " during report rendering.",
                "Use FAILURE LOCATION, REPORT CONTEXT and the exception chain below to identify " +
                "the failing step.");
        }

        // ===================================================================================
        // REPORT CONSTRUCTION
        // ===================================================================================

        private static string BuildReport(
            Guid errorReferenceId,
            Exception exception,
            ReportDiagnosticContext context,
            FailureClassification classification)
        {
            StringBuilder report = new StringBuilder();
            Exception root = GetRootException(exception);
            SqlException sqlException = FindSqlException(exception);
            StackFrameInfo frame = GetFirstApplicationStackFrame(root) ?? GetFirstApplicationStackFrame(exception);

            report.AppendLine("/===================== MYPS CRYSTAL REPORT ERROR EVENT STARTS HERE =====================/");
            report.AppendLine();

            AppendSection(report, "ERROR");
            AppendField(report, "ErrorId", errorReferenceId.ToString());
            AppendField(report, "Timestamp", DateTimeOffset.Now.ToString("O"));
            AppendField(report, "Machine", SafeMachineName());
            report.AppendLine();

            AppendSection(report, "REQUEST");
            AppendField(report, "Method", context.RequestMethod);
            AppendField(report, "Uri", context.RequestUri);
            report.AppendLine();

            AppendSection(report, "ERROR SUMMARY");
            AppendField(report, "FailureKind", classification.FailureKind);
            AppendField(report, "EventId", classification.EventId.ToString());
            AppendField(report, "LikelyCause", classification.LikelyCause);
            report.AppendLine();

            AppendSection(report, "FAILURE LOCATION");
            AppendField(report, "Step", context.FailureLocation);
            AppendField(report, "DeclaringType", frame == null ? null : frame.DeclaringType);
            AppendField(report, "Method", frame == null ? null : frame.Method);
            AppendField(report, "SourceFile", frame == null ? null : frame.File);
            AppendField(report, "SourceLine", frame == null ? null : frame.Line);
            report.AppendLine();

            AppendSection(report, "REPORT CONTEXT");
            AppendField(report, "ReportName", context.ReportName);
            AppendField(report, "RptFileName", context.RptFileName);
            AppendField(report, "SourceType", context.SourceType);
            AppendField(report, "DbObjectName", context.DbObjectName);
            report.AppendLine();

            if (!string.IsNullOrEmpty(context.TableLocationDiagnostics))
            {
                AppendSection(report, "TABLE LOCATION DIAGNOSTICS (temporary)");
                report.AppendLine(context.TableLocationDiagnostics);
                report.AppendLine();
            }

            if (sqlException != null)
            {
                AppendSection(report, "SQL DIAGNOSTICS");
                AppendField(report, "Description", DescribeSqlError(sqlException.Number));
                AppendField(report, "Number", sqlException.Number.ToString());
                AppendField(report, "State", sqlException.State.ToString());
                AppendField(report, "Class", sqlException.Class.ToString());
                AppendField(report, "Procedure", NullIfWhiteSpace(sqlException.Procedure));
                AppendField(report, "LineNumber", sqlException.LineNumber.ToString());
                AppendField(report, "Server", NullIfWhiteSpace(sqlException.Server));
                report.AppendLine();
            }

            AppendSection(report, "RECOMMENDED FIX");
            report.AppendLine(Coalesce(classification.RecommendedFix,
                "Review the failure location, report context and exception chain below."));
            report.AppendLine();

            AppendSection(report, "PARAMETERS");
            report.AppendLine(FormatParameters(context.Parameters));
            report.AppendLine();

            AppendSection(report, "EXCEPTION CHAIN");
            AppendExceptionChain(report, exception);
            report.AppendLine();

            AppendSection(report, "STACK TRACE");
            report.AppendLine(Truncate(
                Coalesce(exception.ToString(), "Not Available"),
                MaximumStackTraceCharacters,
                "STACK TRACE"));
            report.AppendLine();

            report.AppendLine("/====================== MYPS CRYSTAL REPORT ERROR EVENT ENDS HERE ======================/");

            // Credential scrubbing runs last, over the whole assembled report, so it covers every
            // section including exception messages that may echo a connection string.
            string scrubbed = ScrubCredentials(report.ToString());

            return Truncate(scrubbed, MaximumEventLogCharacters, "REPORT");
        }

        private static void AppendSection(StringBuilder report, string header)
        {
            report.AppendLine(header);
            report.AppendLine(new string('-', header.Length));
        }

        /// <summary>
        /// Unset values render as "Not Available" rather than being omitted, so every report has the
        /// same shape and a missing value is visibly missing instead of silently absent.
        /// </summary>
        private static void AppendField(StringBuilder report, string label, string value)
        {
            report.AppendLine(label + ": " + Coalesce(value, "Not Available"));
        }

        private static void AppendExceptionChain(StringBuilder report, Exception exception)
        {
            int depth = 0;

            for (Exception current = exception;
                 current != null && depth < MaximumExceptionChainDepth;
                 current = current.InnerException, depth++)
            {
                report.AppendLine("  [" + depth + "] " + current.GetType().FullName);
                report.AppendLine("      " + Coalesce(current.Message, "(no message)"));
            }

            if (depth >= MaximumExceptionChainDepth)
            {
                report.AppendLine("  [chain truncated at " + MaximumExceptionChainDepth + " levels]");
            }
        }

        private static string FormatParameters(IDictionary<string, object> parameters)
        {
            if (parameters == null || parameters.Count == 0)
            {
                return "Not Available";
            }

            IEnumerable<string> rendered = parameters
                .OrderBy(pair => pair.Key, StringComparer.OrdinalIgnoreCase)
                .Select(pair => "  " + pair.Key + " = " +
                    (IsSensitiveKey(pair.Key) ? "[REDACTED]" : FormatValue(pair.Value)));

            return Truncate(string.Join(Environment.NewLine, rendered),
                MaximumParameterCharacters, "PARAMETERS");
        }

        private static string FormatValue(object value)
        {
            if (value == null)
            {
                return "NULL";
            }

            string text = value.ToString();

            return string.IsNullOrEmpty(text) ? "(empty)" : text;
        }

        private static bool IsSensitiveKey(string key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return false;
            }

            return SensitiveKeyFragments.Any(fragment =>
                key.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static string ScrubCredentials(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return text;
            }

            return CredentialInTextPattern.Replace(text, "${key}[REDACTED]");
        }

        private static string Truncate(string text, int maximumCharacters, string label)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maximumCharacters)
            {
                return text;
            }

            return text.Substring(0, maximumCharacters) + Environment.NewLine +
                   "[" + label + " TRUNCATED - ORIGINAL LENGTH: " +
                   text.Length.ToString("N0") + " CHARACTERS]";
        }

        // ===================================================================================
        // SINKS -- Event Log first, then files, in strictly decreasing preference.
        // ===================================================================================

        /// <summary>
        /// Writes to the Event Log when the source is registered, otherwise degrades to a file and
        /// records why it degraded. Today's silent failure -- a file sink whose directory could not
        /// be created, swallowed with no trace anywhere -- is exactly what the "record why" step
        /// exists to prevent.
        /// </summary>
        private static void WriteReport(string report, int eventId)
        {
            WriteReport(report, eventId, EventLogEntryType.Error);
        }

        private static void WriteReport(string report, int eventId, EventLogEntryType entryType)
        {
            if (TryWriteToEventLog(report, eventId, entryType))
            {
                return;
            }

            string degradationNotice =
                "===== CRYSTAL REPORT DIAGNOSTICS DEGRADED =====" + Environment.NewLine +
                "The Windows Event Log sink is unavailable, so this report was written to a file " +
                "instead." + Environment.NewLine +
                "Register the event source once, elevated, on this host:" + Environment.NewLine +
                "    New-EventLog -LogName " + EventLogName + " -Source \"" + EventSourceName + "\"" +
                Environment.NewLine +
                "===============================================" + Environment.NewLine +
                Environment.NewLine;

            WriteToFile(degradationNotice + report);
        }

        private static bool TryWriteToEventLog(string report, int eventId, EventLogEntryType entryType)
        {
            try
            {
                if (!IsEventSourceAvailable())
                {
                    return false;
                }

                EventLog.WriteEntry(EventSourceName, report, entryType, eventId);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Probes and caches. SourceExists enumerates under HKLM and commonly throws
        /// SecurityException for a restricted app pool identity, which is treated as "unavailable"
        /// rather than allowed to propagate. A positive result is trusted for the process lifetime;
        /// a negative one expires after <see cref="NegativeProbeExpiry"/> so a source registered
        /// after this app pool started is picked up without needing a recycle.
        /// </summary>
        private static bool IsEventSourceAvailable()
        {
            lock (EventSourceProbeLock)
            {
                if (_eventSourceAvailable.HasValue)
                {
                    bool cachedNegativeAndFresh =
                        !_eventSourceAvailable.Value &&
                        DateTime.UtcNow - _eventSourceProbedAt < NegativeProbeExpiry;

                    if (_eventSourceAvailable.Value || cachedNegativeAndFresh)
                    {
                        return _eventSourceAvailable.Value;
                    }
                }

                bool available;

                try
                {
                    available = EventLog.SourceExists(EventSourceName);
                }
                catch
                {
                    available = false;
                }

                _eventSourceAvailable = available;
                _eventSourceProbedAt = DateTime.UtcNow;
                return available;
            }
        }

        /// <summary>
        /// Fallback sink. App_Data first because it sits beside the deployed app and needs no
        /// server-wide access to read; the OS temp directory second, because an app pool identity
        /// can write there without anyone granting an ACL -- confirmed live on 2026-09-07, when the
        /// App_Data write was silently denied and produced nothing at all.
        /// </summary>
        private static void WriteToFile(string report)
        {
            string fileName = "CrystalReportErrors_" + DateTime.Now.ToString("yyyyMMdd") + ".log";

            try
            {
                WriteToDirectory(HostingEnvironment.MapPath("~/App_Data/Logs"), fileName, report);
            }
            catch
            {
                try
                {
                    WriteToDirectory(
                        Path.Combine(Path.GetTempPath(), "CrystalReportServiceLogs"),
                        fileName,
                        report);
                }
                catch
                {
                    // Every sink is gone. Deliberately silent -- see Log's outer catch.
                }
            }
        }

        private static void WriteToDirectory(string directory, string fileName, string report)
        {
            if (string.IsNullOrEmpty(directory))
            {
                throw new InvalidOperationException("Log directory could not be resolved.");
            }

            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.AppendAllText(Path.Combine(directory, fileName), report + Environment.NewLine);
        }

        /// <summary>
        /// Called once at application start so a host missing its event source is discovered then,
        /// in the fallback log, rather than at the first real failure.
        /// </summary>
        public static void VerifyEventSourceRegistration()
        {
            try
            {
                if (IsEventSourceAvailable())
                {
                    return;
                }

                // Best-effort self-registration. CreateEventSource writes registry keys under
                // HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\, which this app
                // pool's ApplicationPoolIdentity does not have rights for by default, so this is
                // expected to throw and fall through to the warning below on this host. Kept as
                // a forward-looking safety net: if the app pool identity or registry ACLs are
                // ever changed to permit it (e.g. on a future redeploy to a different host),
                // registration happens automatically instead of staying permanently dependent on
                // someone remembering to run New-EventLog by hand.
                try
                {
                    EventLog.CreateEventSource(EventSourceName, EventLogName);
                    _eventSourceAvailable = true;
                    _eventSourceProbedAt = DateTime.UtcNow;
                    return;
                }
                catch
                {
                    // Expected under the standard locked-down ApplicationPoolIdentity -- fall
                    // through to the documented-manual-step warning below.
                }

                WriteToFile(
                    "===== CRYSTAL REPORT DIAGNOSTICS STARTUP WARNING =====" + Environment.NewLine +
                    "Timestamp: " + DateTimeOffset.Now.ToString("O") + Environment.NewLine +
                    "Event source \"" + EventSourceName + "\" is not registered on this host, so " +
                    "report failures will be written to this file instead of the Event Log." +
                    Environment.NewLine +
                    "Register it once, elevated:" + Environment.NewLine +
                    "    New-EventLog -LogName " + EventLogName + " -Source \"" + EventSourceName + "\"" +
                    Environment.NewLine +
                    "======================================================" + Environment.NewLine);
            }
            catch
            {
                // Startup must never fail because diagnostics could not introspect themselves.
            }
        }

        // ===================================================================================
        // EXCEPTION INSPECTION
        // ===================================================================================

        private static Exception GetRootException(Exception exception)
        {
            Exception current = exception;
            int depth = 0;

            while (current != null && current.InnerException != null && depth < MaximumExceptionChainDepth)
            {
                current = current.InnerException;
                depth++;
            }

            return current;
        }

        private static SqlException FindSqlException(Exception exception)
        {
            int depth = 0;

            for (Exception current = exception;
                 current != null && depth < MaximumExceptionChainDepth;
                 current = current.InnerException, depth++)
            {
                SqlException sqlException = current as SqlException;

                if (sqlException != null)
                {
                    return sqlException;
                }
            }

            return null;
        }

        private static bool ContainsType(Exception exception, Type type)
        {
            int depth = 0;

            for (Exception current = exception;
                 current != null && depth < MaximumExceptionChainDepth;
                 current = current.InnerException, depth++)
            {
                if (type.IsInstanceOfType(current))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Returns the first stack frame belonging to this assembly, so the report points at our
        /// code rather than at a Crystal or ASP.NET frame. Requires the PDB to be deployed
        /// alongside the assembly -- without it the "in file:line" fragment is absent and this
        /// returns null, which renders as "Not Available".
        /// </summary>
        private static StackFrameInfo GetFirstApplicationStackFrame(Exception exception)
        {
            try
            {
                if (exception == null || string.IsNullOrEmpty(exception.StackTrace))
                {
                    return null;
                }

                string[] lines = exception.StackTrace.Split(
                    new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

                foreach (string line in lines)
                {
                    if (line.IndexOf("CrystalReportService", StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        continue;
                    }

                    Match match = StackFramePattern.Match(line);

                    if (!match.Success)
                    {
                        continue;
                    }

                    string method = match.Groups["method"].Value.Trim();

                    return new StackFrameInfo
                    {
                        Method = method,
                        DeclaringType = DeriveDeclaringType(method),
                        File = match.Groups["file"].Value.Trim(),
                        Line = match.Groups["line"].Value.Trim()
                    };
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        private static string DeriveDeclaringType(string method)
        {
            if (string.IsNullOrEmpty(method))
            {
                return null;
            }

            int parenthesis = method.IndexOf('(');
            string withoutArguments = parenthesis >= 0 ? method.Substring(0, parenthesis) : method;
            int lastDot = withoutArguments.LastIndexOf('.');

            return lastDot > 0 ? withoutArguments.Substring(0, lastDot) : null;
        }

        // ===================================================================================
        // SQL ERROR REFERENCE
        // ===================================================================================

        private static string DescribeSqlError(int number)
        {
            switch (number)
            {
                case 547: return "Foreign key or check constraint violation.";
                case 2601: return "Duplicate key -- unique index violated.";
                case 2627: return "Unique or primary key constraint violated.";
                case 515: return "NULL inserted into a NOT NULL column.";
                case 8152:
                case 2628: return "String or binary data would be truncated.";
                case 1205: return "Deadlock -- this request was chosen as the victim.";
                case 208: return "Invalid object name -- the table, view or procedure does not exist.";
                case 207: return "Invalid column name.";
                case 18456: return "Login failed for the configured SQL user.";
                case 245: return "Conversion failed converting a value to its target type.";
                case 8114: return "Error converting a data type.";
                case 8115: return "Arithmetic overflow converting a value.";
                case -2: return "Query timeout expired.";
                default: return "SQL Server error " + number + ".";
            }
        }

        /// <summary>
        /// Note 18456 is covered here. The WebAPI-side handler maps that number to a description but
        /// has no matching recommended action, so it silently falls through to its generic advice --
        /// worth fixing there too.
        /// </summary>
        private static string RecommendSqlAction(int number, string dbObjectName)
        {
            string target = Coalesce(dbObjectName, "the backing SQL object");

            switch (number)
            {
                case 547:
                    return "A referenced row is missing or still referenced. Check the constraint " +
                           "named in the message.";
                case 2601:
                case 2627:
                    return "A duplicate value reached a unique index. Check the key columns named " +
                           "in the message.";
                case 515:
                    return "A required column received NULL. Check the column named in the message.";
                case 8152:
                case 2628:
                    return "A value exceeded its column width. Compare the column definition to " +
                           "the value in the message.";
                case 1205:
                    return "Transient. Retry the report. If it recurs, review lock ordering and " +
                           "the isolation level of " + target + ".";
                case 208:
                    return target + " does not exist on the connected database. Confirm the " +
                           "MypsDb connection string points at the intended database and that the " +
                           "object is deployed there.";
                case 207:
                    return "A column referenced by " + target + " no longer exists. Compare its " +
                           "definition to the current schema.";
                case 18456:
                    return "The SQL credentials in the MypsDb connection string were rejected. " +
                           "Confirm the login exists, is enabled, and has access to the database.";
                case 245:
                case 8114:
                    return "A value could not be converted to its target type. Check the " +
                           "parameters section above against the column types " + target + " expects.";
                case 8115:
                    return "A numeric value exceeded the range of its target type inside " + target + ".";
                case -2:
                    return "Check the execution plan and indexes for " + target + " in SSMS.";
                default:
                    return "Review the SQL DIAGNOSTICS section and run " + target +
                           " directly in SSMS with the parameters above.";
            }
        }

        // ===================================================================================
        // SMALL HELPERS
        // ===================================================================================

        private static string Coalesce(string value, string fallback)
        {
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }

        private static string NullIfWhiteSpace(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        private static string SafeMachineName()
        {
            try
            {
                return Environment.MachineName;
            }
            catch
            {
                return null;
            }
        }

        // ===================================================================================
        // MODELS
        // ===================================================================================

        private sealed class FailureClassification
        {
            public FailureClassification(
                string failureKind,
                int eventId,
                string likelyCause,
                string recommendedFix)
            {
                FailureKind = failureKind;
                EventId = eventId;
                LikelyCause = likelyCause;
                RecommendedFix = recommendedFix;
            }

            public string FailureKind { get; private set; }
            public int EventId { get; private set; }
            public string LikelyCause { get; private set; }
            public string RecommendedFix { get; private set; }
        }

        private sealed class StackFrameInfo
        {
            public string Method { get; set; }
            public string DeclaringType { get; set; }
            public string File { get; set; }
            public string Line { get; set; }
        }
    }
}
