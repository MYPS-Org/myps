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
    [InlineData(nameof(RevisionController.UpdateRevisionStatus))]
    [InlineData(nameof(RevisionController.ResubmitRevision))]
    public void RevisionWorkflowActions_RemainHttpPostAndAllowAnonymous(string actionName)
    {
        var method = GetPublicAction(actionName);

        Assert.NotNull(method.GetCustomAttribute<HttpPostAttribute>());
        Assert.NotNull(method.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Revision")]
    public void RevisionStatusEnum_MatchesConfirmedWorkflowValues()
    {
        Assert.Equal(0, (int)EnumRevisionStatus.Pending);
        Assert.Equal(1, (int)EnumRevisionStatus.Approved);
        Assert.Equal(2, (int)2);
        Assert.Equal(3, (int)3);
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
    public void UpdateRevisionStatus_SavesLocalCoApprovalBeforePcmaAndCommitsAfterPcmaSuccess()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Revision", "RevisionController.cs");

        int publishCall = source.IndexOf("PublishRevisionAsync", StringComparison.Ordinal);
        int coStatusAssignment = source.IndexOf("CentralApproval.Status = dto.Status", StringComparison.Ordinal);
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
        Assert.True(saveChanges < publishCall);
        Assert.True(publishCall < commit);
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
