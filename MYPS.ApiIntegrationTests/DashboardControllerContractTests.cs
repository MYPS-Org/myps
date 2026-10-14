using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Dashboard;
using Xunit;

namespace MYPS.ApiIntegrationTests;

public sealed class DashboardControllerContractTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    public void Categories_IsAnHttpPostAction()
    {
        var method = typeof(DashboardController).GetMethod(nameof(DashboardController.Categories));

        Assert.NotNull(method);
        Assert.NotNull(method!.GetCustomAttribute<HttpPostAttribute>());
    }

    /// <summary>
    /// The Live Audit Feed was removed from the dashboard (QA could not tell what it was for), and
    /// its endpoint with it. Nothing else called it.
    /// </summary>
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    public void Activities_EndpointNoLongerExists()
    {
        Assert.Null(typeof(DashboardController).GetMethod("Activities"));
    }

    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    [InlineData(typeof(DashboardRequestDTO))]
    [InlineData(typeof(ShowDashboardProjectsDTO))]
    public void RequestDtos_CarryAnOptionalCategoryId(Type dtoType)
    {
        var property = dtoType.GetProperty("CategoryId");

        Assert.NotNull(property);
        Assert.Equal(typeof(int?), property!.PropertyType);
    }

    /// <summary>The picker labels retired categories, so the list item carries the flag.</summary>
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    public void CategoryOption_CarriesItsActiveFlag()
    {
        var property = typeof(DashboardCategoryDTO).GetProperty(nameof(DashboardCategoryDTO.IsActive));

        Assert.NotNull(property);
        Assert.Equal(typeof(bool), property!.PropertyType);
    }
}
