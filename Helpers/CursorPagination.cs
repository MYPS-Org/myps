using DBHelper.Data;
using DBHelper.Models.Enums;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Data.SqlClient;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

namespace Helpers
{
    public static class QueryPaginationExtensions
    {
        private const int MaxLimit = 200;

        private static readonly Regex IdentifierRegex =
            new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

        private static readonly ConcurrentDictionary<
            (Type Type, string Column),
            Func<object, object?>> KeyGetters = new();

        public static async Task<FilterDataResult<T>> FilterDataCursor<T, TFilter>(
            this MYPSDbContext db,
            string tableName,
            EnumPagination<TFilter> dto,
            List<(string Clause, string ParamName, object? Value)> filter,
            string keyColumn = "Id",
            bool descending = true,
            bool includeTotal = true,
            CancellationToken ct = default)
            where T : class
        {
            var result = new FilterDataResult<T>();

            try
            {
                if (dto is null || filter is null)
                    return Error<T>("Expected pagination parameters are missing.");

                string safeTable = SafeIdentifier(tableName);

                if (!IdentifierRegex.IsMatch(keyColumn))
                    return Error<T>($"Invalid key column '{keyColumn}'.");

                int limit = dto.limit < 1
                    ? 10
                    : Math.Min(dto.limit, MaxLimit);

                int clientPage = Math.Max(dto.page, 1);

                bool firstRequest =
                    !dto.PreviousFilteredId.HasValue &&
                    !dto.NextFilteredId.HasValue;

                long? cursorId = firstRequest
                    ? null
                    : dto.Direction == PaginationDirection.Next
                        ? dto.NextFilteredId
                        : dto.PreviousFilteredId;

                if (!firstRequest && !cursorId.HasValue)
                {
                    string missingCursor = dto.Direction == PaginationDirection.Next
                        ? nameof(dto.NextFilteredId)
                        : nameof(dto.PreviousFilteredId);

                    return Error<T>(
                        $"{missingCursor} is required for {dto.Direction} pagination.");
                }

                bool movingPrevious =
                    !firstRequest &&
                    dto.Direction == PaginationDirection.Previous;

                string key = $"v.[{keyColumn}]";

                var basePredicates = filter
                    .Select(f => $"({f.Clause})")
                    .ToList();

                var fetchPredicates = new List<string>(basePredicates);

                if (cursorId.HasValue)
                {
                    string comparisonOperator = GetComparisonOperator(
                        dto.Direction,
                        descending);

                    fetchPredicates.Add(
                        $"{key} {comparisonOperator} @__cursor");
                }

                string whereSql = fetchPredicates.Count == 0
                    ? string.Empty
                    : " WHERE " + string.Join(" AND ", fetchPredicates);

                // Previous-page queries use the opposite SQL order. After fetching,
                // rows are reversed back to the requested display order.
                string fetchDirection = GetFetchDirection(
                    dto.Direction,
                    descending,
                    firstRequest);

                string fetchSql =
                    $"SELECT TOP (@__take) v.* " +
                    $"FROM {safeTable} AS v" +
                    $"{whereSql} " +
                    $"ORDER BY {key} {fetchDirection};";

                var fetchParams = CreateFilterParameters(filter);
                fetchParams.Add(new Microsoft.Data.SqlClient.SqlParameter("@__take", limit + 1));

                if (cursorId.HasValue)
                    fetchParams.Add(new Microsoft.Data.SqlClient.SqlParameter("@__cursor", cursorId.Value));

                var rows = await db.Set<T>()
                    .FromSqlRaw(fetchSql, fetchParams.ToArray())
                    .AsNoTracking()
                    .ToListAsync(ct);

                bool hasDirectionalPage = rows.Count > limit;

                if (hasDirectionalPage)
                    rows.RemoveAt(rows.Count - 1);

                if (movingPrevious)
                    rows.Reverse();

                bool hasPrevious;
                bool hasNext;

                if (firstRequest)
                {
                    hasPrevious = false;
                    hasNext = hasDirectionalPage;
                }
                else if (dto.Direction == PaginationDirection.Next)
                {
                    hasPrevious = true;
                    hasNext = hasDirectionalPage;
                }
                else
                {
                    hasPrevious = hasDirectionalPage;
                    hasNext = true;
                }

                int resultPage = firstRequest
                    ? 1
                    : dto.Direction == PaginationDirection.Next
                        ? clientPage + 1
                        : Math.Max(clientPage - 1, 1);

                long? firstKey = rows.Count == 0
                    ? null
                    : GetKeyValue(rows[0], keyColumn);

                long? lastKey = rows.Count == 0
                    ? null
                    : GetKeyValue(rows[^1], keyColumn);

                result.Data.lists = rows;
                result.Data.page = resultPage;
                result.Data.limit = limit;
                result.Data.HasPrevious = hasPrevious;
                result.Data.HasNext = hasNext;
                result.Data.PreviousFilteredId = hasPrevious ? firstKey : null;
                result.Data.NextFilteredId = hasNext ? lastKey : null;

                if (includeTotal)
                {
                    string countWhereSql = basePredicates.Count == 0
                        ? string.Empty
                        : " WHERE " + string.Join(" AND ", basePredicates);

                    string countSql =
                        $"SELECT COUNT_BIG(*) AS TotalCount " +
                        $"FROM {safeTable} AS v" +
                        $"{countWhereSql}";

                    var countParams = CreateFilterParameters(filter);

                    var countRow = await db.Set<PaginationCount>()
                        .FromSqlRaw(countSql, countParams.ToArray())
                        .AsNoTracking()
                        .FirstOrDefaultAsync(ct);

                    long total = countRow?.TotalCount ?? 0;
                    long totalPages = total == 0
                        ? 0
                        : (total + limit - 1L) / limit;

                    result.Data.total = total;
                    result.Data.totalPages = totalPages > int.MaxValue
                        ? int.MaxValue
                        : (int)totalPages;
                }

                return result;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                return Error<T>(ex.Message);
            }
        }

