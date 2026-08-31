using Microsoft.Data.SqlClient;
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
        CREATE TABLE dbo.tOptionProjectCategory(CategoryId int NOT NULL PRIMARY KEY, Minimum int NOT NULL);
        CREATE TABLE dbo.tProjectIdSequence(CategoryId int NOT NULL, Suffix nvarchar(2) NOT NULL, IslandCode nvarchar(2) NOT NULL, YearStart int NOT NULL, CurrentSequence int NOT NULL, UpdatedDate datetime NOT NULL, CONSTRAINT UQ_tProjectIdSequence UNIQUE (CategoryId, Suffix, IslandCode, YearStart));
        CREATE TABLE dbo.tProjects(ProjectPK nvarchar(200) NOT NULL PRIMARY KEY);
        CREATE TABLE dbo.tProjectRevisions(Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProjectId nvarchar(200) NOT NULL, IsDeleted bit NOT NULL);
        """;

    // Byte-for-byte the live dbo.pReserveProjectIdBlock definition, pulled fresh from myps_db_dev
    // via OBJECT_DEFINITION during this pass (2026-08-31) -- not paraphrased.
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
        END;
        """;
}
