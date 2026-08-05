#nullable enable

using DBHelper.Data;
using DBHelper.Models.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using System.Text.RegularExpressions;

namespace Helpers
{
    public static class QueryPaginationExtensions
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 200;

        private static readonly Regex IdentifierRegex = new(
            @"^[A-Za-z_][A-Za-z0-9_]*$",
            RegexOptions.Compiled);

        private static readonly ConcurrentDictionary<
            (Type Type, string Column),
            Func<object, object?>> KeyGetters = new();

        public static async Task<FilterDataResult<T>>
            FilterDataCursor<T, TFilter>(
                this MYPSDbContext db,
                string tableName,
                EnumPagination<TFilter> dto,
                List<(
                    string Clause,
                    string ParamName,
                    object? Value)> filter,
                string keyColumn = "Id",
                bool descending = true,
                bool includeTotal = true,
                CancellationToken ct = default)
            where T : class
        {
            try
            {
                // ---------------------------------------------------------
                // Validation
                // ---------------------------------------------------------

                if (db is null)
                {
                    return Error<T>(
                        "Database context is required.");
                }

                if (dto is null)
                {
                    return Error<T>(
                        "Pagination request is required.");
                }

                if (filter is null)
                {
                    return Error<T>(
                        "Filter collection is required.");
                }

                if (!Enum.IsDefined(
                        typeof(PaginationNavigation),
                        dto.Navigation))
                {
                    return Error<T>(
                        $"Invalid pagination navigation: " +
                        $"{dto.Navigation}.");
                }

                string safeTable =
                    SafeIdentifier(tableName);

                string safeKeyColumn =
                    SafeSingleIdentifier(keyColumn);

                string keyExpression =
                    $"v.{safeKeyColumn}";

                int limit = dto.limit < 1
                    ? DefaultLimit
                    : Math.Min(dto.limit, MaxLimit);

                int requestedPage =
                    Math.Max(dto.page, 1);

                List<(
                    string Clause,
                    string ParamName,
                    object? Value)> normalizedFilters =
                    filter
                        .Where(item =>
                            !string.IsNullOrWhiteSpace(
                                item.Clause))
                        .ToList();

                FilterDataResult<T>? parameterValidation =
                    ValidateFilterParameters<T>(
                        normalizedFilters);

                if (parameterValidation is not null)
                {
                    return parameterValidation;
                }

                List<string> basePredicates =
                    normalizedFilters
                        .Select(item =>
                            $"({item.Clause})")
                        .ToList();

                /*
                 * Last-page navigation requires the total count to
                 * calculate how many records belong to the final page.
                 */
                bool countRequired =
                    includeTotal ||
                    dto.Navigation ==
                        PaginationNavigation.Last;

                long total = 0;
                int totalPages = 0;

                if (countRequired)
                {
                    (total, totalPages) =
                        await GetTotalAsync(
                            db,
                            safeTable,
                            basePredicates,
                            normalizedFilters,
                            limit,
                            ct);
                }

                /*
                 * For Last navigation, the server determines the
                 * actual target page.
                 */
                if (dto.Navigation ==
                    PaginationNavigation.Last)
                {
                    requestedPage =
                        totalPages > 0
                            ? totalPages
                            : 1;
                }

                /*
                 * Validate a typed page when total count is available.
                 */
                if (dto.Navigation ==
                        PaginationNavigation.Page &&
                    includeTotal)
                {
                    if (totalPages == 0 &&
                        requestedPage > 1)
                    {
                        return Error<T>(
                            "No records are available.");
                    }

                    if (totalPages > 0 &&
                        requestedPage > totalPages)
                    {
                        return Error<T>(
                            $"Page {requestedPage} does not exist. " +
                            $"The last available page is " +
                            $"{totalPages}.");
                    }
                }

                /*
                 * Return an empty first/last page immediately when
                 * the filtered result has no records.
                 */
                if (countRequired &&
                    total == 0)
                {
                    return new FilterDataResult<T>
                    {
                        HasError = false,
                        ErrorMessage = null,
                        Data = new FilteredResult<T>
                        {
                            lists = new List<T>(),
                            page = 1,
                            limit = limit,
                            total = 0,
                            totalPages = 0,
                            HasPrevious = false,
                            HasNext = false,
                            PreviousFilteredId = null,
                            NextFilteredId = null,
                            PageCursorId = null
                        }
                    };
                }

                // ---------------------------------------------------------
                // Resolve navigation behavior
                // ---------------------------------------------------------

                long? cursorId = null;

                bool reverseRows = false;
                bool useProbeRow = true;

                int take = limit + 1;

                string fetchDirection;
                string? cursorPredicate = null;

                switch (dto.Navigation)
                {
                    case PaginationNavigation.First:
                        {
                            requestedPage = 1;

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    case PaginationNavigation.Next:
                        {
                            if (!dto.NextFilteredId.HasValue)
                            {
                                return Error<T>(
                                    $"{nameof(dto.NextFilteredId)} " +
                                    "is required for Next pagination.");
                            }

                            cursorId =
                                dto.NextFilteredId.Value;

                            string comparisonOperator =
                                descending ? "<" : ">";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} @__cursor";

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    case PaginationNavigation.Previous:
                        {
                            if (!dto.PreviousFilteredId.HasValue)
                            {
                                return Error<T>(
                                    $"{nameof(dto.PreviousFilteredId)} " +
                                    "is required for Previous pagination.");
                            }

                            cursorId =
                                dto.PreviousFilteredId.Value;

                            string comparisonOperator =
                                descending ? ">" : "<";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} @__cursor";

                            /*
                             * Previous pagination queries in the opposite
                             * order, then reverses the rows afterward.
                             */
                            fetchDirection =
                                descending
                                    ? "ASC"
                                    : "DESC";

                            reverseRows = true;

                            break;
                        }

                    case PaginationNavigation.Page:
                        {
                            /*
                             * Page 1 does not require a stored page cursor.
                             */
                            if (requestedPage == 1 &&
                                !dto.PageCursorId.HasValue)
                            {
                                fetchDirection =
                                    descending
                                        ? "DESC"
                                        : "ASC";

                                break;
                            }

                            if (!dto.PageCursorId.HasValue)
                            {
                                return Error<T>(
                                    $"{nameof(dto.PageCursorId)} is " +
                                    $"required to open page " +
                                    $"{requestedPage}. The page must " +
                                    "have been visited previously.");
                            }

                            cursorId =
                                dto.PageCursorId.Value;

                            /*
                             * PageCursorId represents the first record ID
                             * of the target page, so the comparison must
                             * include that record.
                             */
                            string comparisonOperator =
                                descending ? "<=" : ">=";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} @__cursor";

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    case PaginationNavigation.Last:
                        {
                            /*
                             * The last page may contain fewer records than
                             * the normal limit.
                             */
                            int lastPageSize =
                                GetLastPageSize(
                                    total,
                                    limit);

                            take = lastPageSize;

                            useProbeRow = false;
                            reverseRows = true;

                            /*
                             * Query from the opposite end of the table.
                             */
                            fetchDirection =
                                descending
                                    ? "ASC"
                                    : "DESC";

                            break;
                        }

                    default:
                        {
                            return Error<T>(
                                "Unsupported pagination navigation.");
                        }
                }

                // ---------------------------------------------------------
                // Build fetch query
                // ---------------------------------------------------------

                List<string> fetchPredicates =
                    new(basePredicates);

                if (!string.IsNullOrWhiteSpace(
                        cursorPredicate))
                {
                    fetchPredicates.Add(
                        cursorPredicate);
                }

                string fetchWhereSql =
                    BuildWhereClause(
                        fetchPredicates);

                string fetchSql =
                    $"""
                    SELECT TOP (@__take)
                        v.*
                    FROM {safeTable} AS v
                    {fetchWhereSql}
                    ORDER BY {keyExpression} {fetchDirection}
                    """;

                List<SqlParameter> fetchParameters =
                    CreateFilterParameters(
                        normalizedFilters);

                fetchParameters.Add(
                    new SqlParameter(
                        "@__take",
                        take));

                if (cursorId.HasValue)
                {
                    fetchParameters.Add(
                        new SqlParameter(
                            "@__cursor",
                            cursorId.Value));
                }

                List<T> rows =
                    await db.Set<T>()
                        .FromSqlRaw(
                            fetchSql,
                            fetchParameters.ToArray())
                        .AsNoTracking()
                        .ToListAsync(ct);

                // ---------------------------------------------------------
                // Probe-row handling
                // ---------------------------------------------------------

                bool hasDirectionalPage = false;

                if (useProbeRow)
                {
                    hasDirectionalPage =
                        rows.Count > limit;

                    if (hasDirectionalPage)
                    {
                        rows.RemoveAt(
                            rows.Count - 1);
                    }
                }

                if (reverseRows)
                {
                    rows.Reverse();
                }

                /*
                 * Empty cursor results usually mean the records,
                 * filters, or permissions changed after the cursor
                 * was generated.
                 */
                bool cursorNavigation =
                    dto.Navigation ==
                        PaginationNavigation.Next ||
                    dto.Navigation ==
                        PaginationNavigation.Previous ||
                    (
                        dto.Navigation ==
                            PaginationNavigation.Page &&
                        requestedPage > 1
                    );

                if (cursorNavigation &&
                    rows.Count == 0)
                {
                    return Error<T>(
                        $"Page {requestedPage} could not be loaded. " +
                        "The cursor may be stale or the filtered " +
                        "records may have changed.");
                }

                // ---------------------------------------------------------
                // Navigation state
                // ---------------------------------------------------------

                bool hasPrevious;
                bool hasNext;

                switch (dto.Navigation)
                {
                    case PaginationNavigation.First:
                        {
                            hasPrevious = false;
                            hasNext = hasDirectionalPage;
                            break;
                        }

                    case PaginationNavigation.Next:
                        {
                            hasPrevious = rows.Count > 0;
                            hasNext = hasDirectionalPage;
                            break;
                        }

                    case PaginationNavigation.Previous:
                        {
                            hasPrevious = hasDirectionalPage;
                            hasNext = rows.Count > 0;
                            break;
                        }

                    case PaginationNavigation.Page:
                        {
                            hasPrevious =
                                requestedPage > 1 &&
                                rows.Count > 0;

                            hasNext =
                                hasDirectionalPage;

                            break;
                        }

                    case PaginationNavigation.Last:
                        {
                            hasPrevious =
                                total > rows.Count;

                            hasNext = false;

                            break;
                        }

                    default:
                        {
                            hasPrevious = false;
                            hasNext = false;
                            break;
                        }
                }

                // ---------------------------------------------------------
                // Extract returned cursors
                // ---------------------------------------------------------

                long? firstKey =
                    rows.Count == 0
                        ? null
                        : GetKeyValue(
                            rows[0],
                            keyColumn);

                long? lastKey =
                    rows.Count == 0
                        ? null
                        : GetKeyValue(
                            rows[^1],
                            keyColumn);

                var result =
                    new FilterDataResult<T>
                    {
                        HasError = false,
                        ErrorMessage = null,
                        Data = new FilteredResult<T>
                        {
                            lists = rows,
                            page = requestedPage,
                            limit = limit,

                            total = includeTotal
                                ? total
                                : null,

                            totalPages = includeTotal
                                ? totalPages
                                : 0,

                            HasPrevious =
                                hasPrevious,

                            HasNext =
                                hasNext,

                            /*
                             * First ID of the current page.
                             * Used for Previous navigation.
                             */
                            PreviousFilteredId =
                                hasPrevious
                                    ? firstKey
                                    : null,

                            /*
                             * Last ID of the current page.
                             * Used for Next navigation.
                             */
                            NextFilteredId =
                                hasNext
                                    ? lastKey
                                    : null,

                            /*
                             * Always return the first ID so the
                             * frontend can store it for typed-page
                             * navigation.
                             */
                            PageCursorId =
                                firstKey
                        }
                    };

                return result;
            }
            catch (OperationCanceledException)
                when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                return Error<T>(
                    ex.Message);
            }
        }

        // -------------------------------------------------------------
        // Total count
        // -------------------------------------------------------------

        private static async Task<(
            long Total,
            int TotalPages)> GetTotalAsync(
                MYPSDbContext db,
                string safeTable,
                IReadOnlyCollection<string> basePredicates,
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filter,
                int limit,
                CancellationToken ct)
        {
            string countWhereSql =
                BuildWhereClause(
                    basePredicates);

            string countSql =
                $"""
                SELECT COUNT_BIG(*) AS TotalCount
                FROM {safeTable} AS v
                {countWhereSql}
                """;

            List<SqlParameter> countParameters =
                CreateFilterParameters(
                    filter);

            PaginationCount? countRow =
                await db.Set<PaginationCount>()
                    .FromSqlRaw(
                        countSql,
                        countParameters.ToArray())
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ct);

            long total =
                countRow?.TotalCount ?? 0;

            long calculatedPages =
                total == 0
                    ? 0
                    : (total + limit - 1L) /
                      limit;

            int totalPages =
                calculatedPages > int.MaxValue
                    ? int.MaxValue
                    : (int)calculatedPages;

            return (
                total,
                totalPages);
        }

        private static int GetLastPageSize(
            long total,
            int limit)
        {
            if (total <= 0)
            {
                return 0;
            }

            long remainder =
                total % limit;

            return remainder == 0
                ? limit
                : (int)remainder;
        }

        // -------------------------------------------------------------
        // SQL helpers
        // -------------------------------------------------------------

        private static string BuildWhereClause(
            IEnumerable<string> predicates)
        {
            List<string> validPredicates =
                predicates
                    .Where(predicate =>
                        !string.IsNullOrWhiteSpace(
                            predicate))
                    .ToList();

            return validPredicates.Count == 0
                ? string.Empty
                : "WHERE " +
                  string.Join(
                      " AND ",
                      validPredicates);
        }

        private static List<SqlParameter>
            CreateFilterParameters(
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filters)
        {
            return filters
                .Select(item =>
                    new SqlParameter(
                        NormalizeParameterName(
                            item.ParamName),
                        item.Value ??
                        DBNull.Value))
                .ToList();
        }

        private static string NormalizeParameterName(
            string parameterName)
        {
            if (string.IsNullOrWhiteSpace(
                    parameterName))
            {
                throw new ArgumentException(
                    "SQL parameter name cannot be empty.");
            }

            return parameterName.StartsWith("@")
                ? parameterName
                : $"@{parameterName}";
        }

        private static FilterDataResult<T>?
            ValidateFilterParameters<T>(
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filters)
        {
            List<string> parameterNames =
                filters
                    .Select(item =>
                        NormalizeParameterName(
                            item.ParamName))
                    .ToList();

            string? duplicateParameter =
                parameterNames
                    .GroupBy(
                        name => name,
                        StringComparer.OrdinalIgnoreCase)
                    .Where(group =>
                        group.Count() > 1)
                    .Select(group =>
                        group.Key)
                    .FirstOrDefault();

            if (duplicateParameter is not null)
            {
                return Error<T>(
                    $"Duplicate SQL parameter name: " +
                    $"{duplicateParameter}.");
            }

            return null;
        }

        // -------------------------------------------------------------
        // Identifier validation
        // -------------------------------------------------------------

        private static string SafeIdentifier(
            string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                throw new ArgumentException(
                    "Table or view name is required.");
            }

            string[] parts =
                raw.Split('.');

            if (parts.Length == 0 ||
                parts.Any(string.IsNullOrWhiteSpace))
            {
                throw new ArgumentException(
                    $"Invalid SQL identifier: '{raw}'.");
            }

            foreach (string part in parts)
            {
                if (!IdentifierRegex.IsMatch(part))
                {
                    throw new ArgumentException(
                        $"Unsafe SQL identifier: '{raw}'.");
                }
            }

            return string.Join(
                ".",
                parts.Select(
                    part => $"[{part}]"));
        }

        private static string SafeSingleIdentifier(
            string raw)
        {
            if (string.IsNullOrWhiteSpace(raw) ||
                !IdentifierRegex.IsMatch(raw))
            {
                throw new ArgumentException(
                    $"Unsafe SQL identifier: '{raw}'.");
            }

            return $"[{raw}]";
        }

        // -------------------------------------------------------------
        // Cursor key extraction
        // -------------------------------------------------------------

        private static long GetKeyValue<T>(
            T item,
            string keyColumn)
        {
            Func<object, object?> getter =
                KeyGetters.GetOrAdd(
                    (typeof(T), keyColumn),
                    key =>
                    {
                        PropertyInfo property =
                            key.Type.GetProperty(
                                key.Column,
                                BindingFlags.Public |
                                BindingFlags.Instance |
                                BindingFlags.IgnoreCase)
                            ?? throw new
                                InvalidOperationException(
                                    $"Type '{key.Type.Name}' " +
                                    $"does not contain property " +
                                    $"'{key.Column}'.");

                        ParameterExpression objectParameter =
                            Expression.Parameter(
                                typeof(object),
                                "item");

                        UnaryExpression typedObject =
                            Expression.Convert(
                                objectParameter,
                                key.Type);

                        MemberExpression propertyAccess =
                            Expression.Property(
                                typedObject,
                                property);

                        UnaryExpression boxedValue =
                            Expression.Convert(
                                propertyAccess,
                                typeof(object));

                        return Expression
                            .Lambda<Func<object, object?>>(
                                boxedValue,
                                objectParameter)
                            .Compile();
                    });

            object? value =
                getter(item!);

            if (value is null ||
                value == DBNull.Value)
            {
                throw new InvalidOperationException(
                    $"Cursor key '{keyColumn}' cannot be null.");
            }

            return Convert.ToInt64(
                value,
                CultureInfo.InvariantCulture);
        }

        // -------------------------------------------------------------
        // Error response
        // -------------------------------------------------------------

        private static FilterDataResult<T>
            Error<T>(
                string message)
        {
            return new FilterDataResult<T>
            {
                HasError = true,
                ErrorMessage = message,
                Data = new FilteredResult<T>()
            };
        }
    }
}