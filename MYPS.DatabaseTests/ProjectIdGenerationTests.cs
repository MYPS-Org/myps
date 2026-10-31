using DBHelper.Data;
using Helpers;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;
using Xunit;

namespace MYPS.DatabaseTests;

// RISK-105/RISK-111/ADR-134 regression guard for the two confirmed defects in ProjectId/ProjectPK
// generation: (1) dbo.pGenerateThirdSegment's unlocked check-then-act loop under concurrent callers
// (the original RISK-105 finding, now closed by rewiring onto dbo.pReserveProjectIdBlock's atomic
// UPDLOCK/HOLDLOCK allocation), and (2) the structural gap where the Program-stage BP-to-first-stage
// ProjectId swap (ProgramController.cs, ReplaceFirst("BP", ...)) reused existing digits with no
// collision check against a value already directly issued to a different real project (e.g. one
// imported at a P-eligible stage) -- proven live on myps_db_dev, 3 real colliding project pairs
// found (P01100001LZ/2/3LZ). This file proves both fixes at the DB layer.
public sealed class ProjectIdGenerationTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, SchemaSql);
        await ExecuteNonQueryAsync(connection, ProcedureSql);
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tOptionProjectCategory (CategoryId, Minimum) VALUES (1, 1);");
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ReserveProjectIdBlock_FreshBucketStartsAtCategoryMinimum()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        (int start, int end) = await ReserveBlockAsync(connection, count: 1);
        Assert.Equal(1, start);
        Assert.Equal(1, end);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ReserveProjectIdBlock_SequentialCallsNeverRepeatAValue()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        (int first, _) = await ReserveBlockAsync(connection, count: 1);
        (int second, _) = await ReserveBlockAsync(connection, count: 1);
        (int third, _) = await ReserveBlockAsync(connection, count: 1);
        Assert.Equal(new[] { 1, 2, 3 }, new[] { first, second, third });
    }

    // The actual RISK-105 regression guard: dbo.pGenerateThirdSegment's SELECT MAX -> increment ->
    // IF NOT EXISTS loop let two concurrent callers read the same starting point and both pass the
    // check before either committed. dbo.pReserveProjectIdBlock instead does one atomic
    // UPDATE ... OUTPUT under UPDLOCK/HOLDLOCK -- this proves N concurrent callers for the identical
    // bucket each get a distinct, non-overlapping value with zero duplicates.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ReserveProjectIdBlock_IsSafeUnderConcurrentReservation()
    {
        const int concurrentCallers = 10;
        Task<int>[] tasks = Enumerable.Range(0, concurrentCallers).Select(async _ =>
        {
            await using var connection = new SqlConnection(ConnectionString);
            await connection.OpenAsync();
            (int start, _) = await ReserveBlockAsync(connection, count: 1);
            return start;
        }).ToArray();
        int[] results = await Task.WhenAll(tasks);
        Assert.Equal(concurrentCallers, results.Distinct().Count());
        Assert.Equal(Enumerable.Range(1, concurrentCallers).OrderBy(x => x), results.OrderBy(x => x));
    }

    // RISK-072 follow-up (2026-09-08): pReserveProjectIdBlock previously checked only Minimum at
    // bucket-seed time, never Maximum -- live-proven exhausted on myps_db_dev Category 34
    // (Minimum=Maximum=5, already at CurrentSequence=5; the next reservation would have silently
    // minted an out-of-range ID). This mirrors that exact single-value-range shape: the first
    // reservation legitimately consumes the only slot in range, the second must raise.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ReserveProjectIdBlock_RaisesWhenReservationWouldExceedCategoryMaximum()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tOptionProjectCategory (CategoryId, Minimum, Maximum) VALUES (2, 1, 1);");

        (int start, int end) = await ReserveBlockAsync(connection, count: 1, categoryId: 2);
        Assert.Equal(1, start);
        Assert.Equal(1, end);

        SqlException ex = await Assert.ThrowsAsync<SqlException>(
            () => ReserveBlockAsync(connection, count: 1, categoryId: 2));
        Assert.Contains("PROJECTID_RANGE_EXHAUSTED", ex.Message);
    }

    // No-false-positive check: a category with room to spare must never trip the new guard.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task ReserveProjectIdBlock_DoesNotRaiseWhenWithinCategoryMaximum()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tOptionProjectCategory (CategoryId, Minimum, Maximum) VALUES (3, 1, 100);");

        (int start, int end) = await ReserveBlockAsync(connection, count: 1, categoryId: 3);
        Assert.Equal(1, start);
        Assert.Equal(1, end);
    }

    // Everything above proves dbo.pReserveProjectIdBlock's own SQL behavior via a raw SqlCommand --
    // it never exercises Helpers/ProjectHelper.cs's GenerateProjectID itself, the actual C# code path
    // that wraps the Dapper call and translates a PROJECTID_RANGE_EXHAUSTED SqlException into
    // ProjectIdRangeExhaustedException. These two close that gap by calling the real method.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_ReturnsCorrectlyFormattedIdWithinRange()
    {
        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        string projectId = await db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        }, CancellationToken.None);

        // {Prefix}{YearOffset:D3}{Sequence:D5}{IslandCode} -- BP, (2026-2016)="010", first
        // reservation="00001", island="LZ".
        Assert.Equal("BP01000001LZ", projectId);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_ThrowsProjectIdRangeExhaustedExceptionWhenRangeExhausted()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tOptionProjectCategory (CategoryId, Minimum, Maximum) VALUES (2, 1, 1);");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;

        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 2,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        // First call legitimately consumes the only slot in range (Minimum=Maximum=1).
        await using (var db1 = new MYPSDbContext(options))
        {
            string firstId = await db1.GenerateProjectID(request, CancellationToken.None);
            Assert.Equal("BP01000001LZ", firstId);
        }

        // Second call must be rejected via the real C# exception type, not a raw SqlException.
        await using var db2 = new MYPSDbContext(options);
        var ex = await Assert.ThrowsAsync<ProjectHelper.ProjectIdRangeExhaustedException>(
            () => db2.GenerateProjectID(request, CancellationToken.None));
        Assert.Equal(2, ex.CategoryId);
        Assert.Contains("exhausted", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    // RISK-072 follow-up (2026-09-19): the operator's exact scenario -- an existing project's
    // stage-advance swap already claims a value (or, as here, a plain pre-existing tProjects row
    // occupies it), so the very next reservation must NOT fail; it should transparently advance to
    // the next sequence. Proves the retry loop added to GenerateProjectID.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AutoAdvancesPastASingleCollisionInsteadOfFailing()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        // Pre-occupy the exact ID the first reservation for this bucket would produce -- e.g. the
        // operator's scenario: an existing project's stage-advance swap already claims
        // P01012345LZ-shaped territory. The new project must land on the NEXT value, not fail.
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        string projectId = await db.GenerateProjectID(request, CancellationToken.None);
        Assert.Equal("BP01000002LZ", projectId);
    }

    // RISK-072 follow-up (2026-09-19): the swap gap this session found -- ProgramController's
    // stage-advance swap rewrites tProjectRevisions.ProjectId but never tProjects.ProjectPK, so a
    // duplicate check that only reads tProjects would miss it entirely and silently mint a real
    // duplicate. Proves the second half of GenerateProjectID's duplicate check.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_DetectsACollisionThatOnlyExistsInProjectRevisions()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        // No tProjects row at all -- only tProjectRevisions.ProjectId holds the swapped value,
        // exactly as the BP->P swap leaves it (tProjects.ProjectPK keeps the original BP- value).
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES (N'BP01000001LZ', N'BP01000001LZ', 0);");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        // A tProjects-only check (the pre-fix behavior) would miss this and return BP01000001LZ
        // as if it were free. The fix must detect it via tProjectRevisions and advance past it.
        string projectId = await db.GenerateProjectID(request, CancellationToken.None);
        Assert.Equal("BP01000002LZ", projectId);
    }

    // A soft-deleted revision must NOT block a value -- it's no longer a live record.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_IgnoresASoftDeletedProjectRevisionsRow()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES (N'BP01000001LZ', N'BP01000001LZ', 1);");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        string projectId = await db.GenerateProjectID(request, CancellationToken.None);
        Assert.Equal("BP01000001LZ", projectId);
    }

    // 2026-10-30 (S07-TC007-P002): a run of taken numbers longer than the retry cap is skipped in
    // one jump. Until then the retry moved the counter by 1, three times, and threw
    // ProjectIdCollisionException ("still colliding after 3 attempts") -- which is what a Lump Sum
    // import into a program with seven advanced projects answered.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_JumpsPastARunOfTakenNumbersLongerThanTheRetryCap()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection,
            "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ'), (N'BP01000004LZ'), (N'BP01000005LZ'), (N'BP01000006LZ'), (N'BP01000007LZ'), (N'BP01000009LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("BP01000008LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
        // The counter now stands on 8, so the next one is the gap after 9, not 9 itself.
        Assert.Equal("BP01000010LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
    }

    // The exact UAT / local data: a program's projects were created at BP (BP01100016LZ ..) and
    // advanced, so their revisions carry P01100016LZ .., while tProjects keeps the BP form. The P
    // counter never issued those numbers. A new P id (an itemized child at GAA-R) must land past them.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_TreatsTheSwappedPFormOfANumberAsTaken()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, """
            INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ'), (N'BP01000004LZ'), (N'BP01000005LZ');
            INSERT INTO dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES
                (N'BP01000001LZ', N'BP01000001LZ', 0), (N'BP01000001LZ', N'P01000001LZ', 0),
                (N'BP01000002LZ', N'BP01000002LZ', 0), (N'BP01000002LZ', N'P01000002LZ', 0),
                (N'BP01000003LZ', N'BP01000003LZ', 0), (N'BP01000003LZ', N'P01000003LZ', 0),
                (N'BP01000004LZ', N'BP01000004LZ', 0), (N'BP01000004LZ', N'P01000004LZ', 0),
                (N'BP01000005LZ', N'BP01000005LZ', 0), (N'BP01000005LZ', N'P01000005LZ', 0);
            """);

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("P01000006LZ", await db.GenerateProjectID(PLz2026, CancellationToken.None));
    }

    // A number whose BP form is still at BP is not free for a P id either: that project's program
    // would later stop at its stage advance with "ProjectId Collision Detected".
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AvoidsANumberWhoseBpFormIsStillAtBp()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("P01000002LZ", await db.GenerateProjectID(PLz2026, CancellationToken.None));
    }

    // And the other way round: a BP id avoids a number a P id was minted on directly (an import or
    // an itemized child at a P stage), or that project would block this one's stage advance.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AvoidsANumberWhosePFormWasMintedDirectly()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'P01000001LZ'), (N'MY01000002LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("BP01000003LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
    }

    // The Lump Sum import inserts a child and then mints the next one in the SAME transaction. The
    // jump's lookup must see that uncommitted row and must not wait on it: this database runs
    // without READ_COMMITTED_SNAPSHOT, so a lookup on another connection would block on the row
    // until the 120-second command timeout.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_InsideTheCallersTransaction_SeesItsOwnUncommittedRowsWithoutWaiting()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'P01000002LZ');");

        var generating = db.GenerateProjectID(PLz2026, CancellationToken.None);
        Assert.Same(generating, await Task.WhenAny(generating, Task.Delay(TimeSpan.FromSeconds(30))));
        Assert.Equal("P01000003LZ", await generating);
        await transaction.RollbackAsync();
    }

    // A jump that would run past the category's Maximum is range exhaustion, not a collision.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AJumpPastTheCategoryMaximumIsRangeExhaustion()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, """
            INSERT INTO dbo.tOptionProjectCategory (CategoryId, Minimum, Maximum) VALUES (3, 1, 3);
            INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ');
            """);

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        var ex = await Assert.ThrowsAsync<ProjectHelper.ProjectIdRangeExhaustedException>(() => db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 3, StageName = "BP", IslandCode = "LZ", YearStart = 2026
        }, CancellationToken.None));
        Assert.Equal(3, ex.CategoryId);
    }

    // The core regression test for the 2026-09-19 durability fix, adapted for the jump: the
    // counter increment previously shared the caller's ambient EF transaction (no BEGIN TRAN/COMMIT
    // of its own in the proc), so a later transaction.RollbackAsync() silently undid the
    // reservation and the NEXT call repeated the same value. The fix runs each reservation on its
    // own dedicated connection. Proves it: generate inside an ambient transaction that then rolls
    // back (the caller failed after the id was minted), then confirm the next call does not hand
    // the same id out again.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AllRetriedReservationsSurviveCallerTransactionRollback()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;

        // Simulate AddProject: an ambient transaction is open when GenerateProjectID is called
        // (and has to jump past 1-3), and gets rolled back when the save after it fails.
        await using (var db = new MYPSDbContext(options))
        {
            await using var ambientTransaction = await db.Database.BeginTransactionAsync();
            Assert.Equal("BP01000004LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
            await ambientTransaction.RollbackAsync();
        }

        // If the reservation had been rolled back too (the bug), this would repeat BP01000004LZ.
        await using var db2 = new MYPSDbContext(options);
        string nextId = await db2.GenerateProjectID(BpLz2026, CancellationToken.None);
        Assert.Equal("BP01000005LZ", nextId);
    }

    // The structural defect this pass found, live on myps_db_dev (ADR-134): a BP-form project's
    // stage-advance swap reuses its own digits with the new prefix and no collision check. This
    // proves the detection query ProgramController.cs's collision check now runs (tProjects.ProjectPK
    // OR tProjectRevisions.ProjectId already holding the swapped value) correctly flags a real
    // cross-project collision before any write -- mirrors the live P01100001LZ pair exactly
    // (BP01100001LZ stage-advancing into P01100001LZ, which a separately-imported project already
    // owns as its own ProjectPK).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task SwapCollisionDetectionQuery_FlagsAnExistingCrossProjectProjectPK()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        // Project #4 equivalent: imported, directly issued ProjectPK = P01100001LZ at creation.
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'P01100001LZ');");
        // Project #33 equivalent: manually created as BP01100001LZ; about to stage-advance and
        // swap its display ProjectId to P01100001LZ -- the exact colliding value.
        const string swappedProjectId = "P01100001LZ";

        bool collides = await DetectionQueryFindsCollisionAsync(connection, swappedProjectId);
        Assert.True(collides);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task SwapCollisionDetectionQuery_FlagsAnExistingCrossProjectRevisionProjectId()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'P02200005LZ');");
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES (N'P02200005LZ', N'P02200005LZ', 0);");
        const string swappedProjectId = "P02200005LZ";

        bool collides = await DetectionQueryFindsCollisionAsync(connection, swappedProjectId);
        Assert.True(collides);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task SwapCollisionDetectionQuery_PassesCleanWhenNoCollisionExists()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'P09900001LZ');");
        const string unrelatedProjectId = "P01100001LZ";

        bool collides = await DetectionQueryFindsCollisionAsync(connection, unrelatedProjectId);
        Assert.False(collides);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task SwapCollisionDetectionQuery_IgnoresSoftDeletedRevisionRows()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES (N'P03300009LZ', N'P03300009LZ', 1);");
        const string swappedProjectId = "P03300009LZ";

        bool collides = await DetectionQueryFindsCollisionAsync(connection, swappedProjectId);
        Assert.False(collides);
    }

    // ---------------------------------------------------------------------------------------
    // ID reuse (2026-10-29, delete-rules-projects-programs-stages.md): a BP/P id freed by a
    // permanent delete (dbo.tProjectIdReleased) is handed out again, lowest first, before the
    // counter advances.
    // ---------------------------------------------------------------------------------------

    private static readonly ProjectHelper.GenerateProjectIDParams BpLz2026 = new()
    {
        CategoryId = 1,
        StageName = "BP",
        IslandCode = "LZ",
        YearStart = 2026
    };

    private static readonly ProjectHelper.GenerateProjectIDParams PLz2026 = new()
    {
        CategoryId = 1,
        StageName = "NEP",
        IslandCode = "LZ",
        YearStart = 2026
    };

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_HandsOutTheLowestReleasedIdFirst_AndTakesItOffTheList()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, ReleasedTableSql);
        await ReserveBlockAsync(connection, count: 9); // the counter is at 9
        await ExecuteNonQueryAsync(connection,
            "INSERT dbo.tProjectIdReleased (CategoryId, Suffix, IslandCode, YearStart, Sequence, ProjectId) VALUES " +
            "(1, N'BP', N'LZ', 2026, 7, N'BP01000007LZ'), (1, N'BP', N'LZ', 2026, 3, N'BP01000003LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("BP01000003LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
        Assert.Equal("BP01000007LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
        Assert.Equal("BP01000010LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None)); // list empty: the counter
        Assert.Equal(0, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tProjectIdReleased;"));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_SkipsAReleasedIdThatIsCarriedAgain_EvenBySoftDeletedRevision()
    {
        // A soft-deleted project keeps its id reserved, so a released id that a deleted revision
        // carries again is dropped and the counter is used instead.
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, ReleasedTableSql);
        await ExecuteNonQueryAsync(connection,
            "INSERT dbo.tProjectIdReleased (CategoryId, Suffix, IslandCode, YearStart, Sequence, ProjectId) VALUES (1, N'BP', N'LZ', 2026, 5, N'BP01000005LZ');" +
            "INSERT dbo.tProjectRevisions (ProjectFK, ProjectId, IsDeleted) VALUES (N'BP01000005LZ', N'BP01000005LZ', 1);");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("BP01000001LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
        Assert.Equal(0, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tProjectIdReleased;"));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_OnlyTakesFromItsOwnBucket_AndNeverForMyIds()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, ReleasedTableSql);
        await ExecuteNonQueryAsync(connection,
            "INSERT dbo.tProjectIdReleased (CategoryId, Suffix, IslandCode, YearStart, Sequence, ProjectId) VALUES " +
            "(1, N'BP', N'VS', 2026, 2, N'BP01000002VS'), (1, N'P', N'LZ', 2026, 4, N'P01000004LZ'), (1, N'MY', N'LZ', 2026, 6, N'MY01000006LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("BP01000001LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None)); // other island / prefix untouched
        Assert.Equal("MY01000001LZ", await db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1, StageName = "RDIP", IslandCode = "LZ", YearStart = 2026
        }, CancellationToken.None)); // MY ids are never reused
        Assert.Equal("P01000004LZ", await db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1, StageName = "NEP", IslandCode = "LZ", YearStart = 2026
        }, CancellationToken.None));
        Assert.Equal(2, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tProjectIdReleased;"));
    }

    // 2026-10-31 (Multi-Year module): a planning project's MY id lives in dbo.tMultiYearProject only,
    // and still holds its number. Every other test in this file runs WITHOUT that table, which is the
    // "server before Migration.MultiYear.Schema" case: generation must not change there.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AvoidsANumberAPlanningProjectHolds()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection,
            "CREATE TABLE dbo.tMultiYearProject (Id int IDENTITY PRIMARY KEY, ProjectId nvarchar(20) NOT NULL UNIQUE);" +
            "INSERT dbo.tMultiYearProject (ProjectId) VALUES (N'MY01000001LZ'), (N'MY01000002LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        // The counter hands out 1; its MY form belongs to a planning project, and so does 2. The MY
        // counter is its own bucket and jumps the same way (BP01000003LZ was returned, never saved).
        Assert.Equal("BP01000003LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
        Assert.Equal("MY01000003LZ", await db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1, StageName = "RDIP", IslandCode = "LZ", YearStart = 2026
        }, CancellationToken.None));
    }

    // Phase 2: an annual project's Multi Year ID is how the GAA update finds a planning project, so a
    // new MY id never takes a number written there. BP and P are unaffected (they never become MY).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_NewMyId_AvoidsANumberUsedAsAMultiYearId()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection,
            "INSERT INTO dbo.tProjects (ProjectPK, MYId) VALUES (N'HOST_LEGACY_1', N' MY01000001LZ ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        Assert.Equal("MY01000002LZ", await db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1, StageName = "RDIP", IslandCode = "LZ", YearStart = 2026
        }, CancellationToken.None));
        Assert.Equal("BP01000001LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_WithoutTheReleasedTable_UsesTheCounterAsBefore()
    {
        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);
        Assert.Equal("BP01000001LZ", await db.GenerateProjectID(BpLz2026, CancellationToken.None));
    }

    /// <summary>The table exactly as Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql creates it.</summary>
    private static readonly string ReleasedTableSql = ExtractReleasedTableDdl();

    private static string ExtractReleasedTableDdl()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            string path = Path.Combine(dir.FullName, "Main", "Resources", "Internal", "SQLScripts", "Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql");
            if (!File.Exists(path)) continue;
            string script = File.ReadAllText(path);
            int start = script.IndexOf("CREATE TABLE dbo.tProjectIdReleased", StringComparison.Ordinal);
            int end = script.IndexOf(");", start, StringComparison.Ordinal) + 2;
            return script[start..end];
        }
        throw new FileNotFoundException("Migration.DeleteRulesAndProjectIdReuse.2026-10-29.sql not found above the test output folder.");
    }

    private static async Task<int> ScalarAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<(int Start, int End)> ReserveBlockAsync(SqlConnection connection, int count, int categoryId = 1, string suffix = "BP", string islandCode = "LZ", int yearStart = 2026)
    {
        await using var command = new SqlCommand("dbo.pReserveProjectIdBlock", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@CategoryId", SqlDbType.Int) { Value = categoryId });
        command.Parameters.Add(new SqlParameter("@Suffix", SqlDbType.NVarChar, 2) { Value = suffix });
        command.Parameters.Add(new SqlParameter("@IslandCode", SqlDbType.NVarChar, 2) { Value = islandCode });
        command.Parameters.Add(new SqlParameter("@YearStart", SqlDbType.Int) { Value = yearStart });
        command.Parameters.Add(new SqlParameter("@Count", SqlDbType.Int) { Value = count });
        var rangeStart = new SqlParameter("@RangeStart", SqlDbType.Int) { Direction = ParameterDirection.Output };
        var rangeEnd = new SqlParameter("@RangeEnd", SqlDbType.Int) { Direction = ParameterDirection.Output };
        command.Parameters.Add(rangeStart);
        command.Parameters.Add(rangeEnd);
        await command.ExecuteNonQueryAsync();
        return ((int)rangeStart.Value, (int)rangeEnd.Value);
    }

    // Mirrors the exact check added at ProgramController.cs (RISK-105/RISK-111 fix): does the
    // computed post-swap ProjectId already exist as another project's ProjectPK, or as another
    // non-deleted project revision's ProjectId?
    private static async Task<bool> DetectionQueryFindsCollisionAsync(SqlConnection connection, string swappedProjectId)
    {
        const string sql = """
            SELECT
                (SELECT COUNT(*) FROM dbo.tProjects WHERE ProjectPK = @ProjectId) +
                (SELECT COUNT(*) FROM dbo.tProjectRevisions WHERE ProjectId = @ProjectId AND IsDeleted = 0);
            """;
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add(new SqlParameter("@ProjectId", SqlDbType.NVarChar, 200) { Value = swappedProjectId });
        int matchCount = (int)await command.ExecuteScalarAsync();
        return matchCount > 0;
    }

    private static async Task ExecuteNonQueryAsync(SqlConnection connection, string sql, SqlTransaction? transaction = null)
    {
        await using var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, sql);
    }

    private const string SchemaSql = """
        CREATE TABLE dbo.tOptionProjectCategory(CategoryId int NOT NULL PRIMARY KEY, Minimum int NOT NULL, Maximum int NULL);
        CREATE TABLE dbo.tProjectIdSequence(CategoryId int NOT NULL, Suffix nvarchar(2) NOT NULL, IslandCode nvarchar(2) NOT NULL, YearStart int NOT NULL, CurrentSequence int NOT NULL, UpdatedDate datetime NOT NULL, CONSTRAINT UQ_tProjectIdSequence UNIQUE (CategoryId, Suffix, IslandCode, YearStart));
        CREATE TABLE dbo.tProjects(ProjectPK nvarchar(200) NOT NULL PRIMARY KEY, MYId nvarchar(200) NULL);
        CREATE TABLE dbo.tProjectRevisions(Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProjectId nvarchar(200) NOT NULL, IsDeleted bit NOT NULL);
        """;

    // Byte-for-byte the live dbo.pReserveProjectIdBlock definition, pulled fresh from myps_db_dev
    // via OBJECT_DEFINITION -- updated 2026-09-08 to include the Maximum-exhaustion guard added
    // that day (RISK-072 follow-up; the prior 2026-08-31 snapshot predates it).
    private const string ProcedureSql = """
        CREATE PROCEDURE dbo.pReserveProjectIdBlock
            @CategoryId  INT,
            @Suffix      NVARCHAR(2),
            @IslandCode  NVARCHAR(2),
            @YearStart   INT,
            @Count       INT,
            @RangeStart  INT OUTPUT,
            @RangeEnd    INT OUTPUT
        AS
        BEGIN
            SET NOCOUNT ON;

            IF NOT EXISTS (
                SELECT 1 FROM dbo.tProjectIdSequence
                WHERE CategoryId = @CategoryId AND Suffix = @Suffix AND IslandCode = @IslandCode AND YearStart = @YearStart
            )
            BEGIN
                DECLARE @Min INT = (SELECT Minimum FROM dbo.tOptionProjectCategory WHERE CategoryId = @CategoryId);
                IF @Min IS NULL
                BEGIN
                    RAISERROR('pReserveProjectIdBlock: CategoryId %d has no Minimum defined in tOptionProjectCategory.', 16, 1, @CategoryId);
                    RETURN;
                END

                BEGIN TRY
                    INSERT INTO dbo.tProjectIdSequence (CategoryId, Suffix, IslandCode, YearStart, CurrentSequence, UpdatedDate)
                    VALUES (@CategoryId, @Suffix, @IslandCode, @YearStart, @Min - 1, GETDATE());
                END TRY
                BEGIN CATCH
                    IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
                END CATCH
            END

            DECLARE @Range TABLE (OldSeq INT, NewSeq INT);

            UPDATE dbo.tProjectIdSequence WITH (UPDLOCK, HOLDLOCK)
                SET CurrentSequence = CurrentSequence + @Count,
                    UpdatedDate = GETDATE()
                OUTPUT DELETED.CurrentSequence, INSERTED.CurrentSequence INTO @Range(OldSeq, NewSeq)
            WHERE CategoryId = @CategoryId AND Suffix = @Suffix AND IslandCode = @IslandCode AND YearStart = @YearStart;

            SELECT @RangeStart = OldSeq + 1, @RangeEnd = NewSeq FROM @Range;

            DECLARE @Max INT = (SELECT Maximum FROM dbo.tOptionProjectCategory WHERE CategoryId = @CategoryId);
            IF @Max IS NOT NULL AND @RangeEnd > @Max
            BEGIN
                RAISERROR('PROJECTID_RANGE_EXHAUSTED: CategoryId %d (Suffix=%s, IslandCode=%s, YearStart=%d) has exhausted its ID range. Maximum=%d, attempted RangeEnd=%d.', 16, 1, @CategoryId, @Suffix, @IslandCode, @YearStart, @Max, @RangeEnd);
                RETURN;
            END
        END;
        """;
}
