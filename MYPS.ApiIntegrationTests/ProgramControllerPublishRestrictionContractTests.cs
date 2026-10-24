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

        // 2026-10-05: switched from a flat Where() on vProjectLatest to a join against
        // tProjects, so the already-published guard (see
        // BatchRestrictPublish_SkipsAlreadyPublishedProjects below) can read IsPublished
        // in the same query. The scoping this test protects -- ProgramId + current Stage
        // + the requested ProjectIds -- is unchanged, just read through the join's
        // "revision" range variable instead of a bare "x".
        Assert.Contains("revision.ProgramId == dto.ProgramId", method, StringComparison.Ordinal);
        Assert.Contains("revision.StageName == programDetails.StageName", method, StringComparison.Ordinal);
        Assert.Contains("requestedProjectIds.Contains(revision.ProjectId)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchRestrictPublish_SkipsAlreadyPublishedProjects()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchRestrictPublish");

        // 2026-10-05 fix (operator-confirmed): a project that is already published to PCMA
        // (tProjects.IsPublished = 1) is never restricted through this action -- re-publishing
        // only happens through a separate revision function/module. Guards that this method
        // excludes IsPublished projects from the update set rather than flipping IsPublishable
        // on them, and reports which ones were skipped.
        Assert.Contains("alreadyPublishedProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("!x.IsPublished", method, StringComparison.Ordinal);
        Assert.Contains("SkippedAlreadyPublishedProjectIds", method, StringComparison.Ordinal);
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
    public void BatchAllowPublish_SkipsAlreadyPublishedProjects()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAllowPublish");

        // 2026-10-05 fix (operator-confirmed): same guard as BatchRestrictPublish. An
        // already-published project is never sent to pAllowProjectPublishing and never
        // included in restrictedProjectIds -- it is reported as skipped instead.
        Assert.Contains("alreadyPublishedProjectIds", method, StringComparison.Ordinal);
        Assert.Contains("!x.IsPublished", method, StringComparison.Ordinal);
        Assert.Contains("SkippedAlreadyPublishedProjectIds", method, StringComparison.Ordinal);
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

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchDelete_RecomputesProgramCostInsideTransaction()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchDelete");

        // 2026-09-21: deleting a project changes what its program's Cost should be, and Program
        // Details reads the STORED tProgramRevisions.Cost (fProgramDetails), not a live sum -- so
        // this action must recompute, like every other project-mutating write path does, and the
        // delete and the recompute must commit together.
        Assert.Contains("BeginTransactionAsync", method, StringComparison.Ordinal);
        Assert.Contains("RecomputeProgramCostAsync", method, StringComparison.Ordinal);
        Assert.Contains("CommitAsync", method, StringComparison.Ordinal);
        Assert.Contains("RollbackAsync", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchDelete_FlagsTheRevisionKey_NotTheProjectKey()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchDelete");

        // 2026-09-21: the revision ids fed to tProjectRevisions MUST come from
        // vProjectLatest.RevisionId. vProjectLatest.Id is tProjects.Id -- a different table's
        // identity, never equal to the revision's (0 of 115,350 rows agree on myps_db_dev_200).
        // Selecting x.Id here meant Batch Delete flagged ANOTHER project's revision 97% of the
        // time and nothing at all the rest, while still answering 200. Against the project list
        // it matched 0 of 109,790 listed rows, so a "deleted" project never left the table.
        Assert.Contains("x.RevisionId", method, StringComparison.Ordinal);
        Assert.Contains(".Select(x => x.RevisionId)", method, StringComparison.Ordinal);
        Assert.DoesNotContain(".Select(x => x.Id)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchDelete_OpensItsTransactionAfterValidation()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchDelete");

        // 2026-10-04: a rejected request must not open a transaction, and the validation reads
        // must not run inside one. The transaction begins after the last validation refusal
        // ("Projects Not Found") and before the first write.
        int begin = method.IndexOf("BeginTransactionAsync", StringComparison.Ordinal);
        int lastRefusal = method.IndexOf("Projects Not Found", StringComparison.Ordinal);
        int firstWrite = method.IndexOf("ExecuteUpdateAsync", StringComparison.Ordinal);

        Assert.True(lastRefusal >= 0 && firstWrite >= 0, "BatchDelete's shape changed; revisit this test.");
        Assert.InRange(begin, lastRefusal, firstWrite);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchDelete_RollsBackWithoutTheRequestToken()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchDelete");

        // 2026-10-06: a cancelled request reaches the catch with that cancellation as `ex`; a
        // rollback handed the same token throws again inside the catch, so _exceptionHandler never
        // sees the error and it goes out as a raw, unlogged 500. BatchAddExistingProject is pinned
        // the same way below (RS3, 2026-10-24).
        Assert.DoesNotContain("RollbackAsync(cancellationToken)", method, StringComparison.Ordinal);
        Assert.Contains("RollbackAsync(CancellationToken.None)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_RecomputesProgramCostInsideTransaction()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-24 (RS1, batch-add-existing-project-restore-fixes.md): a restored project counts
        // toward its program's Cost again, and Program Details reads the STORED Cost. The recompute
        // must run after the restore and before the commit, as in BatchDelete.
        int update = method.IndexOf("ExecuteUpdateAsync", StringComparison.Ordinal);
        int recompute = method.IndexOf("RecomputeProgramCostAsync", StringComparison.Ordinal);
        int commit = method.IndexOf("CommitAsync", StringComparison.Ordinal);

        Assert.True(update >= 0 && recompute >= 0 && commit >= 0, "BatchAddExistingProject's shape changed; revisit this test.");
        Assert.InRange(recompute, update, commit);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_OpensItsTransactionAfterValidation()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-24 (RS2): a rejected request must not open a transaction. It begins after the
        // first NothingRestored refusal (nothing restorable among the ids) and before the lock and
        // the first write.
        int begin = method.IndexOf("BeginTransactionAsync", StringComparison.Ordinal);
        int firstRefusal = method.IndexOf("NothingRestored(", StringComparison.Ordinal);
        int theLock = method.IndexOf("AcquireProgramDeletionLockAsync", StringComparison.Ordinal);

        Assert.True(firstRefusal >= 0 && theLock >= 0, "BatchAddExistingProject's shape changed; revisit this test.");
        Assert.InRange(begin, firstRefusal, theLock);
        Assert.DoesNotContain("using var transaction", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_DecidesAgainOnLockedRowsBeforeWriting()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-24: the first classification is read without a lock (so a hopeless request opens
        // no transaction). It must be repeated on locked rows, after the program lock and before the
        // un-delete, as BatchDelete does, or a publish / approval / Lump Sum change in between slips by.
        int theLock = method.IndexOf("AcquireProgramDeletionLockAsync", StringComparison.Ordinal);
        int decide = method.IndexOf("DecideProjectDeletionsUnderLockAsync", StringComparison.Ordinal);
        int firstWrite = method.IndexOf("ExecuteUpdateAsync", StringComparison.Ordinal);

        Assert.True(theLock >= 0 && decide >= 0 && firstWrite >= 0, "BatchAddExistingProject's shape changed; revisit this test.");
        Assert.InRange(decide, theLock, firstWrite);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_RollsBackWithoutTheRequestToken()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-24 (RS3): same reason as BatchDelete_RollsBackWithoutTheRequestToken.
        Assert.DoesNotContain("RollbackAsync(cancellationToken)", method, StringComparison.Ordinal);
        Assert.Contains("RollbackAsync(CancellationToken.None)", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_RefusesApprovedProgramsAndPublishedProjects()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-24: nothing is restored in an Approved program or for a published project, as Batch
        // Delete refuses both. Read from the flags, not Tier: the tier rates an itemized child Hard even
        // in an Approved program. Lump Sum projects are restored like any other (RS4, confirmed), so the
        // refusal must not look at Kind. It runs on the unlocked read and again on the locked one.
        string refusal = ExtractHelper(source, "string? RestoreRefusal(");
        Assert.Contains("row.IsPublished", refusal, StringComparison.Ordinal);
        Assert.Contains("row.ProgramApproved", refusal, StringComparison.Ordinal);
        Assert.DoesNotContain("ProjectDeletionKinds", refusal, StringComparison.Ordinal);
        Assert.True(CountOf(method, "RestoreRefusal(") >= 2, "RestoreRefusal must run on the unlocked read and on the locked one.");
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_ScopesItsRevisionLookupToTheProgram()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-10-04: without this an id from ANOTHER program is un-deleted there and reported as
        // restored here. ProgramFK, not ProgramId: a revision keeps the ProgramId of the stage it
        // was written on, so ProgramId would miss revisions deleted on an earlier stage.
        Assert.Contains("revision.ProgramFK == ProgramParent.ProgramPK", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchActions_LeaveNoConsoleDebugOutput()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");

        foreach (string actionName in new[]
                 {
                     "BatchAllowPublish", "BatchRestrictPublish", "BatchDelete", "BatchAddExistingProject",
                 })
        {
            Assert.DoesNotContain(
                "Console.WriteLine",
                ExtractMethod(source, actionName),
                StringComparison.Ordinal);
        }
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void BatchAddExistingProject_MaterializesItsRevisionLookupBeforeUpdating()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "BatchAddExistingProject");

        // 2026-09-21: this lookup was a deferred IQueryable evaluated three times -- twice AFTER
        // the ExecuteUpdateAsync that clears IsDeleted, so those evaluations matched nothing, the
        // action reported "No Projects Restored" and returned without committing, rolling its own
        // restore back. It must be materialized once, before the update.
        Assert.Contains("latestDeletedRevisions", method, StringComparison.Ordinal);
        Assert.Contains("ToListAsync", method, StringComparison.Ordinal);
        Assert.DoesNotContain("latestDeletedRevisionsQuery", method, StringComparison.Ordinal);

        int lookupIndex = method.IndexOf("latestDeletedRevisions", StringComparison.Ordinal);
        int updateIndex = method.IndexOf("ExecuteUpdateAsync", StringComparison.Ordinal);
        Assert.True(lookupIndex >= 0 && updateIndex > lookupIndex,
            "The revision lookup must be materialized before the update that changes IsDeleted.");
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void AddProgram_WritesTheLookupStageName_NotTheEnumName()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "AddProgram");

        // 2026-10-21: FK_tProgramStages_Stage is composite on (StageId, StageName) against
        // tOptionProgramStage (Id, Name). EnumProgramStage cannot spell the hyphenated stages
        // (NEPE/HGABI/GAAR/TFR vs NEP-E/HGAB-I/GAA-R/TF-R), so writing dto.Stage.ToString()
        // made every create at those four stages fail with SQL error 547. The row AddProgram
        // already loads for validation carries the correct Name.
        Assert.Contains("StageName = checkStageType.Name", method, StringComparison.Ordinal);
        Assert.DoesNotContain("StageName = dto.Stage.ToString()", method, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "ProcessConformance")]
    [Trait("Controller", "Program")]
    public void AddProgram_PersistsIsSkippedAndSkipReason()
    {
        string source = ReadSourceFile("WebAPI", "Controllers", "Programs", "ProgramController.cs");
        string method = ExtractMethod(source, "AddProgram");

        // a9ed4a66 (2026-07-15) dropped these two assignments from the Programs initializer while
        // keeping the "reason required" validation and the DTO fields, so the reason a user must type
        // when creating a program at a skipped stage was validated and then discarded.
        Assert.Contains("IsSkipped = dto.IsSkipped", method, StringComparison.Ordinal);
        Assert.Contains("SkipReason = dto.IsSkipped ? dto.SkipReason : null", method, StringComparison.Ordinal);
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
        => ExtractBody(source, $"Task<IActionResult> {methodName}", methodName);

    /// <summary>A non-action helper, found by its exact signature text (e.g. "string? RestoreRefusal(").</summary>
    private static string ExtractHelper(string source, string signature)
        => ExtractBody(source, signature, signature);

    private static int CountOf(string text, string value)
    {
        int count = 0;
        for (int at = text.IndexOf(value, StringComparison.Ordinal); at >= 0; at = text.IndexOf(value, at + value.Length, StringComparison.Ordinal))
        {
            count++;
        }
        return count;
    }

    private static string ExtractBody(string source, string signature, string methodName)
    {
        int signatureStart = source.IndexOf(signature, StringComparison.Ordinal);

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
