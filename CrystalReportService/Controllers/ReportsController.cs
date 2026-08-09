using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web.Http;
using CrystalReportService.Services;

namespace CrystalReportService.Controllers
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
            catch (Exception ex)
            {
                // Log ex here (this is exactly where a bad/missing SP parameter,
                // a locked .rpt file, or a DB connectivity issue will surface).
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, ex.Message);
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