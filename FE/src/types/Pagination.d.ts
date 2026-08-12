interface PaginationParams {
    page: number;
    limit: number;
    sortDirection?: 0 | 1; // 0 for ascending, 1 for descending
}

interface PaginationResponse<T> {
    lists: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    PreviousFilteredId?: number | null;
    NextFilteredId?: number | null;
    HasPrevious?: boolean;
    HasNext?: boolean;
    // First row id of the returned page. Always present so the FE can remember this page
    // and jump back to it later via Navigation: Page.
    PageCursorId?: number | null;
}

// Matches DBHelper.Models.Enums.PaginationNavigation. The BE's pagination is purely
// keyset-based: First/Last are one-shot, Next/Previous walk from the last response's
// cursors, and Page requires the PageCursorId of a page that was already visited
// (there is no OFFSET-style arbitrary jump).
type PaginationNavigationValue = 0 | 1 | 2 | 3 | 4; // First | Previous | Next | Last | Page

interface PaginatedRequest<TFilters> {
    Filters?: TFilters;
    limit: number;
    page: number;
    SortField?: string;
    sortDirection?: 0 | 1; // 0 for ascending, 1 for descending — matches EnumPagination<T>.sortDirection
    Navigation?: PaginationNavigationValue;
    PreviousFilteredId?: number | null;
    NextFilteredId?: number | null;
    PageCursorId?: number | null;
}