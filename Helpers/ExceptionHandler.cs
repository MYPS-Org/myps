using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
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

                DbUpdateException? dbUpdateException =
                    FindDbUpdateException(ex);

                OperationDiagnosticInfo operationDiagnostic =
                    BuildOperationDiagnostic(
                        ex,
                        rootException,
                        sqlException,
                        dbUpdateException,
                        payloadInfo);


                // =================================================
                // BUILD LOG
                // =================================================

                string logMessage =
                    BuildExceptionLog(
                        errorReferenceId,
                        ex,
                        rootException,
                        sqlException,
                        dbUpdateException,
                        operationDiagnostic,
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
                        ? $"{operationDiagnostic.FailureKind}: {operationDiagnostic.DeveloperMessage}"
                        : operationDiagnostic.UserMessage ?? "An unexpected application error occurred.";


                return new BadRequestObjectResult(
                    new
                    {
                        ErrorId =
                            errorReferenceId.ToString(),

                        Message =
                            responseMessage,

                        Title =
                            operationDiagnostic.FailureKind ?? "Application Error"
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
        // FIND EF DB UPDATE EXCEPTION
        // =========================================================

        private static DbUpdateException? FindDbUpdateException(
            Exception exception)
        {
            Exception? current =
                exception;


            while (current is not null)
            {
                if (
                    current
                    is DbUpdateException dbUpdateException
                )
                {
                    return dbUpdateException;
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

                245 =>
                    "SQL Server Conversion Failed",

                8114 =>
                    "SQL Server Data Type Conversion Failed",

                8115 =>
                    "SQL Server Arithmetic Overflow",

                _ =>
                    "SQL Server Error"
            };
        }


        // =========================================================
        // DATABASE DIAGNOSTIC
        // =========================================================

        private static DatabaseDiagnosticInfo BuildDatabaseDiagnostic(
            SqlException? sqlException,
            DbUpdateException? dbUpdateException)
        {
            DatabaseDiagnosticInfo info =
                new();


            if (sqlException is not null)
            {
                SqlError? primaryError =
                    sqlException.Errors.Count > 0
                        ? sqlException.Errors[0]
                        : null;


                info.SqlNumber =
                    primaryError?.Number
                    ?? sqlException.Number;

                info.SqlState =
                    primaryError?.State
                    ?? sqlException.State;

                info.SqlClass =
                    primaryError?.Class
                    ?? sqlException.Class;

                info.SqlProcedure =
                    primaryError?.Procedure
                    ?? sqlException.Procedure;

                info.SqlLineNumber =
                    primaryError?.LineNumber
                    ?? sqlException.LineNumber;

                info.Category =
                    GetSqlErrorDescription(
                        sqlException);


                ApplySqlMessageDiagnostics(
                    info,
                    primaryError?.Message
                    ?? sqlException.Message);


                info.LikelyCause =
                    BuildLikelyCause(
                        info);

                info.RecommendedAction =
                    BuildRecommendedAction(
                        info);
            }


            if (dbUpdateException is not null)
            {
                info.EntityEntries =
                    BuildEfEntryDiagnostics(
                        dbUpdateException);
            }


            return info;
        }


        // =========================================================
        // OPERATION DIAGNOSTIC
        // =========================================================

        private OperationDiagnosticInfo BuildOperationDiagnostic(
            Exception exception,
            Exception rootException,
            SqlException? sqlException,
            DbUpdateException? dbUpdateException,
            PayloadLogInfo payload)
        {
            OperationDiagnosticInfo info =
                new();

            Exception effectiveException =
                rootException
                ?? exception;

            string message =
                effectiveException.Message;

            StackFrameInfo? appFrame =
                GetFirstApplicationStackFrame(effectiveException)
                ?? GetFirstApplicationStackFrame(exception);

            if (appFrame is not null)
            {
                info.SourceFile =
                    appFrame.File;

                info.SourceLine =
                    appFrame.Line;

                info.Method =
                    appFrame.Method;

                info.DeclaringType =
                    appFrame.DeclaringType;
            }

            if (dbUpdateException is not null)
            {
                info.FailureKind =
                    "DatabaseSaveFailure";

                info.OperationType =
                    "SaveChanges";

                info.IsDatabaseRelated =
                    true;

                info.IsDuringSaveChanges =
                    true;

                info.DeveloperMessage =
                    "Entity Framework failed while saving tracked entity changes.";

                info.UserMessage =
                    "A database error occurred while saving the record.";

                info.RecommendedFix =
                    "Check SQL diagnostics and EF SAVECHANGES ENTRIES for the exact entity, table, column, and value.";

                return info;
            }

            if (sqlException is not null)
            {
                info.FailureKind =
                    "SqlServerFailure";

                info.OperationType =
                    "SqlCommand";

                info.IsDatabaseRelated =
                    true;

                info.SqlErrorNumber =
                    sqlException.Number;

                info.SqlProcedure =
                    string.IsNullOrWhiteSpace(sqlException.Procedure)
                        ? null
                        : sqlException.Procedure;

                info.SqlLineNumber =
                    sqlException.LineNumber;

                info.DeveloperMessage =
                    GetSqlErrorDescription(sqlException)
                    ?? "SQL Server rejected the command.";

                info.UserMessage =
                    "A database error occurred while processing the request.";

                info.RecommendedFix =
                    "Review SQL SERVER ERROR and DATABASE DIAGNOSTIC SUMMARY for the failing object.";

                return info;
            }

            if (
                effectiveException is InvalidOperationException
                &&
                message.Contains(
                    "Nullable object must have a value",
                    StringComparison.OrdinalIgnoreCase)
            )
            {
                info.FailureKind =
                    "NullableValueAccess";

                info.OperationType =
                    "ValidationOrMapping";

                info.DeveloperMessage =
                    "A nullable value was accessed using .Value while it was null.";

                info.UserMessage =
                    "A required value was missing or invalid.";

                info.LikelyField =
                    GuessNullableFieldFromPayload(
                        payload,
                        info);

                info.LikelyCause =
                    info.LikelyField is null
                        ? "A nullable field was accessed before checking HasValue/null."
                        : $"{info.LikelyField} is null but code accessed {info.LikelyField}.Value.";

                info.RecommendedFix =
                    info.LikelyField is null
                        ? "Find the nullable .Value access at the failure line and add a null check before accessing .Value."
                        : $"Check {info.LikelyField} == null before accessing {info.LikelyField}.Value.";

                return info;
            }

            if (
                effectiveException is InvalidOperationException
                &&
                message.Contains(
                    "non-composable SQL",
                    StringComparison.OrdinalIgnoreCase)
            )
            {
                info.FailureKind =
                    "EfNonComposableSql";

                info.OperationType =
                    "StoredProcedureScalarQuery";

                info.IsDatabaseRelated =
                    true;

                info.IsDuringQueryExecution =
                    true;

                info.DeveloperMessage =
                    "EF Core tried to compose LINQ over a non-composable SQL command such as EXEC.";

                info.UserMessage =
                    "A database query failed while processing the request.";

                info.LikelyCause =
                    "A stored procedure EXEC was followed by SingleAsync/FirstAsync/Where or another composable LINQ operation.";

                info.RecommendedFix =
                    "Materialize the EXEC result first using AsEnumerable().Single(), ToList(), Dapper, or ADO.NET.";

                info.ExpectedResultShape =
                    "Single scalar result";

                return info;
            }

            if (
                effectiveException is TimeoutException
                ||
                message.Contains(
                    "timeout",
                    StringComparison.OrdinalIgnoreCase)
            )
            {
                info.FailureKind =
                    "Timeout";

                info.OperationType =
                    "LongRunningOperation";

                info.DeveloperMessage =
                    "The operation exceeded its allowed execution time.";

                info.UserMessage =
                    "The request took too long to finish.";

                info.RecommendedFix =
                    "Check long-running SQL, external calls, locks, and command timeout settings.";

                return info;
            }

            info.FailureKind =
                effectiveException.GetType().Name;

            info.OperationType =
                "Application";

            info.DeveloperMessage =
                message;

            info.UserMessage =
                "An unexpected server error occurred.";

            info.RecommendedFix =
                "Use the failure location, payload summary, and stack trace to identify the failing code path.";

            return info;
        }


        private static StackFrameInfo? GetFirstApplicationStackFrame(
            Exception exception)
        {
            if (exception.StackTrace is null)
            {
                return null;
            }

            string[] lines =
                exception.StackTrace.Split(
                    Environment.NewLine,
                    StringSplitOptions.RemoveEmptyEntries
                    |
                    StringSplitOptions.TrimEntries);

            foreach (string line in lines)
            {
                if (
                    !line.Contains(
                        "project_myps",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    !line.Contains(
                        "WebAPI.",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    !line.Contains(
                        "Helpers.",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    !line.Contains(
                        "DBHelper.",
                        StringComparison.OrdinalIgnoreCase)
                )
                {
                    continue;
                }

                Match match =
                    Regex.Match(
                        line,
                        @"at\s+(?<method>.+?)\s+in\s+(?<file>.+?):line\s+(?<line>\d+)",
                        RegexOptions.IgnoreCase);

                if (!match.Success)
                {
                    continue;
                }

                string method =
                    match.Groups["method"].Value;

                string? declaringType =
                    null;

                int parenIndex =
                    method.IndexOf('(');

                string methodWithoutParams =
                    parenIndex >= 0
                        ? method[..parenIndex]
                        : method;

                int lastDot =
                    methodWithoutParams.LastIndexOf('.');

                if (lastDot > 0)
                {
                    declaringType =
                        methodWithoutParams[..lastDot];
                }

                return new StackFrameInfo
                {
                    Method =
                        method,

                    DeclaringType =
                        declaringType,

                    File =
                        match.Groups["file"].Value,

                    Line =
                        int.TryParse(
                            match.Groups["line"].Value,
                            out int lineNumber)
                            ? lineNumber
                            : null
                };
            }

            return null;
        }


        private static string? GuessNullableFieldFromPayload(
            PayloadLogInfo payload,
            OperationDiagnosticInfo info)
        {
            if (
                string.IsNullOrWhiteSpace(payload.Json)
                ||
                payload.Json == "null"
            )
            {
                return null;
            }

            try
            {
                using JsonDocument document =
                    JsonDocument.Parse(payload.Json);

                List<string> nullFields =
                    [];

                CollectNullFields(
                    document.RootElement,
                    nullFields,
                    null);

                if (nullFields.Count == 0)
                {
                    return null;
                }

                string locationText =
                    $"{info.Method} {info.SourceFile}"
                        .ToLowerInvariant();

                foreach (string field in nullFields)
                {
                    string leaf =
                        field
                            .Split('.')
                            .Last();

                    if (
                        locationText.Contains(
                            leaf.ToLowerInvariant())
                    )
                    {
                        return field;
                    }
                }

                string[] commonRequiredDateFields =
                [
                    "DetailedDesignDate",
                    "FeasibilityDate",
                    "MYCAApprovalDate",
                    "StartDate",
                    "EndDate"
                ];

                foreach (string common in commonRequiredDateFields)
                {
                    string? match =
                        nullFields.FirstOrDefault(
                            x =>
                                x.EndsWith(
                                    common,
                                    StringComparison.OrdinalIgnoreCase));

                    if (match is not null)
                    {
                        return match;
                    }
                }

                return nullFields.FirstOrDefault();
            }
            catch
            {
                return null;
            }
        }


        private static void CollectNullFields(
            JsonElement element,
            List<string> nullFields,
            string? path)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (JsonProperty property in element.EnumerateObject())
                    {
                        string childPath =
                            string.IsNullOrWhiteSpace(path)
                                ? property.Name
                                : $"{path}.{property.Name}";

                        if (property.Value.ValueKind == JsonValueKind.Null)
                        {
                            nullFields.Add(
                                childPath);
                        }
                        else
                        {
                            CollectNullFields(
                                property.Value,
                                nullFields,
                                childPath);
                        }
                    }

                    break;

                case JsonValueKind.Array:
                    int index =
                        0;

                    foreach (JsonElement item in element.EnumerateArray())
                    {
                        CollectNullFields(
                            item,
                            nullFields,
                            $"{path}[{index}]");

                        index++;
                    }

                    break;
            }
        }


        private static void ApplySqlMessageDiagnostics(
            DatabaseDiagnosticInfo info,
            string sqlMessage)
        {
            if (string.IsNullOrWhiteSpace(sqlMessage))
            {
                return;
            }


            info.SqlMessage =
                sqlMessage;


            Match nullColumnMatch =
                Regex.Match(
                    sqlMessage,
                    @"Cannot\s+insert\s+the\s+value\s+NULL\s+into\s+column\s+'(?<column>[^']+)'\s*,\s*table\s+'(?<table>[^']+)'",
                    RegexOptions.IgnoreCase);

            if (nullColumnMatch.Success)
            {
                info.ColumnName =
                    nullColumnMatch.Groups["column"].Value;

                info.TableName =
                    nullColumnMatch.Groups["table"].Value;
            }


            Match truncationMatch =
                Regex.Match(
                    sqlMessage,
                    @"truncated\s+in\s+table\s+'(?<table>[^']+)'\s*,\s*column\s+'(?<column>[^']+)'\s*\.\s*Truncated\s+value:\s+'(?<value>[^']*)'",
                    RegexOptions.IgnoreCase);

            if (truncationMatch.Success)
            {
                info.TableName =
                    truncationMatch.Groups["table"].Value;

                info.ColumnName =
                    truncationMatch.Groups["column"].Value;

                info.TruncatedValue =
                    truncationMatch.Groups["value"].Value;
            }


            Match constraintMatch =
                Regex.Match(
                    sqlMessage,
                    @"constraint\s+[""'](?<constraint>[^""']+)[""']",
                    RegexOptions.IgnoreCase);

            if (constraintMatch.Success)
            {
                info.ConstraintName =
                    constraintMatch.Groups["constraint"].Value;
            }


            Match conflictLocationMatch =
                Regex.Match(
                    sqlMessage,
                    @"table\s+[""'](?<table>[^""']+)[""']\s*,\s*column\s+[""'](?<column>[^""']+)[""']",
                    RegexOptions.IgnoreCase);

            if (conflictLocationMatch.Success)
            {
                info.ConflictingTableName =
                    conflictLocationMatch.Groups["table"].Value;

                info.ConflictingColumnName =
                    conflictLocationMatch.Groups["column"].Value;
            }


            Match duplicateObjectMatch =
                Regex.Match(
                    sqlMessage,
                    @"duplicate\s+key\s+in\s+object\s+'(?<object>[^']+)'",
                    RegexOptions.IgnoreCase);

            if (duplicateObjectMatch.Success)
            {
                info.ObjectName =
                    duplicateObjectMatch.Groups["object"].Value;
            }


            Match duplicateValueMatch =
                Regex.Match(
                    sqlMessage,
                    @"duplicate\s+key\s+value\s+is\s+\((?<value>[^)]*)\)",
                    RegexOptions.IgnoreCase);

            if (duplicateValueMatch.Success)
            {
                info.DuplicateKeyValue =
                    duplicateValueMatch.Groups["value"].Value;
            }


            Match invalidObjectMatch =
                Regex.Match(
                    sqlMessage,
                    @"Invalid\s+object\s+name\s+'(?<object>[^']+)'",
                    RegexOptions.IgnoreCase);

            if (invalidObjectMatch.Success)
            {
                info.ObjectName =
                    invalidObjectMatch.Groups["object"].Value;
            }


            Match invalidColumnMatch =
                Regex.Match(
                    sqlMessage,
                    @"Invalid\s+column\s+name\s+'(?<column>[^']+)'",
                    RegexOptions.IgnoreCase);

            if (invalidColumnMatch.Success)
            {
                info.ColumnName =
                    invalidColumnMatch.Groups["column"].Value;
            }
        }


        private static string BuildLikelyCause(
            DatabaseDiagnosticInfo info)
        {
            return info.SqlNumber switch
            {
                515 =>
                    $"A required database column received NULL: {FormatTableColumn(info.TableName, info.ColumnName)}.",

                547 =>
                    $"A foreign-key/check constraint rejected the data: {info.ConstraintName ?? "constraint name unavailable"}.",

                2601 or 2627 =>
                    $"A duplicate key was inserted for {info.ObjectName ?? info.TableName ?? "an indexed object"}.",

                8152 or 2628 =>
                    $"A string/binary value is longer than the target column: {FormatTableColumn(info.TableName, info.ColumnName)}.",

                208 =>
                    $"The SQL object does not exist or is not visible: {info.ObjectName ?? "object name unavailable"}.",

                207 =>
                    $"The SQL column does not exist in the queried object: {info.ColumnName ?? "column name unavailable"}.",

                245 or 8114 =>
                    "A value could not be converted to the target SQL data type.",

                8115 =>
                    "A numeric/date value overflowed the target SQL data type.",

                1205 =>
                    "The transaction was chosen as a SQL Server deadlock victim.",

                _ =>
                    "SQL Server rejected the command. Review SQL error details and EF entry diagnostics below."
            };
        }


        private static string BuildRecommendedAction(
            DatabaseDiagnosticInfo info)
        {
            return info.SqlNumber switch
            {
                515 =>
                    $"Populate {FormatTableColumn(info.TableName, info.ColumnName)} before SaveChanges, make the column nullable, or configure a database/default value if NULL is valid.",

                547 =>
                    $"Verify the referenced parent row/check condition for constraint {info.ConstraintName ?? "(unknown)"}. Check FK values in the EF entry diagnostics.",

                2601 or 2627 =>
                    $"Check duplicate key value {info.DuplicateKeyValue ?? "(unknown)"}. Use an existing row, generate a unique key, or handle idempotent updates.",

                8152 or 2628 =>
                    $"Trim/validate the source value or increase the target column length for {FormatTableColumn(info.TableName, info.ColumnName)}.",

                208 =>
                    "Verify the table/view/function exists in the target database and that the connection string points to the expected database.",

                207 =>
                    "Verify EF/raw SQL column names against the deployed database schema.",

                245 or 8114 =>
                    "Validate DTO/entity values before saving and check mismatched EF property type vs SQL column type.",

                8115 =>
                    "Check numeric precision/scale, date range, and target SQL column type.",

                1205 =>
                    "Retry the transaction and review lock order/long-running queries.",

                _ =>
                    "Use the SQL message plus EF entity/property diagnostics to identify the failing table and value."
            };
        }


        private static List<EfEntryDiagnosticInfo> BuildEfEntryDiagnostics(
            DbUpdateException dbUpdateException)
        {
            List<EfEntryDiagnosticInfo> result =
                [];


            foreach (
                EntityEntry entry
                in dbUpdateException.Entries
            )
            {
                EfEntryDiagnosticInfo entryInfo =
                    new()
                    {
                        EntityType =
                            entry.Metadata.ClrType.FullName
                            ?? entry.Metadata.ClrType.Name,

                        Table =
                            entry.Metadata.GetTableName(),

                        Schema =
                            entry.Metadata.GetSchema(),

                        State =
                            entry.State.ToString()
                    };


                foreach (
                    PropertyEntry property
                    in entry.Properties
                )
                {
                    string propertyName =
                        property.Metadata.Name;

                    bool isSensitive =
                        SensitivePropertyNames.Contains(
                            propertyName);


                    entryInfo.Properties.Add(
                        new EfPropertyDiagnosticInfo
                        {
                            Name =
                                propertyName,

                            Column =
                                property.Metadata.GetColumnName(),

                            IsModified =
                                property.IsModified,

                            IsPrimaryKey =
                                property.Metadata.IsPrimaryKey(),

                            IsForeignKey =
                                property.Metadata.IsForeignKey(),

                            IsNullable =
                                property.Metadata.IsNullable,

                            CurrentValue =
                                isSensitive
                                    ? "***REDACTED***"
                                    : FormatDiagnosticValue(
                                        property.CurrentValue),

                            OriginalValue =
                                isSensitive
                                    ? "***REDACTED***"
                                    : SafeGetOriginalValue(
                                        property)
                        });
                }


                result.Add(entryInfo);
            }


            return result;
        }


        private static string SafeGetOriginalValue(
            PropertyEntry property)
        {
            try
            {
                return FormatDiagnosticValue(
                    property.OriginalValue);
            }
            catch
            {
                return "[ORIGINAL VALUE NOT AVAILABLE]";
            }
        }


        private static string FormatDiagnosticValue(
            object? value)
        {
            if (value is null)
            {
                return "NULL";
            }


            string text =
                value switch
                {
                    DateTime dateTime =>
                        dateTime.ToString("O"),

                    DateTimeOffset dateTimeOffset =>
                        dateTimeOffset.ToString("O"),

                    byte[] bytes =>
                        $"ByteArray[{bytes.Length}]",

                    _ =>
                        Convert.ToString(value)
                        ?? string.Empty
                };


            return TruncateForSingleLine(
                text,
                500);
        }


        private static string FormatTableColumn(
            string? tableName,
            string? columnName)
        {
            if (
                string.IsNullOrWhiteSpace(tableName)
                &&
                string.IsNullOrWhiteSpace(columnName)
            )
            {
                return "unknown table/column";
            }


            if (string.IsNullOrWhiteSpace(tableName))
            {
                return columnName!;
            }


            if (string.IsNullOrWhiteSpace(columnName))
            {
                return tableName!;
            }


            return $"{tableName}.{columnName}";
        }


        private static string TruncateForSingleLine(
            string value,
            int maximumLength)
        {
            string singleLine =
                value
                    .Replace("\r", "\\r")
                    .Replace("\n", "\\n");


            if (singleLine.Length <= maximumLength)
            {
                return singleLine;
            }


            return
                singleLine[..maximumLength]
                +
                $"...[TRUNCATED {singleLine.Length:N0} CHARS]";
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
            DbUpdateException? dbUpdateException,
            OperationDiagnosticInfo operationDiagnostic,
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

            DatabaseDiagnosticInfo databaseDiagnostic =
                BuildDatabaseDiagnostic(
                    sqlException,
                    dbUpdateException);


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
            // ERROR SUMMARY
            // =====================================================

            builder.AppendLine(
                "ERROR SUMMARY");

            builder.AppendLine(
                "-------------");

            builder.AppendLine(
                $"FailureKind: {operationDiagnostic.FailureKind ?? "Not Available"}");

            builder.AppendLine(
                $"OperationType: {operationDiagnostic.OperationType ?? "Not Available"}");

            builder.AppendLine(
                $"DeveloperMessage: {operationDiagnostic.DeveloperMessage ?? "Not Available"}");

            builder.AppendLine(
                $"UserMessage: {operationDiagnostic.UserMessage ?? "Not Available"}");

            builder.AppendLine();


            // =====================================================
            // FAILURE LOCATION
            // =====================================================

            builder.AppendLine(
                "FAILURE LOCATION");

            builder.AppendLine(
                "----------------");

            builder.AppendLine(
                $"DeclaringType: {operationDiagnostic.DeclaringType ?? "Not Available"}");

            builder.AppendLine(
                $"Method: {operationDiagnostic.Method ?? "Not Available"}");

            builder.AppendLine(
                $"SourceFile: {operationDiagnostic.SourceFile ?? "Not Available"}");

            builder.AppendLine(
                $"SourceLine: {operationDiagnostic.SourceLine?.ToString() ?? "Not Available"}");

            builder.AppendLine();


            // =====================================================
            // FAILED OPERATION
            // =====================================================

            builder.AppendLine(
                "FAILED OPERATION");

            builder.AppendLine(
                "----------------");

            builder.AppendLine(
                $"IsDatabaseRelated: {operationDiagnostic.IsDatabaseRelated}");

            builder.AppendLine(
                $"IsDuringSaveChanges: {operationDiagnostic.IsDuringSaveChanges}");

            builder.AppendLine(
                $"IsDuringQueryExecution: {operationDiagnostic.IsDuringQueryExecution}");

            builder.AppendLine(
                $"LikelyField: {operationDiagnostic.LikelyField ?? "Not Available"}");

            builder.AppendLine(
                $"LikelyCause: {operationDiagnostic.LikelyCause ?? "Not Available"}");

            builder.AppendLine();

            if (operationDiagnostic.IsDatabaseRelated)
            {
                builder.AppendLine(
                    "SQL / EF DIAGNOSTICS");

                builder.AppendLine(
                    "--------------------");

                builder.AppendLine(
                    $"SqlErrorNumber: {operationDiagnostic.SqlErrorNumber?.ToString() ?? "Not Available"}");

                builder.AppendLine(
                    $"SqlProcedure: {operationDiagnostic.SqlProcedure ?? "Not Available"}");

                builder.AppendLine(
                    $"SqlLineNumber: {operationDiagnostic.SqlLineNumber?.ToString() ?? "Not Available"}");

                builder.AppendLine(
                    $"ExpectedResultShape: {operationDiagnostic.ExpectedResultShape ?? "Not Available"}");

                builder.AppendLine();
            }


            // =====================================================
            // RECOMMENDED FIX
            // =====================================================

            builder.AppendLine(
                "RECOMMENDED FIX");

            builder.AppendLine(
                "---------------");

            builder.AppendLine(
                operationDiagnostic.RecommendedFix
                ?? "Review stack trace, payload, and diagnostics.");

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
            // DATABASE DIAGNOSTIC SUMMARY
            // =====================================================

            if (
                sqlException is not null
                ||
                dbUpdateException is not null
            )
            {
                builder.AppendLine(
                    "DATABASE DIAGNOSTIC SUMMARY");

                builder.AppendLine(
                    "---------------------------");

                builder.AppendLine(
                    $"Category: {databaseDiagnostic.Category ?? "Not Available"}");

                builder.AppendLine(
                    $"LikelyCause: {databaseDiagnostic.LikelyCause ?? "Not Available"}");

                builder.AppendLine(
                    $"RecommendedAction: {databaseDiagnostic.RecommendedAction ?? "Not Available"}");

                builder.AppendLine(
                    $"Table: {databaseDiagnostic.TableName ?? "Not Available"}");

                builder.AppendLine(
                    $"Column: {databaseDiagnostic.ColumnName ?? "Not Available"}");

                builder.AppendLine(
                    $"Constraint: {databaseDiagnostic.ConstraintName ?? "Not Available"}");

                builder.AppendLine(
                    $"ConflictingTable: {databaseDiagnostic.ConflictingTableName ?? "Not Available"}");

                builder.AppendLine(
                    $"ConflictingColumn: {databaseDiagnostic.ConflictingColumnName ?? "Not Available"}");

                builder.AppendLine(
                    $"Object: {databaseDiagnostic.ObjectName ?? "Not Available"}");

                builder.AppendLine(
                    $"DuplicateKeyValue: {databaseDiagnostic.DuplicateKeyValue ?? "Not Available"}");

                builder.AppendLine(
                    $"TruncatedValue: {databaseDiagnostic.TruncatedValue ?? "Not Available"}");

                builder.AppendLine();
            }


            // =====================================================
            // EF SAVECHANGES ENTRIES
            // =====================================================

            if (databaseDiagnostic.EntityEntries.Count > 0)
            {
                builder.AppendLine(
                    "EF SAVECHANGES ENTRIES");

                builder.AppendLine(
                    "----------------------");


                foreach (
                    EfEntryDiagnosticInfo entry
                    in databaseDiagnostic.EntityEntries
                )
                {
                    builder.AppendLine(
                        $"Entity: {entry.EntityType}");

                    builder.AppendLine(
                        $"Table: {entry.Schema ?? "dbo"}.{entry.Table ?? "Not Available"}");

                    builder.AppendLine(
                        $"State: {entry.State}");

                    builder.AppendLine(
                        "Properties:");


                    foreach (
                        EfPropertyDiagnosticInfo property
                        in entry.Properties
                    )
                    {
                        builder.AppendLine(
                            "- " +
                            $"Property={property.Name}, " +
                            $"Column={property.Column ?? "Not Available"}, " +
                            $"Current={property.CurrentValue}, " +
                            $"Original={property.OriginalValue}, " +
                            $"Modified={property.IsModified}, " +
                            $"PK={property.IsPrimaryKey}, " +
                            $"FK={property.IsForeignKey}, " +
                            $"Nullable={property.IsNullable}");
                    }


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
        // DATABASE DIAGNOSTIC MODELS
        // =========================================================

        private sealed class OperationDiagnosticInfo
        {
            public string? FailureKind { get; set; }

            public string? OperationType { get; set; }

            public string? DeveloperMessage { get; set; }

            public string? UserMessage { get; set; }

            public string? LikelyCause { get; set; }

            public string? RecommendedFix { get; set; }

            public string? DeclaringType { get; set; }

            public string? Method { get; set; }

            public string? SourceFile { get; set; }

            public int? SourceLine { get; set; }

            public bool IsDatabaseRelated { get; set; }

            public bool IsDuringSaveChanges { get; set; }

            public bool IsDuringQueryExecution { get; set; }

            public int? SqlErrorNumber { get; set; }

            public string? SqlProcedure { get; set; }

            public int? SqlLineNumber { get; set; }

            public string? ExpectedResultShape { get; set; }

            public string? LikelyField { get; set; }
        }


        private sealed class StackFrameInfo
        {
            public string? Method { get; set; }

            public string? DeclaringType { get; set; }

            public string? File { get; set; }

            public int? Line { get; set; }
        }


        private sealed class DatabaseDiagnosticInfo
        {
            public int? SqlNumber { get; set; }

            public byte? SqlState { get; set; }

            public byte? SqlClass { get; set; }

            public string? SqlProcedure { get; set; }

            public int? SqlLineNumber { get; set; }

            public string? SqlMessage { get; set; }

            public string? Category { get; set; }

            public string? LikelyCause { get; set; }

            public string? RecommendedAction { get; set; }

            public string? TableName { get; set; }

            public string? ColumnName { get; set; }

            public string? ConstraintName { get; set; }

            public string? ConflictingTableName { get; set; }

            public string? ConflictingColumnName { get; set; }

            public string? ObjectName { get; set; }

            public string? DuplicateKeyValue { get; set; }

            public string? TruncatedValue { get; set; }

            public List<EfEntryDiagnosticInfo> EntityEntries { get; set; }
                = [];
        }


        private sealed class EfEntryDiagnosticInfo
        {
            public string EntityType { get; set; }
                = string.Empty;

            public string? Table { get; set; }

            public string? Schema { get; set; }

            public string State { get; set; }
                = string.Empty;

            public List<EfPropertyDiagnosticInfo> Properties { get; set; }
                = [];
        }


        private sealed class EfPropertyDiagnosticInfo
        {
            public string Name { get; set; }
                = string.Empty;

            public string? Column { get; set; }

            public string CurrentValue { get; set; }
                = string.Empty;

            public string OriginalValue { get; set; }
                = string.Empty;

            public bool IsModified { get; set; }

            public bool IsPrimaryKey { get; set; }

            public bool IsForeignKey { get; set; }

            public bool IsNullable { get; set; }
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
