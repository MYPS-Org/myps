using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Settings.UserManagement;
using Xunit;

namespace MYPS.UnitTests;

public class UserManagementAuthorizationContractTests
{
    [Fact]
    public void EveryEndpointRequiresNormalAuthorization()
    {
        var actions = EndpointActions();
        Assert.Equal(25, actions.Count);
        Assert.All(actions, action => Assert.Null(action.GetCustomAttribute<AllowAnonymousAttribute>()));
    }

    [Fact]
    public void PermissionActionIdentityIsControllerAndActionName()
    {
        var endpointKeys = typeof(UserManagementController).Assembly.GetTypes()
            .Where(type => type.IsClass && !type.IsAbstract && type.Name.EndsWith("Controller", StringComparison.Ordinal))
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(method => method.GetCustomAttribute<HttpPostAttribute>() != null)
                .Select(method => $"{type.Name}\0{method.Name}"))
            .ToArray();

        Assert.Equal(endpointKeys.Length, endpointKeys.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.True(endpointKeys.Count(key => key.EndsWith("\0AddProject", StringComparison.OrdinalIgnoreCase)) >= 2);
    }

    private static List<MethodInfo> EndpointActions() => typeof(UserManagementController)
        .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
        .Where(method => method.GetCustomAttribute<HttpPostAttribute>() != null)
        .ToList();
}
