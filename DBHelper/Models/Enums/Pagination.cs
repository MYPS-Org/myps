using System.ComponentModel.DataAnnotations;

namespace DBHelper.Models.Enums
{
    public class EnumPagination<T>
    {
        public required T Filters { get; set; }
        public int limit { get; set; } = 10;
        public int page { get; set; } = 1;
        public string SortField { get; set; } = "Id";
        public sortDirectionList? sortDirection { get; set; } = sortDirectionList.DESC; //ASC//DESC
    }
    public enum sortDirectionList
    {
        ASC = 0,
        DESC = 1
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
        public int total { get; set; }
        public int totalPages { get; set; }
    }
}
