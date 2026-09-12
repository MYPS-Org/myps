using System;
using System.IO;

namespace Hangfire.Importing
{
    /// <summary>
    /// Naming for every file the import pipeline writes under Resources/Imports — the Program
    /// importer's reports and exports, and the Lump Sum itemization import's error workbook.
    /// One scheme, so <c>DownloadImportFile</c> serves both and a directory listing sorts by run.
    /// </summary>
    /// <remarks>
    /// Moved verbatim from <c>ImportProjectJobService</c> (2026-09-05) so a second caller could
    /// share it rather than re-derive it.
    /// </remarks>
    public static class ImportFileNaming
    {
        // Sanitizes a value for use as a filename component — same treatment every generated
        // file's Program/Stage segment gets, so a stray invalid character can't produce a
        // filename the filesystem rejects.
        public static string SanitizeForFileName(string value)
            => string.Join("_", value.Split(Path.GetInvalidFileNameChars()));

        // Compact, sortable, human-readable file suffix: a "when this ran" timestamp plus a
        // short slice of the job's GUID — not the full 32 characters, just enough to disambiguate
        // two jobs for the same Program+Stage that happen to complete within the same second
        // (seen in practice: concurrent Hangfire servers racing for the same job, see the
        // Hangfire Queue Collision write-up). Replaces the previous filename scheme, which used
        // the full raw JobId and, for the Import Report/Errors files, carried no Program/Stage
        // context at all.
        public static string BuildFileSuffix(string jobId, DateTime timestamp)
            => $"{timestamp:yyyyMMdd-HHmmss}-{jobId.Substring(0, Math.Min(8, jobId.Length))}";
    }
}
