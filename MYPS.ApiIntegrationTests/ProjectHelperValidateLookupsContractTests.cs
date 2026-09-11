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

    // Regression guard for the 2026-09-11 fix (RCA Section 9, Option A): 556 pre-existing live
    // project revisions have a Category/Thrust combination that predates the Category<->Thrust
    // mapping check added 2026-09-10 -- confirmed via category_to_pap_many2many_map.xlsx, documented
    // in documents/docs/engineering/MYPS_PROJECT_THRUST_CATEGORY_VALIDATION_RCA_AND_DECISION.md.
    // Shipping that check with no exemption blocks any of those 556 projects' next save for ANY
    // reason, since UpdateProjectDetails posts the whole form every time. This asserts the grandfather
    // gate exists and wraps the Category-mapping check, so an unchanged Thrust is skipped while a
    // genuinely new one is still fully validated.
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void ValidateProjectDetailsLookupsParams_DeclaresPreviousThrust()
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        Assert.Contains("public int? PreviousThrust { get; set; }", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void ValidateProjectDetailsLookups_GatesThrustCategoryCheckOnActualChange()
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        string method = ExtractMethod(source, "ValidateProjectDetailsLookups");

        int gateDeclaration = method.IndexOf(
            "bool ThrustIsChanging = !p.PreviousThrust.HasValue || p.PreviousThrust.Value != p.Thrust.Value;",
            StringComparison.Ordinal);
        Assert.True(gateDeclaration >= 0, "ThrustIsChanging gate not found in ValidateProjectDetailsLookups.");

        int mappingCheck = method.IndexOf("ValidateThrustForCategory", gateDeclaration, StringComparison.Ordinal);
        Assert.True(mappingCheck > gateDeclaration,
            "The Category-mapping check must be textually inside the ThrustIsChanging gate (i.e. after its declaration).");

        int gateUsage = method.IndexOf("if (ThrustIsChanging)", gateDeclaration, StringComparison.Ordinal);
        Assert.True(gateUsage > gateDeclaration && gateUsage < mappingCheck,
            "ThrustIsChanging must actually guard the block containing the Category-mapping check.");
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void UpdateProjectDetails_SuppliesPreviousThrustFromAlreadyLoadedRevision()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Projects", "ProjectController.cs");
        string method = ExtractMethod(source, "UpdateProjectDetails");

        Assert.Contains("PreviousThrust = ProjectRevision.Thrust,", method, StringComparison.Ordinal);
    }

    // Regression guard for the 2026-09-11 fix (F2): a tOptionProjectCategoryToPAPMap row with
    // PAPKey != -1 must resolve to a real, existing Thrust to count as a restriction -- otherwise a
    // Category whose only non-wildcard rows are all dangling/orphaned references would be
    // "restricted" to a set of PAPKeys nothing can ever match, silently locking out every real
    // Thrust for that Category. Mirrors the dangling-reference safety valve
    // Hangfire/Importing/ImportingHelper.cs already had; ProjectHelper.cs and RevisionController.cs
    // (ResubmitRevision) were both missing it before this fix.
    [Theory]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    [InlineData("Helpers", "ProjectHelper.cs", "ValidateProjectDetailsLookups")]
    public void ValidateProjectDetailsLookups_ExcludesDanglingPAPKeysFromRestrictions(
        string dir, string file, string methodName)
    {
        string source = ReadSourceFile(dir, file);
        string method = ExtractMethod(source, methodName);

        Assert.Contains(
            "&& _db.tOptionProjectThrustList.Any(t => t.PAPKey == x.PAPKey)",
            method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void ResubmitRevision_ExcludesDanglingPAPKeysFromRestrictions()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");
        string method = ExtractMethod(source, "ResubmitRevision");

        Assert.Contains(
            "&& _db.tOptionProjectThrustList.Any(t => t.PAPKey == x.PAPKey)",
            method, StringComparison.Ordinal);
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
