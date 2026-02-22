using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using OfficeOpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
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
        public static DateTime CurrentDate()
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        public static IQueryable<T> QueryFromFile<T>(
            this DbContext db,
            string sqlFilePath, string? query) where T : class
        {
            var sql = _sqlCache.GetOrAdd(
                Path.Combine(Appsetting.Resources.Main, "Sql", sqlFilePath+".sql"),
                path => File.ReadAllText(path)
            );

            // Wrap to guarantee composability
            var composableSql = $@"{sql}
            {query}";

            return db.Set<T>()
                     .FromSqlRaw(composableSql)
                     .AsNoTracking(); // critical for speed
        }
        public static List<T> QueryFile<T>(
            DbContext db,
            string sqlFilePath,
            Dictionary<string, object>? parameters = null) where T : class
        {
            var sql = _sqlCache.GetOrAdd(
                Path.Combine(Appsetting.Resources.Main, "Sql", sqlFilePath + ".sql"),
                path => File.ReadAllText(path)
            );

            var parameterizedSql = sql;
            if (parameters != null && parameters.Count > 0)
            {
                foreach (var param in parameters)
                {
                    parameterizedSql = parameterizedSql.Replace($"{{{param.Key}}}", param.Key);
                }
            }

            return db.Set<T>()
                     .FromSqlRaw(parameterizedSql, parameters?.Values.ToArray() ?? Array.Empty<object>())
                     .AsNoTracking()
                     .ToList();
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
        public static EnumProgramStage UpdateStage(this EnumProgramStage Current)
        {
            if (Current == EnumProgramStage.BP) return EnumProgramStage.NEP;
            else if (Current == EnumProgramStage.NEP) return EnumProgramStage.NEPE;
            else if (Current == EnumProgramStage.NEPE) return EnumProgramStage.HGAB;
            else if (Current == EnumProgramStage.HGAB) return EnumProgramStage.HGABI;
            else if (Current == EnumProgramStage.HGABI) return EnumProgramStage.GAA;
            else if (Current == EnumProgramStage.GAA) return EnumProgramStage.GAAR;
            return Current;
        }
        public static string GenerateProjec1stSegment(this string StageName)
        {
            var stageGroups = new Dictionary<string, string[]>
            {
                { "BP", new[] { "BP", "RBP", "UPMO", "UBP" } },
                { "MY", new[] { "RDIP", "UDIP", "PIP" } },
                { "P",  new[] { "NEP", "HGAB", "GAA" } }
            };
            return stageGroups.FirstOrDefault(g => g.Value.Contains(StageName)).Key ?? "P";
        }
        public static string GenerateProjec2ndSegment(this int endYear)
        {
            int startYear = 2016;
            int count = endYear - startYear;
            return count.ToString("D3");
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

        public static bool UploadFile(this FileUpload File, string FilePath)
        {
            try
            {
                if (File.IsFileCorrupted())
                {
                    return false;
                }
                string folder = Path.GetDirectoryName(FilePath)!;
                if (!Directory.Exists(folder))
                {
                    Directory.CreateDirectory(folder);
                }
                string base64Data = File.DataUrl.Contains(",")
                    ? File.DataUrl.Split(',')[1]
                    : File.DataUrl;
                byte[] fileBytes = Convert.FromBase64String(base64Data);
                System.IO.File.WriteAllBytes(FilePath, fileBytes);
                return true;
            }
            catch
            {
                return false;
            }
        }
        public static bool IsFileCorrupted(this FileUpload File)
        {
            string base64Data = File.DataUrl.Contains(",")
                ? File.DataUrl.Split(',')[1]
                : File.DataUrl;
            byte[] fileBytes = Convert.FromBase64String(base64Data);
            if (fileBytes.Length == 0)
            {
                return false;
            }
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

        public static FilterDataResult<T> FilterData<T, TFilter>(this List<T> table, EnumPagination<TFilter> dto)
        {
            var result = new FilterDataResult<T>();

            if (dto == null || dto.Filters == null)
            {
                result.HasError = true;
                result.ErrorMessage = "Expected Parameters missing!";
                return result;
            }

            // default sort field
            dto.SortField = string.IsNullOrWhiteSpace(dto.SortField) ? "Id" : dto.SortField;

            // validate sort field against T
            var prop = typeof(T)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p => string.Equals(p.Name, dto.SortField, StringComparison.OrdinalIgnoreCase));

            if (prop == null)
            {
                result.HasError = true;
                result.ErrorMessage = $"Invalid Column: {dto.SortField} to sort!";
                return result;
            }

            // ensure sort direction
            dto.sortDirection ??= sortDirectionList.DESC;
            if (!Enum.IsDefined(typeof(sortDirectionList), dto.sortDirection!.Value))
            {
                result.HasError = true;
                result.ErrorMessage = $"Sorting Direction: {dto.sortDirection} not allowed!";
                return result;
            }

            // normalize pagination
            if (dto.page < 1) dto.page = 1;
            if (dto.limit < 1) dto.limit = 10;

            // in-memory ordering using reflection
            Func<T, object?> keySelector = x => prop.GetValue(x);

            IEnumerable<T> ordered = dto.sortDirection!.Value == sortDirectionList.ASC
                ? table.OrderBy(keySelector)
                : table.OrderByDescending(keySelector);

            int total = ordered.Count();
            var lists = ordered.Skip((dto.page - 1) * dto.limit).Take(dto.limit).ToList();
            int totalPages = dto.limit > 0 ? (int)Math.Ceiling((double)total / dto.limit) : 0;

            result.HasError = false;
            result.ErrorMessage = null;
            result.Data = new FilteredResult<T>
            {
                lists = lists,
                page = dto.page,
                limit = dto.limit,
                total = total,
                totalPages = totalPages
            };

            return result;
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
        public static bool ValidateProjectForPublish(DBHelper.Models.Table.ProjectRevisions pr, List<DBHelper.Models.Table.ProjectComponentCostPerYear>? pc)
        {
            //var validation = new List<ProjectValidation>();
            if (pr == null)
            {
                return false;// validation;
            }
            #region Project Location Validation
            if (string.IsNullOrEmpty(pr.DEO) || string.IsNullOrEmpty(pr.LegislativeDistrict) || string.IsNullOrEmpty(pr.ImplementingOffice) || string.IsNullOrEmpty(pr.OperatingUnit)) {
                return false;
            }
            #endregion
            #region Component Cost Per Year Validation
            if(pc != null)
            {
                var HasBlankData = pc.FirstOrDefault(x => x.Amount == null || x.Year == null || x.StartDate == null || x.EndDate == null);
                if (HasBlankData != null)
                {
                    return false;
                }
            }
            #endregion
            return true;
        }
        public static bool ValidateProjectForPublishv2(DBHelper.Models.Table.ProjectRevisions pr, DBHelper.Models.Table.ProjectComponentCost? pc)
        {
            //var validation = new List<ProjectValidation>();
            if (pr == null)
            {
                return false;// validation;
            }
            #region Project Location Validation
            string ProjectLocation = string.Empty;
            if (string.IsNullOrEmpty(pr.DEO)) {
                ProjectLocation = "ProjectLocation: DEO field is required.";
            }
            if (string.IsNullOrEmpty(pr.LegislativeDistrict)) {
                ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Legislative District field is required." : ProjectLocation + " Legislative District field is required.";
            }
            if (string.IsNullOrEmpty(pr.ImplementingOffice)) {
                ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Implementing Office field is required." : ProjectLocation + " Implementing Office field is required.";
            }
            if (string.IsNullOrEmpty(pr.OperatingUnit)) {
                ProjectLocation = string.IsNullOrEmpty(ProjectLocation) ? "ProjectLocation: Operating Unit field is required." : ProjectLocation + " Operating Unit field is required.";
            }
            if(!string.IsNullOrEmpty(ProjectLocation))
            {
                return false;
            }
            #endregion
            #region Component Cost Validation
            string ComponentCost = string.Empty;
            if(!string.IsNullOrEmpty(ComponentCost))
            {
                return false;
            }
            #endregion
            /*
            ProjectLocation: DEO LD Municipality IO OU
            Project Implementation Plan: Planned Start Date Planned End Date
            OverLapping Projects: GIS
            Major Items of Work: Validated Major Work Locations
             */
            return true;
        }
        private static readonly Regex RFutureInfra = new Regex(
            @"^(?<prefix>[A-Z]{2})(?<digits>\d{5})(?<island>[A-Z]{2})$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant
        );
        public static bool IsValidFutureInfraId(this string id)
        {
            // Format: 2 letters + 5 digits + 2 letters (island code)
            // Example: AB12345LU
            if (string.IsNullOrWhiteSpace(id))
                return false;

            id = id.Trim().ToUpperInvariant();

            return RFutureInfra.IsMatch(id);
        }
    }
}
