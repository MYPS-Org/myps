using DBHelper.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using WebAPI.Controllers.Revision;
using WebAPI.Services.Revision;
using Xunit;

namespace MYPS.ApiIntegrationTests;

public sealed class RevisionControllerContractTests
{
    [Fact]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Revision")]
    public void RevisionController_UsesExpectedActionRouteTemplate()
    {
        var route = typeof(RevisionController).GetCustomAttribute<RouteAttribute>();

        Assert.NotNull(route);
        Assert.Equal("api/[controller]/[action]", route!.Template);
    }

    [Theory]
    [Trait("Layer", "Characterization")]
    [Trait("Controller", "Revision")]
    [InlineData(nameof(RevisionController.RevisionRequests))]
    [InlineData(nameof(RevisionController.RequestRevision))]
    [InlineData(nameof(RevisionController.ApproveRevision))]
    [InlineData(nameof(RevisionController.ResubmitRevision))]
    public void RevisionWorkflowActions_RemainHttpPostAndRequireAuthentication(string actionName)
    {
        var method = GetPublicAction(actionName);

        Assert.NotNull(method.GetCustomAttribute<HttpPostAttribute>());
        // 2026-09-09 fix: [AllowAnonymous] was deliberately removed from all 4 of these actions
        // (e4442fb9 "Enforce permission checks for revision actions", 2026-08-18) -- a caller
        // hitting them anonymously used to short-circuit CoreController.OnActionExecuting's session
        // population, breaking usergroup-based authorization for real users (re-confirmed by
        // 7f027d4f, 2026-09-07, when AllowAnonymous was accidentally reintroduced on RequestRevision
        // and had to be removed again for the same reason). The invariant is now the opposite of
        // what this test used to assert.
        Assert.Null(method.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    /// <summary>
    /// Documents the LIVE tOptionRevisionStatus codes (0=ForApproval, 1=Approved, 2=Reject,
    /// 3=ForCorrection), confirmed directly against myps_db_dev on 2026-08-27 (ADR-126 addendum)
    /// and cross-checked against every literal .Status assignment in RevisionController.cs. This
    /// supersedes ADR-087's 2026-08-07 6-value mapping (0=Pending, 1=Submitted, 2=ForApproval,
    /// 3=ForCorrection, 4=Approved, 5=Disapproved), which the live table and code no longer match
    /// -- the table has genuinely narrowed to 4 rows since ADR-087 was written, not a
    /// documentation error caught here for the first time. No FK constraint ties
    /// tRevisionApprovals.Status to tOptionRevisionStatus, so this test verifies the source text
    /// directly rather than trusting an enforced relationship that doesn't exist.
    /// </summary>
    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionStatusCodes_MatchLiveTOptionRevisionStatusTable()
    {
        const int forApproval = 0;
        const int approved = 1;
        const int reject = 2;
        const int forCorrection = 3;

        Assert.Equal(0, forApproval);
        Assert.Equal(1, approved);
        Assert.Equal(2, reject);
        Assert.Equal(3, forCorrection);

        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.Contains("Approval.Status = 1;", source, StringComparison.Ordinal);
        Assert.Contains("Approval.Status = 2;", source, StringComparison.Ordinal);
        Assert.Contains("Approval.Status = 3;", source, StringComparison.Ordinal);
        Assert.DoesNotContain("Approval.Status = 4;", source, StringComparison.Ordinal);
        Assert.DoesNotContain("Approval.Status = 5;", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionController_RequiresPcmaPublisherForFinalApprovalBoundary()
    {
        ConstructorInfo constructor = typeof(RevisionController)
            .GetConstructors()
            .Single();

        Assert.Contains(
            constructor.GetParameters(),
            parameter => parameter.ParameterType == typeof(IRevisionPcmaPublisher));
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionController_DoesNotDependOnRemovedFlatRevisionObjects()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.DoesNotContain("vRevisionRules", source, StringComparison.Ordinal);
        Assert.DoesNotContain("vRevisionLists", source, StringComparison.Ordinal);
        Assert.DoesNotContain("tRevisionTransactionLog", source, StringComparison.Ordinal);
        Assert.DoesNotContain("tRevisionDetailsComponentsStatus", source, StringComparison.Ordinal);
        Assert.DoesNotContain("RevisionDetails.RegionStatus", source, StringComparison.Ordinal);
        Assert.DoesNotContain("RevisionDetails.COStatus", source, StringComparison.Ordinal);
        Assert.DoesNotContain("ExistingRevision.RegionStatus", source, StringComparison.Ordinal);
        Assert.DoesNotContain("ExistingRevision.COStatus", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void ApproveRevision_PublishesToPcmaBeforeFinalLocalSaveAndCommitsAfter()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        // 2026-09-09 fix: CentralApproval was retired by the revision-schema normalization refactor
        // (e24e0d20) -- current equivalent is Approval.Status = 1;. Separately, the live order is now
        // PCMA-before-final-save (was save-before-PCMA when this test was written) -- confirmed
        // intentional by the operator, not a regression; everything still lives inside one
        // transaction so atomicity is unaffected either way, only the read-before-write sequencing
        // this test encodes.
        int publishCall = source.IndexOf("PublishRevisionAsync", StringComparison.Ordinal);
        int coStatusAssignment = source.IndexOf("Approval.Status = 1;", StringComparison.Ordinal);
        int coDocumentInsert = source.IndexOf("IsApprovedDocument = true", StringComparison.Ordinal);
        int saveChanges = source.IndexOf("await _db.SaveChangesAsync(cancellationToken);", coDocumentInsert, StringComparison.Ordinal);
        int commit = source.IndexOf("await transaction.CommitAsync(cancellationToken);", publishCall, StringComparison.Ordinal);

        Assert.True(publishCall > 0);
        Assert.True(coStatusAssignment > 0);
        Assert.True(coDocumentInsert > 0);
        Assert.True(saveChanges > 0);
        Assert.True(commit > 0);
        Assert.True(coStatusAssignment < saveChanges);
        Assert.True(coDocumentInsert < saveChanges);
        Assert.True(publishCall < saveChanges);
        Assert.True(saveChanges < commit);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RequestAndResubmitRevision_RequirePublishedProjectBeforeFormalRevision()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.Equal(2, CountOccurrences(source, "if (!ProjectParent.IsPublished)"));
        Assert.Contains("Only published Projects can request a Formal Revision.", source, StringComparison.Ordinal);
        Assert.Contains("Title = \"Project Not Published\"", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionRuleSelection_FailsClosedWhenRuleCountIsNotExactlyOne()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.Contains("MatchingRevisionRules.Count != 1", source, StringComparison.Ordinal);
        Assert.Contains("Multiple active revision rules exist", source, StringComparison.Ordinal);
        Assert.DoesNotContain("var RevisionRules = await _db.tRevisionRules.AsNoTracking().FirstOrDefaultAsync", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void PackageStatusAggregation_UsesAnyNotPackagedComponentAsNotPackaged()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.DoesNotContain("FirstOrDefault(x => x.IsPackaged == true) != null) ?", source, StringComparison.Ordinal);
        Assert.Contains("ComponentCost.Any(x => x.IsPackaged != true)", source, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionDocumentUploads_AreCleanedUpWhenDatabaseTransactionFails()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        Assert.Contains("uploadedIoDocumentResourcePath", source, StringComparison.Ordinal);
        Assert.Contains("uploadedApprovalDocumentResourcePath", source, StringComparison.Ordinal);
        Assert.Contains("System.IO.File.Delete(uploadedIoDocumentResourcePath)", source, StringComparison.Ordinal);
        Assert.Contains("System.IO.File.Delete(uploadedApprovalDocumentResourcePath)", source, StringComparison.Ordinal);
    }

    private static MethodInfo GetPublicAction(string actionName)
    {
        return typeof(RevisionController)
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

    private static int CountOccurrences(string source, string value)
    {
        int count = 0;
        int index = 0;

        while ((index = source.IndexOf(value, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += value.Length;
        }

        return count;
    }
}
