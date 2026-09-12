
namespace WebAPI.Controllers.Lumpsum
{
    /*  WHAT COUNTS AS A LUMP SUM PROJECT — one definition, used by every module
        that has to keep its hands off one.

        A Lump Sum Project is an ordinary tProjects row, so the Project and
        Modification modules will happily list, open and save it like any other.
        Only this module applies the stage gate, the allocation arithmetic and the
        identity rules, so everywhere else must refuse rather than half-apply them.

        THE PARENT CLAUSE IS NOT OPTIONAL. ProjectType 'LS' is set on itemized
        CHILDREN as well — the importer copies it down, so in the sample data 18 of
        the 21 rows carrying it are children. Children are ordinary projects that
        the Project module edits normally; this module never edits them, it only
        creates and deletes them. Testing ProjectType alone would lock all 18 out
        of the one module that is supposed to own them.

        The frontend's equivalent test is `IslandCode === 'LS'`, which needs no such
        clause: a child takes its island code from its own Region ('LZ' and so on),
        so only parents ever read 'LS' there. */
    public static class LumpSumGuard
    {
        /// <summary>tProjects.ProjectType for everything in the Lump Sum family, parents and children alike.</summary>
        public const string ProjectTypeCode = "LS";

        /// <summary>True for a Lump Sum PARENT — the project the Lump Sum module owns.</summary>
        public static bool IsLumpSumParent(DBHelper.Models.Table.Project.Projects? project) =>
            project != null
            && string.Equals(project.ProjectType, ProjectTypeCode, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(project.ParentProjectId);

        /// <summary>
        /// True when an incoming create would produce a Lump Sum Project. Only the
        /// type matters here: AddProject never sets a parent, so any 'LS' it is
        /// handed is an attempt at a parent.
        /// </summary>
        public static bool WouldCreateLumpSum(string? projectType, string? islandCode) =>
            string.Equals(projectType, ProjectTypeCode, StringComparison.OrdinalIgnoreCase)
            || string.Equals(islandCode, ProjectTypeCode, StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// The one refusal message, so every blocked route says the same thing and
        /// points at the module that can actually do the job.
        /// </summary>
        public static string RefusalMessage(string? projectId, string action) =>
            $"{projectId ?? "This project"} is a Lump Sum Project and cannot be {action} here. "
            + "Use the Lump Sum module.";

        public const string RefusalTitle = "Lump Sum Project";
    }
}
