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

    /// <summary>
    /// The Program Type and Program Stage Name header filters travel with every section request,
    /// beside the category.
    /// </summary>
    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    [InlineData(typeof(DashboardRequestDTO), "ProgramType", typeof(int?))]
    [InlineData(typeof(DashboardRequestDTO), "StageName", typeof(string))]
    [InlineData(typeof(ShowDashboardProjectsDTO), "ProgramType", typeof(int?))]
    [InlineData(typeof(ShowDashboardProjectsDTO), "StageName", typeof(string))]
    public void RequestDtos_CarryTheProgramTypeAndStageFilters(Type dtoType, string propertyName, Type propertyType)
    {
        var property = dtoType.GetProperty(propertyName);

        Assert.NotNull(property);
        Assert.Equal(propertyType, property!.PropertyType);
    }

    /// <summary>A KPI detail lists its projects per program: the program rows and one program's page.</summary>
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    public void Programs_IsAnHttpPostAction()
    {
        var method = typeof(DashboardController).GetMethod(nameof(DashboardController.Programs));

        Assert.NotNull(method);
        Assert.NotNull(method!.GetCustomAttribute<HttpPostAttribute>());
    }

    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    [InlineData("ProgramPK")]
    [InlineData("Publication")]
    public void ProjectsFilter_NarrowsToOneProgramAndPublicationState(string propertyName)
    {
        var property = typeof(ShowDashboardProjectsFilterDTO).GetProperty(propertyName);

        Assert.NotNull(property);
        Assert.Equal(typeof(string), property!.PropertyType);
    }

    /// <summary>
    /// The breakdown box lists categories (beside the stage list the reconcile test sums), and the
    /// map's region tables sort on DPWH's region hierarchy.
    /// </summary>
    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    [InlineData(typeof(DashboardStatusesResponseDTO), "Categories")]
    [InlineData(typeof(DashboardStatusesResponseDTO), "Statuses")]
    [InlineData(typeof(DashboardRegionalBreakdownDTO), "Hierarchy")]
    public void BreakdownDtos_CarryCategoriesAndRegionHierarchy(Type dtoType, string propertyName)
    {
        Assert.NotNull(dtoType.GetProperty(propertyName));
    }

    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Dashboard")]
    public void FilterOptions_IsAnHttpPostAction()
    {
        var method = typeof(DashboardController).GetMethod(nameof(DashboardController.FilterOptions));

        Assert.NotNull(method);
        Assert.NotNull(method!.GetCustomAttribute<HttpPostAttribute>());
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
