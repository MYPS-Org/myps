using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Projects;
using Xunit;

namespace MYPS.ApiIntegrationTests;

// Characterization tests for ProjectController.AddProject's ProjectIdRangeExhaustedException
// handling (RISK-072 follow-up, 2026-09-08). No live HTTP call is made here -- this codebase has no
// existing pattern for authenticated end-to-end HTTP testing (checked RevisionControllerContractTests
// and ProgramControllerPublishRestrictionContractTests: both rely on reflection and source-text
// assertions, never a real request, for every controller they cover). These tests match that same
// established assurance level: a regression guard that fails immediately if the specific catch
// clause, its ordering ahead of the generic handler, or its response shape ever changes.
public sealed class ProjectControllerAddProjectContractTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Project")]
    public void AddProject_RemainsHttpPost()
    {
        Assert.NotNull(GetPublicAction(nameof(ProjectController.AddProject))
            .GetCustomAttribute<HttpPostAttribute>());
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void AddProject_CatchesProjectIdRangeExhaustedExceptionBeforeGenericHandler()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Projects", "ProjectController.cs");
        string method = ExtractMethod(source, "AddProject");

        int specificCatch = method.IndexOf("catch (ProjectIdRangeExhaustedException ex)", StringComparison.Ordinal);
        int genericCatch = method.IndexOf("catch (Exception ex)", StringComparison.Ordinal);

        Assert.True(specificCatch > 0, "AddProject no longer catches ProjectIdRangeExhaustedException.");
        Assert.True(genericCatch > 0, "AddProject no longer has its generic catch handler.");
        Assert.True(specificCatch < genericCatch,
            "ProjectIdRangeExhaustedException must be caught before the generic Exception handler, " +
            "or the specific catch is unreachable dead code.");
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void AddProject_ReturnsProjectIdRangeExhaustedTitleAndMessage()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Projects", "ProjectController.cs");
        string method = ExtractMethod(source, "AddProject");

        Assert.Contains("catch (ProjectIdRangeExhaustedException ex)", method, StringComparison.Ordinal);
        Assert.Contains("await transaction.RollbackAsync(cancellationToken);", method, StringComparison.Ordinal);
        Assert.Contains("Title = \"Project ID Range Exhausted\"", method, StringComparison.Ordinal);
        Assert.Contains("Message = ex.Message", method, StringComparison.Ordinal);
    }

    private static MethodInfo GetPublicAction(string actionName)
    {
        return typeof(ProjectController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(method => method.Name == actionName);
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

        throw new FileNotFoundException(
            $"Could not locate source file: {Path.Combine(pathParts)}");
    }

    private static string ExtractMethod(string source, string methodName)
    {
        int signatureStart = source.IndexOf(
            $"Task<IActionResult> {methodName}",
            StringComparison.Ordinal);

        Assert.True(signatureStart >= 0, $"Could not find {methodName}.");

        int bodyStart = source.IndexOf('{', signatureStart);
        Assert.True(bodyStart >= 0, $"Could not find {methodName} body.");

        int depth = 0;
        for (int index = bodyStart; index < source.Length; index++)
        {
            if (source[index] == '{')
            {
                depth++;
            }
            else if (source[index] == '}')
            {
                depth--;
                if (depth == 0)
                {
                    return source.Substring(signatureStart, index - signatureStart + 1);
                }
            }
        }

        throw new InvalidOperationException($"Could not extract {methodName}.");
    }
}
