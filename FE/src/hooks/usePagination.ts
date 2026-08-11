import { useState, useRef, useCallback, useEffect } from 'react';

// Matches DBHelper.Models.Enums.PaginationNavigation (BE serializes enums as ints).
const Nav = {
    First: 0,
    Previous: 1,
    Next: 2,
    Last: 3,
    Page: 4,
} as const;

interface UsePaginationOptions<TFilters> {
    initialFilters?: TFilters;
    limit?: number;
    /** Static sort passed on every request. No column-sort UI wires this yet — set once at hook init. */
    sortField?: string;
    sortDirection?: 0 | 1;
    /**
     * Gates the initial mount fetch. Default true (fires immediately on mount, matching prior
     * behavior). Pass false when fetchFn depends on data that isn't ready yet (e.g. an id from
     * a parent record still loading) — the hook fires the initial fetch once this flips to true.
     */
    enabled?: boolean;
}

interface UsePaginationReturn<TFilters, TItem> {
    data: PaginationResponse<TItem>;
    isLoading: boolean;
    hasPrevious: boolean;
    hasNext: boolean;
    currentFilters: TFilters | undefined;
    goToPage: (page: number) => void;
    goNext: () => void;
    goPrevious: () => void;
    goFirst: () => void;
    goLast: () => void;
    /** Whether `page`'s cursor is already cached — an already-visited page jumps in one request; an
     *  unvisited one still works via goToPage, it just walks there hop-by-hop first (see walkToPage). */
    isPageVisited: (page: number) => boolean;
    applyFilters: (filters: TFilters) => void;
    refresh: () => void;
}

/**
 * Shared pagination hook that speaks the backend's keyset pagination contract
 * (DBHelper.Models.Enums.EnumPagination / Helpers.QueryPaginationExtensions.FilterDataCursor).
 *
 * The BE has no OFFSET-style random access. Every request carries a `Navigation` enum value:
 *   - First: always returns page 1, no cursor needed.
 *   - Next / Previous: walk from the PREVIOUS response's NextFilteredId / PreviousFilteredId.
 *   - Last: computed directly from the total count, no cursor needed.
 *   - Page: requires the PageCursorId of a page that was already visited this session — the BE
 *     errors ("must have been visited previously") for any page it can't resolve a cursor for.
 *
 * This hook tracks a page-number -> PageCursorId map (`pageCursorsRef`) built up as pages are
 * visited (every response includes the first row id of the page it returned), so re-visiting a
 * page is a single request. For a page that has NOT been visited yet — e.g. clicking "page 5"
 * from a cold page-1 load, which the BE genuinely cannot jump to directly — goToPage silently
 * chains Next/Previous hops (walkToPage) until it lands on the target, caching every hop's cursor
 * along the way. Only the final hop's result is rendered, so it looks like one jump to the caller.
 */
