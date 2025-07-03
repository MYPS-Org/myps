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
            using (var client = new HttpClient())
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
