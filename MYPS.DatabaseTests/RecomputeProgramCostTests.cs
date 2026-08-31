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
        Assert.Equal(new[] { "RevisionId", "NewCost" }, Enumerable.Range(0, reader.FieldCount).Select(reader.GetName));
        Assert.Equal(1, reader.GetInt32(0));
        Assert.Equal(100.00m, reader.GetDecimal(1));
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
        Assert.Equal(50001, error.Number);
        Assert.Contains("Program has no revisions", error.Message, StringComparison.Ordinal);
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

    private const string ProcedureSql = """
        CREATE PROCEDURE dbo.pRecomputeProgramCost @ProgramPK NVARCHAR(200)
        AS
        BEGIN
            SET NOCOUNT ON; SET XACT_ABORT ON;
            DECLARE @CurrentRevisionId INT, @CurrentStageId INT, @NewCost DECIMAL(38,5) = 0;
            SELECT TOP (1) @CurrentRevisionId = pr.Id FROM dbo.tProgramRevisions pr WHERE pr.ProgramFK = @ProgramPK ORDER BY pr.Id DESC;
            IF @CurrentRevisionId IS NULL THROW 50001, 'pRecomputeProgramCost: Program has no revisions.', 1;
            SELECT TOP (1) @CurrentStageId = ps.StageId FROM dbo.tProgramStages ps WHERE ps.RevisionId = @CurrentRevisionId ORDER BY ps.Id DESC;
            IF @CurrentStageId IS NULL THROW 50002, 'pRecomputeProgramCost: Current program revision has no stage.', 1;
            -- RISK-108 fix: CROSS APPLY the effective-revision-aware function, not a direct base-table join.
            SELECT @NewCost = COALESCE(SUM(CONVERT(DECIMAL(38,5), ffp.Amount)), 0)
            FROM dbo.tProjectStages ps
            INNER JOIN dbo.tProjects p ON p.ProjectPK = ps.ProjectFK
            CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId) ffp
            WHERE ps.ProgramFK = @ProgramPK AND ps.StageId = @CurrentStageId AND p.ProjectType <> N'LS' OPTION (RECOMPILE);
            -- Unconditional UPDATE, matching the live proc exactly (ADR-132 flagged this embedded
            -- copy as having drifted to a conditional WHERE -- fixed here, not left wrong).
            UPDATE dbo.tProgramRevisions SET Cost = CONVERT(DECIMAL(18,2), @NewCost)
            WHERE Id = @CurrentRevisionId;
            -- 2-column result (RevisionId, NewCost), matching the live proc's actual output
            -- contract -- the embedded copy's StageId column was never in the live version.
            SELECT @CurrentRevisionId AS RevisionId, CONVERT(DECIMAL(18,2), @NewCost) AS NewCost;
        END;
        """;
}
