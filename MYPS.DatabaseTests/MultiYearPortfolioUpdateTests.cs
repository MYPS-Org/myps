using DBHelper.Data;
using DBHelper.Models.Enums;
using Helpers;
using Helpers.MultiYear;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MYPS.DatabaseTests;

/*  Helpers/MultiYear/PortfolioGaaUpdate.cs end to end on a disposable MYPS_Test_ database: the
    Multi-Year scripts as written, plus the few annual-program columns the update reads (the live
    dbo.fRevisionApprovalStatus copied). Covers what the API smoke on myps_db_dev could not: the
    re-run after a Non-Implementable revision (MY-PFL-22, decision 2) and a GAA project added to PIP
    with its cost from the GAA's yearly rows (MY-PFL-21).
    Plan: documents/plans/multi-year-phase-2-annual-program-linking.md. */
public sealed class MultiYearPortfolioUpdateTests : IAsyncLifetime
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);

    private const string AnnualTablesSql = """
        CREATE TABLE dbo.tPrograms (ProgramPK nvarchar(200) NOT NULL PRIMARY KEY, StartYear int NOT NULL, IsDeleted bit NOT NULL DEFAULT 0);
        CREATE TABLE dbo.tProgramRevisions (Id int IDENTITY PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, Name nvarchar(200) NOT NULL, Status int NOT NULL);
        CREATE TABLE dbo.tProgramStages (Id int IDENTITY PRIMARY KEY, ProgramFK nvarchar(200) NOT NULL, StageId int NOT NULL, StageName nvarchar(20) NOT NULL, RevisionId int NOT NULL);
        CREATE TABLE dbo.tOptionProgramStage (Id int NOT NULL PRIMARY KEY, StageHierarchy decimal(7,5) NOT NULL);
        INSERT dbo.tOptionProgramStage VALUES (8, 0.5), (1, 1.0), (6, 1.5), (7, 1.6);
        CREATE TABLE dbo.tProjects (ProjectPK nvarchar(200) NOT NULL PRIMARY KEY, MYId nvarchar(200) NULL);
        CREATE TABLE dbo.tProjectRevisions (Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProjectId nvarchar(200) NOT NULL, IsDeleted bit NOT NULL DEFAULT 0,
            Description nvarchar(max) NOT NULL, Category int NOT NULL, Thrust int NULL, Region nvarchar(20) NULL, Province nvarchar(20) NULL, City nvarchar(20) NULL,
            LegislativeDistrict nvarchar(20) NULL, DEO nvarchar(20) NULL, ImplementingOffice nvarchar(20) NULL, RegionWide int NOT NULL DEFAULT 2, IslandCode nvarchar(2) NULL);
        CREATE TABLE dbo.tProjectStages (Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, ProgramFK nvarchar(200) NOT NULL, StageId int NOT NULL, RevisionId int NOT NULL);
        CREATE TABLE dbo.tProjectComponentCost (Id int IDENTITY PRIMARY KEY, ProjectRevisionFK int NOT NULL, IsDeleted bit NOT NULL DEFAULT 0);
        CREATE TABLE dbo.tProjectComponentCostPerYear (Id int IDENTITY PRIMARY KEY, ComponentCostFK int NOT NULL, [Year] int NOT NULL, Amount decimal(18,5) NOT NULL, IsDeleted bit NOT NULL DEFAULT 0);
        CREATE TABLE dbo.tRevisionDetails (Id int IDENTITY PRIMARY KEY, ProjectFK nvarchar(200) NOT NULL, RevisionGroupId int NOT NULL, ReasonId int NOT NULL);
        CREATE TABLE dbo.tRevisionApprovals (Id int IDENTITY PRIMARY KEY, RevisionDetailFK int NOT NULL, Level nvarchar(5) NOT NULL, Status int NOT NULL);
        CREATE TABLE dbo.tOptionRevisionStatus (NameId int NOT NULL PRIMARY KEY, Name nvarchar(50) NOT NULL);
        """;

    // Byte-for-byte the live dbo.fRevisionApprovalStatus (myps_db_dev, 2026-11-01).
    private const string ApprovalFunctionSql = """
        CREATE FUNCTION [dbo].[fRevisionApprovalStatus] (@RevisionDetailFK INT)
        RETURNS TABLE
        AS
        RETURN
        (
            SELECT
                ISNULL(MAX(CASE WHEN ra.Level = N'RO' THEN ra.Status END), 0) AS ROStatus,
                MAX(CASE WHEN ra.Level = N'RO' THEN rs.Name END) AS ROStatusName,
                ISNULL(MAX(CASE WHEN ra.Level = N'CO' THEN ra.Status END), 0) AS COStatus,
                MAX(CASE WHEN ra.Level = N'CO' THEN rs.Name END) AS COStatusName,
                CASE
                    WHEN MAX(CASE WHEN ra.Level = N'RO' THEN ra.Status END) = 1
                     AND MAX(CASE WHEN ra.Level = N'CO' THEN ra.Status END) = 1
                    THEN 1 ELSE 0
                END AS IsFullyApproved,
                CASE
                    WHEN MAX(CASE WHEN ra.Level = N'RO' THEN ra.Status END) = 2
                      OR MAX(CASE WHEN ra.Level = N'CO' THEN ra.Status END) = 2
                    THEN 1 ELSE 0
                END AS IsDisapproved
            FROM dbo.tRevisionApprovals ra
            LEFT JOIN dbo.tOptionRevisionStatus rs ON rs.NameId = ra.Status
            WHERE ra.RevisionDetailFK = @RevisionDetailFK
              AND ra.Level IN (N'RO', N'CO')
        );
        """;

    public async Task InitializeAsync()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, AnnualTablesSql);
        await ExecuteAsync(connection, ApprovalFunctionSql);
        foreach (string script in new[] { MultiYearSchemaTests.SchemaScript, MultiYearSchemaTests.LinkingScript })
        {
            string path = Path.Combine(FindRepositoryDirectory("Main/Resources/MultiYear/SQL"), script);
            foreach (Helpers.SqlBatch batch in SqlBatchSplitter.Split(await File.ReadAllTextAsync(path)))
                for (int i = 0; i < batch.Repeat; i++)
                    await ExecuteAsync(connection, batch.Text);
        }
    }

    public async Task DisposeAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task GaaApproval_MovesMemberships_AddsUnlinkedToPip_ThenAWithdrawnEntrySendsItBackToNew()
    {
        await using var connection = await OpenAsync();
        // An open RDIP and PIP for 2095-2100; a planning project, Potential, in the RDIP.
        int rdip = await ScalarAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) OUTPUT INSERTED.Id VALUES (1, N'R03', 2095, N't');");
        int pip = await ScalarAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) OUTPUT INSERTED.Id VALUES (3, NULL, 2095, N't');");
        int project = await ScalarAsync(connection, """
            INSERT dbo.tMultiYearProject (ProjectId, Description, Category, IslandCode, HorizonTypeFK, StartYear, OriginalCost, CurrentCost, CreatedBy)
            OUTPUT INSERTED.Id VALUES (N'MY07900001LZ', N'Planned road', 5, N'LZ', (SELECT Id FROM dbo.tOptionMultiYearType WHERE Years = 6), 2095, 100, 100, N't');
            """);
        int member = await ScalarAsync(connection, $"INSERT dbo.tMultiYearPortfolioMember (PortfolioFK, MultiYearProjectFK, IsOwner, Status, StartYear, Cost, CreatedBy) OUTPUT INSERTED.Id VALUES ({rdip}, {project}, 1, 2, 2095, 100, N't');");

        // An approved GAA 2095 holding the planned road (by its Multi Year ID) and a GAA project whose
        // Multi Year ID matches no planning project, with 2095 and 2096 costs.
        await ExecuteAsync(connection, """
            INSERT dbo.tPrograms (ProgramPK, StartYear) VALUES (N'GAA95', 2095);
            INSERT dbo.tProgramRevisions (ProgramFK, Name, Status) VALUES (N'GAA95', N'GAA 2095', 1);
            INSERT dbo.tProgramStages (ProgramFK, StageId, StageName, RevisionId) VALUES (N'GAA95', 6, N'GAA', SCOPE_IDENTITY());
            INSERT dbo.tProjects (ProjectPK, MYId) VALUES (N'P07900001LZ', N' my07900001lz '), (N'P07900002LZ', N'MY07999002LZ');
            INSERT dbo.tProjectRevisions (ProjectFK, ProjectId, Description, Category, Region, IslandCode) VALUES
                (N'P07900001LZ', N'P07900001LZ', N'Planned road, GAA', 5, N'R03', N'LZ'),
                (N'P07900002LZ', N'P07900002LZ', N'Bridge not planned in an RDIP', 7, N'R03', N'LZ');
            INSERT dbo.tProjectStages (ProjectFK, ProgramFK, StageId, RevisionId)
                SELECT ProjectFK, N'GAA95', 6, Id FROM dbo.tProjectRevisions;
            INSERT dbo.tProjectComponentCost (ProjectRevisionFK) SELECT Id FROM dbo.tProjectRevisions;
            INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, [Year], Amount)
                SELECT c.Id, y.[Year], y.Amount FROM dbo.tProjectComponentCost c CROSS JOIN (VALUES (2095, 70), (2096, 30)) y ([Year], Amount);
            """);

        await using var db = NewContext();
        var first = await PortfolioGaaUpdate.RunAsync(db, 2095, EnumUpdateTrigger.GaaApproved, "GAA95", null, "tester", CancellationToken.None);
        Assert.NotNull(first);
        Assert.Equal((1, 1), (first!.StatusMoves, first.AddedToPip));
        Assert.Equal("3|2095", await StringAsync(connection, $"SELECT CAST(Status AS varchar) + '|' + CAST(StartYear AS varchar) FROM dbo.tMultiYearPortfolioMember WHERE Id = {member};"));
        // The unlinked GAA project: one record, Ongoing in PIP, cost and years from its GAA rows.
        Assert.Equal("3|100|100|2095|2096|7|GAA95", await StringAsync(connection, """
            SELECT CAST(m.Status AS varchar) + '|' + CAST(CAST(m.Cost AS int) AS varchar) + '|' + CAST(CAST(m.OriginalCost AS int) AS varchar) + '|'
                 + CAST(p.StartYear AS varchar) + '|' + CAST(p.EndYear AS varchar) + '|' + CAST(p.Category AS varchar) + '|' + p.OriginProgramFK
            FROM dbo.tMultiYearPortfolioMember m JOIN dbo.tMultiYearProject p ON p.Id = m.MultiYearProjectFK WHERE p.ProjectId = N'MY07999002LZ';
            """));
        Assert.Equal(pip, await ScalarAsync(connection, "SELECT m.PortfolioFK FROM dbo.tMultiYearPortfolioMember m JOIN dbo.tMultiYearProject p ON p.Id = m.MultiYearProjectFK WHERE p.ProjectId = N'MY07999002LZ';"));

        // MY-PFL-21: the same run again changes nothing and saves no new totals.
        int snapshots = await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tMultiYearTotalsSnapshot;");
        var again = await PortfolioGaaUpdate.RunAsync(db, 2095, EnumUpdateTrigger.OnRequest, null, null, "tester", CancellationToken.None);
        Assert.Equal((0, 0, 0, 0), (again!.StatusMoves, again.StartYearMoves, again.AddedToPip, again.TotalsSaved));
        Assert.Equal(snapshots, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tMultiYearTotalsSnapshot;"));

        // MY-PFL-22: a Non-Implementable revision of the planned road's GAA entry, approved by RO and CO.
        int revision = await ScalarAsync(connection, "INSERT dbo.tRevisionDetails (ProjectFK, RevisionGroupId, ReasonId) OUTPUT INSERTED.Id VALUES (N'P07900001LZ', 8, 24);");
        await ExecuteAsync(connection, $"INSERT dbo.tRevisionApprovals (RevisionDetailFK, Level, Status) VALUES ({revision}, N'RO', 1);");
        Assert.Null(await PortfolioGaaUpdate.AfterRevisionApprovalAsync(db, 9, 38, "P07900001LZ", "GAA95", revision, "tester", _ => { }, CancellationToken.None));
        await ExecuteAsync(connection, $"INSERT dbo.tRevisionApprovals (RevisionDetailFK, Level, Status) VALUES ({revision}, N'CO', 1);");

        var notice = await PortfolioGaaUpdate.AfterRevisionApprovalAsync(db, 8, 24, "P07900001LZ", "GAA95", revision, "tester", ex => throw ex, CancellationToken.None);
        Assert.NotNull(notice);
        Assert.False(notice!.Failed);
        Assert.Equal("1|2096", await StringAsync(connection, $"SELECT CAST(Status AS varchar) + '|' + CAST(StartYear AS varchar) FROM dbo.tMultiYearPortfolioMember WHERE Id = {member};"));
        Assert.Equal(2096, await ScalarAsync(connection, $"SELECT StartYear FROM dbo.tMultiYearProject WHERE Id = {project};"));
        Assert.Equal(4, await ScalarAsync(connection, $"SELECT TOP 1 TriggerKind FROM dbo.tMultiYearUpdateRun ORDER BY Id DESC;"));
        Assert.StartsWith("Its GAA entry was withdrawn", await StringAsync(connection, $"SELECT TOP 1 Reason FROM dbo.tMultiYearMemberStatusLog WHERE MemberFK = {member} ORDER BY Id DESC;"));
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task AfterApproval_NeverThrows_AFailureIsANoticeAndRollsBack()
    {
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, "INSERT dbo.tMultiYearPortfolio (Kind, OwnerParticipantId, TermStartYear, CreatedBy) VALUES (1, N'R03', 2095, N't');");
        // tProjects without MYId: the update's read fails part-way.
        await ExecuteAsync(connection, "EXEC sp_rename 'dbo.tProjects.MYId', 'MYIdGone', 'COLUMN';");

        await using var db = NewContext();
        Exception? logged = null;
        var notice = await PortfolioGaaUpdate.AfterApprovalAsync(db, 2095, EnumUpdateTrigger.GaaApproved, "GAA95", null, "tester", ex => logged = ex, CancellationToken.None);

        Assert.NotNull(notice);
        Assert.True(notice!.Failed);
        Assert.Contains("did not finish; the approval itself is saved", notice.Message);
        Assert.NotNull(logged);
        Assert.Equal(0, await ScalarAsync(connection, "SELECT COUNT(*) FROM dbo.tMultiYearUpdateRun;")); // its transaction rolled back
    }

    [Fact]
    [Trait("Layer", "Conformance")]
    public async Task WithoutThePhase2Tables_TheHookDoesNothing()
    {
        await using var connection = await OpenAsync();
        await ExecuteAsync(connection, "EXEC sp_rename 'dbo.tMultiYearUpdateRun', 'tMultiYearUpdateRunGone';");
        await using var db = NewContext();
        Assert.Null(await PortfolioGaaUpdate.AfterApprovalAsync(db, 2095, EnumUpdateTrigger.GaaApproved, "GAA95", null, "tester", ex => throw ex, CancellationToken.None));
    }

    // -------------------------------------------------------------------------------------------

    private MYPSDbContext NewContext() => new(new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer(ConnectionString).Options);

    private async Task<SqlConnection> OpenAsync()
    {
        var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task ExecuteAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<string?> StringAsync(SqlConnection connection, string sql)
    {
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        return (string?)await command.ExecuteScalarAsync();
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await ExecuteAsync(connection, sql);
    }

    private static string FindRepositoryDirectory(string relativePath)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            string candidate = Path.Combine(dir.FullName, relativePath);
            if (Directory.Exists(candidate)) return candidate;
        }
        throw new DirectoryNotFoundException($"{relativePath} not found above {AppContext.BaseDirectory}.");
    }
}
