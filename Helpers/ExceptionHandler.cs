using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Helpers
{
    public interface IMYPSExceptionHandler
    {
        ObjectResult Handle(
            Exception ex,
            object? dto = null,
            string? userId = null);
    }
    public sealed class ExceptionHandler : IMYPSExceptionHandler
    {
        private readonly ILogger<ExceptionHandler> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IHostEnvironment _environment;

        // =========================================================
        // SETTINGS
        // =========================================================

        private const int MaximumPayloadCharacters = 20_000;

        private const int MaximumCollectionSummaries = 50;

        private const int MaximumCollectionSummaryDepth = 6;


        // =========================================================
        // SENSITIVE PROPERTY NAMES
        // =========================================================

        private static readonly HashSet<string> SensitivePropertyNames =
            new(StringComparer.OrdinalIgnoreCase)
            {
                "Password",
                "PasswordHash",

                "Token",
                "AccessToken",
                "RefreshToken",
                "IdToken",

                "Authorization",

                "Cookie",
                "Cookies",

                "ApiKey",
                "APIKey",

                "Secret",
                "ClientSecret",

                "ConnectionString",

                "PrivateKey"
            };


        // =========================================================
        // CONSTRUCTOR
        // =========================================================

        public ExceptionHandler(
            ILogger<ExceptionHandler> logger,
            IHttpContextAccessor httpContextAccessor,
            IHostEnvironment environment)
        {
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _environment = environment;
        }


        // =========================================================
        // MAIN HANDLER
        // =========================================================

        public ObjectResult Handle(
            Exception ex,
            object? dto = null,
            string? userId = null)
        {
            Guid errorReferenceId = Guid.NewGuid();


            // =====================================================
            // REQUEST CANCELLED
            // =====================================================

            if (ex is OperationCanceledException)
            {
                return new OkObjectResult(
                    new
                    {
                        Message = "Operation has been cancelled",
                        Title = "Operation cancelled"
                    });
            }


            try
            {
                // =================================================
                // ANALYZE API PAYLOAD
                // =================================================

                PayloadLogInfo payloadInfo =
                    AnalyzePayload(dto);


                // =================================================
                // EXCEPTION INFORMATION
                // =================================================

                Exception rootException =
                    GetRootException(ex);


                SqlException? sqlException =
                    FindSqlException(ex);


                // =================================================
                // BUILD LOG
                // =================================================

                string logMessage =
                    BuildExceptionLog(
                        errorReferenceId,
                        ex,
                        rootException,
                        sqlException,
                        payloadInfo,
                        userId);


                // =================================================
                // WRITE ERROR
                // =================================================

                _logger.LogError(
                    ex,
                    "{MYPSExceptionLog}",
                    logMessage);


                // =================================================
                // API RESPONSE
                // =================================================

                string responseMessage =
                    _environment.IsDevelopment()
                        ? rootException.Message
                        : "An unexpected application error occurred.";


                return new BadRequestObjectResult(
                    new
                    {
                        ErrorId =
                            errorReferenceId.ToString(),

                        Message =
                            responseMessage,

                        Title =
                            "Application Error"
                    });
            }
            catch (Exception loggingException)
            {
                /*
                 * Never allow the exception handler itself
                 * to hide the original exception.
                 */

                try
                {
                    _logger.LogError(
                        loggingException,
                        "MYPS ExceptionHandler failed. ErrorId: {ErrorId}",
                        errorReferenceId);
                }
                catch
                {
                    // Logging failure should never crash API.
                }


                return new BadRequestObjectResult(
                    new
                    {
                        ErrorId =
                            errorReferenceId.ToString(),

                        Message =
                            _environment.IsDevelopment()
                                ? ex.Message
                                : "An unexpected application error occurred.",

                        Title =
                            "Application Error"
                    });
            }
        }


        // =========================================================
        // ANALYZE API PAYLOAD
        // =========================================================

        private PayloadLogInfo AnalyzePayload(
            object? dto)
        {
            if (dto is null)
            {
                return new PayloadLogInfo
                {
                    PayloadType = "Null",

                    IsArray = false,

                    ItemCount = 0,

                    ClrType = "null",

                    Json = "null",

                    OriginalLength = 4,

                    LoggedLength = 4,

                    IsTruncated = false
                };
            }


            Type clrType =
                dto.GetType();


            try
            {
                JsonSerializerOptions options =
                    CreateLoggingJsonOptions();


                // =================================================
                // SERIALIZE DTO ONCE
                // =================================================

                string serialized =
                    JsonSerializer.Serialize(
                        dto,
                        clrType,
                        options);


                JsonNode? root =
                    JsonNode.Parse(serialized);


                // =================================================
                // REMOVE SENSITIVE VALUES
                // =================================================

                RedactSensitiveValues(root);


                // =================================================
                // PAYLOAD TYPE
                // =================================================

                string payloadType =
                    GetPayloadType(
                        root,
                        dto);


                bool isArray =
                    root is JsonArray;


                int itemCount =
                    root switch
                    {
                        JsonArray array =>
                            array.Count,

                        JsonObject =>
                            1,

                        null =>
                            0,

                        _ =>
                            1
                    };


                // =================================================
                // FIND NESTED ARRAYS
                // =================================================

                List<string> collectionSummary =
                    [];


                CollectArraySummary(
                    root,
                    "$",
                    collectionSummary,
                    0);


                // =================================================
                // FORMAT JSON
                // =================================================

                string prettyJson =
                    root?.ToJsonString(
                        new JsonSerializerOptions
                        {
                            WriteIndented = true
                        })
                    ?? "null";


                int originalLength =
                    prettyJson.Length;


                // =================================================
                // LIMIT PAYLOAD SIZE
                // =================================================

                string loggedJson =
                    Truncate(
                        prettyJson,
                        MaximumPayloadCharacters,
                        out bool wasTruncated);


                return new PayloadLogInfo
                {
                    PayloadType =
                        payloadType,

                    IsArray =
                        isArray,

                    ItemCount =
                        itemCount,

                    ClrType =
                        clrType.FullName
                        ?? clrType.Name,

                    Json =
                        loggedJson,

                    OriginalLength =
                        originalLength,

                    LoggedLength =
                        loggedJson.Length,

                    IsTruncated =
                        wasTruncated,

                    CollectionSummary =
                        collectionSummary
                };
            }
            catch (Exception serializationException)
            {
                return new PayloadLogInfo
                {
                    PayloadType =
                        "SerializationError",

                    IsArray =
                        false,

                    ItemCount =
                        0,

                    ClrType =
                        clrType.FullName
                        ?? clrType.Name,

                    Json =
                        "[PAYLOAD COULD NOT BE SERIALIZED]",

                    SerializationError =
                        serializationException.Message
                };
            }
        }


        // =========================================================
        // DETERMINE PAYLOAD TYPE
        // =========================================================

        private static string GetPayloadType(
            JsonNode? node,
            object originalValue)
        {
            if (node is null)
            {
                return "Null";
            }


            if (node is JsonArray)
            {
                return "Array";
            }


            if (node is JsonObject)
            {
                return "Object";
            }


            Type type =
                Nullable.GetUnderlyingType(
                    originalValue.GetType())
                ?? originalValue.GetType();


            if (
                type == typeof(string) ||
                type == typeof(char) ||
                type == typeof(Guid) ||
                type == typeof(DateTime) ||
                type == typeof(DateTimeOffset)
            )
            {
                return "String";
            }


            if (type == typeof(bool))
            {
                return "Boolean";
            }


            if (
                type == typeof(byte) ||
                type == typeof(sbyte) ||
                type == typeof(short) ||
                type == typeof(ushort) ||
                type == typeof(int) ||
                type == typeof(uint) ||
                type == typeof(long) ||
                type == typeof(ulong) ||
                type == typeof(float) ||
                type == typeof(double) ||
                type == typeof(decimal)
            )
            {
                return "Number";
            }


            return "Scalar";
        }


        // =========================================================
        // NESTED ARRAY SUMMARY
        // =========================================================

        private static void CollectArraySummary(
            JsonNode? node,
            string path,
            List<string> result,
            int depth)
        {
            if (node is null)
            {
                return;
            }


            if (
                depth >
                MaximumCollectionSummaryDepth
            )
            {
                return;
            }


            if (
                result.Count >=
                MaximumCollectionSummaries
            )
            {
                return;
            }


            // =====================================================
            // ARRAY
            // =====================================================

            if (node is JsonArray array)
            {
                result.Add(
                    $"{path}: Array [{array.Count}]");


                /*
                 * Only inspect first element.
                 *
                 * Do not recursively analyze hundreds or
                 * thousands of array items.
                 */
                if (array.Count > 0)
                {
                    CollectArraySummary(
                        array[0],
                        $"{path}[0]",
                        result,
                        depth + 1);
                }


                return;
            }


            // =====================================================
            // OBJECT
            // =====================================================

            if (node is JsonObject obj)
            {
                foreach (
                    KeyValuePair<string, JsonNode?> property
                    in obj
                )
                {
                    if (
                        result.Count >=
                        MaximumCollectionSummaries
                    )
                    {
                        break;
                    }


                    string childPath =
                        path == "$"
                            ? property.Key
                            : $"{path}.{property.Key}";


                    CollectArraySummary(
                        property.Value,
                        childPath,
                        result,
                        depth + 1);
                }
            }
        }


        // =========================================================
        // REDACT SENSITIVE DATA
        // =========================================================

        private static void RedactSensitiveValues(
            JsonNode? node)
        {
            if (node is null)
            {
                return;
            }


            if (node is JsonObject obj)
            {
                List<string> propertyNames =
                    obj
                        .Select(x => x.Key)
                        .ToList();


                foreach (
                    string propertyName
                    in propertyNames
                )
                {
                    if (
                        SensitivePropertyNames.Contains(
                            propertyName)
                    )
                    {
                        obj[propertyName] =
                            "***REDACTED***";

                        continue;
                    }


                    RedactSensitiveValues(
                        obj[propertyName]);
                }


                return;
            }


            if (node is JsonArray array)
            {
                foreach (
                    JsonNode? child
                    in array
                )
                {
                    RedactSensitiveValues(
                        child);
                }
            }
        }


        // =========================================================
        // JSON OPTIONS
        // =========================================================

        private static JsonSerializerOptions
            CreateLoggingJsonOptions()
        {
            JsonSerializerOptions options =
                new()
                {
                    PropertyNamingPolicy =
                        null,

                    ReferenceHandler =
                        ReferenceHandler.IgnoreCycles,

                    DefaultIgnoreCondition =
                        JsonIgnoreCondition.WhenWritingNull,

                    MaxDepth =
                        32,

                    WriteIndented =
                        false
                };


            /*
             * File payloads are logged as metadata only.
             */
            options.Converters.Add(
                new FormFileLoggingConverter());


            /*
             * byte[] will NOT become Base64 in logs.
             */
            options.Converters.Add(
                new ByteArrayLoggingConverter());


            return options;
        }


        // =========================================================
        // ROOT EXCEPTION
        // =========================================================

        private static Exception GetRootException(
            Exception exception)
        {
            Exception current =
                exception;


            while (
                current.InnerException
                is not null
            )
            {
                current =
                    current.InnerException;
            }


            return current;
        }


        // =========================================================
        // FIND SQL EXCEPTION
        // =========================================================

        private static SqlException? FindSqlException(
            Exception exception)
        {
            Exception? current =
                exception;


            while (current is not null)
            {
                if (
                    current
                    is SqlException sqlException
                )
                {
                    return sqlException;
                }


                current =
                    current.InnerException;
            }


            return null;
        }


        // =========================================================
        // SQL ERROR DESCRIPTION
        // =========================================================

        private static string?
            GetSqlErrorDescription(
                SqlException? sqlException)
        {
            if (sqlException is null)
            {
                return null;
            }


            return sqlException.Number switch
            {
                547 =>
                    "Foreign Key / Check Constraint Violation",

                2601 =>
                    "Duplicate Key",

                2627 =>
                    "Unique Constraint / Primary Key Violation",

                515 =>
                    "NULL value inserted into NOT NULL column",

                8152 =>
                    "String or binary data would be truncated",

                2628 =>
                    "String or binary data would be truncated",

                1205 =>
                    "SQL Server Deadlock",

                208 =>
                    "Invalid SQL Server object name",

                207 =>
                    "Invalid SQL Server column name",

                18456 =>
                    "SQL Server Login Failed",

                _ =>
                    "SQL Server Error"
            };
        }


        // =========================================================
        // TRY EXTRACT FK/CONSTRAINT NAME
        // =========================================================

        private static string?
            TryExtractConstraintName(
                SqlException? sqlException)
        {
            if (sqlException is null)
            {
                return null;
            }


            Match match =
                Regex.Match(
                    sqlException.Message,
                    @"constraint\s+[""'](?<name>[^""']+)[""']",
                    RegexOptions.IgnoreCase);


            if (!match.Success)
            {
                return null;
            }


            return match
                .Groups["name"]
                .Value;
        }


        // =========================================================
        // PAYLOAD TRUNCATION
        // =========================================================

        private static string Truncate(
            string value,
            int maximumLength,
            out bool wasTruncated)
        {
            if (
                value.Length <=
                maximumLength
            )
            {
                wasTruncated =
                    false;


                return value;
            }


            wasTruncated =
                true;


            return
                value[..maximumLength]
                +
                Environment.NewLine
                +
                Environment.NewLine
                +
                $"[PAYLOAD TRUNCATED - ORIGINAL LENGTH: {value.Length:N0} CHARACTERS]";
        }


        // =========================================================
        // BUILD COMPLETE ERROR LOG
        // =========================================================

        private string BuildExceptionLog(
            Guid errorReferenceId,
            Exception exception,
            Exception rootException,
            SqlException? sqlException,
            PayloadLogInfo payload,
            string? userId)
        {
            StringBuilder builder =
                new();


            HttpContext? httpContext =
                _httpContextAccessor
                    .HttpContext;


            string? sqlDescription =
                GetSqlErrorDescription(
                    sqlException);


            string? constraintName =
                TryExtractConstraintName(
                    sqlException);


            // =====================================================
            // HEADER
            // =====================================================

            builder.AppendLine();

            builder.AppendLine(
                "/========================= MYPS ERROR EVENT STARTS HERE =========================/");

            builder.AppendLine();


            // =====================================================
            // ERROR
            // =====================================================

            builder.AppendLine(
                "ERROR");

            builder.AppendLine(
                "-----");


            builder.AppendLine(
                $"ErrorId: {errorReferenceId}");


            builder.AppendLine(
                $"Timestamp: {DateTimeOffset.Now:O}");


            builder.AppendLine();


            // =====================================================
            // HTTP REQUEST
            // =====================================================

            builder.AppendLine(
                "REQUEST");

            builder.AppendLine(
                "-------");


            if (httpContext is not null)
            {
                builder.AppendLine(
                    $"Method: {httpContext.Request.Method}");


                builder.AppendLine(
                    $"Path: {httpContext.Request.Path}");


                builder.AppendLine(
                    $"QueryString: {httpContext.Request.QueryString}");


                builder.AppendLine(
                    $"TraceIdentifier: {httpContext.TraceIdentifier}");


                builder.AppendLine(
                    $"RemoteIpAddress: {httpContext.Connection.RemoteIpAddress}");
            }
            else
            {
                builder.AppendLine(
                    "HttpContext: Not Available");
            }


            builder.AppendLine(
                $"UserId: {userId ?? "Not Available"}");


            builder.AppendLine();


            // =====================================================
            // PAYLOAD INFO
            // =====================================================

            builder.AppendLine(
                "PAYLOAD INFORMATION");

            builder.AppendLine(
                "-------------------");


            builder.AppendLine(
                $"ClrType: {payload.ClrType}");


            builder.AppendLine(
                $"PayloadType: {payload.PayloadType}");


            builder.AppendLine(
                $"IsArray: {payload.IsArray}");


            builder.AppendLine(
                $"ItemCount: {payload.ItemCount}");


            builder.AppendLine(
                $"OriginalLength: {payload.OriginalLength:N0}");


            builder.AppendLine(
                $"LoggedLength: {payload.LoggedLength:N0}");


            builder.AppendLine(
                $"IsTruncated: {payload.IsTruncated}");


            if (
                !string.IsNullOrWhiteSpace(
                    payload.SerializationError)
            )
            {
                builder.AppendLine(
                    $"SerializationError: {payload.SerializationError}");
            }


            builder.AppendLine();


            // =====================================================
            // COLLECTION SUMMARY
            // =====================================================

            if (
                payload.CollectionSummary.Count
                > 0
            )
            {
                builder.AppendLine(
                    "COLLECTION SUMMARY");

                builder.AppendLine(
                    "------------------");


                foreach (
                    string collection
                    in payload.CollectionSummary
                )
                {
                    builder.AppendLine(
                        collection);
                }


                builder.AppendLine();
            }


            // =====================================================
            // API PAYLOAD
            // =====================================================

            builder.AppendLine(
                "API PAYLOAD");

            builder.AppendLine(
                "-----------");


            builder.AppendLine(
                payload.Json);


            builder.AppendLine();


            // =====================================================
            // APPLICATION EXCEPTION
            // =====================================================

            builder.AppendLine(
                "APPLICATION EXCEPTION");

            builder.AppendLine(
                "---------------------");


            builder.AppendLine(
                $"Type: {exception.GetType().FullName}");


            builder.AppendLine(
                $"Message: {exception.Message}");


            builder.AppendLine();


            // =====================================================
            // ROOT EXCEPTION
            // =====================================================

            builder.AppendLine(
                "ROOT EXCEPTION");

            builder.AppendLine(
                "--------------");


            builder.AppendLine(
                $"Type: {rootException.GetType().FullName}");


            builder.AppendLine(
                $"Message: {rootException.Message}");


            builder.AppendLine();


            // =====================================================
            // SQL SERVER
            // =====================================================

            if (sqlException is not null)
            {
                builder.AppendLine(
                    "SQL SERVER ERROR");

                builder.AppendLine(
                    "----------------");


                builder.AppendLine(
                    $"Description: {sqlDescription}");


                builder.AppendLine(
                    $"Number: {sqlException.Number}");


                builder.AppendLine(
                    $"State: {sqlException.State}");


                builder.AppendLine(
                    $"Class: {sqlException.Class}");


                builder.AppendLine(
                    $"Procedure: {sqlException.Procedure}");


                builder.AppendLine(
                    $"LineNumber: {sqlException.LineNumber}");


                builder.AppendLine(
                    $"ClientConnectionId: {sqlException.ClientConnectionId}");


                if (
                    !string.IsNullOrWhiteSpace(
                        constraintName)
                )
                {
                    builder.AppendLine(
                        $"Constraint: {constraintName}");
                }


                builder.AppendLine();


                // =============================================
                // SQL ERROR COLLECTION
                // =============================================

                builder.AppendLine(
                    "SQL ERROR DETAILS");

                builder.AppendLine(
                    "-----------------");


                foreach (
                    SqlError sqlError
                    in sqlException.Errors
                )
                {
                    builder.AppendLine(
                        $"Number={sqlError.Number}, " +
                        $"State={sqlError.State}, " +
                        $"Class={sqlError.Class}, " +
                        $"Line={sqlError.LineNumber}");


                    builder.AppendLine(
                        sqlError.Message);


                    builder.AppendLine();
                }
            }


            // =====================================================
            // FOOTER
            // =====================================================

            builder.AppendLine(
                "/========================= MYPS ERROR EVENT ENDS HERE =========================/");


            return builder.ToString();
        }


        // =========================================================
        // INTERNAL PAYLOAD MODEL
        // =========================================================

        private sealed class PayloadLogInfo
        {
            public string PayloadType { get; set; }
                = "Unknown";


            public bool IsArray { get; set; }


            public int ItemCount { get; set; }


            public string ClrType { get; set; }
                = "Unknown";


            public string Json { get; set; }
                = string.Empty;


            public int OriginalLength { get; set; }


            public int LoggedLength { get; set; }


            public bool IsTruncated { get; set; }


            public string? SerializationError { get; set; }


            public List<string> CollectionSummary { get; set; }
                = [];
        }


        // =========================================================
        // IFORMFILE CONVERTER
        // =========================================================

        private sealed class FormFileLoggingConverter
            : JsonConverter<IFormFile>
        {
            public override IFormFile? Read(
                ref Utf8JsonReader reader,
                Type typeToConvert,
                JsonSerializerOptions options)
            {
                throw new NotSupportedException();
            }


            public override void Write(
                Utf8JsonWriter writer,
                IFormFile value,
                JsonSerializerOptions options)
            {
                writer.WriteStartObject();


                writer.WriteString(
                    "FileName",
                    value.FileName);


                writer.WriteString(
                    "ContentType",
                    value.ContentType);


                writer.WriteNumber(
                    "Length",
                    value.Length);


                writer.WriteString(
                    "Name",
                    value.Name);


                writer.WriteEndObject();
            }
        }


        // =========================================================
        // BYTE ARRAY CONVERTER
        // =========================================================

        private sealed class ByteArrayLoggingConverter
            : JsonConverter<byte[]>
        {
            public override byte[]? Read(
                ref Utf8JsonReader reader,
                Type typeToConvert,
                JsonSerializerOptions options)
            {
                throw new NotSupportedException();
            }


            public override void Write(
                Utf8JsonWriter writer,
                byte[] value,
                JsonSerializerOptions options)
            {
                writer.WriteStartObject();


                writer.WriteString(
                    "Type",
                    "ByteArray");


                writer.WriteNumber(
                    "Length",
                    value.Length);


                writer.WriteEndObject();
            }
        }
    }
}