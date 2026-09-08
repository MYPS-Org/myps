using System.Collections.Generic;

namespace CrystalReportService.Diagnostics
{
    /// <summary>
    /// Everything known about the report request at the moment a failure occurred. Assembled by the
    /// caller (the renderer knows its report definition; the Web API exception logger knows the HTTP
    /// request) and handed to <see cref="IReportDiagnosticLogger"/> so one diagnostic report can
    /// carry both halves of the picture.
    /// <para>
    /// Every property is optional. The logger renders anything left unset as the literal string
    /// "Not Available" rather than omitting the line, so a report is always the same shape and stays
    /// greppable -- the same convention the WebAPI-side handler uses.
    /// </para>
    /// </summary>
    public sealed class ReportDiagnosticContext
    {
        /// <summary>The report key from the request URL, e.g. "rbp-summary-report".</summary>
        public string ReportName { get; set; }

        /// <summary>
        /// Where in the render pipeline this failed, e.g. "report.ExportToStream". Free text, but
        /// keep it stable per call site -- it is the fastest way to bucket failures by hand.
        /// </summary>
        public string FailureLocation { get; set; }

        /// <summary>The .rpt file backing this report, e.g. "RBP Summary Report.rpt".</summary>
        public string RptFileName { get; set; }

        /// <summary>"StoredProcedure" or "View" -- which kind of source backs this report.</summary>
        public string SourceType { get; set; }

        /// <summary>The stored procedure or view the report's data comes from.</summary>
        public string DbObjectName { get; set; }

        /// <summary>Request parameters. Redacted by the logger before anything is written.</summary>
        public IDictionary<string, object> Parameters { get; set; }

        /// <summary>HTTP method, when the failure was observed at the Web API layer.</summary>
        public string RequestMethod { get; set; }

        /// <summary>Request URI, when the failure was observed at the Web API layer.</summary>
        public string RequestUri { get; set; }

        /// <summary>
        /// Diagnostic capture of every table's original and rewritten <c>Location</c> (main report
        /// and subreports), taken during <c>ApplyDatabaseLogon</c> regardless of whether that step
        /// itself succeeds. Temporary instrumentation added 2026-09-07 to find why the existing
        /// Location-rewrite fix still leaves some View-backed reports failing at ExportToStream --
        /// remove once the real cause is found and fixed, so reports don't carry this permanently.
        /// </summary>
        public string TableLocationDiagnostics { get; set; }
    }
}
