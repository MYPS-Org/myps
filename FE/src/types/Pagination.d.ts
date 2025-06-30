export interface PaginationParams {
    page: number;
    limit: number;
    sortDirection?: 0 | 1; // 0 for ascending, 1 for descending
}
export interface PaginationResponse<T> {
    lists: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}