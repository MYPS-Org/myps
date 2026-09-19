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

    // RISK-072 follow-up (2026-09-19): the retry cap is a deliberate, small circuit breaker (3
    // attempts, not 100) -- once it's exhausted, GenerateProjectID must still fail loudly with the
    // dedicated exception (not hang, not silently mint a duplicate), naming the last value tried.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_ThrowsProjectIdCollisionExceptionAfterExhaustingTheRetryCap()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        // Occupy all 3 values the retry loop will try (sequence 1, 2, 3) so every attempt collides.
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        await using var db = new MYPSDbContext(options);

        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        var ex = await Assert.ThrowsAsync<ProjectHelper.ProjectIdCollisionException>(
            () => db.GenerateProjectID(request, CancellationToken.None));
        Assert.Equal("BP01000003LZ", ex.ProjectId);
        Assert.Contains("still colliding after 3 attempts", ex.Message);
    }

    // The core regression test for the 2026-09-19 durability fix, adapted for the retry loop:
    // dbo.pReserveProjectIdBlock's counter increment previously shared the caller's ambient EF
    // transaction (no BEGIN TRAN/COMMIT of its own in the proc), so a later
    // transaction.RollbackAsync() silently undid every attempted reservation -- meaning even after
    // exhausting the retry cap and rolling back, the NEXT call would repeat the exact same 3
    // already-tried values forever. The fix runs each reservation on its own dedicated connection.
    // Proves it: exhaust the retry cap inside an ambient transaction that then rolls back, then
    // confirm the next call gets a genuinely fresh value (all 3 prior attempts stayed durable).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GenerateProjectID_AllRetriedReservationsSurviveCallerTransactionRollback()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT INTO dbo.tProjects (ProjectPK) VALUES (N'BP01000001LZ'), (N'BP01000002LZ'), (N'BP01000003LZ');");

        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options;
        var request = new ProjectHelper.GenerateProjectIDParams
        {
            CategoryId = 1,
            StageName = "BP",
            IslandCode = "LZ",
            YearStart = 2026
        };

        // Simulate AddProject: an ambient transaction is open when GenerateProjectID is called
        // (and exhausts its retry cap), and gets rolled back in the catch block when it throws.
        await using (var db = new MYPSDbContext(options))
        {
            await using var ambientTransaction = await db.Database.BeginTransactionAsync();
            await Assert.ThrowsAsync<ProjectHelper.ProjectIdCollisionException>(
                () => db.GenerateProjectID(request, CancellationToken.None));
            await ambientTransaction.RollbackAsync();
        }

        // If any of the 3 attempted reservations were rolled back too (the bug), this next call
        // would repeat one of BP01000001LZ/2LZ/3LZ. With the fix, all 3 advanced independently.
        await using var db2 = new MYPSDbContext(options);
        string nextId = await db2.GenerateProjectID(request, CancellationToken.None);
        Assert.Equal("BP01000004LZ", nextId);
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
        CREATE TABLE dbo.tProjects(ProjectPK nvarchar(200) NOT NULL PRIMARY KEY);
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
