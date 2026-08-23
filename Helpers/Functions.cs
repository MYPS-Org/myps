using Dapper;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Table.Revision;
using DBHelper.Models.Views;
using DBHelper.Models.Views.Program;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Data.SqlClient;
using System.Drawing;
using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using static Dapper.SqlMapper;

namespace Helpers
{
    public static class Functions
    {
        private static readonly ConcurrentDictionary<string, string> _sqlCache = new();
        #region CoreController Functions
        public static string ValidateModel(this ModelStateDictionary ModelState)
        {
            var messages = new List<string>();
            var HasError = ModelState.Where(ms => ms.Value.Errors.Count > 0).ToList();
            if(HasError.Count > 0)
            {
                var MainError = (HasError.Count > 1) ? HasError.ElementAt(1) : HasError.FirstOrDefault();
                string key = MainError.Key;
                var errors = MainError.Value!.Errors;

                foreach (var error in errors)
                {
                    var match = Regex.Match(key, @"^(\w+)\[(\d+)\]\.(\w+)$");

                    if (match.Success)
                    {
                        string collection = match.Groups[1].Value;
                        int index = int.Parse(match.Groups[2].Value);
                        string property = match.Groups[3].Value;

                        messages.Add($"{collection} {(index + 1).ToOrdinal()} row: {error.ErrorMessage}");
                    }
                    else
                    {
                        string friendlyMessage = GetFriendlyErrorMessage(key, error);
                        messages.Add(friendlyMessage);
                    }
                }
                
            }
            //foreach (var entry in ModelState.Where(ms => ms.Value.Errors.Count > 0))
            //{
            //    string key = entry.Key;
            //    var errors = entry.Value!.Errors;

            //    foreach (var error in errors)
            //    {
            //        var match = Regex.Match(key, @"^(\w+)\[(\d+)\]\.(\w+)$");

            //        if (match.Success)
            //        {
            //            string collection = match.Groups[1].Value;
            //            int index = int.Parse(match.Groups[2].Value);
            //            string property = match.Groups[3].Value;

            //            messages.Add($"{collection} {(index + 1).ToOrdinal()} row: {error.ErrorMessage}");
            //        }
            //        else
            //        {
            //            string friendlyMessage = GetFriendlyErrorMessage(key, error);
            //            messages.Add(friendlyMessage);
            //        }
            //    }
            //}

            return string.Join("\n", messages);
        }

        public static string GetFriendlyErrorMessage(string key, ModelError error)
        {
            string rawMessage = error.ErrorMessage;

            // Handle JSON deserialization type conversion errors (e.g. invalid date, number, etc.)
            if (string.IsNullOrWhiteSpace(rawMessage) && error.Exception != null)
            {
                rawMessage = error.Exception.Message;
            }

            // Extract field name from key (e.g. "dto" -> "Dto", "$.ComponentCostPerYear[0].StartDate" -> "StartDate")
            string fieldLabel = key.ExtractFieldLabel();

            // Detect null values
            if (Regex.IsMatch(rawMessage, @"invalid start", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel}: is required and cannot be left empty.";
            }

            // Detect invalid date/datetime values
            if (Regex.IsMatch(rawMessage, @"System\.DateTime", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel}: Please provide a valid date (e.g. 2024-01-15).";
            }

            // Detect missing/null required field
            if (Regex.IsMatch(rawMessage, @"required|must not be (null|empty)", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel} is required.";
            }

            // Detect invalid number/integer values
            if (Regex.IsMatch(rawMessage, @"System\.Int|System\.Decimal|System\.Double", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel}: Please provide a valid number.";
            }

            // Detect invalid boolean values
            if (Regex.IsMatch(rawMessage, @"System\.Boolean", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel}: Please provide a valid value (true or false).";
            }

            // Detect invalid string values
            if (Regex.IsMatch(rawMessage, @"System\.String", RegexOptions.IgnoreCase))
            {
                return $"{fieldLabel}: Please provide a valid text value.";
            }

            // Fallback: return the original message if it's already clean
            return $"{fieldLabel}: {rawMessage}";
        }
        public static string ExtractFieldLabel(this string key)
        {
            // Handle JSON path format: $.ComponentCostPerYear[0].StartDate -> StartDate
            var jsonPathMatch = Regex.Match(key, @"\.(\w+)$");
            if (jsonPathMatch.Success)
                return jsonPathMatch.Groups[1].Value; // e.g. "StartDate" -> "Start Date"

            // Handle plain key like "dto"
            if (!string.IsNullOrWhiteSpace(key) && key != "$")
                return key;

            return "A field";
        }
        #endregion
        #region Extras
        public static DateTime CurrentDate()
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        // ✅ Existing — for SELECT queries (returns IQueryable)
        public static IQueryable<T> QueryFromFile<T>(
            this DbContext db,
            string sqlFilePath,
            string? query = null) where T : class
        {
            var sql = GetSqlFromFile(sqlFilePath);

            var composableSql = string.IsNullOrWhiteSpace(query)
                ? sql
                : $"{sql}{Environment.NewLine}{query}";

            return db.Set<T>()
                     .FromSqlRaw(composableSql)
                     .AsNoTracking();
        }