        private static string GetComparisonOperator(
            PaginationDirection direction,
            bool descending)
        {
            return direction switch
            {
                PaginationDirection.Next => descending ? "<" : ">",
                PaginationDirection.Previous => descending ? ">" : "<",
                _ => throw new ArgumentOutOfRangeException(nameof(direction))
            };
        }

        private static string GetFetchDirection(
            PaginationDirection direction,
            bool descending,
            bool firstRequest)
        {
            if (firstRequest || direction == PaginationDirection.Next)
                return descending ? "DESC" : "ASC";

            return descending ? "ASC" : "DESC";
        }

        private static List<Microsoft.Data.SqlClient.SqlParameter> CreateFilterParameters(
            IEnumerable<(string Clause, string ParamName, object? Value)> filter)
        {
            return filter
                .Select(f => new Microsoft.Data.SqlClient.SqlParameter(
                    f.ParamName,
                    f.Value ?? DBNull.Value))
                .ToList();
        }

        private static FilterDataResult<T> Error<T>(string message)
        {
            return new FilterDataResult<T>
            {
                HasError = true,
                ErrorMessage = message
            };
        }

        private static string SafeIdentifier(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                throw new ArgumentException("Table/view name is required.");

            var parts = raw.Split('.');

            foreach (string part in parts)
            {
                if (!IdentifierRegex.IsMatch(part))
                    throw new ArgumentException(
                        $"Unsafe SQL identifier: '{raw}'.");
            }

            return string.Join(
                ".",
                parts.Select(part => $"[{part}]"));
        }

        private static long GetKeyValue<T>(T item, string keyColumn)
        {
            var getter = KeyGetters.GetOrAdd(
                (typeof(T), keyColumn),
                key =>
                {
                    var property = key.Type.GetProperty(
                        key.Column,
                        BindingFlags.Public |
                        BindingFlags.Instance |
                        BindingFlags.IgnoreCase)
                        ?? throw new InvalidOperationException(
                            $"Type '{key.Type.Name}' has no property " +
                            $"'{key.Column}' to use as the cursor key.");

                    var objectParameter =
                        Expression.Parameter(typeof(object), "item");

                    var typedObject =
                        Expression.Convert(objectParameter, key.Type);

                    var propertyAccess =
                        Expression.Property(typedObject, property);

                    var boxedValue =
                        Expression.Convert(propertyAccess, typeof(object));

                    return Expression
                        .Lambda<Func<object, object?>>(
                            boxedValue,
                            objectParameter)
                        .Compile();
                });

            object? value = getter(item!);

            if (value is null || value == DBNull.Value)
            {
                throw new InvalidOperationException(
                    $"Cursor key '{keyColumn}' cannot be null.");
            }

            return Convert.ToInt64(value, CultureInfo.InvariantCulture);
        }
    }
}