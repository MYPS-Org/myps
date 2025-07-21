using System.Net.Http.Json;
using System.Text.Json;

namespace Helpers
{
    public static class Functions
    {
        public static string GenerateProjec2ndSegment(int endYear)
        {
            int startYear = 2016;
            int count = endYear - startYear;
            return count.ToString("D3");
        }
    }
}