        // ✅ Shared cache helper — avoids duplicating cache logic
        private static string GetSqlFromFile(string sqlFilePath)
        {
            var fullPath = Path.Combine(
                Appsetting.Resources.SQLScripts, sqlFilePath + ".sql");

            return _sqlCache.GetOrAdd(fullPath, path =>
            {
                if (!File.Exists(path))
                    throw new FileNotFoundException(
                        $"SQL file not found: {path}");

                return File.ReadAllText(path);
            });
        }
        public static string UpdateReferenceId(this string Current, string StageName)
        {
            var parts = Current.Split('-');
            string NewStage = StageName.GenerateProjec1stSegment();
            string ReferenceId = parts[0].Replace("BP", NewStage);
            return $"{ReferenceId}-{(parts.Length > 1 ? parts[1] : "0")}-{(parts.Length > 2 && !string.IsNullOrEmpty(parts[2]) ? int.Parse(parts[2]) + 1 : 0)}";
        }
        public static string GenerateReferenceId(this string ReferenceId, string StageName)
        {
            return ReferenceId + "-" + ("tCountComponentCost").GenerateCode() + "-" + StageName;
        }
        public static string GenerateCode(this string TableName)
        {
            var uidList = new List<string>();
            var param = new Dictionary<string, object> { { "@Table", TableName } };
            return Sql.NormalQuery<string>(
                Appsetting.DbConnections.MYPSDb,
                "EXEC pGenerateUID @Table = @Table", param
            ).FirstOrDefault() ?? string.Empty;
        }
        public static bool ValidateFileSize(this FileUpload file, int maxFileSizeInMB)
        {
            const long MB = 1024L * 1024L;
            long maxBytes = maxFileSizeInMB * MB;

            string base64Data = file.DataUrl.Contains(",")
                ? file.DataUrl.Split(',')[1]
                : file.DataUrl;

            // Fast reject (approximate, before decode)
            long estimatedBytes = (base64Data.Length * 3L) / 4L;
            if (estimatedBytes > maxBytes)
                return false;

            // Exact check
            byte[] fileBytes = Convert.FromBase64String(base64Data);
            return fileBytes.LongLength <= maxBytes;
        }
        public static bool UploadFile(this FileUpload file, string filePath)
        {
            try
            {
                // Layer 1: Corruption check
                if (file.IsFileCorrupted())
                    return false;

                // Layer 2: FilePath guard
                if (string.IsNullOrWhiteSpace(filePath))
                    return false;

                // Layer 3: Decode (reuses the same padding-safe helper)
                if (!TryDecodeBase64(file.DataUrl, out byte[] fileBytes))
                    return false;

                // Layer 4: Create directory if it doesn't exist
                string folder = Path.GetDirectoryName(filePath)!;
                if (!string.IsNullOrWhiteSpace(folder) && !Directory.Exists(folder))
                    Directory.CreateDirectory(folder);

                // Layer 5: Write to disk
                System.IO.File.WriteAllBytes(filePath, fileBytes);
                return true;
            }
            catch (Exception e)
            {
                //throw new Exception(new { Message = $"Failed to upload file: {e.Message}.", Title = "File Upload Error" }.ToString());
                return false;
            }
        }
        // -------------------------------------------------------------------------
        // Compiled Regexes (shared, allocated once)
        // -------------------------------------------------------------------------
        private static readonly Regex Base64Regex = new(
            @"^[a-zA-Z0-9\+/]*={0,2}$",
            RegexOptions.Compiled
        );
        private static readonly Regex PdfVersionRegex = new(
            @"^[12]\.\d",
            RegexOptions.Compiled
        );
        private static readonly Regex PdfObjectRegex = new(
            @"\d+\s+\d+\s+obj",
            RegexOptions.Compiled
        );
        private static readonly Regex XrefOffsetRegex = new(
            @"startxref\s+(\d+)\s*%%EOF",
            RegexOptions.Compiled
        );

