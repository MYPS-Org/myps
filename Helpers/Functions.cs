using Microsoft.AspNetCore.Http;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DBHelper.Models.Extra;

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
        public static bool IsFileCorreupted(this FileUpload File)
        {

            string FileName = File.Name;
            string Extension = File.Extension;
            var AllowedPngs = new[] { ".jpg", ".jpeg", ".png" };
            return AllowedPngs.Contains(Extension) ? File.IsFileCorreupted() : (Extension == "pdf" ? File.IsPdfCorrupted() : File.IsExcelCorrupted());
        }
        public static bool IsPhotoCorrupted(this FileUpload file)
        {
            try
            {
                if (!file.ContentType.StartsWith("image/"))
                    return true;

                using var stream = new MemoryStream();
                file.CopyTo(stream);
                stream.Position = 0;
                using var img = Image.Load(stream.OpenReadStream());
                if (img == null)
                    return true;

                // Step 4: Optional size limit check
                const long maxSize = 10 * 1024 * 1024; // 10MB
                if (file.Length > maxSize)
                    return true;

                return false; // Image seems fine
            }
            catch
            {
                return true; // Exception implies corrupted or unsafe image
            }
        }
        public static bool IsPdfCorrupted(this IFormFile file)
        {
            try
            {
                // Basic check
                if (Path.GetExtension(file.FileName).ToLower() != ".pdf" ||
                    file.ContentType != "application/pdf")
                    return true;

                // Size limit (optional)
                const long maxSize = 20 * 1024 * 1024; // 20MB
                if (file.Length > maxSize)
                    return true;

                // Read first few bytes to validate PDF header
                using var reader = new BinaryReader(file.OpenReadStream());
                var signature = reader.ReadBytes(5);
                return !Encoding.ASCII.GetString(signature).StartsWith("%PDF-");
            }
            catch
            {
                return true;
            }
        }
        public static bool IsExcelCorrupted(this IFormFile file)
        {
            try
            {
                var allowedExtensions = new[] { ".xls", ".xlsx" };
                var extension = Path.GetExtension(file.FileName).ToLower();

                if (!allowedExtensions.Contains(extension))
                    return true;

                // Check MIME type
                if (!file.ContentType.Contains("excel") &&
                    !file.ContentType.Contains("spreadsheet"))
                    return true;

                // Use EPPlus to validate Excel content
                using var stream = new MemoryStream();
                file.CopyTo(stream);
                stream.Position = 0;

                using var package = new ExcelPackage(stream);
                var workbook = package.Workbook;
                return workbook == null || workbook.Worksheets.Count == 0;
            }
            catch
            {
                return true;
            }
        }
    }
}
