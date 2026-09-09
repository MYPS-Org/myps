using Xunit;

namespace MYPS.ApiIntegrationTests;

// Regression guard for the 2026-09-10 fix: DEO/ImplementingOffice/OperatingUnit validation in
// ValidateProjectDetailsLookups used to require an exact RegionParticipantId match, which can never
// be satisfied by an org-wide entity (e.g. "Central Office") whose RegionParticipantId is NULL by
// design -- confirmed live on myps_db_dev, this blocked saving 35% of all projects (41,496 of
// 118,438) via UpdateProjectDetails, plus AddProject, since both call this same method. Same
// characterization-test pattern used throughout this test project (ReadSourceFile + source-text
// assertions) -- this codebase has no real HTTP-level test infrastructure to exercise the actual
// DB-backed behavior end-to-end.
public sealed class ProjectHelperValidateLookupsContractTests
{
    [Theory]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    [InlineData("ValidateDEO", "vAdminDEO")]
    [InlineData("ValidateIO", "vAdminImplementingOffice")]
    [InlineData("ValidateOU", "vAdminOperatingUnit")]
    public void ValidateProjectDetailsLookups_AllowsNullRegionOrgWideEntities(string variableName, string viewName)
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        string method = ExtractMethod(source, "ValidateProjectDetailsLookups");

        int declaration = method.IndexOf($"var {variableName} =", StringComparison.Ordinal);
        Assert.True(declaration >= 0, $"Could not find the {variableName} declaration inside ValidateProjectDetailsLookups.");

        int nextDeclaration = method.IndexOf("var Validate", declaration + 1, StringComparison.Ordinal);
        string clause = nextDeclaration > 0
            ? method.Substring(declaration, nextDeclaration - declaration)
            : method.Substring(declaration);

        Assert.Contains(viewName, clause, StringComparison.Ordinal);
        Assert.Contains("string.IsNullOrEmpty(x.RegionParticipantId)", clause, StringComparison.Ordinal);
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
            $" {methodName}(",
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
