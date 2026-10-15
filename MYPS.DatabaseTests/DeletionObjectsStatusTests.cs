using Xunit;

namespace MYPS.DatabaseTests;

/*  Helpers.DeletionObjectsStatus decides whether the delete endpoints answer 503. Converted
    2026-10-16 along with the feature itself: the deletion rule now runs DIRECTLY from the 4
    .sql files under Main/Resources/Internal/SQLScripts/Deletion/ via ISqlExecutor.
    ExecuteScriptFile*InTransactionAsync — no compiled dbo.fProjectDeletionTier /
    dbo.fProgramDeletionEligibility / dbo.pExecuteProjectDeletion / dbo.pExecuteProgramDeletion
    objects exist for this feature any longer, so there is no "deployed version is older than
    this build's code" failure mode left to detect (that used to need column/text inspection
    against sys.objects/sys.columns). What IS still a real, independent failure mode: one of
    the 4 script files missing on disk (bad publish, stripped container layer, misconfigured
    Resources path), or the target database unreachable / below the compatibility level the
    scripts need (FOR JSON PATH, 130+). This suite now tests exactly those two things, instead
    of the old column-staleness checks it used to assert on. Each test runs against its own
    throwaway MYPS_Test_<guid> database (LocalDbSafety) and its own throwaway script directory. */
public sealed class DeletionObjectsStatusTests : IDisposable
{
    private readonly string _databaseName = LocalDbSafety.RequiredPrefix + Guid.NewGuid().ToString("N");
    private string ConnectionString => LocalDbSafety.BuildConnectionString(_databaseName);
    private readonly string _realScriptsRoot = FindRepositoryDirectory("Main/Resources/Internal/SQLScripts");
    private readonly string _emptyScriptsRoot;

    public DeletionObjectsStatusTests()
    {
        _emptyScriptsRoot = Path.Combine(Path.GetTempPath(), "MYPS_Test_EmptyScripts_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_emptyScriptsRoot);
    }

    public void Dispose()
    {
        if (Directory.Exists(_emptyScriptsRoot)) Directory.Delete(_emptyScriptsRoot, recursive: true);
    }

    [Fact]
    public async Task Probe_WithNoScriptFiles_NamesEveryMissingOne()
    {
        string? problem = await Helpers.DeletionObjectsStatus.ProbeAsync(LocalDbSafety.MasterConnectionString, _emptyScriptsRoot);
        Assert.NotNull(problem);
        foreach (string relativePath in Helpers.DeletionObjectsStatus.RequiredScriptFiles)
            Assert.Contains($"{relativePath} is missing", problem);
    }

    [Fact]
    public async Task Probe_WithTheCheckedInScriptFiles_AndNoDatabase_IsReady()
    {
        // The real checked-in scripts are read from disk only — connecting to `master` (always
        // reachable) proves file-presence alone drives readiness when the files are there.
        string? problem = await Helpers.DeletionObjectsStatus.ProbeAsync(LocalDbSafety.MasterConnectionString, _realScriptsRoot);
        Assert.Null(problem);
    }

    [Fact]
    public async Task Probe_OneScriptFileMissing_NamesOnlyThatOne()
    {
        string partialRoot = Path.Combine(Path.GetTempPath(), "MYPS_Test_PartialScripts_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(partialRoot);
        try
        {
            // Copy every required file except one.
            var missingOne = Helpers.DeletionObjectsStatus.RequiredScriptFiles[0];
            foreach (string relativePath in Helpers.DeletionObjectsStatus.RequiredScriptFiles)
            {
                if (relativePath == missingOne) continue;
                string dest = Path.Combine(partialRoot, relativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                File.Copy(Path.Combine(_realScriptsRoot, relativePath), dest);
            }

            string? problem = await Helpers.DeletionObjectsStatus.ProbeAsync(LocalDbSafety.MasterConnectionString, partialRoot);
            Assert.NotNull(problem);
            Assert.Contains($"{missingOne} is missing", problem);
            foreach (string relativePath in Helpers.DeletionObjectsStatus.RequiredScriptFiles.Skip(1))
                Assert.DoesNotContain($"{relativePath} is missing", problem);
        }
        finally
        {
            Directory.Delete(partialRoot, recursive: true);
        }
    }

    [Fact]
    public async Task Probe_DatabaseUnreachable_IsNotReadyEvenWithAllScriptFilesPresent()
    {
        string badConnectionString = LocalDbSafety.BuildConnectionString("MYPS_Test_" + Guid.NewGuid().ToString("N"))
            .Replace(_databaseName, "MYPS_Test_DoesNotExist_" + Guid.NewGuid().ToString("N"));
        string? problem = await Helpers.DeletionObjectsStatus.ProbeAsync(badConnectionString, _realScriptsRoot);
        Assert.NotNull(problem);
        Assert.Contains("not reachable", problem);
    }

    [Fact]
    public async Task Probe_CompatibilityBelow130_IsNotReady()
    {
        await ExecuteMasterAsync($"CREATE DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}]");
        try
        {
            await ExecuteMasterAsync($"ALTER DATABASE [{LocalDbSafety.ValidateDatabaseName(_databaseName)}] SET COMPATIBILITY_LEVEL = 120");
            Assert.Equal("compatibility level 120 is below 130",
                await Helpers.DeletionObjectsStatus.ProbeAsync(ConnectionString, _realScriptsRoot));
        }
        finally
        {
            await DropDatabaseAsync();
        }
    }

    [Fact]
    public async Task EnsureReady_RecoversWithoutARestart_OnceTheMissingFileAppears()
    {
        var status = new Helpers.DeletionObjectsStatus(LocalDbSafety.MasterConnectionString, _emptyScriptsRoot, recheckInterval: TimeSpan.Zero);
        Assert.False(await status.EnsureReadyAsync());
        Assert.Contains("is missing", status.Problem);

        foreach (string relativePath in Helpers.DeletionObjectsStatus.RequiredScriptFiles)
        {
            string dest = Path.Combine(_emptyScriptsRoot, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(Path.Combine(_realScriptsRoot, relativePath), dest, overwrite: true);
        }

        Assert.True(await status.EnsureReadyAsync());
        Assert.Null(status.Problem);
    }

    [Fact]
    public async Task EnsureReady_DoesNotHitTheDatabaseAgainWithinTheInterval()
    {
        var status = new Helpers.DeletionObjectsStatus(LocalDbSafety.MasterConnectionString, _emptyScriptsRoot, recheckInterval: TimeSpan.FromHours(1));
        Assert.False(await status.EnsureReadyAsync());

        foreach (string relativePath in Helpers.DeletionObjectsStatus.RequiredScriptFiles)
        {
            string dest = Path.Combine(_emptyScriptsRoot, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(Path.Combine(_realScriptsRoot, relativePath), dest, overwrite: true);
        }

        Assert.False(await status.EnsureReadyAsync()); // still the cached "not ready" until the interval passes
    }

    private async Task DropDatabaseAsync()
    {
        string safeName = LocalDbSafety.ValidateDatabaseName(_databaseName);
        await ExecuteMasterAsync($"IF DB_ID(N'{safeName}') IS NOT NULL BEGIN ALTER DATABASE [{safeName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{safeName}]; END");
    }

    private static async Task ExecuteMasterAsync(string sql)
    {
        await using var connection = new Microsoft.Data.SqlClient.SqlConnection(LocalDbSafety.MasterConnectionString);
        await connection.OpenAsync();
        await using var command = new Microsoft.Data.SqlClient.SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
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
