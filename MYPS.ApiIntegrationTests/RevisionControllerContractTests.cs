using DBHelper.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Revision;
using Xunit;

namespace MYPS.ApiIntegrationTests;

public sealed class RevisionControllerContractTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Revision")]
    public void RevisionController_UsesExpectedActionRouteTemplate()
    {
        var route = typeof(RevisionController).GetCustomAttribute<RouteAttribute>();

        Assert.NotNull(route);
        Assert.Equal("api/[controller]/[action]", route!.Template);
    }

    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Revision")]
    [InlineData(nameof(RevisionController.RevisionRequests))]
    [InlineData(nameof(RevisionController.RequestRevision))]
    [InlineData(nameof(RevisionController.UpdateRevisionStatus))]
    [InlineData(nameof(RevisionController.ResubmitRevision))]
    public void RevisionWorkflowActions_RemainHttpPostAndAllowAnonymous(string actionName)
    {
        var method = GetPublicAction(actionName);

        Assert.NotNull(method.GetCustomAttribute<HttpPostAttribute>());
        Assert.NotNull(method.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionStatusEnum_MatchesConfirmedWorkflowValues()
    {
        Assert.Equal(0, (int)EnumRevisionStatus.Pending);
        Assert.Equal(1, (int)EnumRevisionStatus.Approved);
        Assert.Equal(2, (int)EnumRevisionStatus.Rejected);
        Assert.Equal(3, (int)EnumRevisionStatus.ForCorrection);
    }

    private static MethodInfo GetPublicAction(string actionName)
    {
        return typeof(RevisionController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(method => method.Name == actionName);
    }
}
