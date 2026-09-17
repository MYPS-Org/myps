using Microsoft.Data.SqlClient;
using System.Data;
using Xunit;

namespace MYPS.DatabaseTests;

public sealed class RecomputeProgramCostTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, SchemaSql);
        await ExecuteNonQueryAsync(connection, RevisionSchemaSql);
        await ExecuteNonQueryAsync(connection, FRevisionApprovalStatusSql);
        await ExecuteNonQueryAsync(connection, FProjectEffectiveRevisionSql);
        await ExecuteNonQueryAsync(connection, FProjectFundingProfileSql);
        await ExecuteNonQueryAsync(connection, ProcedureSql);
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_ReturnsContractAndExcludesLsAndPriorStage()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("dbo.pRecomputeProgramCost", connection) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@ProgramPK", SqlDbType.NVarChar, 200) { Value = "PROGRAM-1" });
        await using SqlDataReader reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(new[] { "RevisionId", "StageId", "NewCost" }, Enumerable.Range(0, reader.FieldCount).Select(reader.GetName));
        Assert.Equal(1, reader.GetInt32(0));
        Assert.Equal(2, reader.GetInt32(1));
        Assert.Equal(100.00m, reader.GetDecimal(2));
        Assert.False(await reader.ReadAsync());
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_UpdateRollsBackWithCallingTransaction()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using SqlTransaction transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        await ExecuteNonQueryAsync(connection, "UPDATE dbo.tProjectFundingProfile SET Amount = 250 WHERE ProjectRevisionFK = 101;", transaction);
        await ExecuteProcedureAsync(connection, transaction, "PROGRAM-1");
        Assert.Equal(250.00m, await ReadProgramCostAsync(connection, transaction));
        await transaction.RollbackAsync();
        Assert.Equal(0.00m, await ReadProgramCostAsync(connection, null));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_MissingRevisionThrowsSpecificSqlError()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        SqlException error = await Assert.ThrowsAsync<SqlException>(() => ExecuteProcedureAsync(connection, null, "MISSING"));
        // RAISERROR with an ad hoc message string (not a sys.messages id) always reports 50000 --
        // the live proc's IF @CurrentRevisionId IS NULL branch uses RAISERROR, not THROW.
        Assert.Equal(50000, error.Number);
        Assert.Contains("has no revisions to recompute Cost for", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_IsSafeUnderConcurrentRecomputation()
    {
        await SeedProgramAsync();
        Task<decimal>[] tasks = Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var connection = new SqlConnection(ConnectionString);
            await connection.OpenAsync();
            await ExecuteProcedureAsync(connection, null, "PROGRAM-1");
            return await ReadProgramCostAsync(connection, null);
        }).ToArray();
        decimal[] results = await Task.WhenAll(tasks);
        Assert.All(results, value => Assert.Equal(100.00m, value));
    }

    // RISK-108/ADR-132/ADR-133: the live proc used to join tProjectFundingProfile (base) directly,
    // completely blind to an approved Formal Revision's funding changes. This test is the
    // regression guard for that exact defect class -- PROJECT-NORMAL's base funding stays 100, its
    // fully-approved revision's funding is 400; the correct Program total is 400, not 100. Before
    // the fix, this test would have failed (asserting 100).
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_UsesEffectiveRevisionFundingNotBaseWhenFullyApproved()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        const string seedRevisionSql = """
            INSERT dbo.tRevisionDetails(Id, ProjectFK, ProjectRevisionFK) VALUES (201, N'PROJECT-NORMAL', 101);
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES (201, 'RO', 1), (201, 'CO', 1);
            INSERT dbo.tRevisionProjectFundingProfile(RevisionDetailFK, Amount, IsDeleted) VALUES (201, 400, 0);
            """;
        await ExecuteNonQueryAsync(connection, seedRevisionSql);

        await ExecuteProcedureAsync(connection, null, "PROGRAM-1");

        Assert.Equal(400.00m, await ReadProgramCostAsync(connection, null));
    }

    // Same scenario, but the revision is only half-approved (RO=1, CO=0 -- not yet effective).
    // The base funding (100) must still be what counts, proving the overlay only activates once
    // BOTH approvals are in, matching fRevisionApprovalStatus.IsFullyApproved's real semantics.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_IgnoresRevisionFundingWhenNotYetFullyApproved()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();

        const string seedRevisionSql = """
            INSERT dbo.tRevisionDetails(Id, ProjectFK, ProjectRevisionFK) VALUES (202, N'PROJECT-NORMAL', 101);
            INSERT dbo.tRevisionApprovals(RevisionDetailFK, Level, Status) VALUES (202, 'RO', 1), (202, 'CO', 0);
            INSERT dbo.tRevisionProjectFundingProfile(RevisionDetailFK, Amount, IsDeleted) VALUES (202, 400, 0);
            """;
        await ExecuteNonQueryAsync(connection, seedRevisionSql);

        await ExecuteProcedureAsync(connection, null, "PROGRAM-1");

        Assert.Equal(100.00m, await ReadProgramCostAsync(connection, null));
    }

    // ADR-055: the program's Lump Sum appropriations (dbo.vLumpSumSet.OriginalAllocation) add on
    // top of non-LS project funding. Base project funding here is 100 (PROJECT-NORMAL only --
    // PROJECT-LS is excluded by ProjectType, PROJECT-OLD by stage); a 500 Lump Sum allocation
    // against PROGRAM-1 should bring the total to 600.
    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task Procedure_AddsLumpSumAllocationOnTopOfProjectFunding()
    {
        await SeedProgramAsync();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, "INSERT dbo.vLumpSumSet(ProgramFK, OriginalAllocation) VALUES (N'PROGRAM-1', 500);");

        await ExecuteProcedureAsync(connection, null, "PROGRAM-1");

        Assert.Equal(600.00m, await ReadProgramCostAsync(connection, null));
    }

    private async Task SeedProgramAsync()
    {
        const string sql = """
            INSERT dbo.tProgramRevisions(Id, ProgramFK, Cost) VALUES (1, N'PROGRAM-1', 0);
            INSERT dbo.tProgramStages(RevisionId, StageId) VALUES (1, 2);
            INSERT dbo.tProjects(ProjectPK, ProjectType) VALUES
                (N'PROJECT-NORMAL', N'LZ'), (N'PROJECT-LS', N'LS'), (N'PROJECT-OLD', N'LZ');
            INSERT dbo.tProjectStages(ProjectFK, ProgramFK, RevisionId, StageId) VALUES
                (N'PROJECT-NORMAL', N'PROGRAM-1', 101, 2),
                (N'PROJECT-LS', N'PROGRAM-1', 102, 2),
                (N'PROJECT-OLD', N'PROGRAM-1', 103, 1);
            INSERT dbo.tProjectFundingProfile(ProjectRevisionFK, Amount, IsDeleted) VALUES
                (101, 100, 0), (102, 900, 0), (103, 50, 0);
            """;
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await ExecuteNonQueryAsync(connection, sql);
    }

    private static async Task ExecuteProcedureAsync(SqlConnection connection, SqlTransaction? transaction, string programPk)
    {
        await using var command = new SqlCommand("dbo.pRecomputeProgramCost", connection, transaction) { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new SqlParameter("@ProgramPK", SqlDbType.NVarChar, 200) { Value = programPk });
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<decimal> ReadProgramCostAsync(SqlConnection connection, SqlTransaction? transaction)
    {
        await using var command = new SqlCommand("SELECT Cost FROM dbo.tProgramRevisions WHERE Id = 1", connection, transaction);
        return Convert.ToDecimal(await command.ExecuteScalarAsync());
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
        CREATE TABLE dbo.tProgramRevisions(Id int NOT NULL PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, Cost decimal(18,2) NULL);
        CREATE TABLE dbo.tProgramStages(Id int IDENTITY PRIMARY KEY, RevisionId int NOT NULL, StageId int NOT NULL);
        CREATE TABLE dbo.tProjects(ProjectPK nvarchar(200) NOT NULL PRIMARY KEY, ProjectType nvarchar(20) NOT NULL);
        CREATE TABLE dbo.tProjectStages(Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProgramFK nvarchar(200) NOT NULL, RevisionId int NOT NULL, StageId int NOT NULL);
        CREATE TABLE dbo.tProjectFundingProfile(Id int IDENTITY PRIMARY KEY, ProjectRevisionFK int NOT NULL, Amount decimal(18,5) NOT NULL, IsDeleted bit NOT NULL);
        -- Minimal stand-in for the live dbo.vLumpSumSet view: pRecomputeProgramCost only ever
        -- reads ProgramFK/OriginalAllocation from it (ADR-055), so a plain table with just those
        -- two columns is enough to exercise the real dependency without reproducing the view.
        CREATE TABLE dbo.vLumpSumSet(ProgramFK nvarchar(200) NOT NULL, OriginalAllocation decimal(18,5) NOT NULL);
        """;

    // Minimal, behaviorally-faithful slice of the Formal Revision schema/functions -- just enough
    // to exercise pRecomputeProgramCost's real dependency chain (fProjectFundingProfile ->
    // fProjectEffectiveRevision -> fRevisionApprovalStatus), not a full reproduction of the live
    // objects' every column/audit field.
    private const string RevisionSchemaSql = """
        CREATE TABLE dbo.tRevisionDetails(Id int NOT NULL PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProjectRevisionFK int NOT NULL);
        CREATE TABLE dbo.tRevisionApprovals(RevisionDetailFK int NOT NULL, Level nvarchar(2) NOT NULL, Status int NOT NULL);
        CREATE TABLE dbo.tRevisionProjectFundingProfile(Id int IDENTITY PRIMARY KEY, RevisionDetailFK int NOT NULL, Amount decimal(18,5) NOT NULL, IsDeleted bit NOT NULL);
        """;

    private const string FRevisionApprovalStatusSql = """
        CREATE FUNCTION dbo.fRevisionApprovalStatus(@RevisionDetailFK INT)
        RETURNS TABLE AS RETURN
        (
            SELECT
                ISNULL(MAX(CASE WHEN Level = 'RO' THEN Status END), 0) AS ROStatus,
                ISNULL(MAX(CASE WHEN Level = 'CO' THEN Status END), 0) AS COStatus,
                CASE WHEN ISNULL(MAX(CASE WHEN Level = 'RO' THEN Status END), 0) = 1
                      AND ISNULL(MAX(CASE WHEN Level = 'CO' THEN Status END), 0) = 1
                     THEN 1 ELSE 0 END AS IsFullyApproved
            FROM dbo.tRevisionApprovals WHERE RevisionDetailFK = @RevisionDetailFK
        );
        """;

    private const string FProjectEffectiveRevisionSql = """
        CREATE FUNCTION dbo.fProjectEffectiveRevision(@ProjectPK NVARCHAR(200))
        RETURNS TABLE AS RETURN
        (
            SELECT TOP (1) rd.Id AS RevisionDetailFK
            FROM dbo.tRevisionDetails rd
            CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) apst
            WHERE rd.ProjectFK = @ProjectPK AND apst.IsFullyApproved = 1
            ORDER BY rd.Id DESC
        );
        """;

    // Simplified stand-in for the live fProjectFundingProfile: same UseRevision branching (overlay
    // tRevisionProjectFundingProfile when an effective revision exists, else fall back to base
    // tProjectFundingProfile), trimmed of the audit-field CreatedBy/Name joins this proc never reads.
    private const string FProjectFundingProfileSql = """
        CREATE FUNCTION dbo.fProjectFundingProfile(@ProjectPK NVARCHAR(200), @StageId INT)
        RETURNS TABLE AS RETURN
        (
            SELECT rfp.Amount
            FROM dbo.fProjectEffectiveRevision(@ProjectPK) eff
            JOIN dbo.tRevisionProjectFundingProfile rfp ON rfp.RevisionDetailFK = eff.RevisionDetailFK AND rfp.IsDeleted = 0

            UNION ALL

            SELECT fp.Amount
            FROM dbo.tProjectStages ps
            JOIN dbo.tProjectFundingProfile fp ON fp.ProjectRevisionFK = ps.RevisionId AND fp.IsDeleted = 0
            WHERE ps.ProjectFK = @ProjectPK AND ps.StageId = @StageId
              AND NOT EXISTS (SELECT 1 FROM dbo.fProjectEffectiveRevision(@ProjectPK))
        );
        """;

    // 2026-09-15: byte-for-byte the same procedure body now deployed live and checked in at
    // Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql, not a
    // hand-maintained parallel implementation. Keeping the two in sync by copy is exactly the
    // discipline that failed before (RISK-108's fix landed only here for a week while the live
    // object stayed on the pre-fix join) -- this comment is the trip-wire for whoever edits one
    // copy without the other next.
    private const string ProcedureSql = """
        CREATE PROCEDURE dbo.pRecomputeProgramCost
            @ProgramPK NVARCHAR(200)
        AS
        BEGIN
            SET NOCOUNT ON;

            DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @NewCost DECIMAL(18,2);

            SELECT TOP 1 @CurrentRevisionId = pgr.Id, @CurrentStageId = pgs.StageId
            FROM dbo.tProgramRevisions pgr
            JOIN dbo.tProgramStages pgs ON pgs.RevisionId = pgr.Id
            WHERE pgr.ProgramFK = @ProgramPK
            ORDER BY pgr.Id DESC;

            IF @CurrentRevisionId IS NULL
            BEGIN
                RAISERROR('pRecomputeProgramCost: program %s has no revisions to recompute Cost for.', 16, 1, @ProgramPK);
                RETURN;
            END

            -- RISK-108 fix: CROSS APPLY the effective-revision-aware function so an approved
            -- Formal Revision's funding overlays base, instead of a direct join that was blind to it.
            SELECT @NewCost = ISNULL(SUM(fp.Amount), 0)
            FROM dbo.tProjectStages ps
            JOIN dbo.tProjects prj ON prj.ProjectPK = ps.ProjectFK
            CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId) fp
            WHERE ps.ProgramFK = @ProgramPK
              AND ps.StageId = @CurrentStageId
              AND prj.ProjectType <> N'LS';

            -- ADR-055: Program Total = non-LS project funding + the program's Lump Sum
            -- appropriations. Lump Sum Projects follow their program's stage, so all of
            -- the program's are the current-stage set.
            SET @NewCost = @NewCost + ISNULL((SELECT SUM(ls.OriginalAllocation)
                                              FROM dbo.vLumpSumSet ls
                                              WHERE ls.ProgramFK = @ProgramPK), 0);

            UPDATE dbo.tProgramRevisions
            SET Cost = @NewCost
            WHERE Id = @CurrentRevisionId;

            SELECT @CurrentRevisionId AS RevisionId, @CurrentStageId AS StageId, @NewCost AS NewCost;
        END
        """;
}
