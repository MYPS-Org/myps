using System.Runtime.CompilerServices;
using Helpers;

namespace MYPS.DatabaseTests;

/*  Production code (Main's Program.cs / Startup) sets Appsetting.Resources.SQLScripts (and
    .Internal) from appsettings.json at process start, via Appsetting.PrepareAppsettings. This
    test assembly never runs that startup path, so without this initializer
    Appsetting.Resources.SQLScripts stays "" (its field default) and every
    ISqlExecutor.ExecuteScriptFile*InTransactionAsync call fails with FileNotFoundException,
    even though the correct .sql files are sitting right there on disk under the repo's
    Main/Resources/Internal/SQLScripts/ folder.

    [ModuleInitializer] runs this exactly once, before any test in the assembly, the same way
    xunit discovers tests -- no [CollectionFixture]/IAsyncLifetime wiring needed in each test
    class. Walks up from the test assembly's own output directory (the same FindRepositoryDirectory
    pattern already used by SqlObjectDeployerTests/ProjectDeletionTierTests/DeletionObjectsStatusTests
    to locate Main/Resources/Internal/SQLObjects) to find Main/Resources/Internal/SQLScripts, so it
    works unmodified whether the repo lives in C:\Users\Msi\source\repos\myps_server or anywhere else. */
internal static class TestAppsettingsBootstrap
{
    [ModuleInitializer]
    public static void Initialize()
    {
        string internalRoot = FindRepositoryDirectory("Main/Resources/Internal");
        Appsetting.Resources.Internal = internalRoot;
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
