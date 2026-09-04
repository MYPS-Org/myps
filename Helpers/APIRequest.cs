using System.Net.Http.Json;
using System.Text.Json;

namespace Helpers
{
    public static class APIRequest
    {
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

            if (Appsetting.Environment == "Development")
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
                    Console.WriteLine($"[ERROR] APIRequest.XML: network/TLS failure calling {request.RequestUri}. {ex}");
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
                            Console.WriteLine($"[ERROR] APIRequest.XML: ReadResponseContent threw. {ex}\nResponse body: {body}");
                        }
                    else
                    {
                        string body = await SafeReadBody(response);
                        Console.WriteLine($"[ERROR] APIRequest.XML: non-success status {(int)response.StatusCode} {response.StatusCode}.\nResponse body: {body}");
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
