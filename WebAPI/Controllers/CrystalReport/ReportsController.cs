using CrystalReportService.Services;
using Microsoft.AspNetCore.Mvc;

namespace WebAPI.Controllers.CrystalReport
{
    [ApiController]
    //[Route("api/[controller]/[action]")]
    [Route("api/reports")]
    public class ReportsController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ReportsController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        /// <summary>
        /// GET api/reports/{reportName}?param1=x&amp;param2=y
        /// Proxies to the internal .NET Framework 4.8 Crystal Reports service
        /// (a completely separate project/deployment) and streams the
        /// resulting PDF straight back to the caller. This controller does
        /// NOT touch Crystal Reports itself - net8.0 can't run that engine.
        /// </summary>
        [HttpGet("{reportName}")]
        public async Task<IActionResult> Get(string reportName, [FromQuery] Dictionary<string, string> query)
        {
            var client = _httpClientFactory.CreateClient("ReportService");

            var queryString = string.Join("&",
                query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
            var requestUri = $"api/reports/{reportName}" + (queryString.Length > 0 ? $"?{queryString}" : string.Empty);

            using var response = await client.GetAsync(requestUri, HttpCompletionOption.ResponseHeadersRead);

            if (!response.IsSuccessStatusCode)
            {
                var problemDetail = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, problemDetail);
            }

            var pdfStream = await response.Content.ReadAsStreamAsync();
            return File(pdfStream, "application/pdf", $"{reportName}.pdf");
        }
    }
}