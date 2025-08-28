using DBHelper.Data;
using DBHelper.Models.Extra;
using Microsoft.AspNetCore.Http;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using System.Drawing;
using System.Net.Http.Json;
using System.Text;
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
        public static string GenerateProjec1stSegment(string StageName)
        {
            var stageGroups = new Dictionary<string, string[]>
            {
                { "BP", new[] { "RBP", "UPMO", "UBP" } },
                { "MY", new[] { "RDIP", "UDIP", "PIP" } },
                { "P",  new[] { "BP", "NEP", "HGAB", "GAA" } }
            };
            return stageGroups.FirstOrDefault(g => g.Value.Contains(StageName)).Key ?? "P";
        }
        public static string GenerateCode(this string TableName)
        {
            var uidList = new List<string>();
            var param = new Dictionary<string, object> { { "@Table", TableName } };
            return Sql.NormalQuery<string>(
                Appsetting.ConnectionString,
                "EXEC pGenerateUID @Table = @Table", param
            ).FirstOrDefault() ?? string.Empty;
        }
        public static bool IsFileCorrupted(this FileUpload File)
        {

            string FileName = File.Name;
            string Extension = File.Extension;
            var AllowedPngs = new[] { "jpg", "jpeg", "png" };
            return AllowedPngs.Contains(Extension) ? File.IsPhotoCorrupted() : (Extension == "pdf" ? File.IsPdfCorrupted() : File.IsExcelCorrupted());
        }
        public static bool IsPhotoCorrupted(this FileUpload file)
        {
            try
            {
                string base64Data = file.DataUrl.Contains(",")
                    ? file.DataUrl.Split(',')[1]
                    : file.DataUrl;

                byte[] imageBytes = Convert.FromBase64String(base64Data);

                using var ms = new MemoryStream(imageBytes);
                using var image = SixLabors.ImageSharp.Image.Load(ms);

                return image == null;
            }
            catch
            {
                return true; // Corrupted or invalid image
            }
        }
        public static bool IsPdfCorrupted(this FileUpload file)
        {
            try
            {
                if (file.ContentType != "application/pdf")
                    return true;

                string base64Data = file.DataUrl.Contains(",")
                    ? file.DataUrl.Split(',')[1]
                    : file.DataUrl;

                byte[] imageBytes = Convert.FromBase64String(base64Data);

                using (var ms = new MemoryStream(imageBytes))
                {
                    using var reader = new BinaryReader(ms);
                    var signature = reader.ReadBytes(5);
                    return !Encoding.ASCII.GetString(signature).StartsWith("%PDF-");
                }
            }
            catch
            {
                return true;
            }
        }
        public static bool IsExcelCorrupted(this FileUpload file)
        {
            try
            {
                var allowedExtensions = new[] { ".xls", ".xlsx" };
                var extension = Path.GetExtension(file.Extension).ToLowerInvariant();

                if (!allowedExtensions.Contains(extension))
                    return true;

                if (!file.ContentType.Contains("excel") &&
                    !file.ContentType.Contains("spreadsheet"))
                    return true;

                string base64Data = file.DataUrl.Contains(",")
                    ? file.DataUrl.Split(',')[1]
                    : file.DataUrl;

                byte[] excelBytes = Convert.FromBase64String(base64Data);
                using var stream = new MemoryStream(excelBytes);

                using var package = new ExcelPackage(stream);
                var workbook = package.Workbook;
                return workbook == null || workbook.Worksheets.Count == 0;
            }
            catch
            {
                return true;
            }
        }
        public static string ToOrdinal(this int number)
        {
            if (number <= 0) return number.ToString();

            int lastTwoDigits = number % 100;
            int lastDigit = number % 10;

            string suffix;

            if (lastTwoDigits >= 11 && lastTwoDigits <= 13)
            {
                suffix = "th";
            }
            else
            {
                switch (lastDigit)
                {
                    case 1: suffix = "st"; break;
                    case 2: suffix = "nd"; break;
                    case 3: suffix = "rd"; break;
                    default: suffix = "th"; break;
                }
            }

            return $"{number}{suffix}";
        }

    }
}
