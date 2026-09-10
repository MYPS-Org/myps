using Xunit;

namespace MYPS.ApiIntegrationTests;

// Regression guard for the 2026-09-10 fix: the RevisionRules branch of
// CodeTableController.UpdateCodeTable duplicate-checked on PCMA_Status + Package_Status + Field
// (the rule's DATA/content) instead of the table's actual natural key
// (ReasonId, PCMA_Status, Package_Status) -- confirmed live on myps_db_dev this rejected saves for
// ANY ReasonId whose Field happened to match another ReasonId's Field for the same status pair,
// most commonly hit via an all-false Field (97 of 347 live rows, 28% -- the single most common
// configuration). Every one of this controller's other 16 CheckNameIfExists branches correctly
// checks its own table's name/identity column; this was the only exception. Same
// characterization-test pattern used throughout this test project (ReadSourceFile + source-text
// assertions) -- this codebase has no real HTTP-level test infrastructure to exercise the actual
// DB-backed behavior end-to-end.
public sealed class CodeTableRevisionRulesContractTests
{
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "CodeTable")]
    public void RevisionRulesDuplicateCheck_KeysOnReasonIdNotField()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "CodeTable", "CodeTableController.cs");
        string method = ExtractMethod(source, "UpdateCodeTable");

        int branchStart = method.IndexOf("\"RevisionRules\"", StringComparison.Ordinal);
        Assert.True(branchStart >= 0, "Could not find the RevisionRules branch inside UpdateCodeTable.");

        int nextBranch = method.IndexOf("else if (dto.Code ==", branchStart + 1, StringComparison.Ordinal);
        string branch = nextBranch > 0
            ? method.Substring(branchStart, nextBranch - branchStart)
            : method.Substring(branchStart);

        int checkStart = branch.IndexOf("CheckNameIfExists = await _db.tRevisionRules", StringComparison.Ordinal);
        Assert.True(checkStart >= 0, "Could not find the tRevisionRules duplicate-check.");
        int checkEnd = branch.IndexOf(';', checkStart);
        string checkClause = branch.Substring(checkStart, checkEnd - checkStart);

        Assert.Contains("x.ReasonId == data.ReasonId", checkClause, StringComparison.Ordinal);
        Assert.Contains("x.PCMA_Status == data.PCMA_Status", checkClause, StringComparison.Ordinal);
        Assert.Contains("x.Package_Status == data.Package_Status", checkClause, StringComparison.Ordinal);
        Assert.DoesNotContain("x.Field == data.Field", checkClause, StringComparison.Ordinal);
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
