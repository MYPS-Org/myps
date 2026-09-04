using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Net.Security;
using System.Text.Json;

namespace Helpers
{
    public static class APIRequest
    {
        // 2026-09-04: set once at startup (Main/Program.cs) from the built DI container's
        // ILoggerFactory. APIRequest is a static helper with no DI of its own, so this is the
        // minimal way to route its diagnostics through the same ILogger pipeline
        // ExceptionHandler uses -- Console.WriteLine never reached the same log sink as the
        // "MYPS ERROR EVENT" reports, making every earlier diagnostic addition here invisible
        // in practice. Null-conditional everywhere it's used: a request theoretically arriving
        // before startup wires this is a silent no-op, not a new crash.
        public static ILogger? Logger { get; set; }

        private static readonly HttpClient _httpClient = new HttpClient();
        public static async Task<T> Post<T>(string url, object payload)
        {
            // Send POST request with JSON payload
            HttpResponseMessage response = await _httpClient.PostAsJsonAsync(url, payload);

            // Ensure success status code
            response.EnsureSuccessStatusCode();

            // Read and deserialize the response body
            var result = await response.Content.ReadFromJsonAsync<T>(new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return result;
        }

        public static async Task<T> XML<T>(XMLRequest<T> request)
        {
            var handler = new HttpClientHandler();

            if (Appsetting.Environment == "Development" || Appsetting.Environment == "Staging")
            {
                /*
                 * eptisa-dev.com (the dev-network stand-in for the real
                 * DPWH PIS service) serves an mkcert-issued certificate
                 * whose root CA is not trusted on every dev machine.
                 * Skip validation for this call in Development only.
                 */
                handler.ServerCertificateCustomValidationCallback =
                    HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
            }
            else
            {
                // 2026-09-04: log full certificate-chain detail on a validation failure outside
                // Development -- does NOT change the trust decision. Returns exactly what .NET's
                // default validator would decide with no custom callback at all
                // (sslPolicyErrors == None); this only adds logging on the way to that same
                // decision, so a real chain failure still fails identically. Added after a
                // PartialChain failure against apps.dpwh.gov.ph reached the generic exception
                // handler with no chain detail, requiring a separate manual diagnostic to
                // pinpoint which certificate was the problem.
                handler.ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) =>
                {
                    if (sslPolicyErrors != SslPolicyErrors.None)
                    {
                        var chainDetail = new System.Text.StringBuilder();
                        if (chain != null)
                        {
                            foreach (var status in chain.ChainStatus)
                            {
                                chainDetail.AppendLine($"  ChainStatus: {status.Status} - {status.StatusInformation}");
                            }
                            foreach (var element in chain.ChainElements)
                            {
                                chainDetail.AppendLine($"  Chain element: {element.Certificate.Subject} | Issuer: {element.Certificate.Issuer}");
                                foreach (var elementStatus in element.ChainElementStatus)
                                {
                                    chainDetail.AppendLine($"    Element issue: {elementStatus.Status} - {elementStatus.StatusInformation}");
                                }
                            }
                        }
                        Logger?.LogError(
                            "APIRequest.XML: certificate validation failed for {RequestUri}. SslPolicyErrors: {SslPolicyErrors}\n{ChainDetail}",
                            request.RequestUri, sslPolicyErrors, chainDetail.ToString());
                    }
                    return sslPolicyErrors == SslPolicyErrors.None;
                };
            }

            using (var client = new HttpClient(handler))
            {
                HttpResponseMessage response;
                try
                {
                    response = await client.SendAsync(request.ToHttpRequest());
                }
                catch (Exception ex)
                {
                    // 2026-09-04: a network/TLS-level failure (e.g. a broken certificate chain)
                    // throws here, before there's any HttpResponseMessage to log a body from --
                    // previously this reached the caller's generic exception handler with zero
                    // context from APIRequest itself about which PIS call/host was involved.
                    // Re-thrown unchanged so callers keep seeing the original exception type and
                    // stack trace; this only adds a log line, it doesn't swallow or reshape it.
                    Logger?.LogError(ex, "APIRequest.XML: network/TLS failure calling {RequestUri}", request.RequestUri);
                    throw;
                }
                using (response)
                {
                    // 2026-09-04: previously only logged response.ToString() (status/headers) or
                    // the exception object -- the response BODY, where a SOAP fault's actual detail
                    // lives, was never logged either way, making every failure here undiagnosable.
                    if (response.IsSuccessStatusCode)
                        try
                        {
                            return await request.ReadResponseContent(response.Content);
                        }
                        catch (Exception ex)
                        {
                            string body = await SafeReadBody(response);
                            Logger?.LogError(ex, "APIRequest.XML: ReadResponseContent threw. Response body: {ResponseBody}", body);
                        }
                    else
                    {
                        string body = await SafeReadBody(response);
                        Logger?.LogError(
                            "APIRequest.XML: non-success status {StatusCode} {ReasonPhrase}. Response body: {ResponseBody}",
                            (int)response.StatusCode, response.StatusCode, body);
                    }
                    return default;
                }
            }
        }

        private static async Task<string> SafeReadBody(HttpResponseMessage response)
        {
            try
            {
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                return $"<could not read response body: {ex.Message}>";
            }
        }
    }
}
