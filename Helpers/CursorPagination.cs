#nullable enable

using DBHelper.Data;
using DBHelper.Models.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Helpers
{
    public static class QueryPaginationExtensions
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 200;

        /*
         * IMPORTANT:
         * Do NOT allow:
         * '
         * "
         * (
         * )
         * ,
         *
         * Function parameters are handled separately through
         * sourceParameters.
         */
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
                List<(
                    string ParamName,
                    object? Value)>? sourceParameters = null,
                bool isTableValuedFunction = false,
                CancellationToken ct = default,
                bool recompileCursorQueries = false)
            where T : class
        {
            /*
             * recompileCursorQueries (2026-10-18): opt-in OPTION (RECOMPILE) on the cursor fetches only
             * (Next / Previous / Page n -- the ones carrying @__cursor). Without it SQL Server caches ONE
             * plan per fetch shape, compiled for whichever cursor value arrived first. On vProjectLatest a
             * plan compiled for a cursor matching ~1 row (e.g. NextFilteredId = 0, or a page near the oldest
             * rows) is all nested loops, and every later Next with a typical cursor reuses it and times out
             * (90 s on localhost, for every user). See
             * documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md. First / Last and the count
             * query carry no cursor and are unchanged.
             */
            try
            {
                // =========================================================
                // VALIDATION
                // =========================================================

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

                // =========================================================
                // TABLE / VIEW / TVF SOURCE
                // =========================================================

                /*
                 * Example table:
                 *
                 * dbo.tPrograms
                 *
                 * becomes:
                 *
                 * [dbo].[tPrograms]
                 *
                 *
                 * Example TVF:
                 *
                 * dbo.fProgramProjects
                 *
                 * with:
                 *
                 * @ProgramId
                 * @StageId
                 *
                 * becomes:
                 *
                 * [dbo].[fProgramProjects](@ProgramId, @StageId)
                 */

                string safeSourceName =
                    SafeIdentifier(tableName);

                string safeSource =
                    BuildSource(
                        safeSourceName,
                        sourceParameters,
                        isTableValuedFunction);

                string safeKeyColumn =
                    SafeSingleIdentifier(
                        keyColumn);

                string keyExpression =
                    $"v.{safeKeyColumn}";

                // =========================================================
                // PAGINATION VALUES
                // =========================================================

                int limit =
                    dto.limit < 1
                        ? DefaultLimit
                        : Math.Min(
                            dto.limit,
                            MaxLimit);

                int requestedPage =
                    Math.Max(
                        dto.page,
                        1);

                // =========================================================
                // FILTERS
                // =========================================================

                List<(
                    string Clause,
                    string ParamName,
                    object? Value)> normalizedFilters =
                    filter
                        .Where(x =>
                            !string.IsNullOrWhiteSpace(
                                x.Clause))
                        .ToList();

                /*
                 * Validate filter parameters AND TVF parameters together.
                 *
                 * This prevents:
                 *
                 * filter: @ProgramId
                 * TVF:    @ProgramId
                 *
                 * from creating duplicate SqlParameter objects.
                 */
                FilterDataResult<T>? parameterValidation =
                    ValidateParameters<T>(
                        normalizedFilters,
                        sourceParameters);

                if (parameterValidation is not null)
                {
                    return parameterValidation;
                }

                List<string> basePredicates =
                    normalizedFilters
                        .Select(x =>
                            $"({x.Clause})")
                        .ToList();

                // =========================================================
                // TOTAL COUNT
                // =========================================================

                /*
                 * Last requires total count even when includeTotal=false,
                 * because we need to determine the final page size.
                 */
                bool countRequired =
                    includeTotal ||
                    dto.Navigation ==
                        PaginationNavigation.Last;

                long total = 0;
                int totalPages = 0;

                if (countRequired)
                {
                    /*
                     * IMPORTANT:
                     *
                     * sourceParameters MUST also be sent here.
                     *
                     * Otherwise:
                     *
                     * FROM
                     * [dbo].[fProgramProjects](
                     *     @ProgramId,
                     *     @StageId
                     * )
                     *
                     * will fail with:
                     *
                     * Must declare scalar variable "@ProgramId"
                     */
                    (total, totalPages) =
                        await GetTotalAsync(
                            db,
                            safeSource,
                            basePredicates,
                            normalizedFilters,
                            sourceParameters,
                            limit,
                            ct);
                }

                // =========================================================
                // LAST PAGE
                // =========================================================

                if (dto.Navigation ==
                    PaginationNavigation.Last)
                {
                    requestedPage =
                        totalPages > 0
                            ? totalPages
                            : 1;
                }

                // =========================================================
                // PAGE VALIDATION
                // =========================================================

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

                // =========================================================
                // EMPTY RESULT
                // =========================================================

                if (countRequired &&
                    total == 0)
                {
                    return new FilterDataResult<T>
                    {
                        HasError = false,

                        ErrorMessage = null,

                        Data = new FilteredResult<T>
                        {
                            lists =
                                new List<T>(),

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

                // =========================================================
                // NAVIGATION
                // =========================================================

                long? cursorId = null;

                bool reverseRows = false;

                bool useProbeRow = true;

                int take =
                    limit + 1;

                string fetchDirection;

                string? cursorPredicate =
                    null;

                switch (dto.Navigation)
                {
                    // =====================================================
                    // FIRST
                    // =====================================================

                    case PaginationNavigation.First:
                        {
                            requestedPage = 1;

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    // =====================================================
                    // NEXT
                    // =====================================================

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
                                descending
                                    ? "<"
                                    : ">";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} " +
                                "@__cursor";

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    // =====================================================
                    // PREVIOUS
                    // =====================================================

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
                                descending
                                    ? ">"
                                    : "<";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} " +
                                "@__cursor";

                            /*
                             * Query opposite direction.
                             *
                             * Example normal display:
                             *
                             * 100
                             * 99
                             * 98
                             *
                             * Previous query:
                             *
                             * ORDER BY Id ASC
                             *
                             * then reverse rows afterward.
                             */
                            fetchDirection =
                                descending
                                    ? "ASC"
                                    : "DESC";

                            reverseRows = true;

                            break;
                        }

                    // =====================================================
                    // SPECIFIC PREVIOUSLY VISITED PAGE
                    // =====================================================

                    case PaginationNavigation.Page:
                        {
                            /*
                             * Page 1 does not need a PageCursorId.
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
                                    $"{nameof(dto.PageCursorId)} " +
                                    $"is required to open page " +
                                    $"{requestedPage}. " +
                                    "The page must have been visited " +
                                    "previously.");
                            }

                            cursorId =
                                dto.PageCursorId.Value;

                            /*
                             * PageCursorId is the FIRST record of the
                             * page, therefore include the cursor itself.
                             */
                            string comparisonOperator =
                                descending
                                    ? "<="
                                    : ">=";

                            cursorPredicate =
                                $"{keyExpression} " +
                                $"{comparisonOperator} " +
                                "@__cursor";

                            fetchDirection =
                                descending
                                    ? "DESC"
                                    : "ASC";

                            break;
                        }

                    // =====================================================
                    // LAST
                    // =====================================================

                    case PaginationNavigation.Last:
                        {
                            int lastPageSize =
                                GetLastPageSize(
                                    total,
                                    limit);

                            /*
                             * No probe required because total count tells
                             * us exactly how many rows belong to last page.
                             */
                            take =
                                lastPageSize;

                            useProbeRow =
                                false;

                            reverseRows =
                                true;

                            /*
                             * If normal order = DESC,
                             * retrieve from smallest Id upwards.
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

                // =========================================================
                // BUILD FETCH WHERE
                // =========================================================

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

                // =========================================================
                // FETCH SQL
                // =========================================================

                string fetchSql =
                    $"""
                    SELECT TOP (@__take)
                        v.*
                    FROM {safeSource} AS v
                    {fetchWhereSql}
                    ORDER BY {keyExpression} {fetchDirection}
                    """;

                if (recompileCursorQueries &&
                    cursorId.HasValue)
                {
                    fetchSql +=
                        Environment.NewLine +
                        "OPTION (RECOMPILE)";
                }

                // =========================================================
                // FETCH PARAMETERS
                // =========================================================

                List<SqlParameter> fetchParameters =
                    CreateFilterParameters(
                        normalizedFilters);

                /*
                 * Add:
                 *
                 * @ProgramId
                 * @StageId
                 *
                 * etc.
                 */
                AddSourceParameters(
                    fetchParameters,
                    sourceParameters);

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

                // =========================================================
                // EXECUTE FETCH
                // =========================================================

                List<T> rows =
                    await db.Set<T>()
                        .FromSqlRaw(
                            fetchSql,
                            fetchParameters.ToArray())
                        .AsNoTracking()
                        .ToListAsync(ct);

                // =========================================================
                // PROBE ROW
                // =========================================================

                bool hasDirectionalPage =
                    false;

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

                // =========================================================
                // PREVIOUS / LAST REVERSE
                // =========================================================

                if (reverseRows)
                {
                    rows.Reverse();
                }

                // =========================================================
                // STALE CURSOR CHECK
                // =========================================================

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

                // =========================================================
                // HAS PREVIOUS / HAS NEXT
                // =========================================================

                bool hasPrevious;
                bool hasNext;

                switch (dto.Navigation)
                {
                    case PaginationNavigation.First:
                        {
                            hasPrevious =
                                false;

                            hasNext =
                                hasDirectionalPage;

                            break;
                        }

                    case PaginationNavigation.Next:
                        {
                            hasPrevious =
                                rows.Count > 0;

                            hasNext =
                                hasDirectionalPage;

                            break;
                        }

                    case PaginationNavigation.Previous:
                        {
                            hasPrevious =
                                hasDirectionalPage;

                            hasNext =
                                rows.Count > 0;

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

                            hasNext =
                                false;

                            break;
                        }

                    default:
                        {
                            hasPrevious =
                                false;

                            hasNext =
                                false;

                            break;
                        }
                }

                // =========================================================
                // CURSOR IDS
                // =========================================================

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

                // =========================================================
                // RESPONSE
                // =========================================================

                return new FilterDataResult<T>
                {
                    HasError = false,

                    ErrorMessage = null,

                    Data = new FilteredResult<T>
                    {
                        lists =
                            rows,

                        page =
                            requestedPage,

                        limit =
                            limit,

                        total =
                            includeTotal
                                ? total
                                : null,

                        totalPages =
                            includeTotal
                                ? totalPages
                                : 0,

                        HasPrevious =
                            hasPrevious,

                        HasNext =
                            hasNext,

                        /*
                         * First row ID.
                         */
                        PreviousFilteredId =
                            hasPrevious
                                ? firstKey
                                : null,

                        /*
                         * Last row ID.
                         */
                        NextFilteredId =
                            hasNext
                                ? lastKey
                                : null,

                        /*
                         * Always return first row ID so frontend
                         * can remember this page.
                         */
                        PageCursorId =
                            firstKey
                    }
                };
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

        // =============================================================
        // TOTAL COUNT
        // =============================================================

        private static async Task<(
            long Total,
            int TotalPages)>
            GetTotalAsync(
                MYPSDbContext db,
                string safeSource,
                IReadOnlyCollection<string> basePredicates,
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filters,
                IEnumerable<(
                    string ParamName,
                    object? Value)>? sourceParameters,
                int limit,
                CancellationToken ct)
        {
            string countWhereSql =
                BuildWhereClause(
                    basePredicates);

            string countSql =
                $"""
                SELECT COUNT_BIG(*) AS TotalCount
                FROM {safeSource} AS v
                {countWhereSql}
                """;

            List<SqlParameter> countParameters =
                CreateFilterParameters(
                    filters);

            /*
             * THIS WAS MISSING IN YOUR CURRENT CODE.
             *
             * If safeSource is:
             *
             * [dbo].[fProgramProjects](
             *     @ProgramId,
             *     @StageId
             * )
             *
             * these parameters MUST be supplied here too.
             */
            AddSourceParameters(
                countParameters,
                sourceParameters);

            PaginationCount? countRow =
                await db
                    .Set<PaginationCount>()
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
                    : (
                        total +
                        limit -
                        1L
                    ) / limit;

            int totalPages =
                calculatedPages >
                int.MaxValue
                    ? int.MaxValue
                    : (int)calculatedPages;

            return (
                total,
                totalPages);
        }

        // =============================================================
        // LAST PAGE SIZE
        // =============================================================

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

        // =============================================================
        // BUILD WHERE
        // =============================================================

        private static string BuildWhereClause(
            IEnumerable<string> predicates)
        {
            List<string> validPredicates =
                predicates
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(x))
                    .ToList();

            if (validPredicates.Count == 0)
            {
                return string.Empty;
            }

            return
                "WHERE " +
                string.Join(
                    " AND ",
                    validPredicates);
        }

        // =============================================================
        // NORMAL FILTER PARAMETERS
        // =============================================================

        private static List<SqlParameter>
            CreateFilterParameters(
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filters)
        {
            return filters
                .Select(x =>
                    new SqlParameter(
                        NormalizeParameterName(
                            x.ParamName),

                        x.Value ??
                        DBNull.Value))
                .ToList();
        }

        // =============================================================
        // TVF PARAMETERS
        // =============================================================

        private static void AddSourceParameters(
            List<SqlParameter> sqlParameters,
            IEnumerable<(
                string ParamName,
                object? Value)>? sourceParameters)
        {
            if (sourceParameters is null)
            {
                return;
            }

            foreach (
                (
                    string ParamName,
                    object? Value
                ) sourceParameter
                in sourceParameters)
            {
                string parameterName =
                    NormalizeParameterName(
                        sourceParameter.ParamName);

                /*
                 * Prevent duplicate SqlParameter.
                 */
                bool alreadyExists =
                    sqlParameters.Any(x =>
                        string.Equals(
                            x.ParameterName,
                            parameterName,
                            StringComparison.OrdinalIgnoreCase));

                if (alreadyExists)
                {
                    throw new InvalidOperationException(
                        $"Duplicate SQL parameter: " +
                        $"'{parameterName}'.");
                }

                sqlParameters.Add(
                    new SqlParameter(
                        parameterName,
                        sourceParameter.Value ??
                        DBNull.Value));
            }
        }

        // =============================================================
        // PARAMETER NAME NORMALIZATION
        // =============================================================

        private static string NormalizeParameterName(
            string parameterName)
        {
            if (string.IsNullOrWhiteSpace(
                    parameterName))
            {
                throw new ArgumentException(
                    "SQL parameter name cannot be empty.");
            }

            string normalized =
                parameterName.StartsWith("@")
                    ? parameterName
                    : $"@{parameterName}";

            /*
             * Validate actual parameter name.
             *
             * Remove @ before matching because IdentifierRegex
             * intentionally doesn't allow @.
             */
            string identifier =
                normalized[1..];

            if (!IdentifierRegex.IsMatch(
                    identifier))
            {
                throw new ArgumentException(
                    $"Unsafe SQL parameter name: " +
                    $"'{parameterName}'.");
            }

            return normalized;
        }

        // =============================================================
        // PARAMETER VALIDATION
        // =============================================================

        private static FilterDataResult<T>?
            ValidateParameters<T>(
                IEnumerable<(
                    string Clause,
                    string ParamName,
                    object? Value)> filters,
                IEnumerable<(
                    string ParamName,
                    object? Value)>? sourceParameters)
        {
            List<string> parameterNames =
                new();

            // ---------------------------------------------------------
            // Filter parameters
            // ---------------------------------------------------------

            foreach (var filter in filters)
            {
                parameterNames.Add(
                    NormalizeParameterName(
                        filter.ParamName));
            }

            // ---------------------------------------------------------
            // TVF source parameters
            // ---------------------------------------------------------

            if (sourceParameters is not null)
            {
                foreach (
                    var parameter
                    in sourceParameters)
                {
                    parameterNames.Add(
                        NormalizeParameterName(
                            parameter.ParamName));
                }
            }

            // ---------------------------------------------------------
            // Reserved internal parameters
            // ---------------------------------------------------------

            string? reservedParameter =
                parameterNames.FirstOrDefault(
                    name =>
                        name.Equals(
                            "@__take",
                            StringComparison.OrdinalIgnoreCase) ||

                        name.Equals(
                            "@__cursor",
                            StringComparison.OrdinalIgnoreCase));

            if (reservedParameter is not null)
            {
                return Error<T>(
                    $"SQL parameter " +
                    $"'{reservedParameter}' is reserved " +
                    "for pagination.");
            }

            // ---------------------------------------------------------
            // Duplicate parameters
            // ---------------------------------------------------------

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
                    $"'{duplicateParameter}'.");
            }

            return null;
        }

        // =============================================================
        // TABLE / VIEW / TVF SOURCE BUILDER
        // =============================================================

        private static string BuildSource(
            string safeSourceName,
            IReadOnlyCollection<(
                string ParamName,
                object? Value)>? sourceParameters,
            bool isTableValuedFunction)
        {
            /*
             * Normal table/view:
             *
             * [dbo].[vProgramLatest]
             */
            if (!isTableValuedFunction)
            {
                return safeSourceName;
            }

            /*
             * Parameterless TVF:
             *
             * [dbo].[fSomething]()
             */
            if (sourceParameters is null ||
                sourceParameters.Count == 0)
            {
                return
                    $"{safeSourceName}()";
            }

            /*
             * Parameterized TVF:
             *
             * [dbo].[fProgramProjects](
             *     @ProgramId,
             *     @StageId
             * )
             */
            string parameters =
                string.Join(
                    ", ",
                    sourceParameters
                        .Select(x =>
                            NormalizeParameterName(
                                x.ParamName)));

            return
                $"{safeSourceName}({parameters})";
        }

        // =============================================================
        // IDENTIFIER VALIDATION
        // =============================================================

        private static string SafeIdentifier(
            string raw)
        {
            if (string.IsNullOrWhiteSpace(
                    raw))
            {
                throw new ArgumentException(
                    "Table, view or function name is required.");
            }

            string[] parts =
                raw.Split('.');

            if (parts.Length == 0 ||
                parts.Any(
                    string.IsNullOrWhiteSpace))
            {
                throw new ArgumentException(
                    $"Invalid SQL identifier: '{raw}'.");
            }

            foreach (string part in parts)
            {
                if (!IdentifierRegex.IsMatch(
                        part))
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
            if (string.IsNullOrWhiteSpace(
                    raw) ||
                !IdentifierRegex.IsMatch(raw))
            {
                throw new ArgumentException(
                    $"Unsafe SQL identifier: '{raw}'.");
            }

            return $"[{raw}]";
        }

        // =============================================================
        // CURSOR KEY
        // =============================================================

        private static long GetKeyValue<T>(
            T item,
            string keyColumn)
        {
            Func<object, object?> getter =
                KeyGetters.GetOrAdd(
                    (
                        typeof(T),
                        keyColumn
                    ),
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
                            .Lambda<
                                Func<object, object?>>(
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

        // =============================================================
        // ERROR
        // =============================================================

        private static FilterDataResult<T>
            Error<T>(
                string message)
        {
            return new FilterDataResult<T>
            {
                HasError = true,

                ErrorMessage =
                    message,

                Data =
                    new FilteredResult<T>()
            };
        }
    }
}