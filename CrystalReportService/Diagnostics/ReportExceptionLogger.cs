using System.Threading;
using System.Threading.Tasks;
using System.Web.Http.ExceptionHandling;

namespace CrystalReportService.Diagnostics
{
    /// <summary>
    /// Global Web API exception logger -- catches whatever <see cref="CrystalReportService.Services.CrystalReportRenderer"/>'s
    /// own instrumented catch blocks don't, e.g. an unknown report name, or a genuinely unexpected
    /// failure outside the renderer entirely. Registered in <c>WebApiConfig.Register</c>, a slot that
    /// was previously empty.
    /// <para>
    /// Skips anything <see cref="ReportDiagnosticLogger"/> already recorded (marked via
    /// <see cref="ReportDiagnosticLogger.AlreadyLogged"/>), so a failure that passed through the
    /// renderer's own logging is never written twice.
    /// </para>
    /// </summary>
    public sealed class ReportExceptionLogger : ExceptionLogger
    {
        private readonly IReportDiagnosticLogger _diagnosticLogger;

        public ReportExceptionLogger() : this(new ReportDiagnosticLogger())
        {
        }

        public ReportExceptionLogger(IReportDiagnosticLogger diagnosticLogger)
        {
            _diagnosticLogger = diagnosticLogger;
        }

        public override Task LogAsync(ExceptionLoggerContext context, CancellationToken cancellationToken)
        {
            if (context != null && context.Exception != null &&
                !ReportDiagnosticLogger.AlreadyLogged(context.Exception))
            {
                var diagnosticContext = new ReportDiagnosticContext
                {
                    FailureLocation = "Unhandled at Web API boundary"
                };

                if (context.Request != null)
                {
                    diagnosticContext.RequestMethod = context.Request.Method == null
                        ? null
                        : context.Request.Method.Method;
                    diagnosticContext.RequestUri = context.Request.RequestUri == null
                        ? null
                        : context.Request.RequestUri.ToString();
                }

                _diagnosticLogger.Log(context.Exception, diagnosticContext);
            }

            return base.LogAsync(context, cancellationToken);
        }
    }
}
