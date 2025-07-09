namespace DBHelper.Models.Enums
{
    public class EnumPagination
    {
        public int limit { get; set; } = 10;
        public int page { get; set; } = 1;
        public sortDirectionList? sortDirection { get; set; } = sortDirectionList.DESC; //ASC//DESC
    }
    public enum sortDirectionList
    {
        ASC = 0,
        DESC = 1
    }
}
