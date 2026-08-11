using CrystalReportService.Services;
using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web.Http;

namespace WebAPI.CrystalReportService.Controllers
{
    [RoutePrefix("api/reports")]
    public class ReportsController : ApiController
    {
        private readonly ICrystalReportRenderer _renderer;

        // Default ctor for Web API's activator; swap in a DI container
        // (Unity, Autofac, etc.) if you want this properly injected/testable.
        public ReportsController() : this(new CrystalReportRenderer()) { }

        public ReportsController(ICrystalReportRenderer renderer)
        {
            _renderer = renderer;
        }

        /// <summary>
        /// GET api/reports/myps-pub-program?ProgramId=P_CO-PS-635_04112025_134220
        /// Any extra query-string keys are passed through to the renderer,
        /// which only applies the ones the report actually defines.
        /// </summary>
        [HttpGet]
        [Route("{reportName}")]
        public HttpResponseMessage Get(string reportName)
        {
            var parameters = Request.GetQueryNameValuePairs()
                .ToDictionary(kv => kv.Key, kv => (object)kv.Value, StringComparer.OrdinalIgnoreCase);

            byte[] pdfBytes;
            try
            {
                pdfBytes = _renderer.RenderToPdf(reportName, parameters);
            }
            catch (FileNotFoundException ex)
            {
                return Request.CreateErrorResponse(HttpStatusCode.NotFound, ex.Message);
            }
            catch (ArgumentException ex)
            {
                return Request.CreateErrorResponse(HttpStatusCode.BadRequest, ex.Message);
            }
            catch (TimeoutException ex)
            {
                return Request.CreateErrorResponse(HttpStatusCode.GatewayTimeout, ex.Message);
            }
            catch (Exception ex)
            {
                // Log ex here (this is exactly where a locked .rpt file or a
                // DB connectivity issue will surface). Walk InnerException
                // because wrapper exceptions like TypeInitializationException
                // hide the real cause in ex.Message alone.
                var detail = ex.Message;
                var inner = ex.InnerException;
                while (inner != null)
                {
                    detail += " ---> " + inner.Message;
                    inner = inner.InnerException;
                }
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, detail);
            }

            var response = Request.CreateResponse(HttpStatusCode.OK);
            response.Content = new ByteArrayContent(pdfBytes);
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            response.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("inline")
            {
                FileName = $"{reportName}.pdf"
            };
            return response;
        }
    }
}

//using System;
//using System.Diagnostics;
//using System.IO;
//using System.Linq;
//using System.Net;
//using System.Net.Http;
//using System.Net.Http.Headers;
//using System.Text;
//using System.Web.Http;
//using CrystalReportService.Services;

//namespace CrystalReportService.Controllers
//{
//    [RoutePrefix("api/reports")]
//    public class ReportsController : ApiController
//    {
//        private readonly ICrystalReportRenderer _renderer;

//        // Default ctor for Web API's activator; swap in a DI container
//        // (Unity, Autofac, etc.) if you want this properly injected/testable.
//        public ReportsController() : this(new CrystalReportRenderer()) { }

//        public ReportsController(ICrystalReportRenderer renderer)
//        {
//            _renderer = renderer;
//        }

//        /// <summary>
//        /// GET api/reports/myps-pub-program?ProgramId=P_CO-PS-635_04112025_134220
//        /// Any extra query-string keys are passed through to the renderer,
//        /// which only applies the ones the report actually defines.
//        /// </summary>
//        [HttpGet]
//        [Route("{reportName}")]
//        public HttpResponseMessage Get(string reportName)
//        {
//            var parameters = Request.GetQueryNameValuePairs()
//                .ToDictionary(kv => kv.Key, kv => (object)kv.Value, StringComparer.OrdinalIgnoreCase);

//            byte[] pdfBytes;
//            try
//            {
//                pdfBytes = _renderer.RenderToPdf(reportName, parameters);
//            }
//            catch (FileNotFoundException ex)
//            {
//                return Request.CreateErrorResponse(HttpStatusCode.NotFound, ex.Message);
//            }
//            catch (Exception ex)
//            {
//                // ex.Message alone is useless for TypeInitializationException (the
//                // ReportDocument static ctor failure that fires when the CR runtime
//                // isn't installed/registered) - it's always the generic "type
//                // initializer threw" wrapper. The real cause lives in InnerException.
//                Trace.TraceError("Report render failed for '{0}': {1}", reportName, ex);
//                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, BuildErrorMessage(ex));
//            }

//            var response = Request.CreateResponse(HttpStatusCode.OK);
//            response.Content = new ByteArrayContent(pdfBytes);
//            response.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
//            response.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("inline")
//            {
//                FileName = $"{reportName}.pdf"
//            };
//            return response;
//        }

//        /// <summary>
//        /// Flattens ex + its InnerException chain into one message. Needed because
//        /// wrapper exceptions (TypeInitializationException, TargetInvocationException)
//        /// put the actual failure reason in InnerException, not Message.
//        /// </summary>
//        private static string BuildErrorMessage(Exception ex)
//        {
//            var sb = new StringBuilder();
//            for (var current = ex; current != null; current = current.InnerException)
//            {
//                if (sb.Length > 0) sb.Append(" ---> ");
//                sb.Append(current.Message);
//            }
//            return sb.ToString();
//        }
//    }
//}