export function usePagination<TFilters, TItem>(
    fetchFn: (params: PaginatedRequest<TFilters>) => Promise<{ Data: PaginationResponse<TItem> }>,
    options: UsePaginationOptions<TFilters> = {}
): UsePaginationReturn<TFilters, TItem> {
    const { initialFilters, limit = 10, sortField, sortDirection, enabled = true } = options;
    const sortParams = { SortField: sortField, sortDirection };

    const [data, setData] = useState<PaginationResponse<TItem>>({
        lists: [],
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<TFilters | undefined>(initialFilters);

    // Cursor ids from the last response. Stored in a ref so updates don't trigger re-renders;
    // they are only read on the next Next / Previous call.
    const cursorRef = useRef<{ previous: number | null; next: number | null }>({
        previous: null,
        next: null,
    });

    // Page-number -> PageCursorId (first row id of that page). Read on demand by goToPage/refresh;
    // kept in a ref so it doesn't trigger re-renders on its own.
    const pageCursorsRef = useRef<Map<number, number>>(new Map());

    // Mirrors pageCursorsRef's key set, but as state, so components (e.g. PaginationBar) can react
    // to a page becoming instantly-jumpable.
    const [visitedPages, setVisitedPages] = useState<Set<number>>(new Set([1]));

    // Records a response's cursors/PageCursorId (used by every fetch, including the silent
    // intermediate hops in walkToPage) without necessarily committing it as the displayed page.
    const recordResponse = useCallback((response: { Data: PaginationResponse<TItem> }) => {
        cursorRef.current = {
            previous: response.Data.PreviousFilteredId ?? null,
            next: response.Data.NextFilteredId ?? null,
        };
        if (response.Data.PageCursorId != null) {
            const page = response.Data.page;
            pageCursorsRef.current.set(page, response.Data.PageCursorId);
            setVisitedPages((prev) => (prev.has(page) ? prev : new Set(prev).add(page)));
        }
    }, []);

    // Core fetch — sets loading state, updates data + cursor refs, logs errors without toasting
    // (the httpClient interceptor already shows error toasts; adding a manual one here duplicates it).
    const fetchData = useCallback(async (params: PaginatedRequest<TFilters>) => {
        setIsLoading(true);
        try {
            const response = await fetchFn(params);
            setData(response.Data);
            recordResponse(response);
        } catch (error) {
            console.error('Error fetching paginated data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, recordResponse]);

    // Fetch on mount (or once `enabled` flips true) with initialFilters at page 1 — Navigation.First,
    // no cursors. Deps intentionally omit initialFilters/limit/sortParams: this should only run once,
    // either on mount or when `enabled` becomes true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!enabled) return;
        fetchData({ Filters: initialFilters, limit, page: 1, Navigation: Nav.First, ...sortParams });
    }, [enabled]);

    /**
     * Walks from the current page to `targetPage` one keyset hop at a time (Next if forward,
     * Previous if backward), silently — intermediate hops aren't rendered, only the last one is.
     * This is what lets a numbered-page click work even on a page the BE has never given us a
     * cursor for (e.g. clicking "page 5" right after a cold page-1 load).
     */
    const walkToPage = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        try {
            const direction: 'next' | 'previous' = targetPage > data.page ? 'next' : 'previous';
            let fromPage = data.page;
            let cursor = direction === 'next' ? cursorRef.current.next : cursorRef.current.previous;
            let response: { Data: PaginationResponse<TItem> } | undefined;

            while (fromPage !== targetPage) {
                // Ran out of cursor before reaching the target (e.g. stale totalPages) — bail
                // with whatever the last successful hop landed on.
                if (cursor == null) break;

                fromPage = direction === 'next' ? fromPage + 1 : fromPage - 1;
                const params: PaginatedRequest<TFilters> =
                    direction === 'next'
                        ? { Filters: currentFilters, limit, page: fromPage, Navigation: Nav.Next, NextFilteredId: cursor, ...sortParams }
                        : { Filters: currentFilters, limit, page: fromPage, Navigation: Nav.Previous, PreviousFilteredId: cursor, ...sortParams };

                response = await fetchFn(params);
                recordResponse(response);
                cursor = direction === 'next' ? response.Data.NextFilteredId ?? null : response.Data.PreviousFilteredId ?? null;
            }

            if (response) {
                setData(response.Data);
            }
        } catch (error) {
            console.error('Error paging to page:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, currentFilters, limit, data.page, sortField, sortDirection, recordResponse]);

    /** Numbered page-jump. One request if `page` was already visited, otherwise walks there — see walkToPage. */
    const goToPage = useCallback((page: number) => {
        if (page === data.page || isLoading) return;
        if (page === 1) {
            fetchData({ Filters: currentFilters, limit, page: 1, Navigation: Nav.First, ...sortParams });
            return;
        }
        const pageCursorId = pageCursorsRef.current.get(page);
        if (pageCursorId !== undefined) {
            fetchData({ Filters: currentFilters, limit, page, Navigation: Nav.Page, PageCursorId: pageCursorId, ...sortParams });
            return;
        }
        walkToPage(page);
    }, [fetchData, walkToPage, currentFilters, limit, data.page, isLoading, sortField, sortDirection]);

    /** Keyset next-page navigation — sends Navigation: Next + the next cursor from the last response. */
    const goNext = useCallback(() => {
        if (isLoading) return;
        fetchData({
            Filters: currentFilters,
            limit,
            page: data.page + 1,
            ...sortParams,
            Navigation: Nav.Next,
            NextFilteredId: cursorRef.current.next,
        });
    }, [fetchData, currentFilters, limit, data.page, isLoading, sortField, sortDirection]);

    /** Keyset previous-page navigation — sends Navigation: Previous + the previous cursor from the last response. */
    const goPrevious = useCallback(() => {
        if (isLoading) return;
        fetchData({
            Filters: currentFilters,
            limit,
            page: data.page - 1,
            ...sortParams,
            Navigation: Nav.Previous,
            PreviousFilteredId: cursorRef.current.previous,
        });
    }, [fetchData, currentFilters, limit, data.page, isLoading, sortField, sortDirection]);

    /** Jump straight to page 1 — one-shot, no cursor needed. */
    const goFirst = useCallback(() => {
        if (isLoading) return;
        fetchData({ Filters: currentFilters, limit, page: 1, Navigation: Nav.First, ...sortParams });
    }, [fetchData, currentFilters, limit, isLoading, sortField, sortDirection]);

    /** Jump straight to the last page — one-shot (BE derives it from the total count), no cursor needed. */
    const goLast = useCallback(() => {
        if (isLoading) return;
        fetchData({ Filters: currentFilters, limit, page: data.totalPages, Navigation: Nav.Last, ...sortParams });
    }, [fetchData, currentFilters, limit, data.totalPages, isLoading, sortField, sortDirection]);

    /**
     * Apply a new filter set, resetting to page 1.
     * CRITICAL: clears the cursor refs first — stale keyset cursors from the old filter set
     * would make the BE's keyset lookup return rows from the wrong set.
     */
    const applyFilters = useCallback((filters: TFilters) => {
        cursorRef.current = { previous: null, next: null };
        pageCursorsRef.current = new Map();
        setVisitedPages(new Set([1]));
        setCurrentFilters(filters);
        fetchData({ Filters: filters, limit, page: 1, Navigation: Nav.First, ...sortParams });
    }, [fetchData, limit, sortField, sortDirection]);

    /** Re-fetch the current page/filters — safe to call after a delete. Uses the cached cursor for the current page. */
    const refresh = useCallback(() => {
        if (data.page === 1) {
            fetchData({ Filters: currentFilters, limit, page: 1, Navigation: Nav.First, ...sortParams });
            return;
        }
        const pageCursorId = pageCursorsRef.current.get(data.page);
        fetchData({
            Filters: currentFilters,
            limit,
            page: data.page,
            ...sortParams,
            Navigation: Nav.Page,
            PageCursorId: pageCursorId,
        });
    }, [fetchData, currentFilters, limit, data.page, sortField, sortDirection]);

    const isPageVisited = useCallback(
        (page: number) => page === 1 || visitedPages.has(page),
        [visitedPages]
    );

    // Degrade gracefully when the BE response omits the new keyset fields (un-migrated pages).
    const hasPrevious = data.HasPrevious ?? data.page > 1;
    const hasNext = data.HasNext ?? data.page < data.totalPages;

    return {
        data,
        isLoading,
        hasPrevious,
        hasNext,
        currentFilters,
        goToPage,
        goNext,
        goPrevious,
        goFirst,
        goLast,
        isPageVisited,
        applyFilters,
        refresh,
    };
}
