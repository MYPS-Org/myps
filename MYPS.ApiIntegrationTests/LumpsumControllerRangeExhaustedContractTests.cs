using Xunit;

namespace MYPS.ApiIntegrationTests;

// Characterization tests for the Lump Sum module's ProjectIdRangeExhaustedException handling
// (2026-09-10, documents/plans/lump-sum-project-id-range-exhausted.md). Both of its minting sites
// call ProjectHelper.GenerateProjectID and neither caught the typed exception dev-trunk added on
// 2026-09-08, so an exhausted category read as "Application Error" with a reference id for a
// condition only an administrator can clear.
//
// Source-text assertions, the same assurance level and for the same stated reason as
// ProjectControllerAddProjectContractTests: this codebase has no pattern for authenticated
// end-to-end HTTP testing. The behaviour itself was proven once against a real exhausted range
// (see the plan's Completion Log); what these guard afterwards is that each typed catch still
// EXISTS and still answers the agreed shape.
//
// They do NOT assert that the typed catch sits above the generic one: C# enforces that (CS0160
// makes the reverse order a compile error), and an index comparison across the whole method would
// misfire on any inner `catch (Exception ex)` a later change might add. Every assertion below is
// made INSIDE the typed catch's own text, so a line that also appears in the generic catch — the
// rollback, say — cannot satisfy it by accident.
public sealed class LumpsumControllerRangeExhaustedContractTests
{
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Lumpsum")]
    public void CreateLumpSum_RefusesAnExhaustedRangeByName()
    {
        string method = ExtractMethod(
            ReadSourceFile("WebAPI", "Controllers", "Lumpsum", "LumpsumController.Writes.cs"),
            "CreateLumpSum");
        string typedCatch = ExtractTypedCatch(method, nameof(CreateLumpSum_RefusesAnExhaustedRangeByName));

        Assert.Contains("Title = \"Project ID Range Exhausted\"", typedCatch, StringComparison.Ordinal);
        Assert.Contains("Message = ex.Message", typedCatch, StringComparison.Ordinal);

        // Rolled back INSIDE this catch, so the sequence the allocator advanced before raising is restored.
        Assert.Contains("SafeRollbackAsync(transaction, cancellationToken)", typedCatch, StringComparison.Ordinal);

        // And recorded: the toast cannot reach the administrator who has to widen the range.
        Assert.Contains("_logger.LogWarning(", typedCatch, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Lumpsum")]
    public void ImportItemizedProjects_RefusesTheWholeBatchByName()
    {
        string method = ExtractMethod(
            ReadSourceFile("WebAPI", "Controllers", "Lumpsum", "LumpsumController.Import.cs"),
            "ImportItemizedProjects");
        string typedCatch = ExtractTypedCatch(method, nameof(ImportItemizedProjects_RefusesTheWholeBatchByName));

        Assert.Contains("Title = \"Project ID Range Exhausted\"", typedCatch, StringComparison.Ordinal);

        // The batch is refused WHOLE: an exhausted range is an administrative condition, not a row
        // error, and committing around it would leave the allocator past its own maximum per row.
        Assert.Contains("SafeRollbackAsync(transaction, cancellationToken)", typedCatch, StringComparison.Ordinal);
        Assert.Contains("Nothing was imported.", typedCatch, StringComparison.Ordinal);

        // It carries what every batch-level refusal in this method carries, so the error workbook
        // written before the write loop is reachable rather than orphaned on disk.
        Assert.Contains("Errors =", typedCatch, StringComparison.Ordinal);
        Assert.Contains("ErrorFileName", typedCatch, StringComparison.Ordinal);

        Assert.Contains("_logger.LogWarning(", typedCatch, StringComparison.Ordinal);
    }

    /// <summary>The text of the typed catch alone: from its clause to the next catch clause.</summary>
    private static string ExtractTypedCatch(string method, string caller)
    {
        int start = method.IndexOf("catch (ProjectIdRangeExhaustedException ex)", StringComparison.Ordinal);
        Assert.True(start >= 0, $"{caller}: the ProjectIdRangeExhaustedException catch is gone.");

        int next = method.IndexOf("catch (", start + 1, StringComparison.Ordinal);
        return next > start ? method.Substring(start, next - start) : method.Substring(start);
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

    private static string ExtractMethod(string source, string methodName)
    {
        int signatureStart = source.IndexOf($"Task<IActionResult> {methodName}", StringComparison.Ordinal);
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
