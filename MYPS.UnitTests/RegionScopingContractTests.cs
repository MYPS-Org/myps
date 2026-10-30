using DBHelper.Models.Views;
using Helpers;
using Xunit;

namespace MYPS.UnitTests;

// 2026-10-30: Project Groups, Global Search, Project > SearchProgram and Importing applied no region
// scoping, so an Apply Filter user could read, group or export another region's records by Id. These
// pin each endpoint to the existing visibility helper it now goes through (the source-text pattern of
// MYPS.ApiIntegrationTests' contract tests: there is no DB-free way to run the queries themselves).
public sealed class RegionScopingContractTests
{
    [Theory]
    [InlineData(false, null, true)]
    [InlineData(false, "OI99", true)]
    [InlineData(true, "OI234", true)]
    [InlineData(true, "OI19", false)]
    [InlineData(true, null, false)]
    public void CanAccessProgram_RestrictsOnlyApplyFilterUsersToTheirRegion(bool applyFilter, string? regCode, bool expected)
    {
        var session = new Users { ApplyFilter = applyFilter, RegCode = regCode };

        Assert.Equal(expected, session.CanAccessProgram(new[] { "OI10", "OI234" }));
    }

    [Theory]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "Task<IActionResult> SearchProject(", "GetViewableStagesAsync(_Session")]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "> ResolveProjectIdsAsync(", "GetViewableStagesByProjectAsync(")]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "Task<IActionResult> AddProject(", "ResolveProjectIdsAsync(")]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "Task<IActionResult> DeleteProject(", "ResolveProjectIdsAsync(")]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "Task<IActionResult> ProjectGroupDetails(", "GetViewableStagesByProjectAsync(")]
    [InlineData("WebAPI/Controllers/ProjectGroups/ProjectGroupController.cs", "Task<IActionResult> ShowProjectGroups(", "GetViewableStagesByProjectAsync(")]
    [InlineData("WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs", "Task<List<ProjectStageKey>> KeepViewableStagesAsync(", "GetViewableStagesByProjectAsync(")]
    [InlineData("WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs", "Task<IActionResult> Search(", "GetAccessibleProgramPKsAsync(")]
    [InlineData("WebAPI/Controllers/GlobalSearch/GlobalSearchController.cs", "Task<IActionResult> Search(", "KeepViewableProjectRowsAsync(")]
    [InlineData("WebAPI/Controllers/Projects/ProjectController.cs", "Task<IActionResult> SearchProgram(", "GetAccessibleProgramPKsAsync(")]
    [InlineData("WebAPI/Controllers/Importing/ImportingController.cs", "Task<IActionResult?> RefuseProgramOutsideScopeAsync(", "ValidateProgramId(")]
    [InlineData("WebAPI/Controllers/Importing/ImportingController.cs", "Task<IActionResult> ImportProject(", "RefuseProgramOutsideScopeAsync(")]
    [InlineData("WebAPI/Controllers/Importing/ImportingController.cs", "Task<IActionResult> UpdateProject(", "RefuseProgramOutsideScopeAsync(")]
    [InlineData("WebAPI/Controllers/Importing/ImportingController.cs", "Task<IActionResult> ExportProjects(", "RefuseProgramOutsideScopeAsync(")]
    public void Endpoint_GoesThroughTheVisibilityHelper(string file, string signature, string helperCall)
    {
        string body = ExtractBody(ReadSourceFile(file.Split('/')), signature);

        Assert.Contains(helperCall, body, StringComparison.Ordinal);
    }

    [Fact]
    public void GlobalSearch_EveryProjectStageCategoryIsFiltered()
    {
        string body = ExtractBody(ReadSourceFile("WebAPI", "Controllers", "GlobalSearch", "GlobalSearchController.cs"), "Task<IActionResult> Search(");

        // Alternate ID, Description and Project ID each build their fProjectDetails filter from the gate.
        Assert.Equal(3, CountOf(body, "await KeepViewableStagesAsync("));
        Assert.Equal(3, CountOf(body, "from revision in _db.tProjectRevisions"));
    }

    [Fact]
    public void ImportProject_RefusesBeforeTakingTheImportLock()
    {
        string body = ExtractBody(ReadSourceFile("WebAPI", "Controllers", "Importing", "ImportingController.cs"), "Task<IActionResult> ImportProject(");

        Assert.True(
            body.IndexOf("RefuseProgramOutsideScopeAsync(", StringComparison.Ordinal) < body.IndexOf("UPDATE dbo.tImportingStatus", StringComparison.Ordinal),
            "ImportProject must check the program before it takes tImportingStatus' lock.");
    }

    private static string ReadSourceFile(params string[] pathParts)
    {
        DirectoryInfo? directory = new(AppContext.BaseDirectory);
        while (directory is not null)
        {
            string candidate = Path.Combine(new[] { directory.FullName }.Concat(pathParts).ToArray());
            if (File.Exists(candidate))
            {
                return File.ReadAllText(candidate);
            }
            directory = directory.Parent;
        }
        throw new FileNotFoundException($"Could not locate source file: {Path.Combine(pathParts)}");
    }

    private static string ExtractBody(string source, string signature)
    {
        int signatureStart = source.IndexOf(signature, StringComparison.Ordinal);
        Assert.True(signatureStart >= 0, $"Could not find {signature}.");

        int bodyStart = source.IndexOf('{', signatureStart);
        int depth = 0;
        for (int index = bodyStart; index < source.Length; index++)
        {
            if (source[index] == '{')
            {
                depth++;
            }
            else if (source[index] == '}' && --depth == 0)
            {
                return source.Substring(bodyStart, index - bodyStart + 1);
            }
        }
        throw new InvalidOperationException($"Unbalanced braces after {signature}.");
    }

    private static int CountOf(string text, string value)
    {
        int count = 0;
        for (int at = text.IndexOf(value, StringComparison.Ordinal); at >= 0; at = text.IndexOf(value, at + value.Length, StringComparison.Ordinal))
        {
            count++;
        }
        return count;
    }
}
