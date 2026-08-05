using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Enums
{
    public class EnumPagination<T>
    {
        [Required]
        public required T Filters { get; set; }
        // DefaultValue is documentation only — it mirrors the C# initializer so
        // Swagger's generated request body is runnable as-is instead of sending
        // limit/page of 0.
        [Required]
        [DefaultValue(10)]
        public int limit { get; set; } = 10;

        // The page currently displayed by the client.
        // The server increments/decrements it according to Direction.
        [Required]
        [DefaultValue(1)]
        public int page { get; set; } = 1;
        [Required]
        public PaginationDirection Direction { get; set; } = PaginationDirection.Next;

        // First key of the current page. Used when Direction = Previous.
        public long? PreviousFilteredId { get; set; }

        // Last key of the current page. Used when Direction = Next.
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
        public FilteredResult<T> Data { get; set; } = new();

        public FilterDataResult() { }

        public FilterDataResult(
            bool hasError,
            string? errorMessage,
            FilteredResult<T>? data)
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
        public List<T> lists { get; set; } = new();
        public int page { get; set; }
        public int limit { get; set; }
        public long? total { get; set; }
        public int totalPages { get; set; }

        // Returned cursors for the page in lists.
        public long? PreviousFilteredId { get; set; }
        public long? NextFilteredId { get; set; }
        public bool HasPrevious { get; set; }
        public bool HasNext { get; set; }
    }

    // Configure this as a keyless EF Core entity:
    // modelBuilder.Entity<PaginationCount>().HasNoKey();
    public class PaginationCount
    {
        public long TotalCount { get; set; }
    }
}