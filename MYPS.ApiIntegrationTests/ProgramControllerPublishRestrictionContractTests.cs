using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Programs;
using Xunit;

namespace MYPS.ApiIntegrationTests;

public sealed class ProgramControllerPublishRestrictionContractTests
{
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchPublishRestrictionActions_RemainHttpPost()
    {
        Assert.NotNull(GetPublicAction(nameof(ProgramController.BatchRestrictPublish))
            .GetCustomAttribute<HttpPostAttribute>());
        Assert.NotNull(GetPublicAction(nameof(ProgramController.BatchAllowPublish))
            .GetCustomAttribute<HttpPostAttribute>());
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchRestrictPublish_ScopesProjectLookupToValidatedProgramAndStage()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchRestrictPublish");

        Assert.Contains("x.ProgramId == dto.ProgramId", method, StringComparison.Ordinal);
        Assert.Contains("x.StageName == programDetails.StageName", method, StringComparison.Ordinal);
        Assert.Contains("requestedProjectIds.Contains(x.ProjectId)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAllowPublish_ScopesProjectLookupToValidatedProgramAndStage()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAllowPublish");

        Assert.Contains("revision.ProgramId == dto.ProgramId", method, StringComparison.Ordinal);
        Assert.Contains("revision.StageName == programDetails.StageName", method, StringComparison.Ordinal);
        Assert.Contains("requestedProjectIds.Contains(revision.ProjectId)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAllowPublish_GrantsPublishingWithoutForcingPublishableTrue()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAllowPublish");

        // 2026-09-09 fix: this method deliberately switched from pRecomputeProjectPublishable
        // (@ProjectPKs) to pAllowProjectPublishing (@ProjectIds) -- confirmed operator-decided
        // 2026-08-25 (RISK-092). pRecomputeProjectPublishable unconditionally recomputes
        // IsPublishable from the 7 GAA-R rules for every matched project and can DEMOTE one that's
        // currently publishable; pAllowProjectPublishing only ever grants, never demotes, by
        // construction -- a real design decision, not test staleness to blindly revert. The original
        // intent this test protects (never force IsPublishable=true via a bulk SetProperty) still
        // holds against current code.
        Assert.Contains("BeginTransactionAsync", method, StringComparison.Ordinal);
        Assert.Contains("pAllowProjectPublishing", method, StringComparison.Ordinal);
        Assert.Contains("@ProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("NotRestoredProjectIds", method, StringComparison.Ordinal);
        Assert.DoesNotContain("SetProperty(\r\n                            project => project.IsPublishable,\r\n                            true)", method, StringComparison.Ordinal);
        Assert.DoesNotContain("SetProperty(\n                            project => project.IsPublishable,\n                            true)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAllowPublish_ResponsePartitionsRestoredAndNotRestoredProjects()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAllowPublish");

        // 2026-09-09 fix: was a single-line "Key = value" exact-substring match -- this method's
        // response object has always been line-wrapped ("Key =\n    value", present since the
        // method's first commit, not new drift), so the old assertions could never actually match.
        // Split into two checks per field so the assertion tolerates this codebase's real formatting
        // instead of assuming a style it never uses here.
        Assert.Contains("RestoredProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("restoredProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("NotRestoredProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("notRestoredProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("AlreadyAllowedProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("alreadyAllowedProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("MissingProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("missingProjectIds", method, StringComparison.Ordinal);
    }

    private static MethodInfo GetPublicAction(string actionName)
    {
        return typeof(ProgramController)
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