        // -------------------------------------------------------------------------
        // Allowed types
        // -------------------------------------------------------------------------
        private static readonly string[] AllowedImageExtensions = { "jpg", "jpeg", "png" };
        private static readonly string[] AllowedExcelExtensions = { "xls", "xlsx", "xlsm" };
        private static readonly string[] AllowedExcelContentTypes =
        {
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel.sheet.macroEnabled.12",
            "application/excel",
            "application/x-excel",
            "application/x-msexcel"
        };

        // -------------------------------------------------------------------------
        // Entry point
        // -------------------------------------------------------------------------
        public static bool IsFileCorrupted(this FileUpload file)
        {
            try
            {
                // Null guard
                if (file is null)
                    return true;

                // DataUrl must be present
                if (string.IsNullOrWhiteSpace(file.DataUrl))
                    return true;

                // Must be able to decode before routing
                var result = TryDecodeBase64(file.DataUrl, out byte[] fileBytes);
                if (!result || fileBytes is null || fileBytes.Length == 0)
                    return true;

                string ext = file.Extension.TrimStart('.').ToLowerInvariant().Trim();

                if (AllowedImageExtensions.Contains(ext))
                    return file.IsPhotoCorrupted();

                if (ext == "pdf")
                    return file.IsPdfCorrupted();

                if (AllowedExcelExtensions.Contains(ext))
                    return file.IsExcelCorrupted();

                // Unknown extension — reject
                return true;
            }
            catch
            {
                return true;
            }
        }

