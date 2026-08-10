//using System.Reflection;
//using System.Runtime.Serialization;

//public static class EnumExtensions
//{
//    public static string GetValue<T>(this T value)
//        where T : Enum
//    {
//        var member = typeof(T)
//            .GetMember(value.ToString())
//            .FirstOrDefault();

//        var attribute = member?
//            .GetCustomAttribute<EnumMemberAttribute>();

//        return attribute?.Value
//            ?? value.ToString();
//    }
//}