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
                using (var response = await client.SendAsync(request.ToHttpRequest()))
                {
                    if (response.IsSuccessStatusCode)
                        try
                        {
                            return await request.ReadResponseContent(response.Content);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine(ex);
                            // Do nothing (for now)
                        }
                    else
                    {
                        Console.WriteLine(response.ToString());
                    }
                    return default;
                }
            }
        }
    }
}