        // -------------------------------------------------------------------------
        // Image validation (jpg, jpeg, png)
        // -------------------------------------------------------------------------
        public static bool IsPhotoCorrupted(this FileUpload file)
        {
            try
            {
                // Layer 1: Null guard
                if (file is null)
                    return true;

                // Layer 2: Extension check
                string ext = file.Extension.TrimStart('.').ToLowerInvariant().Trim();
                if (!AllowedImageExtensions.Contains(ext))
                    return true;

                // Layer 3: ContentType check
                if (string.IsNullOrWhiteSpace(file.ContentType) ||
                    !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    return true;

                // Layer 4: Decode base64
                if (!TryDecodeBase64(file.DataUrl, out byte[] imageBytes))
                    return true;

                if (imageBytes is null || imageBytes.Length == 0)
                    return true;

                // Layer 5: Magic bytes check
                // PNG: 89 50 4E 47
                // JPG: FF D8 FF
                bool isPng = imageBytes.Length >= 4 &&
                             imageBytes[0] == 0x89 &&
                             imageBytes[1] == 0x50 &&
                             imageBytes[2] == 0x4E &&
                             imageBytes[3] == 0x47;

                bool isJpg = imageBytes.Length >= 3 &&
                             imageBytes[0] == 0xFF &&
                             imageBytes[1] == 0xD8 &&
                             imageBytes[2] == 0xFF;

                if (!isPng && !isJpg)
                    return true;

                // Layer 6: Match declared extension against actual magic bytes
                if (ext == "png" && !isPng)
                    return true;

                if ((ext == "jpg" || ext == "jpeg") && !isJpg)
                    return true;

                // Layer 7: Full decode via ImageSharp (catches truncated/corrupted images)
                using var ms = new MemoryStream(imageBytes);
                using var image = SixLabors.ImageSharp.Image.Load(ms);
                return image is null || image.Width == 0 || image.Height == 0;
            }
            catch
            {
                return true;
            }
        }

        // -------------------------------------------------------------------------
        // PDF validation
        // -------------------------------------------------------------------------
        public static bool IsPdfCorrupted(this FileUpload file)
        {
            try
            {
                // Layer 1: Null guard
                if (file is null)
                    return true;

                // Layer 2: ContentType check
                if (string.IsNullOrWhiteSpace(file.ContentType) ||
                    !file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
                    return true;

                // Layer 3: Extension check
                string ext = file.Extension.TrimStart('.').ToLowerInvariant().Trim();
                if (ext != "pdf")
                    return true;

                // Layer 4: Decode base64
                if (!TryDecodeBase64(file.DataUrl, out byte[] pdfBytes))
                    return true;

                // Layer 5: Minimum viable PDF size
                if (pdfBytes is null || pdfBytes.Length < 67)
                    return true;

                // Layer 6: Magic bytes — %PDF- (byte-level)
                if (pdfBytes[0] != 0x25 || // %
                    pdfBytes[1] != 0x50 || // P
                    pdfBytes[2] != 0x44 || // D
                    pdfBytes[3] != 0x46 || // F
                    pdfBytes[4] != 0x2D)   // -
                    return true;

                // Layer 7: PDF version must be 1.x or 2.x
                if (pdfBytes.Length < 8)
                    return true;

                string version = Encoding.ASCII.GetString(pdfBytes, 5, 3);
                if (!PdfVersionRegex.IsMatch(version))
                    return true;

                // Layer 8: Must contain at least one object definition in header region
                string headerRegion = Encoding.ASCII.GetString(pdfBytes, 0, Math.Min(pdfBytes.Length, 4096));
                if (!PdfObjectRegex.IsMatch(headerRegion))
                    return true;

                // Layer 9: %%EOF must be within the last 128 bytes (strict tail)
                int eofLen = Math.Min(128, pdfBytes.Length);
                string eofRegion = Encoding.ASCII.GetString(pdfBytes, pdfBytes.Length - eofLen, eofLen);
                if (!eofRegion.Contains("%%EOF"))
                    return true;

                // Layer 10: startxref must exist in trailer region
                int trailerLen = Math.Min(1024, pdfBytes.Length);
                string trailerRegion = Encoding.ASCII.GetString(pdfBytes, pdfBytes.Length - trailerLen, trailerLen);
                if (!trailerRegion.Contains("startxref"))
                    return true;

                // Layer 11: startxref and %%EOF must appear together in sequence
                var xrefMatch = XrefOffsetRegex.Match(trailerRegion);
                if (!xrefMatch.Success)
                    return true;

                // Layer 12: xref offset must be within file bounds
                if (!long.TryParse(xrefMatch.Groups[1].Value, out long xrefOffset))
                    return true;

                if (xrefOffset <= 0 || xrefOffset >= pdfBytes.Length)
                    return true;

                // Layer 13: Byte at xref offset must be a valid xref table or xref stream
                // Supports both classic xref tables (PDF 1.0–1.4) and
                // xref streams (PDF 1.5+ used by Adobe signed documents)
                string xrefContent = Encoding.ASCII.GetString(
                    pdfBytes,
                    (int)xrefOffset,
                    Math.Min(20, pdfBytes.Length - (int)xrefOffset)
                );

                bool hasXrefTable = xrefContent.TrimStart().StartsWith("xref", StringComparison.OrdinalIgnoreCase);
                bool hasXrefStream = Regex.IsMatch(xrefContent.TrimStart(), @"^\d+\s+0\s+obj");

                if (!hasXrefTable && !hasXrefStream)
                    return true;

                return false; // All checks passed
            }
            catch
            {
                return true;
            }
        }

        // -------------------------------------------------------------------------
        // Excel validation (xls, xlsx)
        // -------------------------------------------------------------------------
        public static bool IsExcelCorrupted(this FileUpload file)
        {
            try
            {
                // Layer 1: Null guard
                if (file is null)
                    return true;

                // Layer 2: Extension check
                string ext = file.Extension.TrimStart('.').ToLowerInvariant().Trim();
                if (!AllowedExcelExtensions.Contains(ext))
                    return true;

                // Layer 3: ContentType check (normalized list)
                if (string.IsNullOrWhiteSpace(file.ContentType) ||
                    !AllowedExcelContentTypes.Any(ct =>
                        file.ContentType.Contains(ct, StringComparison.OrdinalIgnoreCase)))
                    return true;

                // Layer 4: Decode base64
                if (!TryDecodeBase64(file.DataUrl, out byte[] excelBytes))
                    return true;

                if (excelBytes is null || excelBytes.Length == 0)
                    return true;

                // Layer 5: Magic bytes check
                // XLSX (ZIP/OOXML): PK header — 50 4B 03 04
                // XLS (OLE2):       D0 CF 11 E0
                bool isXlsx = excelBytes.Length >= 4 &&
                              excelBytes[0] == 0x50 &&
                              excelBytes[1] == 0x4B &&
                              excelBytes[2] == 0x03 &&
                              excelBytes[3] == 0x04;

                bool isXls = excelBytes.Length >= 4 &&
                             excelBytes[0] == 0xD0 &&
                             excelBytes[1] == 0xCF &&
                             excelBytes[2] == 0x11 &&
                             excelBytes[3] == 0xE0;

                if (!isXlsx && !isXls)
                    return true;

                // Layer 6: Match declared extension against actual magic bytes
                if (ext == "xlsx" && !isXlsx)
                    return true;

                if (ext == "xls" && !isXls)
                    return true;

                // Layer 7: Full structural parse via EPPlus
                // Note: EPPlus only supports xlsx — for xls fallback to magic bytes only
                if (isXlsx)
                {
                    using var ms = new MemoryStream(excelBytes);
                    using var package = new ExcelPackage(ms);
                    var workbook = package.Workbook;

                    if (workbook is null || workbook.Worksheets.Count == 0)
                        return true;
                }

                return false; // All checks passed
            }
            catch
            {
                return true;
            }
        }

        // -------------------------------------------------------------------------
        // Shared base64 decode helper
        // Handles: padding normalization, data URI prefix stripping,
        //          header validation, character set check
        // -------------------------------------------------------------------------
        private static bool TryDecodeBase64(string dataUrl, out byte[] bytes)
        {
            bytes = Array.Empty<byte>();

            try
            {
                if (string.IsNullOrWhiteSpace(dataUrl))
                    return false;

                string base64Data;

                if (dataUrl.Contains(','))
                {
                    var parts = dataUrl.Split(',');
                    if (parts.Length < 2 || string.IsNullOrWhiteSpace(parts[1]))
                        return false;

                    // Header must contain "base64"
                    if (!parts[0].ToLowerInvariant().Contains("base64"))
                        return false;

                    base64Data = parts[1].Trim();
                }
                else
                {
                    base64Data = dataUrl.Trim();
                }

                if (base64Data.Length == 0)
                    return false;

                // Normalize padding — browsers often strip trailing '='
                base64Data = base64Data.PadRight(
                    base64Data.Length + (4 - base64Data.Length % 4) % 4, '='
                );

                // Validate character set
                if (!Base64Regex.IsMatch(base64Data))
                    return false;

                bytes = Convert.FromBase64String(base64Data);
                return bytes.Length > 0;
            }
            catch
            {
                return false;
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
        public static bool ValidateEmails(this string Emails)
        {
            Emails = Emails.Replace(";", ",");
            List<bool> li = new List<bool>();
            foreach (var address in Emails.Split(new[] { "," }, StringSplitOptions.RemoveEmptyEntries)) //foreach (var address in Emails.Split(new[] { ";" }, StringSplitOptions.RemoveEmptyEntries))
            {
                li.Add(new EmailAddressAttribute().IsValid(address));
            }
            return li.Where(x => !x).Any();
        }
        public static string SendEmail(this SMTPModel data)
        {
            try
            {
                if (Appsetting.Environment != "Production" && data.Subject != "KOJLMS Report")
                {
                    //data.Recipient = "michael.ferrer@kojamjoom.com";
                    //data.CCAddress = "michael.ferrer@kojamjoom.com";
                    //return "Success";
                }
                MailMessage Email = new MailMessage
                {
                    From = new MailAddress(SMTPClass.FROM, SMTPClass.DisplayName),
                    Subject = data.Subject,
                    IsBodyHtml = true,
                    Body = data.Body
                };
                if (string.IsNullOrEmpty(data.Recipient))
                {
                    data.Recipient = data.CCAddress;
                }
                if (!string.IsNullOrEmpty(data.CCAddress))
                {
                    data.CCAddress.Replace(";", ",");
                    if (data.CCAddress.ValidateEmails())
                        return $"Invalid CC Email: '{data.CCAddress}'";
                }
                if (!string.IsNullOrEmpty(data.Recipient)) { data.Recipient.Replace(";", ","); }
                if (data.Recipient.ValidateEmails() || data.Recipient == null)
                    return $"Invalid Recipient Email: '{data.Recipient}'";

                Email.To.Add(data.Recipient.Replace(";", ","));
                if (data.Recipient.ValidateEmails() || data.Recipient == null)
                    return $"Invalid Recipient Email: '{data.Recipient}'";
                if (data.CCAddress != "")
                {
                    Email.CC.Add(data.CCAddress.Replace(";", ","));
                    if (data.CCAddress.ValidateEmails())
                        return $"Invalid CC Email: '{data.CCAddress}'";
                }
                SmtpClient smtp = new SmtpClient
                {
                    Credentials = new NetworkCredential(SMTPClass.Username, SMTPClass.Password),
                    Port = SMTPClass.PORT,
                    Host = SMTPClass.SMTP,
                    EnableSsl = SMTPClass.SSL,
                    Timeout = SMTPClass.TimeOut
                };
                if (data.Files != null)
                {
                    foreach (var File in data.Files)
                    {
                        Email.Attachments.Add(new Attachment(new MemoryStream(File.FileByte), File.FileName));
                    }
                }
                smtp.Send(Email);
                return "Success";
            }
            catch (Exception ex)
            {
                string code = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{data.Recipient} : {data.CCAddress}"));
                throw new Exception($"An error occured while sending email. Please contact support service.");
            }
        }
        public static UpdateRevisionDataResult<TDest> UpdateRevisionData<TSrc, TDest>(
            this List<string>? allowedKeys,
            string User,
            string TransactionId,
            string AffectedTable,
            DateTime CreatedDate,
            TSrc sourceData,
            TDest destinationData)
        {
            List<RevisionTransactionLog> Transaction = new List<RevisionTransactionLog>();
            if (allowedKeys == null || allowedKeys.Count == 0)
                return new UpdateRevisionDataResult<TDest>
                {
                    Data = destinationData,
                    RevisionTransaction = Transaction
                };

            if (sourceData == null || destinationData == null)
                return new UpdateRevisionDataResult<TDest>
                {
                    Data = destinationData,
                    RevisionTransaction = Transaction
                };

            var sourceType = typeof(TSrc);
            var destType = typeof(TDest);
            foreach (var key in allowedKeys)
            {
                if (string.IsNullOrWhiteSpace(key))
                    continue;

                var sourceProp = sourceType.GetProperty(key);
                var destProp = destType.GetProperty(key);

                if (sourceProp == null || destProp == null)
                    continue;

                if (!destProp.CanWrite)
                    continue;

                if (!destProp.PropertyType.IsAssignableFrom(sourceProp.PropertyType))
                    continue;

                var newValue = sourceProp.GetValue(sourceData);
                var oldValue = destProp.GetValue(destinationData);

                if (Equals(newValue, oldValue))
                    continue;

                destProp.SetValue(destinationData, newValue);
                Transaction.Add(new RevisionTransactionLog
                {
                    TransactionId = TransactionId,
                    TypeOfTransaction = "Update",
                    AffectedTable = AffectedTable,
                    AffectedColumn = key,
                    OldValue = oldValue?.ToString() ?? string.Empty,
                    NewValue = newValue?.ToString() ?? string.Empty,
                    CreatedBy = User,
                    CreatedDate = CreatedDate
                });
            }
            return new UpdateRevisionDataResult<TDest>
            {
                Data = destinationData,
                RevisionTransaction = Transaction
            };
        }
        //public static bool ValidateProjectForPublish(ProjectRevisions pr, List<ProjectComponentCostPerYear>? pc)
        //{
        //    //var validation = new List<ProjectValidation>();
        //    if (pr == null)
        //    {
        //        return false;// validation;
        //    }
        //    #region Project Location Validation
        //    if (string.IsNullOrEmpty(pr.DEO) || string.IsNullOrEmpty(pr.LegislativeDistrict) || string.IsNullOrEmpty(pr.ImplementingOffice) || string.IsNullOrEmpty(pr.OperatingUnit)) {
        //        return false;
        //    }
        //    #endregion
        //    #region Component Cost Per Year Validation
        //    if(pc != null)
        //    {
        //        var HasBlankData = pc.FirstOrDefault(x => x.Amount == null || x.Year == null || x.StartDate == null || x.EndDate == null);
        //        if (HasBlankData != null)
        //        {
        //            return false;
        //        }
        //    }
        //    #endregion
        //    return true;
        //}
        //public static bool ValidateProjectForPublishv2(ProjectRevisions pr, ProjectComponentCost? pc)
        //{
        //    //var validation = new List<ProjectValidation>();
        //    if (pr == null)
        //    {
        //        return false;// validation;
        //    }
        //    #region Project Location Validation
        //    string ProjectLocation = string.Empty;
        //    if (string.IsNullOrEmpty(pr.DEO)) {
        //        ProjectLocation = "ProjectLocation: DEO field is required.";
        //    }
        //    if (string.IsNullOrEmpty(pr.LegislativeDistrict)) {
        //        ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Legislative District field is required." : ProjectLocation + " Legislative District field is required.";
        //    }
        //    if (string.IsNullOrEmpty(pr.ImplementingOffice)) {
        //        ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Implementing Office field is required." : ProjectLocation + " Implementing Office field is required.";
        //    }
        //    if (string.IsNullOrEmpty(pr.OperatingUnit)) {
        //        ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Operating Unit field is required." : ProjectLocation + " Operating Unit field is required.";
        //    }
        //    if(!string.IsNullOrEmpty(ProjectLocation))
        //    {
        //        return false;
        //    }
        //    #endregion
        //    #region Component Cost Validation
        //    string ComponentCost = string.Empty;
        //    if(!string.IsNullOrEmpty(ComponentCost))
        //    {
        //        return false;
        //    }
        //    #endregion
        //    /*
        //    ProjectLocation: DEO LD Municipality IO OU
        //    Project Implementation Plan: Planned Start Date Planned End Date
        //    OverLapping Projects: GIS
        //    Major Items of Work: Validated Major Work Locations
        //     */
        //    return true;
        //}
        public static bool IsValidFutureInfraId(this string First2Letter, string id)
        {
            Regex RFutureInfra = new Regex(
                $@"^(?<prefix>{Regex.Escape(First2Letter)})(?<digits>\d{{5}})(?<island>[A-Z]{{2}})$",
                RegexOptions.Compiled | RegexOptions.CultureInvariant
            );
            // Format: 2 letters + 5 digits + 2 letters (island code)
            // Example: AB12345LU
            if (string.IsNullOrWhiteSpace(id))
                return false;

            id = id.Trim().ToUpperInvariant();

            return RFutureInfra.IsMatch(id);
        }
        #endregion
    }
}
