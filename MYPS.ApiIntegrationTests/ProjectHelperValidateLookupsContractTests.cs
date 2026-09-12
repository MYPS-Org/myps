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

    // 2026-09-12: the gate watches BOTH fields. Changing only the Category must re-validate the
    // pair, so an orphaned legacy Sub-Category cannot be re-homed under a Category it does not
    // fit; only a pair untouched on both sides is grandfathered.
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void ValidateProjectDetailsLookupsParams_DeclaresPreviousCategory()
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        Assert.Contains("public int? PreviousCategory { get; set; }", source, StringComparison.Ordinal);
    }

    // The gate lives in the SHARED method since 2026-09-12 -- ValidateThrustForCategoryAsync is
    // the single implementation for Project, Lump Sum and ResubmitRevision. The 2026-09-11 rebase
    // had re-inlined a copy into ValidateProjectDetailsLookups (querying a view that exists on
    // neither localhost database, and reading a -1 wildcard beside a specific row as a
    // restriction); this test pins the gate to the shared method so that cannot recur silently.
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void ValidateThrustForCategoryAsync_SkipsOnlyWhenBothFieldsUntouched()
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        string method = ExtractMethod(source, "ValidateThrustForCategoryAsync");

        int gateDeclaration = method.IndexOf("bool PairIsUntouched = ", StringComparison.Ordinal);
        Assert.True(gateDeclaration >= 0, "PairIsUntouched gate not found in ValidateThrustForCategoryAsync.");

        int gateEnd = method.IndexOf(';', gateDeclaration);
        string gateExpression = method.Substring(gateDeclaration, gateEnd - gateDeclaration);
        Assert.Contains("previousCategory.Value == category", gateExpression, StringComparison.Ordinal);
        Assert.Contains("previousThrust.Value == thrust.Value", gateExpression, StringComparison.Ordinal);
        Assert.DoesNotContain("||", gateExpression.Replace("HasValue", string.Empty));

        int mappingQuery = method.IndexOf("tOptionProjectCategoryToPAPMap", gateDeclaration, StringComparison.Ordinal);
        Assert.True(mappingQuery > gateDeclaration,
            "The mapping query must come after the gate, so an untouched pair never reaches it.");

        Assert.DoesNotContain("vProjectThrustByCategory.", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void ValidateProjectDetailsLookups_DelegatesToSharedMethodWithBothPreviousValues()
    {
        string source = ReadSourceFile("Helpers", "ProjectHelper.cs");
        string method = ExtractMethod(source, "ValidateProjectDetailsLookups");

        int call = method.IndexOf("ValidateThrustForCategoryAsync(", StringComparison.Ordinal);
        Assert.True(call >= 0, "ValidateProjectDetailsLookups must delegate to ValidateThrustForCategoryAsync.");

        string arguments = method.Substring(call, method.IndexOf(';', call) - call);
        Assert.Contains("p.PreviousCategory", arguments, StringComparison.Ordinal);
        Assert.Contains("p.PreviousThrust", arguments, StringComparison.Ordinal);

        Assert.DoesNotContain("ThrustIsChanging", method, StringComparison.Ordinal);
        Assert.DoesNotContain("vProjectThrustByCategory.", method, StringComparison.Ordinal);
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

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    public void UpdateProjectDetails_SuppliesPreviousCategoryFromAlreadyLoadedRevision()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Projects", "ProjectController.cs");
        string method = ExtractMethod(source, "UpdateProjectDetails");

        Assert.Contains("PreviousCategory = ProjectRevision.Category,", method, StringComparison.Ordinal);
    }

    // Lump Sum is grandfathered the same way since 2026-09-12: UpdateLumpSum hands the stored
    // pair to the validator, CreateLumpSum hands nothing. Until then the Lump Sum save was the
    // one path that re-validated an untouched legacy pair, contrary to the Option A decision.
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Lumpsum")]
    public void UpdateLumpSum_SuppliesStoredPairToTheSharedValidator()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Lumpsum", "LumpsumController.Writes.cs");
        string method = ExtractMethod(source, "UpdateLumpSum");

        Assert.Contains("previousCategory: LumpSumProject.Category", method, StringComparison.Ordinal);
        Assert.Contains("previousThrust: LumpSumProject.Thrust", method, StringComparison.Ordinal);
    }

    // Regression guard for the 2026-09-11 fix (F2): a tOptionProjectCategoryToPAPMap row with
    // PAPKey != -1 must resolve to a real, existing Thrust to count as a restriction -- otherwise a
    // Category whose only non-wildcard rows are all dangling/orphaned references would be
    // "restricted" to a set of PAPKeys nothing can ever match, silently locking out every real
    // Thrust for that Category. Mirrors the dangling-reference safety valve
    // Hangfire/Importing/ImportingHelper.cs already had; ProjectHelper.cs and RevisionController.cs
    // (ResubmitRevision) were both missing it before this fix.
    // Since 2026-09-12 the rule has ONE home, so the dangling-reference valve is asserted once,
    // on the shared method, and each caller is asserted to delegate rather than re-implement.
    [Theory]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Project")]
    [InlineData("Helpers", "ProjectHelper.cs", "ValidateThrustForCategoryAsync")]
    public void ValidateThrustForCategoryAsync_ExcludesDanglingPAPKeysFromRestrictions(
        string dir, string file, string methodName)
    {
        string source = ReadSourceFile(dir, file);
        string method = ExtractMethod(source, methodName);

        // Each mapping row is projected with whether its PAPKey resolves to a real thrust row...
        Assert.Contains(
            "Resolves = _db.tOptionProjectThrustList.Any(t => t.PAPKey == x.PAPKey)",
            method, StringComparison.Ordinal);
        // ...and a Category none of whose rows resolve is treated as unrestricted.
        Assert.Contains("!CategoryMappings.Any(m => m.Resolves)", method, StringComparison.Ordinal);
        // The -1 wildcard WINS over specific rows beside it (operator rule, 2026-09-11).
        Assert.Contains("CategoryMappings.Any(m => m.PAPKey == -1L)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void ResubmitRevision_DelegatesToTheSharedValidator()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");
        string method = ExtractMethod(source, "ResubmitRevision");

        Assert.Contains("ValidateThrustForCategoryAsync(", method, StringComparison.Ordinal);
        Assert.DoesNotContain("vProjectThrustByCategory.", method, StringComparison.Ordinal);
        Assert.DoesNotContain(
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
