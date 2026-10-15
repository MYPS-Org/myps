using System.Runtime.CompilerServices;
using Helpers;

namespace MYPS.DatabaseTests;

/*  Production code (Main's Program.cs / Startup) sets Appsetting.Resources.SQLObjects (and
    .Internal) from appsettings.json at process start, via Appsetting.PrepareAppsettings. This
    test assembly never runs that startup path, so without this initializer
    Appsetting.Resources.SQLObjects stays the uncombined relative default "SQLObjects" (its field
    default) and every ISqlExecutor.ExecuteScriptFile*InTransactionAsync call either fails with
    FileNotFoundException or resolves against the test runner's CWD instead of the repo, even
    though the correct .sql files are sitting right there on disk under the repo's
    Main/Resources/Internal/SQLObjects/ folder (2026-10-16: moved here from the former
    Main/Resources/Internal/SQLScripts/Deletion/ location -- see SqlExecutor.cs's _scriptFileRoot).

    [ModuleInitializer] runs this exactly once, before any test in the assembly, the same way
    xunit discovers tests -- no [CollectionFixture]/IAsyncLifetime wiring needed in each test
    class. Walks up from the test assembly's own output directory (the same FindRepositoryDirectory
    pattern already used by SqlObjectDeployerTests/ProjectDeletionTierTests/DeletionObjectsStatusTests)
    to find Main/Resources/Internal, so it works unmodified whether the repo lives in
    C:\Users\Msi\source\repos\myps_server or anywhere else. */
internal static class TestAppsettingsBootstrap
{
    [ModuleInitializer]
    public static void Initialize()
    {
        string internalRoot = FindRepositoryDirectory("Main/Resources/Internal");
        Appsetting.Resources.Internal = internalRoot;
        Appsetting.Resources.SQLObjects = Path.Combine(internalRoot, "SQLObjects");
        Appsetting.Resources.SQLScripts = Path.Combine(internalRoot, "SQLScripts");
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
