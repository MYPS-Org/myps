using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Enums
{
    public class EnumPagination<T>
    {
        public required T Filters { get; set; }
        public int limit { get; set; } = 10;
        public int page { get; set; } = 1;
        public PaginationDirection Direction { get; set; } = PaginationDirection.Next;
        public long? PreviousFilteredId { get; set; }
        public long? NextFilteredId { get; set; }
    }
    public enum PaginationDirection
    {
        Next,
        Previous
    }
    public class PaginationPages
    {
        public int? PageNumber { get; set; }
        public long? PageStartId { get; set; }
    }
    public class FilterDataResult<T>
    {
        public bool HasError { get; set; }
        public string? ErrorMessage { get; set; }
        public FilteredResult<T> Data { get; set; } = new FilteredResult<T>();

        public FilterDataResult() { }

        public FilterDataResult(bool hasError, string? errorMessage, FilteredResult<T>? data)
        {
            HasError = hasError;
            ErrorMessage = errorMessage;
            Data = data ?? new FilteredResult<T>();
        }
    }
    public class ErrorResult
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
    public class FilteredResult<T>
    {
        public List<T> lists { get; set; } = new List<T>();
        public int page { get; set; }
        public int limit { get; set; }
        public long? total { get; set; }
        public int totalPages { get; set; }
    }
    public class PaginationCount
    {
        public long TotalCount { get; set; } = 0;
    }
    /*
     
     var response = new
                {
                    lists = permissionLists,
                    dto.page,
                    dto.limit,
                    total = totalRecords,
                    totalPages
                };
     */
}
