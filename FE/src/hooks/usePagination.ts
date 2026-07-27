import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePaginationOptions<TFilters> {
    initialFilters?: TFilters;
    limit?: number;
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
    applyFilters: (filters: TFilters) => void;
    refresh: () => void;
}

/**
 * Shared pagination hook that speaks the backend's keyset-augmented pagination contract.
 *
 * - Numbered page jumps (First, Last, page buttons) use plain page/limit — no Direction or cursors.
 * - Next/Previous use Direction + the cursor ids from the LAST response (stored in a ref so
 *   cursor updates never trigger re-renders).
 * - applyFilters() MUST clear the cursor ref before changing filter state, or stale keyset
 *   cursors from the old filter set would make the BE return incorrect rows.
 *
 * @param fetchFn  The page's own service function. Injected so the hook is endpoint-agnostic.
 * @param options  initialFilters (applied on mount) and limit (default 10).
 */
export function usePagination<TFilters, TItem>(
    fetchFn: (params: PaginatedRequest<TFilters>) => Promise<{ Data: PaginationResponse<TItem> }>,
    options: UsePaginationOptions<TFilters> = {}
): UsePaginationReturn<TFilters, TItem> {
    const { initialFilters, limit = 10 } = options;

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

    // Core fetch — sets loading state, updates data + cursor ref, logs errors without toasting
    // (the httpClient interceptor already shows error toasts; adding a manual one here duplicates it).
    const fetchData = useCallback(async (params: PaginatedRequest<TFilters>) => {
        setIsLoading(true);
        try {
            const response = await fetchFn(params);
            setData(response.Data);
            cursorRef.current = {
                previous: response.Data.PreviousFilteredId ?? null,
                next: response.Data.NextFilteredId ?? null,
            };
        } catch (error) {
            console.error('Error fetching paginated data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn]);

    // Fetch on mount with initialFilters at page 1 — no Direction or keyset cursors.
    // Empty deps array is intentional: this effect should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchData({ Filters: initialFilters, limit, page: 1 });
    }, []);

    /** Plain page-jump — no Direction or cursor fields sent. */
    const goToPage = useCallback((page: number) => {
        fetchData({ Filters: currentFilters, limit, page });
    }, [fetchData, currentFilters, limit]);

    /** Keyset next-page navigation — sends Direction: 1 and the next cursor from the last response. */
    const goNext = useCallback(() => {
        fetchData({
            Filters: currentFilters,
            limit,
            page: data.page + 1,
            Direction: 1,
            NextFilteredId: cursorRef.current.next,
        });
    }, [fetchData, currentFilters, limit, data.page]);

    /** Keyset previous-page navigation — sends Direction: 2 and the previous cursor from the last response. */
    const goPrevious = useCallback(() => {
        fetchData({
            Filters: currentFilters,
            limit,
            page: data.page - 1,
            Direction: 2,
            PreviousFilteredId: cursorRef.current.previous,
        });
    }, [fetchData, currentFilters, limit, data.page]);

    /**
     * Apply a new filter set, resetting to page 1.
     * CRITICAL: clears the cursor ref first — stale keyset cursors from the old filter set
     * would make the BE's keyset lookup return rows from the wrong set.
     */
    const applyFilters = useCallback((filters: TFilters) => {
        cursorRef.current = { previous: null, next: null };
        setCurrentFilters(filters);
        fetchData({ Filters: filters, limit, page: 1 });
    }, [fetchData, limit]);

    /** Re-fetch the current page/filters without cursors — safe to call after a delete. */
    const refresh = useCallback(() => {
        fetchData({ Filters: currentFilters, limit, page: data.page });
    }, [fetchData, currentFilters, limit, data.page]);

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
        applyFilters,
        refresh,
    };
}
