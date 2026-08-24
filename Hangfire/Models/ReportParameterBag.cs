using System.Text.Json;
using System.Web;

namespace Hangfire.Models;

public static class ReportParameterBag
{
    public static Dictionary<string, string> Parse(string? storedValue)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(storedValue))
            return result;

        if (storedValue.TrimStart().StartsWith('{'))
        {
            using var doc = JsonDocument.Parse(storedValue);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                result[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.Null => string.Empty,
                    JsonValueKind.String => prop.Value.GetString() ?? string.Empty,
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => prop.Value.ToString()
                };
            }
            return result;
        }

        var parsed = HttpUtility.ParseQueryString(storedValue);
        foreach (var key in parsed.AllKeys.Where(k => k != null))
            result[key!] = parsed[key] ?? string.Empty;

        return result;
    }

    public static string ToQueryString(IDictionary<string, string> parameters)
    {
        return string.Join("&", parameters.Select(kv =>
            $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value ?? string.Empty)}"));
    }
}
