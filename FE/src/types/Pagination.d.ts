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
}

interface PaginatedRequest<TFilters> {
    Filters?: TFilters;
    limit: number;
    page: number;
    SortField?: string;
    sortDirection?: 0 | 1; // 0 for ascending, 1 for descending — matches EnumPagination<T>.sortDirection
    Direction?: 1 | 2; // 1 = Next, 2 = Previous — keyset navigation only, omitted for page-jump
    PreviousFilteredId?: number | null;
    NextFilteredId?: number | null;
}